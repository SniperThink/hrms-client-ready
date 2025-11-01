from django.core.management.base import BaseCommand
from excel_data.models import Tenant
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Process daily credit deduction for all active tenants at 1 AM IST'

    def handle(self, *args, **options):
        logger.info("Starting daily credit processing for all tenants")
        
        # Get all active tenants with credits > 0
        tenants = Tenant.objects.filter(is_active=True, credits__gt=0)
        total_tenants = tenants.count()
        processed = 0
        
        for tenant in tenants:
            try:
                if tenant.deduct_daily_credit():
                    processed += 1
                    self.stdout.write(
                        self.style.SUCCESS(f'Successfully processed credits for tenant {tenant.name}')
                    )
            except Exception as e:
                error_msg = f"Error processing credits for tenant {tenant.id}: {str(e)}"
                logger.error(error_msg)
                self.stderr.write(self.style.ERROR(error_msg))
        
        summary = f"Completed daily credit processing. Processed {processed} of {total_tenants} tenants."
        logger.info(summary)
        self.stdout.write(self.style.SUCCESS(summary))
