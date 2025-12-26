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
  ScrollView,
  Modal,
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
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [departments, setDepartments] = useState<string[]>(['All']);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeProfile | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastFetchParams, setLastFetchParams] = useState({ search: '', department: '' });

  // Automatically load all employees on mount and when filters change
  useEffect(() => {
    // Check if we need to reload based on filter changes
    const paramsChanged = 
      lastFetchParams.search !== searchQuery || 
      lastFetchParams.department !== selectedDepartment;
    
    // Only reload if filters changed OR no data cached
    if (paramsChanged || employees.length === 0) {
      loadAllEmployees();
      setLastFetchParams({ search: searchQuery, department: selectedDepartment });
    }
  }, [searchQuery, selectedDepartment]);

  // Automatically load all pages in background
  const loadAllEmployees = async () => {
    try {
      dispatch(setLoading(true));
      dispatch(clearEmployees());
      
      // Load first page
      const firstPage = await employeeService.getEmployees(1, searchQuery, selectedDepartment);
      dispatch(setEmployees(firstPage.results));
      dispatch(setPagination({
        count: firstPage.count,
        next: firstPage.next,
        previous: firstPage.previous,
      }));

      // Check if we already have all data (cached scenario)
      const totalCount = firstPage.count;
      const loadedCount = firstPage.results.length;
      
      // If first page has all data, no need to load more
      if (loadedCount >= totalCount) {
        dispatch(setLoading(false));
        setRefreshing(false);
        return;
      }

      // Calculate total pages and load remaining pages automatically
      const pageSize = firstPage.results.length || 20;
      const totalPages = Math.ceil(totalCount / pageSize);
      
      if (totalPages > 1) {
        setIsLoadingMore(true);
        // Load all remaining pages in background
        for (let page = 2; page <= totalPages; page++) {
          try {
            const response = await employeeService.getEmployees(page, searchQuery, selectedDepartment);
            dispatch(addEmployees(response.results));
            dispatch(setPagination({
              count: response.count,
              next: response.next,
              previous: response.previous,
            }));
            
            // Check if we've loaded all data
            const currentLoadedCount = employees.length + response.results.length;
            if (currentLoadedCount >= totalCount) {
              console.log(`✅ All ${totalCount} employees loaded from cache/API`);
              break;
            }
          } catch (error) {
            console.error(`Error loading page ${page}:`, error);
            break;
          }
        }
        setIsLoadingMore(false);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load employees');
    } finally {
      dispatch(setLoading(false));
      setRefreshing(false);
    }
  };

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
    loadAllEmployees();
  };

  const handleEmployeePress = (employee: EmployeeProfile) => {
    setSelectedEmployee(employee);
    setShowDetailsModal(true);
  };

  // Sort employees alphabetically by first name
  const sortedEmployees = [...employees].sort((a, b) => {
    const nameA = (a.first_name || '').toLowerCase();
    const nameB = (b.first_name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const renderEmployeeItem = ({ item }: { item: EmployeeProfile }) => (
    <TouchableOpacity
      style={[styles.employeeCard, { backgroundColor: colors.surface }]}
      onPress={() => handleEmployeePress(item)}
      activeOpacity={0.6}
    >
      {/* Main Content */}
      <View style={styles.cardContent}>
        {/* Left: Avatar */}
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>
            {item.first_name?.[0]?.toUpperCase() || 'E'}
          </Text>
        </View>

        {/* Middle: Name and Details */}
        <View style={styles.infoSection}>
          <Text style={[styles.employeeName, { color: colors.text }]} numberOfLines={1}>
            {item.first_name} {item.last_name || ''}
          </Text>
          <Text style={[styles.employeeId, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.employee_id}
          </Text>
          <View style={styles.detailsRow}>
            {item.department && (
              <Text style={[styles.department, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.department}
              </Text>
            )}
            {item.department && item.designation && (
              <Text style={[styles.dot, { color: colors.textSecondary }]}>•</Text>
            )}
            {item.designation && (
              <Text style={[styles.designation, { color: colors.primary }]} numberOfLines={1}>
                {item.designation}
              </Text>
            )}
          </View>
        </View>

        {/* Right: Status */}
        <View style={[styles.statusIndicator, { backgroundColor: item.is_active ? colors.success : colors.error }]} />
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading all employees...
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Search and Filter Bar */}
      <View style={styles.searchFilterContainer}>
        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FontAwesome name="search" size={16} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name, ID..."
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

        {/* Filter Button */}
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <FontAwesome name="sliders" size={16} color="white" />
        </TouchableOpacity>
      </View>

      {/* Filters Panel */}
      {showFilters && (
        <View style={[styles.filtersPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Department Filter */}
          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>Department</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptions}>
              {['All', 'Sales', 'Engineering', 'HR', 'Finance', 'Operations'].map((dept) => (
                <TouchableOpacity
                  key={dept}
                  style={[
                    styles.filterOption,
                    selectedDepartment === dept && { backgroundColor: colors.primary },
                    selectedDepartment !== dept && { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                  onPress={() => setSelectedDepartment(dept)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      selectedDepartment === dept ? { color: 'white' } : { color: colors.text },
                    ]}
                  >
                    {dept}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Status Filter */}
          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>Status</Text>
            <View style={styles.statusFilterRow}>
              {(['all', 'active', 'inactive'] as const).map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusFilterButton,
                    selectedStatus === status && { backgroundColor: colors.primary },
                    selectedStatus !== status && { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                  onPress={() => setSelectedStatus(status)}
                >
                  <Text
                    style={[
                      styles.statusFilterText,
                      selectedStatus === status ? { color: 'white' } : { color: colors.text },
                    ]}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Employee List */}
      {sortedEmployees.length === 0 && !isLoading ? (
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
          data={sortedEmployees}
          renderItem={renderEmployeeItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListFooterComponent={renderFooter}
        />
      )}

      {/* Employee Details Modal */}
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { backgroundColor: colors.primary }]}>
            <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
              <FontAwesome name="arrow-left" size={20} color="white" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Employee Details</Text>
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
              <FontAwesome name={isEditing ? "check" : "edit"} size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Modal Content */}
          {selectedEmployee && (
            <ScrollView style={styles.modalContent}>
              {/* Employee Header */}
              <View style={[styles.employeeHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.largeAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.largeAvatarText}>
                    {selectedEmployee.first_name?.[0]?.toUpperCase() || 'E'}
                  </Text>
                </View>
                <View style={styles.employeeHeaderInfo}>
                  <Text style={[styles.employeeHeaderName, { color: colors.text }]}>
                    {selectedEmployee.first_name} {selectedEmployee.last_name || ''}
                  </Text>
                  <Text style={[styles.employeeHeaderId, { color: colors.textSecondary }]}>
                    {selectedEmployee.employee_id}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: selectedEmployee.is_active ? colors.success : colors.error }]}>
                    <Text style={styles.statusBadgeText}>
                      {selectedEmployee.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Details Sections */}
              <View style={styles.detailsSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Information</Text>
                <DetailRow label="Email" value={selectedEmployee.email} />
                <DetailRow label="Phone" value={selectedEmployee.mobile_number} />
                <DetailRow label="Department" value={selectedEmployee.department} />
                <DetailRow label="Designation" value={selectedEmployee.designation} />
              </View>

              <View style={styles.detailsSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Work Information</Text>
                <DetailRow label="Date of Joining" value={selectedEmployee.date_of_joining} />
                <DetailRow label="Employment Type" value={selectedEmployee.employment_type} />
                <DetailRow label="Basic Salary" value={`₹${selectedEmployee.basic_salary}`} />
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

// Detail Row Component
const DetailRow = ({ label, value, colors: themeColors }: { label: string; value?: string; colors?: any }) => {
  const colorScheme = useColorScheme();
  const colors = themeColors || Colors[colorScheme ?? 'light'];

  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value || 'N/A'}</Text>
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
  searchFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filtersPanel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    gap: 16,
  },
  filterGroup: {
    gap: 10,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  filterOptions: {
    flexDirection: 'row',
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
  },
  filterOptionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusFilterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusFilterButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  statusFilterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
  },
  employeeCard: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  infoSection: {
    flex: 1,
    justifyContent: 'center',
  },
  employeeName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  employeeId: {
    fontSize: 12,
    marginBottom: 3,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  department: {
    fontSize: 11,
    fontWeight: '400',
  },
  dot: {
    fontSize: 10,
    fontWeight: '400',
  },
  designation: {
    fontSize: 11,
    fontWeight: '500',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
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
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 16,
  },
  largeAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeAvatarText: {
    color: 'white',
    fontSize: 28,
    fontWeight: '700',
  },
  employeeHeaderInfo: {
    flex: 1,
  },
  employeeHeaderName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  employeeHeaderId: {
    fontSize: 13,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailRow: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    textAlign: 'center',
  },
});
