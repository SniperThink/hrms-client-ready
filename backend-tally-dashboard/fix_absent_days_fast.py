"""
FAST: Script to fix absent_days in Attendance model using bulk SQL update
Recalculates absent_days to only count explicit ABSENT status from DailyAttendance
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
django.setup()

from django.db import connection

def fix_attendance_absent_days_fast(tenant_id=97):
    """
    Fix absent_days in Attendance model using FAST bulk SQL update
    
    This version uses a single UPDATE query with a subquery to recalculate
    absent_days based on explicit ABSENT status count from DailyAttendance.
    
    Args:
        tenant_id: Tenant ID to fix (default: 97)
    """
    print("\n🚀 FAST MODE: Using bulk SQL update")
    print("="*60)
    
    with connection.cursor() as cursor:
        # First, show how many records need updating
        check_sql = """
        SELECT COUNT(*) as total_to_update
        FROM excel_data_attendance a
        WHERE a.tenant_id = %s
        AND a.absent_days != (
            SELECT COUNT(*)
            FROM excel_data_dailyattendance da
            WHERE da.tenant_id = a.tenant_id
            AND da.employee_id = a.employee_id
            AND EXTRACT(YEAR FROM da.date) = EXTRACT(YEAR FROM a.date)
            AND EXTRACT(MONTH FROM da.date) = EXTRACT(MONTH FROM a.date)
            AND da.attendance_status = 'ABSENT'
        )
        """
        
        cursor.execute(check_sql, [tenant_id])
        result = cursor.fetchone()
        records_to_update = result[0] if result else 0
        
        print(f"📊 Records that need updating: {records_to_update}")
        
        if records_to_update == 0:
            print("✅ All records are already correct!")
            return {'updated': 0}
        
        # Perform the bulk update
        update_sql = """
        UPDATE excel_data_attendance
        SET absent_days = (
            SELECT COUNT(*)
            FROM excel_data_dailyattendance da
            WHERE da.tenant_id = excel_data_attendance.tenant_id
            AND da.employee_id = excel_data_attendance.employee_id
            AND EXTRACT(YEAR FROM da.date) = EXTRACT(YEAR FROM excel_data_attendance.date)
            AND EXTRACT(MONTH FROM da.date) = EXTRACT(MONTH FROM excel_data_attendance.date)
            AND da.attendance_status = 'ABSENT'
        )
        WHERE tenant_id = %s
        AND absent_days != (
            SELECT COUNT(*)
            FROM excel_data_dailyattendance da
            WHERE da.tenant_id = excel_data_attendance.tenant_id
            AND da.employee_id = excel_data_attendance.employee_id
            AND EXTRACT(YEAR FROM da.date) = EXTRACT(YEAR FROM excel_data_attendance.date)
            AND EXTRACT(MONTH FROM da.date) = EXTRACT(MONTH FROM excel_data_attendance.date)
            AND da.attendance_status = 'ABSENT'
        )
        """
        
        print(f"\n⏳ Updating {records_to_update} records...")
        cursor.execute(update_sql, [tenant_id])
        rows_updated = cursor.rowcount
        
        print(f"✅ Updated {rows_updated} records successfully!")
        
        # Verify the fix
        cursor.execute(check_sql, [tenant_id])
        result = cursor.fetchone()
        remaining = result[0] if result else 0
        
        print(f"✓ Verification: {remaining} records still need updating (should be 0)")
        
        return {
            'updated': rows_updated,
            'remaining': remaining
        }


if __name__ == "__main__":
    print("="*60)
    print("ATTENDANCE ABSENT_DAYS FIX SCRIPT (FAST MODE)")
    print("="*60)
    print("This script will:")
    print("1. Use a single SQL UPDATE query")
    print("2. Recalculate absent_days = COUNT of ABSENT status only")
    print("3. Update all Attendance records for tenant 97")
    print("="*60)
    
    response = input("\n⚠️  Proceed with fix? (yes/no): ")
    if response.lower() == 'yes':
        result = fix_attendance_absent_days_fast(tenant_id=97)
        print(f"\n✨ Done! Updated {result['updated']} records")
    else:
        print("\n❌ Operation cancelled")
