from django.core.management.base import BaseCommand
from django.db import models
from excel_data.models import Tenant, MonthlyAttendanceSummary, EmployeeProfile
from decimal import Decimal

class Command(BaseCommand):
    help = 'Check if penalty/bonus days exist in MonthlyAttendanceSummary for a tenant'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant-id',
            type=int,
            required=True,
            help='The ID of the tenant to check',
        )
        parser.add_argument(
            '--year',
            type=int,
            help='The year to check (default: current year)',
        )
        parser.add_argument(
            '--month',
            type=int,
            help='The month to check (1-12, default: current month)',
        )

    def handle(self, *args, **options):
        tenant_id = options['tenant_id']
        year = options.get('year')
        month = options.get('month')
        
        try:
            tenant = Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            self.stderr.write(self.style.ERROR(f"Tenant with ID {tenant_id} not found."))
            return
        
        # Check tenant settings
        self.stdout.write(f"\n{'='*80}")
        self.stdout.write(f"Tenant: {tenant.name} (ID: {tenant_id})")
        self.stdout.write(f"{'='*80}")
        self.stdout.write(f"weekly_absent_penalty_enabled: {tenant.weekly_absent_penalty_enabled}")
        self.stdout.write(f"sunday_bonus_enabled: {tenant.sunday_bonus_enabled}")
        self.stdout.write(f"weekly_absent_threshold: {tenant.weekly_absent_threshold}")
        self.stdout.write(f"{'='*80}\n")
        
        # Get date range
        from datetime import date
        if not year or not month:
            today = date.today()
            year = year or today.year
            month = month or today.month
        
        # Query MonthlyAttendanceSummary
        qs = MonthlyAttendanceSummary.objects.filter(
            tenant=tenant,
            year=year,
            month=month
        ).order_by('employee_id')
        
        total_records = qs.count()
        records_with_penalty = qs.filter(weekly_penalty_days__gt=0).count()
        
        self.stdout.write(f"\nMonthlyAttendanceSummary for {year}-{month:02d}:")
        self.stdout.write(f"  Total records: {total_records}")
        self.stdout.write(f"  Records with penalty_days > 0: {records_with_penalty}")
        
        if records_with_penalty > 0:
            self.stdout.write(f"\n{'='*80}")
            self.stdout.write("Records with penalty days:")
            self.stdout.write(f"{'='*80}")
            for record in qs.filter(
                models.Q(weekly_penalty_days__gt=0)
            )[:20]:  # Show first 20
                self.stdout.write(
                    f"  {record.employee_id}: penalty={record.weekly_penalty_days}"
                )
        
        # Check a few sample employees
        self.stdout.write(f"\n{'='*80}")
        self.stdout.write("Sample records (first 10):")
        self.stdout.write(f"{'='*80}")
        for record in qs[:10]:
            self.stdout.write(
                f"  {record.employee_id}: penalty={record.weekly_penalty_days}, "
                f"present={record.present_days}"
            )
        
        # Check if features are enabled but no data
        if tenant.weekly_absent_penalty_enabled and total_records > 0:
            if records_with_penalty == 0:
                self.stdout.write(
                    self.style.WARNING(
                        f"\n⚠️  WARNING: Features are enabled but no penalty/bonus days found!"
                    )
                )
                self.stdout.write(
                    "   This might mean:\n"
                    "   1. The data hasn't been recalculated yet\n"
                    "   2. No employees met the threshold criteria\n"
                    "   3. The signal hasn't run to update MonthlyAttendanceSummary"
                )
                self.stdout.write(
                    "\n   Try running: python manage.py recalculate_penalty_bonus "
                    f"--tenant-id {tenant_id} --year {year} --month {month}"
                )

