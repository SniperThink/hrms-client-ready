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
        
        # Start credit scheduler only in production and not during migrations
        if not settings.DEBUG and 'migrate' not in sys.argv and 'makemigrations' not in sys.argv:
            # Delay import to avoid database access during app initialization
            from django.db import connection
            from django.core.management.color import no_style
            
            # Check if tables exist before starting scheduler
            try:
                from excel_data.credit_scheduler import start_credit_scheduler
                
                # Start scheduler - it has its own delay mechanism
                import threading
                scheduler_thread = threading.Thread(
                    target=start_credit_scheduler,
                    daemon=True
                )
                scheduler_thread.start()
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Could not start credit scheduler: {e}")
