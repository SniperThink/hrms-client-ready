// Dashboard/Overview Screen
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useAppSelector } from '@/store/hooks';
import { api } from '@/services/api';
import { API_ENDPOINTS } from '@/constants/Config';
import { DashboardStats } from '@/types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { BarChart, PieChart, LineChart } from 'react-native-chart-kit';

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, tenant } = useAppSelector((state) => state.auth);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = async () => {
    try {
      const data = await api.get<DashboardStats>(API_ENDPOINTS.dashboard);
      setStats(data);
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
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
          <Text style={[styles.companyText, { color: colors.textSecondary }]}>
            {tenant?.name || 'Company'}
          </Text>
        </View>

        {/* KPI Section */}
        <View style={styles.kpiSection}>
          <Text style={[styles.kpiTitle, { color: colors.text }]}>Key Performance Indicators</Text>
          
          {/* KPI Items */}
          <View style={styles.kpiGrid}>
            {/* Total Employees */}
            <View style={[styles.kpiItem, { borderLeftColor: colors.primary }]}>
              <View style={styles.kpiHeader}>
                <View style={[styles.kpiIconContainer, { backgroundColor: `${colors.primary}15` }]}>
                  <FontAwesome name="users" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Total Employees</Text>
              </View>
              <Text style={[styles.kpiValue, { color: colors.primary }]}>
                {stats?.total_employees || 0}
              </Text>
            </View>

            {/* Active Employees */}
            <View style={[styles.kpiItem, { borderLeftColor: colors.success }]}>
              <View style={styles.kpiHeader}>
                <View style={[styles.kpiIconContainer, { backgroundColor: `${colors.success}15` }]}>
                  <FontAwesome name="check-circle" size={20} color={colors.success} />
                </View>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Active Employees</Text>
              </View>
              <Text style={[styles.kpiValue, { color: colors.success }]}>
                {stats?.active_employees || 0}
              </Text>
            </View>

            {/* Attendance Rate */}
            <View style={[styles.kpiItem, { borderLeftColor: colors.info }]}>
              <View style={styles.kpiHeader}>
                <View style={[styles.kpiIconContainer, { backgroundColor: `${colors.info}15` }]}>
                  <FontAwesome name="calendar-check-o" size={20} color={colors.info} />
                </View>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Attendance Rate</Text>
              </View>
              <Text style={[styles.kpiValue, { color: colors.info }]}>
                {stats?.attendance_rate?.toFixed(1) || '0'}%
              </Text>
            </View>

            {/* Total Salary */}
            <View style={[styles.kpiItem, { borderLeftColor: colors.warning }]}>
              <View style={styles.kpiHeader}>
                <View style={[styles.kpiIconContainer, { backgroundColor: `${colors.warning}15` }]}>
                  <FontAwesome name="dollar" size={20} color={colors.warning} />
                </View>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Total Salary</Text>
              </View>
              <Text style={[styles.kpiValue, { color: colors.warning }]}>
                ₹{stats?.total_salary ? (parseFloat(stats.total_salary) / 100000).toFixed(1) : '0'}L
              </Text>
            </View>
          </View>
        </View>

        {/* Department Distribution Chart */}
        {stats?.department_data && stats.department_data.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Department Distribution
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={[styles.chartWrapper, { backgroundColor: colors.surface }]}>
                <BarChart
                  data={{
                    labels: stats.department_data.map(d => d.department.substring(0, 10)),
                    datasets: [
                      {
                        data: stats.department_data.map(d => d.count || 0),
                      },
                    ],
                  }}
                  width={Math.max(Dimensions.get('window').width - 48, 300)}
                  height={250}
                  yAxisLabel=""
                  yAxisSuffix=""
                  chartConfig={{
                    backgroundColor: colors.surface,
                    backgroundGradientFrom: colors.surface,
                    backgroundGradientTo: colors.surface,
                    color: () => colors.primary,
                    barPercentage: 0.7,
                    decimalPlaces: 0,
                    formatYLabel: (value: string) => `${value}`,
                  }}
                  fromZero={true}
                  style={styles.chart}
                />
              </View>
            </ScrollView>
          </View>
        )}

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
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  companyText: {
    fontSize: 16,
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
    flexDirection: 'column',
    gap: 10,
  },
  kpiItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderLeftWidth: 4,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  kpiIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '700',
    marginLeft: 12,
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
