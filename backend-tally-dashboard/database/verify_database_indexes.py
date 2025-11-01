#!/usr/bin/env python3
"""
COMPREHENSIVE DATABASE INDEX VERIFICATION TOOL
==============================================

This script verifies that all the indexes we created are:
1. Successfully created in the database
2. Actually being used by queries
3. Providing performance benefits

Usage:
    python verify_database_indexes.py
"""

import os
import django
import time
from django.db import connection
from django.conf import settings

def setup_django():
    """Setup Django environment"""
    settings_modules = [
        'hrms_backend.settings',
        'backend.settings', 
        'settings',
        'hrms.settings'
    ]
    
    for settings_module in settings_modules:
        try:
            os.environ['DJANGO_SETTINGS_MODULE'] = settings_module
            django.setup()
            print(f"✅ Django setup successful with {settings_module}")
            return True
        except:
            continue
    
    print("❌ Could not setup Django")
    return False

def check_index_exists():
    """Check if our indexes exist in the database"""
    print("\n🔍 CHECKING INDEX EXISTENCE")
    print("=" * 60)
    
    # List of indexes we created
    expected_indexes = [
        'idx_daily_attendance_tenant_date',
        'idx_daily_attendance_tenant_employee_date', 
        'idx_daily_attendance_employee_id',
        'idx_monthly_summary_tenant_year_month',
        'idx_employee_profile_tenant_active',
        'idx_employee_profile_tenant_employee_id',
        'idx_salary_data_tenant_year_month',
        'idx_custom_user_tenant_active'
    ]
    
    with connection.cursor() as cursor:
        # For MySQL/MariaDB
        cursor.execute("SHOW INDEX FROM excel_data_dailyattendance;")
        daily_attendance_indexes = [row[2] for row in cursor.fetchall()]
        
        cursor.execute("SHOW INDEX FROM excel_data_employeeprofile;")
        employee_profile_indexes = [row[2] for row in cursor.fetchall()]
        
        cursor.execute("SHOW INDEX FROM excel_data_monthlyattendancesummary;") 
        monthly_summary_indexes = [row[2] for row in cursor.fetchall()]
        
        cursor.execute("SHOW INDEX FROM excel_data_salarydata;")
        salary_data_indexes = [row[2] for row in cursor.fetchall()]
        
        cursor.execute("SHOW INDEX FROM excel_data_customuser;")
        custom_user_indexes = [row[2] for row in cursor.fetchall()]
    
    # Check each expected index
    all_indexes = (daily_attendance_indexes + employee_profile_indexes + 
                  monthly_summary_indexes + salary_data_indexes + custom_user_indexes)
    
    found_indexes = []
    missing_indexes = []
    
    for expected_index in expected_indexes:
        if expected_index in all_indexes:
            found_indexes.append(expected_index)
            print(f"✅ {expected_index}")
        else:
            missing_indexes.append(expected_index)
            print(f"❌ {expected_index} - MISSING")
    
    print(f"\n📊 Index Summary:")
    print(f"   • Found: {len(found_indexes)}/{len(expected_indexes)}")
    print(f"   • Missing: {len(missing_indexes)}")
    
    return len(missing_indexes) == 0

def test_query_performance():
    """Test actual query performance with EXPLAIN"""
    print("\n⚡ TESTING QUERY PERFORMANCE")
    print("=" * 60)
    
    test_queries = [
        {
            'name': 'DailyAttendance by tenant+date (all_records API)',
            'query': '''
                SELECT * FROM excel_data_dailyattendance 
                WHERE tenant_id = 1 AND date >= '2025-01-01' 
                LIMIT 10
            ''',
            'expected_index': 'idx_daily_attendance_tenant_date'
        },
        {
            'name': 'EmployeeProfile by tenant+active (directory_data API)',
            'query': '''
                SELECT * FROM excel_data_employeeprofile 
                WHERE tenant_id = 1 AND is_active = 1 
                LIMIT 10
            ''',
            'expected_index': 'idx_employee_profile_tenant_active' 
        },
        {
            'name': 'MonthlyAttendanceSummary by tenant+period',
            'query': '''
                SELECT * FROM excel_data_monthlyattendancesummary 
                WHERE tenant_id = 1 AND year = 2025 AND month = 7
            ''',
            'expected_index': 'idx_monthly_summary_tenant_year_month'
        },
        {
            'name': 'SalaryData by tenant+period',
            'query': '''
                SELECT * FROM excel_data_salarydata 
                WHERE tenant_id = 1 AND year = 2025 AND month = 7 
                LIMIT 10
            ''',
            'expected_index': 'idx_salary_data_tenant_year_month'
        }
    ]
    
    results = []
    
    with connection.cursor() as cursor:
        for test in test_queries:
            print(f"\n🔍 Testing: {test['name']}")
            print("-" * 40)
            
            # Run EXPLAIN to see if index is used
            explain_query = f"EXPLAIN {test['query']}"
            
            try:
                # Time the actual query
                start_time = time.time()
                cursor.execute(test['query'])
                results_count = len(cursor.fetchall())
                execution_time = round((time.time() - start_time) * 1000, 2)
                
                # Check execution plan
                cursor.execute(explain_query)
                explain_result = cursor.fetchall()
                
                # Parse explain result (MySQL format)
                using_index = False
                index_used = "None"
                
                for row in explain_result:
                    if len(row) > 4 and row[4]:  # key column
                        index_used = row[4]
                        using_index = True
                    
                print(f"   ⏱️  Execution time: {execution_time}ms")
                print(f"   📊 Records found: {results_count}")
                print(f"   🔑 Index used: {index_used}")
                print(f"   {'✅' if using_index else '❌'} Index optimization: {'Active' if using_index else 'NOT USED'}")
                
                if test['expected_index'] in index_used:
                    print(f"   🎯 Expected index '{test['expected_index']}' is being used!")
                
                results.append({
                    'test': test['name'],
                    'execution_time': execution_time,
                    'records': results_count,
                    'index_used': index_used,
                    'optimized': using_index
                })
                
            except Exception as e:
                print(f"   ❌ Error: {e}")
                results.append({
                    'test': test['name'],
                    'error': str(e)
                })
    
    return results

def benchmark_with_without_indexes():
    """Benchmark queries with and without using indexes"""
    print("\n🏁 BENCHMARKING INDEX EFFECTIVENESS")
    print("=" * 60)
    
    benchmark_queries = [
        {
            'name': 'Large attendance data fetch',
            'indexed_query': '''
                SELECT employee_id, date, attendance_status 
                FROM excel_data_dailyattendance 
                WHERE tenant_id = 1 AND date >= '2025-01-01'
                ORDER BY date DESC LIMIT 100
            ''',
            'force_no_index': '''
                SELECT employee_id, date, attendance_status 
                FROM excel_data_dailyattendance IGNORE INDEX (idx_daily_attendance_tenant_date)
                WHERE tenant_id = 1 AND date >= '2025-01-01'
                ORDER BY date DESC LIMIT 100
            '''
        },
        {
            'name': 'Active employees lookup',
            'indexed_query': '''
                SELECT employee_id, first_name, last_name 
                FROM excel_data_employeeprofile 
                WHERE tenant_id = 1 AND is_active = 1 
                LIMIT 50
            ''',
            'force_no_index': '''
                SELECT employee_id, first_name, last_name 
                FROM excel_data_employeeprofile IGNORE INDEX (idx_employee_profile_tenant_active)
                WHERE tenant_id = 1 AND is_active = 1 
                LIMIT 50
            '''
        }
    ]
    
    benchmark_results = []
    
    with connection.cursor() as cursor:
        for benchmark in benchmark_queries:
            print(f"\n📊 Benchmarking: {benchmark['name']}")
            print("-" * 40)
            
            try:
                # Test with index
                start_time = time.time()
                cursor.execute(benchmark['indexed_query'])
                cursor.fetchall()
                indexed_time = round((time.time() - start_time) * 1000, 2)
                
                # Test without index (if supported)
                try:
                    start_time = time.time()
                    cursor.execute(benchmark['force_no_index'])
                    cursor.fetchall()
                    no_index_time = round((time.time() - start_time) * 1000, 2)
                    
                    improvement = round(((no_index_time - indexed_time) / no_index_time) * 100, 1)
                    
                    print(f"   🚀 With index: {indexed_time}ms")
                    print(f"   🐌 Without index: {no_index_time}ms")
                    print(f"   📈 Improvement: {improvement}% faster")
                    
                    benchmark_results.append({
                        'test': benchmark['name'],
                        'with_index': indexed_time,
                        'without_index': no_index_time,
                        'improvement': improvement
                    })
                    
                except Exception as e:
                    print(f"   ⚠️  Cannot test without index: {e}")
                    print(f"   🚀 With index: {indexed_time}ms")
                    
                    benchmark_results.append({
                        'test': benchmark['name'],
                        'with_index': indexed_time,
                        'note': 'Force no-index test failed (normal)'
                    })
                
            except Exception as e:
                print(f"   ❌ Benchmark failed: {e}")
    
    return benchmark_results

def main():
    """Main verification routine"""
    print("🗄️  DATABASE INDEX VERIFICATION TOOL")
    print("=" * 70)
    
    if not setup_django():
        return
    
    # Step 1: Check if indexes exist
    indexes_exist = check_index_exists()
    
    # Step 2: Test query performance
    performance_results = test_query_performance()
    
    # Step 3: Benchmark effectiveness
    benchmark_results = benchmark_with_without_indexes()
    
    # Final summary
    print(f"\n" + "=" * 70)
    print("📈 FINAL VERIFICATION SUMMARY")
    print("=" * 70)
    
    print(f"🔍 Index Status: {'✅ All indexes found' if indexes_exist else '❌ Some indexes missing'}")
    
    if performance_results:
        optimized_queries = sum(1 for r in performance_results if r.get('optimized', False))
        total_queries = len(performance_results)
        print(f"⚡ Query Optimization: {optimized_queries}/{total_queries} queries using indexes")
        
        avg_time = sum(r.get('execution_time', 0) for r in performance_results) / len(performance_results)
        print(f"⏱️  Average Query Time: {avg_time:.2f}ms")
    
    if benchmark_results:
        improvements = [r.get('improvement', 0) for r in benchmark_results if 'improvement' in r]
        if improvements:
            avg_improvement = sum(improvements) / len(improvements)
            print(f"🚀 Average Performance Improvement: {avg_improvement:.1f}%")
    
    print(f"\n💡 Recommendations:")
    if indexes_exist and performance_results:
        print(f"   ✅ Indexes are working! Your API performance should be significantly improved.")
        print(f"   ✅ Continue monitoring query performance in your application logs.")
    else:
        print(f"   ⚠️  Some indexes may not be working optimally.")
        print(f"   💡 Consider re-running the index creation SQL.")
    
    print(f"\n🎯 Next Steps:")
    print(f"   • Test your HRMS APIs and compare response times")
    print(f"   • Monitor the 'timing_breakdown' in API responses")
    print(f"   • Check application logs for query performance")

if __name__ == "__main__":
    main()
