// Settings Screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/services/api';
import { API_ENDPOINTS } from '@/constants/Config';
import { useAppSelector } from '@/store/hooks';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function SettingsScreen() {
  const router = useRouter();
  const { tenant } = useAppSelector((state) => state.auth);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await api.get(API_ENDPOINTS.tenantSettings);
      setSettings(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    try {
      setSaving(true);
      const updated = { ...settings, [key]: value };
      await api.patch(API_ENDPOINTS.tenantSettings, updated);
      setSettings(updated);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Company Info */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Company Information</Text>
        <InfoRow label="Company Name" value={tenant?.name || 'N/A'} colors={colors} />
        <InfoRow label="Subdomain" value={tenant?.subdomain || 'N/A'} colors={colors} />
        <InfoRow label="Credits" value={tenant?.credits?.toString() || '0'} colors={colors} />
      </View>

      {/* Payroll Settings */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Payroll Settings</Text>
        
        <SettingRow
          label="Weekly Absent Penalty"
          value={settings?.weekly_absent_penalty_enabled || false}
          onValueChange={(value) => updateSetting('weekly_absent_penalty_enabled', value)}
          colors={colors}
        />
        
        {settings?.weekly_absent_penalty_enabled && (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Penalty Days</Text>
            <Text style={[styles.value, { color: colors.textSecondary }]}>
              {settings?.weekly_absent_penalty_days || 0} days
            </Text>
          </View>
        )}
      </View>

      {/* Account Settings */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => router.push('/settings/change-password')}
        >
          <View style={styles.settingLeft}>
            <FontAwesome name="lock" size={20} color={colors.text} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>Change Password</Text>
          </View>
          <FontAwesome name="chevron-right" size={16} color={colors.textLight} />
        </TouchableOpacity>
      </View>

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

const SettingRow = ({
  label,
  value,
  onValueChange,
  colors,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  colors: any;
}) => (
  <View style={styles.settingRow}>
    <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: colors.border, true: colors.primary }}
      thumbColor="white"
    />
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
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 14,
  },
  inputGroup: {
    marginTop: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
  },
});

