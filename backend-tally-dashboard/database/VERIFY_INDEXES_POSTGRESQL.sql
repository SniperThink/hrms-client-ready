-- =====================================================================
-- POSTGRESQL DATABASE INDEX VERIFICATION COMMANDS
-- =====================================================================
-- Run these directly in your PostgreSQL database (pgAdmin, psql, etc.)

-- 1. CHECK IF INDEXES EXIST (PostgreSQL syntax)
-- =====================================================================

-- Check all indexes on DailyAttendance table
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'excel_data_dailyattendance' 
AND indexname LIKE 'idx_%';

-- Check all indexes on EmployeeProfile table
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'excel_data_employeeprofile' 
AND indexname LIKE 'idx_%';

-- Check all indexes on MonthlyAttendanceSummary table
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'excel_data_monthlyattendancesummary' 
AND indexname LIKE 'idx_%';

-- Check all indexes on SalaryData table
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'excel_data_salarydata' 
AND indexname LIKE 'idx_%';

-- Check all indexes on CustomUser table
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'excel_data_customuser' 
AND indexname LIKE 'idx_%';

-- Alternative: Check all our custom indexes at once
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- 2. TEST QUERY PERFORMANCE WITH EXPLAIN (PostgreSQL syntax)
-- =====================================================================

-- Test DailyAttendance query (used by all_records API)
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM excel_data_dailyattendance 
WHERE tenant_id = 1 AND date >= '2025-01-01' 
ORDER BY date DESC LIMIT 100;

-- Test EmployeeProfile query (used by directory_data API)
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM excel_data_employeeprofile 
WHERE tenant_id = 1 AND is_active = true 
ORDER BY first_name LIMIT 50;

-- Test MonthlyAttendanceSummary query
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM excel_data_monthlyattendancesummary 
WHERE tenant_id = 1 AND year = 2025 AND month = 7;

-- Test SalaryData query (used by directory_data API)
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM excel_data_salarydata 
WHERE tenant_id = 1 AND year = 2025 AND month = 7 
ORDER BY year DESC, month DESC LIMIT 50;

-- Test Employee lookup by employee_id
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM excel_data_employeeprofile 
WHERE tenant_id = 1 AND employee_id = 'EMP001';

-- 3. DETAILED QUERY ANALYSIS WITH TIMING
-- =====================================================================

-- Enable timing for all queries
\timing on

-- Test query performance (time will be shown after execution)
SELECT COUNT(*) FROM excel_data_dailyattendance 
WHERE tenant_id = 1 AND date >= '2025-01-01';

-- Test with specific index hint (PostgreSQL doesn't support USE INDEX, but we can check if it's used)
SELECT COUNT(*) FROM excel_data_employeeprofile 
WHERE tenant_id = 1 AND is_active = true;

-- 4. CHECK INDEX USAGE STATISTICS (PostgreSQL)
-- =====================================================================

-- Check index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE indexname LIKE 'idx_%'
ORDER BY idx_tup_read DESC;

-- Check table scan vs index scan ratio
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    CASE 
        WHEN seq_scan + idx_scan = 0 THEN 0
        ELSE ROUND((idx_scan::numeric / (seq_scan + idx_scan) * 100), 2)
    END as index_usage_percentage
FROM pg_stat_user_tables 
WHERE tablename IN ('excel_data_dailyattendance', 'excel_data_employeeprofile', 
                   'excel_data_monthlyattendancesummary', 'excel_data_salarydata')
ORDER BY index_usage_percentage DESC;

-- 5. INDEX SIZE AND EFFICIENCY
-- =====================================================================

-- Check index sizes
SELECT 
    t.tablename,
    indexname,
    c.reltuples AS num_rows,
    pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
    pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
    ROUND(((pg_relation_size(i.indexrelid)::numeric / pg_relation_size(c.oid)) * 100), 2) AS index_ratio
FROM pg_tables t
LEFT OUTER JOIN pg_class c ON c.relname = t.tablename
LEFT OUTER JOIN pg_index i ON i.indrelid = c.oid
LEFT OUTER JOIN pg_class c2 ON c2.oid = i.indexrelid
LEFT OUTER JOIN pg_indexes idx ON idx.indexname = c2.relname
WHERE t.tablename IN ('excel_data_dailyattendance', 'excel_data_employeeprofile', 
                     'excel_data_monthlyattendancesummary', 'excel_data_salarydata')
AND idx.indexname LIKE 'idx_%'
ORDER BY pg_relation_size(i.indexrelid) DESC;

-- 6. UPDATE TABLE STATISTICS (PostgreSQL equivalent of ANALYZE TABLE)
-- =====================================================================

-- Update statistics for better query planning
ANALYZE excel_data_dailyattendance;
ANALYZE excel_data_employeeprofile;
ANALYZE excel_data_monthlyattendancesummary;
ANALYZE excel_data_salarydata;
ANALYZE excel_data_customuser;

-- Or analyze all tables at once
ANALYZE;

-- 7. CHECK FOR SLOW QUERIES
-- =====================================================================

-- Check current running queries (if you have permissions)
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
AND state = 'active';

-- 8. POSTGRESQL-SPECIFIC INDEX DIAGNOSTICS
-- =====================================================================

-- Check for unused indexes (indexes that might not be needed)
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    pg_size_pretty(pg_relation_size(i.indexrelid)) as index_size
FROM pg_stat_user_indexes ui
JOIN pg_index i ON ui.indexrelid = i.indexrelid
WHERE idx_scan = 0 
AND indexname LIKE 'idx_%'
ORDER BY pg_relation_size(i.indexrelid) DESC;

-- Check for duplicate indexes (similar indexes that might be redundant)
SELECT 
    pg_size_pretty(SUM(pg_relation_size(idx))::BIGINT) AS SIZE,
    (array_agg(indexrelname))[1] AS idx1, 
    (array_agg(indexrelname))[2] AS idx2
FROM (
    SELECT indexrelname, 
           string_agg(attname, ',' ORDER BY attnum) AS cols,
           indexrelid as idx
    FROM pg_index 
    JOIN pg_class ON pg_class.oid = pg_index.indexrelid
    JOIN pg_attribute ON pg_attribute.attrelid = pg_index.indrelid 
                     AND pg_attribute.attnum = ANY(pg_index.indkey)
    WHERE indexrelname LIKE 'idx_%'
    GROUP BY indexrelname, indexrelid
) sub
GROUP BY cols 
HAVING COUNT(*) > 1;

-- 9. EXPECTED RESULTS FOR POSTGRESQL
-- =====================================================================

-- ✅ GOOD SIGNS in EXPLAIN output:
-- • "Index Scan using idx_xxxxx" (shows index is being used)
-- • Low "cost" values (e.g., cost=0.43..8.45)
-- • "Buffers: shared hit=X" with low X values
-- • Fast execution time (actual time=0.123..1.456 ms)

-- ❌ BAD SIGNS in EXPLAIN output:
-- • "Seq Scan" (sequential scan - no index used)
-- • High "cost" values (e.g., cost=1000.00..5000.00)
-- • "Buffers: shared read=X" with high X values  
-- • Slow execution time (actual time=100.0..500.0 ms)

-- 10. QUICK INDEX VERIFICATION SCRIPT
-- =====================================================================

-- Run this single query to get a comprehensive overview
WITH index_stats AS (
    SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch,
        pg_size_pretty(pg_relation_size(i.indexrelid)) as index_size
    FROM pg_stat_user_indexes ui
    JOIN pg_index i ON ui.indexrelid = i.indexrelid
    WHERE indexname LIKE 'idx_%'
)
SELECT 
    tablename,
    COUNT(*) as custom_indexes,
    SUM(idx_scan) as total_index_scans,
    SUM(idx_tup_read) as total_tuples_read,
    CASE 
        WHEN SUM(idx_scan) > 0 THEN '✅ INDEXES BEING USED'
        ELSE '❌ INDEXES NOT USED'
    END as status
FROM index_stats
GROUP BY tablename
ORDER BY total_index_scans DESC;
