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
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setSelectedDate } from '@/store/slices/attendanceSlice';
import { attendanceService } from '@/services/attendanceService';
import { DailyAttendance } from '@/types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format } from 'date-fns';

export default function AttendanceLogScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { selectedDate } = useAppSelector((state) => state.attendance);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [records, setRecords] = useState<DailyAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [date, setDate] = useState(selectedDate || format(new Date(), 'yyyy-MM-dd'));
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    loadRecords();
  }, [date]);

  // Keep global selectedDate in sync so other attendance screens stay consistent
  useEffect(() => {
    if (date && date !== selectedDate) {
      dispatch(setSelectedDate(date));
    }
  }, [date, selectedDate, dispatch]);

  const loadRecords = async () => {
    try {
      setLoading(true);

      // Fetch all pages for the selected date so every employee is shown
      const all: DailyAttendance[] = [];
      let page = 1;

      // Hard safety cap to avoid runaway in case of API issues
      while (page <= 50) {
        const response = await attendanceService.getDailyAttendance(page, date);
        const results = response.results || [];
        all.push(...results);

        const hasNext = (response as any)?.next;
        if (!hasNext || results.length === 0) break;
        page += 1;
      }

      setRecords(all);
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

  // Simple KPIs for quick glance (present / absent / others)
  const stats = filteredRecords.reduce(
    (acc, rec) => {
      if (rec.attendance_status === 'PRESENT') acc.present += 1;
      else if (rec.attendance_status === 'ABSENT') acc.absent += 1;
      else acc.others += 1;
      return acc;
    },
    { present: 0, absent: 0, others: 0 }
  );

  // Reuse the same 60-day window used in manual entry for consistency
  const generateDateOptions = () => {
    const options: { date: string; display: string; isToday: boolean }[] = [];
    const today = new Date();

    // Last 30 days
    for (let i = 30; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      options.push({
        date: format(d, 'yyyy-MM-dd'),
        display: format(d, 'dd MMM yyyy (EEEE)'),
        isToday: i === 0,
      });
    }

    // Next 30 days
    for (let i = 1; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      options.push({
        date: format(d, 'yyyy-MM-dd'),
        display: format(d, 'dd MMM yyyy (EEEE)'),
        isToday: false,
      });
    }

    return options;
  };

  const dateOptions = generateDateOptions();

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
            <FontAwesome name="clock-o" size={14} color={colors.warning} />
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

      {/* Date & KPIs */}
      <View style={[styles.dateKpiContainer]}>
        <TouchableOpacity
          style={[styles.dateContainer, { backgroundColor: colors.surface }]}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.8}
        >
          <FontAwesome name="calendar" size={16} color={colors.primary} />
          <Text style={[styles.dateText, { color: colors.text }]}>
            {format(new Date(date), 'dd MMM yyyy (EEEE)')}
          </Text>
          <FontAwesome name="chevron-down" size={12} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.kpiRow}>
          <View style={[styles.kpiChip, { backgroundColor: `${colors.success}15` }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Present</Text>
            <Text style={[styles.kpiValue, { color: colors.success }]}>{stats.present}</Text>
          </View>
          <View style={[styles.kpiChip, { backgroundColor: `${colors.error}15` }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Absent</Text>
            <Text style={[styles.kpiValue, { color: colors.error }]}>{stats.absent}</Text>
          </View>
          <View style={[styles.kpiChip, { backgroundColor: `${colors.info}15` }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Others</Text>
            <Text style={[styles.kpiValue, { color: colors.info }]}>{stats.others}</Text>
          </View>
        </View>
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

      {/* Date picker bottom sheet */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <FontAwesome name="times" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={dateOptions}
              keyExtractor={(item) => item.date}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.dateOption,
                    {
                      backgroundColor: date === item.date ? colors.primary : 'transparent',
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => {
                    setDate(item.date);
                    setShowDatePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dateOptionText,
                      {
                        color: date === item.date ? 'white' : colors.text,
                        fontWeight: item.isToday ? '600' : 'normal',
                      },
                    ]}
                  >
                    {item.display}
                    {item.isToday && ' (Today)'}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
  dateKpiContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  kpiChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  kpiValue: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '700',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  dateOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dateOptionText: {
    fontSize: 14,
  },
});

