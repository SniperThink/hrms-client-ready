#!/usr/bin/env python3
"""
Script to fix attendance records with total_working_days = 0
Sets total_working_days to calendar_days for records where it's currently 0
"""

import os
import sys
import django
from django.db import transaction

# Set up Django environment
# Get the project root directory (two levels up from scripts/utilities/)
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.append(project_root)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
django.setup()

from excel_data.models import Attendance

def fix_attendance_working_days():
    """Fix attendance records where total_working_days is 0"""
    print("🔧 FIXING ATTENDANCE WORKING DAYS")
    print("=" * 50)
    
    # Find records with total_working_days = 0
    problematic_records = Attendance.objects.filter(total_working_days=0)
    total_count = problematic_records.count()
    
    print(f"📊 Found {total_count} attendance records with total_working_days = 0")
    
    if total_count == 0:
        print("✅ No records need fixing!")
        return True
    
    # Show some examples
    print(f"\n📋 Examples of problematic records:")
    for record in problematic_records[:5]:
        print(f"  - {record.employee_id}: {record.name} - Present: {record.present_days}, Absent: {record.absent_days}, Calendar: {record.calendar_days}")
    
    if total_count > 5:
        print(f"  ... and {total_count - 5} more")
    
    # Fix the records
    print(f"\n🚀 Fixing {total_count} records...")
    
    try:
        with transaction.atomic():
            updated_count = 0
            for record in problematic_records:
                # Set total_working_days to calendar_days
                record.total_working_days = record.calendar_days
                # Recalculate absent_days
                record.absent_days = record.calendar_days - record.present_days
                record.save()
                updated_count += 1
                
                if updated_count % 100 == 0:
                    print(f"  Processed {updated_count}/{total_count} records...")
        
        print(f"✅ Successfully fixed {updated_count} attendance records!")
        
        # Verify the fix
        remaining_problematic = Attendance.objects.filter(total_working_days=0).count()
        print(f"🔍 Verification: {remaining_problematic} records still have total_working_days = 0")
        
        if remaining_problematic == 0:
            print("🎉 All records fixed successfully!")
        else:
            print(f"⚠️  {remaining_problematic} records still need attention")
        
        return True
        
    except Exception as e:
        print(f"❌ Error fixing records: {e}")
        return False

if __name__ == "__main__":
    success = fix_attendance_working_days()
    if not success:
        sys.exit(1)
