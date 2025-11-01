#!/usr/bin/env python3
"""
Quick test for the optimized eligible-employees API
"""
import requests
import time
import json
from datetime import datetime

def test_eligible_employees_api():
    """Test the eligible-employees API performance"""
    
    base_url = "http://localhost:8000/api"
    
    print("🚀 TESTING ELIGIBLE EMPLOYEES API")
    print("=" * 50)
    
    # Step 1: Login
    print("1️⃣ Logging in...")
    login_start = time.time()
    
    login_response = requests.post(f"{base_url}/public/login/", json={
        "email": "sddhantjaiii2@gmail.com",
        "password": "admin123"
    })
    
    login_time = time.time() - login_start
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        print(f"Response: {login_response.text}")
        return
    
    token = login_response.json()["tokens"]["access"]
    print(f"   ✅ Login: {login_time*1000:.0f}ms")
    
    # Step 2: Test eligible-employees API
    print("2️⃣ Testing eligible-employees API...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "x-tenant-subdomain": "testing-1"
    }
    
    # Test today's date
    today = datetime.now().strftime('%Y-%m-%d')
    
    api_start = time.time()
    api_response = requests.get(
        f"{base_url}/eligible-employees/",
        headers=headers,
        params={"date": today, "page": 1, "page_size": 50}
    )
    api_time = time.time() - api_start
    
    print(f"   🔗 URL: {api_response.url}")
    print(f"   📊 Status: {api_response.status_code}")
    print(f"   ⏱️  Response Time: {api_time*1000:.0f}ms")
    
    if api_response.status_code == 200:
        data = api_response.json()
        
        # Extract performance data
        performance = data.get('performance', {})
        query_time = performance.get('query_time', 'N/A')
        cached = performance.get('cached', False)
        total_employees = performance.get('total_employees', 0)
        page_employees = performance.get('page_employees', 0)
        
        print(f"   ✅ Success!")
        print(f"   📈 Query Time: {query_time}")
        print(f"   🗄️  Cached: {'Yes' if cached else 'No'}")
        print(f"   👥 Total Employees: {total_employees}")
        print(f"   📄 Page Employees: {page_employees}")
        
        # Network vs Django breakdown
        network_time = api_time * 1000  # Convert to ms
        query_time_ms = float(query_time.replace('s', '')) * 1000 if 's' in str(query_time) else 0
        django_overhead = network_time - query_time_ms
        
        print()
        print("🔍 PERFORMANCE BREAKDOWN:")
        print(f"   • Total Network Time: {network_time:.0f}ms")
        print(f"   • Database Query: {query_time_ms:.0f}ms ({query_time_ms/network_time*100:.1f}%)")
        print(f"   • Django Overhead: {django_overhead:.0f}ms ({django_overhead/network_time*100:.1f}%)")
        
        if django_overhead < 200:
            print(f"   ✅ Django processing optimized! ({django_overhead:.0f}ms < 200ms)")
        elif django_overhead < 500:
            print(f"   ⚠️  Django processing acceptable ({django_overhead:.0f}ms)")
        else:
            print(f"   ❌ Django processing still needs optimization ({django_overhead:.0f}ms)")
            
    else:
        print(f"   ❌ API Error: {api_response.status_code}")
        print(f"   📄 Response: {api_response.text}")
    
    print()
    print("=" * 50)
    print("📊 OPTIMIZATION RESULTS:")
    
    if api_response.status_code == 200:
        if api_time < 1.0:  # Less than 1 second
            print("   ✅ EXCELLENT: API responds in sub-second time!")
        elif api_time < 2.0:  # Less than 2 seconds
            print("   ✅ GOOD: Significant improvement achieved!")  
        else:
            print("   ⚠️  MODERATE: Still room for improvement")
    else:
        print("   ❌ ERROR: API not functioning properly")

if __name__ == "__main__":
    test_eligible_employees_api()
