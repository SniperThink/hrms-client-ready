#!/usr/bin/env python3
"""
Test script to verify all_records API response structure
This helps debug frontend compatibility issues
"""

import requests
import json
import sys

def test_all_records_api():
    """Test the all_records API and verify response structure"""
    
    print("🧪 Testing all_records API Response Structure")
    print("=" * 60)
    
    # Test URL
    url = "http://127.0.0.1:8000/api/daily-attendance/all_records/?time_period=this_month"
    
    try:
        print(f"📡 Making request to: {url}")
        response = requests.get(url, timeout=10)
        
        print(f"📊 Response Status: {response.status_code}")
        print(f"📏 Response Size: {len(response.content)} bytes")
        
        if response.status_code != 200:
            print(f"❌ API Error: {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        # Parse JSON
        data = response.json()
        
        print(f"\n🔍 Response Structure Analysis:")
        print(f"   • Has 'results' key: {'✅' if 'results' in data else '❌'}")
        print(f"   • Has 'count' key: {'✅' if 'count' in data else '❌'}")
        print(f"   • Has 'performance' key: {'✅' if 'performance' in data else '❌'}")
        print(f"   • Record count: {data.get('count', 'N/A')}")
        
        if 'results' in data and data['results']:
            first_record = data['results'][0]
            print(f"\n📋 First Record Analysis:")
            
            required_fields = [
                'id', 'employee_id', 'employee_name', 'department', 
                'year', 'month', 'present_days', 'absent_days', 
                'total_ot_hours', 'total_late_minutes', 'attendance_percentage'
            ]
            
            for field in required_fields:
                status = "✅" if field in first_record else "❌"
                value = first_record.get(field, "MISSING")
                print(f"   • {field}: {status} ({value})")
        
        if 'performance' in data:
            perf = data['performance']
            print(f"\n⚡ Performance Analysis:")
            print(f"   • Query Time: {perf.get('query_time', 'N/A')}")
            print(f"   • Total Time: {perf.get('total_time_ms', 'N/A')}ms")
            print(f"   • Data Source: {perf.get('data_source', 'N/A')}")
            print(f"   • Cached: {perf.get('cached', 'N/A')}")
            
            if 'timing_breakdown' in perf:
                breakdown = perf['timing_breakdown']
                print(f"   • Employee Fetch: {breakdown.get('employee_fetch_ms', 'N/A')}ms")
                print(f"   • Monthly Query: {breakdown.get('monthly_summary_query_ms', 'N/A')}ms")
                print(f"   • Data Processing: {breakdown.get('monthly_data_processing_ms', 'N/A')}ms")
        
        if 'frontend_compatibility' in data:
            frontend = data['frontend_compatibility']
            print(f"\n🎨 Frontend Compatibility:")
            print(f"   • Format Version: {frontend.get('format_version', 'N/A')}")
            print(f"   • Response Optimized: {frontend.get('response_optimized', 'N/A')}")
        
        # Check for potential issues
        print(f"\n🔧 Frontend Compatibility Check:")
        issues = []
        
        if 'results' not in data:
            issues.append("Missing 'results' key - frontend expects this")
        
        if data.get('results') and len(data['results']) > 0:
            first_record = data['results'][0]
            if 'year' not in first_record:
                issues.append("Missing 'year' field - frontend transformation needs this")
            if 'month' not in first_record:
                issues.append("Missing 'month' field - frontend transformation needs this")
            if 'employee_name' not in first_record:
                issues.append("Missing 'employee_name' field - frontend needs this")
        
        if issues:
            print("   ❌ Issues Found:")
            for issue in issues:
                print(f"      • {issue}")
        else:
            print("   ✅ No compatibility issues found!")
        
        print(f"\n💾 Sample Response (first 500 chars):")
        print(json.dumps(data, indent=2)[:500] + "...")
        
        return len(issues) == 0
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Network Error: {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ JSON Parse Error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        return False

if __name__ == "__main__":
    success = test_all_records_api()
    
    print(f"\n{'='*60}")
    if success:
        print("🎉 API Test PASSED - Frontend should work correctly!")
    else:
        print("⚠️  API Test FAILED - Check issues above")
    
    sys.exit(0 if success else 1)
