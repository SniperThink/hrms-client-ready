import requests
import time
import json

def test_api_response_structure():
    """Test the API response structure and size to understand frontend delay"""
    
    print("🔍 FRONTEND RENDERING PERFORMANCE ANALYSIS")
    print("=" * 60)
    
    # Test the specific API endpoint
    api_url = "http://localhost:8000/api/eligible-employees/?date=2025-07-25"
    
    session = requests.Session()
    
    # Login first
    print("1️⃣ Logging in...")
    try:
        login_response = session.post(
            "http://127.0.0.1:8000/api/public/login/",
            json={'email': 'final@gmail.com', 'password': 'Siddhant@2'},
            timeout=10
        )
        
        if login_response.status_code == 200:
            login_data = login_response.json()
            token = login_data.get('tokens', {}).get('access')
            if token:
                session.headers.update({'Authorization': f'Bearer {token}'})
                print("   ✅ Login successful")
        else:
            print("   ❌ Login failed")
            return
    except Exception as e:
        print(f"   ❌ Login error: {e}")
        return
    
    print(f"\n2️⃣ Testing API: {api_url}")
    print("-" * 60)
    
    # Test API response
    start_time = time.time()
    try:
        response = session.get(api_url, timeout=15)
        end_time = time.time()
        api_time = (end_time - start_time) * 1000
        
        if response.status_code == 200:
            print(f"   ✅ API Response Time: {api_time:.0f}ms")
            
            # Analyze response data
            try:
                data = response.json()
                response_size = len(response.content)
                
                print(f"   📊 Response Size: {response_size:,} bytes ({response_size/1024:.1f} KB)")
                
                # Analyze data structure
                if isinstance(data, dict):
                    if 'results' in data:
                        # Paginated response
                        results = data['results']
                        print(f"   📄 Pagination: {len(results)} items in current page")
                        print(f"   🔢 Total Count: {data.get('count', 'Unknown')}")
                        
                        if results:
                            # Analyze first item structure
                            first_item = results[0]
                            field_count = len(first_item) if isinstance(first_item, dict) else 0
                            print(f"   🏗️  Fields per item: {field_count}")
                            
                            # Check for heavy fields
                            heavy_fields = []
                            if isinstance(first_item, dict):
                                for key, value in first_item.items():
                                    if isinstance(value, str) and len(value) > 100:
                                        heavy_fields.append(f"{key} ({len(value)} chars)")
                                    elif isinstance(value, list) and len(value) > 10:
                                        heavy_fields.append(f"{key} ({len(value)} items)")
                            
                            if heavy_fields:
                                print(f"   ⚠️  Heavy fields: {', '.join(heavy_fields)}")
                    
                    elif isinstance(data, list):
                        # Direct array response
                        print(f"   📄 Direct Array: {len(data)} items")
                        if data:
                            first_item = data[0]
                            field_count = len(first_item) if isinstance(first_item, dict) else 0
                            print(f"   🏗️  Fields per item: {field_count}")
                
                # Performance analysis based on data size
                print(f"\n3️⃣ FRONTEND RENDERING ANALYSIS:")
                print("-" * 40)
                
                if response_size > 100000:  # > 100KB
                    print("   🚨 LARGE RESPONSE: Response is very large")
                    print("   💡 Recommendation: Implement pagination or data reduction")
                elif response_size > 50000:  # > 50KB
                    print("   ⚠️  MEDIUM RESPONSE: Response is moderately large")
                    print("   💡 Recommendation: Consider virtual scrolling or lazy loading")
                else:
                    print("   ✅ RESPONSE SIZE: Reasonable size")
                
                # Calculate expected rendering time
                items_count = 0
                if isinstance(data, dict) and 'results' in data:
                    items_count = len(data['results'])
                elif isinstance(data, list):
                    items_count = len(data)
                
                if items_count > 1000:
                    print("   🚨 HIGH ITEM COUNT: Too many items to render efficiently")
                    print("   💡 Use virtual scrolling (react-window or react-virtualized)")
                elif items_count > 500:
                    print("   ⚠️  MODERATE ITEM COUNT: May cause rendering delays")
                    print("   💡 Consider pagination or lazy loading")
                elif items_count > 100:
                    print("   ⚡ MANAGEABLE COUNT: Should render reasonably fast")
                else:
                    print("   ✅ LOW ITEM COUNT: Should render very fast")
                
                print(f"\n4️⃣ FRONTEND OPTIMIZATION RECOMMENDATIONS:")
                print("-" * 50)
                
                if api_time > 1500:
                    print("   🔧 API Optimization needed:")
                    print("     • Add database indexes")
                    print("     • Implement API-level caching")
                    print("     • Use select_related/prefetch_related")
                
                print("   🎨 Frontend Optimization:")
                print("     • Use React.memo for list items")
                print("     • Implement virtual scrolling for large lists")
                print("     • Use useMemo for expensive calculations")
                print("     • Consider skeleton loading states")
                print("     • Debounce search/filter operations")
                
                # Sample the data structure
                print(f"\n5️⃣ SAMPLE DATA STRUCTURE:")
                print("-" * 30)
                if isinstance(data, dict) and 'results' in data and data['results']:
                    sample = data['results'][0]
                elif isinstance(data, list) and data:
                    sample = data[0]
                else:
                    sample = data
                
                # Pretty print first few fields
                if isinstance(sample, dict):
                    sample_keys = list(sample.keys())[:10]  # First 10 keys
                    for key in sample_keys:
                        value = sample[key]
                        if isinstance(value, str):
                            display_value = value[:50] + "..." if len(value) > 50 else value
                        else:
                            display_value = str(value)
                        print(f"     {key}: {display_value}")
                    
                    if len(sample.keys()) > 10:
                        print(f"     ... and {len(sample.keys()) - 10} more fields")
                
            except json.JSONDecodeError:
                print("   ❌ Response is not valid JSON")
        
        else:
            print(f"   ❌ API Error: HTTP {response.status_code}")
            print(f"   📝 Response: {response.text[:200]}")
    
    except Exception as e:
        print(f"   ❌ API Request Error: {e}")

if __name__ == "__main__":
    test_api_response_structure()
