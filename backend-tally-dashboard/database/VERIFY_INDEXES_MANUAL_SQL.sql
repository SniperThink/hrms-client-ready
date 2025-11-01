-- =====================================================================
-- MANUAL SQL COMMANDS TO VERIFY DATABASE INDEXES
-- =====================================================================
-- Run these directly in your database management tool (phpMyAdmin, MySQL Workbench, etc.)

-- 1. CHECK IF INDEXES EXIST
-- =====================================================================

-- Check DailyAttendance table indexes
SHOW INDEX FROM excel_data_dailyattendance WHERE Key_name LIKE 'idx_%';

-- Check EmployeeProfile table indexes  
SHOW INDEX FROM excel_data_employeeprofile WHERE Key_name LIKE 'idx_%';

-- Check MonthlyAttendanceSummary table indexes
SHOW INDEX FROM excel_data_monthlyattendancesummary WHERE Key_name LIKE 'idx_%';

-- Check SalaryData table indexes
SHOW INDEX FROM excel_data_salarydata WHERE Key_name LIKE 'idx_%';

-- Check CustomUser table indexes
SHOW INDEX FROM excel_data_customuser WHERE Key_name LIKE 'idx_%';

-- 2. TEST QUERY PERFORMANCE WITH EXPLAIN
-- =====================================================================

-- Test DailyAttendance query (used by all_records API)
EXPLAIN SELECT * FROM excel_data_dailyattendance 
WHERE tenant_id = 1 AND date >= '2025-01-01' 
ORDER BY date DESC LIMIT 100;

-- Test EmployeeProfile query (used by directory_data API)
EXPLAIN SELECT * FROM excel_data_employeeprofile 
WHERE tenant_id = 1 AND is_active = 1 
ORDER BY first_name LIMIT 50;

-- Test MonthlyAttendanceSummary query
EXPLAIN SELECT * FROM excel_data_monthlyattendancesummary 
WHERE tenant_id = 1 AND year = 2025 AND month = 7;

-- Test SalaryData query (used by directory_data API)
EXPLAIN SELECT * FROM excel_data_salarydata 
WHERE tenant_id = 1 AND year = 2025 AND month = 7 
ORDER BY year DESC, month DESC LIMIT 50;

-- Test Employee lookup by employee_id
EXPLAIN SELECT * FROM excel_data_employeeprofile 
WHERE tenant_id = 1 AND employee_id = 'EMP001';

-- 3. BENCHMARK QUERY PERFORMANCE (Before vs After)
-- =====================================================================

-- Time a query WITH index
SET profiling = 1;
SELECT employee_id, date, attendance_status 
FROM excel_data_dailyattendance 
USE INDEX (idx_daily_attendance_tenant_date)
WHERE tenant_id = 1 AND date >= '2025-01-01' 
ORDER BY date DESC LIMIT 100;
SHOW PROFILES;

-- Time the same query WITHOUT index (force table scan)
SELECT employee_id, date, attendance_status 
FROM excel_data_dailyattendance 
IGNORE INDEX (idx_daily_attendance_tenant_date)
WHERE tenant_id = 1 AND date >= '2025-01-01' 
ORDER BY date DESC LIMIT 100;
SHOW PROFILES;

-- 4. CHECK INDEX USAGE STATISTICS
-- =====================================================================

-- Check if indexes are being used
SELECT 
    TABLE_SCHEMA,
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME,
    CARDINALITY
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE()
AND INDEX_NAME LIKE 'idx_%'
ORDER BY TABLE_NAME, INDEX_NAME;

-- 5. ANALYZE TABLE PERFORMANCE
-- =====================================================================

-- Update table statistics for better query planning
ANALYZE TABLE excel_data_dailyattendance;
ANALYZE TABLE excel_data_employeeprofile;  
ANALYZE TABLE excel_data_monthlyattendancesummary;
ANALYZE TABLE excel_data_salarydata;
ANALYZE TABLE excel_data_customuser;

-- 6. CHECK SLOW QUERY LOG (if enabled)
-- =====================================================================

-- Show slow query log status
SHOW VARIABLES LIKE 'slow_query_log%';

-- Show long query time threshold
SHOW VARIABLES LIKE 'long_query_time';

-- If slow query log is enabled, check for queries that are still slow
-- (These queries might benefit from additional indexes)

-- 7. REAL-TIME INDEX MONITORING
-- =====================================================================

-- Show current running queries
SHOW PROCESSLIST;

-- Check table locks and index contention
SHOW OPEN TABLES WHERE In_use > 0;

-- 8. EXPECTED RESULTS FOR VERIFICATION
-- =====================================================================

-- ✅ GOOD SIGNS:
-- • EXPLAIN shows "Using index" in Extra column
-- • Key column shows our index name (e.g., idx_daily_attendance_tenant_date)
-- • Rows examined is low (< 1000 for typical queries)
-- • Query execution time < 50ms for most queries

-- ❌ BAD SIGNS:  
-- • EXPLAIN shows "Using filesort" or "Using temporary"
-- • Key column is NULL (no index used)
-- • Rows examined is very high (> 10000)
-- • Query execution time > 500ms

-- 9. PERFORMANCE COMPARISON TEMPLATE
-- =====================================================================

-- Run this before and after creating indexes to measure improvement:

-- BEFORE INDEXES (run this first, record the time):
-- SELECT COUNT(*) FROM excel_data_dailyattendance 
-- WHERE tenant_id = 1 AND date >= '2025-01-01';

-- AFTER INDEXES (should be much faster):
-- SELECT COUNT(*) FROM excel_data_dailyattendance 
-- WHERE tenant_id = 1 AND date >= '2025-01-01';

-- Expected improvement: 70-90% faster query execution
