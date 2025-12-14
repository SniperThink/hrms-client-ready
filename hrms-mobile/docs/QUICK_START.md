# 🚀 HRMS Mobile App - Quick Start Guide

## 📱 Get Production-Ready in 4 Weeks

This guide will help you quickly implement all missing features to make the mobile app production-ready.

---

## ⚡ Quick Setup

### **1. Install Missing Dependencies**

```bash
cd hrms-mobile

# Charts
npm install react-native-chart-kit react-native-svg

# Offline support
npm install @react-native-async-storage/async-storage @react-native-community/netinfo

# Push notifications
expo install expo-notifications expo-device

# Toast notifications
npm install react-native-toast-message

# Utilities
npm install lodash @types/lodash --save-dev
```

### **2. Verify Current Setup**

```bash
# Start the app
npm start

# Test on iOS
npm run ios

# Test on Android
npm run android
```

---

## 🎯 Implementation Order (Priority-Based)

### **Phase 1: Critical Features** (Days 1-5)

#### **Day 1: Holiday Add Screen**

Create `app/holidays/add.tsx`:

```typescript
import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { holidayService } from '@/services/holidayService';

export default function AddHolidayScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter holiday name');
      return;
    }

    setLoading(true);
    try {
      await holidayService.createHoliday({
        name: name,
        date: date.toISOString().split('T')[0],
        description: description,
        applies_to_all: true,
      });
      Alert.alert('Success', 'Holiday added successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add holiday');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView>
      {/* Add your UI components here */}
      <TouchableOpacity onPress={handleSubmit} disabled={loading}>
        <Text>Add Holiday</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

#### **Day 2: Employee Edit Screen**

Create `app/employees/edit/[id].tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { employeeService } from '@/services/employeeService';

export default function EditEmployeeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    loadEmployee();
  }, [id]);

  const loadEmployee = async () => {
    try {
      const employee = await employeeService.getEmployee(Number(id));
      setFormData(employee);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load employee');
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await employeeService.updateEmployee(Number(id), formData);
      Alert.alert('Success', 'Employee updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView>
      {/* Add your UI components here */}
      <TouchableOpacity onPress={handleSubmit} disabled={loading}>
        <Text>Update Employee</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

#### **Day 3: Dashboard Charts**

Update `app/(tabs)/index.tsx` to add charts:

```typescript
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

// Add to your dashboard component:
<View style={styles.chartSection}>
  <Text style={styles.chartTitle}>Attendance Trend (Last 7 Days)</Text>
  <LineChart
    data={{
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        data: [85, 90, 88, 92, 87, 85, 0]
      }]
    }}
    width={screenWidth - 32}
    height={220}
    chartConfig={{
      backgroundColor: colors.primary,
      backgroundGradientFrom: colors.primary,
      backgroundGradientTo: colors.accent,
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
      style: {
        borderRadius: 16
      }
    }}
    bezier
    style={{
      marginVertical: 8,
      borderRadius: 16
    }}
  />
</View>
```

#### **Day 4-5: User Invitation & Team Management**

Create `app/team/invite.tsx`:

```typescript
import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { userService } from '@/services/userService';

export default function InviteUserScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !firstName.trim()) {
      Alert.alert('Error', 'Please fill required fields');
      return;
    }

    setLoading(true);
    try {
      await userService.inviteUser({
        email: email,
        first_name: firstName,
        last_name: lastName,
        role: role,
      });
      Alert.alert('Success', 'Invitation sent successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView>
      {/* Add your UI components here */}
      <TouchableOpacity onPress={handleSubmit} disabled={loading}>
        <Text>Send Invitation</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

---

### **Phase 2: Important Features** (Days 6-10)

#### **Day 6: Excel Upload - Attendance**

Create `app/upload/attendance.tsx`:

```typescript
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { attendanceService } from '@/services/attendanceService';

export default function AttendanceUploadScreen() {
  const [file, setFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      
      if (result.type === 'success') {
        setFile(result);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const uploadFile = async () => {
    if (!file) {
      Alert.alert('Error', 'Please select a file first');
      return;
    }

    setUploading(true);
    try {
      // Implement file upload logic
      // await attendanceService.bulkUpload(file);
      Alert.alert('Success', 'Attendance uploaded successfully');
      setFile(null);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload attendance');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View>
      <TouchableOpacity onPress={pickFile}>
        <Text>Pick Excel File</Text>
      </TouchableOpacity>
      
      {file && (
        <View>
          <Text>Selected: {file.name}</Text>
          <TouchableOpacity onPress={uploadFile} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator />
            ) : (
              <Text>Upload</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
```

#### **Day 7-8: Settings Screens**

Create `app/settings/profile.tsx`, `app/settings/password.tsx`, etc.

#### **Day 9-10: Loading States & Empty States**

Create reusable components:

```typescript
// components/LoadingSkeleton.tsx
export const LoadingSkeleton = () => {
  return (
    <View>
      {/* Add skeleton UI */}
    </View>
  );
};

// components/EmptyState.tsx
export const EmptyState = ({ icon, message, action }: any) => {
  return (
    <View>
      <FontAwesome name={icon} size={48} />
      <Text>{message}</Text>
      {action && <TouchableOpacity onPress={action.onPress}>
        <Text>{action.label}</Text>
      </TouchableOpacity>}
    </View>
  );
};
```

---

### **Phase 3: Enhancement Features** (Days 11-15)

#### **Day 11-12: Offline Support**

```typescript
// hooks/useOffline.ts
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export const useOffline = () => {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  return { isOffline };
};

// services/cacheService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const cacheService = {
  async set(key: string, data: any) {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  },
  
  async get(key: string) {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  },
  
  async remove(key: string) {
    await AsyncStorage.removeItem(key);
  },
  
  async clear() {
    await AsyncStorage.clear();
  },
};
```

#### **Day 13-14: Push Notifications**

```typescript
// services/notificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const notificationService = {
  async requestPermissions() {
    if (Device.isDevice) {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    }
    return false;
  },
  
  async getToken() {
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  },
  
  async scheduleNotification(title: string, body: string, data?: any) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: null, // Send immediately
    });
  },
};
```

#### **Day 15: Testing**

```bash
# Run tests
npm test

# Test on real devices
# iOS
npm run ios

# Android
npm run android
```

---

### **Phase 4: Production Build** (Days 16-20)

#### **Day 16: Production Configuration**

Update `app.json`:

```json
{
  "expo": {
    "name": "HRMS Mobile",
    "slug": "hrms-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0B5E59"
    },
    "ios": {
      "bundleIdentifier": "com.yourcompany.hrms",
      "buildNumber": "1"
    },
    "android": {
      "package": "com.yourcompany.hrms",
      "versionCode": 1
    }
  }
}
```

Create `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://your-production-api.com"
      }
    },
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    }
  }
}
```

#### **Day 17-18: Build & Test**

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production
```

#### **Day 19: Submit to Stores**

```bash
# Submit to App Store
eas submit --platform ios

# Submit to Google Play
eas submit --platform android
```

#### **Day 20: Documentation & Launch**

- Update README
- Create user guide
- Prepare marketing materials
- Launch! 🚀

---

## 📝 Quick Reference

### **Common Commands**

```bash
# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Clear cache
npx expo start -c

# Build for production
eas build --platform all --profile production

# Submit to stores
eas submit --platform all
```

### **Useful Links**

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Guidelines](https://play.google.com/about/developer-content-policy/)

---

## 🎯 Success Checklist

- [ ] All features implemented
- [ ] All screens tested
- [ ] Offline mode working
- [ ] Push notifications working
- [ ] Performance optimized
- [ ] Build successful
- [ ] Submitted to stores
- [ ] Documentation complete

---

## 🚀 Ready to Start?

1. **Install dependencies** (see above)
2. **Pick a feature** from Phase 1
3. **Implement it** following the examples
4. **Test it** on real devices
5. **Move to next feature**
6. **Repeat until complete**

**You've got this! Let's build something amazing! 💪**

---

**Last Updated**: December 14, 2025  
**Version**: 1.0  
**Status**: ✅ Ready to Use
