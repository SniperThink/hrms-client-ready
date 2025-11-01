import requests
import time

def quick_performance_test():
    """Quick test to see if performance is restored"""
    print("🚀 QUICK PERFORMANCE TEST")
    print("=" * 50)
    
    session = requests.Session()
    
    # Test 1: Health check
    print("1️⃣ Health Check...")
    start_time = time.time()
    try:
        response = requests.get("http://127.0.0.1:8000/api/health/", timeout=10)
        end_time = time.time()
        health_time = (end_time - start_time) * 1000
        print(f"   ✅ Health: {health_time:.0f}ms")
    except Exception as e:
        print(f"   ❌ Health failed: {e}")
        return
    
    # Test 2: Login
    print("\n2️⃣ Login Test...")
    start_time = time.time()
    try:
        login_response = session.post(
            "http://127.0.0.1:8000/api/public/login/",
            json={'email': 'final@gmail.com', 'password': 'Siddhant@2'},
            timeout=15
        )
        end_time = time.time()
        login_time = (end_time - start_time) * 1000
        
        if login_response.status_code == 200:
            print(f"   ✅ Login: {login_time:.0f}ms")
            
            # Set token
            login_data = login_response.json()
            token = login_data.get('tokens', {}).get('access')
            if token:
                session.headers.update({'Authorization': f'Bearer {token}'})
        else:
            print(f"   ❌ Login failed: HTTP {login_response.status_code}")
            return
    except Exception as e:
        print(f"   ❌ Login error: {e}")
        return
    
    # Test 3: Quick API test
    print("\n3️⃣ API Endpoint Test...")
    start_time = time.time()
    try:
        response = session.get("http://127.0.0.1:8000/api/dropdown-options/", timeout=15)
        end_time = time.time()
        api_time = (end_time - start_time) * 1000
        
        if response.status_code == 200:
            print(f"   ✅ Dropdown API: {api_time:.0f}ms")
        else:
            print(f"   ❌ API failed: HTTP {response.status_code}")
    except Exception as e:
        print(f"   ❌ API error: {e}")
    
    print("\n" + "=" * 50)
    print("📊 PERFORMANCE COMPARISON:")
    print("🎯 Target Performance:")
    print("   • Health: <50ms")
    print("   • Login: <1000ms") 
    print("   • API: <800ms")
    print("\n💡 If times are still high:")
    print("   1. Neon database might be experiencing latency")
    print("   2. Try switching to a local PostgreSQL for testing")
    print("   3. Check Neon dashboard for any issues")

if __name__ == "__main__":
    quick_performance_test()
