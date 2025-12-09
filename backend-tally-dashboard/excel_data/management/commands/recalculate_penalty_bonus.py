"""
Management command to recalculate weekly penalty and bonus days for existing MonthlyAttendanceSummary records.
This is useful when the calculation logic is updated or when data exists before the calculation was added.
"""
from django.core.management.base import BaseCommand
from excel_data.models import MonthlyAttendanceSummary, Tenant, EmployeeProfile
from excel_data.services.salary_service import SalaryCalculationService
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Recalculate weekly penalty and bonus days for MonthlyAttendanceSummary records'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant-id',
            type=int,
            help='Recalculate for specific tenant only',
        )
        parser.add_argument(
            '--year',
            type=int,
            help='Recalculate for specific year only',
        )
        parser.add_argument(
            '--month',
            type=int,
            help='Recalculate for specific month only (1-12)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without actually updating',
        )

    def handle(self, *args, **options):
        tenant_id = options.get('tenant_id')
        year = options.get('year')
        month = options.get('month')
        dry_run = options.get('dry_run', False)

        # Build query
        queryset = MonthlyAttendanceSummary.objects.all()
        
        if tenant_id:
            queryset = queryset.filter(tenant_id=tenant_id)
        
        if year:
            queryset = queryset.filter(year=year)
        
        if month:
            queryset = queryset.filter(month=month)

        total = queryset.count()
        self.stdout.write(f'Found {total} MonthlyAttendanceSummary records to process')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be saved'))

        month_names = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
        updated_count = 0
        error_count = 0

        for summary in queryset.select_related('tenant'):
            try:
                # Get employee
                try:
                    employee = EmployeeProfile.objects.get(
                        tenant=summary.tenant,
                        employee_id=summary.employee_id,
                        is_active=True
                    )
                except EmployeeProfile.DoesNotExist:
                    self.stdout.write(
                        self.style.WARNING(
                            f'Skipping {summary.employee_id} - employee not found or inactive'
                        )
                    )
                    continue

                # Check if features are enabled
                absent_enabled = getattr(summary.tenant, 'weekly_absent_penalty_enabled', False)
                bonus_enabled = getattr(summary.tenant, 'sunday_bonus_enabled', False)

                if not absent_enabled and not bonus_enabled:
                    # Features not enabled, skip
                    continue

                # Calculate penalty/bonus
                month_name = month_names[summary.month - 1] if 1 <= summary.month <= 12 else 'JAN'
                weekly_stats = SalaryCalculationService._compute_weekly_penalty_and_bonus(
                    employee, summary.year, month_name
                )

                new_penalty = weekly_stats.get('weekly_penalty_days', Decimal("0"))

                old_penalty = getattr(summary, 'weekly_penalty_days', Decimal("0"))

                if new_penalty != old_penalty:
                    if not dry_run:
                        summary.weekly_penalty_days = new_penalty
                        summary.save(update_fields=['weekly_penalty_days'])
                    
                    self.stdout.write(
                        f'Updated {summary.employee_id} ({summary.year}-{summary.month:02d}): '
                        f'penalty {old_penalty} -> {new_penalty}'
                    )
                    updated_count += 1
                else:
                    if new_penalty > 0:
                        self.stdout.write(
                            f'No change for {summary.employee_id} ({summary.year}-{summary.month:02d}): '
                            f'penalty={new_penalty}'
                        )

            except Exception as e:
                error_count += 1
                self.stdout.write(
                    self.style.ERROR(
                        f'Error processing {summary.employee_id} ({summary.year}-{summary.month:02d}): {e}'
                    )
                )
                logger.error(f'Error recalculating penalty/bonus: {e}', exc_info=True)

        self.stdout.write(
            self.style.SUCCESS(
                f'\nCompleted: {updated_count} updated, {error_count} errors out of {total} records'
            )
        )

