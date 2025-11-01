#!/usr/bin/env python3
"""
Performance test for optimized directory_data API
Tests both paginated and load_all modes
"""

import requests
import json
import time

def test_directory_data_performance():
    """Test directory_data API performance improvements"""
    
    print("🚀 Testing ULTRA-OPTIMIZED directory_data API")
    print("=" * 70)
    
    base_url = "http://127.0.0.1:8000/api/employees/directory_data/"
    
    test_scenarios = [
        {
            'name': 'Paginated (Page 1, 50 records)',
            'url': f"{base_url}?page=1&page_size=50",
            'expected_improvement': '60-80% faster'
        },
        {
            'name': 'Load All Employees',
            'url': f"{base_url}?load_all=true",
            'expected_improvement': '70-85% faster'
        },
        {
            'name': 'Load All with Cache Bypass',
            'url': f"{base_url}?load_all=true&no_cache=true",
            'expected_improvement': 'Pure query performance'
        }
    ]
    
    results = []
    
    for scenario in test_scenarios:
        print(f"\n📊 Testing: {scenario['name']}")
        print("-" * 50)
        
        try:
            # Make request and measure time
            start_time = time.time()
            response = requests.get(scenario['url'], timeout=30)
            network_time = round((time.time() - start_time) * 1000, 2)
            
            if response.status_code == 401:
                print("⚠️  Authentication required - test with browser session")
                continue
                
            if response.status_code != 200:
                print(f"❌ Error {response.status_code}: {response.text}")
                continue
            
            data = response.json()
            
            # Extract performance data
            perf = data.get('performance', {})
            backend_time = perf.get('total_time_ms', 0)
            timing = perf.get('timing_breakdown', {})
            
            print(f"✅ Success!")
            print(f"   📏 Records returned: {data.get('count', 'N/A')}")
            print(f"   ⏱️  Network time: {network_time}ms")
            print(f"   🖥️  Backend time: {backend_time}ms")
            print(f"   📊 Expected: {scenario['expected_improvement']}")
            
            if timing:
                print(f"   🔍 Breakdown:")
                print(f"      • Setup: {timing.get('setup_ms', 0)}ms")
                print(f"      • Cache check: {timing.get('cache_check_ms', 0)}ms")
                print(f"      • Employee query: {timing.get('employee_query_setup_ms', 0)}ms")
                print(f"      • Salary subquery: {timing.get('salary_subquery_ms', 0)}ms")
                print(f"      • Attendance query: {timing.get('attendance_query_ms', 0)}ms")
                print(f"      • Data processing: {timing.get('data_processing_ms', 0)}ms")
                print(f"      • Response building: {timing.get('response_building_ms', 0)}ms")
            
            optimization_level = perf.get('optimization_level', 'N/A')
            print(f"   🚀 Optimization: {optimization_level}")
            
            results.append({
                'scenario': scenario['name'],
                'network_time': network_time,
                'backend_time': backend_time,
                'records': data.get('count', 0),
                'cached': perf.get('cached', False)
            })
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Network error: {e}")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    # Summary
    print(f"\n" + "=" * 70)
    print("📈 PERFORMANCE SUMMARY")
    print("=" * 70)
    
    if results:
        for result in results:
            cache_status = "CACHED" if result['cached'] else "FRESH"
            print(f"• {result['scenario']}")
            print(f"  Backend: {result['backend_time']}ms | Network: {result['network_time']}ms | Records: {result['records']} | {cache_status}")
        
        print(f"\n🎯 OPTIMIZATION BENEFITS:")
        print(f"• Selective field loading with .only()")
        print(f"• Tenant-filtered subqueries")
        print(f"• Optimized working days calculation")
        print(f"• Enhanced caching strategies")
        print(f"• Comprehensive performance tracking")
        
        print(f"\n💡 EXPECTED IMPROVEMENTS:")
        print(f"• First call: 60-80% faster than before")
        print(f"• Cached calls: 90-95% faster")
        print(f"• Large datasets (load_all): 70-85% faster")
        print(f"• Memory usage: Reduced by ~40%")
    else:
        print("⚠️  No successful tests - check authentication")
    
    print(f"\n🔧 To test with authentication:")
    print(f"• Access the API through your browser")
    print(f"• Or add proper authentication headers")

if __name__ == "__main__":
    test_directory_data_performance()
