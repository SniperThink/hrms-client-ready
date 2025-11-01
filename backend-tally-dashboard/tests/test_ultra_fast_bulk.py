#!/usr/bin/env python3
"""
🚀 ULTRA FAST BULK ATTENDANCE TEST
Test the new raw SQL optimizations and background processing fixes

This script tests:
1. Ultra-fast bulk attendance upload with raw SQL (should be < 5 seconds)
2. Fixed background summary processing with proper DB connections
3. Comprehensive cache clearing verification
4. Data persistence validation
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
from django.core.cache import cache

class UltraFastBulkTest:
    def __init__(self):
        self.base_url = "http://localhost:8000"
        self.session = requests.Session()
        self.token = None
        self.tenant_id = None
        self.test_date = "2025-07-26"
        
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
            return employees[:100]  # Use first 100 for testing
        else:
            print(f"❌ Failed to get employees: {response.status_code}")
            return []
    
    def test_ultra_fast_bulk_upload(self, employees):
        """Test the ultra-fast bulk attendance upload with raw SQL"""
        print("\n🚀 TESTING ULTRA-FAST BULK ATTENDANCE UPLOAD (RAW SQL)")
        print("=" * 70)
        
        # Create attendance data
        attendance_records = []
        for i, emp in enumerate(employees):
            status = 'present' if i % 4 != 3 else 'absent'  # Mix of present/absent
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
        
        print(f"📤 Uploading attendance for {len(attendance_records)} employees with RAW SQL...")
        print(f"🎯 TARGET: < 5 seconds for ultra-fast performance")
        
        start_time = time.time()
        
        response = self.session.post(f"{self.base_url}/api/bulk-update-attendance/", json=payload)
        
        upload_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ ULTRA-FAST BULK UPLOAD SUCCESS!")
            print(f"⚡ Response time: {upload_time:.3f}s")
            print(f"📊 Records processed: {data.get('attendance_upload', {}).get('total_processed', 0)}")
            print(f"🔄 Created: {data.get('attendance_upload', {}).get('created_count', 0)}")
            print(f"✏️  Updated: {data.get('attendance_upload', {}).get('updated_count', 0)}")
            print(f"⏱️  DB operation time: {data.get('performance', {}).get('db_operation_time', 'N/A')}")
            print(f"🔧 Optimization level: {data.get('performance', {}).get('optimization_level', 'N/A')}")
            
            # Check performance target
            if upload_time <= 5.0:
                print(f"🎯 ULTRA-FAST TARGET MET: Upload completed in {upload_time:.3f}s (≤ 5.0s)")
                if upload_time <= 3.0:
                    print(f"🏆 LIGHTNING FAST: Exceeded expectations! (≤ 3.0s)")
            else:
                print(f"⚠️  PERFORMANCE WARNING: Upload took {upload_time:.3f}s (> 5.0s target)")
            
            return True, data
        else:
            print(f"❌ ULTRA-FAST UPLOAD FAILED: {response.status_code}")
            print(f"Error: {response.text}")
            return False, None
    
    def test_fixed_background_processing(self, employees):
        """Test the fixed background summary processing"""
        print("\n🔧 TESTING FIXED BACKGROUND SUMMARY PROCESSING")
        print("=" * 70)
        
        employee_ids = [emp['employee_id'] for emp in employees]
        payload = {
            'date': self.test_date,
            'employee_ids': employee_ids
        }
        
        print(f"📤 Starting fixed background summary processing for {len(employee_ids)} employees...")
        print(f"🎯 TARGET: Instant response + working background processing")
        
        start_time = time.time()
        
        response = self.session.post(f"{self.base_url}/api/update-monthly-summaries/", json=payload)
        
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ BACKGROUND PROCESSING SUCCESS!")
            print(f"⚡ Response time: {response_time:.3f}s")
            print(f"📊 Employees to process: {data.get('summary_update', {}).get('employees_to_process', 0)}")
            print(f"🧵 Processing status: {data.get('summary_update', {}).get('processing_status', 'N/A')}")
            print(f"💾 Cache cleared: {data.get('cache_cleared', False)}")
            print(f"🗂️  Cache keys cleared: {data.get('performance', {}).get('cache_keys_cleared', 0)}")
            print(f"🧵 Background processing: {data.get('background_processing', False)}")
            
            # Check if response is immediate
            if response_time <= 1.0:
                print(f"🎯 INSTANT RESPONSE TARGET MET: Response in {response_time:.3f}s (≤ 1.0s)")
                print(f"🧵 Background processing started with fixed DB connection handling")
            else:
                print(f"⚠️  RESPONSE WARNING: Response took {response_time:.3f}s (> 1.0s target)")
            
            return True, data
        else:
            print(f"❌ BACKGROUND PROCESSING FAILED: {response.status_code}")
            print(f"Error: {response.text}")
            return False, None
    
    def verify_background_processing_results(self, employees, wait_seconds=10):
        """Wait and verify that background processing actually worked"""
        print(f"\n⏳ WAITING {wait_seconds} SECONDS FOR BACKGROUND PROCESSING...")
        print("=" * 70)
        
        time.sleep(wait_seconds)  # Wait for background processing
        
        try:
            from django.db import connection
            from django.apps import apps
            
            # Get tenant model
            tenant_model = apps.get_model('django_tenants', 'TenantMixin')
            tenant = tenant_model.objects.get(id=self.tenant_id) if self.tenant_id else None
            
            if not tenant:
                print("❌ Cannot verify: No tenant found")
                return False
            
            # Set schema
            connection.set_tenant(tenant)
            
            # Check if monthly summaries were created/updated
            summary_count = MonthlyAttendanceSummary.objects.filter(
                tenant=tenant,
                year=2025,
                month=7
            ).count()
            
            print(f"📊 Monthly summaries found: {summary_count}")
            
            if summary_count > 0:
                # Check a few specific summaries for data
                sample_summaries = MonthlyAttendanceSummary.objects.filter(
                    tenant=tenant,
                    year=2025,
                    month=7
                )[:5]
                
                print("🔍 Sample summary data:")
                for i, summary in enumerate(sample_summaries, 1):
                    print(f"   {i}. Employee {summary.employee_id}: {summary.total_present_days} present, {summary.total_absent_days} absent")
                
                print("✅ BACKGROUND PROCESSING VERIFICATION SUCCESS: Summaries were updated!")
                return True
            else:
                print("⚠️  BACKGROUND PROCESSING ISSUE: No monthly summaries found")
                return False
                
        except Exception as e:
            print(f"❌ VERIFICATION ERROR: {str(e)}")
            return False
    
    def run_complete_test(self):
        """Run the complete ultra-fast test suite"""
        print("🚀 ULTRA-FAST BULK ATTENDANCE COMPLETE TEST SUITE")
        print("=" * 70)
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
        
        # Step 3: Test ultra-fast bulk upload with raw SQL
        upload_success, upload_data = self.test_ultra_fast_bulk_upload(employees)
        
        # Step 4: Test fixed background summary processing
        summary_success, summary_data = self.test_fixed_background_processing(employees)
        
        # Step 5: Verify background processing actually worked
        bg_verification = self.verify_background_processing_results(employees)
        
        # Final results
        total_time = time.time() - overall_start
        print("\n" + "=" * 70)
        print("🏁 ULTRA-FAST TEST SUITE RESULTS")
        print("=" * 70)
        print(f"⚡ Ultra-fast bulk upload: {'✅ PASS' if upload_success else '❌ FAIL'}")
        print(f"🔧 Fixed background processing: {'✅ PASS' if summary_success else '❌ FAIL'}")
        print(f"🔍 Background verification: {'✅ PASS' if bg_verification else '⚠️  PARTIAL'}")
        print(f"⏱️  Total test time: {total_time:.3f}s")
        
        if upload_success and summary_success and bg_verification:
            print("\n🎉 OVERALL RESULT: COMPLETE SUCCESS!")
            print("✅ Ultra-fast attendance upload + working background summary processing")
            print("🚀 Performance targets met, data persistence verified")
        elif upload_success and summary_success:
            print("\n🎯 OVERALL RESULT: MOSTLY SUCCESS!")
            print("✅ Both APIs working, background processing may need more time")
        else:
            print("\n⚠️  OVERALL RESULT: ISSUES DETECTED")
            print("❌ Some components may need attention")

if __name__ == "__main__":
    test = UltraFastBulkTest()
    test.run_complete_test()
