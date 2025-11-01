#!/usr/bin/env python3
"""
Quick script to check if attendance data exists in the database
"""

import os
import sys
import django

# Add the project directory to Python path
# Get the project root directory (two levels up from scripts/utilities/)
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.append(project_root)

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
django.setup()

from excel_data.models import MonthlyAttendanceSummary, EmployeeProfile

def check_attendance_data():
    print("🔍 Checking attendance data in database...")
    
    # Check total attendance records
    total_records = MonthlyAttendanceSummary.objects.count()
    print(f"📊 Total MonthlyAttendanceSummary records: {total_records}")
    
    if total_records > 0:
        # Get sample records
        sample_records = MonthlyAttendanceSummary.objects.all()[:5]
        print("\n📋 Sample attendance records:")
        for record in sample_records:
            print(f"  - Employee: {record.employee_id}, Year: {record.year}, Month: {record.month}")
            print(f"    Present Days: {record.present_days}, OT Hours: {record.ot_hours}")
        
        # Check for records with OT hours > 0
        ot_records = MonthlyAttendanceSummary.objects.filter(ot_hours__gt=0).count()
        print(f"\n⏰ Records with OT hours > 0: {ot_records}")
        
        if ot_records > 0:
            ot_sample = MonthlyAttendanceSummary.objects.filter(ot_hours__gt=0)[:3]
            print("📈 Sample OT records:")
            for record in ot_sample:
                print(f"  - Employee: {record.employee_id}, OT Hours: {record.ot_hours}")
    else:
        print("❌ No attendance records found!")
    
    # Check employees
    total_employees = EmployeeProfile.objects.count()
    print(f"\n👥 Total employees: {total_employees}")
    
    if total_employees > 0:
        sample_employees = EmployeeProfile.objects.all()[:3]
        print("👤 Sample employees:")
        for emp in sample_employees:
            print(f"  - {emp.employee_id}: {emp.first_name} {emp.last_name}")

if __name__ == "__main__":
    check_attendance_data()

