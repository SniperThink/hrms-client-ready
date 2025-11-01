#!/bin/bash

# Get the project directory (where this script resides)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PATH="$PROJECT_DIR/hrms/bin/activate"
LOG_DIR="/var/log/hrms"
LOG_FILE="$LOG_DIR/credit_processing.log"

# Create log directory if it doesn't exist
sudo mkdir -p "$LOG_DIR"
sudo chown "$USER:$USER" "$LOG_DIR"

# Run daily at 8:30 PM local time
CRON_TIME="0 1 * * *"

# Create the cron entry
CRON_ENTRY="$CRON_TIME bash -c 'source $VENV_PATH && cd $PROJECT_DIR && python manage.py process_daily_credits >> $LOG_FILE 2>&1'"

# Remove any existing similar cron jobs and add the new one
(crontab -l 2>/dev/null | grep -v "process_daily_credits"; echo "$CRON_ENTRY") | crontab -

echo "✅ Cron job has been set up successfully!"
echo "🕒 The credit processing will run daily at 8:30 PM local time (IST)."
echo "🗂️  Logs will be written to: $LOG_FILE"
echo ""
echo "📋 Current crontab:"
crontab -l
