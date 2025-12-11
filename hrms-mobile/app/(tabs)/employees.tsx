// Employees List Screen
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setEmployees, addEmployees, setLoading, setPagination, clearEmployees } from '@/store/slices/employeeSlice';
import { employeeService } from '@/services/employeeService';
import { EmployeeProfile } from '@/types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function EmployeesScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { employees, isLoading, pagination } = useAppSelector((state) => state.employees);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadEmployees(1, true);
  }, [searchQuery, selectedDepartment]);

  const loadEmployees = async (page: number = 1, reset: boolean = false) => {
    try {
      dispatch(setLoading(true));
      const response = await employeeService.getEmployees(page, searchQuery, selectedDepartment);
      
      if (reset) {
        dispatch(setEmployees(response.results));
      } else {
        dispatch(addEmployees(response.results));
      }
      
      dispatch(setPagination({
        count: response.count,
        next: response.next,
        previous: response.previous,
      }));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load employees');
    } finally {
      dispatch(setLoading(false));
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEmployees(1, true);
  };

  const loadMore = () => {
    if (pagination.next && !isLoading) {
      const nextPage = parseInt(pagination.next.split('page=')[1]?.split('&')[0] || '2');
      loadEmployees(nextPage, false);
    }
  };

  const handleEmployeePress = (employee: EmployeeProfile) => {
    router.push(`/employees/${employee.id}`);
  };

  const renderEmployeeItem = ({ item }: { item: EmployeeProfile }) => (
    <TouchableOpacity
      style={[styles.employeeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => handleEmployeePress(item)}
    >
      <View style={styles.employeeHeader}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>
            {item.first_name?.[0]?.toUpperCase() || 'E'}
          </Text>
        </View>
        <View style={styles.employeeInfo}>
          <Text style={[styles.employeeName, { color: colors.text }]}>
            {item.first_name} {item.last_name || ''}
          </Text>
          <Text style={[styles.employeeId, { color: colors.textSecondary }]}>
            {item.employee_id}
          </Text>
        </View>
        <FontAwesome name="chevron-right" size={16} color={colors.textLight} />
      </View>
      <View style={styles.employeeDetails}>
        {item.department && (
          <View style={styles.detailRow}>
            <FontAwesome name="building" size={14} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {item.department}
            </Text>
          </View>
        )}
        {item.designation && (
          <View style={styles.detailRow}>
            <FontAwesome name="briefcase" size={14} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {item.designation}
            </Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <FontAwesome 
            name={item.is_active ? "check-circle" : "times-circle"} 
            size={14} 
            color={item.is_active ? colors.success : colors.error} 
          />
          <Text style={[styles.detailText, { color: item.is_active ? colors.success : colors.error }]}>
            {item.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!isLoading) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <FontAwesome name="search" size={16} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search employees..."
          placeholderTextColor={colors.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <FontAwesome name="times" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Employee List */}
      {employees.length === 0 && !isLoading ? (
        <View style={styles.emptyContainer}>
          <FontAwesome name="users" size={48} color={colors.textLight} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No employees found
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/employees/add')}
          >
            <Text style={styles.emptyButtonText}>Add Employee</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={employees}
          renderItem={renderEmployeeItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
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
  listContent: {
    padding: 16,
  },
  employeeCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  avatarText: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  employeeId: {
    fontSize: 14,
  },
  employeeDetails: {
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
  footer: {
    padding: 16,
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
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
