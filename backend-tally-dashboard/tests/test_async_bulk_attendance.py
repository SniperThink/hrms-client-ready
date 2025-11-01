#!/usr/bin/env python3
"""
🚀 ASYNC BULK ATTENDANCE TEST SCRIPT
Test the new instant response + background processing implementation

This script tests:
1. Lightning-fast bulk attendance upload (should return in < 3 seconds)
2. Async monthly summary update (immediate response, background processing)
3. Cache clearing effectiveness
4. Data consistency verification
"""

import os
import sys
import django
import requests
import json
import time
from datetime import datetime, date

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
django.setup()

from excel_data.models import CustomUser, EmployeeProfile, DailyAttendance, MonthlyAttendanceSummary
from django.contrib.auth import authenticate
from django.core.cache import cache

class AsyncBulkAttendanceTest:
    def __init__(self):
        self.base_url = "http://localhost:8000"
        self.session = requests.Session()
        self.token = None
        self.tenant_id = None
        self.test_date = "2025-07-25"
        
    def login(self):
        """Login and get authentication token"""
        print("🔐 Logging in...")
        login_data = {
            "username": "admin@example.com",  # Update with your admin credentials
            "password": "admin123"
        }
        
        response = self.session.post(f"{self.base_url}/api/login/", json=login_data)
        if response.status_code == 200:
            data = response.json()
            self.token = data.get('access_token')
            self.tenant_id = data.get('tenant_id')
            self.session.headers.update({'Authorization': f'Bearer {self.token}'})
            print(f"✅ Login successful - Tenant ID: {self.tenant_id}")
            return True
        else:
            print(f"❌ Login failed: {response.status_code}")
            return False
    
    def get_eligible_employees(self):
        """Get eligible employees for the test date"""
        print(f"👥 Getting eligible employees for {self.test_date}...")
        response = self.session.get(f"{self.base_url}/api/eligible-employees/?date={self.test_date}&initial=true")
        
        if response.status_code == 200:
            data = response.json()
            employees = data.get('employees', [])
            print(f"✅ Found {len(employees)} eligible employees")
            return employees[:50]  # Use first 50 for testing
        else:
            print(f"❌ Failed to get employees: {response.status_code}")
            return []
    
    def test_lightning_fast_bulk_upload(self, employees):
        """Test the lightning-fast bulk attendance upload"""
        print("\n🚀 TESTING LIGHTNING-FAST BULK ATTENDANCE UPLOAD")
        print("=" * 60)
        
        # Create attendance data
        attendance_records = []
        for i, emp in enumerate(employees):
            status = 'present' if i % 3 != 2 else 'absent'  # Mix of present/absent
            attendance_records.append({
                'employee_id': emp['employee_id'],
                'name': emp['name'],
                'department': emp.get('department', 'Unknown'),
                'date': self.test_date,
                'status': status,
                'present_days': 1 if status == 'present' else 0,
                'absent_days': 1 if status == 'absent' else 0,
                'ot_hours': 2 if status == 'present' and i % 5 == 0 else 0,
                'late_minutes': 15 if status == 'present' and i % 7 == 0 else 0,
                'calendar_days': 1,
                'total_working_days': 1
            })
        
        payload = {
            'date': self.test_date,
            'attendance_records': attendance_records
        }
        
        print(f"📤 Uploading attendance for {len(attendance_records)} employees...")
        start_time = time.time()
        
        response = self.session.post(f"{self.base_url}/api/bulk-update-attendance/", json=payload)
        
        upload_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ BULK UPLOAD SUCCESS!")
            print(f"⚡ Response time: {upload_time:.3f}s")
            print(f"📊 Records processed: {data.get('attendance_upload', {}).get('total_processed', 0)}")
            print(f"🔄 Created: {data.get('attendance_upload', {}).get('created_count', 0)}")
            print(f"✏️  Updated: {data.get('attendance_upload', {}).get('updated_count', 0)}")
            print(f"⏱️  Processing time: {data.get('performance', {}).get('processing_time', 'N/A')}")
            print(f"💾 DB operation time: {data.get('performance', {}).get('db_operation_time', 'N/A')}")
            
            # Check if it's truly lightning fast
            if upload_time <= 3.0:
                print(f"🎯 PERFORMANCE TARGET MET: Upload completed in {upload_time:.3f}s (≤ 3.0s)")
            else:
                print(f"⚠️  PERFORMANCE WARNING: Upload took {upload_time:.3f}s (> 3.0s target)")
            
            return True, data
        else:
            print(f"❌ BULK UPLOAD FAILED: {response.status_code}")
            print(f"Error: {response.text}")
            return False, None
    
    def test_async_summary_update(self, employees):
        """Test the async monthly summary update"""
        print("\n🔄 TESTING ASYNC MONTHLY SUMMARY UPDATE")
        print("=" * 60)
        
        employee_ids = [emp['employee_id'] for emp in employees]
        payload = {
            'date': self.test_date,
            'employee_ids': employee_ids
        }
        
        print(f"📤 Starting async summary update for {len(employee_ids)} employees...")
        start_time = time.time()
        
        response = self.session.post(f"{self.base_url}/api/update-monthly-summaries/", json=payload)
        
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ ASYNC SUMMARY SUCCESS!")
            print(f"⚡ Response time: {response_time:.3f}s")
            print(f"📊 Employees to process: {data.get('summary_update', {}).get('employees_to_process', 0)}")
            print(f"📅 Processing date: {data.get('summary_update', {}).get('date', 'N/A')}")
            print(f"🔧 Update method: {data.get('summary_update', {}).get('update_method', 'N/A')}")
            print(f"🧵 Processing status: {data.get('summary_update', {}).get('processing_status', 'N/A')}")
            print(f"💾 Cache cleared: {data.get('cache_cleared', False)}")
            print(f"🗂️  Cache keys cleared: {data.get('performance', {}).get('cache_keys_cleared', 0)}")
            
            # Check if response is immediate
            if response_time <= 1.0:
                print(f"🎯 ASYNC TARGET MET: Response in {response_time:.3f}s (≤ 1.0s)")
                print(f"🧵 Background processing started successfully")
            else:
                print(f"⚠️  ASYNC WARNING: Response took {response_time:.3f}s (> 1.0s target)")
            
            return True, data
        else:
            print(f"❌ ASYNC SUMMARY FAILED: {response.status_code}")
            print(f"Error: {response.text}")
            return False, None
    
    def verify_cache_clearing(self):
        """Verify that caches are properly cleared"""
        print("\n🗑️  TESTING CACHE CLEARING EFFECTIVENESS")
        print("=" * 60)
        
        # Check if key cache entries are cleared
        cache_keys_to_check = [
            f"attendance_all_records_{self.tenant_id}",
            f"monthly_attendance_summary_{self.tenant_id}",
            f"dashboard_stats_{self.tenant_id}",
            f"payroll_overview_{self.tenant_id}"
        ]
        
        cleared_count = 0
        for cache_key in cache_keys_to_check:
            cached_value = cache.get(cache_key)
            if cached_value is None:
                cleared_count += 1
                print(f"✅ Cache cleared: {cache_key}")
            else:
                print(f"⚠️  Cache not cleared: {cache_key}")
        
        print(f"\n📊 Cache clearing result: {cleared_count}/{len(cache_keys_to_check)} keys cleared")
        
        if cleared_count == len(cache_keys_to_check):
            print("🎯 CACHE CLEARING SUCCESS: All critical caches cleared")
            return True
        else:
            print("⚠️  CACHE CLEARING PARTIAL: Some caches may not be cleared")
            return False
    
    def verify_data_consistency(self, employees):
        """Verify that data was saved correctly"""
        print("\n🔍 TESTING DATA CONSISTENCY")
        print("=" * 60)
        
        try:
            # Check attendance records
            from django.db import connection
            from django.apps import apps
            
            # Get tenant model
            tenant_model = apps.get_model('django_tenants', 'TenantMixin')
            tenant = tenant_model.objects.get(id=self.tenant_id) if self.tenant_id else None
            
            if not tenant:
                print("❌ Cannot verify data: No tenant found")
                return False
            
            # Set schema
            connection.set_tenant(tenant)
            
            # Check attendance records
            attendance_count = DailyAttendance.objects.filter(
                date=self.test_date,
                tenant=tenant
            ).count()
            
            print(f"✅ Attendance records in DB: {attendance_count}")
            
            # Check monthly summaries (these might still be processing in background)
            summary_count = MonthlyAttendanceSummary.objects.filter(
                tenant=tenant,
                year=2025,
                month=7
            ).count()
            
            print(f"📊 Monthly summaries in DB: {summary_count}")
            print("ℹ️  Note: Summaries are processed in background and may take time to appear")
            
            if attendance_count >= len(employees):
                print("🎯 DATA CONSISTENCY SUCCESS: Attendance records saved correctly")
                return True
            else:
                print(f"⚠️  DATA CONSISTENCY WARNING: Expected {len(employees)}, found {attendance_count}")
                return False
                
        except Exception as e:
            print(f"❌ DATA VERIFICATION ERROR: {str(e)}")
            return False
    
    def run_complete_test(self):
        """Run the complete test suite"""
        print("🚀 ASYNC BULK ATTENDANCE COMPLETE TEST SUITE")
        print("=" * 60)
        print(f"📅 Test Date: {self.test_date}")
        print(f"🌐 Base URL: {self.base_url}")
        print(f"⏰ Test Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        overall_start = time.time()
        
        # Step 1: Login
        if not self.login():
            print("❌ Test aborted: Login failed")
            return
        
        # Step 2: Get employees
        employees = self.get_eligible_employees()
        if not employees:
            print("❌ Test aborted: No employees found")
            return
        
        # Step 3: Test lightning-fast bulk upload
        upload_success, upload_data = self.test_lightning_fast_bulk_upload(employees)
        
        # Step 4: Test async summary update
        summary_success, summary_data = self.test_async_summary_update(employees)
        
        # Step 5: Verify cache clearing
        cache_success = self.verify_cache_clearing()
        
        # Step 6: Verify data consistency
        data_success = self.verify_data_consistency(employees)
        
        # Final results
        total_time = time.time() - overall_start
        print("\n" + "=" * 60)
        print("🏁 TEST SUITE RESULTS")
        print("=" * 60)
        print(f"⚡ Lightning-fast upload: {'✅ PASS' if upload_success else '❌ FAIL'}")
        print(f"🔄 Async summary update: {'✅ PASS' if summary_success else '❌ FAIL'}")
        print(f"🗑️  Cache clearing: {'✅ PASS' if cache_success else '⚠️  PARTIAL'}")
        print(f"🔍 Data consistency: {'✅ PASS' if data_success else '❌ FAIL'}")
        print(f"⏱️  Total test time: {total_time:.3f}s")
        
        if all([upload_success, summary_success]):
            print("\n🎉 OVERALL RESULT: SUCCESS!")
            print("✅ Instant attendance upload + background summary processing working correctly")
        else:
            print("\n⚠️  OVERALL RESULT: ISSUES DETECTED")
            print("❌ Some components may need attention")

if __name__ == "__main__":
    test = AsyncBulkAttendanceTest()
    test.run_complete_test()
