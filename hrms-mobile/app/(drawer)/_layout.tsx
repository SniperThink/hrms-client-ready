import React from 'react';
import { Drawer } from 'expo-router/drawer';
import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { RootState } from '@/store';
import CustomDrawer from '@/components/CustomDrawer';

export default function DrawerLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const insets = useSafeAreaInsets();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => <CustomDrawer {...props} />}
        screenOptions={{
          drawerStyle: {
            width: 280,
          },
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: 'white',
          headerTitleStyle: {
            fontWeight: '600',
          },
          drawerActiveTintColor: colors.primary,
          drawerInactiveTintColor: colors.textSecondary,
        }}
      >
        <Drawer.Screen
          name="index"
          options={{
            drawerLabel: 'Dashboard',
            title: 'Dashboard',
            headerShown: true,
          }}
        />
        <Drawer.Screen
          name="employees"
          options={{
            drawerLabel: 'Employees',
            title: 'Employees',
            headerShown: true,
          }}
        />
        <Drawer.Screen
          name="attendance"
          options={{
            drawerLabel: 'Attendance',
            title: 'Attendance',
            headerShown: true,
          }}
        />
        <Drawer.Screen
          name="payroll"
          options={{
            drawerLabel: 'Payroll',
            title: 'Payroll',
            headerShown: true,
          }}
        />
        <Drawer.Screen
          name="more"
          options={{
            drawerLabel: 'More',
            title: 'More',
            headerShown: true,
          }}
        />
        <Drawer.Screen
          name="about"
          options={{
            drawerLabel: 'About',
            title: 'About',
            headerShown: true,
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
