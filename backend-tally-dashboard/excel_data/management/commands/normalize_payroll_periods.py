from django.core.management.base import BaseCommand
from django.db import transaction
from excel_data.models import PayrollPeriod
from excel_data.services.salary_service import SalaryCalculationService
from django.db.models import Q


class Command(BaseCommand):
    help = 'Normalize all PayrollPeriod month names to short format (JAN, FEB, etc.) to match SalaryData format'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without making actual changes',
        )
        parser.add_argument(
            '--tenant-id',
            type=int,
            help='Normalize periods for a specific tenant only',
        )
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Skip confirmation prompt and proceed with normalization',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        tenant_id = options.get('tenant_id')

        # Month mapping for normalization
        MONTH_MAPPING = {
            'JANUARY': 'JAN', 'FEBRUARY': 'FEB', 'MARCH': 'MAR', 'APRIL': 'APR',
            'MAY': 'MAY', 'JUNE': 'JUN', 'JULY': 'JUL', 'AUGUST': 'AUG',
            'SEPTEMBER': 'SEP', 'OCTOBER': 'OCT', 'NOVEMBER': 'NOV', 'DECEMBER': 'DEC',
            'JAN': 'JAN', 'FEB': 'FEB', 'MAR': 'MAR', 'APR': 'APR',
            'JUN': 'JUN', 'JUL': 'JUL', 'AUG': 'AUG', 'SEP': 'SEP',
            'OCT': 'OCT', 'NOV': 'NOV', 'DEC': 'DEC',
            # Handle capitalized variants
            'January': 'JAN', 'February': 'FEB', 'March': 'MAR', 'April': 'APR',
            'June': 'JUN', 'July': 'JUL', 'August': 'AUG', 'September': 'SEP',
            'October': 'OCT', 'November': 'NOV', 'December': 'DEC'
        }

        # Build query
        if tenant_id:
            periods_qs = PayrollPeriod.objects.filter(tenant_id=tenant_id)
            self.stdout.write(f'Normalizing periods for tenant ID: {tenant_id}')
        else:
            periods_qs = PayrollPeriod.objects.all()
            self.stdout.write('Normalizing periods for all tenants')

        if dry_run:
            self.stdout.write(self.style.WARNING('\n=== DRY RUN MODE - No changes will be made ===\n'))

        # Find periods that need normalization
        all_periods = periods_qs.select_related('tenant')
        periods_to_update = []
        
        for period in all_periods:
            month_upper = period.month.upper()
            normalized_month = MONTH_MAPPING.get(month_upper) or SalaryCalculationService._normalize_month_to_short(period.month)
            
            if period.month != normalized_month:
                periods_to_update.append({
                    'period': period,
                    'old_month': period.month,
                    'new_month': normalized_month
                })

        if not periods_to_update:
            self.stdout.write(self.style.SUCCESS('✓ All PayrollPeriod records already use normalized month format'))
            return

        self.stdout.write(f'\nFound {len(periods_to_update)} periods that need normalization:')
        for item in periods_to_update:
            period = item['period']
            self.stdout.write(
                f"  ID {period.id}: {item['old_month']} {period.year} → {item['new_month']} "
                f"(Tenant: {period.tenant.name if period.tenant else 'N/A'})"
            )

        if dry_run:
            self.stdout.write(self.style.WARNING('\n✓ Dry run complete. Use without --dry-run to apply changes.'))
            return

        # Confirm before proceeding (unless --yes flag is set)
        skip_confirm = options.get('yes', False)
        if not skip_confirm:
            self.stdout.write(self.style.WARNING(f'\n⚠️  This will update {len(periods_to_update)} PayrollPeriod records.'))
            response = input('Do you want to continue? (yes/no): ')
            
            if response.lower() not in ['yes', 'y']:
                self.stdout.write(self.style.ERROR('Operation cancelled.'))
                return

        # Normalize periods
        updated_count = 0
        error_count = 0
        
        with transaction.atomic():
            for item in periods_to_update:
                period = item['period']
                try:
                    old_month = period.month
                    period.month = item['new_month']
                    
                    # Check for duplicate (if another period with normalized month already exists)
                    existing = PayrollPeriod.objects.filter(
                        tenant=period.tenant,
                        year=period.year,
                        month=item['new_month']
                    ).exclude(id=period.id).first()
                    
                    if existing:
                        self.stdout.write(
                            self.style.ERROR(
                                f"  ✗ ID {period.id}: Cannot normalize - period {existing.id} already exists "
                                f"with {item['new_month']} {period.year}"
                            )
                        )
                        error_count += 1
                        continue
                    
                    period.save()
                    self.stdout.write(
                        f"  ✓ ID {period.id}: {old_month} {period.year} → {item['new_month']}"
                    )
                    updated_count += 1
                    
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f"  ✗ ID {period.id}: Error - {str(e)}")
                    )
                    error_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'\n✅ Normalization complete: {updated_count} updated, {error_count} errors'
            )
        )
