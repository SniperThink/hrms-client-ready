from django.core.management.base import BaseCommand
from django.core.cache import cache
from excel_data.models import Tenant, PayrollPeriod
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Clear backend cache (all cache or tenant-specific)'

    def add_arguments(self, parser):
        parser.add_argument('--tenant-id', type=int, help='Clear cache for specific tenant only')
        parser.add_argument('--all', action='store_true', help='Clear all cache')
        parser.add_argument('--dry-run', action='store_true', help='Show what would be cleared without making changes')

    def handle(self, *args, **options):
        tenant_id = options.get('tenant_id')
        clear_all = options.get('all', False)
        dry_run = options.get('dry_run', False)

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No cache will be cleared'))

        if clear_all:
            # Clear all cache
            if not dry_run:
                try:
                    cache.clear()
                    self.stdout.write(self.style.SUCCESS('✓ Cleared ALL cache'))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'Error clearing all cache: {str(e)}'))
            else:
                self.stdout.write(self.style.WARNING('Would clear ALL cache'))
        
        elif tenant_id:
            # Clear cache for specific tenant
            try:
                tenant = Tenant.objects.get(id=tenant_id)
                self.stdout.write(f'Clearing cache for tenant: {tenant.name} (ID: {tenant_id})')
            except Tenant.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'Tenant with ID {tenant_id} does not exist'))
                return

            if not dry_run:
                cleared_count = 0
                
                # List of common cache key patterns for this tenant
                cache_patterns = [
                    f"payroll_overview_{tenant_id}",
                    f"directory_data_{tenant_id}",
                    f"attendance_all_records_{tenant_id}",
                    f"months_with_attendance_{tenant_id}",
                    f"dashboard_stats_{tenant_id}",
                    f"all_departments_{tenant_id}",
                ]

                # Clear known cache keys
                for key in cache_patterns:
                    if cache.delete(key):
                        cleared_count += 1
                        self.stdout.write(f'  ✓ Cleared: {key}')

                # Clear frontend charts cache (multiple variations)
                chart_keys = [
                    f"frontend_charts_{tenant_id}_this_month_All_",
                    f"frontend_charts_{tenant_id}_last_6_months_All_",
                    f"frontend_charts_{tenant_id}_last_12_months_All_",
                    f"frontend_charts_{tenant_id}_last_5_years_All_",
                ]
                for key in chart_keys:
                    if cache.delete(key):
                        cleared_count += 1
                        self.stdout.write(f'  ✓ Cleared: {key}')

                # Clear payroll period caches
                periods = PayrollPeriod.objects.filter(tenant_id=tenant_id)
                for period in periods:
                    period_keys = [
                        f"payroll_period_detail_{period.id}",
                        f"payroll_summary_{period.id}",
                    ]
                    for key in period_keys:
                        if cache.delete(key):
                            cleared_count += 1

                if periods.exists():
                    self.stdout.write(f'  ✓ Cleared {periods.count()} payroll period caches')

                # Try to clear pattern-based caches (if supported)
                try:
                    # This works with Redis cache backends
                    cache.delete_pattern(f"frontend_charts_{tenant_id}_*")
                    cache.delete_pattern(f"attendance_all_records_{tenant_id}_*")
                    cache.delete_pattern(f"eligible_employees_{tenant_id}_*")
                    self.stdout.write('  ✓ Cleared pattern-based cache keys')
                except (AttributeError, NotImplementedError):
                    # Pattern deletion not supported (database cache doesn't support it)
                    pass

                # Clear employee profile caches
                employee_profile_keys = [
                    f"employee_profiles_{tenant_id}_*",
                ]
                try:
                    cache.delete_pattern(f"employee_profiles_{tenant_id}_*")
                    self.stdout.write('  ✓ Cleared employee profile caches')
                except (AttributeError, NotImplementedError):
                    pass

                self.stdout.write(self.style.SUCCESS(f'\n✓ Cleared cache for tenant {tenant_id} ({cleared_count} keys cleared)'))
            else:
                self.stdout.write(self.style.WARNING(f'Would clear cache for tenant {tenant_id}'))
        
        else:
            # Clear all cache by default if no specific option
            if not dry_run:
                try:
                    cache.clear()
                    self.stdout.write(self.style.SUCCESS('✓ Cleared ALL cache'))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'Error clearing all cache: {str(e)}'))
            else:
                self.stdout.write(self.style.WARNING('Would clear ALL cache'))

        if not dry_run:
            self.stdout.write(self.style.SUCCESS('\n✓ Cache clearing completed'))
