import React, { useState, useEffect } from 'react';
import { Search, Eye, Edit, Plus, Download, MoreVertical, Trash2, ChevronDown, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { exportToExcel, EmployeeData } from '../utils/excelExport';
import { apiCall } from '../services/api';
import { SkeletonTable, SkeletonSearchBar, SkeletonButton } from './SkeletonComponents';
import { logger } from '../utils/logger';
import Dropdown, { DropdownOption } from './Dropdown';
import { getDropdownOptions, DropdownOptions } from '../services/dropdownService';
import CustomDateInputWithOverlay from './CustomDateInputWithOverlay';
import RecentBulkActions from './RecentBulkActions';

interface AttendanceRecord {
  employee_id: string;
  present_days?: number;
  absent_days?: number;
  ot_hours?: number;
  late_minutes?: number;
  total_working_days?: number;
}

interface DirectoryData {
  id: number;
  employee_id: string;
  name: string;
  mobile_number: string;
  email: string;
  department: string;
  designation: string;
  is_active: boolean;
  inactive_marked_at?: string | null;
  basic_salary: number;
  shift_start_time: string;
  shift_end_time: string;
  last_salary: number;
  last_month: string;
  off_days: string;
  location_branch: string;
  off_monday: boolean;
  off_tuesday: boolean;
  off_wednesday: boolean;
  off_thursday: boolean;
  off_friday: boolean;
  off_saturday: boolean;
  off_sunday: boolean;
}

const HRDirectory: React.FC = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showMenu, setShowMenu] = useState<boolean>(false);
  
  // Progressive loading state (like attendance tracker)
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [offset, setOffset] = useState<number>(0);
  const BATCH_SIZE = 30;

  // Add a new state to store the departments to be applied
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [pendingDepartments, setPendingDepartments] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  
  // Active/Inactive filter state
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
  const [showEmployeeDetail, setShowEmployeeDetail] = useState(false);
  
  // Delete confirmation state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeData | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk selection state
  const [selectedEmployees, setSelectedEmployees] = useState<Set<number>>(new Set());
  const [showBulkActionsDropdown, setShowBulkActionsDropdown] = useState(false);
  
  // Bulk update modal state
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkUpdateField, setBulkUpdateField] = useState<string>('');
  const [bulkUpdateValue, setBulkUpdateValue] = useState<any>('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  
  // Recent bulk actions modal state
  const [showRecentActions, setShowRecentActions] = useState(false);

  // Dropdown options state
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOptions>({
    departments: [] as string[],
    locations: [] as string[],
    designations: [] as string[],
    cities: [] as string[],
    states: [] as string[]
  });

  // Weekly absent penalty enabled state (from settings)
  const [weeklyAbsentPenaltyEnabled, setWeeklyAbsentPenaltyEnabled] = useState<boolean>(false);

  // Fetch salary config to check if weekly absent penalty is enabled
  useEffect(() => {
    const fetchSalaryConfig = async () => {
      try {
        const response = await apiCall('/api/salary-config/', { method: 'GET' });
        if (response && response.ok) {
          const data = await response.json();
          setWeeklyAbsentPenaltyEnabled(!!data.weekly_absent_penalty_enabled);
        }
      } catch (error) {
        logger.warn('Failed to load salary config for weekly rules');
      }
    };
    fetchSalaryConfig();
  }, []);

  // Initialize off_days as object when opening modal
  useEffect(() => {
    if (bulkUpdateField === 'off_days' && showBulkUpdateModal && typeof bulkUpdateValue !== 'object') {
      setBulkUpdateValue({
        off_monday: false,
        off_tuesday: false,
        off_wednesday: false,
        off_thursday: false,
        off_friday: false,
        off_saturday: false,
        off_sunday: false
      });
    }
    // Initialize weekly_rules_enabled as boolean when opening modal (only if not already set)
    if (bulkUpdateField === 'weekly_rules_enabled' && showBulkUpdateModal && typeof bulkUpdateValue !== 'boolean') {
      // Value should already be set in handleBulkAction, but ensure it's a boolean
      setBulkUpdateValue(false);
    }
  }, [bulkUpdateField, showBulkUpdateModal]);

  useEffect(() => {
    // Always call refresh function when component mounts (page is opened)
    refreshEmployeeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load dropdown options on mount
  useEffect(() => {
    const loadDropdownOptions = async () => {
      try {
        const options = await getDropdownOptions();
        setDropdownOptions(options);
      } catch (error) {
        logger.error('Error loading dropdown options:', error);
      }
    };
    loadDropdownOptions();
  }, []);

  // Listen for attendance updates to refresh directory data
  useEffect(() => {
    const handleAttendanceUpdate = () => {
      logger.info('🔄 Attendance updated event received - refreshing directory data');
      // Refresh directory data to show updated OT hours and late minutes
      // Reset offset to start from beginning and force fresh data
      setOffset(0);
      setEmployees([]); // Clear existing data to force fresh fetch
      refreshEmployeeData(false, true); // Force full refresh with cache bypass
    };

    // Listen for custom events that indicate data changes
    window.addEventListener('attendanceUpdated', handleAttendanceUpdate);
    window.addEventListener('refreshEmployeeData', handleAttendanceUpdate);

    return () => {
      window.removeEventListener('attendanceUpdated', handleAttendanceUpdate);
      window.removeEventListener('refreshEmployeeData', handleAttendanceUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Note: Infinite scroll removed - now using automatic batch loading like attendance tracker
  // Background loading happens automatically after initial load with 500ms delays


  // Progressive loading function (like attendance tracker)
  const refreshEmployeeData = async (loadMore: boolean = false, forceRefresh: boolean = false) => {
    try {
      // Show appropriate loading indicator
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setOffset(0);
      }
      
      // Build query parameters for progressive loading
      const currentOffset = loadMore ? offset : 0;
      const params = new URLSearchParams();
      params.append('offset', currentOffset.toString());
      params.append('limit', BATCH_SIZE.toString());
      
      // Add cache-busting parameter when force refreshing (e.g., after attendance update)
      // This ensures we get fresh data with updated OT hours and late minutes
      // The backend clears cache on attendance save, but this ensures fresh data
      if (forceRefresh) {
        params.append('no_cache', 'true'); // Force fresh data from database
      }
      
      logger.info( `⚡ Fetching employees: offset=${currentOffset}, limit=${BATCH_SIZE}, loadMore=${loadMore}`);
      logger.info( `📡 API URL: /api/employees/directory_data/?${params.toString()}`);
      
      // UNIFIED API: Only call directory_data endpoint which includes all attendance data
      const directoryResponse = await apiCall(`/api/employees/directory_data/?${params.toString()}`);
      
      logger.info( `📥 Response received for offset=${currentOffset}`);
      
      if (!directoryResponse.ok) {
        throw new Error(`Failed to fetch data: ${directoryResponse.status}`);
      }

      const directoryResponseData = await directoryResponse.json();
      const directoryData = directoryResponseData.results || directoryResponseData;
      
      // Update progressive loading state
      setTotalCount(directoryResponseData.total_count || directoryResponseData.count || 0);
      setHasMore(directoryResponseData.has_more || false);
      
      logger.info( '📊 Directory API Response:', {
        count: directoryResponseData.count,
        total_count: directoryResponseData.total_count,
        has_more: directoryResponseData.has_more,
        offset: directoryResponseData.offset,
        records_received: directoryData.length
      });
      
      // Process the data - UNIFIED: All data comes from directory_data endpoint
      const processedData = Array.isArray(directoryData) 
        ? directoryData.map((employee: any) => ({
            id: employee.id,
            employee_id: employee.employee_id,
            name: normalizeField(employee.name),
            mobile_number: normalizeField(employee.mobile_number),
            email: normalizeField(employee.email),
            department: normalizeDepartment(employee.department),
            designation: normalizeField(employee.designation),
            employment_type: normalizeEmploymentType(employee.employment_type),
            date_of_joining: employee.date_of_joining ? new Date(employee.date_of_joining).toLocaleDateString() : '-',
            branch_location: normalizeField(employee.location_branch),
            attendance: employee.attendance?.attendance_percentage ? `${employee.attendance.attendance_percentage}%` :
                      (employee.total_present && employee.total_absent ?
                       `${((employee.total_present / (employee.total_present + employee.total_absent)) * 100).toFixed(1)}%` : '-'),
            ot_hours: employee.attendance?.total_ot_hours ? `${employee.attendance.total_ot_hours} hrs` :
                     (employee.total_ot_hours ? `${employee.total_ot_hours} hrs` : '-'),
            late_hours: employee.attendance?.total_late_minutes ? `${(employee.attendance.total_late_minutes / 60).toFixed(1)} hrs` : '-',
            shiftStartTime: normalizeField(employee.shift_start_time),
            shiftEndTime: normalizeField(employee.shift_end_time),
            basic_salary: normalizeField(employee.basic_salary),
            is_active: employee.is_active || false,
          inactive_marked_at: employee.inactive_marked_at || null,
            off_days: normalizeField(employee.off_days),
            weekly_rules_enabled: employee.weekly_rules_enabled ?? false
          }))
        : [];

      // Append or replace data based on loadMore
      if (loadMore) {
        // DEDUPLICATE: Prevent adding same employees multiple times
        const existingIds = new Set(employees.map(e => e.id));
        const existingEmployeeIds = new Set(employees.map(e => e.employee_id));
        const newEmployees = processedData.filter(e => !existingIds.has(e.id) && !existingEmployeeIds.has(e.employee_id));
        
        if (processedData.length > newEmployees.length) {
          logger.warn(`⚠️ Skipped ${processedData.length - newEmployees.length} duplicate employees in batch`);
          logger.warn('Duplicate IDs:', processedData.filter(e => existingIds.has(e.id) || existingEmployeeIds.has(e.employee_id)).map(e => e.id));
        }
        
        const updatedData = [...employees, ...newEmployees];
        setEmployees(updatedData);
        setOffset(currentOffset + BATCH_SIZE);
        logger.info( `⚡ Loaded ${newEmployees.length} new employees. Total: ${updatedData.length}/${directoryResponseData.total_count || 0}`);
      } else {
      setEmployees(processedData);
        setOffset(BATCH_SIZE);
        logger.info( `✅ Initial load: ${processedData.length} employees of ${directoryResponseData.total_count || 0} total`);
        
        // Check if backend served from cache
        const isFromCache = directoryResponseData.performance?.cached || false;
        const cacheSource = directoryResponseData.performance?.optimization_level || 'unknown';
        logger.info( `📦 Cache status: ${isFromCache ? 'HIT' : 'MISS'} (${cacheSource})`);
        
        // SMART LOADING: If cache hit, fetch ALL remaining in ONE call
        if (isFromCache && directoryResponseData.has_more && directoryResponseData.total_count > BATCH_SIZE) {
          const remaining = directoryResponseData.total_count - BATCH_SIZE;
          logger.info( `⚡ Cache HIT! Fetching all remaining ${remaining} employees in ONE call...`);
          setTimeout(() => {
            fetchAllRemainingAtOnce(BATCH_SIZE, remaining);
          }, 100);
        } else if (directoryResponseData.has_more && directoryResponseData.total_count > BATCH_SIZE) {
          // NORMAL LOADING: Cache miss - fetch in batches with delays
          logger.info( `💾 Cache MISS - Loading in batches of ${BATCH_SIZE}...`);
          setTimeout(() => {
            fetchRemainingEmployees(BATCH_SIZE, directoryResponseData.total_count);
          }, 500);
        }
      }
      
      setError(null);
    } catch (err) {
      setError('Failed to refresh employee data');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  
  // Fetch ALL remaining employees in ONE call (when cached)
  const fetchAllRemainingAtOnce = async (startOffset: number, remainingCount: number) => {
    try {
      logger.info( `📡 Fetching ${remainingCount} employees from offset ${startOffset}...`);
      
      const params = new URLSearchParams();
      params.append('offset', startOffset.toString());
      params.append('limit', remainingCount.toString()); // Get ALL remaining at once
      
      const response = await apiCall(`/api/employees/directory_data/?${params.toString()}`);
      if (!response.ok) {
        logger.error('Failed to fetch remaining employees');
        return;
      }
      
      const data = await response.json();
      const newData = data.results || data;
      
      // Process all employees
      const processedBatch = Array.isArray(newData) 
        ? newData.map((employee: any) => ({
            id: employee.id,
            employee_id: employee.employee_id,
            name: normalizeField(employee.name),
            mobile_number: normalizeField(employee.mobile_number),
            email: normalizeField(employee.email),
            department: normalizeDepartment(employee.department),
            designation: normalizeField(employee.designation),
            employment_type: normalizeEmploymentType(employee.employment_type),
            date_of_joining: employee.date_of_joining ? new Date(employee.date_of_joining).toLocaleDateString() : '-',
            branch_location: normalizeField(employee.location_branch),
            attendance: employee.attendance?.attendance_percentage ? `${employee.attendance.attendance_percentage}%` :
                      (employee.total_present && employee.total_absent ?
                       `${((employee.total_present / (employee.total_present + employee.total_absent)) * 100).toFixed(1)}%` : '-'),
            ot_hours: employee.attendance?.total_ot_hours ? `${employee.attendance.total_ot_hours} hrs` :
                     (employee.total_ot_hours ? `${employee.total_ot_hours} hrs` : '-'),
            late_hours: employee.attendance?.total_late_minutes ? `${(employee.attendance.total_late_minutes / 60).toFixed(1)} hrs` : '-',
            shiftStartTime: normalizeField(employee.shift_start_time),
            shiftEndTime: normalizeField(employee.shift_end_time),
            basic_salary: normalizeField(employee.basic_salary),
            is_active: employee.is_active || false,
            inactive_marked_at: employee.inactive_marked_at || null,
            off_days: normalizeField(employee.off_days),
            weekly_rules_enabled: employee.weekly_rules_enabled ?? false
          }))
        : [];
      
      // DEDUPLICATE and add all at once
      setEmployees(prev => {
        const existingIds = new Set(prev.map(e => e.id));
        const existingEmployeeIds = new Set(prev.map(e => e.employee_id));
        const newEmployees = processedBatch.filter(e => 
          !existingIds.has(e.id) && !existingEmployeeIds.has(e.employee_id)
        );
        
        if (newEmployees.length < processedBatch.length) {
          const skipped = processedBatch.length - newEmployees.length;
          logger.warn(`⚠️ Skipped ${skipped} duplicate employees`);
        }
        
        return [...prev, ...newEmployees];
      });
      
      const isCached = data.performance?.cached || false;
      const cacheIndicator = isCached ? '⚡ CACHED' : '💾 DB';
      logger.info( `✅ ${cacheIndicator} - Loaded all ${processedBatch.length} remaining employees in ONE call!`);
      setHasMore(false);
      
    } catch (error) {
      logger.error('Error fetching all remaining employees:', error);
    }
  };

  // Fetch remaining employees in background (batch by batch - for cache miss)
  const fetchRemainingEmployees = async (startOffset: number, total: number) => {
    let currentOffset = startOffset;
    
    while (currentOffset < total) {
      try {
        const params = new URLSearchParams();
        params.append('offset', currentOffset.toString());
        params.append('limit', BATCH_SIZE.toString());
        
        const response = await apiCall(`/api/employees/directory_data/?${params.toString()}`);
        if (!response.ok) break;
        
        const data = await response.json();
        const newData = data.results || data;
        
        // Detect cache hit - switch to single-call mode!
        const isCached = data.performance?.cached || false;
        if (isCached && currentOffset === startOffset) {
          // First batch hit cache! Get ALL remaining in one call instead
          logger.info( '⚡ Cache HIT detected on first batch! Fetching all remaining in ONE call...');
          
          // Process current batch first
          const processedBatch = Array.isArray(newData) 
            ? newData.map((employee: any) => ({
                id: employee.id,
                employee_id: employee.employee_id,
                name: normalizeField(employee.name),
                mobile_number: normalizeField(employee.mobile_number),
                email: normalizeField(employee.email),
                department: normalizeDepartment(employee.department),
                designation: normalizeField(employee.designation),
                employment_type: normalizeEmploymentType(employee.employment_type),
                date_of_joining: employee.date_of_joining ? new Date(employee.date_of_joining).toLocaleDateString() : '-',
                branch_location: normalizeField(employee.location_branch),
                attendance: employee.attendance?.attendance_percentage ? `${employee.attendance.attendance_percentage}%` :
                          (employee.total_present && employee.total_absent ?
                           `${((employee.total_present / (employee.total_present + employee.total_absent)) * 100).toFixed(1)}%` : '-'),
                ot_hours: employee.attendance?.total_ot_hours ? `${employee.attendance.total_ot_hours} hrs` :
                         (employee.total_ot_hours ? `${employee.total_ot_hours} hrs` : '-'),
                late_hours: employee.attendance?.total_late_minutes ? `${(employee.attendance.total_late_minutes / 60).toFixed(1)} hrs` : '-',
                shiftStartTime: normalizeField(employee.shift_start_time),
                shiftEndTime: normalizeField(employee.shift_end_time),
                basic_salary: normalizeField(employee.basic_salary),
                is_active: employee.is_active || false,
                inactive_marked_at: employee.inactive_marked_at || null,
                off_days: normalizeField(employee.off_days),
                weekly_rules_enabled: employee.weekly_rules_enabled ?? false
              }))
            : [];
          
          setEmployees(prev => {
            const existingIds = new Set(prev.map(e => e.id));
            const existingEmployeeIds = new Set(prev.map(e => e.employee_id));
            const newEmployees = processedBatch.filter(e => 
              !existingIds.has(e.id) && !existingEmployeeIds.has(e.employee_id)
            );
            return [...prev, ...newEmployees];
          });
          
          currentOffset += BATCH_SIZE;
          logger.info( `📦 ⚡ CACHED - Loaded batch: ${currentOffset}/${total} employees`);
          
          // Now fetch ALL remaining in ONE call
          const remaining = total - currentOffset;
          if (remaining > 0) {
            await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
            await fetchAllRemainingAtOnce(currentOffset, remaining);
          } else {
            setHasMore(false);
          }
          
          return; // Exit the loop
        }
        
        if (newData.length === 0) break;
        
        // Process new batch
        const processedBatch = Array.isArray(newData) 
          ? newData.map((employee: any) => ({
              id: employee.id,
              employee_id: employee.employee_id,
              name: normalizeField(employee.name),
              mobile_number: normalizeField(employee.mobile_number),
              email: normalizeField(employee.email),
              department: normalizeDepartment(employee.department),
              designation: normalizeField(employee.designation),
              employment_type: normalizeEmploymentType(employee.employment_type),
              date_of_joining: employee.date_of_joining ? new Date(employee.date_of_joining).toLocaleDateString() : '-',
              branch_location: normalizeField(employee.location_branch),
              attendance: employee.attendance?.attendance_percentage ? `${employee.attendance.attendance_percentage}%` :
                        (employee.total_present && employee.total_absent ?
                         `${((employee.total_present / (employee.total_present + employee.total_absent)) * 100).toFixed(1)}%` : '-'),
              ot_hours: employee.attendance?.total_ot_hours ? `${employee.attendance.total_ot_hours} hrs` :
                       (employee.total_ot_hours ? `${employee.total_ot_hours} hrs` : '-'),
              late_hours: employee.attendance?.total_late_minutes ? `${(employee.attendance.total_late_minutes / 60).toFixed(1)} hrs` : '-',
              shiftStartTime: normalizeField(employee.shift_start_time),
              shiftEndTime: normalizeField(employee.shift_end_time),
              basic_salary: normalizeField(employee.basic_salary),
              is_active: employee.is_active || false,
              inactive_marked_at: employee.inactive_marked_at || null,
              off_days: normalizeField(employee.off_days),
              weekly_rules_enabled: employee.weekly_rules_enabled ?? false
            }))
          : [];
        
        // DEDUPLICATE: Prevent adding same employees multiple times
        setEmployees(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          const existingEmployeeIds = new Set(prev.map(e => e.employee_id));
          const newEmployees = processedBatch.filter(e => 
            !existingIds.has(e.id) && !existingEmployeeIds.has(e.employee_id)
          );
          
          if (newEmployees.length < processedBatch.length) {
            const skipped = processedBatch.length - newEmployees.length;
            logger.warn(`⚠️ Skipped ${skipped} duplicate employees in background batch`);
          }
          
          return [...prev, ...newEmployees];
        });
        currentOffset += BATCH_SIZE;
        
        logger.info( `📦 💾 DB - Background loaded: ${currentOffset}/${total} employees (batching...)`);
        
        // Delay between batches to avoid overwhelming server
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        logger.error('Error in background loading:', error);
        break;
      }
    }
    
    setHasMore(false);
    logger.info( `✅ All ${total} employees loaded`);
  };
  
  // Note: fetchRemainingEmployees kept for potential future use
  // Currently using infinite scroll instead of background auto-load

  // Function to calculate attendance percentage, OT hours, and late hours for an employee
  const calculateEmployeeMetrics = (employeeId: string, attendanceRecords: AttendanceRecord[]) => {
    const employeeAttendance = attendanceRecords.filter(record => record.employee_id === employeeId);
    
    if (employeeAttendance.length === 0) {
      return {
        attendancePercentage: '-',
        totalOTHours: '-',
        totalLateHours: '-'
      };
    }

    // Calculate total present days, working days, OT hours, and late minutes from attendance records
    let totalPresent = 0;
    let totalWorkingDays = 0;
    let totalOTHours = 0;
    let totalLateMinutes = 0;

    employeeAttendance.forEach(record => {
      const present = parseFloat(record.present_days?.toString() || '0');
      const workingDays = parseFloat(record.total_working_days?.toString() || '0');
      const otHours = parseFloat(record.ot_hours?.toString() || '0');
      const lateMinutes = parseFloat(record.late_minutes?.toString() || '0');

      totalPresent += present;
      totalWorkingDays += workingDays;
      totalOTHours += otHours;
      totalLateMinutes += lateMinutes;
    });

    // Calculate attendance percentage using proper formula
    const attendancePercentage = totalWorkingDays > 0 
      ? `${((totalPresent / totalWorkingDays) * 100).toFixed(1)}%`
      : '-';

    // Format OT hours
    const formattedOTHours = totalOTHours > 0 
      ? `${totalOTHours.toFixed(2)} hrs`
      : '-';

    // Format late hours (convert minutes to hours)
    const formattedLateHours = totalLateMinutes > 0 
      ? `${(totalLateMinutes / 60).toFixed(1)} hrs`
      : '-';

    return {
      attendancePercentage,
      totalOTHours: formattedOTHours,
      totalLateHours: formattedLateHours
    };
  };

  // Function to process and combine directory and attendance data
  const processEmployeeData = (directoryData: DirectoryData[], attendanceRecords: AttendanceRecord[]): EmployeeData[] => {
    return directoryData.map(employee => {
      const metrics = calculateEmployeeMetrics(employee.employee_id, attendanceRecords);
      
      return {
        id: employee.id,
        employee_id: employee.employee_id,
        name: normalizeField(employee.name),
        mobile_number: normalizeField(employee.mobile_number),
        email: normalizeField(employee.email),
        department: normalizeField(employee.department),
        designation: normalizeField(employee.designation),
        employment_type: normalizeEmploymentType('FULL_TIME'), // Default value since DirectoryData interface doesn't include this field
        branch_location: normalizeField(employee.location_branch), // Default value since DirectoryData interface doesn't include this field
        attendance: metrics.attendancePercentage,
        ot_hours: metrics.totalOTHours,
        late_hours: metrics.totalLateHours,
        shiftStartTime: normalizeField(employee.shift_start_time),
        shiftEndTime: normalizeField(employee.shift_end_time),
        basic_salary: normalizeField(employee.basic_salary),
        is_active: employee.is_active,
        inactive_marked_at: employee.inactive_marked_at || null,
        off_days: normalizeField(employee.off_days, 'None')
      };
    });
  };

  // Filter employees based on search query, department, and active status
  const filteredEmployees = employees.filter(employee => {
    // Filter by department
    if (selectedDepartments.length > 0 && !selectedDepartments.includes(employee.department)) {
      return false;
    }
    
    // Filter by active/inactive status
    if (activeStatusFilter === 'active' && !employee.is_active) {
      return false;
    }
    if (activeStatusFilter === 'inactive' && employee.is_active) {
      return false;
    }
    
    // Filter by search query
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    try {
      return (
        employee.name.toLowerCase().includes(query) ||
        employee.employee_id.toLowerCase().includes(query) ||
        employee.department.toLowerCase().includes(query) ||
        employee.designation.toLowerCase().includes(query)
      );
    } catch (error) {
      logger.error('Error filtering employee:', error, employee);
      return false;
    }
  });

  // Use all filtered employees instead of pagination
  const currentEntries = filteredEmployees;

  // Handle checkbox selection
  const handleSelectEmployee = (employeeId: number) => {
    setSelectedEmployees(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(new Set(currentEntries.map(emp => emp.id)));
    } else {
      setSelectedEmployees(new Set());
    }
  };

  // Check if all visible employees are selected
  const allSelected = currentEntries.length > 0 && currentEntries.every(emp => selectedEmployees.has(emp.id));
  const someSelected = currentEntries.some(emp => selectedEmployees.has(emp.id)) && !allSelected;
  const hasSelectedEmployees = selectedEmployees.size > 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.bulk-actions-dropdown')) {
        setShowBulkActionsDropdown(false);
      }
    };

    if (showBulkActionsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showBulkActionsDropdown]);

  // Handle bulk actions
  const handleBulkAction = async (action: string) => {
    const selectedIds = Array.from(selectedEmployees);
    const selectedEmployeesData = employees.filter(emp => selectedIds.includes(emp.id));
    
    switch (action) {
      case 'activate':
        // Bulk activate employees
        try {
          const inactiveIds = selectedEmployeesData
            .filter(emp => !emp.is_active)
            .map(emp => emp.id);
          
          if (inactiveIds.length === 0) {
            alert('All selected employees are already active');
            setSelectedEmployees(new Set());
            break;
          }
          
          // Optimistic update
          setEmployees(prev => 
            prev.map(emp => 
              inactiveIds.includes(emp.id)
                ? { ...emp, is_active: true, inactive_marked_at: null }
                : emp
            )
          );
          
          const response = await apiCall('/api/employees/bulk_toggle_active_status/', {
            method: 'POST',
            body: JSON.stringify({
              employee_ids: inactiveIds,
              is_active: true
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            // Update with server response
            setEmployees(prev => 
              prev.map(emp => 
                inactiveIds.includes(emp.id)
                  ? { ...emp, is_active: true, inactive_marked_at: null }
                  : emp
              )
            );
            // Dispatch event for other components
            window.dispatchEvent(new CustomEvent('employeeStatusChanged', { 
              detail: { employeeIds: inactiveIds, is_active: true, timestamp: Date.now() } 
            }));
            alert(`Successfully activated ${data.updated_count || inactiveIds.length} employee(s)`);
          } else {
            // Revert on failure
            setEmployees(prev => 
              prev.map(emp => 
                inactiveIds.includes(emp.id)
                  ? { ...emp, is_active: false }
                  : emp
              )
            );
            const errorData = await response.json().catch(() => ({}));
            alert(`Failed to activate employees: ${errorData.error || 'Unknown error'}`);
          }
        } catch (error) {
          logger.error('Error in bulk activate:', error);
          alert('Failed to activate employees. Please try again.');
        }
        setSelectedEmployees(new Set());
        break;
      case 'deactivate':
        // Bulk deactivate employees
        try {
          const activeIds = selectedEmployeesData
            .filter(emp => emp.is_active)
            .map(emp => emp.id);
          
          if (activeIds.length === 0) {
            alert('All selected employees are already inactive');
            setSelectedEmployees(new Set());
            break;
          }
          
          const inactiveDate = new Date().toISOString().split('T')[0];
          
          // Optimistic update
          setEmployees(prev => 
            prev.map(emp => 
              activeIds.includes(emp.id)
                ? { ...emp, is_active: false, inactive_marked_at: inactiveDate }
                : emp
            )
          );
          
          const response = await apiCall('/api/employees/bulk_toggle_active_status/', {
            method: 'POST',
            body: JSON.stringify({
              employee_ids: activeIds,
              is_active: false
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            // Update with server response
            setEmployees(prev => 
              prev.map(emp => 
                activeIds.includes(emp.id)
                  ? { ...emp, is_active: false, inactive_marked_at: inactiveDate }
                  : emp
              )
            );
            // Dispatch event for other components
            window.dispatchEvent(new CustomEvent('employeeStatusChanged', { 
              detail: { employeeIds: activeIds, is_active: false, timestamp: Date.now() } 
            }));
            alert(`Successfully deactivated ${data.updated_count || activeIds.length} employee(s)`);
          } else {
            // Revert on failure
            setEmployees(prev => 
              prev.map(emp => 
                activeIds.includes(emp.id)
                  ? { ...emp, is_active: true }
                  : emp
              )
            );
            const errorData = await response.json().catch(() => ({}));
            alert(`Failed to deactivate employees: ${errorData.error || 'Unknown error'}`);
          }
        } catch (error) {
          logger.error('Error in bulk deactivate:', error);
          alert('Failed to deactivate employees. Please try again.');
        }
        setSelectedEmployees(new Set());
        break;
      case 'delete':
        // Show confirmation for bulk delete
        if (window.confirm(`Are you sure you want to delete ${selectedEmployeesData.length} employee(s)? This action cannot be undone.`)) {
          for (const emp of selectedEmployeesData) {
            await apiCall(`/api/employees/${emp.id}/`, { method: 'DELETE' });
          }
          setEmployees(prev => prev.filter(emp => !selectedIds.includes(emp.id)));
          setSelectedEmployees(new Set());
        }
        break;
      case 'off_days':
        // Open bulk update modal for off days
        setBulkUpdateField(action);
        setBulkUpdateValue({
          off_monday: false,
          off_tuesday: false,
          off_wednesday: false,
          off_thursday: false,
          off_friday: false,
          off_saturday: false,
          off_sunday: false
        });
        setShowBulkUpdateModal(true);
        break;
      case 'weekly_rules_enabled':
        // Open bulk update modal for weekly rules
        // Check if all selected employees have the same weekly_rules_enabled value
        if (selectedEmployeesData.length > 0) {
          const allWeeklyRulesValues = selectedEmployeesData.map(emp => (emp as any).weekly_rules_enabled);
          const allSame = allWeeklyRulesValues.every(val => val === allWeeklyRulesValues[0]);
          // If all selected employees have the same value, use that value; otherwise default to false
          setBulkUpdateValue(allSame ? allWeeklyRulesValues[0] : false);
        } else {
          setBulkUpdateValue(false);
        }
        setBulkUpdateField(action);
        setShowBulkUpdateModal(true);
        break;
      case 'department':
      case 'designation':
      case 'employment_type':
      case 'date_of_joining':
      case 'location_branch':
      case 'basic_salary':
      case 'shift_timings':
        // Open bulk update modal for these fields
        setBulkUpdateField(action);
        if (action === 'shift_timings') {
          setBulkUpdateValue({
            shift_start_time: '',
            shift_end_time: ''
          });
        } else {
          setBulkUpdateValue('');
        }
        setShowBulkUpdateModal(true);
        break;
      default:
        break;
    }
    setShowBulkActionsDropdown(false);
  };

  // Handle bulk update submission
  const handleBulkUpdateSubmit = async () => {
    // Filter selected IDs to only include employees that are currently visible (match current filters)
    const visibleEmployeeIds = new Set(filteredEmployees.map(emp => emp.id));
    const selectedIds = Array.from(selectedEmployees).filter(id => visibleEmployeeIds.has(id));
    
    if (selectedIds.length === 0) {
      alert('No employees selected from the current filtered view. Please select at least one employee.');
      return;
    }

    // Validate input
    if (bulkUpdateField === 'off_days') {
      if (!bulkUpdateValue || typeof bulkUpdateValue !== 'object') {
        alert('Please select at least one off day');
        return;
      }
    } else if (bulkUpdateField === 'shift_timings') {
      if (!bulkUpdateValue || typeof bulkUpdateValue !== 'object' || !bulkUpdateValue.shift_start_time || !bulkUpdateValue.shift_end_time) {
        alert('Please enter both shift start time and end time');
        return;
      }
    } else if (bulkUpdateField === 'weekly_rules_enabled') {
      // weekly_rules_enabled is a boolean, no validation needed
      if (typeof bulkUpdateValue !== 'boolean') {
        alert('Invalid value for weekly rules');
        return;
      }
    } else if (!bulkUpdateValue || bulkUpdateValue === '') {
      alert('Please enter a value');
      return;
    }

    setBulkUpdating(true);
    try {
      const updates: any = {};
      
      if (bulkUpdateField === 'off_days') {
        // Handle off days - bulkUpdateValue should be an object with day flags
        Object.assign(updates, bulkUpdateValue);
      } else if (bulkUpdateField === 'shift_timings') {
        // Handle shift timings - bulkUpdateValue should be an object with shift_start_time and shift_end_time
        updates.shift_start_time = bulkUpdateValue.shift_start_time;
        updates.shift_end_time = bulkUpdateValue.shift_end_time;
      } else if (bulkUpdateField === 'date_of_joining') {
        updates.date_of_joining = bulkUpdateValue;
      } else if (bulkUpdateField === 'basic_salary') {
        const salaryValue = parseFloat(bulkUpdateValue.toString().replace(/,/g, ''));
        if (isNaN(salaryValue) || salaryValue < 0) {
          alert('Please enter a valid salary amount');
          setBulkUpdating(false);
          return;
        }
        updates.basic_salary = salaryValue;
      } else if (bulkUpdateField === 'weekly_rules_enabled') {
        // Handle weekly rules enabled - bulkUpdateValue is a boolean
        updates.weekly_rules_enabled = bulkUpdateValue;
      } else {
        updates[bulkUpdateField] = bulkUpdateValue;
      }

      const response = await apiCall('/api/employees/bulk_update/', {
        method: 'POST',
        body: JSON.stringify({
          employee_ids: selectedIds,
          updates: updates
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Successfully updated ${data.updated_count} employee(s)`);
        setShowBulkUpdateModal(false);
        setBulkUpdateField('');
        setBulkUpdateValue('');
        setSelectedEmployees(new Set());
        // Refresh employee data
        refreshEmployeeData(false, true);
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Failed to update employees: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      logger.error('Error in bulk update:', error);
      alert('Failed to update employees. Please try again.');
    } finally {
      setBulkUpdating(false);
    }
  };
  



  const handleExport = () => {
    exportToExcel(employees, 'employee_directory');
    setShowMenu(false);
  };

  const normalizeDepartment = (dept: string | undefined) => (dept && dept.trim() !== '' && dept !== '0') ? dept : '-';

  // Function to normalize employment type from API values to display format
  const normalizeEmploymentType = (employmentType: string | undefined) => {
    if (!employmentType) return '-';
    
    const employmentTypeMap: Record<string, string> = {
      'FULL_TIME': 'Full Time',
      'PART_TIME': 'Part Time', 
      'CONTRACT': 'Contract',
      'INTERN': 'Intern'
    };
    
    return employmentTypeMap[employmentType] || '-';
  };

  // Function to normalize any field value - return '-' if empty or null
  const normalizeField = (value: string | number | undefined | null, defaultValue: string = '-') => {
    if (value === null || value === undefined || value === '' || value === '0') {
      return defaultValue;
    }
    return value.toString();
  };

  // Unique departments for filter dropdown (derived from loaded employees)
  const departmentOptions = React.useMemo(() => {
    const setDep = new Set<string>();
    employees.forEach(emp => {
      setDep.add(normalizeDepartment(emp.department));
    });
    return Array.from(setDep).sort((a,b)=>a.localeCompare(b));
  }, [employees]);

  // Unique designations for dropdown (derived from loaded employees)
  const designationOptions = React.useMemo(() => {
    const setDes = new Set<string>();
    employees.forEach(emp => {
      const des = normalizeField(emp.designation);
      if (des && des !== '-') {
        setDes.add(des);
      }
    });
    return Array.from(setDes).sort((a,b)=>a.localeCompare(b));
  }, [employees]);

  // Combine backend dropdown options with employee data for bulk update dropdowns
  const bulkDepartmentOptions: DropdownOption[] = React.useMemo(() => {
    const combined = new Set<string>();
    // Add from backend dropdown options
    dropdownOptions.departments.forEach(dept => combined.add(dept));
    // Add from current employee data
    departmentOptions.forEach(dept => {
      if (dept && dept !== '-') {
        combined.add(dept);
      }
    });
    
    // Count employees by department
    const departmentCounts = new Map<string, number>();
    employees.forEach(emp => {
      if (emp.department) {
        departmentCounts.set(emp.department, (departmentCounts.get(emp.department) || 0) + 1);
      }
    });
    
    return Array.from(combined).sort((a, b) => a.localeCompare(b)).map(dept => ({
      value: dept,
      label: `${dept} (${departmentCounts.get(dept) || 0})`
    }));
  }, [dropdownOptions.departments, departmentOptions, employees]);

  const bulkDesignationOptions: DropdownOption[] = React.useMemo(() => {
    const combined = new Set<string>();
    // Add from backend dropdown options
    dropdownOptions.designations.forEach(des => combined.add(des));
    // Add from current employee data
    designationOptions.forEach(des => {
      if (des && des !== '-') {
        combined.add(des);
      }
    });
    return Array.from(combined).sort((a, b) => a.localeCompare(b)).map(des => ({
      value: des,
      label: des
    }));
  }, [dropdownOptions.designations, designationOptions]);

  // Custom add handlers for bulk update dropdowns
  const handleCustomDepartmentAdd = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      departments: prev.departments.includes(value) ? prev.departments : [...prev.departments, value]
    }));
  };

  const handleDepartmentRemove = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      departments: prev.departments.filter(d => d !== value)
    }));
    if (bulkUpdateValue === value) {
      setBulkUpdateValue('');
    }
  };

  const handleCustomDesignationAdd = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      designations: prev.designations.includes(value) ? prev.designations : [...prev.designations, value]
    }));
  };

  const handleDesignationRemove = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      designations: prev.designations.filter(d => d !== value)
    }));
    if (bulkUpdateValue === value) {
      setBulkUpdateValue('');
    }
  };

  // Unique branch locations for dropdown (derived from loaded employees)
  const locationBranchOptions = React.useMemo(() => {
    const setLoc = new Set<string>();
    employees.forEach(emp => {
      const loc = normalizeField(emp.branch_location);
      if (loc && loc !== '-') {
        setLoc.add(loc);
      }
    });
    return Array.from(setLoc).sort((a,b)=>a.localeCompare(b));
  }, [employees]);

  // Toggle employee active status with optimistic update
  const handleToggleActiveStatus = async (employeeId: number, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const previousStatus = currentStatus;
    
    // Optimistic update - update UI immediately
    setEmployees(prev => 
      prev.map(emp => 
        emp.id === employeeId 
          ? { 
              ...emp, 
              is_active: newStatus, 
              inactive_marked_at: newStatus ? null : (emp.inactive_marked_at || new Date().toISOString().split('T')[0])
            }
          : emp
      )
    );
    
    try {
      const response = await apiCall(`/api/employees/${employeeId}/toggle_active_status/`, {
        method: 'PATCH'
      });
      
      if (response.ok) {
        let inactiveMarkedAt: string | null = null;
        try {
          const data = await response.json();
          inactiveMarkedAt = data?.inactive_marked_at ?? null;
        } catch (e) {
          inactiveMarkedAt = null;
        }
        // Update with actual server response
        setEmployees(prev => 
          prev.map(emp => 
            emp.id === employeeId 
              ? { ...emp, is_active: newStatus, inactive_marked_at: inactiveMarkedAt }
              : emp
          )
        );
        
        // Dispatch event to notify other components (e.g., attendance log) to invalidate cache
        window.dispatchEvent(new CustomEvent('employeeStatusChanged', { 
          detail: { employeeId, is_active: newStatus, timestamp: Date.now() } 
        }));
      } else {
        // Revert on failure
        setEmployees(prev => 
          prev.map(emp => 
            emp.id === employeeId 
              ? { ...emp, is_active: previousStatus }
              : emp
          )
        );
        alert('Failed to update employee status. Please try again.');
      }
    } catch (error) {
      // Revert on error
      setEmployees(prev => 
        prev.map(emp => 
          emp.id === employeeId 
            ? { ...emp, is_active: previousStatus }
            : emp
        )
      );
      alert('Error updating employee status. Please try again.');
    }
  };

  // Handle delete employee
  const handleDeleteClick = (employee: EmployeeData) => {
    setEmployeeToDelete(employee);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!employeeToDelete) return;
    
    setDeleting(true);
    try {
      const response = await apiCall(`/api/employees/${employeeToDelete.id}/`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        const data = await response.json();
        logger.info('✅ Employee deleted:', data);
        
        // Remove from local state
        setEmployees(prev => prev.filter(emp => emp.id !== employeeToDelete.id));
        setTotalCount(prev => prev - 1);
        
        // Show success message
        alert(`Employee ${employeeToDelete.employee_id} and all their data deleted successfully!`);
        
        // Close modal
        setShowDeleteModal(false);
        setEmployeeToDelete(null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Failed to delete employee: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      logger.error('❌ Error deleting employee:', error);
      alert('Failed to delete employee. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="text-md p-4 flex justify-between items-end">
          <div className="flex items-center gap-4">
          <div>
            <span className="font-medium text-teal-900">Total Employees:</span>
              {searchQuery || selectedDepartments.length > 0 || activeStatusFilter !== 'all' ? (
                <span className="ml-2 text-teal-700">{filteredEmployees.length}</span>
              ) : (
                <span className="ml-2 text-teal-700">{totalCount || filteredEmployees.length}</span>
              )}
              {activeStatusFilter !== 'all' && (
                <span className="ml-2 text-sm text-gray-500">
                  ({activeStatusFilter === 'active' ? 'Active' : 'Inactive'} only)
                </span>
              )}
            </div>
          </div>
      </div>
      <div className="p-4">
        <div className="flex justify-between mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => {
                logger.info( 'Search query changed:', e.target.value);
                setSearchQuery(e.target.value);
              }}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-sm"
            />
          </div>
          
          <div className="flex items-center gap-2">
            {/* Active/Inactive Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 border border-gray-200">
              <button
                onClick={() => setActiveStatusFilter('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeStatusFilter === 'all'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveStatusFilter('active')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeStatusFilter === 'active'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setActiveStatusFilter('inactive')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeStatusFilter === 'inactive'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Inactive
              </button>
            </div>
            
            {/* Bulk Actions Dropdown - Only show when employees are selected */}
            {hasSelectedEmployees && (() => {
              // Calculate visible selected count
              const visibleSelectedCount = Array.from(selectedEmployees).filter(id => 
                filteredEmployees.some(emp => emp.id === id)
              ).length;
              
              return (
              <div className="relative bulk-actions-dropdown">
                <button
                  onClick={() => setShowBulkActionsDropdown(!showBulkActionsDropdown)}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Bulk Actions ({visibleSelectedCount}{visibleSelectedCount !== selectedEmployees.size ? ` of ${selectedEmployees.size}` : ''})
                  <ChevronDown size={16} className={showBulkActionsDropdown ? 'rotate-180' : ''} />
                </button>
                {showBulkActionsDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 divide-y divide-gray-100 z-40 max-h-96 overflow-y-auto">
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Status</div>
                    <button
                      onClick={() => handleBulkAction('activate')}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                      Activate Selected
                    </button>
                    <button
                      onClick={() => handleBulkAction('deactivate')}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                      Deactivate Selected
                    </button>
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Update Fields</div>
                    <button
                      onClick={() => handleBulkAction('department')}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Change Department
                    </button>
                    <button
                      onClick={() => handleBulkAction('designation')}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Change Designation
                    </button>
                    <button
                      onClick={() => handleBulkAction('employment_type')}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Change Employment Type
                    </button>
                    <button
                      onClick={() => handleBulkAction('date_of_joining')}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Change Date of Joining
                    </button>
                    <button
                      onClick={() => handleBulkAction('location_branch')}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Change Branch Location
                    </button>
                    <button
                      onClick={() => handleBulkAction('basic_salary')}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Change Salary
                    </button>
                    <button
                      onClick={() => handleBulkAction('off_days')}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Change Off Days
                    </button>
                    <button
                      onClick={() => handleBulkAction('shift_timings')}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Change Shift Timings
                    </button>
                    {weeklyAbsentPenaltyEnabled && (
                      <button
                        onClick={() => handleBulkAction('weekly_rules_enabled')}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Change Weekly Rules
                      </button>
                    )}
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Danger Zone</div>
                    <button
                      onClick={() => handleBulkAction('delete')}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 size={16} className="text-red-500" />
                      Delete Selected
                    </button>
                  </div>
                )}
              </div>
              );
            })()}
            
            <button 
              className="flex items-center gap-2 px-3 py-2 bg-[#1A6262] text-white rounded-lg text-sm hover:bg-[#155252]"
              onClick={() => navigate('/hr-management/directory/add')}
            >
      <Plus size={16}/>
              Add New Employee
            </button>
            
            <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-100" onClick={() => { setPendingDepartments(selectedDepartments); setShowFilter(true); }}>
              <img src="/img/filter.png" alt="Filter Icon" className="w-5 h-5" />
              Filter
            </button>
            
            <button 
              className="flex items-center gap-2 px-3 py-2 border border-teal-200 bg-teal-50 text-teal-700 rounded-lg text-sm hover:bg-teal-100 transition-colors"
              onClick={() => setShowRecentActions(true)}
              title="View recent bulk actions and undo changes"
            >
              <Clock size={16} />
              Recent Actions
            </button>
            
            <div className="relative">
              <button 
                className="p-2 border border-gray-200 rounded-lg"
                onClick={() => setShowMenu(!showMenu)}
              >
                <MoreVertical size={16} />
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 divide-y divide-gray-100 z-50">
                  <button
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    onClick={handleExport}
                  >
                    <Download size={16} className="text-gray-500" />
                    Export to Excel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="space-y-4">
            {/* Search and filter skeleton */}
            <div className="flex items-center gap-4">
              <SkeletonSearchBar />
              <SkeletonButton width="w-24" />
              <SkeletonButton width="w-32" />
            </div>
            
            {/* Table skeleton */}
            <SkeletonTable columns={18} rows={10} />
            
          </div>
        ) : error ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-red-500">{error}</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto thin-scrollbar max-h-[600px] overflow-y-auto">
              <table className="w-full min-w-max">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 left-0 bg-gray-50 z-30 w-12">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = someSelected;
                        }}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 left-12 bg-gray-50 z-30 w-48">Employee ID</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 left-60 bg-gray-50 z-30">Employee Name</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 bg-gray-50 z-20">Mobile Number</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 bg-gray-50 z-20">Email</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 bg-gray-50 z-20">Department</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 bg-gray-50 z-20">Designation</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 bg-gray-50 z-20">Employment Type</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 bg-gray-50 z-20">Date of Joining</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 bg-gray-50 z-20">Branch/Location</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 bg-gray-50 z-20">Attendance %</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 bg-gray-50 z-20">Total OT Hours</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 bg-gray-50 z-20">Total Late Hours</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 bg-gray-50 z-20">Shift Start Time</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 bg-gray-50 z-20">Shift End Time</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 bg-gray-50 z-20">Basic Salary</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 bg-gray-50 z-20">Off Days</th>
                    {weeklyAbsentPenaltyEnabled && (
                      <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 bg-gray-50 z-20">Weekly Rules</th>
                    )}
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 bg-gray-50 z-20">Status</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky top-0 bg-gray-50 z-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentEntries.length === 0 ? (
                    <tr>
                      <td colSpan={weeklyAbsentPenaltyEnabled ? 20 : 19} className="px-4 py-6 text-center text-gray-500">
                        {searchQuery ? `No employees found matching "${searchQuery}"` : 'No employee records found.'}
                      </td>
                    </tr>
                  ) : (
                    currentEntries.map((employee, index) => {
                      try {
                        return (
                      <tr key={`${employee.id}-${employee.employee_id}-${index}`} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm sticky left-0 bg-white z-20">
                          <input
                            type="checkbox"
                            checked={selectedEmployees.has(employee.id)}
                            onChange={() => handleSelectEmployee(employee.id)}
                            className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm sticky left-12 bg-white z-20">{employee.employee_id}</td>
                        <td className="px-4 py-3 text-sm sticky left-60 bg-white z-20">
                          <button
                            onClick={() => navigate(`/hr-management/employees/edit/${employee.employee_id}`)}
                            className="text-[#0B5E59] hover:underline text-left"
                          >
                            {employee.name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm">{employee.mobile_number}</td>
                        <td className="px-4 py-3 text-sm">{employee.email}</td>
                        <td className="px-4 py-3 text-sm">{normalizeDepartment(employee.department)}</td>
                        <td className="px-4 py-3 text-sm">{employee.designation}</td>
                        <td className="px-4 py-3 text-sm">{employee.employment_type}</td>
                        <td className="px-4 py-3 text-sm">{(employee as any).date_of_joining || '-'}</td>
                        <td className="px-4 py-3 text-sm">{employee.branch_location}</td>
                        <td className="px-4 py-3 text-sm">{employee.attendance}</td>
                        <td className="px-4 py-3 text-sm">{employee.ot_hours}</td>
                        <td className="px-4 py-3 text-sm">{employee.late_hours}</td>
                        <td className="px-4 py-3 text-sm">{employee.shiftStartTime}</td>
                        <td className="px-4 py-3 text-sm">{employee.shiftEndTime}</td>
                        <td className="px-4 py-3 text-sm">{employee.basic_salary}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            {employee.off_days}
                          </span>
                        </td>
                        {weeklyAbsentPenaltyEnabled && (
                          <td className="px-4 py-3 text-sm">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              (employee as any).weekly_rules_enabled === true 
                                ? 'bg-teal-100 text-teal-800' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {(employee as any).weekly_rules_enabled === true ? 'Enabled' : 'Disabled'}
                            </span>
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={employee.is_active}
                                onChange={() => handleToggleActiveStatus(employee.id, employee.is_active)}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                            </label>
                            <span className="ml-2 text-xs text-gray-500">
                              {employee.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              className="text-teal-700 hover:text-teal-800"
                              onClick={() => {
                                setSelectedEmployee(employee);
                                setShowEmployeeDetail(true);
                              }}
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              className="text-orange-500 hover:orange-700"
                              onClick={() => {
                                if (employee.employee_id) {
                                  navigate(`/hr-management/employees/edit/${employee.employee_id}`);
                                    }
                              }}
                              title="Edit Employee"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteClick(employee)}
                              title="Delete Employee"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                        );
                      } catch (error) {
                        logger.error('Error rendering employee row:', error, employee);
                        return (
                          <tr key={`error-${index}`} className="border-b border-gray-100">
                            <td colSpan={18} className="px-4 py-3 text-sm text-red-500">
                              Error rendering employee: {employee.employee_id || 'Unknown'}
                            </td>
                          </tr>
                        );
                      }
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* AUTO-LOADING: Background loading indicator */}
            {loadingMore && (
              <div className="mt-4 flex items-center justify-center gap-3 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                <span>Auto-loading employees... ({employees.length} of {totalCount})</span>
              </div>
            )}
            
            {/* AUTO-LOADING: Completion message */}
            {!hasMore && !loading && !loadingMore && employees.length > 0 && totalCount > BATCH_SIZE && (
              <div className="mt-4 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-lg text-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">✓ All {totalCount} employees loaded</span>
                </div>
              </div>
            )}


            {/* Employee Detail Modal */}
            {showEmployeeDetail && selectedEmployee && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto thin-scrollbar">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Employee Details</h2>
                    <button
                      onClick={() => {
                        setShowEmployeeDetail(false);
                        setSelectedEmployee(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Personal Information */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                        Personal Information
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedEmployee.employee_id}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Full Name</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedEmployee.name}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Mobile Number</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedEmployee.mobile_number}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Email</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedEmployee.email || 'Not provided'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Professional Information */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                        Professional Information
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Department</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedEmployee.department || 'Not assigned'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Designation</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedEmployee.designation || 'Not assigned'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Basic Salary</label>
                          <p className="mt-1 text-sm text-gray-900">₹{parseInt(selectedEmployee.basic_salary || '0').toLocaleString()}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Status</label>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            selectedEmployee.is_active 
                              ? 'bg-teal-100 text-teal-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {selectedEmployee.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        {!selectedEmployee.is_active && (selectedEmployee as any).inactive_marked_at && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Inactive Since</label>
                            <p className="mt-1 text-sm text-gray-900">
                              {new Date((selectedEmployee as any).inactive_marked_at).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Work Schedule */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                        Work Schedule
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Shift Timing</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {selectedEmployee.shiftStartTime || '09:00'} - {selectedEmployee.shiftEndTime || '18:00'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Off Days</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedEmployee.off_days}</p>
                        </div>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                        Performance Metrics
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Attendance</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedEmployee.attendance}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">OT Hours</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedEmployee.ot_hours}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setShowEmployeeDetail(false);
                        setSelectedEmployee(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        if (selectedEmployee?.employee_id) {
                          setShowEmployeeDetail(false);
                          navigate(`/hr-management/employees/edit/${selectedEmployee.employee_id}`);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 border border-transparent rounded-md hover:bg-teal-700"
                    >
                      <Edit size={16} />
                      Edit Employee
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Filter Modal */}
            {showFilter && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
                <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-xs">
                  <h2 className="text-lg font-semibold mb-4">Filter</h2>
                  
                  {/* Department Filter */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                    <div className="grid grid-cols-2 gap-2">
                      {departmentOptions.map(dept => (
                        <label key={dept} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={pendingDepartments.includes(dept)}
                            onChange={e => {
                              if (e.target.checked) {
                                setPendingDepartments(prev => [...prev, dept]);
                              } else {
                                setPendingDepartments(prev => prev.filter(d => d !== dept));
                              }
                            }}
                            className="accent-teal-700"
                          />
                          {dept}
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2 mt-6">
                    <button className="px-5 py-2 border border-gray-200 text-gray-700 rounded-lg" onClick={() => setShowFilter(false)}>Cancel</button>
                    <button className="px-5 py-2 bg-teal-700 text-white rounded-lg" onClick={() => { 
                      setSelectedDepartments(pendingDepartments); 
                      setShowFilter(false); 
                    }}>Apply</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && employeeToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Delete Employee
                </h2>
              </div>
              
              <p className="text-gray-700 mb-4">
                Are you sure you want to delete <strong>{employeeToDelete.name}</strong> (ID: {employeeToDelete.employee_id})?
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> This will permanently delete:
                </p>
                <ul className="text-sm text-red-700 mt-2 ml-4 list-disc">
                  <li>Employee profile</li>
                  <li>All attendance records</li>
                  <li>All payroll data</li>
                  <li>All advance ledger entries</li>
                  <li>All payment records</li>
                  <li>All leave records</li>
                </ul>
                <p className="text-sm text-red-800 mt-2 font-medium">
                  This action cannot be undone!
                </p>
              </div>
              
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setEmployeeToDelete(null);
                  }}
                  disabled={deleting}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Employee
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Update Modal */}
      {showBulkUpdateModal && (() => {
        // Calculate visible selected count once to avoid repetition
        const visibleSelectedCount = Array.from(selectedEmployees).filter(id => 
          filteredEmployees.some(emp => emp.id === id)
        ).length;
        
        return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Bulk Update {bulkUpdateField === 'off_days' ? 'Off Days' : bulkUpdateField === 'weekly_rules_enabled' ? 'Weekly Rules' : bulkUpdateField === 'shift_timings' ? 'Shift Timings' : bulkUpdateField.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </h2>
              <button
                onClick={() => {
                  setShowBulkUpdateModal(false);
                  setBulkUpdateField('');
                  setBulkUpdateValue('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-sm text-gray-600 mb-4">
                Updating <strong>{visibleSelectedCount}</strong> employee{visibleSelectedCount !== 1 ? 's' : ''}
              </p>

              <div className="space-y-4">
                {bulkUpdateField === 'department' && (
                  <div>
                    <Dropdown
                      options={bulkDepartmentOptions}
                      value={bulkUpdateValue}
                      onChange={(value) => setBulkUpdateValue(value)}
                      placeholder="Select department"
                      allowCustom
                      onCustomAdd={handleCustomDepartmentAdd}
                      onRemoveOption={handleDepartmentRemove}
                      customPlaceholder="Enter new department"
                      label="Department"
                    />
                  </div>
                )}

                {bulkUpdateField === 'designation' && (
                  <div>
                    <Dropdown
                      options={bulkDesignationOptions}
                      value={bulkUpdateValue}
                      onChange={(value) => setBulkUpdateValue(value)}
                      placeholder="Select designation"
                      allowCustom
                      onCustomAdd={handleCustomDesignationAdd}
                      onRemoveOption={handleDesignationRemove}
                      customPlaceholder="Enter new designation"
                      label="Designation"
                    />
                  </div>
                )}

                {bulkUpdateField === 'employment_type' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Employment Type</label>
                    <select
                      value={bulkUpdateValue}
                      onChange={(e) => setBulkUpdateValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="">Select employment type</option>
                      <option value="FULL_TIME">Full Time</option>
                      <option value="PART_TIME">Part Time</option>
                      <option value="CONTRACT">Contract</option>
                      <option value="INTERN">Intern</option>
                    </select>
                  </div>
                )}

                {bulkUpdateField === 'date_of_joining' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date of Joining</label>
                    <CustomDateInputWithOverlay
                      value={bulkUpdateValue}
                      onChange={(date) => setBulkUpdateValue(date)}
                      placeholder="Select date of joining"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                )}

                {bulkUpdateField === 'shift_timings' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Shift Start Time</label>
                      <input
                        type="time"
                        value={bulkUpdateValue.shift_start_time || ''}
                        onChange={(e) => setBulkUpdateValue((prev: any) => ({
                          ...prev,
                          shift_start_time: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                        onClick={(e) => {
                          const input = e.currentTarget as HTMLInputElement;
                          if (input.showPicker) {
                            input.showPicker();
                          }
                        }}
                        onFocus={(e) => {
                          const input = e.currentTarget as HTMLInputElement;
                          if (input.showPicker) {
                            input.showPicker();
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Shift End Time</label>
                      <input
                        type="time"
                        value={bulkUpdateValue.shift_end_time || ''}
                        onChange={(e) => setBulkUpdateValue((prev: any) => ({
                          ...prev,
                          shift_end_time: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                        onClick={(e) => {
                          const input = e.currentTarget as HTMLInputElement;
                          if (input.showPicker) {
                            input.showPicker();
                          }
                        }}
                        onFocus={(e) => {
                          const input = e.currentTarget as HTMLInputElement;
                          if (input.showPicker) {
                            input.showPicker();
                          }
                        }}
                      />
                    </div>
                  </div>
                )}

                {bulkUpdateField === 'location_branch' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Branch/Location</label>
                    <select
                      value={bulkUpdateValue}
                      onChange={(e) => setBulkUpdateValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="">Select branch/location</option>
                      {locationBranchOptions.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {bulkUpdateField === 'basic_salary' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Basic Salary</label>
                    <input
                      type="number"
                      value={bulkUpdateValue}
                      onChange={(e) => setBulkUpdateValue(e.target.value)}
                      placeholder="Enter salary amount"
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                )}

                {bulkUpdateField === 'off_days' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Off Days</label>
                    <div className="space-y-2">
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                        const dayKey = `off_${day.toLowerCase()}`;
                        return (
                          <label key={day} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={bulkUpdateValue[dayKey] || false}
                              onChange={(e) => {
                                setBulkUpdateValue((prev: any) => ({
                                  ...prev,
                                  [dayKey]: e.target.checked
                                }));
                              }}
                              className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                            />
                            <span className="text-sm text-gray-700">{day}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {bulkUpdateField === 'weekly_rules_enabled' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Weekly Rules</label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bulkUpdateValue || false}
                          onChange={(e) => setBulkUpdateValue(e.target.checked)}
                          className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                        />
                        <span className="text-sm text-gray-700">Enable weekly rules for selected employees</span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Weekly rules enable penalty calculation based on weekly attendance threshold.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowBulkUpdateModal(false);
                  setBulkUpdateField('');
                  setBulkUpdateValue('');
                }}
                disabled={bulkUpdating}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpdateSubmit}
                disabled={bulkUpdating || 
                  (bulkUpdateField === 'off_days' && (!bulkUpdateValue || typeof bulkUpdateValue !== 'object')) ||
                  (bulkUpdateField === 'shift_timings' && (!bulkUpdateValue || typeof bulkUpdateValue !== 'object' || !bulkUpdateValue.shift_start_time || !bulkUpdateValue.shift_end_time)) ||
                  (bulkUpdateField === 'weekly_rules_enabled' && typeof bulkUpdateValue !== 'boolean') ||
                  (bulkUpdateField !== 'off_days' && bulkUpdateField !== 'shift_timings' && bulkUpdateField !== 'weekly_rules_enabled' && !bulkUpdateValue)}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {bulkUpdating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Updating...
                  </>
                ) : (
                  'Update Employees'
                )}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Recent Bulk Actions Modal */}
      <RecentBulkActions
        isOpen={showRecentActions}
        onClose={() => setShowRecentActions(false)}
        onActionReverted={() => {
          // Refresh employee data after reverting an action
          refreshEmployeeData(false, true);
        }}
      />
    </div>
  );
};

export default HRDirectory; 