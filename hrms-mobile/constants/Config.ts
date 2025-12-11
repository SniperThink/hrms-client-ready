// API Configuration
// Update these values based on your environment

import Constants from 'expo-constants';

// Get API URL from environment variable or use default
// 
// IMPORTANT: For physical devices, you MUST set EXPO_PUBLIC_API_URL to your computer's IP address
// Example: EXPO_PUBLIC_API_URL=http://192.168.1.100:8000
//
// For emulators/simulators:
// - iOS Simulator: http://localhost:8000 (default)
// - Android Emulator: http://10.0.2.2:8000 (set via env var)
//
// For production: Set to your production API URL (HTTPS)
export const API_BASE_URL = 
  Constants.expoConfig?.extra?.apiUrl || 
  process.env.EXPO_PUBLIC_API_URL || 
  'http://localhost:8000'; // Default for iOS simulator

// API Endpoints
export const API_ENDPOINTS = {
  // Authentication
  login: '/api/public/login/',
  signup: '/api/public/signup/',
  register: '/api/auth/register/',
  refreshToken: '/api/auth/refresh/',
  logout: '/api/auth/logout/',
  changePassword: '/api/password-reset/change/',
  requestPasswordReset: '/api/password-reset/request/',
  verifyOTP: '/api/password-reset/verify/',
  resetPassword: '/api/password-reset/reset/',
  
  // Dashboard
  dashboard: '/api/dashboard/stats/',
  
  // Employees
  employees: '/api/employees/',
  employeeStats: '/api/employees/stats/',
  employeeDirectory: '/api/employees/get_directory_data/',
  
  // Attendance
  attendance: '/api/attendance/',
  attendanceStats: '/api/attendance/stats/',
  dailyAttendance: '/api/daily-attendance/',
  
  // Payroll
  salaryData: '/api/salary-data/',
  payrollMonthly: '/api/payroll/monthly/',
  payrollPeriods: '/api/payroll-periods-list/',
  payrollOverview: '/api/payroll-overview/',
  payrollPeriodDetail: (id: string) => `/api/payroll-period-detail/${id}/`,
  calculatedSalaries: '/api/calculated-salaries/',
  calculatedSalaryById: (id: string) => `/api/calculated-salaries/${id}/`,
  advancePayments: '/api/advance-payments/',
  calculatePayroll: '/api/calculate-payroll/',
  markSalaryPaid: '/api/mark-salary-paid/',
  
  // Leaves
  leaves: '/api/leaves/',
  leaveStats: '/api/leaves/stats/',
  
  // Holidays
  holidays: '/api/holidays/',
  upcomingHolidays: '/api/holidays/upcoming/',
  
  // Users
  userInvitations: '/api/user-invitations/',
  userProfile: '/api/user/profile/',
  
  // Tenant
  tenantSettings: '/api/tenant/settings/',
  tenantCredits: '/api/tenant/credits/',
  
  // Support
  supportTickets: '/api/support/tickets/',
  
  // Data Upload
  uploadSalary: '/api/upload-salary/',
  uploadAttendance: '/api/upload-attendance/',
};

// Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  SESSION_KEY: 'session_key',
  USER: 'user',
  TENANT: 'tenant',
  KEEP_SIGNED_IN: 'keep_signed_in',
};

// JWT Token Settings
export const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // Refresh 5 minutes before expiry

