# Celery Background Tasks Setup

## Overview

The HRMS backend now uses **Celery** for robust background task processing, replacing the previous thread-based approach.

### Benefits:
✅ **Automatic retries** on failure (max 3 attempts)  
✅ **Survives server restarts** (tasks persist in Redis)  
✅ **Task monitoring** via Celery Flower dashboard  
✅ **Better error handling** and logging  
✅ **Scheduled tasks** (periodic cleanup, etc.)  
✅ **Scalable** (can run multiple workers)  

---

## Prerequisites

### 1. Redis Server
Celery uses Redis as the message broker.

**Install Redis (if not installed):**
```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis
```

**Start Redis:**
```bash
# Ubuntu/Debian
sudo systemctl start redis-server
sudo systemctl enable redis-server  # Auto-start on boot

# macOS
brew services start redis

# Check if Redis is running
redis-cli ping  # Should return: PONG
```

**Configure Redis URL (optional):**
Add to `.env` file:
```env
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

---

## Running Celery Workers

### Development Environment

**Terminal 1: Start Django Server**
```bash
cd /home/saiii/Desktop/sniperthink/dev/HRMS/backend-tally-dashboard
source hrms/bin/activate  # Activate virtual environment
python manage.py runserver
```

**Terminal 2: Start Celery Worker**
```bash
cd /home/saiii/Desktop/sniperthink/dev/HRMS/backend-tally-dashboard
source hrms/bin/activate
celery -A dashboard worker -l info
```

**Terminal 3 (Optional): Start Celery Beat (Periodic Tasks)**
```bash
cd /home/saiii/Desktop/sniperthink/dev/HRMS/backend-tally-dashboard
source hrms/bin/activate
celery -A dashboard beat -l info
```

**Terminal 4 (Optional): Start Flower (Monitoring Dashboard)**
```bash
cd /home/saiii/Desktop/sniperthink/dev/HRMS/backend-tally-dashboard
source hrms/bin/activate
celery -A dashboard flower
# Open http://localhost:5555 in browser
```

---

## Production Deployment

### Using Supervisor (Recommended)

**1. Install Supervisor:**
```bash
sudo apt-get install supervisor
```

**2. Create Celery Worker Config:**
```bash
sudo nano /etc/supervisor/conf.d/hrms-celery.conf
```

```ini
[program:hrms-celery-worker]
command=/home/saiii/Desktop/sniperthink/dev/HRMS/backend-tally-dashboard/hrms/bin/celery -A dashboard worker -l info
directory=/home/saiii/Desktop/sniperthink/dev/HRMS/backend-tally-dashboard
user=saiii
numprocs=1
stdout_logfile=/var/log/celery/worker.log
stderr_logfile=/var/log/celery/worker_error.log
autostart=true
autorestart=true
startsecs=10
stopwaitsecs=600
priority=998
```

**3. Create Celery Beat Config (for scheduled tasks):**
```bash
sudo nano /etc/supervisor/conf.d/hrms-celery-beat.conf
```

```ini
[program:hrms-celery-beat]
command=/home/saiii/Desktop/sniperthink/dev/HRMS/backend-tally-dashboard/hrms/bin/celery -A dashboard beat -l info
directory=/home/saiii/Desktop/sniperthink/dev/HRMS/backend-tally-dashboard
user=saiii
numprocs=1
stdout_logfile=/var/log/celery/beat.log
stderr_logfile=/var/log/celery/beat_error.log
autostart=true
autorestart=true
startsecs=10
stopwaitsecs=60
priority=999
```

**4. Create Log Directory:**
```bash
sudo mkdir -p /var/log/celery
sudo chown saiii:saiii /var/log/celery
```

**5. Start Services:**
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start hrms-celery-worker
sudo supervisorctl start hrms-celery-beat
```

**6. Check Status:**
```bash
sudo supervisorctl status
```

---

## Current Background Tasks

### 1. Chart Data Sync (`sync_chart_data_batch_task`)
**Triggered by:**
- Excel salary uploads
- Frontend payroll calculations

**Purpose:** Sync ChartAggregatedData for fast dashboard charts

**Queue:** `chart_sync`

**Features:**
- Automatic retries (3 attempts)
- 60-second retry delay
- 30-minute timeout

### 2. Cleanup Old Data (`cleanup_old_chart_data`)
**Schedule:** Every Sunday at 2 AM

**Purpose:** Remove chart data older than 90 days

**Queue:** `maintenance`

---

## Monitoring & Debugging

### Check Task Status
```bash
# In Django shell
python manage.py shell

from excel_data.tasks import sync_chart_data_batch_task
from celery.result import AsyncResult

# Check task status by ID
task_id = "your-task-id-here"
result = AsyncResult(task_id)
print(result.state)  # PENDING, STARTED, SUCCESS, FAILURE, RETRY
print(result.info)   # Task result or error info
```

### View Celery Logs
```bash
# Worker logs
tail -f /var/log/celery/worker.log

# Error logs
tail -f /var/log/celery/worker_error.log
```

### Monitor with Flower
Open http://localhost:5555 to see:
- Active tasks
- Task history
- Worker status
- Task execution time
- Failure rates

---

## Fallback Behavior

If Celery/Redis is not running, the system automatically falls back to **thread-based processing** (old method). This ensures:
- No breaking changes
- System continues to work
- Warning logged in console

---

## Testing

**Test Celery is working:**
```bash
python manage.py shell

from excel_data.tasks import sync_chart_data_batch_task
from excel_data.models import Tenant

tenant = Tenant.objects.first()
task = sync_chart_data_batch_task.delay(tenant.id, 2025, 'JAN', 'excel')
print(f"Task ID: {task.id}")
print(f"Task State: {task.state}")
```

**Test periodic tasks:**
```bash
celery -A dashboard inspect scheduled
```

---

## Troubleshooting

### Issue: Celery worker won't start
**Check:**
1. Redis is running: `redis-cli ping`
2. Virtual environment is activated
3. Check for port conflicts: `lsof -i :6379`

### Issue: Tasks not executing
**Check:**
1. Worker is running: `celery -A dashboard inspect active`
2. Check logs: `tail -f /var/log/celery/worker.log`
3. Check Redis connection: `redis-cli monitor`

### Issue: Tasks failing silently
**Enable debug logging:**
```python
# In settings.py
CELERY_WORKER_LOGLEVEL = 'DEBUG'
```

---

## Performance Tuning

**For high-volume environments:**

```python
# In settings.py

# Increase worker concurrency
CELERY_WORKER_CONCURRENCY = 8  # Number of worker processes

# Use eventlet/gevent for I/O-bound tasks
CELERY_WORKER_POOL = 'eventlet'

# Adjust prefetch multiplier
CELERY_WORKER_PREFETCH_MULTIPLIER = 2
```

**Run worker with concurrency:**
```bash
celery -A dashboard worker -l info --concurrency=8
```

---

## Next Steps

1. ✅ Celery configured and ready
2. ⏳ Start Redis server
3. ⏳ Start Celery worker
4. ⏳ Test chart sync works
5. ⏳ Set up Supervisor for production
6. ⏳ Monitor with Flower dashboard

---

For more information, see:
- [Celery Documentation](https://docs.celeryq.dev/)
- [Django + Celery Guide](https://docs.celeryq.dev/en/stable/django/)

