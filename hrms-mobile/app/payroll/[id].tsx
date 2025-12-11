// Payroll Detail Screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { payrollService } from '@/services/payrollService';
import { CalculatedSalary } from '@/types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function PayrollDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [salary, setSalary] = useState<CalculatedSalary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [advanceDeduction, setAdvanceDeduction] = useState('');

  useEffect(() => {
    if (id) {
      loadSalary();
    } else {
      Alert.alert('Error', 'Invalid salary ID');
      router.back();
    }
  }, [id]);

  const loadSalary = async () => {
    const salaryId = Number(id);
    if (!salaryId || Number.isNaN(salaryId)) {
      Alert.alert('Error', 'Invalid salary ID');
      router.back();
      return;
    }
    
    try {
      setLoading(true);
      // Get calculated salary directly by ID
      const salaryData = await payrollService.getCalculatedSalaryById(salaryId);
      setSalary(salaryData);
      const advanceAmount = salaryData.advance_deduction_amount || 0;
      setAdvanceDeduction(advanceAmount.toString());
    } catch (error: any) {
      console.error('Failed to load salary details:', error);
      Alert.alert('Error', error.message || 'Failed to load salary details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!salary) return;

    setSaving(true);
    try {
      await payrollService.updateCalculatedSalary(salary.id, {
        advance_deduction_amount: parseFloat(advanceDeduction) || 0,
      });
      Alert.alert('Success', 'Salary updated successfully');
      loadSalary();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update salary');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !salary) {
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
        <Text style={styles.headerTitle}>Payroll Details</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Employee Info */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.employeeName, { color: colors.text }]}>
          {salary.employee_name}
        </Text>
        <Text style={[styles.employeeId, { color: colors.textSecondary }]}>
          {salary.employee_id}
        </Text>
      </View>

      {/* Salary Breakdown */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Salary Breakdown</Text>
        
        <InfoRow label="Basic Salary" value={`₹${parseFloat((salary.basic_salary || 0).toString()).toLocaleString('en-IN')}`} colors={colors} />
        <InfoRow label="Present Days" value={(salary.present_days || 0).toString()} colors={colors} />
        <InfoRow label="Absent Days" value={(salary.absent_days || 0).toString()} colors={colors} />
        <InfoRow label="OT Hours" value={(salary.ot_hours || 0).toString()} colors={colors} />
        <InfoRow label="Late Minutes" value={(salary.late_minutes || 0).toString()} colors={colors} />
        
        <View style={styles.divider} />
        
        <InfoRow label="Salary for Present Days" value={`₹${parseFloat((salary.salary_for_present_days || 0).toString()).toLocaleString('en-IN')}`} colors={colors} />
        <InfoRow label="OT Charges" value={`₹${parseFloat((salary.ot_charges || 0).toString()).toLocaleString('en-IN')}`} colors={colors} />
        <InfoRow label="Late Deduction" value={`₹${parseFloat((salary.late_deduction || 0).toString()).toLocaleString('en-IN')}`} colors={colors} />
        <InfoRow label="Incentive" value={`₹${parseFloat((salary.incentive || 0).toString()).toLocaleString('en-IN')}`} colors={colors} />
        
        <View style={styles.divider} />
        
        <InfoRow label="Gross Salary" value={`₹${parseFloat((salary.gross_salary || 0).toString()).toLocaleString('en-IN')}`} colors={colors} isHighlight />
        <InfoRow label="TDS Amount" value={`₹${parseFloat((salary.tds_amount || 0).toString()).toLocaleString('en-IN')}`} colors={colors} />
        <InfoRow label="Salary After TDS" value={`₹${parseFloat((salary.salary_after_tds || 0).toString()).toLocaleString('en-IN')}`} colors={colors} />
      </View>

      {/* Advance Management */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Advance Management</Text>
        
        <InfoRow label="Total Advance Balance" value={`₹${parseFloat((salary.total_advance_balance || 0).toString()).toLocaleString('en-IN')}`} colors={colors} />
        
        {salary.advance_deduction_editable ? (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Advance Deduction</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={advanceDeduction}
              onChangeText={setAdvanceDeduction}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textLight}
            />
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <InfoRow label="Advance Deduction" value={`₹${parseFloat((salary.advance_deduction_amount || 0).toString()).toLocaleString('en-IN')}`} colors={colors} />
        )}
        
        <InfoRow label="Remaining Advance" value={`₹${parseFloat((salary.remaining_advance_balance || 0).toString()).toLocaleString('en-IN')}`} colors={colors} />
      </View>

      {/* Net Payable */}
      <View style={[styles.netPayableCard, { backgroundColor: colors.primary }]}>
        <Text style={styles.netPayableLabel}>Net Payable</Text>
        <Text style={styles.netPayableValue}>
          ₹{parseFloat((salary.net_payable || 0).toString()).toLocaleString('en-IN')}
        </Text>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const InfoRow = ({ label, value, colors, isHighlight }: { label: string; value: string; colors: any; isHighlight?: boolean }) => (
  <View style={[styles.infoRow, isHighlight && styles.highlightRow]}>
    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
    <Text style={[styles.infoValue, { color: colors.text, fontWeight: isHighlight ? '600' : 'normal' }]}>{value}</Text>
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
  employeeName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  employeeId: {
    fontSize: 14,
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
  highlightRow: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 12,
    marginHorizontal: -12,
    borderRadius: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  inputGroup: {
    marginTop: 12,
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
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  saveButton: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  netPayableCard: {
    margin: 16,
    padding: 28,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  netPayableLabel: {
    color: 'white',
    fontSize: 16,
    marginBottom: 8,
  },
  netPayableValue: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
  },
});

