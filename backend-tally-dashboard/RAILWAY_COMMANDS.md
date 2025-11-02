# Railway Deployment Commands

This file contains all commands you'll need during Railway deployment.

## 📦 Installation Commands

```bash
# Install Railway CLI
npm install -g @railway/cli

# Or using Homebrew (Mac/Linux)
brew install railway

# Login to Railway
railway login

# Link to your project
railway link
```

## 🔧 Management Commands

### Database Operations
```bash
# Run migrations
railway run python manage.py migrate

# Create superuser
railway run python manage.py createsuperuser

# Create cache table
railway run python manage.py createcachetable

# Collect static files
railway run python manage.py collectstatic --noinput

# Flush database (CAREFUL!)
railway run python manage.py flush --noinput
```

### Data Management
```bash
# Create initial tenant
railway run python manage.py shell
>>> from excel_data.models import Tenant
>>> Tenant.objects.create(subdomain='demo', company_name='Demo Company')
>>> exit()

# Load fixtures (if you have any)
railway run python manage.py loaddata initial_data.json
```

### Debugging
```bash
# Open Django shell
railway run python manage.py shell

# Check database connection
railway run python manage.py dbshell

# Run specific command
railway run python manage.py your_custom_command
```

## 📊 Logs & Monitoring

```bash
# View live logs
railway logs

# View logs with follow
railway logs --follow

# View specific service logs
railway logs --service backend
```

## 🚀 Deployment Commands

```bash
# Manual deploy (if needed)
railway up

# Check deployment status
railway status

# View environment variables
railway variables

# Set environment variable
railway variables set KEY=value

# Delete environment variable
railway variables delete KEY
```

## 🔄 Celery Commands (Optional - if enabled)

```bash
# Start Celery worker (if CELERY_ENABLED=True)
railway run celery -A dashboard worker -l info

# Start Celery beat (periodic tasks)
railway run celery -A dashboard beat -l info

# Check Celery tasks
railway run celery -A dashboard inspect active
```

## 🗄️ Database Backup & Restore

```bash
# Backup database
railway run pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Or use Neon directly
pg_dump "postgresql://neondb_owner:npg_kiW2lJnVcsu8@ep-lingering-block-a1olkbv3-pooler.ap-southeast-1.aws.neon.tech:5432/neondb" > backup.sql

# Restore database (CAREFUL!)
railway run psql $DATABASE_URL < backup.sql
```

## 🧪 Testing Commands

```bash
# Test email configuration
railway run python manage.py shell
>>> from django.core.mail import send_mail
>>> send_mail('Test', 'Message', 'from@email.com', ['to@email.com'])

# Test API endpoint
curl https://your-project.railway.app/api/health/

# Test with authentication
curl https://your-project.railway.app/api/employees/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔍 Troubleshooting Commands

```bash
# Check Python version
railway run python --version

# List installed packages
railway run pip list

# Check Django version
railway run python manage.py version

# Run Django check
railway run python manage.py check

# Check for migrations
railway run python manage.py showmigrations

# Create migrations (if needed)
railway run python manage.py makemigrations
```

## 💻 Railway-Specific Commands

```bash
# Get current project info
railway project

# Switch project
railway project select

# List all services
railway service

# Get service domain
railway domain

# Open Railway dashboard
railway open

# Disconnect from project
railway unlink
```

## 📝 Useful One-Liners

```bash
# Full setup after first deployment
railway run python manage.py migrate && \
railway run python manage.py createcachetable && \
railway run python manage.py collectstatic --noinput

# Create superuser non-interactively
railway run python manage.py shell -c "
from excel_data.models import CustomUser
CustomUser.objects.create_superuser('admin@example.com', 'password123', first_name='Admin', last_name='User')
"

# Check all environment variables are set
railway variables | grep -E '(SECRET_KEY|DATABASE_URL|DEBUG)'

# Test database connection
railway run python manage.py dbshell -c "SELECT version();"
```

## 🔄 Rollback Commands

```bash
# View deployment history
railway deployment list

# Rollback to previous deployment
railway deployment rollback <deployment-id>

# View specific deployment logs
railway logs --deployment <deployment-id>
```

## 📦 Advanced Commands

```bash
# Run migrations for specific app
railway run python manage.py migrate excel_data

# Fake migrations (if needed)
railway run python manage.py migrate --fake

# Show SQL for migration
railway run python manage.py sqlmigrate excel_data 0001

# Revert migration
railway run python manage.py migrate excel_data 0001

# Create Django shell script
railway run python manage.py shell < script.py
```

## 🎯 Production Maintenance

```bash
# Weekly database backup
railway run pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d).sql.gz

# Check disk space (if using Railway disk)
railway run df -h

# Check memory usage
railway run free -h

# Check running processes
railway run ps aux

# Clear Django cache
railway run python manage.py shell -c "from django.core.cache import cache; cache.clear()"
```

## 📊 Performance Monitoring

```bash
# Django debug toolbar (if installed)
# Add to INTERNAL_IPS in settings

# Check slow queries
railway run python manage.py shell
>>> from django.db import connection
>>> print(connection.queries)

# Profile specific view
railway run python manage.py runserver --noreload
```

## 🔐 Security Commands

```bash
# Generate new SECRET_KEY
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Check security settings
railway run python manage.py check --deploy

# Rotate JWT tokens (invalidate all)
railway run python manage.py shell -c "
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
OutstandingToken.objects.all().delete()
"
```

## 📧 Email Testing

```bash
# Test email with Django shell
railway run python manage.py shell
>>> from django.core.mail import send_mail
>>> send_mail(
...     'Test Subject',
...     'Test Message',
...     'Team.Sniperthink@gmail.com',
...     ['recipient@example.com'],
...     fail_silently=False,
... )
```

---

## 💡 Tips

1. **Always test commands locally first** with `python manage.py <command>`
2. **Use `--dry-run`** flag when available for destructive commands
3. **Keep backups** before running migrations or data modifications
4. **Monitor logs** after running commands: `railway logs --follow`
5. **Document custom commands** you create for your team

---

## 🆘 Emergency Commands

```bash
# Restart service
railway service restart

# Scale down (if issues)
railway service scale --replicas 0
railway service scale --replicas 1

# Emergency database restore
railway run psql $DATABASE_URL < emergency_backup.sql

# Force rebuild
railway up --force
```

---

**Save this file for quick reference during deployment and maintenance!**
