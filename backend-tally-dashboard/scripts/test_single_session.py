#!/usr/bin/env python3
"""
Test script for single-login-per-user functionality
"""
import os
import sys
import django
import requests
import json
from datetime import datetime

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
django.setup()

from excel_data.models import CustomUser, Tenant
from excel_data.utils.session_manager import SessionManager


class SingleSessionTest:
    def __init__(self):
        self.base_url = "http://localhost:8000"
        self.test_email = "test@example.com"
        self.test_password = "testpass123"
        
    def setup_test_user(self):
        """Create or get test user"""
        print("🔧 Setting up test user...")
        
        try:
            # Get or create test tenant
            tenant, created = Tenant.objects.get_or_create(
                subdomain='test',
                defaults={
                    'name': 'Test Company',
                    'is_active': True
                }
            )
            
            # Get or create test user
            user, created = CustomUser.objects.get_or_create(
                email=self.test_email,
                defaults={
                    'first_name': 'Test',
                    'last_name': 'User',
                    'tenant': tenant,
                    'is_active': True,
                    'role': 'admin'
                }
            )
            
            if created or not user.check_password(self.test_password):
                user.set_password(self.test_password)
                user.save()
            
            print(f"✅ Test user ready: {user.email}")
            return user
            
        except Exception as e:
            print(f"❌ Error setting up test user: {e}")
            return None
    
    def test_login(self, session_name="Session 1"):
        """Test login functionality"""
        print(f"\n🔐 Testing login for {session_name}...")
        
        login_data = {
            "email": self.test_email,
            "password": self.test_password
        }
        
        try:
            session = requests.Session()
            response = session.post(
                f"{self.base_url}/api/public/login/",
                json=login_data,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Login successful for {session_name}")
                print(f"   Access Token: {data.get('tokens', {}).get('access', 'N/A')[:50]}...")
                print(f"   Session Key: {data.get('session_key', 'N/A')}")
                return session, data
            elif response.status_code == 409:
                data = response.json()
                print(f"⚠️  Login blocked for {session_name}: {data.get('error', 'Unknown error')}")
                return None, data
            else:
                print(f"❌ Login failed for {session_name}: {response.status_code}")
                print(f"   Response: {response.text}")
                return None, None
                
        except Exception as e:
            print(f"❌ Login error for {session_name}: {e}")
            return None, None
    
    def test_force_logout(self):
        """Test force logout functionality"""
        print(f"\n🔓 Testing force logout...")
        
        logout_data = {
            "email": self.test_email,
            "password": self.test_password
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/api/auth/force-logout/",
                json=logout_data,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Force logout successful: {data.get('message')}")
                return True
            else:
                print(f"❌ Force logout failed: {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Force logout error: {e}")
            return False
    
    def test_session_validation(self):
        """Test session validation in model"""
        print(f"\n🔍 Testing session validation...")
        
        try:
            user = CustomUser.objects.get(email=self.test_email)
            
            # Test when no session
            user.clear_session()
            print(f"   No session active: {not user.is_session_active()}")
            
            # Test with active session
            user.set_session("test_session_key")
            print(f"   New session active: {user.is_session_active()}")
            print(f"   Session key: {user.current_session_key}")
            print(f"   Session created: {user.session_created_at}")
            
            return True
            
        except Exception as e:
            print(f"❌ Session validation error: {e}")
            return False
    
    def run_tests(self):
        """Run all tests"""
        print("🚀 Starting Single-Login-Per-User Tests")
        print("=" * 50)
        
        # Setup
        user = self.setup_test_user()
        if not user:
            return
        
        # Test session validation
        self.test_session_validation()
        
        # Test first login
        session1, data1 = self.test_login("Session 1")
        
        if session1:
            # Test second login (should be blocked)
            session2, data2 = self.test_login("Session 2")
            
            if data2 and data2.get('already_logged_in'):
                print("✅ Single-session enforcement working correctly")
                
                # Test force logout
                if self.test_force_logout():
                    # Test login after force logout
                    session3, data3 = self.test_login("Session 3 (after force logout)")
                    if session3:
                        print("✅ Login works after force logout")
        
        print("\n" + "=" * 50)
        print("🏁 Tests completed!")


if __name__ == "__main__":
    test = SingleSessionTest()
    test.run_tests()
