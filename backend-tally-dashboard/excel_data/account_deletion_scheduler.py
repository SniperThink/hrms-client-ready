"""
Account Deletion Scheduler
Automatically permanently deletes accounts after 30-day recovery period expires.
Runs checks:
1. On application startup
2. Every hour
3. At midnight (00:00:00 IST) daily
"""

import threading
import time
import logging
from datetime import datetime, time as datetime_time
from django.utils import timezone
import pytz
from django.db import connection

logger = logging.getLogger(__name__)


class AccountDeletionScheduler:
    """
    Background scheduler for permanent account deletion.
    Runs in a separate daemon thread.
    """
    
    def __init__(self):
        self.running = False
        self.thread = None
        self.last_hourly_check = None
        self.last_midnight_check = None
        
    def process_deletion_warnings(self, recovery_period_days=30, warning_days=3):
        """Send deletion warning emails to accounts that are 3 days before permanent deletion"""
        try:
            # Import here to avoid circular imports
            from excel_data.models import Tenant
            from excel_data.services.email_service import send_deletion_warning_email
            
            # Close old connections
            connection.close()
            
            # Find tenants that should receive warning emails (3 days before deletion)
            soft_deleted_tenants = Tenant.objects.filter(
                deactivated_at__isnull=False,
                deletion_warning_email_sent=False
            )
            
            warnings_sent = 0
            
            for tenant in soft_deleted_tenants:
                try:
                    if tenant.should_send_deletion_warning(recovery_period_days=recovery_period_days, warning_days=warning_days):
                        # Send warning email
                        if send_deletion_warning_email(tenant):
                            tenant.deletion_warning_email_sent = True
                            tenant.save(update_fields=['deletion_warning_email_sent'])
                            warnings_sent += 1
                            logger.info(f"📧 Deletion warning email sent for tenant {tenant.name} (ID: {tenant.id})")
                except Exception as e:
                    logger.error(f"Error sending deletion warning for tenant {tenant.id}: {str(e)}", exc_info=True)
            
            if warnings_sent > 0:
                logger.info(f"📧 Account deletion scheduler: Sent {warnings_sent} deletion warning email(s)")
            
            return warnings_sent
            
        except Exception as e:
            logger.error(f"Error in deletion warning process: {str(e)}", exc_info=True)
            return 0
    
    def process_expired_accounts(self, recovery_period_days=30):
        """Permanently delete accounts that have passed recovery period"""
        try:
            # Import here to avoid circular imports
            from excel_data.models import Tenant
            
            # Close old connections
            connection.close()
            
            # Find tenants that are soft-deleted and recovery period expired
            from datetime import timedelta
            cutoff_date = timezone.now() - timedelta(days=recovery_period_days)
            
            expired_tenants = Tenant.objects.filter(
                deactivated_at__isnull=False,
                deactivated_at__lt=cutoff_date
            )
            
            total = expired_tenants.count()
            deleted = 0
            
            if total == 0:
                logger.debug("Account deletion scheduler: No expired accounts to delete")
                return 0, 0
            
            logger.info(f"🗑️ Account deletion scheduler: Found {total} expired account(s) to permanently delete")
            
            for tenant in expired_tenants:
                try:
                    # Double-check recovery period expired
                    if tenant.should_permanently_delete(recovery_period_days=recovery_period_days):
                        tenant.permanently_delete()
                        deleted += 1
                except Exception as e:
                    logger.error(f"Error permanently deleting tenant {tenant.id}: {str(e)}", exc_info=True)
            
            if deleted > 0:
                logger.warning(
                    f"🗑️ Account deletion scheduler: Permanently deleted {deleted}/{total} expired account(s)"
                )
            else:
                logger.debug(f"Account deletion scheduler: Processed {total} expired accounts, none deleted")
                
            return total, deleted
            
        except Exception as e:
            logger.error(f"Error in account deletion scheduler: {str(e)}", exc_info=True)
            return 0, 0
    
    def should_run_midnight_check(self):
        """Check if we should run the midnight check"""
        ist = pytz.timezone('Asia/Kolkata')
        now_ist = timezone.now().astimezone(ist)
        current_time = now_ist.time()
        current_date = now_ist.date()
        
        # Check if it's between 00:00:00 and 00:05:00 (5 minute window)
        midnight_start = datetime_time(0, 0, 0)
        midnight_end = datetime_time(0, 5, 0)
        
        is_midnight_window = midnight_start <= current_time <= midnight_end
        
        # Check if we haven't run today
        already_ran_today = (
            self.last_midnight_check is not None and 
            self.last_midnight_check >= current_date
        )
        
        return is_midnight_window and not already_ran_today
    
    def should_run_hourly_check(self):
        """Check if we should run the hourly check"""
        if self.last_hourly_check is None:
            return True
        
        # Run if more than 1 hour has passed
        now = timezone.now()
        time_diff = (now - self.last_hourly_check).total_seconds()
        return time_diff >= 3600  # 1 hour = 3600 seconds
    
    def run(self):
        """Main scheduler loop"""
        ist = pytz.timezone('Asia/Kolkata')
        logger.info("🚀 Account deletion scheduler started")
        
        # Run immediately on startup
        logger.info("🌟 Running account deletion check on startup...")
        # Process warnings first, then deletions
        warnings_sent = self.process_deletion_warnings()
        total, deleted = self.process_expired_accounts()
        self.last_hourly_check = timezone.now()
        self.last_midnight_check = timezone.now().astimezone(ist).date()
        
        while self.running:
            try:
                # Check if we should run midnight check
                if self.should_run_midnight_check():
                    ist_now = timezone.now().astimezone(ist)
                    logger.info(f"🌙 Running midnight account deletion check at {ist_now.strftime('%H:%M:%S IST')}")
                    # Process warnings first, then deletions
                    warnings_sent = self.process_deletion_warnings()
                    total, deleted = self.process_expired_accounts()
                    self.last_midnight_check = ist_now.date()
                    
                    if warnings_sent > 0:
                        logger.info(f"🌙 Midnight check: Sent {warnings_sent} deletion warning email(s)")
                    if deleted > 0:
                        logger.warning(f"🌙 Midnight deletion check complete: {deleted} account(s) permanently deleted")
                
                # Check if we should run hourly check
                elif self.should_run_hourly_check():
                    logger.info("⏰ Running hourly account deletion check...")
                    # Process warnings first, then deletions
                    warnings_sent = self.process_deletion_warnings()
                    total, deleted = self.process_expired_accounts()
                    self.last_hourly_check = timezone.now()
                    
                    if warnings_sent > 0:
                        logger.info(f"⏰ Hourly check: Sent {warnings_sent} deletion warning email(s)")
                    if deleted > 0:
                        logger.warning(f"⏰ Hourly deletion check complete: {deleted} account(s) permanently deleted")
                
                # Sleep for 1 minute before next check
                time.sleep(60)
                
            except Exception as e:
                logger.error(f"Error in account deletion scheduler loop: {str(e)}", exc_info=True)
                time.sleep(60)  # Wait a minute before retrying
    
    def start(self):
        """Start the scheduler in a daemon thread"""
        if self.running:
            logger.warning("Account deletion scheduler is already running")
            return
        
        self.running = True
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()
        logger.info("Account deletion scheduler thread started")
    
    def stop(self):
        """Stop the scheduler"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        logger.info("Account deletion scheduler stopped")


# Global scheduler instance
_deletion_scheduler = None


def get_deletion_scheduler():
    """Get or create the global deletion scheduler instance"""
    global _deletion_scheduler
    if _deletion_scheduler is None:
        _deletion_scheduler = AccountDeletionScheduler()
    return _deletion_scheduler


def start_account_deletion_scheduler():
    """Start the account deletion scheduler (call this on app startup)"""
    scheduler = get_deletion_scheduler()
    scheduler.start()


def stop_account_deletion_scheduler():
    """Stop the account deletion scheduler"""
    scheduler = get_deletion_scheduler()
    scheduler.stop()

