from django.core.management.base import BaseCommand
from django.db import transaction, connection, models
from django.core.cache import cache
from excel_data.models import ChartAggregatedData, Tenant
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Delete ChartAggregatedData for a specific tenant and date range'

    def add_arguments(self, parser):
        parser.add_argument('--tenant-id', type=int, help='Tenant ID (optional, if not provided, deletes for all tenants)')
        parser.add_argument('--start-year', type=int, required=True, help='Start year (e.g., 2025)')
        parser.add_argument('--start-month', type=str, required=True, help='Start month (e.g., JANUARY or JAN)')
        parser.add_argument('--end-year', type=int, required=True, help='End year (e.g., 2025)')
        parser.add_argument('--end-month', type=str, required=True, help='End month (e.g., NOVEMBER or NOV)')
        parser.add_argument('--dry-run', action='store_true', help='Show what would be deleted without making changes')
        parser.add_argument('--yes', action='store_true', help='Skip confirmation prompt')

    def handle(self, *args, **options):
        tenant_id = options.get('tenant_id')
        start_year = options.get('start_year')
        start_month_input = options.get('start_month').upper()
        end_year = options.get('end_year')
        end_month_input = options.get('end_month').upper()
        dry_run = options.get('dry_run', False)
        skip_confirm = options.get('yes', False)

        # Month format mapping - convert to short format used by ChartAggregatedData
        MONTH_MAPPING = {
            'JANUARY': 'JAN', 'FEBRUARY': 'FEB', 'MARCH': 'MAR', 'APRIL': 'APR',
            'MAY': 'MAY', 'JUNE': 'JUN', 'JULY': 'JUL', 'AUGUST': 'AUG',
            'SEPTEMBER': 'SEP', 'OCTOBER': 'OCT', 'NOVEMBER': 'NOV', 'DECEMBER': 'DEC',
            'JAN': 'JAN', 'FEB': 'FEB', 'MAR': 'MAR', 'APR': 'APR',
            'JUN': 'JUN', 'JUL': 'JUL', 'AUG': 'AUG', 'SEP': 'SEP',
            'OCT': 'OCT', 'NOV': 'NOV', 'DEC': 'DEC'
        }

        # Convert to short month format
        start_month = MONTH_MAPPING.get(start_month_input)
        end_month = MONTH_MAPPING.get(end_month_input)

        if not start_month or not end_month:
            self.stdout.write(self.style.ERROR(f'Invalid month name. Valid months: {list(MONTH_MAPPING.keys())}'))
            return

        # Build list of months to delete
        ALL_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
        
        if start_year == end_year:
            # Same year - get months between start and end
            start_idx = ALL_MONTHS.index(start_month)
            end_idx = ALL_MONTHS.index(end_month)
            months_to_delete = ALL_MONTHS[start_idx:end_idx + 1]
        else:
            # Different years - handle year transitions
            months_to_delete = []
            # Months from start_month to DEC in start_year
            start_idx = ALL_MONTHS.index(start_month)
            months_to_delete.extend(ALL_MONTHS[start_idx:])
            # Add months from JAN to end_month in end_year (we'll filter by year in query)
            if end_year > start_year:
                end_idx = ALL_MONTHS.index(end_month)
                months_to_delete.extend(ALL_MONTHS[:end_idx + 1])

        # Verify tenant if specified
        tenant_name = None
        if tenant_id:
            try:
                tenant = Tenant.objects.get(id=tenant_id)
                tenant_name = tenant.name
                self.stdout.write(f'Tenant: {tenant.name} (ID: {tenant_id})')
            except Tenant.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'Tenant with ID {tenant_id} does not exist'))
                return
        else:
            self.stdout.write('Deleting for ALL tenants')

        self.stdout.write(f'Deleting ChartAggregatedData from {start_month} {start_year} to {end_month} {end_year}')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No data will be deleted'))

        # Build query
        query = ChartAggregatedData.objects.all()
        
        if tenant_id:
            query = query.filter(tenant_id=tenant_id)
        
        # Filter by year and month
        if start_year == end_year:
            query = query.filter(year=start_year, month__in=months_to_delete)
        else:
            # Multiple years
            from django.db.models import Q
            year_month_conditions = Q()
            # Start year: from start_month to DEC
            start_year_months = ALL_MONTHS[ALL_MONTHS.index(start_month):]
            year_month_conditions |= Q(year=start_year, month__in=start_year_months)
            # Middle years (if any): all months
            for year in range(start_year + 1, end_year):
                year_month_conditions |= Q(year=year, month__in=ALL_MONTHS)
            # End year: from JAN to end_month
            end_year_months = ALL_MONTHS[:ALL_MONTHS.index(end_month) + 1]
            year_month_conditions |= Q(year=end_year, month__in=end_year_months)
            query = query.filter(year_month_conditions)

        # Count records
        count = query.count()

        # Group by year and month for display
        if count > 0:
            breakdown = query.values('year', 'month').order_by('year', 'month').annotate(
                count=models.Count('id')
            )
            self.stdout.write(f'\nRecords to delete by period:')
            for item in breakdown:
                self.stdout.write(f'  - {item["month"]} {item["year"]}: {item["count"]} records')

        self.stdout.write(f'\nTOTAL: {count} ChartAggregatedData records')

        if count == 0:
            self.stdout.write(self.style.WARNING('No records found to delete'))
            return

        if not dry_run:
            # Confirm deletion
            if not skip_confirm:
                confirm = input(f'\nDelete {count} ChartAggregatedData records? (yes/no): ')
                if confirm.lower() != 'yes':
                    self.stdout.write(self.style.WARNING('Deletion cancelled'))
                    return

            with transaction.atomic():
                # Use raw SQL for faster deletion
                chart_table = ChartAggregatedData._meta.db_table
                deleted_count = 0

                if tenant_id:
                    # Single tenant - use optimized query
                    if start_year == end_year:
                        with connection.cursor() as cursor:
                            cursor.execute(f"""
                                DELETE FROM {chart_table}
                                WHERE tenant_id = %s 
                                AND year = %s 
                                AND month = ANY(%s)
                            """, [tenant_id, start_year, months_to_delete])
                            deleted_count = cursor.rowcount
                    else:
                        # Multiple years - delete in batches
                        for year in range(start_year, end_year + 1):
                            if year == start_year:
                                year_months = ALL_MONTHS[ALL_MONTHS.index(start_month):]
                            elif year == end_year:
                                year_months = ALL_MONTHS[:ALL_MONTHS.index(end_month) + 1]
                            else:
                                year_months = ALL_MONTHS
                            
                            with connection.cursor() as cursor:
                                cursor.execute(f"""
                                    DELETE FROM {chart_table}
                                    WHERE tenant_id = %s 
                                    AND year = %s 
                                    AND month = ANY(%s)
                                """, [tenant_id, year, year_months])
                                deleted_count += cursor.rowcount
                else:
                    # All tenants - use optimized query
                    if start_year == end_year:
                        with connection.cursor() as cursor:
                            cursor.execute(f"""
                                DELETE FROM {chart_table}
                                WHERE year = %s 
                                AND month = ANY(%s)
                            """, [start_year, months_to_delete])
                            deleted_count = cursor.rowcount
                    else:
                        # Multiple years - delete in batches
                        for year in range(start_year, end_year + 1):
                            if year == start_year:
                                year_months = ALL_MONTHS[ALL_MONTHS.index(start_month):]
                            elif year == end_year:
                                year_months = ALL_MONTHS[:ALL_MONTHS.index(end_month) + 1]
                            else:
                                year_months = ALL_MONTHS
                            
                            with connection.cursor() as cursor:
                                cursor.execute(f"""
                                    DELETE FROM {chart_table}
                                    WHERE year = %s 
                                    AND month = ANY(%s)
                                """, [year, year_months])
                                deleted_count += cursor.rowcount

                self.stdout.write(f'  ✓ Deleted {deleted_count} ChartAggregatedData records')

                # Clear related caches
                if tenant_id:
                    cache.delete(f"directory_data_{tenant_id}")
                    try:
                        cache.delete_pattern(f"frontend_charts_{tenant_id}_*")
                    except AttributeError:
                        cache.delete(f"frontend_charts_{tenant_id}")
                    self.stdout.write(f'  ✓ Cleared related caches for tenant {tenant_id}')
                else:
                    # Clear all tenant caches (expensive, but needed)
                    tenants = Tenant.objects.all()
                    for tenant in tenants:
                        cache.delete(f"directory_data_{tenant.id}")
                        try:
                            cache.delete_pattern(f"frontend_charts_{tenant.id}_*")
                        except AttributeError:
                            cache.delete(f"frontend_charts_{tenant.id}")
                    self.stdout.write(f'  ✓ Cleared related caches for all tenants')

            self.stdout.write(self.style.SUCCESS(
                f'\n✓ Successfully deleted {deleted_count} ChartAggregatedData records'
            ))
        else:
            self.stdout.write(self.style.WARNING(f'\nDRY RUN: Would delete {count} records'))
