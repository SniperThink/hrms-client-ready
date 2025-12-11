// Dashboard/Overview Screen
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAppSelector } from '@/store/hooks';
import { api } from '@/services/api';
import { API_ENDPOINTS } from '@/constants/Config';
import { DashboardStats } from '@/types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';

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

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <FontAwesome name="users" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {stats?.total_employees || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Total Employees
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconContainer, { backgroundColor: `${colors.success}15` }]}>
              <FontAwesome name="check-circle" size={20} color={colors.success} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {stats?.active_employees || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Active Employees
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconContainer, { backgroundColor: `${colors.info}15` }]}>
              <FontAwesome name="dollar" size={20} color={colors.info} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>
              ₹{stats?.total_salary ? parseFloat(stats.total_salary).toLocaleString() : '0'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Total Salary
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconContainer, { backgroundColor: `${colors.warning}15` }]}>
              <FontAwesome name="calendar-check-o" size={20} color={colors.warning} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {stats?.attendance_rate?.toFixed(1) || '0'}%
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Attendance Rate
            </Text>
          </View>
        </View>

        {/* Department Distribution */}
        {stats?.department_data && stats.department_data.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Department Distribution
            </Text>
            {stats.department_data.map((dept, index) => (
              <View
                key={index}
                style={[styles.deptCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.deptHeader}>
                  <Text style={[styles.deptName, { color: colors.text }]}>{dept.department}</Text>
                  <Text style={[styles.deptCount, { color: colors.primary }]}>{dept.count}</Text>
                </View>
                <Text style={[styles.deptSalary, { color: colors.textSecondary }]}>
                  ₹{parseFloat(dept.total_salary).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
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
});
