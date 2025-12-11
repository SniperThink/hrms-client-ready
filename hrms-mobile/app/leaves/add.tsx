// Add Leave Request Screen
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
import { leaveService } from '@/services/leaveService';
import { employeeService } from '@/services/employeeService';
import { EmployeeProfile } from '@/types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format, differenceInDays, parseISO } from 'date-fns';

export default function AddLeaveScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  const [formData, setFormData] = useState({
    employee: '',
    leave_type: 'SICK' as 'SICK' | 'CASUAL' | 'EARNED' | 'LOP' | 'OTHER',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    reason: '',
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await employeeService.getEmployees(1);
      setEmployees(response.results);
      if (response.results.length > 0) {
        setFormData({ ...formData, employee: response.results[0].id.toString() });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const calculateDays = () => {
    try {
      const start = parseISO(formData.start_date);
      const end = parseISO(formData.end_date);
      return Math.max(1, differenceInDays(end, start) + 1);
    } catch {
      return 1;
    }
  };

  const handleSubmit = async () => {
    if (!formData.employee || !formData.start_date || !formData.end_date) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (formData.start_date > formData.end_date) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    setLoading(true);
    try {
      await leaveService.createLeave({
        employee: parseInt(formData.employee),
        leave_type: formData.leave_type,
        start_date: formData.start_date,
        end_date: formData.end_date,
        days: calculateDays(),
        reason: formData.reason,
      });

      Alert.alert('Success', 'Leave request submitted successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit leave request');
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
        <Text style={styles.headerTitle}>Apply for Leave</Text>
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
                    backgroundColor: formData.employee === emp.id.toString() ? colors.primary : colors.background,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setFormData({ ...formData, employee: emp.id.toString() })}
              >
                <Text
                  style={[
                    styles.employeeOptionText,
                    {
                      color: formData.employee === emp.id.toString() ? 'white' : colors.text,
                    },
                  ]}
                >
                  {emp.first_name} {emp.last_name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Leave Type */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Leave Type</Text>
          <View style={styles.typeButtons}>
            {(['SICK', 'CASUAL', 'EARNED', 'LOP', 'OTHER'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  {
                    backgroundColor: formData.leave_type === type ? colors.primary : colors.background,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setFormData({ ...formData, leave_type: type })}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    {
                      color: formData.leave_type === type ? 'white' : colors.text,
                      fontWeight: formData.leave_type === type ? '600' : 'normal',
                    },
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Dates */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Date Range</Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Start Date</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={formData.start_date}
              onChangeText={(text) => setFormData({ ...formData, start_date: text })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textLight}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>End Date</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={formData.end_date}
              onChangeText={(text) => setFormData({ ...formData, end_date: text })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textLight}
            />
          </View>

          <View style={[styles.daysInfo, { backgroundColor: colors.background }]}>
            <Text style={[styles.daysLabel, { color: colors.textSecondary }]}>Total Days:</Text>
            <Text style={[styles.daysValue, { color: colors.primary }]}>
              {calculateDays()} {calculateDays() === 1 ? 'day' : 'days'}
            </Text>
          </View>
        </View>

        {/* Reason */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Reason</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            value={formData.reason}
            onChangeText={(text) => setFormData({ ...formData, reason: text })}
            placeholder="Enter reason for leave"
            placeholderTextColor={colors.textLight}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.primary }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Leave Request</Text>
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
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  typeButtonText: {
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
  daysInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  daysLabel: {
    fontSize: 14,
  },
  daysValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: 'top',
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

