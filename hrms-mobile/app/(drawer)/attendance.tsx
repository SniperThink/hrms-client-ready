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

// Attendance record interface for tracker
interface AttendanceRecord {
  id: number;
  employee_id: string;
  name: string;
  department?: string;
  date: string;
  calendar_days: number;
  off_days?: number;
  total_working_days: number;
  present_days: number;
  absent_days: number;
  unmarked_days?: number;
  holiday_days?: number;
  weekly_penalty_days?: number;
  status?: string;
  attendance_percentage?: number;
  ot_hours: string | number;
  late_minutes: number;
}

// Filter type
type FilterType = 'one_day' | 'custom_month' | 'last_6_months' | 'last_12_months' | 'last_5_years' | 'custom_range';

// Month names
const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Track Attendance Tab Component
const TrackAttendanceTab: React.FC<{
  colors: any;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}> = memo(({ colors, searchQuery, setSearchQuery }) => {
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('custom_month');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(monthNames[new Date().getMonth()]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [rangeStartDate, setRangeStartDate] = useState<string>('');
  const [rangeEndDate, setRangeEndDate] = useState<string>('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [showYearModal, setShowYearModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  
  // KPI totals
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

  // Generate years
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 8 }, (_, i) => currentYear + 2 - i);

  // Filter options
  const filterTypeOptions = [
    { value: 'one_day', label: 'One Day' },
    { value: 'custom_month', label: 'Custom Month' },
    { value: 'last_6_months', label: 'Last 6 Months' },
    { value: 'last_12_months', label: 'Last 12 Months' },
    { value: 'last_5_years', label: 'Last 5 Years' },
    { value: 'custom_range', label: 'Custom Range' },
  ];

  // Fetch attendance data
  const fetchAttendanceData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams();
      
      if (filterType === 'custom_month' && selectedMonth && selectedYear) {
        params.append('time_period', 'custom');
        const monthIndex = monthNames.indexOf(selectedMonth) + 1;
        params.append('month', monthIndex.toString());
        params.append('year', selectedYear.toString());
      } else if (filterType === 'one_day' && selectedDate) {
        params.append('time_period', 'custom_range');
        params.append('start_date', selectedDate);
        params.append('end_date', selectedDate);
      } else if (filterType === 'custom_range' && rangeStartDate && rangeEndDate) {
        params.append('time_period', 'custom_range');
        params.append('start_date', rangeStartDate);
        params.append('end_date', rangeEndDate);
      } else {
        params.append('time_period', filterType);
      }
      
      params.append('offset', '0');
      params.append('limit', '0'); // Fetch all records
      
      const url = `${API_ENDPOINTS.dailyAttendance}all_records/?${params.toString()}`;
      const response = await api.get(url);
      
      if (response && response.results) {
        setAttendanceData(response.results);
        setKpiTotals(response.kpi_totals || null);
        
        // Extract departments
        const deptSet = new Set<string>(['all']);
        response.results.forEach((record: AttendanceRecord) => {
          if (record.department) deptSet.add(record.department);
        });
        setDepartments(Array.from(deptSet));
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      setLoading(false);
    }
  }, [filterType, selectedMonth, selectedYear, selectedDate, rangeStartDate, rangeEndDate]);

  // Load data on mount and filter changes
  useEffect(() => {
    fetchAttendanceData();
  }, [fetchAttendanceData]);

  // Filter data by search and department
  const filteredData = useMemo(() => {
    return attendanceData.filter(record => {
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
        const recordDept = record.department || 'N/A';
        if (recordDept !== selectedDepartment) return false;
      }
      
      return true;
    });
  }, [attendanceData, searchQuery, selectedDepartment]);

  // Calculate KPIs
  const isFiltered = searchQuery !== '' || selectedDepartment !== 'all';
  
  const totalEmployees = kpiTotals && !isFiltered ? kpiTotals.total_employees : filteredData.length;
  const totalOtHours = kpiTotals && !isFiltered ? kpiTotals.total_ot_hours : filteredData.reduce((sum, r) => sum + (typeof r.ot_hours === 'string' ? parseFloat(r.ot_hours) || 0 : r.ot_hours), 0);
  const totalLateMinutes = kpiTotals && !isFiltered ? kpiTotals.total_late_minutes : filteredData.reduce((sum, r) => sum + r.late_minutes, 0);
  const totalPresentDays = kpiTotals && !isFiltered ? kpiTotals.total_present_days : filteredData.reduce((sum, r) => sum + r.present_days, 0);
  const totalWorkingDays = kpiTotals && !isFiltered ? kpiTotals.total_working_days : filteredData.reduce((sum, r) => sum + (r.total_working_days || 0), 0);
  const avgPresentPerc = kpiTotals && !isFiltered ? kpiTotals.avg_attendance_percentage : (totalWorkingDays > 0 ? (totalPresentDays / totalWorkingDays) * 100 : 0);
  const avgWorkingDays = totalEmployees > 0 ? totalWorkingDays / totalEmployees : 0;
  const avgPresentDays = totalEmployees > 0 ? totalPresentDays / totalEmployees : 0;

  return (
    <View style={styles.trackAttendanceContainer}>
      {/* Tracker header */}
      <View style={styles.trackHeader}>
        <Text style={[styles.trackTitle, { color: colors.text }]}>Attendance Tracker</Text>
        <Text style={[styles.trackSubtitle, { color: colors.textSecondary }]}>
          Analyse attendance trends across months and departments
        </Text>
      </View>

      {/* Filters Section */}
      <View style={styles.trackFiltersContainer}>
        {/* Filter Type and Department */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowFilterModal(true)}
          >
            <FontAwesome name="filter" size={14} color={colors.primary} />
            <Text style={[styles.filterButtonText, { color: colors.text }]}>
              {filterTypeOptions.find(f => f.value === filterType)?.label || 'Filter'}
            </Text>
            <FontAwesome name="chevron-down" size={10} color={colors.textSecondary} />
          </TouchableOpacity>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.departmentScroll}>
            {departments.map((dept) => (
              <TouchableOpacity
                key={dept}
                style={[
                  styles.departmentChip,
                  {
                    backgroundColor: selectedDepartment === dept ? colors.primary : colors.surface,
                    borderColor: selectedDepartment === dept ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelectedDepartment(dept)}
              >
                <Text
                  style={[
                    styles.departmentChipText,
                    { color: selectedDepartment === dept ? 'white' : colors.text },
                  ]}
                >
                  {dept === 'all' ? 'All Departments' : dept}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Date/Month/Range Selection based on filter type */}
        {filterType === 'custom_month' && (
          <View style={styles.dateSelectionRow}>
            <TouchableOpacity
              style={[styles.dateSelectButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowYearModal(true)}
            >
              <Text style={[styles.dateSelectButtonText, { color: colors.text }]}>{selectedYear}</Text>
              <FontAwesome name="chevron-down" size={10} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateSelectButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowMonthModal(true)}
            >
              <Text style={[styles.dateSelectButtonText, { color: colors.text }]}>{selectedMonth}</Text>
              <FontAwesome name="chevron-down" size={10} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {filterType === 'one_day' && (
          <View style={styles.dateSelectionRow}>
            <TouchableOpacity
              style={[styles.dateSelectButtonFull, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowDateModal(true)}
            >
              <FontAwesome name="calendar" size={14} color={colors.primary} />
              <Text style={[styles.dateSelectButtonText, { color: colors.text }]}>
                {selectedDate ? format(new Date(selectedDate), 'dd MMM yyyy') : 'Select Date'}
              </Text>
              <FontAwesome name="chevron-down" size={10} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* KPI Cards */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading attendance data...</Text>
        </View>
      ) : filterType === 'one_day' ? (
        <View style={styles.kpiContainer}>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Total Employees</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>{totalEmployees}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Present</Text>
            <Text style={[styles.kpiValue, { color: colors.success }]}>
              {kpiTotals && !isFiltered && kpiTotals.presentees_count !== undefined
                ? kpiTotals.presentees_count
                : filteredData.filter(r => r.present_days > 0).length}
            </Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Absent</Text>
            <Text style={[styles.kpiValue, { color: colors.error }]}>
              {kpiTotals && !isFiltered && kpiTotals.absentees_count !== undefined
                ? kpiTotals.absentees_count
                : filteredData.filter(r => r.absent_days > 0).length}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.kpiContainer}>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Total Employees</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>{totalEmployees}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Total OT Hours</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>{totalOtHours.toFixed(1)}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Late Minutes</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>{totalLateMinutes.toFixed(0)}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Avg Working Days</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>{avgWorkingDays.toFixed(1)}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Avg Present Days</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>{avgPresentDays.toFixed(1)}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Avg Present %</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>{avgPresentPerc.toFixed(1)}%</Text>
          </View>
        </View>
      )}

      {/* Attendance Data - mobile friendly cards instead of a wide table */}
      {!loading && (
        filteredData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome name="inbox" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No attendance records found
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.attendanceCardsContainer}>
            {filteredData.map((record) => {
              const attendancePercentage = record.total_working_days > 0 
                ? (record.present_days / record.total_working_days) * 100 
                : 0;

              return (
                <View
                  key={record.id}
                  style={[
                    styles.attendanceCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  {/* Top row: name + status */}
                  <View style={styles.attendanceCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.attendanceName, { color: colors.text }]} numberOfLines={1}>
                        {record.name}
                      </Text>
                      <Text style={[styles.attendanceSub, { color: colors.textSecondary }]} numberOfLines={1}>
                        {record.employee_id} • {record.department || 'N/A'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.attendanceStatusPill,
                        {
                          backgroundColor:
                            record.status === 'present'
                              ? `${colors.success}20`
                              : record.status === 'absent'
                              ? `${colors.error}20`
                              : `${colors.warning}20`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.attendanceStatusText,
                          {
                            color:
                              record.status === 'present'
                                ? colors.success
                                : record.status === 'absent'
                                ? colors.error
                                : colors.warning,
                          },
                        ]}
                      >
                        {record.status || (record.present_days > 0 ? 'Present' : 'Absent')}
                      </Text>
                    </View>
                  </View>

                  {/* Metrics grid */}
                  <View style={styles.attendanceMetricsRow}>
                    <View style={styles.attendanceMetric}>
                      <Text style={[styles.metricLabelSmall, { color: colors.textSecondary }]}>
                        Working Days
                      </Text>
                      <Text style={[styles.metricValueSmall, { color: colors.text }]}>
                        {record.total_working_days?.toFixed
                          ? record.total_working_days.toFixed(0)
                          : record.total_working_days || 0}
                      </Text>
                    </View>
                    <View style={styles.attendanceMetric}>
                      <Text style={[styles.metricLabelSmall, { color: colors.textSecondary }]}>
                        Present
                      </Text>
                      <Text style={[styles.metricValueSmall, { color: colors.text }]}>
                        {record.present_days?.toFixed
                          ? record.present_days.toFixed(1)
                          : record.present_days || 0}
                      </Text>
                    </View>
                    <View style={styles.attendanceMetric}>
                      <Text style={[styles.metricLabelSmall, { color: colors.textSecondary }]}>
                        Absent
                      </Text>
                      <Text style={[styles.metricValueSmall, { color: colors.text }]}>
                        {record.absent_days?.toFixed
                          ? record.absent_days.toFixed(1)
                          : record.absent_days || 0}
                      </Text>
                    </View>
                    <View style={styles.attendanceMetric}>
                      <Text style={[styles.metricLabelSmall, { color: colors.textSecondary }]}>
                        OT Hrs
                      </Text>
                      <Text style={[styles.metricValueSmall, { color: colors.text }]}>
                        {(typeof record.ot_hours === 'string'
                          ? parseFloat(record.ot_hours) || 0
                          : record.ot_hours || 0
                        ).toFixed(1)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.attendanceMetricsRow}>
                    <View style={styles.attendanceMetric}>
                      <Text style={[styles.metricLabelSmall, { color: colors.textSecondary }]}>
                        Late (min)
                      </Text>
                      <Text style={[styles.metricValueSmall, { color: colors.text }]}>
                        {(typeof record.late_minutes === 'string'
                          ? parseFloat(record.late_minutes) || 0
                          : record.late_minutes || 0
                        ).toFixed(0)}
                      </Text>
                    </View>
                    <View style={styles.attendanceMetric}>
                      <Text style={[styles.metricLabelSmall, { color: colors.textSecondary }]}>
                        Off Days
                      </Text>
                      <Text style={[styles.metricValueSmall, { color: colors.text }]}>
                        {record.off_days || 0}
                      </Text>
                    </View>
                    <View style={styles.attendanceMetric}>
                      <Text style={[styles.metricLabelSmall, { color: colors.textSecondary }]}>
                        Holidays
                      </Text>
                      <Text style={[styles.metricValueSmall, { color: colors.text }]}>
                        {record.holiday_days || 0}
                      </Text>
                    </View>
                    <View style={styles.attendanceMetric}>
                      <Text style={[styles.metricLabelSmall, { color: colors.textSecondary }]}>
                        Present %
                      </Text>
                      <Text
                        style={[
                          styles.metricValueSmall,
                          {
                            color:
                              attendancePercentage >= 90
                                ? colors.success
                                : attendancePercentage >= 75
                                ? colors.warning
                                : colors.error,
                          },
                        ]}
                      >
                        {attendancePercentage.toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )
      )}

      {/* Filter Type Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Filter</Text>
            {filterTypeOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOption,
                  {
                    backgroundColor: filterType === option.value ? `${colors.primary}20` : 'transparent',
                    borderLeftWidth: filterType === option.value ? 4 : 0,
                    borderLeftColor: filterType === option.value ? colors.primary : 'transparent',
                  },
                ]}
                onPress={() => {
                  setFilterType(option.value as FilterType);
                  setShowFilterModal(false);
                }}
              >
                <Text style={[styles.modalOptionText, { color: filterType === option.value ? colors.primary : colors.text }]}>
                  {option.label}
                </Text>
                {filterType === option.value && <FontAwesome name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Year Modal */}
      <Modal
        visible={showYearModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowYearModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowYearModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Year</Text>
            {availableYears.map((year) => (
              <TouchableOpacity
                key={year}
                style={[
                  styles.modalOption,
                  {
                    backgroundColor: selectedYear === year ? `${colors.primary}20` : 'transparent',
                    borderLeftWidth: selectedYear === year ? 4 : 0,
                    borderLeftColor: selectedYear === year ? colors.primary : 'transparent',
                  },
                ]}
                onPress={() => {
                  setSelectedYear(year);
                  setShowYearModal(false);
                }}
              >
                <Text style={[styles.modalOptionText, { color: selectedYear === year ? colors.primary : colors.text }]}>
                  {year}
                </Text>
                {selectedYear === year && <FontAwesome name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Month Modal */}
      <Modal
        visible={showMonthModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMonthModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMonthModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Month</Text>
            {monthNames.map((month) => (
              <TouchableOpacity
                key={month}
                style={[
                  styles.modalOption,
                  {
                    backgroundColor: selectedMonth === month ? `${colors.primary}20` : 'transparent',
                    borderLeftWidth: selectedMonth === month ? 4 : 0,
                    borderLeftColor: selectedMonth === month ? colors.primary : 'transparent',
                  },
                ]}
                onPress={() => {
                  setSelectedMonth(month);
                  setShowMonthModal(false);
                }}
              >
                <Text style={[styles.modalOptionText, { color: selectedMonth === month ? colors.primary : colors.text }]}>
                  {month}
                </Text>
                {selectedMonth === month && <FontAwesome name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
});

TrackAttendanceTab.displayName = 'TrackAttendanceTab';

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
      {/* Header with sleek date dropdown and search */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View style={styles.headerControls}>
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

          <View style={[styles.headerSearch, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
            <FontAwesome name="search" size={16} color="rgba(255,255,255,0.9)" />
            <TextInput
              style={styles.headerSearchInput}
              placeholder="Search by name or ID..."
              placeholderTextColor="rgba(255,255,255,0.9)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <FontAwesome name="times-circle" size={16} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
            )}
          </View>
        </View>
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
        {/* Filters moved to header: date + search */}

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
        /* Track Attendance Tab - Redesigned to match web dashboard */
        <TrackAttendanceTab 
          colors={colors}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
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
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerSearch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  headerSearchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    color: 'white',
    fontSize: 14,
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
  trackHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  trackTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  trackSubtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  trackFiltersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
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
  // Track Attendance Tab Styles
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  departmentScroll: {
    flex: 1,
  },
  departmentChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  departmentChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dateSelectionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  dateSelectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateSelectButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  dateSelectButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  // Old wide table styles kept for reference (no longer used for tracker)
  tableScrollContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  percentageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Card-based tracker list
  attendanceCardsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  attendanceCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  attendanceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  attendanceName: {
    fontSize: 15,
    fontWeight: '600',
  },
  attendanceSub: {
    marginTop: 2,
    fontSize: 12,
  },
  attendanceStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  attendanceStatusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  attendanceMetricsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  attendanceMetric: {
    flex: 1,
    paddingVertical: 4,
  },
  metricLabelSmall: {
    fontSize: 11,
  },
  metricValueSmall: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
