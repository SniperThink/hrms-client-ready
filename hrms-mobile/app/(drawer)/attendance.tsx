// Attendance Log Screen - Redesigned to match web dashboard
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setDailyRecords, setSelectedDate, setLoading } from '@/store/slices/attendanceSlice';
import { attendanceService } from '@/services/attendanceService';
import { api } from '@/services/api';
import { API_ENDPOINTS } from '@/constants/Config';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';

// Employee interface
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

// Attendance entry interface
interface AttendanceEntry {
  employee_id: string;
  name: string;
  department: string;
  status: 'present' | 'absent' | 'off' | 'unmarked';
  clock_in: string;
  clock_out: string;
  ot_hours: number;
  late_minutes: number;
  has_off_day: boolean;
  sunday_bonus?: boolean;
  weeklyAttendance: { [day: string]: boolean };
  autoMarkedReasons?: { [day: string]: string | null };
  weekly_penalty_days?: number;
  employee_off_days?: { [day: string]: boolean };
  _shiftStart?: string;
  _shiftEnd?: string;
  _prevClockIn?: string;
  _prevClockOut?: string;
  _prevOt?: number;
  _prevLate?: number;
}

export default function AttendanceScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { dailyRecords, selectedDate, isLoading } = useAppSelector((state) => state.attendance);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Main state
  const [activeTab, setActiveTab] = useState<'log' | 'tracker'>('log');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [dayName, setDayName] = useState('');
  
  // Employee and attendance data
  const [eligibleEmployees, setEligibleEmployees] = useState<Employee[]>([]);
  const [attendanceEntries, setAttendanceEntries] = useState<Map<string, AttendanceEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [departments, setDepartments] = useState<string[]>(['All']);
  const [hasExcelAttendance, setHasExcelAttendance] = useState(false);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayInfo, setHolidayInfo] = useState<{name: string; description?: string; type: string} | null>(null);

  // Handle date selection
  const handleDateSelect = (date: string) => {
    dispatch(setSelectedDate(date));
    setShowDatePicker(false);
  };

  // Fetch eligible employees for the selected date
  const fetchEligibleEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!selectedDate) {
        setError('Please select a date');
        setLoading(false);
        return;
      }
      
      // Fetch eligible employees from backend
      let response;
      try {
        response = await attendanceService.getEligibleEmployees(selectedDate);
      } catch (err: any) {
        console.log('Eligible employees endpoint not available, using employees endpoint');
        // Fallback to regular employees endpoint
        response = await api.get(`${API_ENDPOINTS.employees}?is_active=true`);
      }
      
      // Check for Excel attendance and holidays (with error handling)
      try {
        const [excelResponse, holidayResponse] = await Promise.all([
          attendanceService.checkExcelAttendance(selectedDate).catch(() => ({ has_excel: false })),
          attendanceService.checkHoliday(selectedDate).catch(() => ({ is_holiday: false })),
        ]);
        
        setHasExcelAttendance(excelResponse?.has_excel || false);
        setIsHoliday(holidayResponse?.is_holiday || false);
        setHolidayInfo(holidayResponse?.holiday_info || null);
      } catch (err) {
        console.log('Excel/holiday check endpoints not available, using defaults');
        setHasExcelAttendance(false);
        setIsHoliday(false);
        setHolidayInfo(null);
      }
      
      if (response && response.results) {
        const employees = response.results.map((emp: any) => ({
          id: emp.id,
          employee_id: emp.employee_id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          name: emp.first_name && emp.last_name ? `${emp.first_name} ${emp.last_name}` : emp.name,
          email: emp.email,
          department: emp.department,
          is_active: emp.is_active,
          shift_start_time: emp.shift_start_time || '09:00',
          shift_end_time: emp.shift_end_time || '18:00',
          default_status: emp.default_status || 'present',
          late_minutes: emp.late_minutes || 0,
          ot_hours: emp.ot_hours || 0,
          has_off_day: emp.has_off_day || false,
          off_monday: emp.off_monday || false,
          off_tuesday: emp.off_tuesday || false,
          off_wednesday: emp.off_wednesday || false,
          off_thursday: emp.off_thursday || false,
          off_friday: emp.off_friday || false,
          off_saturday: emp.off_saturday || false,
          off_sunday: emp.off_sunday || false,
          current_attendance: emp.current_attendance,
        }));
        
        setEligibleEmployees(employees);
        initializeAttendanceEntries(employees);
        
        // Extract departments
        const deptSet = new Set(['All']);
        employees.forEach((emp: Employee) => {
          if (emp.department) deptSet.add(emp.department);
        });
        setDepartments(Array.from(deptSet));
      } else {
        setEligibleEmployees([]);
        setAttendanceEntries(new Map());
        setDepartments(['All']);
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching eligible employees:', err);
      setError(err.message || 'Failed to load employees');
      setLoading(false);
    }
  }, [selectedDate]);

  // Initialize attendance entries for employees
  const initializeAttendanceEntries = (employees: Employee[]) => {
    const newEntries = new Map<string, AttendanceEntry>();
    
    employees.forEach((emp) => {
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
    });
    
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
      sunday_bonus: false,
      weeklyAttendance: {},
      _shiftStart: emp.shift_start_time || '09:00',
      _shiftEnd: emp.shift_end_time || '18:00'
    };
  };

  // Update attendance entry
  const updateAttendanceEntry = (employeeId: string, field: keyof AttendanceEntry, value: string | number | boolean) => {
    setAttendanceEntries(prev => {
      const newMap = new Map(prev);
      const entry = newMap.get(employeeId);
      if (entry) {
        const updated = { ...entry, [field]: value } as AttendanceEntry;
        newMap.set(employeeId, updated);
      }
      return newMap;
    });
  };

  // Initialize selected date if not set
  useEffect(() => {
    if (!selectedDate) {
      dispatch(setSelectedDate(format(new Date(), 'yyyy-MM-dd')));
    }
  }, [selectedDate, dispatch]);

  // Load data on component mount and when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchEligibleEmployees();
    }
  }, [fetchEligibleEmployees, selectedDate]);

  // Memoized filtered and sorted employees for better performance
  const sortedEmployees = useMemo(() => {
    let filtered = eligibleEmployees.filter(emp => {
      const query = searchQuery.toLowerCase();
      const name = (emp.first_name && emp.last_name) 
        ? `${emp.first_name} ${emp.last_name}`.toLowerCase()
        : emp.name?.toLowerCase() || '';
      const id = emp.employee_id.toLowerCase();
      return name.includes(query) || id.includes(query);
    });

    // Filter by department
    filtered = filtered.filter(emp => {
      if (selectedDepartment === 'All') return true;
      return emp.department === selectedDepartment;
    });

    // Sort employees by name
    return filtered.sort((a, b) => {
      const nameA = (a.first_name && a.last_name) 
        ? `${a.first_name} ${a.last_name}` 
        : a.name || '';
      const nameB = (b.first_name && b.last_name) 
        ? `${b.first_name} ${b.last_name}` 
        : b.name || '';
      return nameA.localeCompare(nameB);
    });
  }, [eligibleEmployees, searchQuery, selectedDepartment]);

  // Mark all present
  const markAllPresent = useCallback(() => {
    setAttendanceEntries(prev => {
      const newMap = new Map(prev);
      sortedEmployees.forEach(emp => {
        const entry = newMap.get(emp.employee_id);
        const hasOffDay = entry?.has_off_day !== undefined ? entry.has_off_day : (emp.has_off_day || false);
        if (entry && !hasOffDay && entry.status !== 'off') {
          newMap.set(emp.employee_id, { ...entry, status: 'present' });
        }
      });
      return newMap;
    });
  }, [sortedEmployees]);

  // Mark all absent
  const markAllAbsent = useCallback(() => {
    setAttendanceEntries(prev => {
      const newMap = new Map(prev);
      sortedEmployees.forEach(emp => {
        const entry = newMap.get(emp.employee_id);
        const hasOffDay = entry?.has_off_day !== undefined ? entry.has_off_day : (emp.has_off_day || false);
        if (entry && !hasOffDay && entry.status !== 'off') {
          newMap.set(emp.employee_id, { ...entry, status: 'absent' });
        }
      });
      return newMap;
    });
  }, [sortedEmployees]);

  // Memoized table row component for better performance
  const AttendanceTableRow = memo(({ employee, entry, hasOffDay, colors, updateAttendanceEntry, hasExcelAttendance, isHoliday }: {
    employee: Employee;
    entry: AttendanceEntry;
    hasOffDay: boolean;
    colors: any;
    updateAttendanceEntry: (id: string, field: keyof AttendanceEntry, value: any) => void;
    hasExcelAttendance: boolean;
    isHoliday: boolean;
  }) => {
    return (
      <View style={[styles.tableRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {/* Employee Details */}
        <View style={[styles.tableCell, { width: 150 }]}>
          <Text style={[styles.employeeName, { color: colors.text }]}>
            {employee.first_name && employee.last_name
              ? `${employee.first_name} ${employee.last_name}`
              : employee.name || 'Unknown'
            }
          </Text>
          <Text style={[styles.employeeId, { color: colors.textSecondary }]}>
            {employee.employee_id}
          </Text>
          <Text style={[styles.employeeDepartment, { color: colors.textSecondary }]}>
            {employee.department || 'General'}
          </Text>
        </View>

        {/* Clock In */}
        <View style={[styles.tableCell, { width: 80 }]}>
          {(hasOffDay || (entry.status as any) === 'off') || entry.status !== 'present' ? (
            <Text style={[styles.disabledText, { color: colors.textSecondary }]}>-</Text>
          ) : (
            <TextInput
              style={[styles.timeInputSmall, { color: colors.text, borderColor: colors.border }]}
              value={entry.clock_in}
              onChangeText={(value) => updateAttendanceEntry(employee.employee_id, 'clock_in', value)}
              placeholder="09:00"
              placeholderTextColor={colors.textSecondary}
            />
          )}
        </View>

        {/* Clock Out */}
        <View style={[styles.tableCell, { width: 80 }]}>
          {(hasOffDay || (entry.status as any) === 'off') || entry.status !== 'present' ? (
            <Text style={[styles.disabledText, { color: colors.textSecondary }]}>-</Text>
          ) : (
            <TextInput
              style={[styles.timeInputSmall, { color: colors.text, borderColor: colors.border }]}
              value={entry.clock_out}
              onChangeText={(value) => updateAttendanceEntry(employee.employee_id, 'clock_out', value)}
              placeholder="18:00"
              placeholderTextColor={colors.textSecondary}
            />
          )}
        </View>

        {/* Status Dropdown */}
        <View style={[styles.tableCell, { width: 100 }]}>
          {(hasOffDay || (entry.status as any) === 'off') && entry.status !== 'present' ? (
            <View style={styles.offDayContainer}>
              <View style={[styles.statusBadgeSmall, { backgroundColor: colors.info }]}>
                <Text style={styles.statusBadgeTextSmall}>OFF DAY</Text>
              </View>
              <TouchableOpacity
                style={[styles.markPresentButtonSmall, { backgroundColor: colors.warning }]}
                onPress={() => updateAttendanceEntry(employee.employee_id, 'status', 'present')}
                disabled={hasExcelAttendance || isHoliday}
              >
                <Text style={styles.markPresentButtonTextSmall}>Present</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.statusDropdown}>
              <Text style={[styles.statusText, { color: entry.status === 'present' ? colors.success : entry.status === 'absent' ? colors.error : colors.textSecondary }]}>
                {entry.status === 'present' ? 'Present' : entry.status === 'absent' ? 'Absent' : 'Unmarked'}
              </Text>
              <View style={styles.statusButtonsSmall}>
                <TouchableOpacity
                  style={[
                    styles.statusButtonSmall,
                    {
                      backgroundColor: entry.status === 'present' ? colors.success : colors.surface,
                      borderColor: entry.status === 'present' ? colors.success : colors.border,
                    },
                  ]}
                  onPress={() => {
                    const newStatus = entry.status === 'present' ? 'unmarked' : 'present';
                    updateAttendanceEntry(employee.employee_id, 'status', newStatus);
                  }}
                  disabled={hasExcelAttendance || isHoliday}
                >
                  <Text style={[styles.statusButtonTextSmall, { color: entry.status === 'present' ? 'white' : colors.text }]}>
                    P
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.statusButtonSmall,
                    {
                      backgroundColor: (entry.status === 'absent' || (entry.status as any) === 'off') ? colors.error : colors.surface,
                      borderColor: (entry.status === 'absent' || (entry.status as any) === 'off') ? colors.error : colors.border,
                    },
                  ]}
                  onPress={() => {
                    const newStatus = hasOffDay 
                      ? ((entry.status as any) === 'off' ? 'unmarked' : 'off')
                      : (entry.status === 'absent' ? 'unmarked' : 'absent');
                    updateAttendanceEntry(employee.employee_id, 'status', newStatus);
                  }}
                  disabled={hasExcelAttendance || isHoliday}
                >
                  <Text style={[styles.statusButtonTextSmall, { color: (entry.status === 'absent' || (entry.status as any) === 'off') ? 'white' : colors.text }]}>
                    {hasOffDay ? 'O' : 'A'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* OT Hours */}
        <View style={[styles.tableCell, { width: 70, alignItems: 'center' }]}>
          {(hasOffDay || (entry.status as any) === 'off') || entry.status !== 'present' ? (
            <Text style={[styles.disabledText, { color: colors.textSecondary }]}>-</Text>
          ) : (
            <Text style={[styles.valueText, { color: colors.text }]}>{entry.ot_hours}</Text>
          )}
        </View>

        {/* Late Minutes */}
        <View style={[styles.tableCell, { width: 80, alignItems: 'center' }]}>
          {(hasOffDay || (entry.status as any) === 'off') || entry.status !== 'present' ? (
            <Text style={[styles.disabledText, { color: colors.textSecondary }]}>-</Text>
          ) : (
            <Text style={[styles.valueText, { color: colors.text }]}>{entry.late_minutes}</Text>
          )}
        </View>
      </View>
    );
  });

  // Save attendance
  const saveAttendance = async () => {
    try {
      setSaving(true);
      setError(null);
      
      if (!selectedDate) {
        setError('Please select a date');
        setSaving(false);
        return;
      }
      
      // Prepare attendance data for API
      const attendanceData = Array.from(attendanceEntries.entries()).map(([employeeId, entry]) => ({
        employee_id: employeeId,
        date: selectedDate,
        status: entry.status,
        clock_in: entry.clock_in,
        clock_out: entry.clock_out,
        ot_hours: entry.ot_hours || 0,
        late_minutes: entry.late_minutes || 0,
      }));
      
      // Filter out unmarked entries
      const validAttendanceData = attendanceData.filter(entry => entry.status !== 'unmarked');
      
      if (validAttendanceData.length === 0) {
        Alert.alert('Info', 'No attendance data to save');
        setSaving(false);
        return;
      }
      
      // Save attendance to backend with error handling
      try {
        await attendanceService.saveAttendance(validAttendanceData);
        Alert.alert('Success', 'Attendance saved successfully!');
        setError(null);
      } catch (saveErr: any) {
        console.log('Save attendance endpoint not available, using bulk update');
        // Fallback to bulk update endpoint
        await attendanceService.bulkUpdateAttendance(validAttendanceData);
        Alert.alert('Success', 'Attendance saved successfully!');
        setError(null);
      }
      
      // Refresh data after saving
      await fetchEligibleEmployees();
      
    } catch (err: any) {
      console.error('Error saving attendance:', err);
      setError(err.message || 'Failed to save attendance');
      Alert.alert('Error', err.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Text style={styles.headerTitle}>Attendance</Text>
        <Text style={styles.headerSubtitle}>Mark and track employee attendance</Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'log' && [styles.activeTab, { backgroundColor: colors.primary }],
          ]}
          onPress={() => setActiveTab('log')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'log' ? 'white' : colors.text }
          ]}>
            Mark Attendance
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'tracker' && [styles.activeTab, { backgroundColor: colors.primary }],
          ]}
          onPress={() => setActiveTab('tracker')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'tracker' ? 'white' : colors.text }
          ]}>
            Track Attendance
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'log' ? (
        <>
          {/* Date Selection and Filters */}
          <ScrollView style={styles.filtersContainer}>
        {/* Date Picker */}
        <View style={styles.dateSection}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Select Date</Text>
          <TouchableOpacity
            style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowDatePicker(true)}
          >
            <FontAwesome name="calendar" size={16} color={colors.primary} />
            <Text style={[styles.dateButtonText, { color: colors.text }]}>
              {selectedDate ? format(new Date(selectedDate), 'dd MMM yyyy (EEEE)') : 'Select Date'}
            </Text>
            <FontAwesome name="chevron-down" size={12} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Search Employees</Text>
          <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FontAwesome name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search by name, ID, or department..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <FontAwesome name="times-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Department Filter */}
        <View style={styles.departmentSection}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Department</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.departmentButtons}>
              {departments.map((dept) => (
                <TouchableOpacity
                  key={dept}
                  style={[
                    styles.departmentButton,
                    {
                      backgroundColor: selectedDepartment === dept ? colors.primary : colors.surface,
                      borderColor: selectedDepartment === dept ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedDepartment(dept)}
                >
                  <Text
                    style={[
                      styles.departmentButtonText,
                      { color: selectedDepartment === dept ? 'white' : colors.text },
                    ]}
                  >
                    {dept}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Bulk Actions */}
        <View style={styles.bulkActionsSection}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Bulk Actions</Text>
          <View style={styles.bulkButtons}>
            <TouchableOpacity
              style={[styles.bulkButton, { backgroundColor: colors.success }]}
              onPress={markAllPresent}
              disabled={hasExcelAttendance || isHoliday}
            >
              <FontAwesome name="check-circle" size={16} color="white" />
              <Text style={styles.bulkButtonText}>Mark All Present</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkButton, { backgroundColor: colors.error }]}
              onPress={markAllAbsent}
              disabled={hasExcelAttendance || isHoliday}
            >
              <FontAwesome name="times-circle" size={16} color="white" />
              <Text style={styles.bulkButtonText}>Mark All Absent</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Holiday/Excel Warning */}
        {(hasExcelAttendance || isHoliday) && (
          <View style={[styles.warningBox, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
            <FontAwesome name="exclamation-triangle" size={16} color={colors.warning} />
            <Text style={[styles.warningText, { color: colors.warning }]}>
              {hasExcelAttendance 
                ? 'Attendance interface is disabled: Excel data uploaded for this month'
                : `Cannot mark attendance on holiday: ${holidayInfo?.name || 'Holiday'}`
              }
            </Text>
          </View>
        )}

        {/* Employee List */}
        <View style={styles.employeeListSection}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>
            Employees ({sortedEmployees.length})
          </Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading employees...
              </Text>
            </View>
          ) : error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.error + '20', borderColor: colors.error }]}>
              <FontAwesome name="exclamation-circle" size={16} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : sortedEmployees.length === 0 ? (
            <View style={styles.emptyContainer}>
              <FontAwesome name="users" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery ? 'No employees found matching your search' : 'No employees found for this date'}
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View>
                {/* Table Header */}
                <View style={[styles.tableHeader, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.headerCell, { width: 150, color: 'white' }]}>Employee</Text>
                  <Text style={[styles.headerCell, { width: 80, color: 'white' }]}>Clock In</Text>
                  <Text style={[styles.headerCell, { width: 80, color: 'white' }]}>Clock Out</Text>
                  <Text style={[styles.headerCell, { width: 100, color: 'white' }]}>Status</Text>
                  <Text style={[styles.headerCell, { width: 70, color: 'white' }]}>OT Hours</Text>
                  <Text style={[styles.headerCell, { width: 80, color: 'white' }]}>Late Min</Text>
                </View>

                {/* Table Body - Optimized with FlatList */}
                <FlatList
                  data={sortedEmployees}
                  keyExtractor={(item) => item.employee_id}
                  getItemLayout={(data, index) => ({
                    length: 60, // Approximate height of each row
                    offset: 60 * index,
                    index,
                  })}
                  removeClippedSubviews={true}
                  maxToRenderPerBatch={10}
                  updateCellsBatchingPeriod={50}
                  initialNumToRender={15}
                  windowSize={10}
                  renderItem={({ item: employee }) => {
                    const entry = attendanceEntries.get(employee.employee_id);
                    if (!entry) return null;

                    const hasOffDay = entry.has_off_day !== undefined ? entry.has_off_day : (employee.has_off_day || false);

                    return (
                      <AttendanceTableRow
                        employee={employee}
                        entry={entry}
                        hasOffDay={hasOffDay}
                        colors={colors}
                        updateAttendanceEntry={updateAttendanceEntry}
                        hasExcelAttendance={hasExcelAttendance}
                        isHoliday={isHoliday}
                      />
                    );
                  }}
                  ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No employees found
                      </Text>
                    </View>
                  )}
                />
              </View>
            </ScrollView>
          )}
        </View>

        {/* Save Button */}
        {!loading && sortedEmployees.length > 0 && !hasExcelAttendance && !isHoliday && (
          <View style={styles.saveSection}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={saveAttendance}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <FontAwesome name="save" size={16} color="white" />
              )}
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save Attendance'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 32 }} />
          </ScrollView>
        </>
      ) : (
        /* Track Attendance Tab */
        <View style={styles.trackAttendanceContainer}>
          <ScrollView style={styles.trackFiltersContainer}>
            {/* Month/Year Selection */}
            <View style={styles.monthSection}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Select Month</Text>
              <View style={styles.monthYearContainer}>
                <TouchableOpacity
                  style={[styles.monthYearButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => {/* TODO: Add month picker */}}
                >
                  <FontAwesome name="calendar" size={16} color={colors.primary} />
                  <Text style={[styles.dateButtonText, { color: colors.text }]}>
                    {format(new Date(), 'MMMM yyyy')}
                  </Text>
                  <FontAwesome name="chevron-down" size={12} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Search Employee */}
            <View style={styles.searchSection}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Search Employee</Text>
              <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <FontAwesome name="search" size={16} color={colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search by name or ID..."
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <FontAwesome name="times-circle" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Attendance Summary Cards */}
          <View style={styles.summaryContainer}>
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <FontAwesome name="calendar-check-o" size={24} color={colors.success} />
              <View style={styles.summaryContent}>
                <Text style={[styles.summaryValue, { color: colors.text }]}>22</Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Present Days</Text>
              </View>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <FontAwesome name="calendar-times-o" size={24} color={colors.error} />
              <View style={styles.summaryContent}>
                <Text style={[styles.summaryValue, { color: colors.text }]}>3</Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Absent Days</Text>
              </View>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <FontAwesome name="clock-o" size={24} color={colors.warning} />
              <View style={styles.summaryContent}>
                <Text style={[styles.summaryValue, { color: colors.text }]}>12.5</Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>OT Hours</Text>
              </View>
            </View>
          </View>

          {/* Attendance Records */}
          <View style={styles.attendanceListContainer}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Attendance Records</Text>
            <ScrollView style={styles.attendanceRecordsList}>
              {/* Sample attendance records */}
              {[1, 2, 3, 4, 5].map((item) => (
                <View key={item} style={[styles.attendanceRecord, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.recordDate}>
                    <Text style={[styles.recordDateText, { color: colors.text }]}>
                      {format(new Date(Date.now() - (item - 1) * 24 * 60 * 60 * 1000), 'dd MMM yyyy')}
                    </Text>
                    <Text style={[styles.recordDayText, { color: colors.textSecondary }]}>
                      {format(new Date(Date.now() - (item - 1) * 24 * 60 * 60 * 1000), 'EEEE')}
                    </Text>
                  </View>
                  <View style={styles.recordStatus}>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: item % 4 === 0 ? colors.error : colors.success }
                    ]}>
                      <Text style={styles.statusBadgeText}>
                        {item % 4 === 0 ? 'Absent' : 'Present'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.recordTimes}>
                    <Text style={[styles.recordTimeText, { color: colors.text }]}>
                      {item % 4 === 0 ? '-' : '09:15 - 18:30'}
                    </Text>
                    <Text style={[styles.recordOTText, { color: colors.textSecondary }]}>
                      {item % 4 === 0 ? '0 OT' : '1.5 OT'}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

// Styles for the new attendance log design
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  filtersContainer: {
    flex: 1,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  dateSection: {
    marginBottom: 24,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateButtonText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginLeft: 12,
  },
  searchSection: {
    marginBottom: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  departmentSection: {
    marginBottom: 24,
  },
  departmentButtons: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  departmentButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  departmentButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bulkActionsSection: {
    marginBottom: 24,
  },
  bulkButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  bulkButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  bulkButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
    gap: 8,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  employeeListSection: {
    marginBottom: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  employeeList: {
    gap: 12,
  },
  employeeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  employeeInfo: {
    marginBottom: 16,
  },
  employeeDetails: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  employeeId: {
    fontSize: 14,
    marginBottom: 2,
  },
  employeeDepartment: {
    fontSize: 14,
  },
  attendanceSection: {
    gap: 12,
  },
    statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  markPresentButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  markPresentButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  timeInputContainer: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  timeInput: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    fontSize: 14,
    textAlign: 'center',
  },
  otLateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 6,
  },
  otLateItem: {
    alignItems: 'center',
  },
  otLateLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  otLateValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveSection: {
    marginBottom: 24,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Table styles
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  headerCell: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    minHeight: 60,
  },
  tableCell: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  timeInputSmall: {
    padding: 6,
    borderRadius: 4,
    borderWidth: 1,
    fontSize: 12,
    textAlign: 'center',
    minWidth: 60,
  },
  disabledText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  valueText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusDropdown: {
    alignItems: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  statusButtonsSmall: {
    flexDirection: 'row',
    gap: 4,
  },
  statusButtonSmall: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButtonTextSmall: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  statusBadgeTextSmall: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  markPresentButtonSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  markPresentButtonTextSmall: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  offDayContainer: {
    alignItems: 'flex-start',
  },
  // Tab styles
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Track Attendance styles
  trackAttendanceContainer: {
    flex: 1,
  },
  trackFiltersContainer: {
    padding: 16,
  },
  monthSection: {
    marginBottom: 16,
  },
  monthYearContainer: {
    marginTop: 8,
  },
  monthYearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  summaryContent: {
    marginLeft: 12,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  attendanceListContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  attendanceRecordsList: {
    flex: 1,
  },
  attendanceRecord: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  recordDate: {
    flex: 2,
  },
  recordDateText: {
    fontSize: 16,
    fontWeight: '600',
  },
  recordDayText: {
    fontSize: 14,
    marginTop: 2,
  },
  recordStatus: {
    flex: 1,
    alignItems: 'center',
  },
  recordTimes: {
    flex: 2,
    alignItems: 'flex-end',
  },
  recordTimeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  recordOTText: {
    fontSize: 12,
    marginTop: 2,
  },
  // Performance optimization styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  // Optimized table styles for better performance
  tableRowOptimized: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    minHeight: 60,
    elevation: 0,
    shadowOpacity: 0,
  },
  // Fast input styles
  timeInputOptimized: {
    padding: 6,
    borderRadius: 4,
    borderWidth: 1,
    fontSize: 12,
    textAlign: 'center',
    minWidth: 60,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
