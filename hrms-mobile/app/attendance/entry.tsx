// Attendance Entry Screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { attendanceService } from '@/services/attendanceService';
import { employeeService } from '@/services/employeeService';
import { EmployeeProfile } from '@/types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format } from 'date-fns';

export default function AttendanceEntryScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [status, setStatus] = useState<'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'PAID_LEAVE' | 'OFF'>('PRESENT');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [otHours, setOtHours] = useState('');
  const [lateMinutes, setLateMinutes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await employeeService.getEmployees(1);
      setEmployees(response.results);
      if (response.results.length > 0) {
        setSelectedEmployee(response.results[0].id.toString());
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedEmployee) {
      Alert.alert('Error', 'Please select an employee');
      return;
    }

    setLoading(true);
    try {
      const employee = employees.find((e) => e.id.toString() === selectedEmployee);
      await attendanceService.createDailyAttendance({
        employee_id: employee?.employee_id || '',
        employee_name: `${employee?.first_name} ${employee?.last_name || ''}`.trim(),
        department: employee?.department || '',
        designation: employee?.designation || '',
        employment_type: employee?.employment_type || 'FULL_TIME',
        attendance_status: status,
        date,
        check_in: checkIn || undefined,
        check_out: checkOut || undefined,
        ot_hours: parseFloat(otHours) || 0,
        late_minutes: parseInt(lateMinutes) || 0,
      });

      Alert.alert('Success', 'Attendance recorded successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to record attendance');
    } finally {
      setLoading(false);
    }
  };

  if (loadingEmployees) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
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
        <Text style={styles.headerTitle}>Record Attendance</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.form}>
        {/* Employee Selection */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Employee</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.employeeScroll}>
            {employees.map((emp) => (
              <TouchableOpacity
                key={emp.id}
                style={[
                  styles.employeeOption,
                  {
                    backgroundColor: selectedEmployee === emp.id.toString() ? colors.primary : colors.background,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setSelectedEmployee(emp.id.toString())}
              >
                <Text
                  style={[
                    styles.employeeOptionText,
                    {
                      color: selectedEmployee === emp.id.toString() ? 'white' : colors.text,
                    },
                  ]}
                >
                  {emp.first_name} {emp.last_name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Date */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Date</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textLight}
          />
        </View>

        {/* Status */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Status</Text>
          <View style={styles.statusButtons}>
            {(['PRESENT', 'ABSENT', 'HALF_DAY', 'PAID_LEAVE', 'OFF'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusButton,
                  {
                    backgroundColor: status === s ? colors.primary : colors.background,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setStatus(s)}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    {
                      color: status === s ? 'white' : colors.text,
                      fontWeight: status === s ? '600' : 'normal',
                    },
                  ]}
                >
                  {s.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Time Details (only for PRESENT) */}
        {status === 'PRESENT' && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Time Details</Text>
            
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.label, { color: colors.text }]}>Check In</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  value={checkIn}
                  onChangeText={setCheckIn}
                  placeholder="09:00"
                  placeholderTextColor={colors.textLight}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.label, { color: colors.text }]}>Check Out</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  value={checkOut}
                  onChangeText={setCheckOut}
                  placeholder="18:00"
                  placeholderTextColor={colors.textLight}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.label, { color: colors.text }]}>OT Hours</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  value={otHours}
                  onChangeText={setOtHours}
                  placeholder="0"
                  placeholderTextColor={colors.textLight}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.label, { color: colors.text }]}>Late Minutes</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  value={lateMinutes}
                  onChangeText={setLateMinutes}
                  placeholder="0"
                  placeholderTextColor={colors.textLight}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.primary }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>Record Attendance</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </View>
    </ScrollView>
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
  form: {
    padding: 16,
  },
  section: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
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
  employeeScroll: {
    marginHorizontal: -4,
  },
  employeeOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  employeeOptionText: {
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  statusButtonText: {
    fontSize: 14,
  },
  submitButton: {
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

