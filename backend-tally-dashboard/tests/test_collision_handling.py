#!/usr/bin/env python3
"""
Test script to verify the new Employee ID generation system with real database collision testing
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
django.setup()

from excel_data.models import EmployeeProfile, Tenant
from excel_data.services.utils import generate_employee_id
from django.db import transaction

def test_collision_handling_with_db():
    """Test collision handling with actual database records"""
    
    print("🧪 TESTING COLLISION HANDLING WITH DATABASE")
    print("=" * 60)
    
    # Get or create a test tenant
    tenant, created = Tenant.objects.get_or_create(
        subdomain='test-collision',
        defaults={
            'name': 'Test Collision Company',
            'is_active': True
        }
    )
    
    print(f"Using tenant: {tenant.name} (ID: {tenant.id})")
    
    try:
        with transaction.atomic():
            # Clean up any existing test employees
            EmployeeProfile.objects.filter(
                tenant=tenant,
                first_name='Siddhant',
                last_name='Test'
            ).delete()
            
            print("\n🔄 Creating employees with same name and department:")
            print("-" * 50)
            
            employees = []
            for i in range(5):
                # Create employee profile (this will trigger employee_id generation)
                employee = EmployeeProfile.objects.create(
                    tenant=tenant,
                    first_name='Siddhant',
                    last_name='Test',
                    department='Marketing Analysis',
                    email=f'siddhant.test{i}@example.com'
                )
                employees.append(employee)
                print(f"{i+1}. Employee ID: {employee.employee_id}")
            
            # Check if all employee IDs are unique
            employee_ids = [emp.employee_id for emp in employees]
            unique_ids = set(employee_ids)
            
            print(f"\n📊 Results:")
            print(f"Total employees created: {len(employees)}")
            print(f"Unique employee IDs: {len(unique_ids)}")
            print(f"Generated IDs: {employee_ids}")
            
            if len(unique_ids) == len(employees):
                print("✅ SUCCESS: All employee IDs are unique!")
                print("✅ Collision handling is working correctly!")
            else:
                print("❌ FAILURE: Duplicate employee IDs found!")
            
            # Show the pattern
            print(f"\n📋 ID Pattern Analysis:")
            for i, emp_id in enumerate(employee_ids):
                if i == 0:
                    print(f"Base ID: {emp_id}")
                else:
                    print(f"Collision {i}: {emp_id}")
            
            # Clean up test data
            for employee in employees:
                employee.delete()
                
        print(f"\n🧹 Cleaned up test data")
            
    except Exception as e:
        print(f"❌ Error during testing: {e}")
    
    # Clean up test tenant if we created it
    if created:
        tenant.delete()
        print(f"🧹 Cleaned up test tenant")

def test_real_world_examples():
    """Test with real-world examples"""
    
    print("\n\n🌍 REAL-WORLD EXAMPLES")
    print("=" * 60)
    
    examples = [
        {
            'name': 'Siddhant Jaiii',
            'department': 'Marketing Analysis',
            'tenant_id': 25,
            'description': 'Your example'
        },
        {
            'name': 'Rahul Kumar',
            'department': 'Human Resources',
            'tenant_id': 1,
            'description': 'HR Employee'
        },
        {
            'name': 'Priya Sharma',
            'department': 'Information Technology',
            'tenant_id': 50,
            'description': 'IT Employee'
        },
        {
            'name': 'A B',  # Very short name
            'department': 'Sales',
            'tenant_id': 999,
            'description': 'Short name test'
        },
        {
            'name': 'Mohammad Abdur Rehman Khan',  # Long name
            'department': 'Finance and Accounting',  # Long department
            'tenant_id': 7,
            'description': 'Long name and department'
        }
    ]
    
    for example in examples:
        emp_id = generate_employee_id(
            example['name'], 
            example['tenant_id'], 
            example['department']
        )
        
        print(f"\n{example['description']}:")
        print(f"  Name: {example['name']}")
        print(f"  Department: {example['department']}")
        print(f"  Tenant ID: {example['tenant_id']}")
        print(f"  Generated ID: {emp_id}")

if __name__ == "__main__":
    # Test basic functionality
    print("🚀 EMPLOYEE ID GENERATION SYSTEM TEST")
    print("=" * 60)
    
    # Test collision handling with database
    test_collision_handling_with_db()
    
    # Test real-world examples
    test_real_world_examples()
    
    print("\n" + "=" * 60)
    print("✅ ALL TESTS COMPLETED!")
    print("📋 New Format: [First 3 letters]-[Dept 2 letters]-[Tenant ID]")
    print("🔧 Collision Handling: A, B, C prefixes for duplicates")
    print("=" * 60)
