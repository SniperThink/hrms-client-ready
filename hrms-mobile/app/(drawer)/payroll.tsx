import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native';
import { useAppSelector } from '@/store/hooks';
import { API_BASE_URL } from '@/constants/Config';
import { storage } from '@/utils/storage';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

// Tab types
type TabType = 'overview' | 'detailed' | 'saved' | 'advances';

// Interfaces
interface AttendancePeriod {
  year: number;
  month: string;
  month_num: number;
  month_display: string;
  attendance_records: number;
  employees_with_attendance: number;
}

interface PayrollEntry {
  employee_id: string;
  employee_name: string;
  department: string;
  base_salary: number;
  total_days?: number;
  working_days: number;
  present_days: number;
  absent_days: number;
  off_days?: number;
  holiday_days?: number;
  weekly_penalty_days?: number;
  ot_hours: number;
  late_minutes: number;
  gross_salary: number;
  ot_charges: number;
  late_deduction: number;
  tds_percentage: number;
  tds_amount: number;
  advance_deduction: number;
  net_salary: number;
  is_paid: boolean;
}

interface PayrollSummary {
  total_employees: number;
  total_days?: number;
  working_days: number;
  month_year: string;
  total_base_salary: number;
  total_gross_salary: number;
  total_net_salary: number;
}

interface AdvanceRecord {
  id: number;
  employee_id: string;
  employee_name: string;
  amount: number;
  advance_date: string;
  for_month: string;
  payment_method: string;
  remarks: string;
  remaining_balance: number;
  is_active: boolean;
  status: string;
}

interface SavedPayrollPeriod {
  id: number;
  year: number;
  month: string;
  month_display: string;
  total_employees: number;
  paid_employees: number;
  pending_employees: number;
  total_gross_salary: number;
  total_net_salary: number;
  status: string;
  is_locked: boolean;
}

interface SavedPayrollEmployee {
  id: number;
  employee_id: string;
  employee_name: string;
  department: string;
  net_payable: number;
  is_paid: boolean;
  payment_date?: string;
}

// Saved Periods Tab Component (defined before main component)
const SavedPeriodsTab: React.FC<{
  savedPeriods: SavedPayrollPeriod[];
  selectedPeriod: SavedPayrollPeriod | null;
  employees: SavedPayrollEmployee[];
  loading: boolean;
  tempPaidStatus: { [key: string]: boolean };
  hasUnsavedChanges: boolean;
  onSelectPeriod: (period: SavedPayrollPeriod) => void;
  onBack: () => void;
  onTogglePaid: (employeeId: string) => void;
  onMarkAllPaid: () => void;
  onSaveChanges: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  colors: any;
}> = ({
  savedPeriods,
  selectedPeriod,
  employees,
  loading,
  tempPaidStatus,
  hasUnsavedChanges,
  onSelectPeriod,
  onBack,
  onTogglePaid,
  onMarkAllPaid,
  onSaveChanges,
  onRefresh,
  refreshing,
  colors,
}) => {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showYearModal, setShowYearModal] = useState(false);

  // Get unique years from saved periods with null safety
  const availableYears = Array.from(new Set((savedPeriods || []).map(p => p.year))).sort((a, b) => b - a);

  // Filter periods by selected year with null safety
  const filteredPeriods = selectedYear 
    ? (savedPeriods || []).filter(p => p.year === selectedYear)
    : (savedPeriods || []);
  // If a period is selected, show employee table
  if (selectedPeriod) {
    return (
      <View style={{ flex: 1 }}>
        {/* Fixed Header Section */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            {/* Back Button */}
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 12 }]}
              onPress={onBack}
            >
              <Text style={[{ color: colors.primary, fontSize: 14, fontWeight: '600' }]}>← Back to Periods</Text>
            </TouchableOpacity>

            {/* Period Header */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: 18 }]}>
                {selectedPeriod.month_display}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  Total: {selectedPeriod.total_employees} | Paid: {selectedPeriod.paid_employees} | Pending: {selectedPeriod.pending_employees}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            {!selectedPeriod.is_locked && (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.actionButton, { marginRight: 8, backgroundColor: colors.success }]}
                    onPress={onMarkAllPaid}
                  >
                    <Text style={styles.actionButtonText}>Mark All Paid</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { marginLeft: 8, backgroundColor: colors.primary },
                      !hasUnsavedChanges && styles.disabledButton,
                    ]}
                    onPress={onSaveChanges}
                    disabled={!hasUnsavedChanges}
                  >
                    <Text style={styles.actionButtonText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
        </View>

        {/* Sticky Table Header */}
        <View style={[styles.stickyTableHeader, { backgroundColor: colors.background, borderBottomColor: colors.border, borderTopColor: colors.border }]}>
          <Text style={[styles.tableHeaderText, { color: colors.text, flex: 2 }]}>Employee</Text>
          <Text style={[styles.tableHeaderText, { color: colors.text, flex: 1.5, textAlign: 'right' }]}>Amount</Text>
          <Text style={[styles.tableHeaderText, { color: colors.text, flex: 1, textAlign: 'center' }]}>Status</Text>
        </View>

        {/* Scrollable Table Content */}
        <FlatList
          data={employees}
          keyExtractor={(item) => item.id.toString()}
          style={{ flex: 1 }}
          renderItem={({ item: employee, index }) => {
                const isPaid =
                  tempPaidStatus[employee.employee_id] !== undefined
                    ? tempPaidStatus[employee.employee_id]
                    : employee.is_paid;

                return (
                  <View
                    style={[
                      styles.tableRow,
                      { borderBottomColor: colors.border },
                      index === employees.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    {/* Employee Info */}
                    <View style={{ flex: 2 }}>
                      <Text style={[styles.tableCell, { color: colors.text, fontWeight: '600' }]}>
                        {employee.employee_name}
                      </Text>
                      <Text style={[styles.tableCellSmall, { color: colors.textSecondary }]}>
                        {employee.employee_id} • {employee.department}
                      </Text>
                    </View>

                    {/* Amount */}
                    <View style={{ flex: 1.5, alignItems: 'flex-end', justifyContent: 'center' }}>
                      <Text style={[styles.tableCell, { color: colors.primary, fontWeight: '600' }]}>
                        ₹{employee.net_payable.toLocaleString()}
                      </Text>
                    </View>

                    {/* Status Button */}
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      {!selectedPeriod.is_locked ? (
                        <TouchableOpacity
                          style={[
                            styles.statusButton,
                            {
                              backgroundColor: isPaid ? colors.success + '20' : colors.warning + '20',
                              borderColor: isPaid ? colors.success : colors.warning,
                            },
                          ]}
                          onPress={() => onTogglePaid(employee.employee_id)}
                        >
                          <Text
                            style={[
                              styles.statusButtonText,
                              { color: isPaid ? colors.success : colors.warning },
                            ]}
                          >
                            {isPaid ? '✓ Paid' : 'Pending'}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View
                          style={[
                            styles.statusButton,
                            {
                              backgroundColor: isPaid ? colors.success + '20' : colors.warning + '20',
                              borderColor: isPaid ? colors.success : colors.warning,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusButtonText,
                              { color: isPaid ? colors.success : colors.warning },
                            ]}
                          >
                            {isPaid ? '✓ Paid' : 'Pending'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
        }}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        removeClippedSubviews={true}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        ListEmptyComponent={
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary }}>No employees found</Text>
          </View>
        }
      />
      </View>
    );
  }

  // Show periods list with ScrollView
  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Saved Payroll Periods</Text>
          <Text style={[{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }]}>
            Select a period to view and mark employees as paid
          </Text>

          {/* Year Filter */}
          {availableYears.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={[{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }]}>Filter by Year</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                <TouchableOpacity
                  style={[
                    styles.yearChip,
                    { 
                      backgroundColor: selectedYear === null ? colors.primary : colors.background,
                      borderColor: colors.border,
                    }
                  ]}
                  onPress={() => setSelectedYear(null)}
                >
                  <Text style={[
                    styles.yearChipText,
                    { color: selectedYear === null ? '#fff' : colors.text }
                  ]}>
                    All Years
                  </Text>
                </TouchableOpacity>
                {availableYears.map((year) => (
                  <TouchableOpacity
                    key={year}
                    style={[
                      styles.yearChip,
                      { 
                        backgroundColor: selectedYear === year ? colors.primary : colors.background,
                        borderColor: colors.border,
                      }
                    ]}
                    onPress={() => setSelectedYear(year)}
                  >
                    <Text style={[
                      styles.yearChipText,
                      { color: selectedYear === year ? '#fff' : colors.text }
                    ]}>
                      {year}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
        ) : filteredPeriods.length > 0 ? (
          filteredPeriods.map((period) => (
          <TouchableOpacity
            key={period.id}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => onSelectPeriod(period)}
          >
            <View style={styles.employeeHeader}>
              <Text style={[styles.employeeName, { color: colors.text }]}>
                {period.month_display}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: period.is_locked ? colors.error + '20' : colors.success + '20',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: period.is_locked ? colors.error : colors.success },
                  ]}
                >
                  {period.is_locked ? 'Locked' : 'Active'}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 8, gap: 4 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                Employees: {period.total_employees} | Paid: {period.paid_employees} | Pending: {period.pending_employees}
              </Text>
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '600' }}>
                Total: ₹{period.total_net_salary.toLocaleString()}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateText, { color: colors.textLight }]}>
            No saved payroll periods found
          </Text>
        </View>
      )}
      </ScrollView>
    </>
  );
};

const PayrollScreen = () => {
  const { tenant } = useAppSelector((state) => state.auth);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Period selection
  const [attendancePeriods, setAttendancePeriods] = useState<AttendancePeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<AttendancePeriod | null>(null);
  const [showPeriodModal, setShowPeriodModal] = useState(false);

  // Payroll data
  const [payrollData, setPayrollData] = useState<PayrollEntry[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [calculating, setCalculating] = useState(false);

  // Advances
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [advancesLoading, setAdvancesLoading] = useState(false);

  // Saved Periods
  const [savedPeriods, setSavedPeriods] = useState<SavedPayrollPeriod[]>([]);
  const [selectedSavedPeriod, setSelectedSavedPeriod] = useState<SavedPayrollPeriod | null>(null);
  const [savedPeriodEmployees, setSavedPeriodEmployees] = useState<SavedPayrollEmployee[]>([]);
  const [savedPeriodsLoading, setSavedPeriodsLoading] = useState(false);
  const [tempPaidStatus, setTempPaidStatus] = useState<{ [key: string]: boolean }>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    fetchAttendancePeriods();
  }, []);

  const fetchAttendancePeriods = async () => {
    try {
      setLoading(true);
      const token = await storage.getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/months-with-attendance/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-ID': tenant?.subdomain || '',
        },
      });

      const data = await response.json();
      if (data.success) {
        setAttendancePeriods(data.periods);
      }
    } catch (error) {
      console.error('Error fetching periods:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePayroll = async () => {
    if (!selectedPeriod) {
      Alert.alert('Error', 'Please select a period first');
      return;
    }

    try {
      setCalculating(true);
      const token = await storage.getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/calculate-simple-payroll-ultra-fast/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-ID': tenant?.subdomain || '',
        },
        body: JSON.stringify({
          year: selectedPeriod.year,
          month: selectedPeriod.month_num,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setPayrollData(data.payroll_data);
        setSummary(data.summary);
      } else {
        Alert.alert('Error', data.error || 'Failed to calculate payroll');
      }
    } catch (error) {
      console.error('Error calculating payroll:', error);
      Alert.alert('Error', 'Failed to calculate payroll');
    } finally {
      setCalculating(false);
    }
  };

  const savePayroll = async () => {
    if (!selectedPeriod || payrollData.length === 0) {
      Alert.alert('Error', 'No payroll data to save');
      return;
    }

    try {
      setCalculating(true);
      const token = await storage.getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/save-payroll-period-direct/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-ID': tenant?.subdomain || '',
        },
        body: JSON.stringify({
          year: selectedPeriod.year,
          month: selectedPeriod.month_num,
          payroll_entries: payrollData.map((entry) => ({
            employee_id: entry.employee_id,
            employee_name: entry.employee_name,
            department: entry.department,
            base_salary: entry.base_salary,
            working_days: entry.working_days,
            present_days: entry.present_days,
            absent_days: entry.absent_days,
            holiday_days: entry.holiday_days || 0,
            weekly_penalty_days: entry.weekly_penalty_days || 0,
            ot_hours: entry.ot_hours,
            late_minutes: entry.late_minutes,
            gross_salary: entry.gross_salary,
            ot_charges: entry.ot_charges,
            late_deduction: entry.late_deduction,
            tds_percentage: entry.tds_percentage,
            tds_amount: entry.tds_amount,
            advance_deduction: entry.advance_deduction,
            net_salary: entry.net_salary,
            is_paid: entry.is_paid || false,
          })),
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Payroll saved successfully!');
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'Failed to save payroll');
      }
    } catch (error) {
      console.error('Error saving payroll:', error);
      Alert.alert('Error', 'Failed to save payroll');
    } finally {
      setCalculating(false);
    }
  };

  const loadAdvances = async () => {
    try {
      setAdvancesLoading(true);
      const token = await storage.getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/advance-payments/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-ID': tenant?.subdomain || '',
        },
      });

      const data = await response.json();
      if (data?.results && Array.isArray(data.results)) {
        setAdvances(data.results);
      }
    } catch (error) {
      console.error('Error loading advances:', error);
    } finally {
      setAdvancesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'advances') {
      loadAdvances();
    } else if (activeTab === 'saved') {
      loadSavedPeriods();
    }
  }, [activeTab]);

  const loadSavedPeriods = async () => {
    try {
      setSavedPeriodsLoading(true);
      const token = await storage.getAccessToken();
      
      console.log('Loading saved periods from:', `${API_BASE_URL}/api/payroll-overview/`);
      console.log('Tenant subdomain:', tenant?.subdomain);
      
      if (!token) {
        Alert.alert('Error', 'No authentication token found. Please login again.');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/payroll-overview/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-ID': tenant?.subdomain || '',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        Alert.alert('Error', `Failed to load periods: ${response.status}`);
        return;
      }

      const data = await response.json();
      console.log('Periods loaded:', data?.periods?.length || 0);
      
      if (data?.periods && Array.isArray(data.periods)) {
        setSavedPeriods(data.periods);
      } else {
        console.warn('No periods found in response');
        setSavedPeriods([]);
      }
    } catch (error) {
      console.error('Error loading saved periods:', error);
      Alert.alert(
        'Network Error',
        'Failed to connect to server. Please check your internet connection and try again.'
      );
    } finally {
      setSavedPeriodsLoading(false);
    }
  };

  const loadPeriodEmployees = async (periodId: number, loadMore: boolean = false) => {
    try {
      if (!loadMore) {
        setSavedPeriodsLoading(true);
      }
      
      const token = await storage.getAccessToken();
      
      // Load all employees without pagination (same as web dashboard)
      const response = await fetch(`${API_BASE_URL}/api/payroll-period-detail/${periodId}/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-ID': tenant?.subdomain || '',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        Alert.alert('Error', `Failed to load period details: ${response.status}`);
        return;
      }

      const data = await response.json();
      console.log('Period detail response:', {
        success: data?.success,
        employeeCount: data?.employees?.length,
        hasEmployees: Array.isArray(data?.employees),
      });

      if (data?.success && data?.employees && Array.isArray(data.employees)) {
        setSavedPeriodEmployees(data.employees);
        setTempPaidStatus({});
        setHasUnsavedChanges(false);
        console.log(`Loaded ${data.employees.length} employees for period ${periodId}`);
      } else {
        console.error('Invalid response format:', data);
        Alert.alert('Error', 'Invalid response format from server');
      }
    } catch (error) {
      console.error('Error loading period employees:', error);
      Alert.alert('Error', 'Failed to load period employees');
    } finally {
      setSavedPeriodsLoading(false);
    }
  };

  const togglePaidStatus = (employeeId: string) => {
    const employee = savedPeriodEmployees.find((e) => e.employee_id === employeeId);
    if (!employee) return;

    const currentStatus =
      tempPaidStatus[employeeId] !== undefined ? tempPaidStatus[employeeId] : employee.is_paid;

    setTempPaidStatus((prev) => ({
      ...prev,
      [employeeId]: !currentStatus,
    }));
    setHasUnsavedChanges(true);
  };

  const markAllAsPaid = () => {
    const newChanges: { [key: string]: boolean } = {};
    savedPeriodEmployees.forEach((employee) => {
      const currentStatus =
        tempPaidStatus[employee.employee_id] !== undefined
          ? tempPaidStatus[employee.employee_id]
          : employee.is_paid;
      if (!currentStatus) {
        newChanges[employee.employee_id] = true;
      }
    });

    setTempPaidStatus((prev) => ({
      ...prev,
      ...newChanges,
    }));

    if (Object.keys(newChanges).length > 0) {
      setHasUnsavedChanges(true);
    }
  };

  const savePaidStatusChanges = async () => {
    if (!selectedSavedPeriod) return;

    try {
      setSavedPeriodsLoading(true);
      const token = await storage.getAccessToken();

      const updatedEntries = savedPeriodEmployees.map((employee) => ({
        employee_id: employee.employee_id,
        is_paid:
          tempPaidStatus[employee.employee_id] !== undefined
            ? tempPaidStatus[employee.employee_id]
            : employee.is_paid,
        advance_deduction_amount: 0,
        net_payable: employee.net_payable,
      }));

      const response = await fetch(
        `${API_BASE_URL}/api/payroll-periods/${selectedSavedPeriod.id}/bulk-update/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Tenant-ID': tenant?.subdomain || '',
          },
          body: JSON.stringify({
            entries: updatedEntries,
          }),
        }
      );

      if (response.ok) {
        Alert.alert('Success', 'Payment status updated successfully!');
        await loadPeriodEmployees(selectedSavedPeriod.id);
        await loadSavedPeriods();
      } else {
        Alert.alert('Error', 'Failed to update payment status');
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setSavedPeriodsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAttendancePeriods();
    if (activeTab === 'advances') {
      await loadAdvances();
    }
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Tabs */}
      <View style={[styles.tabContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'overview' ? colors.primary : colors.textSecondary }]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'detailed' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('detailed')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'detailed' ? colors.primary : colors.textSecondary }]}>
            Detailed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'saved' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('saved')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'saved' ? colors.primary : colors.textSecondary }]}>
            Saved
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'advances' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('advances')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'advances' ? colors.primary : colors.textSecondary }]}>
            Advances
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'saved' || activeTab === 'detailed' ? (
        // Saved and Detailed tabs use their own scrolling with FlatList
        <>
          {activeTab === 'saved' && (
            <SavedPeriodsTab
              savedPeriods={savedPeriods}
              selectedPeriod={selectedSavedPeriod}
              employees={savedPeriodEmployees}
              loading={savedPeriodsLoading}
              tempPaidStatus={tempPaidStatus}
              hasUnsavedChanges={hasUnsavedChanges}
              onSelectPeriod={(period) => {
                setSelectedSavedPeriod(period);
                loadPeriodEmployees(period.id);
              }}
              onBack={() => setSelectedSavedPeriod(null)}
              onTogglePaid={togglePaidStatus}
              onMarkAllPaid={markAllAsPaid}
              onSaveChanges={savePaidStatusChanges}
              onRefresh={onRefresh}
              refreshing={refreshing}
              colors={colors}
            />
          )}
          {activeTab === 'detailed' && (
            <DetailedTab
              selectedPeriod={selectedPeriod}
              payrollData={payrollData}
              summary={summary}
              onSelectPeriod={() => setShowPeriodModal(true)}
              onCalculate={calculatePayroll}
              onSave={savePayroll}
              calculating={calculating}
              colors={colors}
            />
          )}
        </>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {activeTab === 'overview' && (
            <OverviewTab
              selectedPeriod={selectedPeriod}
              summary={summary}
              payrollData={payrollData}
              onSelectPeriod={() => setShowPeriodModal(true)}
              onCalculate={calculatePayroll}
              calculating={calculating}
              colors={colors}
            />
          )}
          {activeTab === 'advances' && (
            <AdvancesTab
              advances={advances}
              loading={advancesLoading}
              onRefresh={loadAdvances}
              colors={colors}
            />
          )}
        </ScrollView>
      )}

      {/* Period Selection Modal */}
      <Modal visible={showPeriodModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Period</Text>
              <TouchableOpacity onPress={() => setShowPeriodModal(false)}>
                <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={attendancePeriods}
              keyExtractor={(item) => `${item.year}-${item.month_num}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.periodItem,
                    { borderBottomColor: colors.border },
                    selectedPeriod?.month_num === item.month_num &&
                      selectedPeriod?.year === item.year &&
                      { backgroundColor: `${colors.primary}20` },
                  ]}
                  onPress={() => {
                    setSelectedPeriod(item);
                    setShowPeriodModal(false);
                  }}
                >
                  <Text style={[styles.periodText, { color: colors.text }]}>{item.month_display}</Text>
                  <Text style={[styles.periodSubtext, { color: colors.textSecondary }]}>
                    {item.employees_with_attendance} employees
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Overview Tab Component
const OverviewTab: React.FC<{
  selectedPeriod: AttendancePeriod | null;
  summary: PayrollSummary | null;
  payrollData: PayrollEntry[];
  onSelectPeriod: () => void;
  onCalculate: () => void;
  calculating: boolean;
  colors: any;
}> = ({
  selectedPeriod,
  summary,
  payrollData,
  onSelectPeriod,
  onCalculate,
  calculating,
  colors,
}) => {
  return (
      <View style={styles.tabContent}>
        {/* Period Selection */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Select Period</Text>
          <TouchableOpacity style={[styles.selectButton, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={onSelectPeriod}>
            <Text style={[styles.selectButtonText, { color: colors.text }]}>
              {selectedPeriod ? selectedPeriod.month_display : 'Select a period'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.calculateButton, { backgroundColor: colors.primary }, calculating && styles.disabledButton]}
            onPress={onCalculate}
            disabled={calculating || !selectedPeriod}
          >
            {calculating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.calculateButtonText}>Calculate Payroll</Text>
            )}
          </TouchableOpacity>
        </View>

        
        {/* KPI Cards */}
        {summary && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Summary - {summary.month_year}</Text>
            <View style={styles.kpiGrid}>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Total Employees</Text>
                <Text style={[styles.kpiValue, { color: colors.primary }]}>{summary.total_employees}</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Total Base</Text>
                <Text style={[styles.kpiValue, { color: colors.text }]}>₹{summary.total_base_salary.toLocaleString()}</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Total OT</Text>
                <Text style={[styles.kpiValue, { color: colors.success }]}>
                  ₹
                  {payrollData
                    .reduce((sum, emp) => sum + (emp.ot_charges || 0), 0)
                    .toLocaleString()}
                </Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Late Deduction</Text>
                <Text style={[styles.kpiValue, { color: colors.error }]}>
                  ₹
                  {payrollData
                    .reduce((sum, emp) => sum + (emp.late_deduction || 0), 0)
                    .toLocaleString()}
                </Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Total Gross</Text>
                <Text style={[styles.kpiValue, { color: colors.text }]}>₹{summary.total_gross_salary.toLocaleString()}</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Total TDS</Text>
                <Text style={[styles.kpiValue, { color: colors.warning }]}>
                  ₹
                  {payrollData
                    .reduce((sum, emp) => sum + (emp.tds_amount || 0), 0)
                    .toLocaleString()}
                </Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Total Net</Text>
                <Text style={[styles.kpiValue, { color: colors.primary }]}>₹{summary.total_net_salary.toLocaleString()}</Text>
              </View>
            </View>
            {/* Payroll Calculation Formula */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>💰 Payroll Calculation Formula</Text>
          
          <View style={{ marginTop: 12 }}>
            {/* Step 1 */}
            <View style={styles.formulaStep}>
              <Text style={[styles.formulaStepNumber, { backgroundColor: colors.primary + '20', color: colors.primary }]}>1</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.formulaTitle, { color: colors.text }]}>Gross Salary</Text>
                <Text style={[styles.formulaText, { color: colors.textSecondary }]}>
                  = Base Salary + OT Charges - Late Deduction
                </Text>
              </View>
            </View>

            {/* Step 2 */}
            <View style={styles.formulaStep}>
              <Text style={[styles.formulaStepNumber, { backgroundColor: colors.primary + '20', color: colors.primary }]}>2</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.formulaTitle, { color: colors.text }]}>After TDS</Text>
                <Text style={[styles.formulaText, { color: colors.textSecondary }]}>
                  = Gross Salary - TDS Amount
                </Text>
              </View>
            </View>

            {/* Step 3 */}
            <View style={styles.formulaStep}>
              <Text style={[styles.formulaStepNumber, { backgroundColor: colors.primary + '20', color: colors.primary }]}>3</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.formulaTitle, { color: colors.text }]}>Net Salary</Text>
                <Text style={[styles.formulaText, { color: colors.textSecondary }]}>
                  = After TDS - Advance Deduction
                </Text>
              </View>
            </View>

            {/* Additional Info */}
            <View style={[styles.formulaInfo, { backgroundColor: colors.background, borderLeftColor: colors.primary }]}>
              <Text style={[styles.formulaInfoText, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: '600', color: colors.text }}>Note:</Text> Base Salary is calculated based on present days, working days, and attendance.
              </Text>
            </View>
          </View>
        </View>

          </>

        )}
      </View>

      
    );
};

// Detailed Tab Component
const DetailedTab: React.FC<{
  selectedPeriod: AttendancePeriod | null;
  payrollData: PayrollEntry[];
  summary: PayrollSummary | null;
  onSelectPeriod: () => void;
  onCalculate: () => void;
  onSave: () => void;
  calculating: boolean;
  colors: any;
}> = ({
  selectedPeriod,
  payrollData,
  summary,
  onSelectPeriod,
  onCalculate,
  onSave,
  calculating,
  colors,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const filteredData = payrollData.filter(
    (entry) =>
      entry.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.employee_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedData = filteredData.slice(0, pageNumber * 20);

  const loadMoreData = () => {
    if (displayedData.length < filteredData.length && !loadingMore) {
      setLoadingMore(true);
      setTimeout(() => {
        setPageNumber(prev => prev + 1);
        setLoadingMore(false);
      }, 300);
    }
  };

  // Header component for FlatList
  const ListHeaderComponent = () => (
    <>
      {/* Period Selection */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Select Period</Text>
        <TouchableOpacity style={[styles.selectButton, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={onSelectPeriod}>
          <Text style={[styles.selectButtonText, { color: colors.text }]}>
            {selectedPeriod ? selectedPeriod.month_display : 'Select a period'}
          </Text>
        </TouchableOpacity>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.actionButton, { marginRight: 8, backgroundColor: colors.primary }, calculating && styles.disabledButton]}
            onPress={onCalculate}
            disabled={calculating || !selectedPeriod}
          >
            {calculating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.actionButtonText}>Calculate</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { marginLeft: 8, backgroundColor: colors.info }, calculating && styles.disabledButton]}
            onPress={onSave}
            disabled={calculating || payrollData.length === 0}
          >
            <Text style={styles.actionButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>

        {/* Search */}
        {payrollData.length > 0 && (
          <View style={styles.searchContainer}>
            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="Search by name or ID..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        )}

        {/* List Header */}
        {filteredData.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 0, paddingBottom: 8 }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Payroll Details ({filteredData.length} employees)
            </Text>
          </View>
        )}
      </>
    );

    return (
      <FlatList
        data={displayedData}
        keyExtractor={(item) => item.employee_id}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={styles.tabContent}
        onEndReached={loadMoreData}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
                Loading more employees...
              </Text>
            </View>
          ) : displayedData.length < filteredData.length ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary }}>
                Showing {displayedData.length} of {filteredData.length} employees
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item: entry }) => (
              <View key={entry.employee_id} style={[styles.employeeCard, { borderBottomColor: colors.border }]}>
                <View style={styles.employeeHeader}>
                  <Text style={[styles.employeeName, { color: colors.text }]}>{entry.employee_name}</Text>
                  <Text style={[styles.employeeId, { color: colors.textSecondary }]}>{entry.employee_id}</Text>
                </View>
                <Text style={[styles.employeeDept, { color: colors.textLight }]}>{entry.department}</Text>

                <View style={styles.detailsGrid}>
                  <DetailRow label="Base Salary" value={`₹${entry.base_salary.toLocaleString()}`} />
                  <DetailRow label="Present Days" value={entry.present_days.toString()} />
                  <DetailRow label="Absent Days" value={entry.absent_days.toString()} />
                  <DetailRow label="OT Hours" value={entry.ot_hours.toString()} />
                  <DetailRow label="OT Charges" value={`₹${entry.ot_charges.toLocaleString()}`} />
                  <DetailRow
                    label="Late Deduction"
                    value={`₹${entry.late_deduction.toLocaleString()}`}
                  />
                  <DetailRow
                    label="Gross Salary"
                    value={`₹${entry.gross_salary.toLocaleString()}`}
                  />
                  <DetailRow label="TDS" value={`₹${entry.tds_amount.toLocaleString()}`} />
                  <DetailRow
                    label="Advance Deduction"
                    value={`₹${entry.advance_deduction.toLocaleString()}`}
                  />
                </View>

                <View style={[styles.netSalaryRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.netSalaryLabel, { color: colors.text }]}>Net Salary</Text>
                  <Text style={[styles.netSalaryValue, { color: colors.primary }]}>
                    ₹{entry.net_salary.toLocaleString()}
                  </Text>
                </View>
              </View>
        )}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => ({
          length: 400, // Approximate height of each item
          offset: 400 * index,
          index,
        })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: colors.textLight }]}>
              {payrollData.length === 0 ? 'No payroll data. Calculate payroll first.' : 'No employees found'}
            </Text>
          </View>
        }
      />
    );
};

// Advances Tab Component
const AdvancesTab: React.FC<{
  advances: AdvanceRecord[];
  loading: boolean;
  onRefresh: () => void;
  colors: any;
}> = ({
  advances,
  loading,
  onRefresh,
  colors,
}) => {
  const { tenant } = useAppSelector((state) => state.auth);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<AdvanceRecord | null>(null);
  const [advanceForm, setAdvanceForm] = useState({
    employee_id: '',
    amount: '',
    for_month: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    payment_method: 'CASH',
    remarks: ''
  });

  const handleAddAdvance = async () => {
    if (!advanceForm.employee_id || !advanceForm.amount) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const token = await storage.getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/advance-payments/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenant?.subdomain || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...advanceForm,
          amount: parseFloat(advanceForm.amount)
        })
      });

      if (response.ok) {
        Alert.alert('Success', 'Advance added successfully');
        setShowAddModal(false);
        setAdvanceForm({
          employee_id: '',
          amount: '',
          for_month: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          payment_method: 'CASH',
          remarks: ''
        });
        onRefresh();
      } else {
        Alert.alert('Error', 'Failed to add advance');
      }
    } catch (error) {
      console.error('Error adding advance:', error);
      Alert.alert('Error', 'Failed to add advance');
    }
  };

  const handleDeleteAdvance = async (advanceId: number) => {
    try {
      const token = await storage.getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/advance-payments/${advanceId}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenant?.subdomain || '',
        }
      });

      if (response.ok) {
        Alert.alert('Success', 'Advance deleted successfully');
        setShowEditModal(false);
        onRefresh();
      } else {
        Alert.alert('Error', 'Failed to delete advance');
      }
    } catch (error) {
      console.error('Error deleting advance:', error);
      Alert.alert('Error', 'Failed to delete advance');
    }
  };

    const filteredAdvances = advances.filter(
      (advance) =>
        advance.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        advance.employee_id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalAdvances = filteredAdvances.reduce((sum, adv) => sum + adv.amount, 0);
    const totalRemaining = filteredAdvances
      .filter((adv) => adv.is_active)
      .reduce((sum, adv) => sum + adv.remaining_balance, 0);
    const activeCount = filteredAdvances.filter(
      (adv) => adv.is_active && adv.remaining_balance > 0
    ).length;

    return (
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView style={styles.tabContent}>
        {/* Summary Cards */}
        <View style={styles.advanceSummaryGrid}>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Total Advances</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>₹{totalAdvances.toLocaleString()}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Remaining</Text>
            <Text style={[styles.kpiValue, { color: colors.warning }]}>₹{totalRemaining.toLocaleString()}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Active</Text>
            <Text style={[styles.kpiValue, { color: colors.success }]}>{activeCount}</Text>
          </View>
        </View>

        {/* Search and Add Button */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <TextInput
            style={[styles.searchInput, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            placeholder="Search by name or ID..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowAddModal(true)}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Advances List */}
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
        ) : filteredAdvances.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Advance Payments ({filteredAdvances.length})
            </Text>
            {filteredAdvances.map((advance) => (
              <TouchableOpacity 
                key={advance.id} 
                style={[styles.advanceCard, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setSelectedAdvance(advance);
                  setShowEditModal(true);
                }}
              >
                <View style={styles.advanceHeader}>
                  <View>
                    <Text style={[styles.employeeName, { color: colors.text }]}>{advance.employee_name}</Text>
                    <Text style={[styles.employeeId, { color: colors.textSecondary }]}>{advance.employee_id}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          advance.status === 'REPAID'
                            ? '#E8F5E9'
                            : advance.status === 'PARTIALLY_PAID'
                            ? '#FFF3E0'
                            : '#FFEBEE',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color:
                            advance.status === 'REPAID'
                              ? '#2E7D32'
                              : advance.status === 'PARTIALLY_PAID'
                              ? '#F57C00'
                              : '#C62828',
                        },
                      ]}
                    >
                      {advance.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.advanceDetails}>
                  <DetailRow label="Amount" value={`₹${advance.amount.toLocaleString()}`} />
                  <DetailRow
                    label="Remaining"
                    value={`₹${advance.remaining_balance.toLocaleString()}`}
                  />
                  <DetailRow label="For Month" value={advance.for_month} />
                  <DetailRow label="Payment Method" value={advance.payment_method} />
                  <DetailRow
                    label="Date"
                    value={new Date(advance.advance_date).toLocaleDateString()}
                  />
                </View>

                {advance.remarks && (
                  <View style={[styles.remarksContainer, { backgroundColor: colors.background }]}>
                    <Text style={[styles.remarksLabel, { color: colors.textSecondary }]}>Remarks:</Text>
                    <Text style={[styles.remarksText, { color: colors.text }]}>{advance.remarks}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: colors.textLight }]}>No advance payments found</Text>
          </View>
        )}
        </ScrollView>

        {/* Add Advance Modal */}
        <Modal visible={showAddModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Add New Advance</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: '80%' }}>
                <View style={{ padding: 16 }}>
                  {/* Employee ID Input */}
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Employee ID *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    placeholder="Enter employee ID"
                    placeholderTextColor={colors.textSecondary}
                    value={advanceForm.employee_id}
                    onChangeText={(text) => setAdvanceForm({ ...advanceForm, employee_id: text })}
                  />

                  {/* Amount Input */}
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Amount *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    placeholder="Enter amount"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={advanceForm.amount}
                    onChangeText={(text) => setAdvanceForm({ ...advanceForm, amount: text })}
                  />

                  {/* For Month Input */}
                  <Text style={[styles.inputLabel, { color: colors.text }]}>For Month *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    placeholder="e.g., Jan 2025"
                    placeholderTextColor={colors.textSecondary}
                    value={advanceForm.for_month}
                    onChangeText={(text) => setAdvanceForm({ ...advanceForm, for_month: text })}
                  />

                  {/* Payment Method Picker */}
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Payment Method *</Text>
                  <View style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={{ color: colors.text }}>{advanceForm.payment_method}</Text>
                  </View>

                  {/* Remarks Input */}
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Remarks</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, height: 80 }]}
                    placeholder="Optional remarks"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={3}
                    value={advanceForm.remarks}
                    onChangeText={(text) => setAdvanceForm({ ...advanceForm, remarks: text })}
                  />

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={[styles.submitButton, { backgroundColor: colors.primary, marginTop: 20 }]}
                    onPress={handleAddAdvance}
                  >
                    <Text style={styles.submitButtonText}>Add Advance</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Edit Advance Modal */}
        <Modal visible={showEditModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Manage Advance</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>
              {selectedAdvance && (
                <ScrollView style={{ maxHeight: '80%' }}>
                  <View style={{ padding: 16 }}>
                    <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 12 }]}>
                      {selectedAdvance.employee_name}
                    </Text>
                    <DetailRow label="Employee ID" value={selectedAdvance.employee_id} colors={colors} />
                    <DetailRow label="Amount" value={`₹${selectedAdvance.amount.toLocaleString()}`} colors={colors} />
                    <DetailRow label="Remaining" value={`₹${selectedAdvance.remaining_balance.toLocaleString()}`} colors={colors} />
                    <DetailRow label="Status" value={selectedAdvance.status} colors={colors} />
                    <DetailRow label="For Month" value={selectedAdvance.for_month} colors={colors} />
                    <DetailRow label="Payment Method" value={selectedAdvance.payment_method} colors={colors} />
                    <DetailRow label="Date" value={new Date(selectedAdvance.advance_date).toLocaleDateString()} colors={colors} />
                    
                    <View style={{ marginTop: 20, marginBottom: 20 }}>
                      <TouchableOpacity
                        style={[styles.modalActionButton, { backgroundColor: colors.primary, marginBottom: 12 }]}
                        onPress={() => {
                          setShowEditModal(false);
                          setAdvanceForm({
                            employee_id: selectedAdvance.employee_id,
                            amount: selectedAdvance.amount.toString(),
                            for_month: selectedAdvance.for_month,
                            payment_method: selectedAdvance.payment_method,
                            remarks: selectedAdvance.remarks || ''
                          });
                          setShowAddModal(true);
                        }}
                      >
                        <Text style={styles.modalActionButtonText}>Edit Details</Text>
                      </TouchableOpacity>
                      
                      {selectedAdvance.remaining_balance > 0 && (
                        <TouchableOpacity
                          style={[styles.modalActionButton, { backgroundColor: colors.success, marginBottom: 12 }]}
                          onPress={() => {
                            Alert.alert('Record Payment', 'Payment recording will be implemented');
                          }}
                        >
                          <Text style={styles.modalActionButtonText}>Record Payment</Text>
                        </TouchableOpacity>
                      )}
                      
                      <TouchableOpacity
                        style={[styles.modalActionButton, { backgroundColor: colors.error }]}
                        onPress={() => {
                          Alert.alert(
                            'Delete Advance',
                            'Are you sure you want to delete this advance?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: () => handleDeleteAdvance(selectedAdvance.id) }
                            ]
                          );
                        }}
                      >
                        <Text style={styles.modalActionButtonText}>Delete Advance</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    );
};

// Detail Row Component  
const DetailRow = ({ label, value, colors }: { label: string; value: string; colors?: any }) => {
  const colorScheme = useColorScheme();
  const defaultColors = Colors[colorScheme ?? 'light'];
  const activeColors = colors || defaultColors;
  
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: activeColors.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: activeColors.text }]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  card: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  selectButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  selectButtonText: {
    fontSize: 14,
  },
  calculateButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  calculateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 8,
    margin: 6,
  },
  kpiLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
  },
  employeeCard: {
    borderBottomWidth: 1,
    paddingVertical: 12,
    marginBottom: 12,
  },
  employeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
  },
  employeeId: {
    fontSize: 12,
  },
  employeeDept: {
    fontSize: 12,
    marginBottom: 12,
  },
  detailsGrid: {
    marginVertical: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  netSalaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  netSalaryLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  netSalaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  advanceSummaryGrid: {
    flexDirection: 'row',
    marginBottom: 16,
    marginHorizontal: -6,
  },
  advanceCard: {
    borderBottomWidth: 1,
    paddingVertical: 12,
    marginBottom: 12,
  },
  advanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  advanceDetails: {
    marginVertical: 4,
  },
  remarksContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  remarksLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  remarksText: {
    fontSize: 12,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalClose: {
    fontSize: 24,
  },
  periodItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  periodText: {
    fontSize: 16,
    fontWeight: '500',
  },
  periodSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
  // Table styles
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 14,
  },
  tableCellSmall: {
    fontSize: 12,
    marginTop: 2,
  },
  statusButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  stickyTableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderTopWidth: 1,
  },
  // Formula styles
  formulaStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  formulaStepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 14,
    fontWeight: '700',
    marginRight: 12,
  },
  formulaTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  formulaText: {
    fontSize: 13,
    lineHeight: 20,
  },
  formulaInfo: {
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    marginTop: 4,
  },
  formulaInfoText: {
    fontSize: 12,
    lineHeight: 18,
  },
  // Year filter styles
  yearChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  yearChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Add Button (beside search)
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Form input styles
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  submitButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalActionButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalActionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default PayrollScreen;
