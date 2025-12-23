import React, { useState, useEffect, useCallback } from 'react';
import { Save, Search, UserCheck, UserX, Loader2, AlertCircle, Calendar, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../services/api';
import DatePicker from './DatePicker';
import './TimeInput.css';
import Dropdown from './Dropdown';
import { logger } from '../utils/logger';
import PenaltyRevertModal from './PenaltyRevertModal';
import { 
  SkeletonAttendanceLogTable, 
  SkeletonSearchBar, 
  SkeletonFilterDropdown,
  SkeletonStatsBar,
  SkeletonDatePicker,
  SkeletonButton,
  ProgressiveLoadingIndicator,
  LoadingState 
} from './SkeletonComponents';

// Import SkeletonBase for inline usage
const SkeletonBase: React.FC<{ className?: string; children?: React.ReactNode }> = ({ 
  className = '', 
  children 
}) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`}>
    {children}
  </div>
);

interface Employee {
  id: number;
  employee_id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email: string;
  department: string;
  is_active: boolean;
  shift_start_time?: string;
  shift_end_time?: string;
  default_status?: string;
  late_minutes?: number;
  ot_hours?: number;
  has_off_day?: boolean;
  off_monday?: boolean;
  off_tuesday?: boolean;
  off_wednesday?: boolean;
  off_thursday?: boolean;
  off_friday?: boolean;
  off_saturday?: boolean;
  off_sunday?: boolean;
  current_attendance?: {
    status: string;
    ot_hours: number;
    late_minutes: number;
    check_in?: string;
    check_out?: string;
  };
}

interface AttendanceEntry {
  employee_id: string;
  name: string;
  department: string;
  status: 'present' | 'absent' | 'off' | 'unmarked';
  clock_in: string;   // HH:MM
  clock_out: string;  // HH:MM
  ot_hours: number;
  late_minutes: number;
  has_off_day: boolean;
  sunday_bonus?: boolean; // Indicates this present day is a Sunday bonus
  weeklyAttendance: { [day: string]: boolean }; // Example: { M: true, T: false, W: true, ... }
  autoMarkedReasons?: { [day: string]: string | null }; // Reasons for auto-marked days
  weekly_penalty_days?: number; // Weekly penalty days for the week
  employee_off_days?: { [day: string]: boolean }; // Employee off day configuration
  _shiftStart?: string;
  _shiftEnd?: string;
  _prevClockIn?: string;
  _prevClockOut?: string;
  _prevOt?: number;
  _prevLate?: number;
}

const HRAttendanceLog: React.FC = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isHRManager = user?.role === 'hr_manager' || user?.role === 'hr-manager';
  const isPayrollMaster = user?.role === 'payroll_master';
  const isAdmin = user?.role === 'admin' || user?.is_admin || user?.is_superuser;
  const canViewEmployeeDetails = isAdmin || isPayrollMaster; // Admin and Payroll Master can view employee details
  const navigate = useNavigate();
  // (employees state not used anymore)
  const [attendanceEntries, setAttendanceEntries] = useState<Map<string, AttendanceEntry>>(new Map());
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [eligibleEmployees, setEligibleEmployees] = useState<Employee[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [dayName, setDayName] = useState<string>('');
  const [dateLoading, setDateLoading] = useState<boolean>(false);
  const [attendanceDates, setAttendanceDates] = useState<string[]>([]);
  const [progressiveLoadingComplete, setProgressiveLoadingComplete] = useState<boolean>(false); // Track if all loading is complete
  const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false); // Track if initial load is complete
  const [hasExcelAttendance, setHasExcelAttendance] = useState<boolean>(false); // Track if Excel attendance exists for this month
  const [isHoliday, setIsHoliday] = useState<boolean>(false); // Track if selected date is a holiday
  const [holidayInfo, setHolidayInfo] = useState<{name: string; description?: string; type: string} | null>(null); // Holiday information
  
  // Infinite scrolling state (like attendance tracker)
  const [displayedCount, setDisplayedCount] = useState<number>(30); // Number of employees to display
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const INITIAL_DISPLAY_COUNT = 30;
  const LOAD_MORE_COUNT = 30;
  // Tenant-configured weekly absent threshold (null until fetched)
  const [weeklyAbsentThreshold, setWeeklyAbsentThreshold] = useState<number | null>(null);

  // Add cache and request tracking to prevent duplicate calls
  const [cache, setCache] = useState<Map<string, { data: Employee[]; dayName: string; hasExcelAttendance: boolean; timestamp: number }>>(new Map());
  const [ongoingRequests, setOngoingRequests] = useState<Set<string>>(new Set());
  
  // Holiday cache with 1-hour expiration
  const [holidayCache, setHolidayCache] = useState<Map<string, { isHoliday: boolean; holidayInfo: {name: string; description?: string; type: string} | null; timestamp: number }>>(new Map());
  
  // Penalty revert modal state
  const [penaltyModalOpen, setPenaltyModalOpen] = useState<boolean>(false);
  const [selectedPenaltyEmployee, setSelectedPenaltyEmployee] = useState<{
    employeeId: string;
    employeeName: string;
    weeklyAttendance: { [day: string]: boolean };
    penaltyDayCode?: string;
    penaltyWeekStart?: string;
    initialPenaltyIgnored?: boolean;
  } | null>(null);
  // Track chips whose penalty was reverted (employeeId-dayCode)
  const [revertedPenaltyChips, setRevertedPenaltyChips] = useState<Set<string>>(new Set());
  
  // Cache invalidation function
  const invalidateCache = () => {
    logger.info( '🗑️ Invalidating cache due to data changes');
    setCache(new Map());
    setOngoingRequests(new Set());
  };
  
  // Holiday cache invalidation function
  const invalidateHolidayCache = () => {
    logger.info( '🗑️ Invalidating holiday cache due to holiday changes');
    setHolidayCache(new Map());
  };
  
  // Check if cache is stale (older than 5 minutes for employee data)
  const isCacheStale = (timestamp: number) => {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    return (now - timestamp) > fiveMinutes;
  };
  
  // Check if holiday cache is stale (older than 1 hour)
  const isHolidayCacheStale = (timestamp: number) => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
    return (now - timestamp) > oneHour;
  };

  // Function to fetch dates with attendance logged
  const fetchAttendanceDates = async () => {
    logger.info( '🔍 fetchAttendanceDates function called!');
    try {
      logger.info( '🔍 Fetching attendance dates...');
      logger.info( '🔍 API URL:', '/api/attendance/dates_with_attendance/');
      logger.info( '🔍 Auth token:', localStorage.getItem('access'));
      logger.info( '🔍 Tenant subdomain:', localStorage.getItem('tenantSubdomain'));
      
      // Check if user is authenticated
      const token = localStorage.getItem('access');
      if (!token) {
        logger.error('❌ No authentication token found');
        // Set empty array as fallback
        setAttendanceDates([]);
        return;
      }
      
      const response = await apiCall('/api/attendance/dates_with_attendance/');
      logger.info( '📡 API Response status:', response.status);
      logger.info( '📡 API Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        logger.info( '📅 Attendance dates received:', data.dates);
        logger.info( '📅 Full response data:', data);
        setAttendanceDates(data.dates || []);
      } else {
        logger.error('❌ Failed to fetch attendance dates:', response.status);
        const errorText = await response.text();
        logger.error('❌ Error response:', errorText);
        // Set empty array as fallback
        setAttendanceDates([]);
      }
    } catch (error) {
      logger.error('Error fetching attendance dates:', error);
      // Set empty array as fallback
      setAttendanceDates([]);
    }
  };

  // Handle department changes when eligibleEmployees change
  useEffect(() => {
    // If the currently selected department is no longer present in eligible employees, reset to 'All'
    const departments = new Set(eligibleEmployees.map(e => e.department || 'General'));
    if (selectedDepartment !== 'All' && !departments.has(selectedDepartment)) {
      setSelectedDepartment('All');
    }
  }, [eligibleEmployees, selectedDepartment]);

  // Reset states when loading starts
  useEffect(() => {
    if (loading) {
      setInitialLoadComplete(false);
    }
  }, [loading]);

  // Fetch attendance dates on component mount
  useEffect(() => {
    logger.info( '🚀 Component mounted, fetching attendance dates...');
    logger.info( '🚀 About to call fetchAttendanceDates...');
    fetchAttendanceDates();
    logger.info( '🚀 fetchAttendanceDates called');
  }, []);

  // Listen for data changes and invalidate cache
  // Note: This useEffect is moved after fetchWeeklyAttendance definition to avoid hoisting issues

  // Debug attendance dates state
  useEffect(() => {
    logger.info( '📊 Attendance dates state updated:', attendanceDates);
  }, [attendanceDates]);

  // Check if selected date is a holiday (with caching)
  const checkIfHoliday = async (date: string) => {
    // Check cache first
    const cached = holidayCache.get(date);
    if (cached && !isHolidayCacheStale(cached.timestamp)) {
      logger.info(`📋 Using cached holiday data for ${date}`);
      setIsHoliday(cached.isHoliday);
      setHolidayInfo(cached.holidayInfo);
      return;
    }

    try {
      logger.info(`🔍 Fetching holiday data for ${date}`);
      const response = await apiCall(`/api/holidays/check_date/?date=${date}`);
      if (response.ok) {
        const data = await response.json();
        const holidayData = {
          isHoliday: data.is_holiday,
          holidayInfo: data.is_holiday ? data.holiday : null,
          timestamp: Date.now()
        };
        
        // Cache the result
        setHolidayCache(prev => new Map(prev).set(date, holidayData));
        
        setIsHoliday(data.is_holiday);
        setHolidayInfo(data.holiday || null);
      } else {
        setIsHoliday(false);
        setHolidayInfo(null);
      }
    } catch (err) {
      console.error('Failed to check holiday:', err);
      setIsHoliday(false);
      setHolidayInfo(null);
    }
  };

  // Handle date change with loading state
  const handleDateChange = async (newDate: string) => {
    setDateLoading(true);
    // Invalidate cache for the old date to ensure fresh data for new date
    invalidateCache();
    // Clear attendance entries to prevent old weekly data from showing
    setAttendanceEntries(new Map());
    setSelectedDate(newDate);
    setHasExcelAttendance(false); // Reset Excel attendance flag when date changes
    setDisplayedCount(INITIAL_DISPLAY_COUNT); // Reset displayed count on date change
    setHasMore(false); // Reset hasMore on date change
    setIsHoliday(false); // Reset holiday flag
    setHolidayInfo(null); // Reset holiday info
    // Check if date is a holiday
    await checkIfHoliday(newDate);
  };

  useEffect(() => {
    // Add abort controller to prevent duplicate requests
    const abortController = new AbortController();

    const loadData = async () => {
      // Check if date is a holiday
      await checkIfHoliday(selectedDate);
      await fetchEligibleEmployees(abortController.signal);
      setDateLoading(false);
    };

    loadData();

    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Load weekly absent threshold from HR Settings (salary config)
  useEffect(() => {
    (async () => {
      try {
        const resp = await apiCall('/api/salary-config/');
        const config = resp && resp.ok ? await resp.json() : null;
        const threshold = (config as any)?.weekly_absent_threshold;
        if (typeof threshold === 'number' && threshold >= 2 && threshold <= 7) {
          setWeeklyAbsentThreshold(threshold);
        }
      } catch (err) {
        logger.warn('Failed to load salary config for attendance log; weekly threshold unavailable', err);
      }
    })();
  }, []);

  // PROGRESSIVE LOADING: Fetch employees with automatic background loading
  const fetchEligibleEmployees = async (signal?: AbortSignal) => {
    const cacheKey = `eligible-employees-${selectedDate}`;

    // Check cache first
    if (cache.has(cacheKey)) {
      const cachedData = cache.get(cacheKey);
      if (cachedData && !isCacheStale(cachedData.timestamp)) {
        logger.info( '📋 Using cached data for', selectedDate);
        setEligibleEmployees(cachedData.data);
        setDayName(cachedData.dayName);
        setHasExcelAttendance(cachedData.hasExcelAttendance || false); // Use cached Excel attendance flag
        initializeAttendanceEntries(cachedData.data);
        setLoading(false);
        setInitialLoadComplete(true);
        // Reset infinite scrolling state for cached data
        setTotalCount(cachedData.data.length);
        setDisplayedCount(Math.min(INITIAL_DISPLAY_COUNT, cachedData.data.length));
        setHasMore(false);
        setProgressiveLoadingComplete(true);
        return;
      } else if (cachedData && isCacheStale(cachedData.timestamp)) {
        logger.info( '⏰ Cache is stale, fetching fresh data for', selectedDate);
        // Remove stale cache entry
        setCache(prev => {
          const newCache = new Map(prev);
          newCache.delete(cacheKey);
          return newCache;
        });
      }
    }

    // Check if request is already ongoing
    if (ongoingRequests.has(cacheKey)) {
      return;
    }

    try {
      setLoading(true);
      setOngoingRequests(prev => new Set(prev).add(cacheKey));

      logger.info( '🚀 PROGRESSIVE LOADING: Starting for', selectedDate);

      // STEP 1: Load initial 500 employees instantly (increased from 50)
      logger.info( '📋 Loading initial employee data...');
      const initialResponse = await apiCall(`/api/eligible-employees/?date=${selectedDate}&initial=true`, {
        signal
      });

      if (!initialResponse.ok) {
        throw new Error(`Initial load failed: ${initialResponse.status}`);
      }

      const initialData = await initialResponse.json();
      logger.info( `✅ Loaded ${initialData.total_count} employees in ${initialData.performance.query_time}`);

      const firstBatch = initialData.eligible_employees || [];
      const dayName = initialData.day_name || '';
      const totalEmployees = initialData.total_count || firstBatch.length;

      // Set initial employees immediately for instant UI update
      setEligibleEmployees(firstBatch);
      setDayName(dayName);
      setHasExcelAttendance(initialData.has_excel_attendance || false); // Set Excel attendance flag
      initializeAttendanceEntries(firstBatch);
      setLoading(false); // User can start working immediately
      setInitialLoadComplete(true); // Mark initial load as complete
      
      // Infinite scrolling state
      setTotalCount(totalEmployees);
      const initialDisplay = Math.min(INITIAL_DISPLAY_COUNT, firstBatch.length);
      setDisplayedCount(initialDisplay);
      const hasMoreData = firstBatch.length < totalEmployees || (initialData.progressive_loading?.has_more || false);
      setHasMore(hasMoreData);
      
      setProgressiveLoadingComplete(false); // Mark as incomplete until all loaded

      // STEP 2: Auto-trigger background loading if there are more employees (but don't wait)
      // Load remaining in background, but don't display until user scrolls
      if (initialData.progressive_loading?.has_more && initialData.progressive_loading?.auto_trigger_remaining) {
        const remainingCount = initialData.progressive_loading.remaining_employees;
        logger.info( `🔄 Auto-triggering background load for ${remainingCount} remaining employees...`);

        // Add recommended delay before background load
        const delay = initialData.progressive_loading.recommended_delay_ms || 100;
        setTimeout(async () => {
          await loadRemainingEmployees(selectedDate, dayName, firstBatch, signal);
        }, delay);
      } else {
        // Cache the complete data if no more employees
        setCache(prev => new Map(prev).set(cacheKey, { 
          data: firstBatch, 
          dayName, 
          hasExcelAttendance: initialData.has_excel_attendance || false,
          timestamp: Date.now() 
        }));
        setProgressiveLoadingComplete(true); // Mark as complete
        setHasMore(false); // No more data to load
      }

      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was aborted, don't show error
        return;
      }
      logger.error('Error loading employee data:', err);
      setError('Failed to load eligible employees for this date');
      setEligibleEmployees([]);
    } finally {
      setLoading(false);
      setOngoingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(cacheKey);
        return newSet;
      });
    }
  };

  // STEP 2: Load remaining employees in background
  const loadRemainingEmployees = async (date: string, dayName: string, initialEmployees: Employee[], signal?: AbortSignal) => {
    try {
      logger.info( `📋 Background loading additional data for ${date}...`);

      const remainingResponse = await apiCall(`/api/eligible-employees/?date=${date}&remaining=true`, {
        signal
      });

      if (!remainingResponse.ok) {
        throw new Error(`Background load failed: ${remainingResponse.status}`);
      }

      const remainingData = await remainingResponse.json();
      logger.info( `✅ Background loaded ${remainingData.total_count} employees in ${remainingData.performance.query_time}`);

      const remainingEmployees = remainingData.eligible_employees || [];

      // STEP 3: Merge data while preserving user changes
      const allEmployees = mergeEmployeesWithUserChanges(initialEmployees, remainingEmployees);

      // Update state with all employees
      setEligibleEmployees(allEmployees);
      
      // Update infinite scrolling state
      setTotalCount(remainingData.total_count || allEmployees.length);
      setHasMore(false); // All data loaded
      setProgressiveLoadingComplete(true);
      
      // Note: Auto-load effect will automatically increase displayedCount to show new employees

      // Update attendance entries for new employees only (preserve existing user changes)
      setAttendanceEntries(prevEntries => {
        const newEntries = new Map(prevEntries);

        remainingEmployees.forEach((emp: Employee) => {
          // Only add if not already present (to preserve user changes)
          if (!newEntries.has(emp.employee_id)) {
            // Determine status with same priority as initializeAttendanceEntries
            let status: 'present' | 'absent' | 'off' | 'unmarked';
            
            // Priority 1: Check current_attendance.status first (saved data from backend)
            if (emp.current_attendance?.status) {
              const savedStatus = emp.current_attendance.status.toLowerCase();
              if (savedStatus === 'present' || savedStatus === 'absent' || savedStatus === 'off') {
                status = savedStatus as 'present' | 'absent' | 'off';
              } else {
                status = 'unmarked';
              }
            }
            // Priority 2: Use default_status from backend
            else if (emp.default_status === 'present') {
              status = 'present';
            } else if (emp.default_status === 'absent') {
              status = 'absent';
            } else if (emp.default_status === 'off') {
              status = 'off';
            }
            // Priority 3: If employee has off day and no existing data, default to 'off'
            else if (emp.has_off_day) {
              status = 'off';
            }
            // Default: unmarked
            else {
              status = 'unmarked';
            }
            
            const entry = createAttendanceEntry(emp, status);
            
            // If there's existing attendance data from backend, use the actual values
            if (emp.current_attendance && status !== 'unmarked') {
              entry.ot_hours = emp.current_attendance.ot_hours || 0;
              entry.late_minutes = emp.current_attendance.late_minutes || 0;
              if (emp.current_attendance.check_in) {
                entry.clock_in = emp.current_attendance.check_in;
              }
              if (emp.current_attendance.check_out) {
                entry.clock_out = emp.current_attendance.check_out;
              }
            }
            
            newEntries.set(emp.employee_id, entry);
          }
        });

        return newEntries;
      });

      // Cache the complete merged data
      const cacheKey = `eligible-employees-${date}`;
      setCache(prev => new Map(prev).set(cacheKey, { 
        data: allEmployees, 
        dayName, 
        hasExcelAttendance: false, // This is for remaining load, flag was set in initial load
        timestamp: Date.now() 
      }));

      logger.info( `🎉 Progressive loading complete: ${allEmployees.length} total records loaded`);
      setProgressiveLoadingComplete(true); // Mark progressive loading as complete
      setHasMore(false); // All data loaded

    } catch (error) {
      logger.error('❌ Background loading failed:', error);
      // Don't show error to user since initial data is still available
      // Still mark as complete since initial batch is available
      setProgressiveLoadingComplete(true);
    }
  };

  // Helper function to merge employees while preserving user changes
  const mergeEmployeesWithUserChanges = (existingEmployees: Employee[], newEmployees: Employee[]): Employee[] => {
    const existingMap = new Map<string, Employee>();
    existingEmployees.forEach(emp => {
      existingMap.set(emp.employee_id, emp);
    });

    // Start with existing employees (which may have user changes in attendance entries)
    const allEmployees = [...existingEmployees];

    // Add new employees that don't exist yet
    for (const newEmp of newEmployees) {
      if (!existingMap.has(newEmp.employee_id)) {
        allEmployees.push(newEmp);
      }
    }

    logger.info( `🔄 Merged employees: ${existingEmployees.length} existing + ${newEmployees.length} new = ${allEmployees.length} total`);
    return allEmployees;
  };

  // Helper function to initialize attendance entries
  const initializeAttendanceEntries = (employees: Employee[], preserveWeeklyData: boolean = false) => {
    // Only preserve weekly attendance data if explicitly requested (for same date updates)
    const existingEntries = preserveWeeklyData ? new Map(attendanceEntries) : new Map();
    const newEntries = new Map<string, AttendanceEntry>();
    
    logger.info( '🔍 Initializing attendance entries for', employees.length, 'employees');
    
    employees.forEach((emp: Employee) => {
      // Debug: Log employee data
      logger.info( `🔍 Employee ${emp.employee_id}:`, {
        default_status: emp.default_status,
        current_attendance: emp.current_attendance,
        has_off_day: emp.has_off_day
      });
      
      // Get existing entry only if we want to preserve weekly data
      const existingEntry = preserveWeeklyData ? existingEntries.get(emp.employee_id) : undefined;
      
      // Determine status with priority:
      // 1. Saved data from backend (current_attendance.status) - highest priority
      // 2. Default status from backend
      // 3. Default to 'off' for off-day employees (only if no saved data)
      // 4. Default to 'unmarked'
      let status: 'present' | 'absent' | 'off' | 'unmarked';
      
      // Priority 1: Check current_attendance.status first (saved data from backend)
      // This preserves "present" status for off-day employees that were saved
      if (emp.current_attendance?.status) {
        const savedStatus = emp.current_attendance.status.toLowerCase();
        if (savedStatus === 'present' || savedStatus === 'absent' || savedStatus === 'off') {
          status = savedStatus as 'present' | 'absent' | 'off';
          logger.info( `🔍 Using saved status from backend for ${emp.employee_id}: ${status}`);
        } else {
          status = 'unmarked';
        }
      }
      // Priority 2: Use default_status from backend
      else if (emp.default_status === 'present') {
        status = 'present';
      } else if (emp.default_status === 'absent') {
        status = 'absent';
      } else if (emp.default_status === 'off') {
        status = 'off';
      }
      // Priority 3: If employee has off day and no existing data, default to 'off'
      else if (emp.has_off_day) {
        status = 'off';
      }
      // Priority 4: No existing attendance data, leave unmarked
      else {
        status = 'unmarked';
      }
      
      logger.info( `🔍 Final status for ${emp.employee_id}: ${status}`);
      
      // Create new entry with determined status
      const entry = createAttendanceEntry(emp, status);
      
      // Only preserve weekly attendance data if requested and available
      if (preserveWeeklyData && existingEntry?.weeklyAttendance) {
        entry.weeklyAttendance = existingEntry.weeklyAttendance;
      }
      
      // If there's existing attendance data from backend, use the actual values
      if (emp.current_attendance && status !== 'unmarked') {
        entry.ot_hours = emp.current_attendance.ot_hours || 0;
        entry.late_minutes = emp.current_attendance.late_minutes || 0;
        if (emp.current_attendance.check_in) {
          entry.clock_in = emp.current_attendance.check_in;
        }
        if (emp.current_attendance.check_out) {
          entry.clock_out = emp.current_attendance.check_out;
        }
        logger.info( `🔍 Loaded existing attendance for ${emp.employee_id}:`, {
          ot_hours: entry.ot_hours,
          late_minutes: entry.late_minutes,
          clock_in: entry.clock_in,
          clock_out: entry.clock_out
        });
      }
      
      newEntries.set(emp.employee_id, entry);
    });
    
    logger.info( '🔍 Final attendance entries:', Array.from(newEntries.entries()).slice(0, 3));
    setAttendanceEntries(newEntries);
  };

  // Helper function to create attendance entry
  const createAttendanceEntry = (emp: Employee, status: 'present' | 'absent' | 'off' | 'unmarked'): AttendanceEntry => {
    return {
      employee_id: emp.employee_id,
      name: emp.name || 'Unknown',
      department: emp.department || 'General',
      status: status,
      clock_in: (() => {
        const minutes = emp.late_minutes || 0;
        const origShiftStart = emp.shift_start_time || '09:00';
        const [h, m] = origShiftStart.split(':').map(Number);
        const date = new Date(0, 0, 0, h, m + minutes);
        return date.toTimeString().slice(0, 5);
      })(),
      clock_out: (() => {
        const hours = emp.ot_hours || 0;
        const origShiftEnd = emp.shift_end_time || '18:00';
        const [h, m] = origShiftEnd.split(':').map(Number);
        const date = new Date(0, 0, 0, h + hours, m);
        return date.toTimeString().slice(0, 5);
      })(),
      ot_hours: emp.ot_hours || 0,
      late_minutes: emp.late_minutes || 0,
      has_off_day: emp.has_off_day || false,
      sunday_bonus: (emp as any).sunday_bonus || false,
      weeklyAttendance: {}, // Initialize as empty, will be populated by backend
      _shiftStart: emp.shift_start_time || '09:00',
      _shiftEnd: emp.shift_end_time || '18:00'
    };
  };

  const updateAttendanceEntry = (employeeId: string, field: keyof AttendanceEntry, value: string | number | boolean) => {
    // Allow changing status to 'present' even for off-day employees (for extra pay)
    // But prevent changing from off-day to 'absent' (should use 'off' instead)
    if (field === 'status') {
      const entry = attendanceEntries.get(employeeId);
      // Check both entry and employee for has_off_day (employee is source of truth)
      const employee = eligibleEmployees.find(emp => emp.employee_id === employeeId);
      const hasOffDay = entry?.has_off_day !== undefined ? entry.has_off_day : (employee?.has_off_day || false);
      if (entry && hasOffDay && value === 'absent') {
        // Employee has off day - can't mark as absent, use 'off' instead
        value = 'off';
      }
      if (entry && hasOffDay && value === 'unmarked') {
        // Employee has off day - unmarked should be 'off' instead
        value = 'off';
      }
    }
    setAttendanceEntries(prev => {
      const newMap = new Map(prev);
      const entry = newMap.get(employeeId);
      if (entry) {
        // If changing status away from 'present' or to 'unmarked', reset OT, late, clock times
        const updated = { ...entry, [field]: value } as AttendanceEntry;
        if (field === 'status') {
          if (value !== 'present' && value !== 'unmarked') {
            // Save current inputs so we can restore later (only if not unmarking)
            updated._prevClockIn = entry.clock_in;
            updated._prevClockOut = entry.clock_out;
            updated._prevOt = entry.ot_hours;
            updated._prevLate = entry.late_minutes;
          }
          
          if (value !== 'present') {
            // Reset values for absent/off/unmarked
            updated.ot_hours = 0;
            updated.late_minutes = 0;
            updated.clock_in = entry._shiftStart || entry.clock_in;
            updated.clock_out = entry._shiftEnd || entry.clock_out;
          } else {
            // Switching back to present: restore previous values if any
            const prevIn = entry._prevClockIn;
            const prevOut = entry._prevClockOut;
            const prevOt = entry._prevOt;
            const prevLate = entry._prevLate;
            if (prevIn) updated.clock_in = prevIn;
            if (prevOut) updated.clock_out = prevOut;
            if (typeof prevOt === 'number') updated.ot_hours = prevOt;
            if (typeof prevLate === 'number') updated.late_minutes = prevLate;
          }
        }
        newMap.set(employeeId, updated);
      }
      return newMap;
    });
  };

  const saveAttendance = async () => {
    // Early return guard: Prevent saving if Excel attendance exists for this month
    if (hasExcelAttendance) {
      alert('Cannot save attendance: Excel data already uploaded for this month. The attendance log is disabled.');
      return;
    }

    // Early return guard: Prevent saving if date is a holiday
    if (isHoliday && holidayInfo) {
      const message = `Cannot mark attendance on holiday: ${holidayInfo.name}${holidayInfo.description ? ` - ${holidayInfo.description}` : ''}`;
      alert(message);
      return;
    }

    try {
      setSaving(true);

      // Check for unmarked attendance entries
      const unmarkedEntries = Array.from(attendanceEntries.values()).filter(entry => {
        // If off day → unmarked is allowed → do NOT count
        const emp = eligibleEmployees.find(e => e.employee_id === entry.employee_id);
        const isOffDay = entry.has_off_day || emp?.has_off_day;
      
        if (isOffDay) return false; // Skip off-day from unmarked validation
      
        return entry.status === 'unmarked';
      });
      
      
      if (unmarkedEntries.length > 0) {
        setSaving(false);
        const unmarkedNames = unmarkedEntries.map(entry => entry.name).join(', ');
        alert(`Please mark attendance for: ${unmarkedNames}`);
        return;
      }

      // Convert attendance entries to array format for API
      const attendanceData = Array.from(attendanceEntries.values()).map(entry => ({
        employee_id: entry.employee_id,
        name: entry.name,
        department: entry.department,
        date: selectedDate,
        status: entry.status, // No need to treat unmarked as absent since we validate above
        present_days: entry.status === 'present' ? 1 : 0,
        absent_days: entry.status === 'absent' ? 1 : 0,
        ot_hours: entry.ot_hours,
        late_minutes: entry.late_minutes,
        calendar_days: 1,
        total_working_days: 1
      }));

      // Extract employee IDs for summary update
      const employeeIds = attendanceData.map(entry => entry.employee_id);

      // 🚀 PRIMARY: Lightning-fast attendance upload (wait for this)
      const attendanceResponse = await apiCall('/api/bulk-update-attendance/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          attendance_records: attendanceData
        })
      });

      // Check attendance response (primary operation)
      if (attendanceResponse.ok) {
        const attendanceResult = await attendanceResponse.json();
        logger.info( '✅ Attendance uploaded:', attendanceResult);

        // Show success message immediately
        alert(attendanceResult.message || 'Attendance saved successfully!');
        setError(null);
        
        // Dispatch refresh event to update all components
        logger.info( '📡 Dispatching attendanceUpdated and refreshEmployeeData events');
        window.dispatchEvent(new CustomEvent('attendanceUpdated', { detail: { timestamp: Date.now() } }));
        window.dispatchEvent(new CustomEvent('refreshEmployeeData'));

        // Refresh weekly attendance after a delay to allow background bonus day marking to complete
        // The bonus day marking happens in a background thread, so we wait 2 seconds before refreshing
        setTimeout(() => {
          if (selectedDate) {
            logger.info(`🔄 Refreshing weekly attendance after delay for date: ${selectedDate}`);
            fetchWeeklyAttendance(selectedDate);
          }
        }, 2000); // 2 second delay to allow background thread to complete

        // ⚡ BACKGROUND: Start async summary update (don't wait for this)
        apiCall('/api/update-monthly-summaries/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date: selectedDate,
            employee_ids: employeeIds
          })
        }).then(async (summaryResponse) => {
          if (summaryResponse.ok) {
            const summaryResult = await summaryResponse.json();
            logger.info( '✅ Monthly summaries updated in background:', summaryResult);
          } else {
            logger.warn('⚠️ Summary update failed, but attendance was saved successfully');
          }
        }).catch((error) => {
          logger.error('⚠️ Summary API error (background):', error);
          // Don't show error to user since attendance was successful
        });

      } else {
        // Primary attendance upload failed
        const errorResult = await attendanceResponse.json();
        // Check if error is due to holiday
        if (errorResult.holiday) {
          const holidayMsg = `Cannot mark attendance on holiday: ${errorResult.holiday.name}${errorResult.holiday.description ? ` - ${errorResult.holiday.description}` : ''}`;
          setError(holidayMsg);
          setIsHoliday(true);
          setHolidayInfo(errorResult.holiday);
        } else {
          throw new Error(errorResult.error || `Failed to save attendance: ${attendanceResponse.status}`);
        }
      }

    } catch (err: any) {
      logger.error('Error saving attendance:', err);
      // Check if error is due to holiday
      if (err.message && err.message.includes('holiday')) {
        setError(err.message);
        setIsHoliday(true);
      } else {
        setError(err.message || 'Failed to save attendance');
      }
    } finally {
      setSaving(false);
    }
    
    // Refresh attendance dates after saving
    fetchAttendanceDates();
  };

  // Reset displayed count when search or department filter changes
  useEffect(() => {
    setDisplayedCount(INITIAL_DISPLAY_COUNT);
  }, [searchQuery, selectedDepartment]);
  
  // Filter employees based on search query and month
  const filteredEmployees = eligibleEmployees.filter(emp => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      (emp.name && emp.name.toLowerCase().includes(query)) ||
      emp.employee_id.toLowerCase().includes(query) ||
      (emp.department && emp.department.toLowerCase().includes(query))
    );
  });

  // Apply department filter
  const departmentFilteredEmployees = filteredEmployees.filter(emp => {
    if (!selectedDepartment || selectedDepartment === 'All') return true;
    return (emp.department || 'General') === selectedDepartment;
  });

  // Tabs state
  const [activeTab] = useState<'all' | 'present' | 'absent' | 'off'>('all');

  // Tab-based filtering (respect department filter)
  const tabFilteredEmployees = departmentFilteredEmployees.filter(emp => {
    const entry = attendanceEntries.get(emp.employee_id);
    if (!entry) return false;
    if (activeTab === 'all') return true;
    if (activeTab === 'present') return entry.status === 'present';
    if (activeTab === 'absent') return entry.status === 'absent';
    if (activeTab === 'off') return entry.status === 'off';
    return true;
  });

  // Sort employees by name (first_name + last_name, fallback to name), then slice for infinite scroll
  const sortedEmployees = [...tabFilteredEmployees].sort((a, b) => {
    const nameA = (a.first_name && a.last_name)
      ? `${a.first_name} ${a.last_name}`.toLowerCase()
      : (a.name || '').toLowerCase();
    const nameB = (b.first_name && b.last_name)
      ? `${b.first_name} ${b.last_name}`.toLowerCase()
      : (b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
  
  // Infinite scroll: Display only the first 'displayedCount' employees
  const displayedEmployees = sortedEmployees.slice(0, displayedCount);
  
  // Auto-load more employees automatically (background loading)
  useEffect(() => {
    // If we have more loaded data to display, automatically increase displayed count
    if (!loadingMore && displayedCount < sortedEmployees.length && initialLoadComplete) {
      const timer = setTimeout(() => {
        const newDisplayedCount = Math.min(displayedCount + LOAD_MORE_COUNT, sortedEmployees.length);
        setDisplayedCount(newDisplayedCount);
      }, 200); // 0.2 second delay
      return () => clearTimeout(timer);
    }
  }, [displayedCount, sortedEmployees.length, loadingMore, initialLoadComplete]);
  
  // Auto-load more from backend when we've displayed all loaded employees
  useEffect(() => {
    if (!loadingMore && displayedCount >= eligibleEmployees.length && hasMore && !progressiveLoadingComplete && initialLoadComplete) {
      // Automatically load remaining employees from backend after a short delay
      const timer = setTimeout(async () => {
        const cacheKey = `eligible-employees-${selectedDate}`;
        if (!ongoingRequests.has(cacheKey)) {
          try {
            setLoadingMore(true);
            await loadRemainingEmployees(selectedDate, dayName, eligibleEmployees);
          } catch (error) {
            logger.error('Error auto-loading more employees:', error);
          } finally {
            setLoadingMore(false);
          }
        }
      }, 200); // 0.2 second delay
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedCount, eligibleEmployees.length, hasMore, loadingMore, progressiveLoadingComplete, initialLoadComplete, selectedDate, dayName]);
  
  // Infinite scroll: Detect when user scrolls near bottom (optional fallback)
  useEffect(() => {
    const handleScroll = () => {
      // Check if user scrolled near bottom (within 200px)
      const scrollPosition = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      
      if (documentHeight - scrollPosition < 200 && !loadingMore && initialLoadComplete) {
        // If we have more loaded data to display, show it immediately on scroll
        if (displayedCount < sortedEmployees.length) {
          const newDisplayedCount = Math.min(displayedCount + LOAD_MORE_COUNT, sortedEmployees.length);
          setDisplayedCount(newDisplayedCount);
        }
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, displayedCount, sortedEmployees.length, initialLoadComplete]);

  const markAllPresent = () => {
    // Only allow if progressive loading is complete
    if (!progressiveLoadingComplete) return;

    setAttendanceEntries(prev => {
      const newMap = new Map(prev);
      // Only update entries for employees in the current filtered department
      // Skip employees with off days
      departmentFilteredEmployees.forEach(emp => {
        const entry = newMap.get(emp.employee_id);
        // Use employee.has_off_day as fallback if entry doesn't have it
        const hasOffDay = entry?.has_off_day !== undefined ? entry.has_off_day : (emp.has_off_day || false);
        if (entry && !hasOffDay && entry.status !== 'off') {
          newMap.set(emp.employee_id, { ...entry, status: 'present' });
        }
      });
      return newMap;
    });
  };

  const markAllAbsent = () => {
    // Only allow if progressive loading is complete
    if (!progressiveLoadingComplete) return;

    setAttendanceEntries(prev => {
      const newMap = new Map(prev);
      // Only update entries for employees in the current filtered department
      // Skip employees with off days
      departmentFilteredEmployees.forEach(emp => {
        const entry = newMap.get(emp.employee_id);
        // Use employee.has_off_day as fallback if entry doesn't have it
        const hasOffDay = entry?.has_off_day !== undefined ? entry.has_off_day : (emp.has_off_day || false);
        if (entry && !hasOffDay && entry.status !== 'off') {
          newMap.set(emp.employee_id, { ...entry, status: 'absent' });
        }
      });
      return newMap;
    });
  };

  const timeToMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const recalcOtLate = (employeeId: string, clockIn: string, clockOut: string, shiftStart: string, shiftEnd: string) => {
    const lateArrival = Math.max(timeToMinutes(clockIn) - timeToMinutes(shiftStart), 0);
    const earlyLeave = Math.max(timeToMinutes(shiftEnd) - timeToMinutes(clockOut), 0);
    const late_minutes = lateArrival + earlyLeave;
    const otMinutes = Math.max(timeToMinutes(clockOut) - timeToMinutes(shiftEnd), 0);
    const otHours = parseFloat((otMinutes / 60).toFixed(1));
    updateAttendanceEntry(employeeId, 'late_minutes', late_minutes);
    updateAttendanceEntry(employeeId, 'ot_hours', otHours);
  };

  const updateClockIn = (emp: Employee, value: string) => {
    updateAttendanceEntry(emp.employee_id, 'clock_in', value);
    if (emp.shift_start_time && emp.shift_end_time) {
      recalcOtLate(emp.employee_id, value, attendanceEntries.get(emp.employee_id)!.clock_out, emp.shift_start_time, emp.shift_end_time);
    }
  };

  const updateClockOut = (emp: Employee, value: string) => {
    updateAttendanceEntry(emp.employee_id, 'clock_out', value);
    if (emp.shift_start_time && emp.shift_end_time) {
      recalcOtLate(emp.employee_id, attendanceEntries.get(emp.employee_id)!.clock_in, value, emp.shift_start_time, emp.shift_end_time);
    }
  };

  // Helper function to get first off day in the week
  const getFirstOffDay = (employeeOffDays: { [day: string]: boolean } | undefined): string | null => {
    if (!employeeOffDays) return null;
    
    // Order of days in the week: M, Tu, W, Th, F, Sa, Su
    const dayOrder = ['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'];
    for (const day of dayOrder) {
      if (employeeOffDays[day] === true) {
        return day;
      }
    }
    return null;
  };

  // Helper function to calculate weekly penalty days based on absent days
  // This matches backend logic: count absent days Mon-Sat (excluding Sunday)
  const calculateWeeklyPenaltyDays = (weeklyAttendance: { [day: string]: boolean }): number => {
    // Count absent days (false values) in Mon-Sat only (exclude Sunday)
    const weekdays = ['M', 'Tu', 'W', 'Th', 'F', 'Sa'];
    const absentDays = weekdays.filter(day => weeklyAttendance[day] === false).length;
    
    // Use tenant-configured threshold from HR Settings; if unavailable, skip penalty
    if (typeof weeklyAbsentThreshold !== 'number') return 0;
    const threshold = weeklyAbsentThreshold;
    
    if (absentDays >= threshold) {
      return 1; // One penalty day
    }
    return 0;
  };

  // Cache for employee off day configurations
  const [employeeOffDaysCache, setEmployeeOffDaysCache] = useState<Map<string, { [day: string]: boolean }>>(new Map());

  // Fetch employee off day configurations from directory API
  const fetchEmployeeOffDays = useCallback(async (employeeIds: string[]): Promise<Map<string, { [day: string]: boolean }>> => {
    const offDaysMap = new Map<string, { [day: string]: boolean }>();
    
    // Check cache first
    const missingIds: string[] = [];
    employeeIds.forEach(id => {
      if (employeeOffDaysCache.has(id)) {
        offDaysMap.set(id, employeeOffDaysCache.get(id)!);
      } else {
        missingIds.push(id);
      }
    });
    
    if (missingIds.length === 0) {
      logger.info(`✅ Using cached off day configurations for all ${employeeIds.length} employees`);
      return offDaysMap;
    }
    
    try {
      // Fetch employee directory data which includes off day configurations
      // Fetch all employees and filter in frontend (directory API doesn't support filtering by employee_ids)
      const params = new URLSearchParams();
      params.append('limit', '0'); // 0 = fetch all
      params.append('offset', '0');
      
      const response = await apiCall(`/api/employees/directory_data/?${params.toString()}`);
      if (response.ok) {
        const directoryData = await response.json();
        const employees = directoryData.results || directoryData.employees || [];
        
        // Filter to only employees we need and build map
        employees.forEach((emp: any) => {
          if (emp.employee_id && missingIds.includes(emp.employee_id)) {
            const offDays: { [day: string]: boolean } = {
              'M': emp.off_monday || false,
              'Tu': emp.off_tuesday || false,
              'W': emp.off_wednesday || false,
              'Th': emp.off_thursday || false,
              'F': emp.off_friday || false,
              'Sa': emp.off_saturday || false,
              'Su': emp.off_sunday || false,
            };
            
            // Only add to map if employee has at least one off day configured
            const hasOffDay = Object.values(offDays).some(val => val === true);
            if (hasOffDay) {
              offDaysMap.set(emp.employee_id, offDays);
            } else {
              // Still cache it (as empty) to avoid refetching
              offDaysMap.set(emp.employee_id, {
                'M': false, 'Tu': false, 'W': false, 'Th': false, 'F': false, 'Sa': false, 'Su': false
              });
            }
          }
        });
        
        // Update cache
        setEmployeeOffDaysCache(prev => {
          const newCache = new Map(prev);
          offDaysMap.forEach((value, key) => {
            newCache.set(key, value);
          });
          return newCache;
        });
        
        logger.info(`✅ Fetched off day configurations for ${offDaysMap.size} employees (${missingIds.length} new)`);
      }
    } catch (error) {
      logger.error('❌ Error fetching employee off days:', error);
    }
    
    // Merge cached and newly fetched
    const mergedMap = new Map(employeeOffDaysCache);
    offDaysMap.forEach((value, key) => {
      mergedMap.set(key, value);
    });
    
    return mergedMap;
  }, [employeeOffDaysCache]);

  // Add a function to fetch weekly attendance for the selected day
  const fetchWeeklyAttendance = useCallback(async (date: string) => {
    try {
      logger.info(`📅 Fetching weekly attendance for date: ${date}`);
      const response = await apiCall(`/api/attendance/weekly/?date=${date}`);
      if (response.ok) {
        const data = await response.json();
        logger.info('📊 Weekly attendance data received:', data);
        
        // Get all employee IDs from weekly attendance data
        const allEmployeeIds = Object.keys(data);
        
        // Fetch employee off day configurations
        const employeeOffDaysMap = await fetchEmployeeOffDays(allEmployeeIds);
        
        // Calculate weekly penalty days for each employee
        const weeklyPenaltyDaysMap = new Map<string, number>();
        allEmployeeIds.forEach((employeeId) => {
          const weeklyAttendance = data[employeeId]?.weeklyAttendance || {};
          const penaltyDays = calculateWeeklyPenaltyDays(weeklyAttendance);
          if (penaltyDays > 0) {
            weeklyPenaltyDaysMap.set(employeeId, penaltyDays);
            // Log detailed penalty calculation
            const absentDays = ['M', 'Tu', 'W', 'Th', 'F', 'Sa'].filter(day => weeklyAttendance[day] === false).length;
            logger.info(`⚠️ Penalty days calculated for ${employeeId}: ${penaltyDays} (absent days: ${absentDays})`);
          }
        });
        
        logger.info(`📊 Penalty days summary: ${weeklyPenaltyDaysMap.size} employees with penalty days out of ${allEmployeeIds.length} total`);
        
        // Log a sample of the data to verify structure
        const sampleEmployeeIds = Object.keys(data).slice(0, 2);
        if (sampleEmployeeIds.length > 0) {
          const sampleEmp = data[sampleEmployeeIds[0]];
          logger.info('📋 Sample employee data:', {
            employeeId: sampleEmployeeIds[0],
            weeklyAttendance: sampleEmp.weeklyAttendance,
            autoMarkedReasons: sampleEmp.autoMarkedReasons
          });
        }
        
        // Update attendance entries with weekly attendance data
        // Backend returns an object with employee_id as keys
        setAttendanceEntries((prev) => {
          const updatedEntries = new Map(prev);
          let updatedCount = 0;
          
          Object.entries(data).forEach(([employeeId, employeeData]: [string, any]) => {
            const weeklyAttendance = employeeData.weeklyAttendance || {};
            const autoMarkedReasons = employeeData.autoMarkedReasons || {};
            const employeeOffDays = employeeOffDaysMap.get(employeeId);
            const penaltyDays = weeklyPenaltyDaysMap.get(employeeId) || 0;
            
            // If penalty days exist, mark first off day as absent
            let updatedWeeklyAttendance = { ...weeklyAttendance };
            let updatedAutoMarkedReasons = { ...autoMarkedReasons };
            
            if (penaltyDays > 0 && employeeOffDays) {
              const firstOffDay = getFirstOffDay(employeeOffDays);
              if (firstOffDay) {
                // Always mark first off day as absent for penalty (override any existing status)
                updatedWeeklyAttendance[firstOffDay] = false;
                updatedAutoMarkedReasons[firstOffDay] = 'Penalty day - Absent more than threshold';
                logger.info(`⚠️ Penalty day applied: ${employeeId} - ${firstOffDay} marked as absent (penalty days: ${penaltyDays})`);
              } else {
                // Employee has penalty but no off days configured - this is expected for some employees
                logger.debug(`ℹ️ Penalty day exists for ${employeeId} but no off day found in configuration (employee may not have off days configured)`);
              }
            } else if (penaltyDays > 0 && !employeeOffDays) {
              // Employee has penalty but off day configuration not available - this is expected for some employees
              logger.debug(`ℹ️ Penalty day exists for ${employeeId} but off day configuration not available (employee may not have off days configured)`);
            }
            
            // Check if this employee exists in our current entries
            if (updatedEntries.has(employeeId)) {
              const existingEntry = updatedEntries.get(employeeId);
              if (existingEntry) {
                // Merge weekly attendance data and auto-marked reasons
                updatedEntries.set(employeeId, {
                  ...existingEntry,
                  weeklyAttendance: updatedWeeklyAttendance,
                  autoMarkedReasons: updatedAutoMarkedReasons,
                  weekly_penalty_days: penaltyDays,
                  employee_off_days: employeeOffDays,
                });
                updatedCount++;
              }
            } else {
              // If employee not in entries yet, create a basic entry with weekly attendance
              // This ensures data is available when the employee is later added
              updatedEntries.set(employeeId, {
                employee_id: employeeId,
                name: employeeData.name || employeeId,
                department: '',
                status: 'unmarked',
                clock_in: '09:00',
                clock_out: '18:00',
                ot_hours: 0,
                late_minutes: 0,
                has_off_day: false,
                weeklyAttendance: updatedWeeklyAttendance,
                autoMarkedReasons: updatedAutoMarkedReasons,
                weekly_penalty_days: penaltyDays,
                employee_off_days: employeeOffDays,
              });
            }
          });
          
          logger.info(`✅ Updated weekly attendance for ${updatedCount} employees`);
          return updatedEntries;
        });
      } else {
        logger.error('❌ Failed to fetch weekly attendance:', response.status);
      }
    } catch (error) {
      logger.error('❌ Error fetching weekly attendance:', error);
    }
  }, [fetchEmployeeOffDays]);

  // Call fetchWeeklyAttendance when the selected date changes or when employees are loaded
  useEffect(() => {
    if (selectedDate && eligibleEmployees.length > 0 && attendanceEntries.size > 0) {
      logger.info(`🔄 Fetching weekly attendance for date: ${selectedDate}, employees: ${eligibleEmployees.length}`);
      fetchWeeklyAttendance(selectedDate);
    }
  }, [selectedDate, eligibleEmployees.length, attendanceEntries.size]);

  return (
    <div className="space-y-6">
      {/* Holiday Warning Banner - Same style as Excel Upload notification */}
      {isHoliday && holidayInfo && (
        <div className="bg-yellow-50 border-2 border-yellow-400 p-6 rounded-lg mb-6">
          <div className="flex items-center justify-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-lg font-semibold text-yellow-800">
                {holidayInfo.name} - Attendance Disabled
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                {holidayInfo.description 
                  ? holidayInfo.description 
                  : `The attendance log is disabled for this ${(holidayInfo.type ?? 'OTHER').replace('_', ' ').toLowerCase()} holiday.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Excel Attendance Upload Notification - Disable entire interface */}
      {!loading && hasExcelAttendance && (
        <div className="bg-yellow-50 border-2 border-yellow-400 p-6 rounded-lg mb-6">
          <div className="flex items-center justify-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-lg font-semibold text-yellow-800">
                Attendance has already been uploaded for {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                The attendance log is disabled for this month as attendance data was uploaded via Excel.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        {loading ? (
          <SkeletonSearchBar />
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0B5E59]"
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {/* Department filter dropdown */}
            <div className="ml-3">
              {loading ? (
                <SkeletonFilterDropdown />
              ) : (
                <Dropdown
                  options={[
                    { value: 'All', label: 'All Departments' },
                    ...Array.from(new Set(eligibleEmployees.map(e => e.department || 'General'))).map(d => ({ value: d, label: d }))
                  ]}
                  value={selectedDepartment}
                  onChange={(val) => setSelectedDepartment(val || 'All')}
                  placeholder="Department"
                  className="w-48"
                />
              )}
            </div>
          </div>
          {loading ? (
            <SkeletonButton width="w-40" />
          ) : (
            <button
              onClick={saveAttendance}
              disabled={saving || hasExcelAttendance || isHoliday}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                hasExcelAttendance || isHoliday
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : Array.from(attendanceEntries.values())
                  .some(entry => {
                    const emp = eligibleEmployees.find(e => e.employee_id === entry.employee_id);
                    const isOffDay = entry.has_off_day || emp?.has_off_day;
                    return !isOffDay && entry.status === 'unmarked';
                  })
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  : 'bg-teal-800 hover:bg-teal-900 text-white'
              }`}
              title={isHoliday ? `Cannot mark attendance on holiday: ${holidayInfo?.name || 'Holiday'}` : ''}
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {isHoliday
                ? '🚫 Holiday - Disabled'
                : hasExcelAttendance 
                ? 'Disabled (Excel Uploaded)'
                : saving ? 'Saving...' : 
                Array.from(attendanceEntries.values()).some(entry => entry.status === 'unmarked')
                  ? '⚠️ Save (Unmarked Found)'
                  : 'Save Attendance'
              }
            </button>
          )}
        </div>
      </div>

      {/* Search and Bulk Actions */}
      <div className="flex items-center justify-between">
        {loading ? (
          <SkeletonStatsBar />
        ) : departmentFilteredEmployees.length > 0 ? (
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="text-sm">
                  <span className="font-medium text-teal-900">Total Employees:</span>
                  <span className="ml-2 text-teal-700">{departmentFilteredEmployees.length}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-teal-900">Present:</span>
                  <span className="ml-2 text-teal-700">
                    {Array.from(attendanceEntries.values()).filter(entry =>
                      departmentFilteredEmployees.some(emp => emp.employee_id === entry.employee_id) && entry.status === 'present'
                    ).length}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-red-900">Absent:</span>
                  <span className="ml-2 text-red-700">
                    {Array.from(attendanceEntries.values()).filter(entry =>
                      departmentFilteredEmployees.some(emp => emp.employee_id === entry.employee_id) && entry.status === 'absent'
                    ).length}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-teal-900">Off Day:</span>
                  <span className="ml-2 text-teal-700">
                    {Array.from(attendanceEntries.values()).filter(entry =>
                      departmentFilteredEmployees.some(emp => emp.employee_id === entry.employee_id) && entry.status === 'off'
                    ).length}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-yellow-900">Unmarked:</span>
                  <span className="ml-2 text-yellow-700">
                    {Array.from(attendanceEntries.values()).filter(entry =>
                      departmentFilteredEmployees.some(emp => emp.employee_id === entry.employee_id) && entry.status === 'unmarked'
                    ).length}
                  </span>
                </div>
                {isHoliday && holidayInfo && (
                  <div className="text-sm">
                    <span className="font-medium text-purple-900">Holiday:</span>
                    <span className="ml-2 text-purple-700">{holidayInfo.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-4">
            {loading ? (
              <>
                <SkeletonBase className="h-4 w-16" />
                <SkeletonDatePicker />
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-gray-700">{dayName}</span>
                <DatePicker
                  value={selectedDate}
                  onChange={handleDateChange}
                  maxDate={new Date()}
                  attendanceDates={attendanceDates}
                  loading={dateLoading}
                  placeholder="Select attendance date"
                  className="min-w-[180px]"
                />
              </>
            )}
          </div>
          {loading ? (
            <>
              <SkeletonButton width="w-32" />
              <SkeletonButton width="w-32" />
            </>
          ) : (
            <>
              <button
                onClick={markAllPresent}
                disabled={!progressiveLoadingComplete || hasExcelAttendance || isHoliday}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${(progressiveLoadingComplete && !hasExcelAttendance && !isHoliday)
                    ? 'bg-teal-100 hover:bg-teal-200 text-teal-800'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                title={
                  !progressiveLoadingComplete 
                    ? 'Please wait for loading to complete' 
                    : hasExcelAttendance 
                    ? 'Disabled: Excel attendance uploaded' 
                    : isHoliday 
                    ? 'Disabled: Cannot mark attendance on holidays' 
                    : ''
                }
              >
                <UserCheck size={16} />
                Mark All Present
              </button>
              <button
                onClick={markAllAbsent}
                disabled={!progressiveLoadingComplete || hasExcelAttendance || isHoliday}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${(progressiveLoadingComplete && !hasExcelAttendance && !isHoliday)
                    ? 'bg-red-100 hover:bg-red-200 text-red-800'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                title={
                  !progressiveLoadingComplete 
                    ? 'Please wait for loading to complete' 
                    : hasExcelAttendance 
                    ? 'Disabled: Excel attendance uploaded' 
                    : isHoliday 
                    ? 'Disabled: Cannot mark attendance on holidays' 
                    : ''
                }
              >
                <UserX size={16} />
                Mark All Absent
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progressive Loading Indicator */}
      {!loading && !progressiveLoadingComplete && eligibleEmployees.length > 0 && (
        <ProgressiveLoadingIndicator
          currentCount={eligibleEmployees.length}
          totalCount={undefined}
          isComplete={progressiveLoadingComplete}
        />
      )}


      {/* Attendance Table */}
      {loading || !initialLoadComplete ? (
        <SkeletonAttendanceLogTable rows={12} />
      ) : error ? (
        <div className="bg-white rounded-lg border border-gray-200">
          <LoadingState message={error} showSpinner={false} />
        </div>
      ) : hasExcelAttendance ? (
        <div className="bg-gray-100 rounded-lg border border-gray-300 p-8 text-center">
          <p className="text-gray-600 text-lg">Attendance interface is disabled for this month</p>
          <p className="text-gray-500 text-sm mt-2">Attendance data has been uploaded via Excel for {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </div>
      ) : isHoliday ? (
        <div className="bg-gray-100 rounded-lg border border-gray-300 p-8 text-center">
          <p className="text-gray-600 text-lg">Attendance interface is disabled for this holiday</p>
          <p className="text-gray-500 text-sm mt-2">Cannot mark attendance on {holidayInfo?.name || 'holidays'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Employee ID</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Name</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Department</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Status</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Clock In</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Clock Out</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">OT Hours</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Late Minutes</th>
                  <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Weekly Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-gray-500">
                      {searchQuery ? 'No employees found matching your search.' : 'No attendance data available for this date.'}
                    </td>
                  </tr>
                ) : (
                  displayedEmployees.map((employee) => {
                    const entry = attendanceEntries.get(employee.employee_id);
                    if (!entry) return null;

                    // Use employee.has_off_day as fallback if entry doesn't have it
                    const hasOffDay = entry.has_off_day !== undefined ? entry.has_off_day : (employee.has_off_day || false);
                    
                    // Build off-day map (prefer entry.employee_off_days, fallback to employee flags)
                    const employeeOffDays =
                      (entry as any).employee_off_days ||
                      {
                        M: (employee as any).off_monday,
                        Tu: (employee as any).off_tuesday,
                        W: (employee as any).off_wednesday,
                        Th: (employee as any).off_thursday,
                        F: (employee as any).off_friday,
                        Sa: (employee as any).off_saturday,
                        Su: (employee as any).off_sunday,
                      };
                    const firstOffDayCode = ['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'].find((d) => employeeOffDays?.[d] === true);
                    
                    // Calculate absent count and check threshold
                    const weeklyData = entry?.weeklyAttendance || {};
                    const weekdays = ['M', 'Tu', 'W', 'Th', 'F', 'Sa'];
                    const absentCount = weekdays.filter((day) => weeklyData[day] === false).length;
                    const threshold = typeof weeklyAbsentThreshold === 'number' ? weeklyAbsentThreshold : null;
                    
                    // Check if threshold is breached
                    const isThresholdBreached = threshold !== null && absentCount >= threshold;
                    
                    // Map selected day name to code to check if current date is first off day
                    const selectedDayCode = (() => {
                      const dn = dayName.toLowerCase();
                      if (dn === 'monday') return 'M';
                      if (dn === 'tuesday') return 'Tu';
                      if (dn === 'wednesday') return 'W';
                      if (dn === 'thursday') return 'Th';
                      if (dn === 'friday') return 'F';
                      if (dn === 'saturday') return 'Sa';
                      if (dn === 'sunday') return 'Su';
                      return null;
                    })();
                    
                    // Check if first off day is manually marked as present (not auto-marked)
                    // This can be from weeklyAttendance data OR from current entry status if selected date is the first off day
                    const firstOffDayValue = firstOffDayCode ? weeklyData[firstOffDayCode] : undefined;
                    
                    // Check if current selected date is the first off day and manually marked present
                    const isCurrentDateFirstOffDay = firstOffDayCode && selectedDayCode === firstOffDayCode;
                    // Current date is manually present if: status is present, not sunday bonus, and not auto-marked
                    const isCurrentDateAutoMarked = isCurrentDateFirstOffDay ? (!!entry?.autoMarkedReasons?.[selectedDayCode!] || !!entry.sunday_bonus) : false;
                    const isCurrentDateManuallyPresent = isCurrentDateFirstOffDay && entry.status === 'present' && !isCurrentDateAutoMarked;
                    
                    // First off day is manually present if:
                    // 1. Current selected date is the first off day AND entry status is manually marked present (not auto-marked), OR
                    // 2. It's marked as present in weeklyAttendance
                    // Note: If it's present in weeklyAttendance, we consider it as manually marked for penalty display
                    // (User can manually mark it, and if it's present, we show orange when threshold is breached)
                    const isFirstOffDayManuallyPresent = firstOffDayCode && (
                      isCurrentDateManuallyPresent ||
                      firstOffDayValue === true
                    );
                    
                    // Show orange chip if: threshold breached AND first off day is manually marked present
                    const showPenaltyPresentChip = isThresholdBreached && isFirstOffDayManuallyPresent;
                    
                    // Debug logging for penalty chip logic
                    if (isThresholdBreached && firstOffDayCode) {
                      logger.debug(`🔍 Penalty chip check for ${employee.employee_id}:`, {
                        absentCount,
                        threshold,
                        firstOffDayCode,
                        firstOffDayValue,
                        isCurrentDateFirstOffDay,
                        isCurrentDateManuallyPresent,
                        isFirstOffDayManuallyPresent,
                        showPenaltyPresentChip
                      });
                    }

                    return (
                      <tr key={employee.employee_id} className={`hover:bg-gray-50 ${entry.status === 'unmarked' ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}`}>
                        <td className="px-4 py-3 text-sm font-medium">{employee.employee_id}</td>
                        <td className="px-4 py-3 text-sm">
                          {isHRManager && !canViewEmployeeDetails ? (
                            <span className="text-gray-900">
                              {employee.first_name && employee.last_name
                                ? `${employee.first_name} ${employee.last_name}`
                                : employee.name || 'Unknown'
                              }
                            </span>
                          ) : (
                            <button
                              onClick={() => navigate(`/hr-management/employees/edit/${employee.employee_id}`)}
                              className="text-[#0B5E59] hover:underline text-left"
                            >
                              {employee.first_name && employee.last_name
                                ? `${employee.first_name} ${employee.last_name}`
                                : employee.name || 'Unknown'
                              }
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{employee.department || 'General'}</td>
                        <td className="px-4 py-3">
                          {(hasOffDay || entry.status === 'off') && entry.status !== 'present' ? (
                            <div className="flex gap-2 items-center">
                              <span className="px-3 py-1 rounded text-sm font-medium bg-teal-100 text-teal-800 border border-teal-200">
                                OFF DAY
                              </span>
                              <button
                                onClick={() => updateAttendanceEntry(employee.employee_id, 'status', 'present')}
                                disabled={hasExcelAttendance || isHoliday}
                                className={`px-3 py-1 rounded text-sm font-medium ${(hasExcelAttendance || isHoliday)
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-orange-100 text-orange-800 border border-orange-200 hover:bg-orange-200'
                                  }`}
                                title={isHoliday ? 'Cannot mark attendance on holidays' : hasExcelAttendance ? 'Disabled: Excel attendance uploaded' : 'Mark as present for extra payment'}
                              >
                                Mark as Present
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {hasOffDay && entry.status === 'present' && !isThresholdBreached && (
                                <span className="text-xs text-orange-600 font-medium mb-1">⚠️ Off Day - Extra Pay</span>
                              )}
                              {entry.sunday_bonus && entry.status === 'present' && (
                                <span className="text-xs text-teal-700 font-semibold mb-1">
                                  Sunday bonus (auto-marked present due to weekly performance)
                                </span>
                              )}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    // Toggle: if already present, mark as off (for off-day) or unmark; otherwise mark as present
                                    let newStatus: string;
                                    if (entry.status === 'present') {
                                      // If already present and has off day, toggle back to off
                                      newStatus = hasOffDay ? 'off' : 'unmarked';
                                    } else {
                                      newStatus = 'present';
                                    }
                                    updateAttendanceEntry(employee.employee_id, 'status', newStatus);
                                  }}
                                  disabled={hasExcelAttendance || isHoliday}
                                  className={`px-3 py-1 rounded text-sm font-medium ${(hasExcelAttendance || isHoliday)
                                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      : entry.status === 'present'
                                      ? hasOffDay
                                        ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                        : 'bg-teal-100 text-teal-800 border border-teal-200'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                  Present
                                </button>
                                <button
                                  onClick={() => {
                                    // Toggle: if already absent/off, unmark it; otherwise mark as absent/off
                                    if (hasOffDay) {
                                      const newStatus = entry.status === 'off' ? 'unmarked' : 'off';
                                      updateAttendanceEntry(employee.employee_id, 'status', newStatus);
                                    } else {
                                      const newStatus = entry.status === 'absent' ? 'unmarked' : 'absent';
                                      updateAttendanceEntry(employee.employee_id, 'status', newStatus);
                                    }
                                  }}
                                  disabled={hasExcelAttendance || isHoliday}
                                  className={`px-3 py-1 rounded text-sm font-medium ${(hasExcelAttendance || isHoliday)
                                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      : (entry.status === 'absent' || (entry.status as string) === 'off')
                                      ? 'bg-red-100 text-red-800 border border-red-200'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                  title={isHoliday ? 'Cannot mark attendance on holidays' : hasExcelAttendance ? 'Disabled: Excel attendance uploaded' : ''}
                                >
                                  {hasOffDay ? 'Back to Off Day' : 'Absent'}
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {(hasOffDay && entry.status !== 'present') || (entry.status === 'off') ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <input
                              type="time"
                              value={entry.clock_in}
                              disabled={entry.status !== 'present' || hasExcelAttendance || isHoliday}
                              onFocus={(e) => (e.currentTarget as HTMLInputElement).showPicker && (e.currentTarget as HTMLInputElement).showPicker()}
                              onChange={(e) => updateClockIn(employee, e.target.value)}
                              className={`time-input-styled w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none transition-colors duration-200 ${(entry.status === 'present' && !hasExcelAttendance && !isHoliday)
                                  ? 'focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white text-gray-700 hover:border-gray-300'
                                  : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                }`}
                              title={isHoliday ? 'Cannot mark attendance on holidays' : ''}
                            />)}
                        </td>
                        <td className="px-4 py-3">
                          {(entry.has_off_day && entry.status !== 'present') || (entry.status === 'off') ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <input
                              type="time"
                              value={entry.clock_out}
                              disabled={entry.status !== 'present' || hasExcelAttendance || isHoliday}
                              onFocus={(e) => (e.currentTarget as HTMLInputElement).showPicker && (e.currentTarget as HTMLInputElement).showPicker()}
                              onChange={(e) => updateClockOut(employee, e.target.value)}
                              className={`time-input-styled w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none transition-colors duration-200 ${(entry.status === 'present' && !hasExcelAttendance && !isHoliday)
                                  ? 'focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white text-gray-700 hover:border-gray-300'
                                  : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                }`}
                              title={isHoliday ? 'Cannot mark attendance on holidays' : ''}
                            />)}
                        </td>
                        <td className="px-4 py-3">
                          {(hasOffDay && entry.status !== 'present') || (entry.status === 'off') ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <span>{entry.ot_hours}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {(hasOffDay && entry.status !== 'present') || (entry.status === 'off') ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <span>{entry.late_minutes}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-1">
                            {['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'].map((day) => {
                              const weeklyData = entry?.weeklyAttendance || {};
                              const autoMarkedReasons = entry?.autoMarkedReasons || {};
                              
                              // If current selected date is this day, use entry status to determine value
                              let dayValue = weeklyData[day];
                              if (selectedDayCode === day) {
                                // Override with current entry status for the selected date
                                if (entry.status === 'present') dayValue = true;
                                else if (entry.status === 'absent' || entry.status === 'off') dayValue = false;
                              }
                              
                              const isFirstOffDay = firstOffDayCode ? day === firstOffDayCode : false;
                              // For current date, check if it's manually marked (not auto-marked and not sunday bonus)
                              const isCurrentDay = selectedDayCode === day;
                              const isCurrentDayAutoMarked = isCurrentDay ? (!!entry?.autoMarkedReasons?.[day] || !!entry.sunday_bonus) : false;
                              const isCurrentDayManuallyPresent = isCurrentDay && entry.status === 'present' && !isCurrentDayAutoMarked;
                              
                              // Check if this day is present (from weeklyData or current entry if it's the selected day)
                              // If showPenaltyPresentChip is true, it means first off day is manually present, so consider it present
                              const isPresent = dayValue === true || 
                                (isCurrentDay && isCurrentDayManuallyPresent) ||
                                (showPenaltyPresentChip && isFirstOffDay);
                              const isAbsent = dayValue === false && !(isCurrentDay && isCurrentDayManuallyPresent) && !(showPenaltyPresentChip && isFirstOffDay);
                              const autoMarkReason = autoMarkedReasons[day];
                              const isAutoMarked = !!autoMarkReason && autoMarkReason !== null && autoMarkReason !== undefined;
                              // Check if this is a penalty day (marked as absent due to threshold breach)
                              // Only consider it a penalty day if it's absent - if it's present, it's not a penalty day
                              const isPenaltyDay = isAbsent && autoMarkReason && autoMarkReason.includes('Penalty day');
                              
                              // Show orange chip if: threshold breached AND this is first off day AND it's present AND manually marked (not auto-marked)
                              // This means employee came on off day that is marked as penalty day
                              const isPenaltyPresentChip = showPenaltyPresentChip && isFirstOffDay && isPresent && !isAutoMarked;
                              
                              // If day is present but has penalty-related autoMarkReason, it shouldn't be treated as auto-marked for penalty
                              // Instead, it should be treated as manually marked present (orange chip)
                              const hasPenaltyReasonButPresent = isPresent && autoMarkReason && autoMarkReason.includes('Penalty day');
                              
                              // Debug log for penalty chip
                              if (isThresholdBreached && isFirstOffDay) {
                                logger.debug(`🟠 Penalty chip check for ${entry?.employee_id} - ${day}:`, {
                                  showPenaltyPresentChip,
                                  isFirstOffDay,
                                  isPresent,
                                  dayValue,
                                  isCurrentDay,
                                  isCurrentDayManuallyPresent,
                                  entryStatus: entry.status,
                                  isPenaltyPresentChip,
                                  firstOffDayCode
                                });
                              }
                              
                              // Debug log for auto-marked days
                              if (isAutoMarked) {
                                logger.debug(`🔵 Auto-marked day detected: ${entry?.employee_id} - ${day} - Reason: ${autoMarkReason}`);
                              }
                              
                              // Track if this chip was reverted locally
                              const wasReverted = revertedPenaltyChips.has(`${employee.employee_id}-${day}`);

                              // Determine chip color and tooltip based on rules:
                              // 1. Orange: Employee came on off day that is marked as penalty day (threshold breached + first off day manually marked present)
                              // 2. Green with tooltip: Auto-marked present (Sunday bonus)
                              // 3. Red with tooltip: Penalty day (absent due to threshold breach)
                              // 4. Green/Red plain: Regular present/absent
                              
                              let chipColor = '';
                              let chipTooltip = '';
                              let showInfoIcon = false;
                              
                              if (isPresent) {
                                // Check if it's a penalty present chip (manually marked present on penalty day)
                                // OR if it has penalty reason but is present (should be treated as penalty present)
                                if (isPenaltyPresentChip || hasPenaltyReasonButPresent) {
                                  // Rule 4: Employee came on off day that is penalty day - show orange
                                  chipColor = 'bg-orange-100 text-orange-800 border-orange-300';
                                  chipTooltip = 'Penalty day is marked as present';
                                  showInfoIcon = true;
                                } else if (isAutoMarked) {
                                  // Rule 1: Auto-marked present (Sunday bonus) - show green with tooltip
                                  chipColor = 'bg-teal-100 text-teal-800 border-teal-700';
                                  chipTooltip = autoMarkReason || 'Auto-marked present';
                                  showInfoIcon = true;
                                } else {
                                  // Rule 3: Plain present - show green
                                  chipColor = 'bg-teal-100 text-teal-800 border-teal-700';
                                  chipTooltip = 'Present';
                                  showInfoIcon = false;
                                }
                              } else if (isAbsent) {
                                if (isPenaltyDay) {
                                  // Rule 2: Penalty day (absent due to threshold breach)
                                  if (wasReverted) {
                                    // Reverted penalty should appear purple
                                    chipColor = 'bg-purple-200 text-purple-900 border-purple-500';
                                    chipTooltip = 'Penalty reverted for this day';
                                    showInfoIcon = true;
                                  } else {
                                    chipColor = 'bg-red-200 text-red-900 border-red-500';
                                    chipTooltip = autoMarkReason || 'Penalty day - Absent more than threshold';
                                    showInfoIcon = true;
                                  }
                                } else {
                                  // Rule 3: Plain absent - show red
                                  chipColor = 'bg-red-100 text-red-800 border-red-300';
                                  chipTooltip = 'Absent';
                                  showInfoIcon = false;
                                }
                              } else {
                                // Unmarked
                                chipColor = 'bg-gray-100 text-gray-600 border-gray-300';
                                chipTooltip = 'Unmarked';
                                showInfoIcon = false;
                              }
                              
                              // Check if this is a penalty day that can be reverted
                              const isPenaltyDayClickable = isPenaltyDay && isThresholdBreached;

                              return (
                                <button
                                  key={day}
                                  onClick={() => {
                                    if (isPenaltyDayClickable) {
                                      setSelectedPenaltyEmployee({
                                        employeeId: employee.employee_id,
                                        employeeName: employee.first_name && employee.last_name
                                          ? `${employee.first_name} ${employee.last_name}`
                                          : employee.name || 'Unknown',
                                        weeklyAttendance: entry?.weeklyAttendance || {},
                                        penaltyDayCode: day,
                                        initialPenaltyIgnored: wasReverted
                                      });
                                      setPenaltyModalOpen(true);
                                    }
                                  }}
                                  disabled={!isPenaltyDayClickable}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${chipColor} ${
                                    isPenaltyDayClickable 
                                      ? 'cursor-pointer hover:opacity-80 transition-opacity' 
                                      : ''
                                  }`}
                                  title={isPenaltyDayClickable ? 'Click to revert penalty' : chipTooltip}
                                >
                                  {day}
                                  {showInfoIcon && (
                                    <span title={chipTooltip}>
                                      <Info 
                                        size={12} 
                                        className={
                                          (isPenaltyPresentChip || hasPenaltyReasonButPresent)
                                            ? 'text-orange-700 cursor-help flex-shrink-0' 
                                            : isPenaltyDay 
                                            ? 'text-red-700 cursor-help flex-shrink-0' 
                                            : 'text-teal-600 cursor-help flex-shrink-0'
                                        } 
                                      />
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* Infinite scroll loading indicator (like attendance tracker) */}
          {loadingMore && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
              <span>Loading more employees... ({displayedEmployees.length} of {tabFilteredEmployees.length})</span>
            </div>
          )}
          
          {/* Show completion message when all loaded */}
          {!hasMore && !loading && !loadingMore && displayedEmployees.length > 0 && tabFilteredEmployees.length > INITIAL_DISPLAY_COUNT && displayedCount >= tabFilteredEmployees.length && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-lg text-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">✓ All {tabFilteredEmployees.length} employees loaded</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Penalty Revert Modal */}
      {selectedPenaltyEmployee && (
        <PenaltyRevertModal
          isOpen={penaltyModalOpen}
          onClose={() => {
            setPenaltyModalOpen(false);
            setSelectedPenaltyEmployee(null);
          }}
          employeeId={selectedPenaltyEmployee.employeeId}
          employeeName={selectedPenaltyEmployee.employeeName}
          date={selectedDate}
          weeklyAbsentThreshold={weeklyAbsentThreshold}
          weeklyAttendance={selectedPenaltyEmployee.weeklyAttendance}
          initialPenaltyIgnored={selectedPenaltyEmployee.initialPenaltyIgnored}
          onSuccess={(newIgnored?: boolean) => {
            // Refresh attendance data after penalty revert
            // Mark/unmark this chip as reverted (purple) based on toggle result
            if (selectedPenaltyEmployee?.penaltyDayCode) {
              const key = `${selectedPenaltyEmployee.employeeId}-${selectedPenaltyEmployee.penaltyDayCode}`;
              setRevertedPenaltyChips((prev) => {
                const next = new Set(prev);
                if (newIgnored) {
                  next.add(key);
                } else {
                  next.delete(key);
                }
                return next;
              });
            }
            invalidateCache();
            fetchEligibleEmployees();
          }}
        />
      )}
    </div>
  );
};

export default HRAttendanceLog;