// Payroll Overview Screen - Redesigned with Modern UI
import React, { useState, useEffect, useRef } from 'react';
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
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { payrollService } from '@/services/payrollService';
import { PayrollPeriod, CalculatedSalary } from '@/types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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

// Helper to get month index (0-11) from various month representations
const getMonthIndex = (name?: string): number => {
  if (!name) return 0;
  const m = name.toUpperCase();
  const map: Record<string, number> = {
    'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
    'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11,
    'JANUARY': 0, 'FEBRUARY': 1, 'MARCH': 2, 'APRIL': 3, 'JUNE': 5,
    'JULY': 6, 'AUGUST': 7, 'SEPTEMBER': 8, 'OCTOBER': 9, 'NOVEMBER': 10, 'DECEMBER': 11,
  };
  if (map[m] !== undefined) return map[m];
  const idx = new Date(Date.parse(`${name} 1, 2000`)).getMonth();
  return isNaN(idx) ? 0 : idx;
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
    totalBaseSalary: 0,
    totalGrossSalary: 0,
    totalOTCharges: 0,
    totalLateDeduction: 0,
    totalTDS: 0,
    paidEmployees: 0,
    pendingEmployees: 0,
  });
  
  // Dropdown states
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  
  // View states
  const [viewMode, setViewMode] = useState<'overview' | 'detailed'>('overview');
  const [showCalculationFormula, setShowCalculationFormula] = useState(false);
  
  // Screen dimensions for responsive design
  const screenWidth = Dimensions.get('window').width;
  
  // Animation values (persist across renders)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
 
  // Control how much detail to show in Overview cards
  const showOverviewCardDetails = false;
  const showOverviewEmployeeCards = true;
  const showOverviewMetrics = true;
  const showDetailedMetrics = false;
  
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

  // Total days in the selected month (for display)
  const totalDaysInSelectedPeriod = React.useMemo(() => {
    if (!selectedPeriod) return 0;
    const monthName = selectedPeriod.month || (selectedPeriod as any).month_display || '';
    const mi = getMonthIndex(monthName);
    const y = selectedPeriod.year || new Date().getFullYear();
    return new Date(y, mi + 1, 0).getDate();
  }, [selectedPeriod]);

  // Get period for selected year/month
  const getPeriodForSelection = (year: number, month: string) => {
    return periods.find(
      p => p.year === year && 
      (p.month?.toUpperCase() === month.toUpperCase() || 
       (p as any).month_display?.toUpperCase() === month.toUpperCase())
    );
  };

  // Check if period needs calculation (support both overview and periods-list shapes)
  const totalEmployees = (selectedPeriod?.total_employees ?? (selectedPeriod as any)?.calculated_count ?? 0);
  const paidEmployeesSel = (selectedPeriod?.paid_employees ?? (selectedPeriod as any)?.paid_count ?? 0);
  const pendingCount = (selectedPeriod?.pending_employees ?? (selectedPeriod as any)?.pending_count ?? Math.max(0, totalEmployees - paidEmployeesSel));
  const needsCalculation = !!selectedPeriod && (
    selectedPeriod.status === 'PENDING' || 
    (totalEmployees === 0 && selectedPeriod.data_source !== 'UPLOADED')
  );

  // Check if all salaries are paid
  const allPaid = !!selectedPeriod && paidEmployeesSel === totalEmployees && totalEmployees > 0;
  const hasUnpaidSalaries = !!selectedPeriod && pendingCount > 0;

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
    // Start entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
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
      const all: CalculatedSalary[] = [];
      let page = 1;
      while (page <= 50) {
        const response = await payrollService.getCalculatedSalaries(selectedPeriod.id, page);
        const list = response.results || [];
        all.push(...list);
        const hasNext = (response as any)?.next;
        if (!hasNext || list.length === 0) break;
        page += 1;
      }
      setSalaries(all);
      
      // Calculate comprehensive stats like frontend
      const total = all.length;
      const totalBaseSalary = all.reduce((sum, s) => {
        const baseSalary = typeof s.basic_salary === 'string' 
          ? parseFloat(s.basic_salary) 
          : (s.basic_salary || 0);
        return sum + baseSalary;
      }, 0);
      
      const totalGrossSalary = all.reduce((sum, s) => {
        const grossSalary = typeof s.gross_salary === 'string' 
          ? parseFloat(s.gross_salary) 
          : (s.gross_salary || 0);
        return sum + grossSalary;
      }, 0);
      
      const totalOTCharges = all.reduce((sum, s) => {
        const otCharges = typeof s.ot_charges === 'string' 
          ? parseFloat(s.ot_charges) 
          : (s.ot_charges || 0);
        return sum + otCharges;
      }, 0);
      
      const totalLateDeduction = all.reduce((sum, s) => {
        const lateDeduction = typeof s.late_deduction === 'string' 
          ? parseFloat(s.late_deduction) 
          : (s.late_deduction || 0);
        return sum + lateDeduction;
      }, 0);
      
      const totalTDS = all.reduce((sum, s) => {
        const tdsAmount = typeof s.tds_amount === 'string' 
          ? parseFloat(s.tds_amount) 
          : (s.tds_amount || 0);
        return sum + tdsAmount;
      }, 0);
      
      const totalNetSalary = all.reduce((sum, s) => {
        const netPayable = typeof s.net_payable === 'string' 
          ? parseFloat(s.net_payable) 
          : (s.net_payable || 0);
        return sum + netPayable;
      }, 0);
      
      const paidEmployees = all.filter(s => s.is_paid).length;
      const pendingEmployees = total - paidEmployees;
      
      const averageSalary = total > 0 ? totalNetSalary / total : 0;
      
      setStats({ 
        total, 
        totalSalary: totalNetSalary,
        averageSalary,
        totalBaseSalary,
        totalGrossSalary,
        totalOTCharges,
        totalLateDeduction,
        totalTDS,
        paidEmployees,
        pendingEmployees,
      });
    } catch (error: any) {
      console.error('Failed to load salaries:', error);
      Alert.alert('Error', error.message || 'Failed to load salaries');
      setSalaries([]);
      setStats({ 
        total: 0, 
        totalSalary: 0, 
        averageSalary: 0,
        totalBaseSalary: 0,
        totalGrossSalary: 0,
        totalOTCharges: 0,
        totalLateDeduction: 0,
        totalTDS: 0,
        paidEmployees: 0,
        pendingEmployees: 0,
      });
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
      {/* Modern Card-Based Header Inspired by Web Dashboard */}
      <View style={[styles.headerCard, { backgroundColor: colors.surface }]}>
        {/* Header Title Section */}
        
          
          
      
        
        {/* Advance Button */}
        <TouchableOpacity
          style={[styles.advanceButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/payroll/advance')}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={18} color="white" />
          <Text style={styles.advanceButtonText}>Advance</Text>
        </TouchableOpacity>
      </View>

      {/* Period Selector Card */}
      <View style={[styles.periodCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.periodHeader}>
          <View style={styles.periodInfo}>
            {selectedPeriod && (
              <>
                <Text style={[styles.periodText, { color: colors.text }]}>
                  {selectedPeriod.month_display || formatMonthName(selectedPeriod.month || '')} {selectedPeriod.year}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColorForText(selectedPeriod.status || selectedPeriod.data_source, colors)}20` }]}>
                  <Text style={[styles.statusText, { color: getStatusColorForText(selectedPeriod.status || selectedPeriod.data_source, colors) }]}>
                    {selectedPeriod.data_source === 'UPLOADED' ? 'Uploaded' : 
                     selectedPeriod.status === 'CALCULATED' ? 'Calculated' :
                     selectedPeriod.status === 'COMPLETED' ? 'Completed' :
                     selectedPeriod.status === 'LOCKED' ? 'Locked' : 'Pending'}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
        
        <View style={styles.periodActions}>
          <TouchableOpacity
            style={[styles.periodButton, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => setShowYearDropdown(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.periodButtonText, { color: colors.text }]}>
              {selectedYear || 'Year'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.periodButton, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => setShowMonthDropdown(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.periodButtonText, { color: colors.text }]}>
              {selectedMonth ? formatMonthName(selectedMonth) : 'Month'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* View toggle + actions */}
      {selectedPeriod && (
        <View style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Compact view toggle tabs */}
          <View style={styles.viewToggleRow}>
            <TouchableOpacity
              style={[
                styles.viewToggleTab,
                viewMode === 'overview' && { backgroundColor: colors.primary },
              ]}
              onPress={() => setViewMode('overview')}
            >
              <Text
                style={[
                  styles.viewToggleText,
                  { color: viewMode === 'overview' ? 'white' : colors.text },
                ]}
              >
                Overview
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.viewToggleTab,
                viewMode === 'detailed' && { backgroundColor: colors.primary },
              ]}
              onPress={() => setViewMode('detailed')}
            >
              <Text
                style={[
                  styles.viewToggleText,
                  { color: viewMode === 'detailed' ? 'white' : colors.text },
                ]}
              >
                Detailed
              </Text>
            </TouchableOpacity>
          </View>

          {/* Primary actions */}
          <View style={styles.actionRow}>
            {needsCalculation && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                onPress={handleCalculatePayroll}
                disabled={calculating}
                activeOpacity={0.8}
              >
                {calculating ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="calculator" size={16} color="white" />
                    <Text style={styles.actionBtnText}>Calculate</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {hasUnpaidSalaries && !needsCalculation && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.success }]}
                onPress={handleMarkAllPaid}
                disabled={markingPaid}
                activeOpacity={0.8}
              >
                {markingPaid ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color="white" />
                    <Text style={styles.actionBtnText}>Mark All Paid</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.warning }]}
              onPress={() => setShowCalculationFormula(!showCalculationFormula)}
              activeOpacity={0.8}
            >
              <Ionicons name="information-circle" size={16} color="white" />
              <Text style={styles.actionBtnText}>Formula</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
            <LinearGradient
              colors={[`${colors.primary}10`, 'transparent' ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.yearModalHandle}
            >
              <View style={styles.yearModalHandleInner} />
            </LinearGradient>
            <View style={[styles.yearDropdownHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.yearDropdownTitle, { color: colors.text }]}>Select Year</Text>
              <TouchableOpacity
                onPress={() => setShowYearDropdown(false)}
                style={[styles.closeButton, { backgroundColor: `${colors.text}10` }]}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
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
                        backgroundColor: isSelected ? `${colors.primary}15` : (isCurrentYear ? `${colors.primary}08` : 'transparent'),
                        borderLeftWidth: isSelected ? 4 : 0,
                        borderLeftColor: isSelected ? colors.primary : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      setSelectedYear(item);
                      setShowYearDropdown(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.yearItemContent}>
                      <Text
                        style={[
                          styles.yearItemText,
                          {
                            color: isSelected ? colors.primary : (isCurrentYear ? colors.primary : colors.text),
                            fontWeight: isSelected || isCurrentYear ? '800' : '600',
                            fontSize: isSelected || isCurrentYear ? 18 : 17,
                          },
                        ]}
                      >
                        {item}
                      </Text>
                      {isCurrentYear && !isSelected && (
                        <LinearGradient
                          colors={[`${colors.primary}20`, `${colors.primary}10` ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.currentYearBadge]}
                        >
                          <Text style={[styles.currentYearText, { color: colors.primary }]}>Current</Text>
                        </LinearGradient>
                      )}
                      {isSelected && (
                        <LinearGradient
                          colors={[colors.primary, `${colors.primary}DD` ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.selectedYearBadge]}
                        >
                          <Ionicons name="checkmark" size={16} color="white" />
                        </LinearGradient>
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
            <LinearGradient
              colors={[`${colors.primary}10`, 'transparent' ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.yearModalHandle}
            >
              <View style={styles.yearModalHandleInner} />
            </LinearGradient>
            <View style={[styles.yearDropdownHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.yearDropdownTitle, { color: colors.text }]}>Select Month</Text>
              <TouchableOpacity
                onPress={() => setShowMonthDropdown(false)}
                style={[styles.closeButton, { backgroundColor: `${colors.text}10` }]}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
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

      {/* Stats Cards Grid - Web Dashboard Inspired */}
      <View style={[styles.statsGridContainer, { backgroundColor: colors.background }]}>
        <Animated.View 
          style={[
            styles.statCardWeb, 
            { 
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <View style={[styles.statIconContainer, { backgroundColor: `${colors.primary}10` }]}>
            <Ionicons name="people" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Employees</Text>
        </Animated.View>

        <Animated.View 
          style={[
            styles.statCardWeb, 
            { 
              backgroundColor: colors.surface,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <View style={[styles.statIconContainer, { backgroundColor: `${colors.success}10` }]}>
            <Ionicons name="time" size={20} color={colors.success} />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>
            ₹{Math.round(stats.totalOTCharges).toLocaleString('en-IN')}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>OT Charges</Text>
        </Animated.View>

        <Animated.View 
          style={[
            styles.statCardWeb, 
            { 
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <View style={[styles.statIconContainer, { backgroundColor: `${colors.error}10` }]}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>
            ₹{Math.round(stats.totalLateDeduction).toLocaleString('en-IN')}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Late Deduction</Text>
        </Animated.View>

        <Animated.View 
          style={[
            styles.statCardWeb, 
            { 
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <View style={[styles.statIconContainer, { backgroundColor: `${colors.warning}10` }]}>
            <Ionicons name="receipt" size={20} color={colors.warning} />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>
            ₹{Math.round(stats.totalTDS).toLocaleString('en-IN')}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>TDS Amount</Text>
        </Animated.View>

        <Animated.View 
          style={[
            styles.statCardWeb, 
            styles.statCardNetPayable,
            { 
              backgroundColor: `${colors.primary}10`,
              borderWidth: 2,
              borderColor: colors.primary,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.4,
              shadowRadius: 20,
              elevation: 16,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <LinearGradient
            colors={[colors.primary, `${colors.primary}DD` ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.statIconContainerModern]}
          >
            <Ionicons name="checkmark-circle" size={18} color="white" />
          </LinearGradient>
          <Text style={[styles.statValueModern, { color: colors.primary, fontSize: 18 }]}>
            ₹{Math.round(stats.totalSalary).toLocaleString('en-IN')}
          </Text>
          <Text style={[styles.statLabelModern, { color: colors.primary }]}>Net Payable</Text>
        </Animated.View>
      </View>

      {/* Calculation Formula Section */}
      {showCalculationFormula && (
        <View style={[styles.formulaSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.formulaHeader}>
            <Text style={[styles.formulaTitle, { color: colors.text }]}>Calculation Formula</Text>
            <TouchableOpacity
              style={[styles.closeFormulaBtn, { backgroundColor: `${colors.text}10` }]}
              onPress={() => setShowCalculationFormula(false)}
            >
              <FontAwesome name="times" size={12} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.formulaContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.formulaText, { color: colors.textSecondary }]}>
              • <Text style={[styles.formulaLabel, { color: colors.text }]}>Paid Days</Text> = Present Days + Paid Holidays{'\n'}
              • <Text style={[styles.formulaLabel, { color: colors.text }]}>Daily Rate</Text> = Base Salary ÷ 30.4{'\n'}
              • <Text style={[styles.formulaLabel, { color: colors.text }]}>Base Pay</Text> = Daily Rate × Paid Days{'\n'}
              • <Text style={[styles.formulaLabel, { color: colors.text }]}>Gross Salary</Text> = Base Pay + OT Charges - Late Deduction{'\n'}
              • <Text style={[styles.formulaLabel, { color: colors.text }]}>Net Salary</Text> = Gross Salary - TDS Amount - Advance Deduction{'\n'}
              • <Text style={[styles.formulaLabel, { color: colors.text }]}>OT Charges</Text> = OT Hours × OT Rate per Hour{'\n'}
              • <Text style={[styles.formulaLabel, { color: colors.text }]}>Late Deduction</Text> = Late Minutes × (OT Rate ÷ 60)
            </Text>
          </ScrollView>
        </View>
      )}

      {/* Salaries List */}
      {viewMode === 'overview' ? (
        showOverviewEmployeeCards ? (
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
            <Animated.View 
              style={[
                styles.loadingContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }]
                }
              ]}
            >
              <LinearGradient
                colors={[colors.primary, `${colors.primary}DD` ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.loadingIconContainer]}
              >
                <ActivityIndicator size="large" color="white" />
              </LinearGradient>
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading salaries...
              </Text>
            </Animated.View>
      ) : salaries.length === 0 && !loadingSalaries ? (
            <Animated.View 
              style={[
                styles.emptyContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }]
                }
              ]}
            >
              <LinearGradient
                colors={[`${colors.textLight}20`, `${colors.textLight}10` ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.emptyIconContainer]}
              >
                <Ionicons name="document-text" size={48} color={colors.textLight} />
              </LinearGradient>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No payroll data for this period
              </Text>
            </Animated.View>
          ) : (
            showOverviewEmployeeCards ? (
            salaries.map((salary) => (
              <View
                key={salary.id}
                style={[
                  styles.salaryCardModern, 
                  { 
                    backgroundColor: colors.surface, 
                    borderColor: colors.border,
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.12,
                    shadowRadius: 8,
                    elevation: 4,
                  }
                ]}
              >
                <TouchableOpacity
                  style={styles.salaryCardTouchable}
                  onPress={() => router.push(`/payroll/${salary.id}`)}
                  activeOpacity={0.7}
                >
                    {/* Employee Header */}
                    <View style={styles.salaryHeaderModern}>
                      <View style={styles.employeeInfoModern}>
                        <View style={styles.employeeNameRowModern}>
                          <Text style={[styles.employeeNameModern, { color: colors.text }]}>
                            {salary.employee_name || 'Unknown'}
                          </Text>
                          {salary.is_paid && (
                            <LinearGradient
                              colors={[colors.success, `${colors.success}DD` ]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={[styles.paidBadgeModern]}
                            >
                              <Ionicons name="checkmark-circle" size={12} color="white" />
                              <Text style={styles.paidTextModern}>Paid</Text>
                            </LinearGradient>
                          )}
                        </View>
                        <Text style={[styles.employeeIdModern, { color: colors.textSecondary }]}>
                          {salary.employee_id || 'N/A'}
                        </Text>
                        {salary.department && (
                          <LinearGradient
                            colors={[`${colors.primary}20`, `${colors.primary}10` ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.departmentBadgeModern]}
                          >
                            <Text style={[styles.departmentModern, { color: colors.primary }]}>
                              {salary.department}
                            </Text>
                          </LinearGradient>
                        )}
                      </View>
                      <LinearGradient
                        colors={[`${colors.primary}10`, 'transparent' ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.netPayableContainerModern]}
                      >
                        <Text style={[styles.netPayableModern, { color: colors.primary }]}>
                          ₹{parseFloat(salary.net_payable?.toString() || '0').toLocaleString('en-IN')}
                        </Text>
                        <Text style={[styles.netPayableLabelModern, { color: colors.textSecondary }]}>Net Payable</Text>
                      </LinearGradient>
                    </View>

                    {showOverviewCardDetails && (
                      <View style={styles.salaryDetailsGrid}>
                        <View style={styles.detailColumn}>
                          <View style={styles.detailItemModern}>
                            <Text style={[styles.detailLabelModern, { color: colors.textSecondary }]}>Base Salary</Text>
                            <Text style={[styles.detailValueModern, { color: colors.text }]}>
                              ₹{parseFloat(salary.basic_salary?.toString() || '0').toLocaleString('en-IN')}
                            </Text>
                          </View>
                          <View style={styles.detailItemModern}>
                            <Text style={[styles.detailLabelModern, { color: colors.textSecondary }]}>Gross Salary</Text>
                            <Text style={[styles.detailValueModern, { color: colors.text }]}>
                              ₹{parseFloat(salary.gross_salary?.toString() || '0').toLocaleString('en-IN')}
                            </Text>
                          </View>
                        </View>
                        
                        <View style={styles.detailColumn}>
                          <View style={styles.detailItemModern}>
                            <Text style={[styles.detailLabelModern, { color: colors.textSecondary }]}>TDS Amount</Text>
                            <Text style={[styles.detailValueModern, { color: colors.error }]}>
                              ₹{parseFloat(salary.tds_amount?.toString() || '0').toLocaleString('en-IN')}
                            </Text>
                          </View>
                          <View style={styles.detailItemModern}>
                            <Text style={[styles.detailLabelModern, { color: colors.textSecondary }]}>Advance</Text>
                            <Text style={[styles.detailValueModern, { color: colors.warning }]}>
                              ₹{parseFloat(salary.advance_deduction_amount?.toString() || '0').toLocaleString('en-IN')}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {showOverviewMetrics && (
                      <LinearGradient
                        colors={['transparent', `${colors.primary}05` ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={[styles.attendanceSummary, { borderTopColor: colors.border }]}
                      >
                        <View style={styles.attendanceItem}>
                          <LinearGradient
                            colors={[`${colors.success}20`, `${colors.success}10` ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.attendanceIconContainer]}
                          >
                            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                          </LinearGradient>
                          <Text style={[styles.attendanceLabel, { color: colors.textSecondary }]}>Present</Text>
                          <Text style={[styles.attendanceValue, { color: colors.text }]}>{salary.present_days || 0}</Text>
                        </View>
                        <View style={styles.attendanceItem}>
                          <LinearGradient
                            colors={[`${colors.error}20`, `${colors.error}10` ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.attendanceIconContainer]}
                          >
                            <Ionicons name="close-circle" size={16} color={colors.error} />
                          </LinearGradient>
                          <Text style={[styles.attendanceLabel, { color: colors.textSecondary }]}>Absent</Text>
                          <Text style={[styles.attendanceValue, { color: colors.text }]}>{salary.absent_days || 0}</Text>
                        </View>
                        <View style={styles.attendanceItem}>
                          <LinearGradient
                            colors={[`${colors.info}20`, `${colors.info}10` ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.attendanceIconContainer]}
                          >
                            <Ionicons name="time" size={16} color={colors.info} />
                          </LinearGradient>
                          <Text style={[styles.attendanceLabel, { color: colors.textSecondary }]}>OT Hours</Text>
                          <Text style={[styles.attendanceValue, { color: colors.text }]}>{salary.ot_hours || 0}</Text>
                        </View>
                        <View style={styles.attendanceItem}>
                          <LinearGradient
                            colors={[`${colors.warning}20`, `${colors.warning}10` ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.attendanceIconContainer]}
                          >
                            <Ionicons name="warning" size={16} color={colors.warning} />
                          </LinearGradient>
                          <Text style={[styles.attendanceLabel, { color: colors.textSecondary }]}>Late (Min)</Text>
                          <Text style={[styles.attendanceValue, { color: colors.text }]}>{salary.late_minutes || 0}</Text>
                        </View>
                        <View style={styles.attendanceItem}>
                          <LinearGradient
                            colors={[`${colors.info}20`, `${colors.info}10` ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.attendanceIconContainer]}
                          >
                            <Ionicons name="calendar" size={16} color={colors.info} />
                          </LinearGradient>
                          <Text style={[styles.attendanceLabel, { color: colors.textSecondary }]}>Working</Text>
                          <Text style={[styles.attendanceValue, { color: colors.text }]}>{salary.total_working_days || 0}</Text>
                        </View>
                        <View style={styles.attendanceItem}>
                          <LinearGradient
                            colors={[`${colors.success}20`, `${colors.success}10` ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.attendanceIconContainer]}
                          >
                            <Ionicons name="sunny" size={16} color={colors.success} />
                          </LinearGradient>
                          <Text style={[styles.attendanceLabel, { color: colors.textSecondary }]}>Holidays</Text>
                          <Text style={[styles.attendanceValue, { color: colors.text }]}>{salary.holiday_days || 0}</Text>
                        </View>
                        <View style={styles.attendanceItem}>
                          <LinearGradient
                            colors={[`${colors.warning}20`, `${colors.warning}10` ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.attendanceIconContainer]}
                          >
                            <Ionicons name="alert-circle" size={16} color={colors.warning} />
                          </LinearGradient>
                          <Text style={[styles.attendanceLabel, { color: colors.textSecondary }]}>Penalty</Text>
                          <Text style={[styles.attendanceValue, { color: colors.text }]}>{(salary as any).weekly_penalty_days ?? 0}</Text>
                        </View>
                        <View style={styles.attendanceItem}>
                          <LinearGradient
                            colors={[`${colors.primary}20`, `${colors.primary}10` ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.attendanceIconContainer]}
                          >
                            <Ionicons name="calendar" size={16} color={colors.primary} />
                          </LinearGradient>
                          <Text style={[styles.attendanceLabel, { color: colors.textSecondary }]}>Total Days</Text>
                          <Text style={[styles.attendanceValue, { color: colors.text }]}>{totalDaysInSelectedPeriod}</Text>
                        </View>
                      </LinearGradient>
                    )}
                </TouchableOpacity>
              </View>
            ))
            ) : null
          )}
        </ScrollView>
        ) : null
      ) : (
        /* Detailed View */
        <ScrollView 
          style={styles.detailedScrollView}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.detailedViewContainer}>
            <Text style={[styles.detailedViewTitle, { color: colors.text }]}>
              Detailed Payroll Breakdown
            </Text>
            <Text style={[styles.detailedViewSubtitle, { color: colors.textSecondary }]}>
              Comprehensive breakdown for {salaries.length} employees
            </Text>
            
            {/* Export and Action Buttons */}
            <View style={styles.detailedActionRow}>
              <TouchableOpacity
                style={[styles.exportButton, { backgroundColor: colors.success }]}
                onPress={() => {
                  // TODO: Implement Excel export functionality
                  Alert.alert('Export', 'Excel export functionality coming soon!');
                }}
              >
                <FontAwesome name="download" size={14} color="white" />
                <Text style={styles.exportButtonText}>Export Excel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.refreshButton, { backgroundColor: colors.info }]}
                onPress={loadSalaries}
              >
                <FontAwesome name="refresh" size={14} color="white" />
                <Text style={styles.exportButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Detailed Table (horizontally scrollable) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 1100 }}>
            <View style={[styles.detailedTableContainer, { backgroundColor: colors.surface }]}>
              {/* Table Header */}
              <View style={[styles.tableHeader, { backgroundColor: `${colors.primary}10`, borderColor: colors.border }]}>
                <View style={styles.headerCell}>
                  <Text style={[styles.headerCellText, { color: colors.primary }]}>Employee</Text>
                </View>
                <View style={styles.headerCell}>
                  <Text style={[styles.headerCellText, { color: colors.primary }]}>Base</Text>
                </View>
                <View style={styles.headerCell}>
                  <Text style={[styles.headerCellText, { color: colors.primary }]}>Gross</Text>
                </View>
                <View style={styles.headerCell}>
                  <Text style={[styles.headerCellText, { color: colors.primary }]}>TDS</Text>
                </View>
                <View style={styles.headerCell}>
                  <Text style={[styles.headerCellText, { color: colors.primary }]}>Advance</Text>
                </View>
                <View style={styles.headerCell}>
                  <Text style={[styles.headerCellText, { color: colors.primary }]}>Net</Text>
                </View>
                <View style={styles.headerCell}>
                  <Text style={[styles.headerCellText, { color: colors.primary }]}>Status</Text>
                </View>
                {showDetailedMetrics && (
                  <>
                    <View style={styles.headerCell}>
                      <Text style={[styles.headerCellText, { color: colors.primary }]}>Present</Text>
                    </View>
                    <View style={styles.headerCell}>
                      <Text style={[styles.headerCellText, { color: colors.primary }]}>Absent</Text>
                    </View>
                    <View style={styles.headerCell}>
                      <Text style={[styles.headerCellText, { color: colors.primary }]}>OT (hrs)</Text>
                    </View>
                    <View style={styles.headerCell}>
                      <Text style={[styles.headerCellText, { color: colors.primary }]}>Late (min)</Text>
                    </View>
                    <View style={styles.headerCell}>
                      <Text style={[styles.headerCellText, { color: colors.primary }]}>Working</Text>
                    </View>
                    <View style={styles.headerCell}>
                      <Text style={[styles.headerCellText, { color: colors.primary }]}>Holidays</Text>
                    </View>
                    <View style={styles.headerCell}>
                      <Text style={[styles.headerCellText, { color: colors.primary }]}>Penalty</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Table Rows */}
              {salaries.map((salary, index) => (
                <TouchableOpacity
                  key={salary.id}
                  style={[
                    styles.tableRow, 
                    { 
                      backgroundColor: index % 2 === 0 ? `${colors.background}30` : 'transparent',
                      borderColor: colors.border 
                    }
                  ]}
                  onPress={() => router.push(`/payroll/${salary.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowCell}>
                    <View>
                      <Text style={[styles.rowCellPrimaryText, { color: colors.text }]}>
                        {salary.employee_name || 'Unknown'}
                      </Text>
                      <Text style={[styles.rowCellSecondaryText, { color: colors.textSecondary }]}>
                        {salary.employee_id || 'N/A'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.rowCell}>
                    <Text style={[styles.rowCellAmountText, { color: colors.text }]}>
                      ₹{parseFloat(salary.basic_salary?.toString() || '0').toLocaleString('en-IN')}
                    </Text>
                  </View>
                  
                  <View style={styles.rowCell}>
                    <Text style={[styles.rowCellAmountText, { color: colors.text }]}>
                      ₹{parseFloat(salary.gross_salary?.toString() || '0').toLocaleString('en-IN')}
                    </Text>
                  </View>
                  
                  <View style={styles.rowCell}>
                    <Text style={[styles.rowCellAmountText, { color: colors.error }]}>
                      ₹{parseFloat(salary.tds_amount?.toString() || '0').toLocaleString('en-IN')}
                    </Text>
                  </View>
                  
                  <View style={styles.rowCell}>
                    <Text style={[styles.rowCellAmountText, { color: colors.warning }]}>
                      ₹{parseFloat(salary.advance_deduction_amount?.toString() || '0').toLocaleString('en-IN')}
                    </Text>
                  </View>
                  
                  <View style={styles.rowCell}>
                    <Text style={[styles.rowCellAmountText, { color: colors.primary, fontWeight: '700' }]}>
                      ₹{parseFloat(salary.net_payable?.toString() || '0').toLocaleString('en-IN')}
                    </Text>
                  </View>
                  
                  <View style={styles.rowCell}>
                    {salary.is_paid ? (
                      <View style={[styles.statusCellPaid, { backgroundColor: colors.success }]}>
                        <FontAwesome name="check" size={10} color="white" />
                        <Text style={styles.statusCellTextPaid}>Paid</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusCellPending, { backgroundColor: colors.warning }]}>
                        <Ionicons name="time" size={10} color="white" />
                        <Text style={styles.statusCellTextPending}>Pending</Text>
                      </View>
                    )}
                  </View>

                  {showDetailedMetrics && (
                    <>
                      <View style={styles.rowCell}>
                        <Text style={[styles.rowCellAmountText, { color: colors.text }]}>{salary.present_days || 0}</Text>
                      </View>
                      <View style={styles.rowCell}>
                        <Text style={[styles.rowCellAmountText, { color: colors.text }]}>{salary.absent_days || 0}</Text>
                      </View>
                      <View style={styles.rowCell}>
                        <Text style={[styles.rowCellAmountText, { color: colors.text }]}>{salary.ot_hours || 0}</Text>
                      </View>
                      <View style={styles.rowCell}>
                        <Text style={[styles.rowCellAmountText, { color: colors.text }]}>{salary.late_minutes || 0}</Text>
                      </View>
                      <View style={styles.rowCell}>
                        <Text style={[styles.rowCellAmountText, { color: colors.text }]}>{salary.total_working_days || 0}</Text>
                      </View>
                      <View style={styles.rowCell}>
                        <Text style={[styles.rowCellAmountText, { color: colors.text }]}>{salary.holiday_days || 0}</Text>
                      </View>
                      <View style={styles.rowCell}>
                        <Text style={[styles.rowCellAmountText, { color: colors.text }]}>{(salary as any).weekly_penalty_days ?? 0}</Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Summary Footer */}
          <View style={[styles.summaryFooter, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Employees:</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{stats.total}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Paid Employees:</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>{stats.paidEmployees}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Pending Employees:</Text>
              <Text style={[styles.summaryValue, { color: colors.warning }]}>{stats.pendingEmployees}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Net Payable:</Text>
              <Text style={[styles.summaryValue, { color: colors.primary, fontWeight: '800' }]}>
                ₹{Math.round(stats.totalSalary).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Enhanced Modern Header Styles
  modernHeader: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    marginBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerTitle: {
    flex: 1,
  },
  headerTitleText: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  advanceButtonModern: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  advanceButtonText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  
  // Period Selector
  periodSelector: {
    marginBottom: 20,
  },
  periodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  periodText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  periodActions: {
    flexDirection: 'row',
    gap: 12,
  },
  periodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  periodButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  
  // Action Buttons
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
    minWidth: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  actionBtnGradient: {
    backgroundGradient: {
      colors: ['#0B5E59', '#0B5E59DD'],
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
    },
  },
  actionBtnPrimary: {
    backgroundColor: '#0B5E59',
  },
  actionBtnSecondary: {
    backgroundColor: '#0EA5E9',
  },
  actionBtnSuccess: {
    backgroundColor: '#10B981',
  },
  actionBtnInfo: {
    backgroundColor: '#F59E0B',
  },
  actionBtnText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  
  // Enhanced Stats Cards
  statsScrollView: {
    maxHeight: 140,
    marginBottom: 12,
  },
  statsScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 16,
  },
  statCardModern: {
    width: 110,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  statIconContainerModern: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  statValueModern: {
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  statLabelModern: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  
  // Formula Section
  formulaSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    maxHeight: 200,
  },
  formulaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  formulaTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeFormulaBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formulaContent: {
    flex: 1,
  },
  formulaText: {
    fontSize: 12,
    lineHeight: 18,
  },
  formulaLabel: {
    fontWeight: '700',
  },
  
  // Enhanced Salary Cards
  salaryCardModern: {
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 20,
    padding: 20,
    overflow: 'hidden',
  },
  salaryCardTouchable: {
    flex: 1,
  },
  salariesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  salaryHeaderModern: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  employeeInfoModern: {
    flex: 1,
    paddingRight: 16,
  },
  employeeNameRowModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  employeeNameModern: {
    fontSize: 20,
    fontWeight: '900',
    flex: 1,
    letterSpacing: -0.3,
  },
  employeeIdModern: {
    fontSize: 14,
    marginBottom: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  departmentBadgeModern: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  departmentModern: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  netPayableContainerModern: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  netPayableModern: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  netPayableLabelModern: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  paidBadgeModern: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  
  paidTextModern: {
    color: 'white',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  detailColumn: {
    flex: 1,
    gap: 12,
  },
  // Salary Details Grid
  salaryDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  detailItemModern: {
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  detailLabelModern: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  
  detailValueModern: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  // Enhanced Attendance Summary
  attendanceSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderRadius: 16,
  },
  attendanceIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  attendanceItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
  },
  attendanceValue: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  
  attendanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 6,
    marginBottom: 4,
  },
  detailedScrollView: {
    flex: 1,
  },
  detailedViewContainer: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  detailedViewTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  detailedViewSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  detailedActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  exportButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  
  // Detailed Table
  detailedTableContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
  },
  headerCellText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  rowCell: {
    flex: 1,
    alignItems: 'center',
  },
  rowCellPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  rowCellSecondaryText: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
  rowCellAmountText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  statusCellPaid: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 3,
  },
  statusCellPending: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 3,
  },
  statusCellTextPaid: {
    color: 'white',
    fontSize: 9,
    fontWeight: '700',
  },
  statusCellTextPending: {
    color: 'white',
    fontSize: 9,
    fontWeight: '700',
  },
  
  // Summary Footer
  summaryFooter: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  
  // Enhanced Loading and Empty States
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#0B5E59',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#9CA3AF30',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  // Enhanced Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  yearDropdownModal: {
    width: '100%',
    maxHeight: '70%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
  },
  yearModalHandle: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 4,
  },
  yearModalHandleInner: {
    width: 48,
    height: 5,
    backgroundColor: '#D1D5DB',
    borderRadius: 3,
  },
  yearDropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  yearDropdownTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  yearListContent: {
    paddingVertical: 12,
  },
  yearItem: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  yearItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  yearItemText: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  currentYearBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedYearBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0B5E59',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  currentYearText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
  
  // Modal Styles
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
  
  // Web Dashboard Inspired Styles
  headerCard: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitleSection: {
    marginBottom: 16,
  },
  headerTitleText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitleText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  advanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  advanceButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  periodCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  periodHeader: {
    marginBottom: 12,
  },
  periodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  periodActions: {
    flexDirection: 'row',
    gap: 12,
  },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  viewToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  viewToggleTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  viewToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    minWidth: 80,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  actionBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  statsGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 12,
  },
  statCardWeb: {
    width: '48%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardNetPayable: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
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
