from django.apps import AppConfig
from django.conf import settings
import os


class ExcelDataConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'excel_data'

    def ready(self):
        # Import signals
        import excel_data.signals  # noqa
        
        # Defer credit scheduler start to avoid database access during app initialization
        # Only start in production and not during migrations
        if not settings.DEBUG and 'migrate' not in os.sys.argv:
            # Use threading to defer the scheduler start
            import threading
            
            def delayed_start():
                import time
                time.sleep(5)  # Wait 5 seconds for app to fully initialize
                from excel_data.credit_scheduler import start_credit_scheduler
                start_credit_scheduler()
            
            # Start scheduler in background thread after delay
            threading.Thread(target=delayed_start, daemon=True).start()
