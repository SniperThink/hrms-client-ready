from django.apps import AppConfig
from django.conf import settings
import os
import sys


class ExcelDataConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'excel_data'

    def ready(self):
        # Import signals
        import excel_data.signals  # noqa
        
        # Start credit scheduler (hybrid approach combining both versions)
        # Check if we're in the main process and not running migrations
        should_start = False
        
        if not settings.DEBUG and 'migrate' not in sys.argv and 'makemigrations' not in sys.argv:
            # Production mode - start scheduler (check RUN_MAIN for Railway compatibility)
            should_start = os.environ.get('RUN_MAIN') != 'true'
        elif os.environ.get('RUN_MAIN') == 'true' and settings.DEBUG:
            # Development mode with reloader - start in reloaded process
            should_start = True
            
        if should_start:
            try:
                from excel_data.credit_scheduler import start_credit_scheduler
                
                # Use threading for safe deferred start (Railway compatibility)
                import threading
                def delayed_start():
                    import time
                    time.sleep(5)  # Wait for full Django initialization
                    start_credit_scheduler()
                
                scheduler_thread = threading.Thread(
                    target=delayed_start,
                    daemon=True
                )
                scheduler_thread.start()
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Could not start credit scheduler: {e}")
