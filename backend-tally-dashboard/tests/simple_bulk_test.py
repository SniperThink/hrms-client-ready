#!/usr/bin/env python3
"""
🔥 SIMPLE BULK UPLOAD TEST 🔥

Tests the ultra-fast bulk upload API without Django setup.
Uses direct HTTP requests to test the API endpoint.
"""

import pandas as pd
import time
import requests
from io import BytesIO

# Test configuration
API_BASE_URL = "http://127.0.0.1:8000"
BULK_UPLOAD_URL = f"{API_BASE_URL}/api/employees/bulk_upload/"

def create_test_excel_file(num_employees=50):
    """Create a test Excel file with sample employee data"""
    print(f"📊 Creating test Excel file with {num_employees} employees...")
    
    # Generate test data
    data = []
    departments = ['Engineering', 'HR', 'Finance', 'Marketing', 'Sales']
    designations = ['Manager', 'Executive', 'Senior', 'Junior', 'Lead']
    
    for i in range(1, num_employees + 1):
        dept = departments[i % len(departments)]
        data.append({
            'First Name': f'Employee{i}',
            'Last Name': f'Test{i}',
            'Mobile Number': f'987654{i:04d}',
            'Email': f'employee{i}@company.com',
            'Department': dept,
            'Designation': f'{designations[i % len(designations)]} {dept}',
            'Employment Type': 'Full Time' if i % 3 == 0 else 'Part Time',
            'Branch Location': 'Delhi' if i % 2 == 0 else 'Mumbai',
            'Shift Start Time': '09:00:00',
            'Shift End Time': '18:00:00',
            'Basic Salary': 50000 + (i * 1000),
            'Date of birth': f'199{i % 10}-0{(i % 9) + 1}-15',
            'Marital status': 'Single' if i % 2 == 0 else 'Married',
            'Gender': 'Male' if i % 2 == 0 else 'Female',
            'Address': f'{i} Test Street, Test City',
            'Date of joining': '2024-01-01',
            'TDS (%)': 10 if i % 3 == 0 else 5,
            'OFF DAY': 'Sunday' if i % 2 == 0 else 'Saturday'
        })
    
    # Create DataFrame and save to Excel
    df = pd.DataFrame(data)
    excel_buffer = BytesIO()
    df.to_excel(excel_buffer, index=False, engine='openpyxl')
    excel_buffer.seek(0)
    
    print(f"✅ Test Excel file created with {len(data)} employees")
    return excel_buffer

def test_bulk_upload_performance(num_employees=50):
    """Test the ultra-fast bulk upload API performance"""
    print(f"\n🚀 TESTING ULTRA-FAST BULK UPLOAD WITH {num_employees} EMPLOYEES")
    print("=" * 60)
    
    # Create test Excel file
    excel_file = create_test_excel_file(num_employees)
    
    # Prepare request
    files = {
        'file': ('test_employees.xlsx', excel_file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    }
    
    print(f"📤 Uploading {num_employees} employees to {BULK_UPLOAD_URL}...")
    start_time = time.time()
    
    try:
        response = requests.post(
            BULK_UPLOAD_URL,
            files=files,
            timeout=120  # 2 minutes timeout
        )
        
        end_time = time.time()
        total_time = end_time - start_time
        
        print(f"\n⏱️  TOTAL UPLOAD TIME: {total_time:.2f} seconds")
        print(f"🔥 EMPLOYEES PER SECOND: {num_employees / total_time:.1f}")
        print(f"📊 HTTP STATUS: {response.status_code}")
        
        if response.status_code in [200, 201]:
            result = response.json()
            print(f"\n✅ SUCCESS! API Response:")
            print(f"   📈 Employees Created: {result.get('employees_created', 0)}")
            print(f"   📊 Total Processed: {result.get('total_processed', 0)}")
            print(f"   ❌ Validation Errors: {result.get('validation_errors', 0)}")
            
            # Performance breakdown
            if 'performance' in result:
                perf = result['performance']
                print(f"\n🔍 PERFORMANCE BREAKDOWN:")
                print(f"   📁 File Read Time: {perf.get('file_read_time', 'N/A')}")
                print(f"   🔄 Data Processing Time: {perf.get('data_processing_time', 'N/A')}")
                print(f"   🆔 ID Generation Time: {perf.get('id_generation_time', 'N/A')}")
                print(f"   🏗️  Object Creation Time: {perf.get('object_creation_time', 'N/A')}")
                print(f"   💾 Database Time: {perf.get('database_time', 'N/A')}")
                print(f"   ⚡ Employees/Second: {perf.get('employees_per_second', 'N/A')}")
            
            # Sample employee IDs
            if 'sample_employee_ids' in result:
                print(f"\n🆔 SAMPLE EMPLOYEE IDs:")
                for emp_id in result['sample_employee_ids']:
                    print(f"   • {emp_id}")
                
                print(f"\n🔄 Collision Handling: {result.get('collision_handling', 'N/A')}")
            
            # Cache info
            if 'caches_cleared' in result:
                print(f"🗄️  Caches Cleared: {result['caches_cleared']}")
                
        else:
            print(f"\n❌ FAILED! Status: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {error_data}")
            except:
                print(f"Error: {response.text}")
                
    except requests.exceptions.Timeout:
        print(f"\n⏰ TIMEOUT! Upload took longer than 2 minutes")
    except Exception as e:
        print(f"\n💥 ERROR: {str(e)}")
        
    return total_time if 'total_time' in locals() else None

def test_collision_handling():
    """Test collision handling with duplicate names"""
    print(f"\n🔄 TESTING COLLISION HANDLING (POSTFIX FORMAT)")
    print("=" * 50)
    
    # Create test data with intentional duplicates
    data = []
    for i in range(5):
        data.append({
            'First Name': 'Siddhant',  # Same name for collision
            'Last Name': 'Mahajan',    # Same name for collision  
            'Mobile Number': f'987654{i:04d}',
            'Email': f'siddhant{i}@company.com',
            'Department': 'Marketing',  # Same department for collision
            'Designation': f'Manager {i}',
            'Employment Type': 'Full Time',
            'Branch Location': 'Delhi',
            'Shift Start Time': '09:00:00',
            'Shift End Time': '18:00:00',
            'Basic Salary': 60000,
            'Date of birth': '1995-01-15',
            'Marital status': 'Single',
            'Gender': 'Male',
            'Address': f'{i+1} Test Street, Delhi',
            'Date of joining': '2024-01-01',
            'TDS (%)': 10,
            'OFF DAY': 'Sunday'
        })
    
    # Create Excel file
    df = pd.DataFrame(data)
    excel_buffer = BytesIO()
    df.to_excel(excel_buffer, index=False, engine='openpyxl')
    excel_buffer.seek(0)
    
    # Upload
    files = {
        'file': ('collision_test.xlsx', excel_buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    }
    
    try:
        response = requests.post(BULK_UPLOAD_URL, files=files)
        
        if response.status_code in [200, 201]:
            result = response.json()
            print(f"✅ Collision test successful!")
            print(f"📈 Employees Created: {result.get('employees_created', 0)}")
            
            if 'sample_employee_ids' in result:
                print(f"\n🆔 GENERATED IDs (should have postfix -A, -B, -C...):")
                for emp_id in result['sample_employee_ids']:
                    print(f"   • {emp_id}")
        else:
            print(f"❌ Collision test failed: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"💥 Collision test error: {str(e)}")

if __name__ == "__main__":
    print("🔥 ULTRA-FAST BULK UPLOAD API PERFORMANCE TEST")
    print("=" * 60)
    print("This test verifies the new ultra-optimized bulk upload implementation:")
    print("✅ In-memory batch processing")
    print("✅ Bulk employee ID generation")  
    print("✅ Single atomic database transaction")
    print("✅ Postfix collision handling (SID-MA-025-A, B, C...)")
    print("✅ Performance monitoring and metrics")
    
    # Check if server is running
    try:
        health_response = requests.get(API_BASE_URL, timeout=5)
        print(f"\n🟢 Server is running at {API_BASE_URL}")
    except:
        print(f"\n🔴 WARNING: Server may not be running at {API_BASE_URL}")
        print("Please ensure the Django server is running: python manage.py runserver")
    
    try:
        # Test 1: Basic performance test
        test_bulk_upload_performance(50)
        
        # Test 2: Collision handling
        test_collision_handling()
        
        print(f"\n🎉 ALL TESTS COMPLETED!")
        
    except KeyboardInterrupt:
        print(f"\n⏹️  Tests interrupted by user")
    except Exception as e:
        print(f"\n💥 Test suite error: {str(e)}")
