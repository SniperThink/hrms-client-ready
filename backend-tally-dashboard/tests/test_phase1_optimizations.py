#!/usr/bin/env python3
"""
Test Phase 1 Frontend Charts API Optimizations

This script tests the optimized frontend_charts API and validates:
1. Query timing improvements
2. Cache functionality  
3. Salary distribution optimization
4. Department lookup caching

Usage:
    python test_phase1_optimizations.py
"""

import requests
import time
import json
from datetime import datetime

# Configuration
BASE_URL = "http://127.0.0.1:8000"
API_ENDPOINT = f"{BASE_URL}/api/salary-data/frontend_charts/"

def test_api_performance():
    """Test the frontend_charts API performance"""
    
    print("🧪 Testing Phase 1 Frontend Charts API Optimizations")
    print("=" * 60)
    
    # Test parameters
    test_cases = [
        {
            'name': 'This Month - All Departments',
            'params': {'time_period': 'this_month', 'department': 'All'}
        },
        {
            'name': 'This Month - Specific Department', 
            'params': {'time_period': 'this_month', 'department': 'IT'}
        },
        {
            'name': 'Last 6 Months - All Departments',
            'params': {'time_period': 'last_6_months', 'department': 'All'}
        }
    ]
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📊 Test {i}: {test_case['name']}")
        print("-" * 40)
        
        # Clear cache by adding a timestamp parameter 
        test_params = test_case['params'].copy()
        test_params['_t'] = str(int(time.time()))
        
        # First call (no cache)
        start_time = time.time()
        try:
            response = requests.get(API_ENDPOINT, params=test_params, timeout=30)
            first_call_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                query_timings = data.get('queryTimings', {})
                
                print(f"✅ First Call (No Cache): {first_call_time:.2f}s")
                print(f"   API Response Time: {query_timings.get('total_time_ms', 0):.1f}ms")
                print(f"   Salary Distribution: {query_timings.get('salary_distribution_ms', 0):.1f}ms")
                print(f"   Department Analysis: {query_timings.get('department_analysis_ms', 0):.1f}ms")
                print(f"   Trends Query: {query_timings.get('trends_query_ms', 0):.1f}ms")
                
                # Validate optimization markers
                validate_optimizations(query_timings, data)
                
                # Second call (should hit cache)
                time.sleep(0.5)  # Small delay
                test_params_cached = test_case['params'].copy()  # Remove timestamp for cache hit
                
                start_time = time.time()
                cached_response = requests.get(API_ENDPOINT, params=test_params_cached, timeout=10)
                cached_call_time = time.time() - start_time
                
                if cached_response.status_code == 200:
                    cached_data = cached_response.json()
                    cached_timings = cached_data.get('queryTimings', {})
                    
                    print(f"🚀 Cached Call: {cached_call_time:.3f}s")
                    print(f"   Cache Hit: {cached_timings.get('cached_response', False)}")
                    print(f"   Cache Age: {cached_timings.get('cache_age_seconds', 0):.1f}s")
                
                results.append({
                    'test': test_case['name'],
                    'first_call_ms': query_timings.get('total_time_ms', 0),
                    'cached_call_ms': cached_timings.get('total_time_ms', 0),
                    'salary_dist_ms': query_timings.get('salary_distribution_ms', 0),
                    'dept_lookup_ms': query_timings.get('dept_lookup_cache_hit_ms', query_timings.get('dept_lookup_cache_miss_ms', 0))
                })
                
            else:
                print(f"❌ API Error: {response.status_code} - {response.text}")
                
        except requests.exceptions.Timeout:
            print(f"⏰ Request timed out (>30s) - API might be slow")
        except Exception as e:
            print(f"❌ Request failed: {e}")
    
    # Summary report
    print_summary_report(results)

def validate_optimizations(query_timings, data):
    """Validate that optimizations are working"""
    
    optimizations = []
    
    # Check salary distribution optimization (should be fast)
    salary_dist_time = query_timings.get('salary_distribution_ms', 0)
    if salary_dist_time > 0 and salary_dist_time < 100:
        optimizations.append("✅ Salary Distribution Optimized")
    elif salary_dist_time >= 100:
        optimizations.append(f"⚠️  Salary Distribution Slow: {salary_dist_time:.1f}ms")
    
    # Check department lookup caching
    if 'dept_lookup_cache_hit_ms' in query_timings:
        optimizations.append("✅ Department Lookup Cached")
    elif 'dept_lookup_cache_miss_ms' in query_timings:
        optimizations.append("📝 Department Lookup Cache Miss (first time)")
    
    # Check comprehensive timing
    if len(query_timings) >= 8:
        optimizations.append("✅ Comprehensive Query Timing")
    
    # Validate salary distribution data structure
    salary_dist = data.get('salaryDistribution', [])
    if len(salary_dist) == 5 and all('range' in item and 'count' in item for item in salary_dist):
        optimizations.append("✅ Salary Distribution Data Structure")
    
    if optimizations:
        print("   Optimizations Status:")
        for opt in optimizations:
            print(f"     {opt}")

def print_summary_report(results):
    """Print performance summary report"""
    
    if not results:
        print("\n❌ No test results to analyze")
        return
    
    print(f"\n📈 Performance Summary Report")
    print("=" * 60)
    
    avg_first_call = sum(r['first_call_ms'] for r in results) / len(results)
    avg_cached_call = sum(r['cached_call_ms'] for r in results) / len(results) 
    avg_salary_dist = sum(r['salary_dist_ms'] for r in results) / len(results)
    avg_dept_lookup = sum(r['dept_lookup_ms'] for r in results) / len(results)
    
    print(f"Average Performance:")
    print(f"  • First Call (No Cache): {avg_first_call:.1f}ms")
    print(f"  • Cached Call: {avg_cached_call:.1f}ms")  
    print(f"  • Salary Distribution: {avg_salary_dist:.1f}ms")
    print(f"  • Department Lookup: {avg_dept_lookup:.1f}ms")
    
    # Performance assessment
    print(f"\n🎯 Optimization Assessment:")
    
    if avg_first_call < 5000:
        print(f"  ✅ Excellent: API responds in {avg_first_call:.1f}ms (target: <5000ms)")
    elif avg_first_call < 8000:
        print(f"  ✅ Good: API responds in {avg_first_call:.1f}ms (improved from ~8000ms)")
    else:
        print(f"  ⚠️  Needs Work: API still slow at {avg_first_call:.1f}ms")
    
    if avg_cached_call < 10:
        print(f"  ✅ Excellent: Cache hits in {avg_cached_call:.1f}ms")
    elif avg_cached_call < 50:
        print(f"  ✅ Good: Cache hits in {avg_cached_call:.1f}ms") 
    
    if avg_salary_dist < 50:
        print(f"  ✅ Excellent: Salary distribution optimized ({avg_salary_dist:.1f}ms)")
    elif avg_salary_dist < 100:
        print(f"  ✅ Good: Salary distribution improved ({avg_salary_dist:.1f}ms)")
    
    cache_improvement = ((avg_first_call - avg_cached_call) / avg_first_call) * 100
    print(f"\n🚀 Cache Performance Gain: {cache_improvement:.1f}% faster")
    
    print(f"\n💡 Next Steps:")
    if avg_first_call > 5000:
        print(f"  • Consider Phase 2 optimizations (database indexes)")
        print(f"  • Run: python optimize_database_indexes.py")
    if avg_salary_dist > 50:
        print(f"  • Add database index on net_payable column")
    
    print(f"\n✨ Phase 1 Optimizations Status: {'SUCCESS' if avg_first_call < 8000 else 'NEEDS_IMPROVEMENT'}")

def main():
    """Main test routine"""
    print(f"🧪 Frontend Charts API Optimization Test")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Endpoint: {API_ENDPOINT}")
    
    try:
        test_api_performance()
    except KeyboardInterrupt:
        print(f"\n⏹️  Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")

if __name__ == "__main__":
    main()
