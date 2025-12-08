from django.core.management.base import BaseCommand
from django.core.cache import cache
from excel_data.models import Tenant
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Clear attendance tracker cache for a specific tenant or all tenants'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant-id',
            type=int,
            help='The ID of the tenant to clear cache for. If not provided, clears for all tenants.',
        )

    def handle(self, *args, **options):
        tenant_id = options.get('tenant_id')
        
        if tenant_id:
            try:
                tenants = [Tenant.objects.get(id=tenant_id)]
            except Tenant.DoesNotExist:
                self.stderr.write(self.style.ERROR(f"Tenant with ID {tenant_id} not found."))
                return
        else:
            tenants = Tenant.objects.all()
            self.stdout.write(f"Clearing attendance cache for all {tenants.count()} tenants...")

        total_cleared = 0
        for tenant in tenants:
            cleared_keys = []
            
            # Try pattern-based deletion (Redis cache)
            try:
                cache.delete_pattern(f'attendance_all_records_{tenant.id}_*')
                cleared_keys.append(f'attendance_all_records_{tenant.id}_* (pattern)')
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✅ Cleared attendance cache for tenant {tenant.id} ({tenant.name}) - pattern deletion'
                    )
                )
            except (AttributeError, NotImplementedError):
                # Fallback: Clear common variations manually
                common_time_periods = [
                    'last_6_months', 'last_12_months', 'last_5_years', 
                    'this_month', 'custom', 'custom_month', 'custom_range', 'one_day'
                ]
                keys_cleared = 0
                for period in common_time_periods:
                    variations = [
                        f'attendance_all_records_{tenant.id}_{period}_None_None_None_None_rt_1',
                        f'attendance_all_records_{tenant.id}_{period}_None_None_None_None_rt_0',
                    ]
                    for var_key in variations:
                        if cache.delete(var_key):
                            keys_cleared += 1
                            cleared_keys.append(var_key)
                
                # Also clear base key
                if cache.delete(f'attendance_all_records_{tenant.id}'):
                    keys_cleared += 1
                    cleared_keys.append(f'attendance_all_records_{tenant.id}')
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✅ Cleared attendance cache for tenant {tenant.id} ({tenant.name}) - {keys_cleared} keys cleared manually'
                    )
                )
            
            total_cleared += len(cleared_keys)
            logger.info(f"Cleared {len(cleared_keys)} cache keys for tenant {tenant.id}")

        self.stdout.write(
            self.style.SUCCESS(
                f'\n✅ Successfully cleared attendance cache for {len(tenants)} tenant(s), {total_cleared} total keys'
            )
        )

