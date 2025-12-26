# Mobile App Scaffolding Prompt for HRMS Tally Dashboard

## 📱 Project Overview

Create a **React Native mobile application** (or Flutter alternative) that mirrors the existing HRMS web application functionality. The mobile app should maintain the same API structure, authentication flow, UI/UX patterns, and business logic as the web application.

---

## 🏗️ Architecture & Tech Stack

### Recommended Stack
- **Framework**: React Native (Expo) or Flutter
- **State Management**: Redux Toolkit / Zustand (React Native) or Provider/Riverpod (Flutter)
- **Navigation**: React Navigation v6 (React Native) or GoRouter (Flutter)
- **HTTP Client**: Axios with interceptors
- **UI Library**: React Native Paper / NativeBase (React Native) or Material Design 3 (Flutter)
- **Charts**: react-native-chart-kit / Victory Native (React Native) or fl_chart (Flutter)
- **Date Handling**: date-fns (same as web)
- **Icons**: react-native-vector-icons / lucide-react-native (React Native) or Material Icons (Flutter)
- **Storage**: AsyncStorage / MMKV (React Native) or SharedPreferences / Hive (Flutter)
- **Forms**: React Hook Form + Yup (React Native) or FormBuilder (Flutter)

### Architecture Pattern
- **Multi-tenant architecture** with tenant subdomain header (`X-Tenant-Subdomain`)
- **JWT-based authentication** with automatic token refresh
- **Single session enforcement** (detect and handle concurrent logins)
- **Progressive data loading** for large lists (employees, attendance, payroll)
- **Offline-first approach** with local caching and sync

---

## 🔐 Authentication System

### Authentication Flow
1. **Login Screen**
   - Email + Password input
   - Forgot Password link
   - Multi-tenant login (auto-detects tenant from email domain)

2. **Signup Flow**
   - Company registration (creates tenant)
   - Subdomain selection
   - Admin user creation
   - Email verification

3. **Token Management**
   - Store `access` and `refresh` tokens in secure storage
   - Store `session_key` for session management
   - Store `tenant` object (subdomain, name, access_url)
   - Store `user` object (role, permissions, email)
   - Automatic token refresh on 401 errors
   - Token refresh endpoint: `POST /api/auth/refresh/`

4. **Session Management**
   - Single session enforcement (logout other devices on new login)
   - Handle `forcedLogout` events via SSE (Server-Sent Events)
   - Show session conflict modal when another device logs in
   - Inactivity timeout with warning modal

5. **Password Reset**
   - Request OTP: `POST /api/password-reset/request/`
   - Verify OTP: `POST /api/password-reset/verify/`
   - Reset Password: `POST /api/password-reset/reset/`
   - Change Password: `POST /api/password-reset/change/`

### API Endpoints
```
POST /api/public/login/          - Public login (auto-detects tenant)
POST /api/public/signup/         - Tenant signup
POST /api/auth/refresh/          - Refresh JWT token
POST /api/auth/logout/           - Logout (invalidate session)
GET  /api/user/profile/          - Get current user profile
```

### Headers Required
```javascript
{
  "Authorization": "Bearer <access_token>",
  "X-Tenant-Subdomain": "<tenant_subdomain>",
  "Content-Type": "application/json"
}
```

---

## 📊 Data Models & API Structure

### Core Models

#### 1. **Tenant Model**
```typescript
interface Tenant {
  id: number;
  name: string;
  subdomain: string;
  access_url: string;
  credits: number;
  is_active: boolean;
  weekly_absent_penalty_enabled: boolean;
  weekly_absent_penalty_days: number;
}
```

#### 2. **User Model**
```typescript
interface CustomUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'hr_manager' | 'payroll_master' | 'supervisor' | 'employee';
  is_superuser: boolean;
  is_admin: boolean;
  tenant: Tenant;
  email_verified: boolean;
  permissions: UserPermissions;
  phone_number?: string;
  department?: string;
}
```

#### 3. **Employee Profile**
```typescript
interface EmployeeProfile {
  id: number;
  employee_id: string;
  first_name: string;
  last_name?: string;
  mobile_number?: string;
  email?: string;
  date_of_birth?: string;
  marital_status?: 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  nationality?: string;
  address?: string;
  city?: string;
  state?: string;
  department?: string;
  designation?: string;
  employment_type?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
  date_of_joining?: string;
  location_branch?: string;
  shift_start_time: string;  // "09:00"
  shift_end_time: string;      // "18:00"
  basic_salary: number;
  tds_percentage?: number;
  off_monday: boolean;
  off_tuesday: boolean;
  off_wednesday: boolean;
  off_thursday: boolean;
  off_friday: boolean;
  off_saturday: boolean;
  off_sunday: boolean;
  is_active: boolean;
  ot_charge_per_hour?: number;
  weekly_rules_enabled: boolean;
}
```

#### 4. **Daily Attendance**
```typescript
interface DailyAttendance {
  id: number;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  employment_type: string;
  attendance_status: 'PRESENT' | 'ABSENT' | 'UNMARKED' | 'HALF_DAY' | 'PAID_LEAVE' | 'OFF';
  date: string;  // YYYY-MM-DD
  check_in?: string;  // HH:mm
  check_out?: string;  // HH:mm
  working_hours?: number;
  time_status?: 'ON_TIME' | 'LATE';
  ot_hours: number;
  late_minutes: number;
}
```

#### 5. **Calculated Salary**
```typescript
interface CalculatedSalary {
  id: number;
  payroll_period: number;  // PayrollPeriod ID
  employee_id: string;
  employee_name: string;
  department?: string;
  basic_salary: number;
  basic_salary_per_hour: number;
  employee_ot_rate: number;
  employee_tds_rate: number;
  total_working_days: number;
  present_days: number;
  absent_days: number;
  holiday_days: number;
  weekly_penalty_days: number;
  ot_hours: number;
  late_minutes: number;
  salary_for_present_days: number;
  ot_charges: number;
  late_deduction: number;
  incentive: number;
  gross_salary: number;
  tds_amount: number;
  salary_after_tds: number;
  total_advance_balance: number;
  advance_deduction_amount: number;
  advance_deduction_editable: boolean;
  remaining_advance_balance: number;
  net_payable: number;
  is_paid: boolean;
  payment_date?: string;
}
```

#### 6. **Payroll Period**
```typescript
interface PayrollPeriod {
  id: number;
  year: number;
  month: string;  // "January", "February", etc.
  data_source: 'UPLOADED' | 'FRONTEND' | 'HYBRID';
  is_locked: boolean;
  working_days_in_month: number;
  tds_rate: number;
}
```

#### 7. **Holiday**
```typescript
interface Holiday {
  id: number;
  name: string;
  date: string;  // YYYY-MM-DD
  is_recurring: boolean;
  description?: string;
}
```

#### 8. **Leave**
```typescript
interface Leave {
  id: number;
  employee: number;  // EmployeeProfile ID
  leave_type: 'SICK' | 'CASUAL' | 'EARNED' | 'LOP' | 'OTHER';
  start_date: string;
  end_date: string;
  days: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  applied_at: string;
}
```

---

## 🔌 Complete API Endpoints

### Authentication Endpoints
```
POST   /api/public/login/                    - Public login
POST   /api/public/signup/                    - Tenant signup
POST   /api/auth/register/                    - Register user
POST   /api/auth/refresh/                     - Refresh token
POST   /api/auth/logout/                      - Logout
GET    /api/user/profile/                     - Get user profile
POST   /api/password-reset/request/           - Request password reset OTP
POST   /api/password-reset/verify/            - Verify OTP
POST   /api/password-reset/reset/            - Reset password
POST   /api/password-reset/change/            - Change password
GET    /api/verify-email/<token>/              - Verify email
POST   /api/resend-verification/              - Resend verification email
```

### Dashboard Endpoints
```
GET    /api/dashboard/stats/                 - Dashboard statistics
```

### Employee Management
```
GET    /api/employees/                        - List employees (paginated)
POST   /api/employees/                        - Create employee
GET    /api/employees/{id}/                   - Get employee details
PATCH  /api/employees/{id}/                   - Update employee
DELETE /api/employees/{id}/                   - Delete employee
GET    /api/employees/stats/                  - Employee statistics
GET    /api/employees/get_directory_data/     - Get directory data (progressive loading)
GET    /api/employees/{id}/get_employee_details/ - Get detailed employee info
PATCH  /api/employees/{id}/update_employee_details/ - Update employee details
```

### Attendance Management
```
GET    /api/attendance/                       - List attendance records
POST   /api/attendance/                       - Create attendance record
GET    /api/attendance/{id}/                  - Get attendance record
PATCH  /api/attendance/{id}/                  - Update attendance
DELETE /api/attendance/{id}/                  - Delete attendance
GET    /api/attendance/stats/                 - Attendance statistics
GET    /api/attendance/get_attendance_data/   - Get attendance data (progressive)
GET    /api/daily-attendance/                 - List daily attendance
POST   /api/daily-attendance/                 - Create daily attendance
PATCH  /api/daily-attendance/{id}/            - Update daily attendance
```

### Payroll & Salary
```
GET    /api/salary-data/                      - List salary data
POST   /api/salary-data/                      - Create salary data
GET    /api/salary-data/stats/                - Salary statistics
GET    /api/salary-data/get_payroll_data/     - Get payroll data (progressive)
GET    /api/payroll/monthly/                  - Monthly payroll summary
GET    /api/payroll-periods/                  - List payroll periods
POST   /api/payroll-periods/                  - Create payroll period
GET    /api/calculated-salaries/              - List calculated salaries
POST   /api/calculated-salaries/              - Create calculated salary
PATCH  /api/calculated-salaries/{id}/         - Update calculated salary
GET    /api/advance-payments/                 - List advance payments
POST   /api/advance-payments/                 - Create advance payment
```

### Leave Management
```
GET    /api/leaves/                           - List leaves
POST   /api/leaves/                           - Create leave request
GET    /api/leaves/{id}/                      - Get leave details
PATCH  /api/leaves/{id}/                      - Update leave (approve/reject)
GET    /api/leaves/stats/                     - Leave statistics
GET    /api/leaves/get_leave_data/             - Get leave data (progressive)
```

### Holiday Management
```
GET    /api/holidays/                         - List holidays
POST   /api/holidays/                         - Create holiday
GET    /api/holidays/{id}/                    - Get holiday
PATCH  /api/holidays/{id}/                    - Update holiday
DELETE /api/holidays/{id}/                    - Delete holiday
POST   /api/holidays/check_date/               - Check if date is holiday
GET    /api/holidays/upcoming/                - Get upcoming holidays
GET    /api/holidays/by_month/                - Get holidays by month
```

### User & Team Management
```
GET    /api/user-invitations/                - List users/invitations
POST   /api/user-invitations/                 - Invite user
GET    /api/user-invitations/{id}/            - Get user details
PATCH  /api/user-invitations/{id}/           - Update user
DELETE /api/user-invitations/{id}/            - Delete user
GET    /api/user-invitations/{id}/permissions/ - Get user permissions
PATCH  /api/user-invitations/{id}/permissions/ - Update permissions
POST   /api/invitations/send-invitation/      - Send invitation
POST   /api/accept-invitation/                - Accept invitation
POST   /api/validate-invitation-token/        - Validate invitation token
```

### File Operations
```
GET    /api/download-template/                - Download Excel template
POST   /api/upload-salary/                    - Upload salary Excel file
```

### Tenant Settings
```
GET    /api/tenant/settings/                  - Get tenant settings
PATCH  /api/tenant/settings/                 - Update tenant settings
GET    /api/tenant/users/                    - Get tenant users
GET    /api/tenant/credits/                  - Get tenant credits
```

### Super Admin Endpoints
```
GET    /api/super-admin/stats/                - Super admin dashboard stats
GET    /api/super-admin/tenants/              - List all tenants
POST   /api/super-admin/tenants/{id}/credits/ - Update tenant credits
POST   /api/super-admin/tenants/{id}/login/   - Login as tenant
GET    /api/super-admin/support/tickets/      - List support tickets
PATCH  /api/super-admin/support/tickets/{id}/status/ - Update ticket status
POST   /api/super-admin/restore-session/      - Restore super admin session
```

### Support Tickets
```
GET    /api/support/tickets/                  - List support tickets
POST   /api/support/tickets/                 - Create support ticket
GET    /api/support/tickets/{id}/             - Get ticket details
PATCH  /api/support/tickets/{id}/            - Update ticket
```

### Reports & Export
```
GET    /api/reports/                          - Generate reports
GET    /api/reports/export/                   - Export data
```

### Cache Management
```
GET    /api/cache/                            - Get cache stats
DELETE /api/cache/                            - Clear cache
```

---

## 🎨 UI/UX Design System

### Color Palette
```typescript
const colors = {
  primary: '#0B5E59',        // Teal (main brand color)
  primaryDark: '#074E49',    // Dark teal (hover/active states)
  accent: '#C2E812',         // Lime green (highlights, active items)
  background: '#FFFFFF',      // White background
  surface: '#F8F9FA',        // Light gray for cards
  text: {
    primary: '#1F2937',      // Dark gray text
    secondary: '#6B7280',     // Medium gray text
    light: '#9CA3AF',         // Light gray text
  },
  border: '#E5E7EB',         // Border color
  error: '#EF4444',          // Red for errors
  warning: '#F59E0B',        // Orange for warnings
  success: '#10B981',        // Green for success
  info: '#3B82F6',           // Blue for info
};
```

### Typography
- **Font Family**: Poppins (same as web)
- **Font Weights**: 300 (Light), 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
- **Font Sizes**: 
  - Display: 32px (titles)
  - Heading: 24px (section headers)
  - Subheading: 18px
  - Body: 16px
  - Caption: 14px
  - Small: 12px

### Component Patterns

#### 1. **Sidebar Navigation** (Mobile: Bottom Tab Bar)
- Teal background (#0B5E59)
- Active item: Dark teal (#074E49) with lime accent (#C2E812)
- Icons from Lucide React
- Role-based menu filtering

#### 2. **Cards**
- White background
- Rounded corners (12px)
- Shadow: subtle elevation
- Padding: 16px

#### 3. **Buttons**
- Primary: Teal background (#0B5E59), white text
- Secondary: White background, teal border, teal text
- Accent: Lime green (#C2E812) for CTAs
- Disabled: Gray background, reduced opacity

#### 4. **Input Fields**
- Rounded borders (8px)
- Border color: #E5E7EB
- Focus: Teal border (#0B5E59)
- Error: Red border (#EF4444)
- Placeholder: Light gray (#9CA3AF)

#### 5. **Tables/Lists**
- Alternating row colors
- Thin scrollbars (custom styled)
- Sticky headers
- Pull-to-refresh

#### 6. **Charts**
- Use Chart.js / Recharts equivalent
- Teal color scheme
- Responsive sizing

#### 7. **Modals**
- Backdrop overlay (semi-transparent)
- Centered modal
- Rounded corners (16px)
- Close button (X icon)

#### 8. **Loading States**
- Skeleton loaders (matching web)
- Progressive loading indicators
- Pull-to-refresh

---

## 📱 Screen Structure

### Navigation Hierarchy

#### 1. **Auth Stack**
- Login Screen
- Signup Screen
- Forgot Password Screen
- Change Password Screen
- Accept Invitation Screen
- Email Verification Screen

#### 2. **Main App Stack** (Tab Navigator)

**Tab 1: Overview**
- Dashboard/Overview Screen
  - Stats cards (Total Employees, Total Salary, Attendance Rate, etc.)
  - Charts (Salary trends, Department distribution)
  - Quick actions

**Tab 2: Employees**
- Employee Directory (List)
- Employee Details Screen
- Add/Edit Employee Screen
- Employee Stats

**Tab 3: Attendance**
- Attendance Tracker (Calendar view)
- Attendance Log (List view)
- Daily Attendance Entry
- Attendance Stats

**Tab 4: Payroll**
- Payroll Overview
- Monthly Payroll List
- Calculated Salary Details
- Advance Payment Manager
- Payroll Periods

**Tab 5: More** (Settings menu)
- Leave Management
- Holiday Management
- Team Management (User Invitations)
- Settings
- Support
- Super Admin (if superuser)

---

## 🔄 State Management Structure

### Redux Store Structure (React Native) / State (Flutter)
```typescript
interface AppState {
  auth: {
    user: CustomUser | null;
    tenant: Tenant | null;
    accessToken: string | null;
    refreshToken: string | null;
    sessionKey: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
  };
  employees: {
    list: EmployeeProfile[];
    selectedEmployee: EmployeeProfile | null;
    stats: EmployeeStats | null;
    loading: boolean;
    pagination: PaginationState;
  };
  attendance: {
    dailyRecords: DailyAttendance[];
    monthlySummary: MonthlyAttendanceSummary | null;
    stats: AttendanceStats | null;
    loading: boolean;
    selectedDate: string | null;
  };
  payroll: {
    periods: PayrollPeriod[];
    calculatedSalaries: CalculatedSalary[];
    selectedPeriod: PayrollPeriod | null;
    stats: PayrollStats | null;
    loading: boolean;
  };
  leaves: {
    list: Leave[];
    stats: LeaveStats | null;
    loading: boolean;
  };
  holidays: {
    list: Holiday[];
    upcoming: Holiday[];
    loading: boolean;
  };
  users: {
    list: CustomUser[];
    invitations: Invitation[];
    loading: boolean;
  };
  settings: {
    tenantSettings: TenantSettings | null;
    loading: boolean;
  };
  cache: {
    lastSync: string | null;
    offlineQueue: OfflineAction[];
  };
}
```

---

## 🛠️ Key Features to Implement

### 1. **Progressive Data Loading**
- Implement pagination for large lists (employees, attendance, payroll)
- Use infinite scroll / load more pattern
- Cache loaded data locally
- Show skeleton loaders during fetch

### 2. **Offline Support**
- Cache API responses locally
- Queue actions when offline
- Sync when connection restored
- Show offline indicator

### 3. **Push Notifications** (Optional)
- Attendance reminders
- Leave approval/rejection
- Payroll notifications
- Support ticket updates

### 4. **Biometric Authentication** (Optional)
- Face ID / Touch ID for quick login
- Secure token storage

### 5. **Dark Mode** (Optional)
- Follow system theme
- Custom dark theme matching web

### 6. **Excel Export/Import**
- Export attendance/payroll to Excel
- Import employee data from Excel
- Use libraries: `xlsx` (React Native) or `excel` (Flutter)

### 7. **Charts & Visualizations**
- Salary trends (line chart)
- Department distribution (pie/bar chart)
- Attendance calendar (heatmap)
- Payroll summary (bar chart)

### 8. **Search & Filters**
- Global search for employees
- Filter by department, date range, status
- Save filter preferences

### 9. **Form Validation**
- Real-time validation
- Error messages
- Required field indicators
- Password strength indicator

### 10. **Image Handling** (If needed)
- Profile picture upload
- Document attachments
- Image compression

---

## 🔒 Security Requirements

1. **Secure Storage**
   - Use secure storage for tokens (not AsyncStorage)
   - Encrypt sensitive data
   - Clear storage on logout

2. **Certificate Pinning** (Production)
   - Pin SSL certificates
   - Prevent MITM attacks

3. **Token Refresh**
   - Automatic refresh before expiry
   - Handle refresh failures gracefully
   - Logout on refresh failure

4. **Session Management**
   - Detect concurrent logins
   - Show session conflict modal
   - Handle forced logout

5. **Input Sanitization**
   - Validate all inputs
   - Prevent SQL injection (handled by backend)
   - XSS prevention

---

## 📦 Required Libraries

### React Native
```json
{
  "dependencies": {
    "@react-navigation/native": "^6.1.0",
    "@react-navigation/bottom-tabs": "^6.5.0",
    "@react-navigation/stack": "^6.3.0",
    "react-native-safe-area-context": "^4.7.0",
    "react-native-screens": "^3.25.0",
    "axios": "^1.6.0",
    "@reduxjs/toolkit": "^2.0.0",
    "react-redux": "^9.0.0",
    "react-native-paper": "^5.11.0",
    "react-native-vector-icons": "^10.0.0",
    "react-native-chart-kit": "^6.12.0",
    "date-fns": "^3.3.0",
    "react-hook-form": "^7.49.0",
    "yup": "^1.3.0",
    "@react-native-async-storage/async-storage": "^1.21.0",
    "react-native-mmkv": "^2.10.0",
    "react-native-gesture-handler": "^2.14.0",
    "react-native-reanimated": "^3.6.0",
    "xlsx": "^0.18.5"
  }
}
```

### Flutter
```yaml
dependencies:
  flutter:
    sdk: flutter
  provider: ^6.1.0
  dio: ^5.4.0
  go_router: ^13.0.0
  flutter_riverpod: ^2.4.0
  shared_preferences: ^2.2.0
  hive: ^2.2.0
  hive_flutter: ^1.1.0
  flutter_charts: ^0.12.0
  intl: ^0.19.0
  excel: ^2.1.0
  image_picker: ^1.0.0
  flutter_secure_storage: ^9.0.0
```

---

## 🚀 Implementation Checklist

### Phase 1: Foundation
- [ ] Project setup (React Native/Flutter)
- [ ] Navigation structure
- [ ] API service layer with interceptors
- [ ] Authentication flow (login, signup, token management)
- [ ] Secure storage setup
- [ ] State management setup
- [ ] Theme/Design system

### Phase 2: Core Features
- [ ] Dashboard/Overview screen
- [ ] Employee management (list, details, add/edit)
- [ ] Attendance tracking (calendar, log, entry)
- [ ] Payroll overview and details
- [ ] Leave management
- [ ] Holiday management

### Phase 3: Advanced Features
- [ ] User/Team management
- [ ] Settings screen
- [ ] Support tickets
- [ ] Reports & export
- [ ] Super admin dashboard (if applicable)
- [ ] Progressive loading
- [ ] Offline support

### Phase 4: Polish
- [ ] Error handling & user feedback
- [ ] Loading states & skeletons
- [ ] Form validation
- [ ] Search & filters
- [ ] Charts & visualizations
- [ ] Push notifications (optional)
- [ ] Biometric auth (optional)
- [ ] Dark mode (optional)

---

## 📝 API Response Examples

### Login Response
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "session_key": "abc123...",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "admin",
    "is_superuser": false,
    "is_admin": true,
    "email_verified": true
  },
  "tenant": {
    "id": 1,
    "name": "Example Company",
    "subdomain": "example",
    "access_url": "https://example.hrms.com"
  }
}
```

### Employee List Response (Paginated)
```json
{
  "count": 150,
  "next": "http://api.example.com/api/employees/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "employee_id": "EMP001",
      "first_name": "John",
      "last_name": "Doe",
      "department": "Engineering",
      "designation": "Software Engineer",
      "basic_salary": "50000.00",
      "is_active": true
    }
  ]
}
```

### Dashboard Stats Response
```json
{
  "total_employees": 150,
  "active_employees": 145,
  "total_salary": "7500000.00",
  "average_salary": "50000.00",
  "attendance_rate": 95.5,
  "department_data": [
    {
      "department": "Engineering",
      "count": 50,
      "total_salary": "2500000.00"
    }
  ],
  "salary_trends": [
    {
      "month": "January",
      "year": 2024,
      "total": "7000000.00"
    }
  ]
}
```

---

## 🎯 Key Implementation Notes

1. **Multi-tenant Architecture**
   - Always include `X-Tenant-Subdomain` header in API requests
   - Store tenant info in secure storage
   - Handle tenant switching (if multi-tenant app)

2. **Progressive Loading**
   - Use pagination for all list endpoints
   - Implement infinite scroll
   - Cache pages locally
   - Show loading indicators

3. **Error Handling**
   - Network errors: Show retry option
   - 401 errors: Attempt token refresh, then logout
   - 403 errors: Show permission denied message
   - 500 errors: Show generic error, log details

4. **Session Management**
   - Listen for SSE events (if implemented)
   - Show session conflict modal
   - Handle forced logout gracefully
   - Clear all data on logout

5. **Form Handling**
   - Use React Hook Form (React Native) or FormBuilder (Flutter)
   - Validate on submit and blur
   - Show field-level errors
   - Disable submit during loading

6. **Date Handling**
   - Use `date-fns` for date formatting
   - Handle timezones correctly
   - Use date pickers for date inputs
   - Format dates consistently (YYYY-MM-DD for API, user-friendly for display)

7. **Charts**
   - Use responsive chart libraries
   - Match web chart colors
   - Show loading states
   - Handle empty data gracefully

---

## 🔗 Backend API Base URL

**Development**: `http://localhost:8000`  
**Production**: Configure via environment variable

The web app uses dynamic API URL detection:
- Environment variable: `VITE_API_URL`
- Domain detection (vercel.app)
- Fallback to localhost

Mobile app should use:
- Development: `http://localhost:8000` or `http://<your-ip>:8000`
- Production: `https://<your-backend-domain.com>`

---

## 📚 Additional Resources

- **Backend Repository**: Current codebase structure
- **API Documentation**: Check backend views for detailed request/response formats
- **Web App**: Reference for UI/UX patterns and component behavior
- **Django REST Framework**: Backend API framework documentation

---

## ✅ Final Checklist Before Starting

1. ✅ Understand multi-tenant architecture
2. ✅ Review all API endpoints and request/response formats
3. ✅ Understand authentication flow (JWT, refresh, session management)
4. ✅ Review data models and relationships
5. ✅ Understand role-based permissions
6. ✅ Review UI/UX patterns from web app
7. ✅ Set up development environment
8. ✅ Configure API base URL
9. ✅ Set up secure storage
10. ✅ Plan state management structure

---

**This prompt provides a complete foundation for scaffolding a mobile app that mirrors the web application's functionality, API structure, and design patterns. Use this as a reference throughout development.**

