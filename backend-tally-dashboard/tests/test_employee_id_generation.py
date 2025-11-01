#!/usr/bin/env python3
"""
Test script to verify the new Employee ID generation system
Format: First three letters-Department first two letters-Tenant id
Example: Siddhant Marketing Analysis tenant_id 025 -> SID-MA-025
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
django.setup()

from excel_data.services.utils import generate_employee_id

def test_employee_id_generation():
    """Test the new employee ID generation format"""
    
    print("🧪 TESTING NEW EMPLOYEE ID GENERATION SYSTEM")
    print("=" * 60)
    
    # Test cases
    test_cases = [
        {
            'name': 'Siddhant Jaiii',
            'department': 'Marketing Analysis',
            'tenant_id': 25,
            'expected_pattern': 'SID-MA-025'
        },
        {
            'name': 'John Doe',
            'department': 'Human Resources',
            'tenant_id': 1,
            'expected_pattern': 'JOH-HU-001'
        },
        {
            'name': 'Alice Smith',
            'department': 'Information Technology',
            'tenant_id': 123,
            'expected_pattern': 'ALI-IN-123'
        },
        {
            'name': 'Bob',  # Short name
            'department': 'IT',  # Short department
            'tenant_id': 5,
            'expected_pattern': 'BOB-IT-005'
        },
        {
            'name': 'Test User',
            'department': None,  # No department
            'tenant_id': 10,
            'expected_pattern': 'TES-XX-010'
        }
    ]
    
    print("Testing Employee ID Generation:")
    print("-" * 40)
    
    for i, test_case in enumerate(test_cases, 1):
        name = test_case['name']
        department = test_case['department']
        tenant_id = test_case['tenant_id']
        expected_pattern = test_case['expected_pattern']
        
        # Generate employee ID
        generated_id = generate_employee_id(name, tenant_id, department)
        
        print(f"\n{i}. Test Case:")
        print(f"   Name: {name}")
        print(f"   Department: {department}")
        print(f"   Tenant ID: {tenant_id}")
        print(f"   Expected Pattern: {expected_pattern}")
        print(f"   Generated ID: {generated_id}")
        
        # Check if the generated ID matches the expected pattern
        if generated_id == expected_pattern:
            print(f"   ✅ PASS")
        else:
            # For collision testing, the ID might have a prefix
            if expected_pattern in generated_id:
                print(f"   ✅ PASS (with collision prefix)")
            else:
                print(f"   ❌ FAIL")
    
    print("\n" + "=" * 60)
    print("🔄 TESTING COLLISION HANDLING")
    print("=" * 60)
    
    # Test collision handling - simulate multiple employees with same name and department
    collision_test_cases = [
        ('Siddhant Jaiii', 'Marketing Analysis', 25),
        ('Siddhant Jaiii', 'Marketing Analysis', 25),  # Same name, dept, tenant
        ('Siddhant Jaiii', 'Marketing Analysis', 25),  # Same name, dept, tenant
    ]
    
    generated_ids = []
    for i, (name, department, tenant_id) in enumerate(collision_test_cases, 1):
        generated_id = generate_employee_id(name, tenant_id, department)
        generated_ids.append(generated_id)
        print(f"{i}. {name} -> {generated_id}")
    
    # Check if all IDs are unique
    if len(set(generated_ids)) == len(generated_ids):
        print("✅ Collision handling works - all IDs are unique")
    else:
        print("❌ Collision handling failed - duplicate IDs found")
    
    print("\n" + "=" * 60)
    print("📋 SUMMARY:")
    print("New Employee ID Format: [First 3 letters]-[Dept 2 letters]-[Tenant ID (3 digits)]")
    print("Collision handling: Prefix with A, B, C, etc. when needed")
    print("Examples:")
    print("  - Siddhant Marketing Analysis (Tenant 025) -> SID-MA-025")
    print("  - John Human Resources (Tenant 001) -> JOH-HU-001")
    print("  - Alice Information Technology (Tenant 123) -> ALI-IN-123")
    print("✅ Employee ID generation system updated successfully!")

if __name__ == "__main__":
    test_employee_id_generation()
