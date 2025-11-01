#!/usr/bin/env python3
"""
Script to create missing employees from attendance files
"""
import os
import sys
import django
import pandas as pd
from pathlib import Path

# Set up Django environment
# Get the project root directory (two levels up from scripts/management/)
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.append(project_root)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
django.setup()

from excel_data.models import EmployeeProfile, Tenant
from django.db import transaction

def create_missing_employees():
    """Create missing employees from all attendance files"""
    
    # Get tenant
    tenant = Tenant.objects.get(subdomain='testcompany-5')
    
    # Get existing employees
    existing_employees = set(EmployeeProfile.objects.filter(
        tenant=tenant, is_active=True
    ).values_list('employee_id', flat=True))
    
    print(f"👥 Existing employees in database: {len(existing_employees)}")
    
    # Collect all unique employees from attendance files
    all_employee_data = {}  # employee_id -> {name, department, etc.}
    
    attendance_dir = Path("monthly_attendance_fixed")
    excel_files = list(attendance_dir.glob("*_Attendance.xlsx"))
    excel_files.sort()
    
    print(f"📁 Processing {len(excel_files)} attendance files...")
    
    for file_path in excel_files:
        try:
            df = pd.read_excel(file_path)
            
            for _, row in df.iterrows():
                employee_id = str(row['Employee ID']).strip()
                name = str(row['Name']).strip()
                department = str(row.get('Department', '')).strip()
                
                if employee_id not in all_employee_data:
                    all_employee_data[employee_id] = {
                        'name': name,
                        'department': department or 'General',
                        'source_files': []
                    }
                
                all_employee_data[employee_id]['source_files'].append(file_path.name)
                
        except Exception as e:
            print(f"❌ Error processing {file_path.name}: {e}")
    
    print(f"📊 Found {len(all_employee_data)} unique employees in attendance files")
    
    # Find missing employees
    missing_employees = []
    for employee_id, data in all_employee_data.items():
        if employee_id not in existing_employees:
            missing_employees.append({
                'employee_id': employee_id,
                'name': data['name'],
                'department': data['department'],
                'source_files': data['source_files']
            })
    
    print(f"❌ Missing employees to create: {len(missing_employees)}")
    
    if missing_employees:
        print("\n📋 Missing employees:")
        for emp in missing_employees[:10]:  # Show first 10
            print(f"  - {emp['employee_id']}: {emp['name']} ({emp['department']})")
        if len(missing_employees) > 10:
            print(f"  ... and {len(missing_employees) - 10} more")
        
        # Create missing employees
        print(f"\n🚀 Creating {len(missing_employees)} missing employees...")
        
        employees_to_create = []
        for emp in missing_employees:
            # Split name into first and last name
            name_parts = emp['name'].strip().split(' ', 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            employees_to_create.append(EmployeeProfile(
                tenant=tenant,
                employee_id=emp['employee_id'],
                first_name=first_name,
                last_name=last_name,
                department=emp['department'],
                designation='Employee',  # Default designation
                employment_type='FULL_TIME',
                is_active=True,
                email=f"{emp['employee_id'].lower()}@company.com",  # Generate email
                mobile_number='0000000000',  # Default mobile number
                date_of_joining='2022-01-01',  # Default joining date
                basic_salary=0  # No default salary - must be updated manually or via salary upload
            ))
        
        try:
            with transaction.atomic():
                EmployeeProfile.objects.bulk_create(employees_to_create, batch_size=100)
                print(f"✅ Successfully created {len(employees_to_create)} employees!")
        except Exception as e:
            print(f"❌ Error creating employees: {e}")
            return False
    
    else:
        print("✅ All employees already exist in database!")
    
    # Final verification
    final_count = EmployeeProfile.objects.filter(tenant=tenant, is_active=True).count()
    print(f"\n🎯 Final employee count: {final_count}")
    
    return True

if __name__ == "__main__":
    print("👥 CREATE MISSING EMPLOYEES FROM ATTENDANCE FILES")
    print("=" * 60)
    create_missing_employees()
