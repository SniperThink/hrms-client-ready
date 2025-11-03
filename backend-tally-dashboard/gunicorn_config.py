# Gunicorn Configuration for HRMS Backend
# Using sync workers for Python 3.13 compatibility
# Note: New code suggests gevent for SSE support, but Python 3.13 has gevent compatibility issues
# SSE features can work with sync workers + threading if needed

import multiprocessing
import os

# Server socket
# Railway provides PORT env variable, fallback to 8000 for local dev
port = os.getenv("PORT", os.getenv("GUNICORN_BIND_PORT", "8000"))
bind = f"0.0.0.0:{port}"
backlog = 2048

# Worker processes
# Force sync workers for Python 3.13 compatibility (gevent has issues)
# If SSE support is absolutely required, consider:
# 1. Downgrading to Python 3.11
# 2. Using Django Channels with ASGI
# 3. Implementing SSE with sync workers + threading
workers = int(os.getenv("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1))
worker_class = "sync"  # Force sync workers - do not use gevent with Python 3.13
threads = int(os.getenv("GUNICORN_THREADS", 4))  # Add threads for concurrency
timeout = int(os.getenv("GUNICORN_TIMEOUT", 120))  # 2 minutes
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", 5))

# Logging
accesslog = os.getenv("GUNICORN_ACCESS_LOG", "-")  # Log to stdout
errorlog = os.getenv("GUNICORN_ERROR_LOG", "-")    # Log to stderr
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "hrms-backend"

# Server mechanics
daemon = False
pidfile = os.getenv("GUNICORN_PIDFILE", None)
umask = 0
user = os.getenv("GUNICORN_USER", None)
group = os.getenv("GUNICORN_GROUP", None)

# Performance tuning
max_requests = int(os.getenv("GUNICORN_MAX_REQUESTS", 1000))
max_requests_jitter = int(os.getenv("GUNICORN_MAX_REQUESTS_JITTER", 50))
preload_app = os.getenv("GUNICORN_PRELOAD_APP", "True").lower() == "true"

# Graceful timeout for worker shutdown
graceful_timeout = int(os.getenv("GUNICORN_GRACEFUL_TIMEOUT", 30))

