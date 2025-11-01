#!/usr/bin/env python3
"""
Script to clean up duplicate employees and keep only the actual 239 employees
"""
import os
import sys
import django

# Set up Django environment
# Get the project root directory (two levels up from scripts/management/)
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.append(project_root)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
django.setup()

from excel_data.models import EmployeeProfile, Tenant, Attendance, DailyAttendance
from django.db import transaction
from collections import defaultdict

def cleanup_duplicate_employees():
    """Clean up duplicate employees, keeping only the original 239 employees"""
    
    # Get tenant
    tenant = Tenant.objects.get(subdomain='testcompany-5')
    
    print('🧹 CLEANING UP DUPLICATE EMPLOYEES')
    print('=' * 60)
    
    # Get all employees
    all_employees = EmployeeProfile.objects.filter(tenant=tenant, is_active=True)
    print(f'📊 Current total employees: {all_employees.count()}')
    
    # Group employees by name
    name_groups = defaultdict(list)
    for emp in all_employees:
        name_groups[emp.full_name].append(emp)
    
    # Find duplicates
    duplicates = {name: emps for name, emps in name_groups.items() if len(emps) > 1}
    unique_employees = {name: emps[0] for name, emps in name_groups.items() if len(emps) == 1}
    
    print(f'📊 Unique employees: {len(unique_employees)}')
    print(f'📊 Duplicate groups: {len(duplicates)}')
    
    # Strategy: Keep the employee with 097 suffix (original employees) or earliest creation date
    employees_to_keep = []
    employees_to_delete = []
    
    for name, emps in duplicates.items():
        # Sort by priority: 097 suffix first, then by creation date
        def sort_key(emp):
            if emp.employee_id and emp.employee_id.endswith('097'):
                return (0, emp.created_at)  # 097 suffix gets priority
            else:
                return (1, emp.created_at)  # Others by creation date
        
        emps.sort(key=sort_key)
        
        # Keep the first one (original employee with 097 suffix if available)
        keep_emp = emps[0]
        employees_to_keep.append(keep_emp)
        
        # Mark others for deletion
        for emp in emps[1:]:
            employees_to_delete.append(emp)
    
    # Add unique employees to keep list
    employees_to_keep.extend(unique_employees.values())
    
    print(f'\n🎯 CLEANUP PLAN:')
    print(f'  ✅ Employees to keep: {len(employees_to_keep)}')
    print(f'  ❌ Employees to delete: {len(employees_to_delete)}')
    
    if len(employees_to_keep) != 239:
        print(f'⚠️  WARNING: Expected 239 employees, but will keep {len(employees_to_keep)}')
        print('🚀 Continuing with cleanup...')
    
    # Show sample of what will be deleted
    print(f'\n📋 Sample employees to be deleted:')
    for emp in employees_to_delete[:10]:
        print(f'  - {emp.employee_id}: {emp.full_name} (created: {emp.created_at})')
    
    if len(employees_to_delete) > 10:
        print(f'  ... and {len(employees_to_delete) - 10} more')
    
    # Perform cleanup
    print(f'\n🚀 Starting cleanup...')
    
    try:
        with transaction.atomic():
            # First, handle attendance records to avoid constraint violations
            print('  🔄 Handling attendance records...')
            
            for delete_emp in employees_to_delete:
                # Find the corresponding employee to keep
                keep_emp = None
                for keep in employees_to_keep:
                    if keep.full_name == delete_emp.full_name:
                        keep_emp = keep
                        break
                
                if keep_emp:
                    # Handle attendance records - merge data instead of updating
                    delete_attendance = Attendance.objects.filter(
                        tenant=tenant, 
                        employee_id=delete_emp.employee_id
                    )
                    
                    for att in delete_attendance:
                        # Check if attendance record already exists for kept employee
                        existing = Attendance.objects.filter(
                            tenant=tenant,
                            employee_id=keep_emp.employee_id,
                            date=att.date
                        ).first()
                        
                        if existing:
                            # Update existing record with better data
                            existing.present_days = max(existing.present_days, att.present_days)
                            existing.absent_days = max(existing.absent_days, att.absent_days)
                            existing.ot_hours = max(existing.ot_hours, att.ot_hours)
                            existing.late_minutes = max(existing.late_minutes, att.late_minutes)
                            existing.save()
                            att.delete()  # Delete the duplicate
                        else:
                            # Update the record to point to kept employee
                            att.employee_id = keep_emp.employee_id
                            att.name = keep_emp.full_name
                            att.save()
                    
                    # Handle daily attendance records - merge data instead of updating
                    delete_daily = DailyAttendance.objects.filter(
                        tenant=tenant, 
                        employee_id=delete_emp.employee_id
                    )
                    
                    for daily in delete_daily:
                        # Check if daily record already exists for kept employee
                        existing = DailyAttendance.objects.filter(
                            tenant=tenant,
                            employee_id=keep_emp.employee_id,
                            date=daily.date
                        ).first()
                        
                        if existing:
                            # Update existing record with better data
                            existing.ot_hours = max(existing.ot_hours, daily.ot_hours)
                            existing.late_minutes = max(existing.late_minutes, daily.late_minutes)
                            existing.save()
                            daily.delete()  # Delete the duplicate
                        else:
                            # Update the record to point to kept employee
                            daily.employee_id = keep_emp.employee_id
                            daily.employee_name = keep_emp.full_name
                            daily.save()
            
            # Delete duplicate employees
            print('  🗑️  Deleting duplicate employees...')
            for emp in employees_to_delete:
                emp.delete()
            
            print('  ✅ Cleanup completed successfully!')
            
    except Exception as e:
        print(f'  ❌ Error during cleanup: {e}')
        return False
    
    # Verify final count
    final_count = EmployeeProfile.objects.filter(tenant=tenant, is_active=True).count()
    print(f'\n🎯 FINAL RESULT:')
    print(f'  📊 Employees remaining: {final_count}')
    
    # Check attendance data integrity
    attendance_count = Attendance.objects.filter(tenant=tenant).count()
    daily_count = DailyAttendance.objects.filter(tenant=tenant).count()
    print(f'  📊 Attendance records: {attendance_count}')
    print(f'  📊 Daily records: {daily_count}')
    
    return True

if __name__ == "__main__":
    cleanup_duplicate_employees()
