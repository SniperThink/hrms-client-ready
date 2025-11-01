from django.core.management.base import BaseCommand
from django.db import transaction
from excel_data.models import PayrollPeriod, CalculatedSalary, DataSource
from datetime import date


class Command(BaseCommand):
    help = 'Fix uploaded salary records to mark them as paid'

    def add_arguments(self, parser):
        parser.add_argument('--tenant-id', type=int, help='Specific tenant ID to fix')
        parser.add_argument('--period-id', type=int, help='Specific period ID to fix')
        parser.add_argument('--dry-run', action='store_true', help='Show what would be updated without making changes')

    def handle(self, *args, **options):
        tenant_id = options.get('tenant_id')
        period_id = options.get('period_id')
        dry_run = options.get('dry_run', False)

        # Build query for uploaded periods
        query = PayrollPeriod.objects.filter(data_source=DataSource.UPLOADED)
        
        if tenant_id:
            query = query.filter(tenant_id=tenant_id)
        if period_id:
            query = query.filter(id=period_id)

        periods = query.all()
        
        if not periods.exists():
            self.stdout.write(self.style.WARNING('No uploaded periods found'))
            return

        total_updated = 0
        
        for period in periods:
            self.stdout.write(f'Processing period: {period.month} {period.year} (ID: {period.id})')
            
            # Get all calculated salaries for this period that are not paid
            salaries = CalculatedSalary.objects.filter(
                payroll_period=period,
                is_paid=False
            )
            
            count = salaries.count()
            if count == 0:
                self.stdout.write(f'  No unpaid salaries found')
                continue
                
            self.stdout.write(f'  Found {count} unpaid salaries')
            
            if not dry_run:
                with transaction.atomic():
                    updated = salaries.update(
                        is_paid=True,
                        payment_date=date.today()
                    )
                    total_updated += updated
                    self.stdout.write(f'  Updated {updated} salaries to paid status')
            else:
                self.stdout.write(f'  Would update {count} salaries to paid status')
                total_updated += count

        if dry_run:
            self.stdout.write(self.style.SUCCESS(f'DRY RUN: Would update {total_updated} salary records'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Successfully updated {total_updated} salary records'))


