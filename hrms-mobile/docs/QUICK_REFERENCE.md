# 📱 HRMS Mobile App - Quick Reference Guide

**Last Updated**: December 14, 2025, 7:55 PM IST

---

## 🚀 Quick Start

### **Install Dependencies**
```bash
cd hrms-mobile

# Install all dependencies
npm install

# Install chart library
npm install react-native-chart-kit react-native-svg

# Install file picker
expo install expo-document-picker

# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

---

## 📁 Project Structure

```
hrms-mobile/
├── app/                          # Screens (Expo Router)
│   ├── (auth)/                  # Auth screens
│   ├── (tabs)/                  # Main tab screens
│   ├── employees/               # Employee management
│   ├── attendance/              # Attendance screens
│   ├── payroll/                 # Payroll screens
│   ├── holidays/                # Holiday management
│   ├── team/                    # Team management
│   └── upload/                  # Upload screens
│
├── components/                   # Reusable components
│   ├── charts/                  # Chart components
│   ├── LoadingSkeleton.tsx      # Loading states
│   ├── EmptyState.tsx           # Empty states
│   └── ErrorBoundary.tsx        # Error handling
│
├── services/                     # API services
│   ├── api.ts                   # API client
│   ├── authService.ts           # Authentication
│   ├── employeeService.ts       # Employee APIs
│   ├── attendanceService.ts     # Attendance APIs
│   └── payrollService.ts        # Payroll APIs
│
├── store/                        # Redux store
│   ├── slices/                  # Redux slices
│   └── hooks.ts                 # Typed hooks
│
└── constants/                    # Constants
    ├── Colors.ts                # Theme colors
    └── Config.ts                # API config
```

---

## 🎨 Using Components

### **Charts**
```typescript
import AttendanceTrendChart from '@/components/charts/AttendanceTrendChart';
import DepartmentChart from '@/components/charts/DepartmentChart';
import EmployeeStatusChart from '@/components/charts/EmployeeStatusChart';

// Use in your screen
<AttendanceTrendChart />
<DepartmentChart />
<EmployeeStatusChart activeCount={85} inactiveCount={15} />
```

### **Loading States**
```typescript
import LoadingSkeleton, { ListItemSkeleton, CardSkeleton } from '@/components/LoadingSkeleton';

// Simple skeleton
<LoadingSkeleton width="100%" height={20} />

// List item skeleton
{loading ? <ListItemSkeleton /> : <ActualListItem />}

// Card skeleton
{loading ? <CardSkeleton /> : <ActualCard />}
```

### **Empty States**
```typescript
import EmptyState from '@/components/EmptyState';

<EmptyState
  icon="inbox"
  title="No items found"
  message="Try adjusting your filters"
  actionLabel="Add New"
  onAction={() => router.push('/add')}
/>
```

### **Error Boundary**
```typescript
import ErrorBoundary from '@/components/ErrorBoundary';

// Wrap your app or specific components
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

---

## 🔌 API Services

### **Employee Service**
```typescript
import { employeeService } from '@/services/employeeService';

// Get employees (paginated)
const employees = await employeeService.getEmployees(page, search, department);

// Get employee by ID
const employee = await employeeService.getEmployeeById(id);

// Create employee
const newEmployee = await employeeService.createEmployee(data);

// Update employee
const updated = await employeeService.updateEmployee(id, data);

// Delete employee
await employeeService.deleteEmployee(id);
```

### **Attendance Service**
```typescript
import { attendanceService } from '@/services/attendanceService';

// Get daily attendance
const attendance = await attendanceService.getDailyAttendance(page, month);

// Mark attendance
await attendanceService.markAttendance(data);
```

### **Payroll Service**
```typescript
import { payrollService } from '@/services/payrollService';

// Get payroll periods
const periods = await payrollService.getPayrollPeriods();

// Get calculated salaries
const salaries = await payrollService.getCalculatedSalaries(periodId, page);

// Calculate payroll
await payrollService.calculatePayroll(periodId, forceRecalculate);
```

---

## 🎨 Theme Colors

```typescript
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

const colorScheme = useColorScheme();
const colors = Colors[colorScheme ?? 'light'];

// Available colors:
colors.primary      // #0B5E59 (Teal)
colors.accent       // #C2E812 (Lime)
colors.success      // Green
colors.error        // Red
colors.warning      // Orange
colors.info         // Blue
colors.background   // White/Dark
colors.surface      // Card background
colors.text         // Primary text
colors.textSecondary // Secondary text
colors.textLight    // Light text
colors.border       // Border color
```

---

## 🧭 Navigation

```typescript
import { useRouter } from 'expo-router';

const router = useRouter();

// Navigate to screen
router.push('/employees/add');
router.push(`/employees/${id}`);
router.push('/payroll/advance');

// Go back
router.back();

// Replace current screen
router.replace('/login');

// Navigate with params
router.push({
  pathname: '/employees/edit/[id]',
  params: { id: '123' }
});
```

---

## 📦 Redux Store

```typescript
import { useAppDispatch, useAppSelector } from '@/store/hooks';

// Get state
const { user, tenant } = useAppSelector((state) => state.auth);
const { employees, isLoading } = useAppSelector((state) => state.employees);

// Dispatch actions
const dispatch = useAppDispatch();
dispatch(setEmployees(data));
dispatch(setLoading(true));
```

---

## 🔐 Authentication

```typescript
import { authService } from '@/services/authService';

// Login
const response = await authService.login(email, password, subdomain);

// Signup
await authService.signup(userData);

// Logout
await authService.logout();

// Refresh token
const newToken = await authService.refreshToken();
```

---

## 📱 Screen Examples

### **List Screen Pattern**
```typescript
export default function ListScreen() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await service.getData();
      setData(result);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) return <ListItemSkeleton />;
  if (data.length === 0) return <EmptyState />;

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
    />
  );
}
```

### **Form Screen Pattern**
```typescript
export default function FormScreen() {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!formData.required) {
      Alert.alert('Error', 'Required field missing');
      return;
    }

    setLoading(true);
    try {
      await service.create(formData);
      Alert.alert('Success', 'Created successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView>
      <TextInput
        value={formData.field}
        onChangeText={(text) => setFormData({ ...formData, field: text })}
      />
      <TouchableOpacity onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator /> : <Text>Submit</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}
```

---

## 🐛 Common Issues & Solutions

### **Issue: Charts not displaying**
```bash
# Solution: Install dependencies
npm install react-native-chart-kit react-native-svg
npx expo start -c
```

### **Issue: File picker not working**
```bash
# Solution: Install expo-document-picker
expo install expo-document-picker
```

### **Issue: TypeScript errors**
```bash
# Solution: Check service method names
# Use getEmployeeById not getEmployee
# Use correct method signatures from services
```

### **Issue: API calls failing**
```typescript
// Solution: Check API_URL in constants/Config.ts
export const API_URL = 'https://your-api-url.com';
```

---

## 📊 Performance Tips

1. **Use pagination** for large lists
2. **Implement pull-to-refresh** on all list screens
3. **Show loading skeletons** instead of spinners
4. **Cache data** when appropriate
5. **Optimize images** (use proper sizes)
6. **Lazy load** components when possible

---

## ✅ Testing Checklist

- [ ] Login/Logout works
- [ ] Employee CRUD operations work
- [ ] Attendance marking works
- [ ] Payroll viewing works
- [ ] Charts display correctly
- [ ] Loading states show properly
- [ ] Empty states display when no data
- [ ] Error handling works
- [ ] Navigation flows correctly
- [ ] Pull-to-refresh works
- [ ] File upload works

---

## 🚀 Deployment

### **Build for iOS**
```bash
eas build --platform ios --profile production
```

### **Build for Android**
```bash
eas build --platform android --profile production
```

### **Submit to Stores**
```bash
eas submit --platform ios
eas submit --platform android
```

---

## 📞 Support

- **Documentation**: See `IMPLEMENTATION_STATUS.md`
- **Completed Features**: See `COMPLETED_IMPLEMENTATIONS.md`
- **Roadmap**: See `IMPLEMENTATION_ROADMAP.md`

---

**Happy Coding! 🎉**
