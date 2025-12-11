// Holiday Management Screen
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
import { holidayService } from '@/services/holidayService';
import { Holiday } from '@/types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format, parseISO, isAfter, isBefore } from 'date-fns';

export default function HolidayManagementScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);

  useEffect(() => {
    loadHolidays();
  }, [showUpcoming]);

  const loadHolidays = async () => {
    try {
      setLoading(true);
      if (showUpcoming) {
        const data = await holidayService.getUpcomingHolidays();
        setUpcomingHolidays(data);
      } else {
        const data = await holidayService.getHolidays();
        setHolidays(data);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load holidays');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadHolidays();
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      'Delete Holiday',
      'Are you sure you want to delete this holiday?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await holidayService.deleteHoliday(id);
              loadHolidays();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete holiday');
            }
          },
        },
      ]
    );
  };

  const isUpcoming = (dateStr: string) => {
    return isAfter(parseISO(dateStr), new Date());
  };

  const renderHoliday = ({ item }: { item: Holiday }) => {
    const upcoming = isUpcoming(item.date);
    return (
      <View style={[styles.holidayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.holidayHeader}>
          <View style={styles.holidayInfo}>
            <Text style={[styles.holidayName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.holidayDate, { color: colors.textSecondary }]}>
              {format(parseISO(item.date), 'MMMM dd, yyyy')}
            </Text>
            {item.is_recurring && (
              <View style={[styles.recurringBadge, { backgroundColor: colors.info }]}>
                <Text style={styles.recurringText}>Recurring</Text>
              </View>
            )}
            {upcoming && (
              <View style={[styles.upcomingBadge, { backgroundColor: colors.success }]}>
                <Text style={styles.upcomingText}>Upcoming</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(item.id)}
            style={styles.deleteButton}
          >
            <FontAwesome name="trash" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
        {item.description && (
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {item.description}
          </Text>
        )}
      </View>
    );
  };

  const displayHolidays = showUpcoming ? upcomingHolidays : holidays;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Holidays</Text>
        <TouchableOpacity
          onPress={() => router.push('/holidays/add')}
          style={styles.addButton}
        >
          <FontAwesome name="plus" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Toggle */}
      <View style={[styles.toggleContainer, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            {
              backgroundColor: !showUpcoming ? colors.primary : 'transparent',
            },
          ]}
          onPress={() => setShowUpcoming(false)}
        >
          <Text
            style={[
              styles.toggleText,
              { color: !showUpcoming ? 'white' : colors.text },
            ]}
          >
            All Holidays
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            {
              backgroundColor: showUpcoming ? colors.primary : 'transparent',
            },
          ]}
          onPress={() => setShowUpcoming(true)}
        >
          <Text
            style={[
              styles.toggleText,
              { color: showUpcoming ? 'white' : colors.text },
            ]}
          >
            Upcoming
          </Text>
        </TouchableOpacity>
      </View>

      {/* Holidays List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : displayHolidays.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome name="calendar-times-o" size={48} color={colors.textLight} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No holidays found
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayHolidays}
          renderItem={renderHoliday}
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
  toggleContainer: {
    flexDirection: 'row',
    margin: 16,
    padding: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  holidayCard: {
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
  holidayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  holidayInfo: {
    flex: 1,
  },
  holidayName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  holidayDate: {
    fontSize: 14,
    marginBottom: 8,
  },
  recurringBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  recurringText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  upcomingBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  upcomingText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
  },
  description: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
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

