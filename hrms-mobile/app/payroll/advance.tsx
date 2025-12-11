// Advance Payment Manager Screen
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
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { payrollService } from '@/services/payrollService';
import { employeeService } from '@/services/employeeService';
import { EmployeeProfile } from '@/types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format } from 'date-fns';

export default function AdvanceManagerScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [advances, setAdvances] = useState<any[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    amount: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [advancesRes, employeesRes] = await Promise.all([
        payrollService.getAdvancePayments(),
        employeeService.getEmployees(1),
      ]);
      setAdvances(advancesRes?.results || advancesRes || []);
      setEmployees(employeesRes?.results || employeesRes || []);
    } catch (error: any) {
      console.error('Failed to load advance data:', error);
      Alert.alert('Error', error.message || 'Failed to load data');
      setAdvances([]);
      setEmployees([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSubmit = async () => {
    if (!formData.employee_id || !formData.amount) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await payrollService.createAdvancePayment({
        employee_id: formData.employee_id,
        amount: parseFloat(formData.amount),
        description: formData.description,
        date: format(new Date(), 'yyyy-MM-dd'),
      });
      Alert.alert('Success', 'Advance payment recorded successfully', [
        { text: 'OK', onPress: () => {
          setShowForm(false);
          setFormData({ employee_id: '', amount: '', description: '' });
          loadData();
        }},
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create advance payment');
    } finally {
      setSubmitting(false);
    }
  };

  const renderAdvance = ({ item }: { item: any }) => {
    const employee = employees.find((e) => e.employee_id === item.employee_id);
    return (
      <View style={[styles.advanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.advanceHeader}>
          <View>
            <Text style={[styles.employeeName, { color: colors.text }]}>
              {employee ? `${employee.first_name} ${employee.last_name || ''}` : item.employee_id}
            </Text>
            <Text style={[styles.employeeId, { color: colors.textSecondary }]}>
              {item.employee_id}
            </Text>
          </View>
          <Text style={[styles.amount, { color: colors.primary }]}>
            ₹{parseFloat(item.amount?.toString() || '0').toLocaleString()}
          </Text>
        </View>
        {item.description && (
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {item.description}
          </Text>
        )}
        <Text style={[styles.date, { color: colors.textLight }]}>
          {item.date ? format(new Date(item.date), 'MMM dd, yyyy') : 'N/A'}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Advance Manager</Text>
        <TouchableOpacity
          onPress={() => setShowForm(!showForm)}
          style={styles.addButton}
        >
          <FontAwesome name={showForm ? "times" : "plus"} size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Add Form */}
      {showForm && (
        <View style={[styles.formContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.text }]}>Add Advance Payment</Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Employee *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.employeeScroll}>
              {employees.map((emp) => (
                <TouchableOpacity
                  key={emp.id}
                  style={[
                    styles.employeeOption,
                    {
                      backgroundColor: formData.employee_id === emp.employee_id ? colors.primary : colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => setFormData({ ...formData, employee_id: emp.employee_id || '' })}
                >
                  <Text
                    style={[
                      styles.employeeOptionText,
                      {
                        color: formData.employee_id === emp.employee_id ? 'white' : colors.text,
                      },
                    ]}
                  >
                    {emp.first_name} {emp.last_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Amount *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={formData.amount}
              onChangeText={(text) => setFormData({ ...formData, amount: text })}
              placeholder="Enter amount"
              placeholderTextColor={colors.textLight}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Description</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Enter description"
              placeholderTextColor={colors.textLight}
              multiline
              numberOfLines={3}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.primary }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitButtonText}>Add Advance</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Advances List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : advances.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome name="money" size={48} color={colors.textLight} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No advance payments found
          </Text>
        </View>
      ) : (
        <FlatList
          data={advances}
          renderItem={renderAdvance}
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
  formContainer: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
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
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  submitButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  advanceCard: {
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
  advanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  employeeId: {
    fontSize: 14,
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 14,
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
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

