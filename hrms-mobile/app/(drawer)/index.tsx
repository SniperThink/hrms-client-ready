// Dashboard/Overview Screen
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppSelector } from '@/store/hooks';
import { api } from '@/services/api';
import { API_ENDPOINTS } from '@/constants/Config';
import { DashboardStats } from '@/types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function DashboardScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, tenant } = useAppSelector((state) => state.auth);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Define quick access shortcuts based on user role (limit to 4 items)
  const getQuickAccessItems = () => {
    const role = user?.role as string;
    const isAdmin = role === 'admin' || user?.is_admin || user?.is_superuser;
    const isHR = role === 'hr_manager' || role === 'hr-manager';
    const isPayroll = role === 'payroll_master';

    // Define all possible items with priority
    let items = [];

    if (isAdmin || isHR) {
      // Admin/HR: Employees, Payroll, Attendance, Reports
      items = [
        {
          icon: 'users',
          label: 'Employees',
          route: '/employees',
          color: colors.primary,
        },
        {
          icon: 'money',
          label: 'Payroll',
          route: '/payroll',
          color: colors.warning,
        },
        {
          icon: 'calendar-check-o',
          label: 'Attendance',
          route: '/attendance/entry',
          color: colors.success,
        },
        {
          icon: 'bar-chart',
          label: 'Reports',
          route: '/reports',
          color: colors.info,
        },
      ];
    } else if (isPayroll) {
      // Payroll Master: Payroll, Employees, Attendance, Reports
      items = [
        {
          icon: 'money',
          label: 'Payroll',
          route: '/payroll',
          color: colors.warning,
        },
        {
          icon: 'users',
          label: 'Employees',
          route: '/employees',
          color: colors.primary,
        },
        {
          icon: 'calendar-check-o',
          label: 'Attendance',
          route: '/attendance/entry',
          color: colors.success,
        },
        {
          icon: 'bar-chart',
          label: 'Reports',
          route: '/reports',
          color: colors.primary,
        },
      ];
    } else {
      // Regular Employee: Attendance, Leaves, Holidays, Profile
      items = [
        {
          icon: 'calendar-check-o',
          label: 'Attendance',
          route: '/attendance/entry',
          color: colors.success,
        },
        {
          icon: 'file-text-o',
          label: 'Leave',
          route: '/leaves',
          color: colors.secondary,
        },
        {
          icon: 'calendar',
          label: 'Holidays',
          route: '/holidays',
          color: colors.info,
        },
        {
          icon: 'user',
          label: 'Profile',
          route: '/settings',
          color: colors.primary,
        },
      ];
    }

    return items.slice(0, 4); // Always return exactly 4 items
  };

  const loadDashboardData = async () => {
    try {
      const data = await api.get<DashboardStats>(API_ENDPOINTS.dashboard);
      console.log('Dashboard data received:', JSON.stringify(data, null, 2));
      console.log('Department distribution:', data?.department_distribution);
      console.log('Department data:', data?.department_data);
      setStats(data);
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      console.error('Error details:', error.response?.data || error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.welcomeText, { color: colors.text }]}>
            Welcome back, {user?.first_name || 'User'}!
          </Text>
          {/* <Text style={[styles.companyText, { color: colors.textSecondary }]}>
            {tenant?.name || 'Company'}
          </Text> */}
        </View>

        {/* Quick Access Bar */}
        <View style={styles.quickAccessSection}>
          <View style={styles.quickAccessHeader}>
            <FontAwesome name="bolt" size={16} color={colors.primary} />
            <Text style={[styles.quickAccessTitle, { color: colors.text }]}>Quick Access</Text>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickAccessScroll}
          >
            {getQuickAccessItems().map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickAccessItem}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.quickAccessIconContainer, { backgroundColor: item.color }]}>
                  <FontAwesome name={item.icon as any} size={22} color="white" />
                </View>
                <Text style={[styles.quickAccessLabel, { color: colors.text }]} numberOfLines={2}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* KPI Section */}
        <View style={styles.kpiSection}>
          <Text style={[styles.kpiTitle, { color: colors.text }]}>Overview</Text>
          
          {/* KPI Grid - 2x2 */}
          <View style={styles.kpiGrid}>
            {/* Row 1 */}
            <View style={styles.kpiRow}>
              {/* Total Employees */}
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIconCircle, { backgroundColor: colors.primary }]}>
                  <FontAwesome name="users" size={15} color="white" />
                </View>
                <Text style={[styles.kpiCardValue, { color: colors.text }]}>
                  {stats?.total_employees || 0}
                </Text>
                <Text style={[styles.kpiCardLabel, { color: colors.textSecondary }]}>
                  Total Employees
                </Text>
              </View>

              {/* Active Employees */}
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIconCircle, { backgroundColor: colors.success }]}>
                  <FontAwesome name="check-circle" size={15} color="white" />
                </View>
                <Text style={[styles.kpiCardValue, { color: colors.text }]}>
                  {stats?.active_employees || stats?.total_employees || 0}
                </Text>
                <Text style={[styles.kpiCardLabel, { color: colors.textSecondary }]}>
                  Active
                </Text>
              </View>
            </View>

            {/* Row 2 */}
            <View style={styles.kpiRow}>
              {/* Employees Paid */}
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIconCircle, { backgroundColor: colors.info }]}>
                  <FontAwesome name="calendar-check-o" size={15} color="white" />
                </View>
                <Text style={[styles.kpiCardValue, { color: colors.text }]}>
                  {stats?.employees_paid_this_month || 0}
                </Text>
                <Text style={[styles.kpiCardLabel, { color: colors.textSecondary }]}>
                  Paid This Month
                </Text>
              </View>

              {/* Total Salary Paid */}
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIconCircle, { backgroundColor: colors.warning }]}>
                  <FontAwesome name="dollar" size={15} color="white" />
                </View>
                <Text style={[styles.kpiCardValue, { color: colors.text }]}>
                  ₹{stats?.total_salary_paid ? (stats.total_salary_paid / 100000).toFixed(1) : '0'}L
                </Text>
                <Text style={[styles.kpiCardLabel, { color: colors.textSecondary }]}>
                  Total Salary
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Attendance Metrics */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Attendance Metrics
          </Text>
          <View style={[styles.metricsGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.metricItem}>
              <View style={[styles.metricIconContainer, { backgroundColor: `${colors.success}15` }]}>
                <FontAwesome name="check" size={16} color={colors.success} />
              </View>
              <Text style={[styles.metricValue, { color: colors.success }]}>
                {stats?.present_today || 0}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                Present Today
              </Text>
            </View>

            <View style={styles.metricItem}>
              <View style={[styles.metricIconContainer, { backgroundColor: `${colors.warning}15` }]}>
                <FontAwesome name="times" size={16} color={colors.warning} />
              </View>
              <Text style={[styles.metricValue, { color: colors.warning }]}>
                {stats?.absent_today || 0}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                Absent Today
              </Text>
            </View>

            <View style={styles.metricItem}>
              <View style={[styles.metricIconContainer, { backgroundColor: `${colors.info}15` }]}>
                <FontAwesome name="clock-o" size={16} color={colors.info} />
              </View>
              <Text style={[styles.metricValue, { color: colors.info }]}>
                {stats?.on_leave_today || 0}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                On Leave
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  companyText: {
    fontSize: 16,
  },
  quickAccessSection: {
    marginBottom: 24,
  },
  quickAccessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  quickAccessTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  quickAccessScroll: {
    paddingRight: 16,
  },
  quickAccessItem: {
    width: 70,
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAccessIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickAccessLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14,
  },
  kpiSection: {
    marginBottom: 24,
  },
  kpiTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  kpiGrid: {
    gap: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 95,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  kpiIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiCardValue: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 2,
  },
  kpiCardLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  deptCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  deptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deptName: {
    fontSize: 16,
    fontWeight: '500',
  },
  deptCount: {
    fontSize: 16,
    fontWeight: '600',
  },
  deptSalary: {
    fontSize: 14,
  },
  chartWrapper: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
  },
  chart: {
    borderRadius: 8,
  },
  metricsGrid: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
});
