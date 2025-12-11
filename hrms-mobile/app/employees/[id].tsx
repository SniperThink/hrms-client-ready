// Employee Details Screen
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppDispatch } from '@/store/hooks';
import { setSelectedEmployee } from '@/store/slices/employeeSlice';
import { employeeService } from '@/services/employeeService';
import { EmployeeProfile } from '@/types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function EmployeeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadEmployee();
    }
  }, [id]);

  const loadEmployee = async () => {
    try {
      setLoading(true);
      const data = await employeeService.getEmployeeDetails(parseInt(id!));
      setEmployee(data);
      dispatch(setSelectedEmployee(data));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load employee details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!employee) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>Employee not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Employee Details</Text>
        <TouchableOpacity
          onPress={() => router.push(`/employees/${id}/edit`)}
          style={styles.editButton}
        >
          <FontAwesome name="edit" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Employee Info Card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {employee.first_name?.[0]?.toUpperCase() || 'E'}
            </Text>
          </View>
          <Text style={[styles.employeeName, { color: colors.text }]}>
            {employee.first_name} {employee.last_name || ''}
          </Text>
          <Text style={[styles.employeeId, { color: colors.textSecondary }]}>
            ID: {employee.employee_id}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: employee.is_active ? colors.success : colors.error }]}>
            <Text style={styles.statusText}>
              {employee.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </View>

      {/* Personal Information */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Information</Text>
        <InfoRow label="Email" value={employee.email || 'N/A'} colors={colors} />
        <InfoRow label="Mobile" value={employee.mobile_number || 'N/A'} colors={colors} />
        <InfoRow label="Date of Birth" value={employee.date_of_birth || 'N/A'} colors={colors} />
        <InfoRow label="Gender" value={employee.gender || 'N/A'} colors={colors} />
        <InfoRow label="Marital Status" value={employee.marital_status || 'N/A'} colors={colors} />
        <InfoRow label="Nationality" value={employee.nationality || 'N/A'} colors={colors} />
      </View>

      {/* Professional Information */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Professional Information</Text>
        <InfoRow label="Department" value={employee.department || 'N/A'} colors={colors} />
        <InfoRow label="Designation" value={employee.designation || 'N/A'} colors={colors} />
        <InfoRow label="Employment Type" value={employee.employment_type || 'N/A'} colors={colors} />
        <InfoRow label="Date of Joining" value={employee.date_of_joining || 'N/A'} colors={colors} />
        <InfoRow label="Location/Branch" value={employee.location_branch || 'N/A'} colors={colors} />
        <InfoRow label="Basic Salary" value={`₹${employee.basic_salary?.toLocaleString() || '0'}`} colors={colors} />
      </View>

      {/* Shift Information */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Shift Information</Text>
        <InfoRow label="Shift Start" value={employee.shift_start_time || 'N/A'} colors={colors} />
        <InfoRow label="Shift End" value={employee.shift_end_time || 'N/A'} colors={colors} />
        <InfoRow label="OT Rate" value={`₹${employee.ot_charge_per_hour || '0'}/hr`} colors={colors} />
        <InfoRow label="TDS %" value={`${employee.tds_percentage || 0}%`} colors={colors} />
      </View>

      {/* Off Days */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Off Days</Text>
        <View style={styles.offDaysContainer}>
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => {
            const dayKey = `off_${day.toLowerCase()}` as keyof EmployeeProfile;
            const isOff = employee[dayKey] as boolean;
            return (
              <View key={day} style={styles.offDayItem}>
                <Text style={[styles.offDayText, { color: colors.text }]}>{day}</Text>
                <View style={[styles.offDayBadge, { backgroundColor: isOff ? colors.success : colors.border }]}>
                  <Text style={[styles.offDayBadgeText, { color: isOff ? 'white' : colors.textSecondary }]}>
                    {isOff ? 'Off' : 'Working'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Address */}
      {employee.address && (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Address</Text>
          <Text style={[styles.addressText, { color: colors.textSecondary }]}>
            {employee.address}
            {employee.city && `, ${employee.city}`}
            {employee.state && `, ${employee.state}`}
          </Text>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const InfoRow = ({ label, value, colors }: { label: string; value: string; colors: any }) => (
  <View style={styles.infoRow}>
    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
    <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
  </View>
);

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
  editButton: {
    padding: 8,
  },
  card: {
    margin: 16,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarContainer: {
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
  },
  employeeName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  employeeId: {
    fontSize: 16,
    marginBottom: 8,
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
  section: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  offDaysContainer: {
    gap: 12,
  },
  offDayItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  offDayText: {
    fontSize: 14,
  },
  offDayBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  offDayBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addressText: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 32,
  },
});

