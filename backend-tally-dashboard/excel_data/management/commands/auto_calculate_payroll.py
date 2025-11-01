from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, timedelta
from excel_data.models import Tenant
from excel_data.salary_service import SalaryCalculationService
import calendar
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Automatically calculate payroll for previous month for tenants with auto_calculate_payroll enabled'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force calculation even if not 1st of month',
        )

    def handle(self, *args, **options):
        today = timezone.now().date()
        
        # Check if today is 1st of month or force is enabled
        if today.day != 1 and not options['force']:
            self.stdout.write(
                self.style.WARNING('Auto payroll calculation only runs on 1st of month. Use --force to override.')
            )
            return

        # Calculate previous month
        if today.month == 1:
            prev_month = 12
            prev_year = today.year - 1
        else:
            prev_month = today.month - 1
            prev_year = today.year

        prev_month_name = calendar.month_name[prev_month].upper()
        
        self.stdout.write(f'Starting auto payroll calculation for {prev_month_name} {prev_year}')

        # Get all tenants with auto calculate enabled
        tenants = Tenant.objects.filter(auto_calculate_payroll=True)
        
        success_count = 0
        error_count = 0

        for tenant in tenants:
            try:
                self.stdout.write(f'Processing tenant: {tenant.name}')
                
                # Calculate payroll for previous month
                results = SalaryCalculationService.calculate_salary_for_period(
                    tenant, prev_year, prev_month_name, force_recalculate=True
                )
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Successfully calculated payroll for {tenant.name}: {results}'
                    )
                )
                success_count += 1
                
            except Exception as e:
                logger.error(f"Error calculating payroll for tenant {tenant.name}: {str(e)}")
                self.stdout.write(
                    self.style.ERROR(
                        f'✗ Failed to calculate payroll for {tenant.name}: {str(e)}'
                    )
                )
                error_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'\nAuto payroll calculation completed: {success_count} successful, {error_count} failed'
            )
        ) 