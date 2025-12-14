// Custom Drawer Content Component
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useRouter, usePathname } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { RootState } from '@/store';
import { logout } from '@/store/slices/authSlice';

// Logo from frontend
const LOGO_URL = 'https://raw.githubusercontent.com/sniperthink/hrms-client-ready/main/frontend-tally-dashboard/public/logo.png';

interface DrawerItemProps {
  icon: string;
  label: string;
  route: string;
  isActive: boolean;
  onPress: () => void;
  colors: any;
}

const DrawerItem = ({ icon, label, route, isActive, onPress, colors }: DrawerItemProps) => (
  <TouchableOpacity
    style={[
      styles.drawerItem,
      {
        backgroundColor: isActive ? `${colors.primary}15` : 'transparent',
        borderLeftWidth: isActive ? 3 : 0,
        borderLeftColor: colors.primary,
      },
    ]}
    onPress={onPress}
  >
    <FontAwesome
      name={icon as any}
      size={20}
      color={isActive ? colors.primary : colors.textSecondary}
      style={styles.drawerIcon}
    />
    <Text
      style={[
        styles.drawerLabel,
        {
          color: isActive ? colors.primary : colors.text,
          fontWeight: isActive ? '600' : 'normal',
        },
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

export default function CustomDrawer(props: any) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const { user, tenant } = useSelector((state: RootState) => state.auth);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const handleLogout = () => {
    dispatch(logout());
    router.replace('/(auth)/login');
  };

  const menuItems = [
    { icon: 'dashboard', label: 'Dashboard', route: '/(drawer)/' },
    { icon: 'users', label: 'Employees', route: '/(drawer)/employees' },
    { icon: 'calendar', label: 'Attendance', route: '/(drawer)/attendance' },
    { icon: 'dollar', label: 'Payroll', route: '/(drawer)/payroll' },
    { icon: 'calendar-check-o', label: 'Holidays', route: '/holidays' },
    { icon: 'group', label: 'Team', route: '/team' },
    { icon: 'upload', label: 'Upload', route: '/upload' },
    { icon: 'life-ring', label: 'Support', route: '/support' },
    { icon: 'cog', label: 'Settings', route: '/settings' },
    { icon: 'info-circle', label: 'About', route: '/(drawer)/about' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, alignItems: 'flex-start' }]}>
        {/* Company Logo */}
        <View style={styles.logoSection}>
          <Image
            source={{ uri: LOGO_URL }}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.logoText}>Analyse • Automate • Accelerate</Text>

        <View style={styles.divider} />

        {/* User Profile */}
        <View style={styles.userProfileContainer}>
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={styles.avatarText}>
              {user?.first_name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.userInfoContainer}>
            <Text style={styles.userName}>
              {user?.first_name} {user?.last_name}
            </Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>
      </View>

      {/* Menu Items */}
      <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            MAIN MENU
          </Text>
          {menuItems.slice(0, 4).map((item) => (
            <DrawerItem
              key={item.route}
              icon={item.icon}
              label={item.label}
              route={item.route}
              isActive={pathname === item.route || pathname.startsWith(item.route)}
              onPress={() => router.push(item.route as any)}
              colors={colors}
            />
          ))}
        </View>

        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

        <View style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            MANAGEMENT
          </Text>
          {menuItems.slice(4, 7).map((item) => (
            <DrawerItem
              key={item.route}
              icon={item.icon}
              label={item.label}
              route={item.route}
              isActive={pathname === item.route || pathname.startsWith(item.route)}
              onPress={() => router.push(item.route as any)}
              colors={colors}
            />
          ))}
        </View>

        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

        <View style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            OTHER
          </Text>
          {menuItems.slice(7).map((item) => (
            <DrawerItem
              key={item.route}
              icon={item.icon}
              label={item.label}
              route={item.route}
              isActive={pathname === item.route || pathname.startsWith(item.route)}
              onPress={() => router.push(item.route as any)}
              colors={colors}
            />
          ))}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: `${colors.error}15` }]}
          onPress={handleLogout}
        >
          <FontAwesome name="sign-out" size={18} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 35,
    paddingBottom: 20,
    paddingLeft: 15,
    paddingRight: 20,
    alignItems: 'flex-start',
  },
  logoSection: {
    alignItems: 'flex-start',
    marginBottom: 6,
    justifyContent: 'flex-start',
  },
  logoImage: {
    paddingTop: 10,
    width: 120,
    height: 50,
  },
  logoText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
    paddingLeft: 20,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 12,
    width: '100%',
  },
  userProfileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'white',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  userInfoContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tenantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  tenantText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
  menuContainer: {
    flex: 1,
    paddingTop: 8,
  },
  menuSection: {
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingVertical: 8,
    letterSpacing: 0.5,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  drawerIcon: {
    width: 24,
    marginRight: 16,
  },
  drawerLabel: {
    fontSize: 15,
  },
  menuDivider: {
    height: 1,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  footer: {
    borderTopWidth: 1,
    padding: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 10,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
