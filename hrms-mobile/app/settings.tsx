// Settings Screen - Comprehensive Mobile Settings Page
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
  TextInput,
  Modal,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/services/api';
import { API_ENDPOINTS } from '@/constants/Config';
import { useAppSelector } from '@/store/hooks';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, tenant } = useAppSelector((state) => state.auth);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Main state
  const [activeTab, setActiveTab] = useState<'profile' | 'salary'>('profile');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Profile tab state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);


  // Salary config tab state
  const [salaryConfig, setSalaryConfig] = useState<any>({
    average_days_per_month: 30.4,
    break_time: 0.5,
    weekly_absent_penalty_enabled: false,
    weekly_absent_threshold: 4,
  });
  const [salaryConfigLoading, setSalaryConfigLoading] = useState(false);
  const [salaryConfigSaving, setSalaryConfigSaving] = useState(false);

  // User management tab state (for superusers)
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Modal states
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [changePasswordData, setChangePasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  useEffect(() => {
    loadDataForTab(activeTab);
  }, [activeTab]);

  // Load data based on active tab
  const loadDataForTab = async (tab: string) => {
    switch (tab) {
      case 'profile':
        await loadProfileData();
        break;
      case 'salary':
        await loadSalaryConfigData();
        break;
    }

    // Load user management data if user is superuser
    if (user?.is_superuser) {
      await loadUsersData();
    }
  };

  const loadProfileData = async () => {
    try {
      setProfileLoading(true);
      const data = await api.get(API_ENDPOINTS.userProfile);
      setCurrentUser(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load profile data');
    } finally {
      setProfileLoading(false);
    }
  };


  const loadSalaryConfigData = async () => {
    try {
      setSalaryConfigLoading(true);
      const data = await api.get(API_ENDPOINTS.salaryConfig);
      setSalaryConfig(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load salary configuration');
    } finally {
      setSalaryConfigLoading(false);
    }
  };

  const loadUsersData = async () => {
    if (!user?.is_superuser) return;

    try {
      setUsersLoading(true);
      const data = await api.get(API_ENDPOINTS.users);
      setUsers(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDataForTab(activeTab);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Permission checks
  const isAdmin = user?.role === 'admin' || user?.is_admin || user?.is_superuser || false;
  const isHRManager = user?.role === 'hr_manager' || user?.role === 'hr-manager' || false;
  const isPayrollMaster = user?.role === 'payroll_master' || false;
  const canAccessSalaryTab = isAdmin || isPayrollMaster;
  const canManageUsers = user?.is_superuser;

  // Helper Components
  const InfoRow = ({ label, value, colors }: { label: string; value: string; colors: any }) => (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );

  // Helper Functions
  const handleLogout = async () => {
    try {
      await api.post(API_ENDPOINTS.logout, {});
      console.log('Logout successful');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSaveSalaryConfig = async () => {
    try {
      setSalaryConfigSaving(true);
      await api.post(API_ENDPOINTS.salaryConfigUpdate, salaryConfig);
      Alert.alert('Success', 'Salary configuration saved successfully');
      await loadSalaryConfigData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save salary configuration');
    } finally {
      setSalaryConfigSaving(false);
    }
  };

  const handleToggleUserPermission = async (userId: number, field: string, value: boolean) => {
    try {
      await api.patch(API_ENDPOINTS.userPermissions(userId.toString()), { [field]: value });
      setUsers(users.map(u => u.id === userId ? { ...u, [field]: value } : u));
      Alert.alert('Success', 'User permission updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update user permission');
      setUsers(users.map(u => u.id === userId ? { ...u, [field]: !value } : u));
    }
  };

  const handleChangePassword = async () => {
    if (changePasswordData.new_password !== changePasswordData.confirm_password) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    try {
      await api.post(API_ENDPOINTS.changePassword, {
        current_password: changePasswordData.current_password,
        new_password: changePasswordData.new_password,
      });
      Alert.alert('Success', 'Password changed successfully');
      setShowChangePasswordModal(false);
      setChangePasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change password');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await api.delete(API_ENDPOINTS.deleteAccount);
      Alert.alert('Success', 'Account deleted successfully');
      setShowDeleteAccountModal(false);
      await handleLogout();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete account');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabContainer, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'profile' && [styles.activeTab, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab('profile')}
        >
          <MaterialIcons name="person" size={20} color={activeTab === 'profile' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'profile' ? colors.primary : colors.textSecondary }]}>Profile</Text>
        </TouchableOpacity>


        {canAccessSalaryTab && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'salary' && [styles.activeTab, { borderBottomColor: colors.primary }]]}
            onPress={() => setActiveTab('salary')}
          >
            <MaterialIcons name="attach-money" size={20} color={activeTab === 'salary' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, { color: activeTab === 'salary' ? colors.primary : colors.textSecondary }]}>Salary</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'profile' && renderProfileTab({
          colors,
          tenant,
          currentUser,
          user,
          setShowChangePasswordModal,
          handleLogout,
          setShowDeleteAccountModal,
          InfoRow
        })}
        {activeTab === 'salary' && canAccessSalaryTab && renderSalaryTab({
          colors,
          salaryConfig,
          setSalaryConfig,
          salaryConfigLoading,
          salaryConfigSaving,
          handleSaveSalaryConfig
        })}

        {/* User Management for Superusers */}
        {canManageUsers && renderUserManagement({
          colors,
          users,
          usersLoading,
          user,
          handleToggleUserPermission
        })}
      </ScrollView>

      {/* Modals */}
      {renderChangePasswordModal({
        colors,
        showChangePasswordModal,
        setShowChangePasswordModal,
        changePasswordData,
        setChangePasswordData,
        handleChangePassword
      })}
      {renderDeleteAccountModal({
        colors,
        showDeleteAccountModal,
        setShowDeleteAccountModal,
        handleDeleteAccount
      })}
    </View>
  );
}

const renderProfileTab = ({
  colors,
  tenant,
  currentUser,
  user,
  setShowChangePasswordModal,
  handleLogout,
  setShowDeleteAccountModal,
  InfoRow
}: {
  colors: any;
  tenant: any;
  currentUser: any;
  user: any;
  setShowChangePasswordModal: (value: boolean) => void;
  handleLogout: () => void;
  setShowDeleteAccountModal: (value: boolean) => void;
  InfoRow: React.ComponentType<{ label: string; value: string; colors: any }>;
}) => {
  return (
    <View style={styles.tabContent}>
      {/* Company Information */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Company Information</Text>
        <InfoRow label="Company Name" value={tenant?.name || 'N/A'} colors={colors} />
        <InfoRow label="Subdomain" value={tenant?.subdomain || 'N/A'} colors={colors} />
        <InfoRow label="Credits" value={tenant?.credits?.toString() || '0'} colors={colors} />
      </View>

      {/* User Profile */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile Information</Text>
        <InfoRow label="Email" value={currentUser?.email || user?.email || 'N/A'} colors={colors} />
        <InfoRow label="Full Name" value={`${currentUser?.first_name || user?.first_name || ''} ${currentUser?.last_name || user?.last_name || ''}`.trim() || 'N/A'} colors={colors} />
        <InfoRow label="Role" value={currentUser?.role || user?.role || 'N/A'} colors={colors} />
      </View>

      {/* Account Actions */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Actions</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setShowChangePasswordModal(true)}
        >
          <View style={styles.settingLeft}>
            <FontAwesome name="lock" size={20} color={colors.text} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>Change Password</Text>
          </View>
          <FontAwesome name="chevron-right" size={16} color={colors.textLight} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => {
            Alert.alert(
              'Logout',
              'Are you sure you want to logout?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', style: 'destructive', onPress: handleLogout },
              ]
            );
          }}
        >
          <View style={styles.settingLeft}>
            <FontAwesome name="sign-out" size={20} color={colors.error || '#ef4444'} />
            <Text style={[styles.settingLabel, { color: colors.error || '#ef4444' }]}>Logout</Text>
          </View>
          <FontAwesome name="chevron-right" size={16} color={colors.textLight} />
        </TouchableOpacity>

        {(user?.is_superuser || user?.role === 'admin') && (
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setShowDeleteAccountModal(true)}
          >
            <View style={styles.settingLeft}>
              <FontAwesome name="trash" size={20} color={colors.error || '#ef4444'} />
              <Text style={[styles.settingLabel, { color: colors.error || '#ef4444' }]}>Delete Account</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={colors.textLight} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const renderSalaryTab = ({
  colors,
  salaryConfig,
  setSalaryConfig,
  salaryConfigLoading,
  salaryConfigSaving,
  handleSaveSalaryConfig
}: {
  colors: any;
  salaryConfig: any;
  setSalaryConfig: (config: any) => void;
  salaryConfigLoading: boolean;
  salaryConfigSaving: boolean;
  handleSaveSalaryConfig: () => void;
}) => {
  return (
    <View style={styles.tabContent}>
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Salary Configuration</Text>

        {salaryConfigLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Average Days Per Month</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={salaryConfig.average_days_per_month?.toString() || ''}
                onChangeText={(value) => {
                  const num = parseFloat(value);
                  if (!isNaN(num)) {
                    setSalaryConfig({ ...salaryConfig, average_days_per_month: num });
                  }
                }}
                keyboardType="numeric"
                placeholder="30.4"
                editable={!salaryConfigSaving}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Break Time (Hours)</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={salaryConfig.break_time?.toString() || ''}
                onChangeText={(value) => {
                  const num = parseFloat(value);
                  if (!isNaN(num)) {
                    setSalaryConfig({ ...salaryConfig, break_time: num });
                  }
                }}
                keyboardType="numeric"
                placeholder="0.5"
                editable={!salaryConfigSaving}
              />
            </View>

            <View style={styles.switchGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Weekly Absent Penalty</Text>
              <Switch
                value={salaryConfig.weekly_absent_penalty_enabled || false}
                onValueChange={(value) => setSalaryConfig({ ...salaryConfig, weekly_absent_penalty_enabled: value })}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="white"
                disabled={salaryConfigSaving}
              />
            </View>

            {salaryConfig.weekly_absent_penalty_enabled && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Absent Days Threshold</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  value={salaryConfig.weekly_absent_threshold?.toString() || ''}
                  onChangeText={(value) => {
                    const num = parseInt(value);
                    if (!isNaN(num)) {
                      setSalaryConfig({ ...salaryConfig, weekly_absent_threshold: num });
                    }
                  }}
                  keyboardType="numeric"
                  placeholder="4"
                  editable={!salaryConfigSaving}
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary, opacity: salaryConfigSaving ? 0.6 : 1 }]}
              onPress={handleSaveSalaryConfig}
              disabled={salaryConfigSaving}
            >
              {salaryConfigSaving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={[styles.saveButtonText, { color: 'white' }]}>Save Configuration</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const renderUserManagement = ({
  colors,
  users,
  usersLoading,
  user,
  handleToggleUserPermission
}: {
  colors: any;
  users: any[];
  usersLoading: boolean;
  user: any;
  handleToggleUserPermission: (userId: number, field: string, value: boolean) => void;
}) => {
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>User Management</Text>

      {usersLoading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : users.length > 0 ? (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={[styles.userItem, { borderBottomColor: colors.border }]}>
              <View style={styles.userInfo}>
                <Text style={[styles.userEmail, { color: colors.text }]}>{item.email}</Text>
                <Text style={[styles.userName, { color: colors.textSecondary }]}>
                  {item.first_name} {item.last_name}
                </Text>
              </View>

              <View style={styles.userPermissions}>
                <View style={styles.permissionRow}>
                  <Text style={[styles.permissionLabel, { color: colors.textSecondary }]}>Active</Text>
                  <Switch
                    value={item.is_active}
                    onValueChange={(value) => handleToggleUserPermission(item.id, 'is_active', value)}
                    disabled={item.id === user?.id}
                  />
                </View>

                <View style={styles.permissionRow}>
                  <Text style={[styles.permissionLabel, { color: colors.textSecondary }]}>Staff</Text>
                  <Switch
                    value={item.is_staff}
                    onValueChange={(value) => handleToggleUserPermission(item.id, 'is_staff', value)}
                    disabled={item.id === user?.id}
                  />
                </View>

                <View style={styles.permissionRow}>
                  <Text style={[styles.permissionLabel, { color: colors.textSecondary }]}>Superuser</Text>
                  <Switch
                    value={item.is_superuser}
                    onValueChange={(value) => handleToggleUserPermission(item.id, 'is_superuser', value)}
                    disabled={item.id === user?.id}
                  />
                </View>
              </View>
            </View>
          )}
        />
      ) : (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No users found</Text>
      )}
    </View>
  );
};

const renderChangePasswordModal = ({
  colors,
  showChangePasswordModal,
  setShowChangePasswordModal,
  changePasswordData,
  setChangePasswordData,
  handleChangePassword
}: {
  colors: any;
  showChangePasswordModal: boolean;
  setShowChangePasswordModal: (value: boolean) => void;
  changePasswordData: any;
  setChangePasswordData: (data: any) => void;
  handleChangePassword: () => void;
}) => {
  return (
    <Modal
      visible={showChangePasswordModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowChangePasswordModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Change Password</Text>
            <TouchableOpacity onPress={() => setShowChangePasswordModal(false)}>
              <FontAwesome name="times" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Current Password</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={changePasswordData.current_password}
                onChangeText={(value) => setChangePasswordData({ ...changePasswordData, current_password: value })}
                secureTextEntry
                placeholder="Enter current password"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>New Password</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={changePasswordData.new_password}
                onChangeText={(value) => setChangePasswordData({ ...changePasswordData, new_password: value })}
                secureTextEntry
                placeholder="Enter new password"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Confirm New Password</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={changePasswordData.confirm_password}
                onChangeText={(value) => setChangePasswordData({ ...changePasswordData, confirm_password: value })}
                secureTextEntry
                placeholder="Confirm new password"
              />
            </View>
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
              onPress={() => setShowChangePasswordModal(false)}
            >
              <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={handleChangePassword}
            >
              <Text style={[styles.modalButtonText, { color: 'white' }]}>Change Password</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const renderDeleteAccountModal = ({
  colors,
  showDeleteAccountModal,
  setShowDeleteAccountModal,
  handleDeleteAccount
}: {
  colors: any;
  showDeleteAccountModal: boolean;
  setShowDeleteAccountModal: (value: boolean) => void;
  handleDeleteAccount: () => void;
}) => {
  return (
    <Modal
      visible={showDeleteAccountModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowDeleteAccountModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delete Account</Text>
            <TouchableOpacity onPress={() => setShowDeleteAccountModal(false)}>
              <FontAwesome name="times" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.warningContainer}>
              <FontAwesome name="exclamation-triangle" size={48} color={colors.error || '#ef4444'} />
              <Text style={[styles.warningTitle, { color: colors.text }]}>Are you sure?</Text>
              <Text style={[styles.warningText, { color: colors.textSecondary }]}>
                This action cannot be undone. This will permanently delete your account and remove your data from our servers.
              </Text>
            </View>
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
              onPress={() => setShowDeleteAccountModal(false)}
            >
              <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.dangerButton, { backgroundColor: colors.error || '#ef4444' }]}
              onPress={handleDeleteAccount}
            >
              <Text style={[styles.modalButtonText, { color: 'white' }]}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

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
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  section: {
    marginBottom: 16,
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
    marginBottom: 16,
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  value: {
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  saveButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  userItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  userInfo: {
    marginBottom: 12,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  userName: {
    fontSize: 14,
  },
  userPermissions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  permissionRow: {
    alignItems: 'center',
    flex: 1,
  },
  permissionLabel: {
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    padding: 32,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    margin: 20,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
  },
  dangerButton: {
    backgroundColor: '#EF4444',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  warningContainer: {
    alignItems: 'center',
    padding: 20,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
