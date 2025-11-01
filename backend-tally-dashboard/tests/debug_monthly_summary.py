#!/usr/bin/env python3
"""
🔍 DEBUG MONTHLY SUMMARY UPDATE ISSUE

This script will help diagnose why the monthly summary isn't showing updated attendance.
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "http://127.0.0.1:8000"
BULK_ATTENDANCE_URL = f"{BASE_URL}/api/bulk-update-attendance/"
MONTHLY_SUMMARY_URL = f"{BASE_URL}/api/update-monthly-summaries/"
PAYROLL_OVERVIEW_URL = f"{BASE_URL}/api/salary-data/payroll_overview/"

def test_attendance_and_summary_update():
    """Test the attendance update and monthly summary flow"""
    
    print("🔍 DEBUGGING MONTHLY SUMMARY UPDATE ISSUE")
    print("=" * 60)
    
    # Test data - marking one employee as present
    test_attendance_data = [
        {
            "employee_id": "ABH-HE-073",  # Use the employee ID from your error
            "status": "present",
            "check_in": "09:00",
            "check_out": "18:00",
            "ot_hours": 0,
            "late_minutes": 0
        }
    ]
    
    current_date = datetime.now().strftime('%Y-%m-%d')
    
    print(f"📅 Testing with date: {current_date}")
    print(f"👤 Testing with employee: {test_attendance_data[0]['employee_id']}")
    print(f"✅ Marking as: {test_attendance_data[0]['status']}")
    
    try:
        # STEP 1: Update bulk attendance
        print(f"\n📤 STEP 1: Updating bulk attendance...")
        
        bulk_payload = {
            'date': current_date,
            'attendance_data': test_attendance_data
        }
        
        print(f"Payload: {json.dumps(bulk_payload, indent=2)}")
        
        bulk_response = requests.post(
            BULK_ATTENDANCE_URL,
            json=bulk_payload,
            timeout=30
        )
        
        print(f"📊 Bulk Update Response: {bulk_response.status_code}")
        if bulk_response.status_code == 200:
            bulk_result = bulk_response.json()
            print(f"✅ Success: {bulk_result.get('message', 'No message')}")
            print(f"📈 Records Updated: {bulk_result.get('records_updated', 0)}")
            print(f"📈 Records Created: {bulk_result.get('records_created', 0)}")
        else:
            print(f"❌ Error: {bulk_response.text}")
            return
        
        # STEP 2: Update monthly summaries
        print(f"\n📤 STEP 2: Updating monthly summaries...")
        
        summary_payload = {
            'date': current_date,
            'employee_ids': [test_attendance_data[0]['employee_id']]
        }
        
        print(f"Payload: {json.dumps(summary_payload, indent=2)}")
        
        summary_response = requests.post(
            MONTHLY_SUMMARY_URL,
            json=summary_payload,
            timeout=30
        )
        
        print(f"📊 Summary Update Response: {summary_response.status_code}")
        if summary_response.status_code == 200:
            summary_result = summary_response.json()
            print(f"✅ Success: {summary_result.get('message', 'No message')}")
            print(f"📈 Employees to Process: {summary_result.get('summary_update', {}).get('employees_to_process', 0)}")
            print(f"⚡ Response Time: {summary_result.get('performance', {}).get('response_time', 'N/A')}")
        else:
            print(f"❌ Error: {summary_response.text}")
            return
        
        # STEP 3: Wait a bit for background processing
        print(f"\n⏳ STEP 3: Waiting 5 seconds for background processing...")
        time.sleep(5)
        
        # STEP 4: Check payroll overview to see if changes reflected
        print(f"\n📤 STEP 4: Checking payroll overview...")
        
        # Add current month/year parameters
        current_month = datetime.now().strftime('%B')
        current_year = datetime.now().year
        
        payroll_params = {
            'month': current_month,
            'year': current_year,
            'department': 'All'
        }
        
        payroll_response = requests.get(
            PAYROLL_OVERVIEW_URL,
            params=payroll_params,
            timeout=30
        )
        
        print(f"📊 Payroll Overview Response: {payroll_response.status_code}")
        if payroll_response.status_code == 200:
            payroll_result = payroll_response.json()
            print(f"✅ Success!")
            
            # Check key metrics
            total_employees = payroll_result.get('totalEmployees', 0)
            avg_attendance = payroll_result.get('avgAttendancePercentage', 0)
            
            print(f"📈 Total Employees: {total_employees}")
            print(f"📈 Avg Attendance: {avg_attendance}%")
            
            # Check performance info
            performance = payroll_result.get('performance', {})
            print(f"⚡ Query Time: {performance.get('query_time', 'N/A')}")
            print(f"🔍 Data Source: {performance.get('data_source', 'N/A')}")
            print(f"📊 Records Processed: {performance.get('records_processed', 'N/A')}")
            print(f"💾 Cached: {performance.get('cached', 'N/A')}")
            
            # If attendance is still 0, there's an issue
            if avg_attendance == 0:
                print(f"\n❌ ISSUE FOUND: Avg attendance is still 0% after update!")
                print(f"🔍 This suggests the monthly summary update isn't working properly")
                print(f"💡 Possible causes:")
                print(f"   1. Background thread isn't completing")
                print(f"   2. Database transaction isn't committing")
                print(f"   3. Cache isn't being cleared properly")
                print(f"   4. Wrong attendance status values")
            else:
                print(f"\n✅ SUCCESS: Attendance updated successfully!")
                
        else:
            print(f"❌ Error: {payroll_response.text}")
            
    except requests.exceptions.Timeout:
        print(f"\n⏰ TIMEOUT: Request took too long")
    except Exception as e:
        print(f"\n💥 ERROR: {str(e)}")

if __name__ == "__main__":
    test_attendance_and_summary_update()
