from django.core.management.base import BaseCommand
from django.db import connection
from excel_data.models import Attendance


class Command(BaseCommand):
    help = 'Fix absent_days to count only explicit ABSENT status, not unmarked days'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant-id',
            type=int,
            default=97,
            help='Tenant ID to fix (default: 97)'
        )

    def handle(self, *args, **options):
        tenant_id = options['tenant_id']
        
        self.stdout.write(f"\n🚀 FAST MODE: Using bulk SQL update for tenant {tenant_id}")
        self.stdout.write("=" * 60)
        
        # Count records that need updating
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*)
                FROM excel_data_attendance a
                WHERE a.tenant_id = %s
                AND a.absent_days != (
                    SELECT COUNT(*)
                    FROM excel_data_dailyattendance da
                    WHERE da.attendance_status = 'ABSENT'
                    AND da.tenant_id = a.tenant_id
                    AND da.employee_id = a.employee_id
                    AND DATE_TRUNC('month', da.date) = DATE_TRUNC('month', a.date)
                )
            """, [tenant_id])
            
            count = cursor.fetchone()[0]
            self.stdout.write(f"📊 Records that need updating: {count}\n")
            
            if count == 0:
                self.stdout.write(self.style.SUCCESS("✅ All records are already correct!"))
                return
            
            # Bulk update using SQL
            self.stdout.write(f"⏳ Updating {count} records...")
            
            cursor.execute("""
                UPDATE excel_data_attendance a
                SET absent_days = (
                    SELECT COUNT(*)
                    FROM excel_data_dailyattendance da
                    WHERE da.attendance_status = 'ABSENT'
                    AND da.tenant_id = a.tenant_id
                    AND da.employee_id = a.employee_id
                    AND DATE_TRUNC('month', da.date) = DATE_TRUNC('month', a.date)
                )
                WHERE a.tenant_id = %s
                AND a.absent_days != (
                    SELECT COUNT(*)
                    FROM excel_data_dailyattendance da2
                    WHERE da2.attendance_status = 'ABSENT'
                    AND da2.tenant_id = a.tenant_id
                    AND da2.employee_id = a.employee_id
                    AND DATE_TRUNC('month', da2.date) = DATE_TRUNC('month', a.date)
                )
            """, [tenant_id])
            
            updated = cursor.rowcount
            self.stdout.write(self.style.SUCCESS(f"✅ Updated {updated} records successfully!"))
            
            # Verify
            cursor.execute("""
                SELECT COUNT(*)
                FROM excel_data_attendance a
                WHERE a.tenant_id = %s
                AND a.absent_days != (
                    SELECT COUNT(*)
                    FROM excel_data_dailyattendance da
                    WHERE da.attendance_status = 'ABSENT'
                    AND da.tenant_id = a.tenant_id
                    AND da.employee_id = a.employee_id
                    AND DATE_TRUNC('month', da.date) = DATE_TRUNC('month', a.date)
                )
            """, [tenant_id])
            
            remaining = cursor.fetchone()[0]
            self.stdout.write(f"✓ Verification: {remaining} records still need updating (should be 0)")
            
            if remaining == 0:
                self.stdout.write(self.style.SUCCESS("\n✨ ALL RECORDS FIXED!"))
            else:
                self.stdout.write(self.style.WARNING(f"\n⚠️ {remaining} records still have issues"))
