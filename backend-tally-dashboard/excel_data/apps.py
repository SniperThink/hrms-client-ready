from django.apps import AppConfig
from django.conf import settings


class ExcelDataConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'excel_data'

    def ready(self):
        # Import signals
        import excel_data.signals  # noqa
