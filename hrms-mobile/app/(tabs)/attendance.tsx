// Attendance Tracker Screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setDailyRecords, setSelectedDate, setLoading } from '@/store/slices/attendanceSlice';
import { attendanceService } from '@/services/attendanceService';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';

export default function AttendanceScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { dailyRecords, selectedDate, isLoading } = useAppSelector((state) => state.attendance);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendanceMap, setAttendanceMap] = useState<Record<string, any>>({});

  useEffect(() => {
    loadAttendanceForMonth();
  }, [currentMonth]);

  const loadAttendanceForMonth = async () => {
    try {
      dispatch(setLoading(true));
      const monthStr = format(currentMonth, 'yyyy-MM');
      const response = await attendanceService.getDailyAttendance(1, monthStr);
      dispatch(setDailyRecords(response.results));
      
      // Create map for quick lookup
      const map: Record<string, any> = {};
      response.results.forEach((record: any) => {
        map[record.date] = record;
      });
      setAttendanceMap(map);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load attendance');
    } finally {
      dispatch(setLoading(false));
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return colors.success;
      case 'ABSENT':
        return colors.error;
      case 'HALF_DAY':
        return colors.warning;
      case 'PAID_LEAVE':
        return colors.info;
      case 'OFF':
        return colors.textLight;
      default:
        return colors.border;
    }
  };

  const handleDatePress = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    dispatch(setSelectedDate(dateStr));
    router.push('/attendance/log');
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentMonth);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentMonth(newDate);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Month Navigation */}
      <View style={[styles.monthNav, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigateMonth('prev')}>
          <FontAwesome name="chevron-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.monthText, { color: colors.text }]}>
          {format(currentMonth, 'MMMM yyyy')}
        </Text>
        <TouchableOpacity onPress={() => navigateMonth('next')}>
          <FontAwesome name="chevron-right" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Calendar Grid */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.calendarContainer}>
          <View style={styles.weekDays}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <View key={day} style={styles.weekDay}>
                <Text style={[styles.weekDayText, { color: colors.textSecondary }]}>{day}</Text>
              </View>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {daysInMonth.map((date) => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const record = attendanceMap[dateStr];
              const status = record?.attendance_status || 'UNMARKED';
              const isToday = isSameDay(date, new Date());

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.dayCell,
                    {
                      backgroundColor: record ? getStatusColor(status) : colors.surface,
                      borderColor: isToday ? colors.primary : colors.border,
                      borderWidth: isToday ? 2 : 1,
                    },
                  ]}
                  onPress={() => handleDatePress(date)}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      {
                        color: record ? 'white' : colors.text,
                        fontWeight: isToday ? 'bold' : 'normal',
                      },
                    ]}
                  >
                    {format(date, 'd')}
                  </Text>
                  {record && (
                    <View style={styles.dayStatus}>
                      <Text style={styles.dayStatusText}>
                        {status === 'PRESENT' ? 'P' : status === 'ABSENT' ? 'A' : status[0]}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={[styles.legend, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.legendTitle, { color: colors.text }]}>Legend</Text>
            <View style={styles.legendItems}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: colors.success }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>Present</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: colors.error }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>Absent</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: colors.warning }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>Half Day</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: colors.info }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>Paid Leave</Text>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/attendance/log')}
            >
              <FontAwesome name="list" size={16} color="white" />
              <Text style={styles.actionButtonText}>View Log</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.accent }]}
              onPress={() => router.push('/attendance/entry')}
            >
              <FontAwesome name="plus-circle" size={16} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>Add Entry</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  monthText: {
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    flex: 1,
  },
  weekDays: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    borderRadius: 10,
    margin: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '500',
  },
  dayStatus: {
    marginTop: 2,
  },
  dayStatusText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
  },
  legend: {
    margin: 16,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 14,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
