// Attendance Log Screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppSelector } from '@/store/hooks';
import { attendanceService } from '@/services/attendanceService';
import { DailyAttendance } from '@/types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format } from 'date-fns';

export default function AttendanceLogScreen() {
  const router = useRouter();
  const { selectedDate } = useAppSelector((state) => state.attendance);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [records, setRecords] = useState<DailyAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [date, setDate] = useState(selectedDate || format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    loadRecords();
  }, [date]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const response = await attendanceService.getDailyAttendance(1, date);
      setRecords(response.results);
    } catch (error: any) {
      console.error('Failed to load attendance:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRecords();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT': return colors.success;
      case 'ABSENT': return colors.error;
      case 'HALF_DAY': return colors.warning;
      case 'PAID_LEAVE': return colors.info;
      default: return colors.textLight;
    }
  };

  const filteredRecords = records.filter((record) =>
    record.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.employee_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderRecord = ({ item }: { item: DailyAttendance }) => (
    <TouchableOpacity
      style={[styles.recordCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.recordHeader}>
        <View style={styles.recordInfo}>
          <Text style={[styles.employeeName, { color: colors.text }]}>
            {item.employee_name}
          </Text>
          <Text style={[styles.employeeId, { color: colors.textSecondary }]}>
            {item.employee_id} • {item.department}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.attendance_status) }]}>
          <Text style={styles.statusText}>{item.attendance_status}</Text>
        </View>
      </View>
      <View style={styles.recordDetails}>
        {item.check_in && (
          <View style={styles.detailRow}>
            <FontAwesome name="clock-o" size={14} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              In: {item.check_in} {item.check_out && `Out: ${item.check_out}`}
            </Text>
          </View>
        )}
        {item.ot_hours > 0 && (
          <View style={styles.detailRow}>
            <FontAwesome name="clock" size={14} color={colors.warning} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              OT: {item.ot_hours}h
            </Text>
          </View>
        )}
        {item.late_minutes > 0 && (
          <View style={styles.detailRow}>
            <FontAwesome name="exclamation-triangle" size={14} color={colors.error} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              Late: {item.late_minutes}min
            </Text>
          </View>
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
        <Text style={styles.headerTitle}>Attendance Log</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <FontAwesome name="search" size={16} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search employees..."
          placeholderTextColor={colors.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Date Display */}
      <View style={[styles.dateContainer, { backgroundColor: colors.surface }]}>
        <Text style={[styles.dateText, { color: colors.text }]}>
          {format(new Date(date), 'MMMM dd, yyyy')}
        </Text>
      </View>

      {/* Records List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredRecords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome name="calendar-times-o" size={48} color={colors.textLight} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No attendance records found
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRecords}
          renderItem={renderRecord}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  dateContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  recordCard: {
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
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  recordInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  employeeId: {
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
  recordDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
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

