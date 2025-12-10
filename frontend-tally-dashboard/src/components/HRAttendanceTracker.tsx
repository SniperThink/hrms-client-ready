import React, { useEffect, useState } from 'react';
import DatePicker from './DatePicker';
import { Search } from 'lucide-react';
import { TimePeriod } from '../services/salaryService';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../services/api';
import Dropdown, { DropdownOption } from './Dropdown';
import { 
  SkeletonKPICard, 
  SkeletonAttendanceTrackerTable, 
  SkeletonSearchBar, 
  SkeletonFilterDropdown,
  LoadingState 
} from './SkeletonComponents';
import { getDropdownOptions } from '../services/dropdownService';
import { logger } from '../utils/logger';

interface AttendanceRecord {
  id: number;
  employee_id: string;
  name: string;
  department?: string;
  date: string;
  calendar_days: number;
  off_days?: number;  // NEW: Off days from backend
  total_working_days: number;
  present_days: number;
  absent_days: number;
  unmarked_days?: number;
  holiday_days?: number;
  weekly_penalty_days?: number;
  employee_weekly_rules_enabled?: boolean;
  status?: string;
  attendance_percentage?: number;
  ot_hours: string | number;
  late_minutes: number;
}

interface AggregatedRecord {
  id?: number;
  employee_id: string;
  name: string;
  department?: string;
  date?: string;
  month?: string;
  year?: number;
  calendar_days: number;
  off_days?: number;  // NEW: Off days from backend
  total_working_days: number;
  present_days: number;
  absent_days: number;
  unmarked_days?: number;
  holiday_days?: number;
  weekly_penalty_days?: number;
  employee_weekly_rules_enabled?: boolean;
  status?: string;
  attendance_percentage?: number;
  ot_hours: number;
  late_minutes: number;
}

type FilterType = TimePeriod | 'custom' | 'custom_month' | 'custom_range' | 'one_day';

const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const HRAttendanceTracker: React.FC = () => {
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [weeklyAbsentPenaltyEnabled, setWeeklyAbsentPenaltyEnabled] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<FilterType>('custom_month');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [departments, setDepartments] = useState<string[]>([]);
  
  // State for progressive loading
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [offset, setOffset] = useState<number>(0);
  const BATCH_SIZE = 30;
  
  // KPI TOTALS from backend (all data)
  const [kpiTotals, setKpiTotals] = useState<{
    total_employees: number;
    total_ot_hours: number;
    total_late_minutes: number;
    total_present_days: number;
    total_working_days: number;
    avg_attendance_percentage: number;
    absentees_count?: number;
    presentees_count?: number;
    unmarked_count?: number;
  } | null>(null);

  const filterTypeOptions: DropdownOption[] = [
    { value: 'one_day', label: 'One Day' },
    { value: 'custom_month', label: 'Custom Month' },
    { value: 'last_6_months', label: 'Last 6 Months' },
    { value: 'last_12_months', label: 'Last 12 Months' },
    { value: 'last_5_years', label: 'Last 5 Years' },
    { value: 'custom_range', label: 'Custom Range' },
    
  ];
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  // Custom range state
  const [rangeStartDate, setRangeStartDate] = useState<string>(''); // ISO string YYYY-MM-DD
  const [rangeEndDate, setRangeEndDate] = useState<string>('');
  // One day filter state
  const [selectedDate, setSelectedDate] = useState<string>(''); // ISO string YYYY-MM-DD
  const [availableMonths, setAvailableMonths] = useState<{month: string, year: number}[]>([]);
  
  // Generate years for the custom month filter (last 5 years to next year)
  const generateYears = (): number[] => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const years: number[] = [];
    
    // Generate years from 5 years ago to next year
    for (let year = currentYear - 5; year <= currentYear + 1; year++) {
      years.push(year);
    }
    
    // Sort by year (descending - most recent first)
    return years.sort((a, b) => b - a);
  };
  
  const availableYears = generateYears();
  const [attendanceStatus, setAttendanceStatus] = useState<{
    is_active: boolean;
    message: string;
    total_active_employees: number;
    employees_with_records: number;
    tracking_mode: string;
    has_daily_tracking: boolean;
  } | null>(null);
  const navigate = useNavigate();

  // Fetch departments on mount
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const options = await getDropdownOptions();
        setDepartments(options.departments || []);
      } catch (error) {
        logger.error('Error loading departments:', error);
      }
    };
    loadDepartments();
  }, []);

  // Fetch salary config to determine if penalty/bonus columns should be shown
  useEffect(() => {
    const loadSalaryConfig = async () => {
      try {
        const response = await apiCall('/api/salary-config/', { method: 'GET' });
        if (response && response.ok) {
          const data = await response.json();
          const penaltyEnabled = !!data.weekly_absent_penalty_enabled;
          setWeeklyAbsentPenaltyEnabled(penaltyEnabled);
          logger.info(`📊 Salary config loaded: penalty=${penaltyEnabled}`);
        }
      } catch (error) {
        logger.warn('Failed to load salary config for attendance tracker', error);
      }
    };
    loadSalaryConfig();
  }, []);

  // Function to get unique months from data
  const extractAvailableMonths = (data: AttendanceRecord[]) => {
    const uniqueMonths = new Set<string>();
    const months: {month: string, year: number}[] = [];

    data.forEach(record => {
      const date = new Date(record.date);
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      const key = `${month}-${year}`;
      
      if (!uniqueMonths.has(key)) {
        uniqueMonths.add(key);
        months.push({ month, year });
      }
    });

    return months.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return monthNames.indexOf(b.month) - monthNames.indexOf(a.month);
    });
  };

  // NOTE: filterAndAggregateData removed - all filtering now handled by backend

  const fetchAttendanceData = async (loadMore: boolean = false) => {
    try {
      // Show appropriate loading indicator
      if (loadMore) {
        setLoadingMore(true);
      } else {
      setLoading(true);
        setOffset(0);
      }
      
      logger.info( '🔍 Fetching attendance data for filter:', filterType);
      
      // Build query parameters for time period filtering
      const params = new URLSearchParams();
      
      // FIX: Backend expects 'custom' for both 'custom' and 'custom_month' filters
      if (filterType === 'custom_month') {
        params.append('time_period', 'custom');
      } else {
        params.append('time_period', filterType);
      }
      
      if (filterType === 'custom' && selectedMonth && selectedYear) {
        const monthIndex = monthNames.indexOf(selectedMonth) + 1;
        params.append('month', monthIndex.toString());
        params.append('year', selectedYear.toString());
      } else if (filterType === 'custom_month' && selectedMonth && selectedYear) {
        const monthIndex = monthNames.indexOf(selectedMonth) + 1;
        params.append('month', monthIndex.toString());
        params.append('year', selectedYear.toString());
        logger.info( '🔧 Custom month API params:', { month: monthIndex, year: selectedYear, selectedMonth });
      } else if (filterType === 'custom_range' && rangeStartDate && rangeEndDate) {
        params.append('start_date', rangeStartDate);
        params.append('end_date', rangeEndDate);
        params.set('time_period', 'custom_range');
        logger.info( '🔧 Custom range API params:', { start_date: rangeStartDate, end_date: rangeEndDate });
      } else if (filterType === 'one_day' && selectedDate) {
        params.append('start_date', selectedDate);
        params.append('end_date', selectedDate);
        params.set('time_period', 'custom_range');
        logger.info( '🔍 One day API call - selectedDate:', selectedDate);
      }
      
      // SMART LOADING: Progressive on cache miss, full on cache hit
      const currentOffset = loadMore ? offset : 0;
      params.append('offset', currentOffset.toString());
      params.append('limit', BATCH_SIZE.toString());
      
      logger.info( `⚡ Fetching batch: offset=${currentOffset}, limit=${BATCH_SIZE}`);
      
      // Use optimized all_records endpoint
      const url = `/api/daily-attendance/all_records/?${params.toString()}`;
      logger.info( `📡 API Call: ${url}`);
          
          const response = await apiCall(url);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch attendance data: ${response.status}`);
          }
          
          const apiResponse = await response.json();
          
      // Debug: Show response structure
      logger.info( '📊 API Response:', {
        count: apiResponse.count,
        total_count: apiResponse.total_count,
        has_more: apiResponse.has_more,
        offset: apiResponse.offset,
        records_received: apiResponse.results?.length
      });
      
      // Update progressive loading state
      setTotalCount(apiResponse.total_count || 0);
      setHasMore(apiResponse.has_more || false);
      
      // Store KPI totals from backend (for cards) - update on every response
      // These totals are calculated from ALL records, not just the paginated subset
      if (apiResponse.kpi_totals) {
        setKpiTotals(apiResponse.kpi_totals);
        if (!loadMore) {
          logger.info( '📊 KPI Totals from backend:', apiResponse.kpi_totals);
        }
      }
      
      const newRecords = apiResponse.results || [];
      
      // Debug: Check for penalty/bonus days in the response
      const recordsWithPenalty = newRecords.filter((r: any) => r.weekly_penalty_days > 0);
      if (recordsWithPenalty.length > 0) {
        logger.info(`📊 Found ${recordsWithPenalty.length} records with penalty days`);
      }
      
      const transformedData: AttendanceRecord[] = transformStandardToAttendanceRecords(newRecords);
      
      // Check if backend served from cache
      const isFromCache = apiResponse.performance?.cached || false;
      const cacheSource = apiResponse.performance?.data_source || 'unknown';
      
      // Append or replace data based on loadMore
      if (loadMore) {
        const updatedData = [...attendanceData, ...transformedData];
        setAttendanceData(updatedData);
        setOffset(currentOffset + BATCH_SIZE);
        logger.info( `⚡ Loaded ${transformedData.length} more records. Total: ${updatedData.length}/${apiResponse.total_count}`);
      } else {
        setAttendanceData(transformedData);
        setOffset(BATCH_SIZE);
        logger.info( `✅ Initial load: ${transformedData.length} records of ${apiResponse.total_count} total`);
        logger.info( `📦 Cache status: ${isFromCache ? 'HIT' : 'MISS'} (${cacheSource})`);
        
        // Extract available months
        const months = extractAvailableMonths(transformedData);
        setAvailableMonths(months);
        
        // SMART LOADING: If cache hit AND has more data, fetch all remaining at once
        if (isFromCache && apiResponse.has_more && apiResponse.total_count > BATCH_SIZE) {
          logger.info( `🚀 Cache hit detected! Fetching all remaining ${apiResponse.total_count - BATCH_SIZE} records...`);
          setTimeout(() => {
            fetchRemainingRecords(BATCH_SIZE, apiResponse.total_count);
          }, 100);
        }
      }
      
      // Set attendance status
      if (apiResponse.total_count > 0) {
        setAttendanceStatus({
          is_active: true,
          message: 'Attendance tracking is active',
          total_active_employees: apiResponse.total_count,
          employees_with_records: apiResponse.total_count,
          tracking_mode: 'monthly_summary',
          has_daily_tracking: true
        });
      }
      
      setError(null);
      
      // If no records found
      if (transformedData.length === 0) {
        let errorMessage = 'No attendance data available yet';
        if (filterType === 'custom_range' && rangeStartDate && rangeEndDate) {
          errorMessage = `No attendance data found for the selected date range (${rangeStartDate} to ${rangeEndDate}). Please check if daily attendance data has been uploaded for this period.`;
        } else if (filterType === 'custom_month' && selectedMonth && selectedYear) {
          errorMessage = `No attendance data found for ${selectedMonth} ${selectedYear}. Please check if daily attendance data has been uploaded for this month.`;
        }
        
        setError(errorMessage);
        setAttendanceData([]);
        setAttendanceStatus({
          is_active: false,
          message: 'Attendance tracking will be available once data is uploaded',
          total_active_employees: 0,
          employees_with_records: 0,
          tracking_mode: 'none',
          has_daily_tracking: false
        });
        return;
      }
      
    } catch (err) {
      logger.error('Error loading attendance data:', err);
      setError('Failed to load attendance data');
      setAttendanceData([]);
      setAttendanceStatus({
        is_active: false,
        message: 'Failed to load attendance data',
        total_active_employees: 0,
        employees_with_records: 0,
        tracking_mode: 'error',
        has_daily_tracking: false
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Fetch all remaining records in one call (used when cache hit detected)
  const fetchRemainingRecords = async (currentOffset: number, totalRecords: number) => {
    try {
      setLoadingMore(true);
      
      // Build same query parameters as original request
      const params = new URLSearchParams();
      params.append('time_period', filterType);
      
      if (filterType === 'custom' && selectedMonth && selectedYear) {
        const monthIndex = monthNames.indexOf(selectedMonth) + 1;
        params.append('month', monthIndex.toString());
        params.append('year', selectedYear.toString());
      } else if (filterType === 'custom_month' && selectedMonth && selectedYear) {
        const monthIndex = monthNames.indexOf(selectedMonth) + 1;
        params.append('month', monthIndex.toString());
        params.append('year', selectedYear.toString());
      } else if (filterType === 'custom_range' && rangeStartDate && rangeEndDate) {
        params.append('start_date', rangeStartDate);
        params.append('end_date', rangeEndDate);
        params.set('time_period', 'custom_range');
      } else if (filterType === 'one_day' && selectedDate) {
        params.append('start_date', selectedDate);
        params.append('end_date', selectedDate);
        params.set('time_period', 'custom_range');
      }
      
      // Fetch ALL remaining records in one call
      params.append('offset', currentOffset.toString());
      params.append('limit', '0'); // 0 = fetch all remaining
      
      const url = `/api/daily-attendance/all_records/?${params.toString()}`;
      logger.info( `📡 Fetching remaining records: ${url}`);
      
      const response = await apiCall(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch remaining data: ${response.status}`);
      }
      
      const apiResponse = await response.json();
      const newRecords = apiResponse.results || [];
      const transformedData = transformStandardToAttendanceRecords(newRecords);
      
      // CRITICAL: When limit=0, backend returns ALL records from start (offset=0)
      // So we should REPLACE the data, not append, to avoid duplicates
      // Check if backend returned all records (offset=0 and count matches total_count)
      if (apiResponse.offset === 0 && apiResponse.count === apiResponse.total_count) {
        // Backend returned all records from the beginning, replace data
        setAttendanceData(transformedData);
        logger.info( `✅ Replaced with all ${transformedData.length} records from cache (limit=0 returned full dataset)!`);
      } else {
        // Append remaining data (pagination case)
        setAttendanceData(prev => [...prev, ...transformedData]);
        logger.info( `✅ Appended ${transformedData.length} more records from cache!`);
      }
      
      setHasMore(false);
      setOffset(totalRecords);
      logger.info( `📦 Total loaded: ${transformedData.length}/${totalRecords}`);
      
    } catch (error) {
      logger.error('Error fetching remaining records:', error);
      // Fall back to progressive loading
      setHasMore(true);
    } finally {
      setLoadingMore(false);
    }
  };

  // AUTO-LOAD: For cache miss, progressively load next batch
  useEffect(() => {
    if (hasMore && !loading && !loadingMore && attendanceData.length > 0) {
      const timer = setTimeout(() => {
        logger.info( `⚡ Progressive loading: ${attendanceData.length}/${totalCount}`);
        fetchAttendanceData(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, loadingMore, attendanceData.length]);

  // Standard periods - Backend handles filtering (already cached for 10 min)
  useEffect(() => {
    if (['last_6_months', 'last_12_months', 'last_5_years'].includes(filterType)) {
      logger.info( `📡 Fetching ${filterType} data from API (backend-cached for 10 min)`);
      fetchAttendanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  // Custom single month
  useEffect(() => {
    if (filterType === 'custom' && selectedMonth && selectedYear) {
      fetchAttendanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, selectedMonth, selectedYear]);

  // Auto-select current month when custom_month filter is selected
  useEffect(() => {
    if (filterType === 'custom_month' && (!selectedMonth || !selectedYear)) {
      const now = new Date();
      const currentMonth = monthNames[now.getMonth()];
      const currentYear = now.getFullYear();
      logger.info( '🔧 Auto-selecting current month:', currentMonth, currentYear);
      setSelectedMonth(currentMonth);
      setSelectedYear(currentYear);
    }
  }, [filterType]);

  // Custom month filter - Backend handles filtering (already cached for 10 min)
  useEffect(() => {
    if (filterType === 'custom_month' && selectedMonth && selectedYear) {
      logger.info( `📡 Fetching ${selectedMonth} ${selectedYear} data from API (backend-cached)`);
      fetchAttendanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, selectedMonth, selectedYear]);

  // Custom range
  useEffect(() => {
    if (filterType === 'custom_range' && rangeStartDate && rangeEndDate) {
      logger.info( '🔧 Custom range filter triggered:', { rangeStartDate, rangeEndDate });
      fetchAttendanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, rangeStartDate, rangeEndDate]);

  // One day filter
  useEffect(() => {
    if (filterType === 'one_day' && selectedDate) {
      fetchAttendanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, selectedDate]);

  // Listen for data changes and refresh attendance data
  useEffect(() => {
    const handleDataChange = (event: Event) => {
      logger.info( '🔄 Data change detected in HRAttendanceTracker, refreshing attendance data');
      logger.info( '🔄 Event type:', event.type);
      logger.info( '🔄 Event detail:', (event as CustomEvent).detail);
      fetchAttendanceData();
    };

    // Listen for custom events that indicate data changes
    window.addEventListener('dataUploaded', handleDataChange);
    window.addEventListener('employeeAdded', handleDataChange);
    window.addEventListener('attendanceUpdated', handleDataChange);

    return () => {
      window.removeEventListener('dataUploaded', handleDataChange);
      window.removeEventListener('employeeAdded', handleDataChange);
      window.removeEventListener('attendanceUpdated', handleDataChange);
    };
  }, []);

  // Utility functions
  const normalizeDepartment = (dept: string | undefined) => (dept && dept.trim() !== '' && dept !== '0') ? dept : 'N/A';

  const cleanEmployeeName = (name: string) => {
    if (!name) return 'Unknown';
    // Remove 'nan' and extra spaces, then trim
    return name.replace(/\bnan\b/g, '').replace(/\s+/g, ' ').trim() || 'Unknown';
  };

  // Filter data based on search query and department
  const filteredBySearch = attendanceData.filter(record => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        record.name.toLowerCase().includes(query) ||
        record.employee_id.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    
    // Department filter
    if (selectedDepartment && selectedDepartment !== 'all') {
      const recordDept = normalizeDepartment(record.department);
      if (recordDept !== selectedDepartment) return false;
    }
    
    return true;
  });

  // Transform standard API response to AttendanceRecord format
  const transformStandardToAttendanceRecords = (attendanceRecords: Array<any>): AttendanceRecord[] => {
    // The standard API returns attendance records with various field names
    return attendanceRecords.map((record) => ({
      id: record.id,
      employee_id: record.employee_id,
      // Handle both 'name' and 'employee_name' fields
      name: cleanEmployeeName(record.name || record.employee_name || 'Unknown'),
      department: record.department,
      date: record.date,
      calendar_days: record.calendar_days || 0,
      off_days: record.off_days || 0,  // NEW: Use off_days from backend
      total_working_days: record.total_working_days || 30,
      present_days: record.present_days || 0,
      absent_days: record.absent_days || 0,
      unmarked_days: record.unmarked_days || 0,
      holiday_days: record.holiday_days || 0,
      weekly_penalty_days: record.weekly_penalty_days || 0,  // NEW: Include penalty days
      status: record.status || record.attendance_status,
      // Handle both 'ot_hours' and 'total_ot_hours'
      ot_hours: record.ot_hours || record.total_ot_hours || 0,
      // Handle both 'late_minutes' and 'total_late_minutes'
      late_minutes: record.late_minutes || record.total_late_minutes || 0,
      attendance_percentage: record.attendance_percentage
    }));
  };

  // Backend already aggregates data - use directly (no client-side aggregation needed)
  const finalData: AggregatedRecord[] = filteredBySearch.map(record => ({
    id: record.id,
    employee_id: record.employee_id,
    name: record.name,
      department: record.department,
      date: record.date,
      calendar_days: record.calendar_days,
      off_days: record.off_days || 0,  // NEW: Use off_days from backend
      total_working_days: record.total_working_days,
      present_days: record.present_days,
      absent_days: record.absent_days,
      unmarked_days: record.unmarked_days || 0,
      holiday_days: record.holiday_days || 0,
      weekly_penalty_days: record.weekly_penalty_days || 0,  // NEW: Include penalty days
      status: record.status,
    attendance_percentage: record.attendance_percentage,
    ot_hours: typeof record.ot_hours === 'string' ? parseFloat(record.ot_hours) || 0 : record.ot_hours || 0,
    late_minutes: record.late_minutes
  }));

  // KPI calculations - USE BACKEND TOTALS when available (shows all data)
  // Otherwise calculate from displayed data (for search/filters)
  const isFiltered = searchQuery !== '' || selectedDepartment !== 'all';
  
  const totalEmployees = kpiTotals && !isFiltered 
    ? kpiTotals.total_employees 
    : finalData.length;
    
  const totalOtHours = kpiTotals && !isFiltered 
    ? kpiTotals.total_ot_hours 
    : finalData.reduce((sum, r) => sum + (typeof r.ot_hours === 'string' ? parseFloat(r.ot_hours) || 0 : r.ot_hours), 0);
    
  const totalLateMinutes = kpiTotals && !isFiltered 
    ? kpiTotals.total_late_minutes 
    : finalData.reduce((sum, r) => sum + r.late_minutes, 0);
    
  const totalPresentDays = kpiTotals && !isFiltered 
    ? kpiTotals.total_present_days 
    : finalData.reduce((sum, r) => sum + r.present_days, 0);
    
  const totalWorkingDaysAgg = kpiTotals && !isFiltered 
    ? kpiTotals.total_working_days 
    : finalData.reduce((sum, r) => sum + (r.total_working_days || 0), 0);
    
  const avgPresentPerc = kpiTotals && !isFiltered 
    ? kpiTotals.avg_attendance_percentage 
    : (totalWorkingDaysAgg > 0 ? (totalPresentDays / totalWorkingDaysAgg) * 100 : 0);
    
  // Calculate average working days and average present days
  const avgWorkingDays = totalEmployees > 0 
    ? totalWorkingDaysAgg / totalEmployees 
    : 0;
    
  const avgPresentDays = totalEmployees > 0 
    ? totalPresentDays / totalEmployees 
    : 0;

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isHRManager = user?.role === 'hr_manager' || user?.role === 'hr-manager';
  const isPayrollMaster = user?.role === 'payroll_master';
  const isAdmin = user?.role === 'admin' || user?.is_admin || user?.is_superuser;
  const canViewEmployeeDetails = isAdmin || isPayrollMaster; // Admin and Payroll Master can view employee details

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="flex items-center justify-between">
        {loading ? (
          <div className="flex items-center gap-3">
            <SkeletonSearchBar />
            <SkeletonFilterDropdown />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0B5E59]"
              />
            </div>
            <Dropdown
              options={[
                { value: 'all', label: 'All Departments' },
                ...departments.map(dept => ({
                  value: dept,
                  label: dept
                }))
              ]}
              value={selectedDepartment}
              onChange={(value) => setSelectedDepartment(value)}
              placeholder="Department"
              className="w-48"
            />
          </div>
        )}
        
        <div className="flex items-center gap-3">
          {loading ? (
            <SkeletonFilterDropdown />
          ) : (
            <Dropdown
              options={filterTypeOptions}
              value={filterType}
              onChange={(value) => setFilterType(value as FilterType)}
              placeholder="Select Filter"
              className="w-40"
            />
          )}

          {filterType === 'custom' && (
            <Dropdown
              options={availableMonths.map(({ month, year }) => ({
                value: `${month}-${year}`,
                label: `${month} ${year}`
              }))}
              value={`${selectedMonth}-${selectedYear}`}
              onChange={(value) => {
                const [month, year] = value.split('-');
                setSelectedMonth(month);
                setSelectedYear(parseInt(year));
              }}
              placeholder="Select Month"
              className="w-32"
            />
          )}

          {filterType === 'custom_month' && (
            <div className="flex items-center gap-2">
              <Dropdown
                options={availableYears.map(year => ({
                  value: year.toString(),
                  label: year.toString()
                }))}
                value={selectedYear.toString()}
                onChange={(value) => {
                  logger.info( '🔧 Year changed to:', value);
                  setSelectedYear(parseInt(value));
                  // Reset month when year changes
                  setSelectedMonth('');
                }}
                placeholder="Select Year"
                className="w-24"
              />
              <Dropdown
                options={monthNames.map(month => ({
                  value: month,
                  label: month
                }))}
                value={selectedMonth}
                onChange={(value) => {
                  logger.info( '🔧 Month changed to:', value);
                  setSelectedMonth(value);
                }}
                placeholder="Select Month"
                className="w-24"
              />
            </div>
          )}

          {/* Custom date range picker */}
          {filterType === 'custom_range' && (
            <div className="flex items-center gap-2">
              <DatePicker
                value={rangeStartDate}
                onChange={(date) => {
                  logger.info( '🔧 Custom range start date changed:', date);
                  setRangeStartDate(date);
                }}
                maxDate={rangeEndDate ? new Date(rangeEndDate) : new Date()}
                placeholder="Start date"
                className="w-36"
              />
              <span className="text-gray-500">to</span>
              <DatePicker
                value={rangeEndDate}
                onChange={(date) => {
                  logger.info( '🔧 Custom range end date changed:', date);
                  setRangeEndDate(date);
                }}
                minDate={rangeStartDate ? new Date(rangeStartDate) : undefined}
                maxDate={new Date()}
                placeholder="End date"
                className="w-36"
                alignRight={true}
              />
            </div>
          )}

          {/* One day date picker */}
          {filterType === 'one_day' && (
            <div className="flex items-center gap-2">
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                maxDate={new Date()}
                placeholder="Select date"
                className="w-36"
                alignRight={true}
              />
            </div>
          )}

          
        </div>
      </div>

      

      {/* KPI Section */}
      <div className="grid grid-cols-6 gap-4">
        {loading ? (
          <>
            <SkeletonKPICard />
            <SkeletonKPICard />
            <SkeletonKPICard />
            <SkeletonKPICard />
            <SkeletonKPICard />
            <SkeletonKPICard />
          </>
        ) : filterType === 'one_day' ? (
          <>
            <div className="bg-white shadow rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500">Total Employees</div>
              <div className="text-2xl font-semibold text-[#0B5E59]">
                {kpiTotals && !isFiltered ? kpiTotals.total_employees : totalEmployees}
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500">Present</div>
              <div className="text-2xl font-semibold text-green-600">
                {kpiTotals && !isFiltered && kpiTotals.presentees_count !== undefined
                  ? kpiTotals.presentees_count
                  : finalData.filter(r => r.present_days > 0).length}
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500">Absent</div>
              <div className="text-2xl font-semibold text-red-600">
                {kpiTotals && !isFiltered && kpiTotals.absentees_count !== undefined
                  ? kpiTotals.absentees_count
                  : finalData.filter(r => r.absent_days > 0).length}
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500">Selected Date</div>
              <div className="text-2xl font-semibold text-[#0B5E59]">{selectedDate ? new Date(selectedDate).toLocaleDateString() : 'N/A'}</div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white shadow rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500">Total Employees</div>
              <div className="text-2xl font-semibold text-[#0B5E59]">{totalEmployees}</div>
            </div>
            <div className="bg-white shadow rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500">Total OT Hours</div>
              <div className="text-2xl font-semibold text-[#0B5E59]">{totalOtHours.toFixed(1)}</div>
            </div>
            <div className="bg-white shadow rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500">Total Late Minutes</div>
              <div className="text-2xl font-semibold text-[#0B5E59]">{totalLateMinutes}</div>
            </div>
            <div className="bg-white shadow rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500">Average Working Days</div>
              <div className="text-2xl font-semibold text-[#0B5E59]">{avgWorkingDays.toFixed(1)}</div>
            </div>
            <div className="bg-white shadow rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500">Average Present Days</div>
              <div className="text-2xl font-semibold text-[#0B5E59]">{avgPresentDays.toFixed(1)}</div>
            </div>
            <div className="bg-white shadow rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500">Average Present %</div>
              <div className="text-2xl font-semibold text-[#0B5E59]">{`${avgPresentPerc.toFixed(1)}%`}</div>
            </div>
          </>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonAttendanceTrackerTable rows={8} isOneDay={filterType === 'one_day'} />
      ) : error ? (
        <div className="bg-white rounded-lg border border-gray-200">
          <LoadingState message={error} showSpinner={false} />
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3 bg-gray-50">Employee ID</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3 bg-gray-50">Name</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3 bg-gray-50">Department</th>
                  {filterType === 'one_day' ? (
                    <>
                      <th className="text-left text-sm font-medium text-gray-600 px-4 py-3 bg-gray-50">Status</th>
                      <th className="text-left text-sm font-medium text-gray-600 px-4 py-3 bg-gray-50">OT Hours</th>
                      <th className="text-left text-sm font-medium text-gray-600 px-4 py-3 bg-gray-50">Late Minutes</th>
                    </>
                  ) : (
                    <>
                      <th className="text-left text-sm font-medium text-gray-600 px-4 py-3 bg-gray-50">Total Days</th>
                      <th className="text-left text-sm font-medium text-gray-600 px-4 py-3 bg-gray-50">Off Days</th>
                      <th className="text-left text-sm font-medium text-gray-600 px-4 py-3 bg-gray-50">Holidays</th>
                      <th className="text-left text-sm font-medium text-gray-600 px-4 py-3 bg-gray-50">Total Working Days</th>
                      <th className="text-left text-sm font-medium text-gray-600 px-4 py-3 bg-gray-50">Present Days</th>
                      <th className="text-left text-sm font-medium text-gray-600 px-4 py-3 bg-gray-50">Absent Days</th>
                      <th className="text-left text-sm font-medium text-gray-600 px-4 py-3 bg-gray-50">Unmarked Days</th>
                      {weeklyAbsentPenaltyEnabled && (
                        <th className="text-left text-sm font-medium text-gray-600 px-4 py-3 bg-gray-50">Penalty Days</th>
                      )}
                      <th className="text-left text-sm font-medium text-gray-600 px-4 py-3 bg-gray-50">OT Hours</th>
                      <th className="text-left text-sm font-medium text-gray-600 px-4 py-3 bg-gray-50">Late Minutes</th>
                      <th className="text-left text-sm font-medium text-gray-600 px-4 py-3 bg-gray-50">Attendance %</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {finalData.length === 0 ? (
                  <tr>
                    <td colSpan={filterType === 'one_day' ? 6 : (14 + (weeklyAbsentPenaltyEnabled ? 1 : 0))} className="px-4 py-6 text-center text-gray-500">
                      {filterType === 'one_day' 
                        ? 'No attendance records found for the selected date.' 
                        : attendanceStatus?.is_active 
                          ? 'No attendance records found.' 
                          : 'Attendance tracking will be available from June 22, 2025.'
                      }
                    </td>
                  </tr>
                ) : (
                  finalData.map((record, index) => {
                    // Use totals provided by the backend; avoid client-side recomputation where data exists
                    const totalWorkingDays = record.total_working_days ?? 0;
                    const calendarDays = record.calendar_days ?? 0;
                    const holidayDays = record.holiday_days ?? 0;
                    const absentDays = record.absent_days ?? Math.max(0, totalWorkingDays - (record.present_days ?? 0));
                    const unmarkedDays = record.unmarked_days ?? 0;
                    const offDays = record.off_days ?? 0;  // Use off_days from backend
                    const presentDays = record.present_days ?? 0;
                    const attendancePercentage = totalWorkingDays > 0 
                      ? (presentDays / totalWorkingDays) * 100 
                      : 0;
                    
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{record.employee_id}</td>
                        <td className="px-4 py-3 text-sm">
                          {isHRManager && !canViewEmployeeDetails ? (
                            <span className="text-black">{record.name}</span>
                          ) : (
                            <button
                              onClick={() => navigate(`/hr-management/directory/${record.employee_id}`)}
                              className="text-[#0B5E59] hover:underline text-left"
                            >
                              {record.name}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{normalizeDepartment(record.department)}</td>
                        {filterType === 'one_day' ? (
                          <>
                            <td className="px-4 py-3 text-sm">
                              {(() => {
                                const status = (record.status || (record.present_days > 0 ? 'present' : (absentDays > 0 ? 'absent' : 'unknown'))).toLowerCase();
                                if (status === 'present') {
                                  return (
                                    <span className="px-3 py-1 rounded text-xs font-medium bg-teal-100 text-teal-800 border border-teal-700 capitalize">
                                      {status}
                                    </span>
                                  );
                                } else if (status === 'absent') {
                                  return (
                                    <span className="px-3 py-1 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-700 capitalize">
                                      {status}
                                    </span>
                                  );
                                } else if (status === 'off') {
                                  return (
                                    <span className="px-3 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-teal-700 capitalize">
                                      {status}
                                    </span>
                                  );
                                } else {
                                  return (
                                    <span className="px-3 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300 capitalize">
                                      {status}
                                    </span>
                                  );
                                }
                              })()}
                            </td>
                            <td className="px-4 py-3 text-sm">{(typeof record.ot_hours === 'string' ? parseFloat(record.ot_hours) || 0 : record.ot_hours || 0).toFixed(1)}</td>
                            <td className="px-4 py-3 text-sm">{record.late_minutes.toFixed(0)}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-sm">{calendarDays}</td>
                            <td className="px-4 py-3 text-sm">{offDays}</td>
                            <td className="px-4 py-3 text-sm">{holidayDays}</td>
                            <td className="px-4 py-3 text-sm">{totalWorkingDays.toFixed(0)}</td>
                            <td className="px-4 py-3 text-sm">{record.present_days.toFixed(1)}</td>
                            <td className="px-4 py-3 text-sm">{absentDays.toFixed(1)}</td>
                            <td className="px-4 py-3 text-sm">{unmarkedDays}</td>
                            {weeklyAbsentPenaltyEnabled && (
                              <td className="px-4 py-3 text-sm">
                                {(record as any).employee_weekly_rules_enabled === false ? 'NA' : (record.weekly_penalty_days || 0).toFixed(1)}
                              </td>
                            )}
                            <td className="px-4 py-3 text-sm">{(typeof record.ot_hours === 'string' ? parseFloat(record.ot_hours) || 0 : record.ot_hours || 0).toFixed(1)}</td>
                            <td className="px-4 py-3 text-sm">{record.late_minutes.toFixed(0)}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 rounded text-xs ${
                                attendancePercentage >= 90 ? 'bg-teal-100 text-teal-800' :
                                attendancePercentage >= 75 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {attendancePercentage.toFixed(1)}%
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* PROGRESSIVE LOADING: Silent background loading indicator */}
          {loadingMore && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
              <span>Loading more employees... ({attendanceData.length} of {totalCount})</span>
            </div>
          )}
          
          {/* Show completion message when all loaded */}
          {!hasMore && !loading && !loadingMore && attendanceData.length > 0 && totalCount > BATCH_SIZE && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-lg text-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">✓ All {totalCount} employees loaded</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HRAttendanceTracker;