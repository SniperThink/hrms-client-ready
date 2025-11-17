"""
Script to fix absent_days in Attendance model
Recalculates absent_days to only count explicit ABSENT status from DailyAttendance
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
django.setup()

from django.db import transaction
from excel_data.models import Attendance, DailyAttendance, Tenant
from datetime import datetime

def fix_attendance_absent_days(tenant_id=97):
    """
    Fix absent_days in Attendance model to only count explicit ABSENT days
    
    Args:
        tenant_id: Tenant ID to fix (default: 97 for Shiv Enterprises)
    """
    try:
        tenant = Tenant.objects.get(id=tenant_id)
        print(f"\n🎯 Fixing absent_days for tenant: {tenant.name} (ID: {tenant_id})")
        
        # Get all Attendance records for this tenant
        attendance_records = Attendance.objects.filter(tenant=tenant).order_by('date', 'employee_id')
        total_records = attendance_records.count()
        
        if total_records == 0:
            print(f"❌ No attendance records found for tenant {tenant_id}")
            return
        
        print(f"📊 Found {total_records} attendance records to fix\n")
        
        fixed_count = 0
        unchanged_count = 0
        errors = []
        
        with transaction.atomic():
            for idx, attendance in enumerate(attendance_records, 1):
                try:
                    # Extract year and month from attendance date
                    year = attendance.date.year
                    month = attendance.date.month
                    
                    # Count explicit ABSENT days from DailyAttendance
                    explicit_absent_count = DailyAttendance.objects.filter(
                        tenant=tenant,
                        employee_id=attendance.employee_id,
                        date__year=year,
                        date__month=month,
                        attendance_status='ABSENT'
                    ).count()
                    
                    # Check if needs updating
                    old_value = float(attendance.absent_days or 0)
                    new_value = float(explicit_absent_count)
                    
                    if old_value != new_value:
                        attendance.absent_days = new_value
                        attendance.save()
                        fixed_count += 1
                        
                        if fixed_count <= 10:  # Show first 10 changes
                            print(f"✓ {attendance.employee_id} | {year}-{month:02d} | absent_days: {old_value} → {new_value}")
                    else:
                        unchanged_count += 1
                    
                    # Progress indicator
                    if idx % 100 == 0:
                        print(f"Progress: {idx}/{total_records} ({idx*100//total_records}%) - Fixed: {fixed_count}, Unchanged: {unchanged_count}")
                
                except Exception as e:
                    error_msg = f"Error fixing {attendance.employee_id} {attendance.date}: {str(e)}"
                    errors.append(error_msg)
                    print(f"❌ {error_msg}")
        
        print(f"\n{'='*60}")
        print(f"✅ FIX COMPLETED")
        print(f"{'='*60}")
        print(f"Total Records: {total_records}")
        print(f"Fixed:         {fixed_count}")
        print(f"Unchanged:     {unchanged_count}")
        print(f"Errors:        {len(errors)}")
        
        if errors:
            print(f"\n❌ ERRORS:")
            for error in errors[:10]:  # Show first 10 errors
                print(f"  - {error}")
        
        return {
            'total': total_records,
            'fixed': fixed_count,
            'unchanged': unchanged_count,
            'errors': len(errors)
        }
        
    except Tenant.DoesNotExist:
        print(f"❌ Tenant {tenant_id} not found")
        return None
    except Exception as e:
        print(f"❌ Fatal error: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    print("="*60)
    print("ATTENDANCE ABSENT_DAYS FIX SCRIPT")
    print("="*60)
    print("This script will:")
    print("1. Scan all Attendance records for tenant 97")
    print("2. Recalculate absent_days to count only explicit ABSENT status")
    print("3. Update records where absent_days has changed")
    print("="*60)
    
    response = input("\n⚠️  Proceed with fix? (yes/no): ")
    if response.lower() == 'yes':
        result = fix_attendance_absent_days(tenant_id=97)
        print("\n✨ Done!")
    else:
        print("\n❌ Operation cancelled")
