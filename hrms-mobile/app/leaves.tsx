// Leave Management Screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { leaveService } from '@/services/leaveService';
import { Leave } from '@/types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format } from 'date-fns';

export default function LeaveManagementScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    loadLeaves();
  }, [statusFilter]);

  const loadLeaves = async () => {
    try {
      setLoading(true);
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const response = await leaveService.getLeaves(1, status);
      setLeaves(response.results);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load leaves');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLeaves();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return colors.success;
      case 'rejected': return colors.error;
      case 'pending': return colors.warning;
      default: return colors.textLight;
    }
  };

  const renderLeave = ({ item }: { item: Leave }) => (
    <TouchableOpacity
      style={[styles.leaveCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.leaveHeader}>
        <View>
          <Text style={[styles.leaveType, { color: colors.text }]}>
            {item.leave_type}
          </Text>
          <Text style={[styles.leaveDates, { color: colors.textSecondary }]}>
            {format(new Date(item.start_date), 'MMM dd')} - {format(new Date(item.end_date), 'MMM dd, yyyy')}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.leaveDetails}>
        <Text style={[styles.daysText, { color: colors.text }]}>
          {item.days} {item.days === 1 ? 'day' : 'days'}
        </Text>
        {item.reason && (
          <Text style={[styles.reasonText, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.reason}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leave Management</Text>
        <TouchableOpacity
          onPress={() => router.push('/leaves/add')}
          style={styles.addButton}
        >
          <FontAwesome name="plus" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterTabs, { backgroundColor: colors.surface }]}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterTab,
              {
                backgroundColor: statusFilter === status ? colors.primary : 'transparent',
                borderBottomColor: statusFilter === status ? colors.primary : 'transparent',
              },
            ]}
            onPress={() => setStatusFilter(status)}
          >
            <Text
              style={[
                styles.filterTabText,
                {
                  color: statusFilter === status ? 'white' : colors.textSecondary,
                  fontWeight: statusFilter === status ? '600' : 'normal',
                },
              ]}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Leaves List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : leaves.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome name="calendar-times-o" size={48} color={colors.textLight} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No leave requests found
          </Text>
        </View>
      ) : (
        <FlatList
          data={leaves}
          renderItem={renderLeave}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  addButton: {
    padding: 8,
  },
  filterTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  filterTabText: {
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  leaveCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  leaveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  leaveType: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  leaveDates: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  leaveDetails: {
    gap: 4,
  },
  daysText: {
    fontSize: 14,
    fontWeight: '500',
  },
  reasonText: {
    fontSize: 14,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
});

