// Payroll Overview Screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { payrollService } from '@/services/payrollService';
import { PayrollPeriod, CalculatedSalary } from '@/types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';

// Helper to format month name
const formatMonthName = (month: string): string => {
  const monthMap: Record<string, string> = {
    'JAN': 'Jan', 'FEB': 'Feb', 'MAR': 'Mar', 'APR': 'Apr',
    'MAY': 'May', 'JUN': 'Jun', 'JUL': 'Jul', 'AUG': 'Aug',
    'SEP': 'Sep', 'OCT': 'Oct', 'NOV': 'Nov', 'DEC': 'Dec',
    'JANUARY': 'January', 'FEBRUARY': 'February', 'MARCH': 'March', 'APRIL': 'April',
    'JUNE': 'June', 'JULY': 'July', 'AUGUST': 'August',
    'SEPTEMBER': 'September', 'OCTOBER': 'October', 'NOVEMBER': 'November', 'DECEMBER': 'December',
  };
  return monthMap[month?.toUpperCase()] || month || 'N/A';
};

export default function PayrollScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<any | null>(null);
  const [salaries, setSalaries] = useState<CalculatedSalary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSalaries, setLoadingSalaries] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    totalSalary: 0,
    averageSalary: 0,
  });
  
  // Dropdown states
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  
  // Available years - generate a range from current year going back 10 years and forward 2 years
  const currentYear = new Date().getFullYear();
  const generateYearRange = () => {
    const years: number[] = [];
    // Get years from periods
    const periodYears = Array.from(new Set(periods.map(p => p.year)));
    // Generate range from current year - 10 to current year + 2
    for (let y = currentYear + 2; y >= currentYear - 10; y--) {
      years.push(y);
    }
    // Add any period years that are outside this range
    periodYears.forEach(year => {
      if (!years.includes(year)) {
        years.push(year);
      }
    });
    return years.sort((a, b) => b - a);
  };
  const availableYears = generateYearRange();
  const availableMonths = [
    { value: 'JANUARY', label: 'January' },
    { value: 'FEBRUARY', label: 'February' },
    { value: 'MARCH', label: 'March' },
    { value: 'APRIL', label: 'April' },
    { value: 'MAY', label: 'May' },
    { value: 'JUNE', label: 'June' },
    { value: 'JULY', label: 'July' },
    { value: 'AUGUST', label: 'August' },
    { value: 'SEPTEMBER', label: 'September' },
    { value: 'OCTOBER', label: 'October' },
    { value: 'NOVEMBER', label: 'November' },
    { value: 'DECEMBER', label: 'December' },
  ];

  // Get period for selected year/month
  const getPeriodForSelection = (year: number, month: string) => {
    return periods.find(
      p => p.year === year && 
      (p.month?.toUpperCase() === month.toUpperCase() || 
       (p as any).month_display?.toUpperCase() === month.toUpperCase())
    );
  };

  // Check if period needs calculation
  const needsCalculation = selectedPeriod && (
    selectedPeriod.status === 'PENDING' || 
    (selectedPeriod.total_employees === 0 && selectedPeriod.data_source !== 'UPLOADED')
  );

  // Check if all salaries are paid
  const allPaid = selectedPeriod && selectedPeriod.paid_employees === selectedPeriod.total_employees && selectedPeriod.total_employees > 0;
  const hasUnpaidSalaries = selectedPeriod && selectedPeriod.pending_employees > 0;

  // Calculate payroll
  const handleCalculatePayroll = async () => {
    if (!selectedPeriod) return;
    
    Alert.alert(
      'Calculate Payroll',
      `Calculate payroll for ${formatMonthName(selectedPeriod.month || '')} ${selectedPeriod.year}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Calculate',
          onPress: async () => {
            try {
              setCalculating(true);
              await payrollService.calculatePayroll(selectedPeriod.id, false);
              Alert.alert('Success', 'Payroll calculated successfully');
              await loadPeriods();
              await loadSalaries();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to calculate payroll');
            } finally {
              setCalculating(false);
            }
          },
        },
      ]
    );
  };

  // Mark all salaries as paid
  const handleMarkAllPaid = async () => {
    if (!selectedPeriod || salaries.length === 0) return;
    
    Alert.alert(
      'Mark as Paid',
      `Mark all ${salaries.length} salaries as paid for ${formatMonthName(selectedPeriod.month || '')} ${selectedPeriod.year}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Paid',
          onPress: async () => {
            try {
              setMarkingPaid(true);
              const salaryIds = salaries.map(s => s.id);
              await payrollService.markSalariesPaid(salaryIds);
              Alert.alert('Success', 'All salaries marked as paid');
              await loadPeriods();
              await loadSalaries();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to mark salaries as paid');
            } finally {
              setMarkingPaid(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenDetailView = () => {
    if (!selectedPeriod) return;
    const monthLabel = formatMonthName(selectedPeriod.month || selectedPeriod.month_display || '');
    router.push({
      pathname: '/payroll/detail-table',
      params: { 
        periodId: selectedPeriod.id.toString(),
        label: `${monthLabel} ${selectedPeriod.year}`,
      },
    });
  };

  useEffect(() => {
    loadPeriods();
  }, []);

  useEffect(() => {
    if (selectedPeriod) {
      loadSalaries();
    }
  }, [selectedPeriod]);

  useEffect(() => {
    // When year or month changes, find matching period
    if (selectedYear && selectedMonth) {
      const matchingPeriod = periods.find(
        p => p.year === selectedYear && 
        (p.month?.toUpperCase() === selectedMonth.toUpperCase() || 
         p.month_display?.toUpperCase() === selectedMonth.toUpperCase())
      );
      if (matchingPeriod) {
        setSelectedPeriod(matchingPeriod);
      }
    }
  }, [selectedYear, selectedMonth, periods]);

  const loadPeriods = async () => {
    try {
      setLoading(true);
      // Try to get overview first (has more details), fallback to periods list
      try {
        const overview = await payrollService.getPayrollOverview();
        if (overview?.success && overview?.periods && Array.isArray(overview.periods)) {
          // Use overview periods directly (they have more info like status, totals, etc.)
          setPeriods(overview.periods);
          if (overview.periods.length > 0) {
            const firstPeriod = overview.periods[0] as any;
            setSelectedPeriod(firstPeriod);
            setSelectedYear(firstPeriod.year);
            setSelectedMonth(firstPeriod.month || firstPeriod.month_display);
          }
        } else {
          // Fallback to periods list
          const data = await payrollService.getPayrollPeriods();
          setPeriods(data);
          if (data.length > 0) {
            setSelectedPeriod(data[0]);
            setSelectedYear(data[0].year);
            setSelectedMonth((data[0] as any).month || (data[0] as any).month_display);
          }
        }
      } catch (overviewError) {
        console.warn('Payroll overview failed, using periods list:', overviewError);
        // Fallback to periods list if overview fails
        const data = await payrollService.getPayrollPeriods();
        setPeriods(data);
        if (data.length > 0) {
          const firstPeriod = data[0] as any;
          setSelectedPeriod(firstPeriod);
          setSelectedYear(firstPeriod.year);
          setSelectedMonth(firstPeriod.month || firstPeriod.month_display);
        }
      }
    } catch (error: any) {
      console.error('Failed to load payroll periods:', error);
      Alert.alert('Error', error.message || 'Failed to load payroll periods');
    } finally {
      setLoading(false);
    }
  };

  const loadSalaries = async () => {
    if (!selectedPeriod) return;
    try {
      setLoadingSalaries(true);
      const response = await payrollService.getCalculatedSalaries(selectedPeriod.id, 1);
      const salariesList = response.results || [];
      setSalaries(salariesList);
      
      // Use period stats if available from overview, otherwise calculate from salaries
      if (selectedPeriod.total_employees && selectedPeriod.total_net_salary) {
        const total = selectedPeriod.total_employees;
        const totalSalary = selectedPeriod.total_net_salary;
        const averageSalary = total > 0 ? totalSalary / total : 0;
        setStats({ total, totalSalary, averageSalary });
      } else {
        // Calculate stats from salaries
        const total = salariesList.length;
        const totalSalary = salariesList.reduce((sum, s) => {
          const netPayable = typeof s.net_payable === 'string' 
            ? parseFloat(s.net_payable) 
            : (s.net_payable || 0);
          return sum + netPayable;
        }, 0);
        const averageSalary = total > 0 ? totalSalary / total : 0;
        setStats({ total, totalSalary, averageSalary });
      }
    } catch (error: any) {
      console.error('Failed to load salaries:', error);
      Alert.alert('Error', error.message || 'Failed to load salaries');
      setSalaries([]);
      setStats({ total: 0, totalSalary: 0, averageSalary: 0 });
    } finally {
      setLoadingSalaries(false);
    }
  };

  if (loading && periods.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Year and Month Selectors */}
      <View style={[styles.selectorContainer, { backgroundColor: colors.background }]}>
        <View style={styles.selectorHeader}>
          <View style={styles.selectorHeaderLeft}>
            {selectedPeriod && (
              <Text style={[styles.periodInfo, { color: colors.textSecondary }]}>
                {selectedPeriod.month_display || formatMonthName(selectedPeriod.month || '')} {selectedPeriod.year}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.advanceButton, { backgroundColor: `${colors.primary}15` }]}
            onPress={() => router.push('/payroll/advance')}
          >
            <FontAwesome name="money" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.dropdownRow}>
          <View style={styles.dropdownWrapper}>
            <Text style={[styles.dropdownLabel, { color: colors.textSecondary }]}>Year</Text>
            <TouchableOpacity
              style={[styles.dropdownButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowYearDropdown(true)}
              activeOpacity={0.7}
            >
              <View style={styles.dropdownButtonInner}>
                <Text style={[styles.dropdownText, { color: colors.text }]}>
                  {selectedYear || 'Select Year'}
                </Text>
                <FontAwesome name="chevron-down" size={14} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.dropdownWrapper}>
            <Text style={[styles.dropdownLabel, { color: colors.textSecondary }]}>Month</Text>
            <TouchableOpacity
              style={[styles.dropdownButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowMonthDropdown(true)}
              activeOpacity={0.7}
            >
              <View style={styles.dropdownButtonInner}>
                <View style={styles.dropdownTextContainer}>
                  <Text style={[styles.dropdownText, { color: colors.text }]}>
                    {selectedMonth ? formatMonthName(selectedMonth) : 'Select Month'}
                  </Text>
                  {selectedPeriod && (
                    <View style={[styles.statusBadgeInline, { backgroundColor: `${getStatusColorForText(selectedPeriod.status || selectedPeriod.data_source, colors)}20` }]}>
                      <Text style={[styles.dropdownStatus, { color: getStatusColorForText(selectedPeriod.status || selectedPeriod.data_source, colors) }]}>
                        {selectedPeriod.data_source === 'UPLOADED' ? 'Uploaded' : 
                         selectedPeriod.status === 'CALCULATED' ? 'Calculated' :
                         selectedPeriod.status === 'COMPLETED' ? 'Completed' :
                         selectedPeriod.status === 'LOCKED' ? 'Locked' : 'Pending'}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.chevronContainer}>
                  <FontAwesome name="chevron-down" size={14} color={colors.textSecondary} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons */}
        {selectedPeriod && (
          <View style={styles.actionButtons}>
            {needsCalculation && (
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary, { backgroundColor: colors.primary }]}
                onPress={handleCalculatePayroll}
                disabled={calculating}
              >
                {calculating ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <FontAwesome name="calculator" size={16} color="white" />
                    <Text style={styles.actionButtonText}>Calculate Payroll</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonInfo, { backgroundColor: colors.info }]}
              onPress={handleOpenDetailView}
            >
              <FontAwesome name="table" size={16} color="white" />
              <Text style={styles.actionButtonText}>Month View</Text>
            </TouchableOpacity>
            {hasUnpaidSalaries && !needsCalculation && (
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonSuccess, { backgroundColor: colors.success }]}
                onPress={handleMarkAllPaid}
                disabled={markingPaid}
              >
                {markingPaid ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <FontAwesome name="check-circle" size={16} color="white" />
                    <Text style={styles.actionButtonText}>Mark All Paid</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Year Dropdown Modal */}
      <Modal
        visible={showYearDropdown}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowYearDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowYearDropdown(false)}
          />
          <View 
            style={[styles.yearDropdownModal, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.yearModalHandle} />
            <View style={[styles.yearDropdownHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.yearDropdownTitle, { color: colors.text }]}>Select Year</Text>
              <TouchableOpacity
                onPress={() => setShowYearDropdown(false)}
                style={styles.closeButton}
              >
                <FontAwesome name="times" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={availableYears}
              keyExtractor={(item) => item.toString()}
              contentContainerStyle={styles.yearListContent}
              showsVerticalScrollIndicator={true}
              renderItem={({ item }) => {
                const isSelected = selectedYear === item;
                const isCurrentYear = item === currentYear;
                return (
                  <TouchableOpacity
                    style={[
                      styles.yearItem,
                      {
                        backgroundColor: isSelected ? colors.primary : (isCurrentYear ? `${colors.primary}10` : colors.background),
                        borderLeftWidth: isSelected ? 4 : 0,
                        borderLeftColor: isSelected ? colors.primary : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      setSelectedYear(item);
                      setShowYearDropdown(false);
                    }}
                  >
                    <View style={styles.yearItemContent}>
                      <Text
                        style={[
                          styles.yearItemText,
                          {
                            color: isSelected ? colors.primary : (isCurrentYear ? colors.primary : colors.text),
                            fontWeight: isSelected || isCurrentYear ? '700' : '500',
                          },
                        ]}
                      >
                        {item}
                      </Text>
                      {isCurrentYear && !isSelected && (
                        <View style={[styles.currentYearBadge, { backgroundColor: `${colors.primary}15` }]}>
                          <Text style={[styles.currentYearText, { color: colors.primary }]}>Current</Text>
                        </View>
                      )}
                      {isSelected && (
                        <FontAwesome name="check" size={16} color={colors.primary} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Month Dropdown Modal */}
      <Modal
        visible={showMonthDropdown}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMonthDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowMonthDropdown(false)}
          />
          <View 
            style={[styles.yearDropdownModal, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.yearModalHandle} />
            <View style={[styles.yearDropdownHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.yearDropdownTitle, { color: colors.text }]}>Select Month</Text>
              <TouchableOpacity
                onPress={() => setShowMonthDropdown(false)}
                style={styles.closeButton}
              >
                <FontAwesome name="times" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={availableMonths}
              keyExtractor={(item) => item.value}
              contentContainerStyle={styles.yearListContent}
              showsVerticalScrollIndicator={true}
              renderItem={({ item }) => {
                const isSelected = selectedMonth?.toUpperCase() === item.value.toUpperCase();
                const periodForMonth = selectedYear ? getPeriodForSelection(selectedYear, item.value) : null;
                const statusText = periodForMonth 
                  ? (periodForMonth.data_source === 'UPLOADED' ? 'Uploaded' : 
                     periodForMonth.status === 'CALCULATED' ? 'Calculated' :
                     periodForMonth.status === 'COMPLETED' ? 'Completed' :
                     periodForMonth.status === 'LOCKED' ? 'Locked' : 'Pending')
                  : null;
                const statusColor = periodForMonth 
                  ? getStatusColorForText(periodForMonth?.status || periodForMonth?.data_source || '', colors)
                  : colors.textSecondary;
                
                return (
                  <TouchableOpacity
                    style={[
                      styles.yearItem,
                      {
                        backgroundColor: isSelected ? colors.background : colors.background,
                        borderLeftWidth: isSelected ? 4 : 0,
                        borderLeftColor: isSelected ? colors.primary : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      setSelectedMonth(item.value);
                      setShowMonthDropdown(false);
                    }}
                  >
                    <View style={styles.yearItemContent}>
                      <View style={styles.monthItemLeft}>
                        <Text
                          style={[
                            styles.yearItemText,
                            {
                              color: isSelected ? colors.primary : colors.text,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {item.label}
                        </Text>
                        {statusText && (
                          <View style={[styles.monthStatusBadge, { backgroundColor: `${statusColor}15` }]}>
                            <Text
                              style={[
                                styles.monthStatusText,
                                {
                                  color: isSelected ? colors.primary : statusColor,
                                },
                              ]}
                            >
                              {statusText}
                            </Text>
                          </View>
                        )}
                      </View>
                      {isSelected && (
                        <FontAwesome name="check" size={16} color={colors.primary} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, styles.statCardPrimary, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
          <View style={[styles.statIconContainer, { backgroundColor: `${colors.primary}15` }]}>
            <FontAwesome name="users" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Employees</Text>
        </View>
        <View style={[styles.statCard, styles.statCardSuccess, { backgroundColor: colors.surface, borderColor: colors.success }]}>
          <View style={[styles.statIconContainer, { backgroundColor: `${colors.success}15` }]}>
            <FontAwesome name="dollar" size={18} color={colors.success} />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>
            ₹{Math.round(stats.totalSalary).toLocaleString('en-IN')}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Payroll</Text>
        </View>
        <View style={[styles.statCard, styles.statCardInfo, { backgroundColor: colors.surface, borderColor: colors.info }]}>
          <View style={[styles.statIconContainer, { backgroundColor: `${colors.info}15` }]}>
            <FontAwesome name="calculator" size={18} color={colors.info} />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>
            ₹{Math.round(stats.averageSalary).toLocaleString('en-IN')}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Average</Text>
        </View>
      </View>

      {/* Salaries List */}
      <ScrollView 
        style={styles.salariesList}
        refreshControl={
          <RefreshControl
            refreshing={loadingSalaries}
            onRefresh={loadSalaries}
            tintColor={colors.primary}
          />
        }
      >
        {loadingSalaries && salaries.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading salaries...
            </Text>
          </View>
        ) : (
          salaries.map((salary) => (
          <TouchableOpacity
            key={salary.id}
            style={[styles.salaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push(`/payroll/${salary.id}`)}
          >
            <View style={styles.salaryHeader}>
              <View style={styles.employeeInfo}>
                <View style={styles.employeeNameRow}>
                  <Text style={[styles.employeeName, { color: colors.text }]}>
                    {salary.employee_name || 'Unknown'}
                  </Text>
                  {salary.is_paid && (
                    <View style={[styles.paidBadge, { backgroundColor: colors.success }]}>
                      <FontAwesome name="check-circle" size={10} color="white" />
                      <Text style={styles.paidText}>Paid</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.employeeId, { color: colors.textSecondary }]}>
                  {salary.employee_id || 'N/A'}
                </Text>
                {salary.department && (
                  <View style={styles.departmentBadge}>
                    <Text style={[styles.department, { color: colors.textLight }]}>
                      {salary.department}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.netPayableContainer}>
                <Text style={[styles.netPayable, { color: colors.primary }]}>
                  ₹{parseFloat(salary.net_payable?.toString() || '0').toLocaleString('en-IN')}
                </Text>
                <Text style={[styles.netPayableLabel, { color: colors.textSecondary }]}>Net Payable</Text>
              </View>
            </View>
            <View style={styles.salaryDetails}>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Gross</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  ₹{parseFloat(salary.gross_salary?.toString() || '0').toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>TDS</Text>
                <Text style={[styles.detailValue, { color: colors.error }]}>
                  ₹{parseFloat(salary.tds_amount?.toString() || '0').toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Advance</Text>
                <Text style={[styles.detailValue, { color: colors.warning }]}>
                  ₹{parseFloat(salary.advance_deduction_amount?.toString() || '0').toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
          ))
        )}
        {salaries.length === 0 && !loadingSalaries && (
          <View style={styles.emptyContainer}>
            <FontAwesome name="file-text-o" size={48} color={colors.textLight} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No payroll data for this period
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  selectorContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectorHeaderLeft: {
    flex: 1,
  },
  periodInfo: {
    fontSize: 14,
    fontWeight: '600',
  },
  advanceButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dropdownWrapper: {
    flex: 1,
  },
  dropdownLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    color: '#6B7280',
  },
  dropdownButton: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1.25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
    overflow: 'hidden',
  },
  dropdownButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flex: 1,
    minHeight: 46,
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flex: 1,
  },
  dropdownTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap',
    paddingRight: 8,
    minHeight: 20,
  },
  dropdownText: {
    fontSize: 15,
    fontWeight: '600',
    marginRight: 8,
  },
  statusBadgeInline: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 2,
  },
  dropdownStatus: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    lineHeight: 14,
  },
  chevronContainer: {
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  yearDropdownModal: {
    width: '100%',
    maxHeight: '60%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
    overflow: 'hidden',
  },
  yearModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  yearDropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  yearDropdownTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  yearListContent: {
    paddingVertical: 8,
  },
  yearItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  yearItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  yearItemText: {
    fontSize: 17,
    fontWeight: '500',
  },
  currentYearBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  currentYearText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  monthItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  monthStatusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonPrimary: {
    backgroundColor: '#0B5E59',
  },
  actionButtonInfo: {
    backgroundColor: '#0EA5E9',
  },
  actionButtonSuccess: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardPrimary: {
    borderColor: '#0B5E59',
  },
  statCardSuccess: {
    borderColor: '#10B981',
  },
  statCardInfo: {
    borderColor: '#3B82F6',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  salariesList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  salaryCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  salaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  employeeInfo: {
    flex: 1,
    paddingRight: 12,
  },
  employeeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  employeeId: {
    fontSize: 13,
    marginBottom: 6,
    color: '#6B7280',
  },
  departmentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  department: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  netPayableContainer: {
    alignItems: 'flex-end',
  },
  netPayable: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  netPayableLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  paidText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  salaryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 14,
    borderTopWidth: 1.5,
    borderTopColor: '#E5E7EB',
    marginTop: 4,
  },
  detailItem: {
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    marginBottom: 6,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
});

// Helper functions for status colors
const getStatusColor = (statusColor: string, colors: any): string => {
  const colorMap: Record<string, string> = {
    green: colors.success,
    blue: colors.info,
    red: colors.error,
    orange: colors.warning,
    purple: '#9333EA',
    gray: colors.textLight,
  };
  return colorMap[statusColor] || colors.textLight;
};

const getStatusTextColor = (statusColor: string, colors: any): string => {
  if (statusColor === 'green' || statusColor === 'blue' || statusColor === 'purple') {
    return 'white';
  }
  return colors.text;
};

const getStatusColorForText = (status: string, colors: any): string => {
  const statusUpper = status?.toUpperCase() || '';
  if (statusUpper === 'UPLOADED' || statusUpper === 'COMPLETED') {
    return colors.success;
  }
  if (statusUpper === 'CALCULATED') {
    return colors.info;
  }
  if (statusUpper === 'LOCKED') {
    return colors.error;
  }
  if (statusUpper === 'PENDING') {
    return colors.warning;
  }
  return colors.textSecondary;
};
