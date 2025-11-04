from django.core.management.base import BaseCommand
from django.db import transaction
from django.core.cache import cache
from excel_data.models import (
    DailyAttendance,
    MonthlyAttendanceSummary,
    Attendance,
    Tenant
)
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Delete attendance data for a specific tenant, year, and months'

    def add_arguments(self, parser):
        parser.add_argument('--tenant-id', type=int, required=True, help='Tenant ID')
        parser.add_argument('--year', type=int, required=True, help='Year (e.g., 2025)')
        parser.add_argument('--months', type=str, nargs='+', required=True, help='Month names (e.g., NOVEMBER or NOV)')
        parser.add_argument('--dry-run', action='store_true', help='Show what would be deleted without making changes')
        parser.add_argument('--yes', action='store_true', help='Skip confirmation prompt')

    def handle(self, *args, **options):
        tenant_id = options.get('tenant_id')
        year = options.get('year')
        months_input = [m.upper() for m in options.get('months', [])]
        dry_run = options.get('dry_run', False)
        skip_confirm = options.get('yes', False)

        # Month format mapping
        MONTH_MAPPING = {
            'JANUARY': 1, 'FEBRUARY': 2, 'MARCH': 3, 'APRIL': 4,
            'MAY': 5, 'JUNE': 6, 'JULY': 7, 'AUGUST': 8,
            'SEPTEMBER': 9, 'OCTOBER': 10, 'NOVEMBER': 11, 'DECEMBER': 12,
            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4,
            'JUN': 6, 'JUL': 7, 'AUG': 8, 'SEP': 9,
            'OCT': 10, 'NOV': 11, 'DEC': 12
        }
        
        # Convert month names to month numbers
        month_numbers = []
        for month_input in months_input:
            if month_input in MONTH_MAPPING:
                month_numbers.append(MONTH_MAPPING[month_input])
            else:
                self.stdout.write(self.style.ERROR(f'Invalid month name: {month_input}'))
                return

        # Verify tenant exists
        try:
            tenant = Tenant.objects.get(id=tenant_id)
            self.stdout.write(f'Tenant: {tenant.name} (ID: {tenant_id})')
        except Tenant.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Tenant with ID {tenant_id} does not exist'))
            return

        self.stdout.write(f'Deleting attendance data for: {", ".join(months_input)} {year}')
        self.stdout.write(f'Month numbers: {month_numbers}')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No data will be deleted'))

        # Get counts before deletion
        daily_attendance = DailyAttendance.objects.filter(
            tenant_id=tenant_id,
            date__year=year,
            date__month__in=month_numbers
        )
        
        monthly_summary = MonthlyAttendanceSummary.objects.filter(
            tenant_id=tenant_id,
            year=year,
            month__in=month_numbers
        )
        
        attendance = Attendance.objects.filter(
            tenant_id=tenant_id,
            date__year=year,
            date__month__in=month_numbers
        )

        # Count records
        daily_count = daily_attendance.count()
        monthly_summary_count = monthly_summary.count()
        attendance_count = attendance.count()
        total_count = daily_count + monthly_summary_count + attendance_count

        self.stdout.write(f'\nRecords to delete:')
        self.stdout.write(f'  - DailyAttendance: {daily_count}')
        self.stdout.write(f'  - MonthlyAttendanceSummary: {monthly_summary_count}')
        self.stdout.write(f'  - Attendance: {attendance_count}')
        self.stdout.write(f'  TOTAL: {total_count} records')

        if total_count == 0:
            self.stdout.write(self.style.WARNING('No records found to delete'))
            return

        if not dry_run:
            # Confirm deletion
            if not skip_confirm:
                confirm = input(f'\nDelete {total_count} attendance records? (yes/no): ')
                if confirm.lower() != 'yes':
                    self.stdout.write(self.style.WARNING('Deletion cancelled'))
                    return

            with transaction.atomic():
                # Delete attendance data
                # Note: Disabling signals temporarily to avoid errors during bulk deletion
                from django.db.models.signals import pre_delete, post_delete
                from excel_data.signals import sync_attendance_from_daily, update_monthly_attendance_summary
                
                # Temporarily disconnect signals to avoid errors
                pre_delete.disconnect(sync_attendance_from_daily, sender=DailyAttendance)
                post_delete.disconnect(sync_attendance_from_daily, sender=DailyAttendance)
                post_delete.disconnect(update_monthly_attendance_summary, sender=DailyAttendance)
                
                try:
                    deleted_daily = daily_attendance.delete()[0]
                    self.stdout.write(f'  ✓ Deleted {deleted_daily} DailyAttendance records')
                    
                    deleted_monthly_summary = monthly_summary.delete()[0]
                    self.stdout.write(f'  ✓ Deleted {deleted_monthly_summary} MonthlyAttendanceSummary records')
                    
                    deleted_attendance = attendance.delete()[0]
                    self.stdout.write(f'  ✓ Deleted {deleted_attendance} Attendance records')
                    
                    # Clear attendance-related caches
                    cache.delete(f"attendance_all_records_{tenant_id}")
                    cache.delete(f"directory_data_{tenant_id}")
                    cache.delete(f"months_with_attendance_{tenant_id}")
                    
                    self.stdout.write(f'  ✓ Cleared related caches')
                finally:
                    # Reconnect signals
                    pre_delete.connect(sync_attendance_from_daily, sender=DailyAttendance)
                    post_delete.connect(sync_attendance_from_daily, sender=DailyAttendance)
                    post_delete.connect(update_monthly_attendance_summary, sender=DailyAttendance)

            self.stdout.write(self.style.SUCCESS(
                f'\nSuccessfully deleted {total_count} attendance records for {", ".join(months_input)} {year}'
            ))
        else:
            self.stdout.write(self.style.WARNING(f'\nDRY RUN: Would delete {total_count} records'))

