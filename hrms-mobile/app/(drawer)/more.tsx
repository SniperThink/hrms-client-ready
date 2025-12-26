// More/Settings Screen - Enhanced with all features
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logout } from '@/store/slices/authSlice';
import { authService } from '@/services/authService';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function MoreScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.logout();
              dispatch(logout());
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Logout error:', error);
              dispatch(logout());
              router.replace('/(auth)/login');
            }
          },
        },
      ]
    );
  };

  const menuSections = [
    {
      title: 'Management',
      items: [
        { icon: 'calendar-check-o', label: 'Leave Management', route: '/leaves', roles: ['admin', 'hr_manager'] },
        { icon: 'calendar', label: 'Holiday Management', route: '/holidays', roles: ['admin'] },
        { icon: 'users', label: 'Team Management', route: '/team', roles: ['admin'] },
        { icon: 'upload', label: 'Data Upload', route: '/upload', roles: ['admin', 'payroll_master'] },
      ],
    },
    {
      title: 'Account',
      items: [
        { icon: 'lock', label: 'PIN Authentication', route: '/pin-settings', roles: [] },
        { icon: 'cog', label: 'Settings', route: '/settings', roles: ['admin', 'hr_manager', 'payroll_master'] },
        { icon: 'question-circle', label: 'Support', route: '/support', roles: ['admin', 'hr_manager', 'payroll_master'] },
        { icon: 'info-circle', label: 'About', route: '/about', roles: [] },
      ],
    },
  ];

  const canAccess = (roles: string[]) => {
    if (roles.length === 0) return true;
    if (!user) return false;
    return roles.includes(user.role) || user.is_admin || user.is_superuser;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* User Info */}
      <View style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.userAvatar}>
          <FontAwesome name="user" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.userName, { color: colors.text }]}>
          {user?.first_name} {user?.last_name}
        </Text>
        <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
          {user?.email}
        </Text>
        <View style={[styles.roleBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.roleText}>{user?.role?.toUpperCase() || 'USER'}</Text>
        </View>
      </View>

      {/* Menu Sections */}
      {menuSections.map((section, sectionIndex) => (
        <View key={sectionIndex} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {section.title}
          </Text>
          {section.items
            .filter((item) => canAccess(item.roles))
            .map((item, itemIndex) => (
              <TouchableOpacity
                key={itemIndex}
                style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push(item.route as any)}
              >
                <FontAwesome name={item.icon as any} size={20} color={colors.text} />
                <Text style={[styles.menuText, { color: colors.text }]}>{item.label}</Text>
                <FontAwesome name="chevron-right" size={16} color={colors.textLight} />
              </TouchableOpacity>
            ))}
        </View>
      ))}

      {/* Logout Button */}
      <TouchableOpacity
        style={[styles.logoutButton, { backgroundColor: colors.error }]}
        onPress={handleLogout}
      >
        <FontAwesome name="sign-out" size={20} color="white" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  userCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  userAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 14,
    margin: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
