import React, { useState, useEffect } from 'react';
import { Search, Eye, Edit, Plus, Download, MoreVertical, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { exportToExcel, EmployeeData } from '../utils/excelExport';
import { apiCall } from '../services/api';
import { SkeletonTable, SkeletonSearchBar, SkeletonButton } from './SkeletonComponents';
import { logger } from '../utils/logger';

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

  useEffect(() => {
    // Always call refresh function when component mounts (page is opened)
    refreshEmployeeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            off_days: normalizeField(employee.off_days)
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
            off_days: normalizeField(employee.off_days)
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
                off_days: normalizeField(employee.off_days)
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
              off_days: normalizeField(employee.off_days)
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

  // Toggle employee active status
  const handleToggleActiveStatus = async (employeeId: number, currentStatus: boolean) => {
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
        // Update local state
        setEmployees(prev => 
          prev.map(emp => 
            emp.id === employeeId 
              ? { ...emp, is_active: !currentStatus, inactive_marked_at: inactiveMarkedAt }
              : emp
          )
        );
        
        // Dispatch event to notify other components (e.g., attendance log) to invalidate cache
        window.dispatchEvent(new CustomEvent('employeeStatusChanged', { 
          detail: { employeeId, is_active: !currentStatus, timestamp: Date.now() } 
        }));
      } else {
        // Handle toggle failure silently
      }
    } catch (error) {
      // Handle error silently
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
              <span className="ml-2 text-teal-700">{filteredEmployees.length}</span>
              {activeStatusFilter !== 'all' && (
                <span className="ml-2 text-sm text-gray-500">
                  ({activeStatusFilter === 'active' ? 'Active' : 'Inactive'} only)
                </span>
              )}
            </div>
            {/* {employees.length < totalCount && hasMore && (
              <div className="text-sm text-gray-500">
                (Showing {employees.length}, scroll for more)
              </div>
            )} */}
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
            
            <div className="relative">
              <button 
                className="p-2 border border-gray-200 rounded-lg"
                onClick={() => setShowMenu(!showMenu)}
              >
                <MoreVertical size={16} />
              </button>
              
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 divide-y divide-gray-100">
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
            <div className="overflow-x-auto thin-scrollbar">
              <table className="w-full min-w-max">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky left-0 bg-gray-50 w-48">Employee ID</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 sticky left-36 z-20 z-20 bg-gray-50">Employee Name</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Mobile Number</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Email</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Department</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Designation</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Employment Type</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Date of Joining</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Branch/Location</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Attendance %</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Total OT Hours</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Total Late Hours</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Shift Start Time</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Shift End Time</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Basic Salary</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Off Days</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentEntries.length === 0 ? (
                    <tr>
                      <td colSpan={18} className="px-4 py-6 text-center text-gray-500">
                        {searchQuery ? `No employees found matching "${searchQuery}"` : 'No employee records found.'}
                      </td>
                    </tr>
                  ) : (
                    currentEntries.map((employee, index) => {
                      try {
                        return (
                      <tr key={`${employee.id}-${employee.employee_id}-${index}`} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm sticky left-0 bg-white z-20">{employee.employee_id}</td>
                        <td className="px-4 py-3 text-sm sticky left-36 bg-white z-20">
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
    </div>
  );
};

export default HRDirectory; 