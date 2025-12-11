// Type definitions for HRMS Mobile App

// Tenant
export interface Tenant {
  id: number;
  name: string;
  subdomain: string;
  access_url: string;
  credits: number;
  is_active: boolean;
  weekly_absent_penalty_enabled: boolean;
  weekly_absent_penalty_days: number;
}

// User
export interface CustomUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'hr_manager' | 'payroll_master' | 'supervisor' | 'employee';
  is_superuser: boolean;
  is_admin: boolean;
  tenant: Tenant;
  email_verified: boolean;
  permissions?: UserPermissions;
  phone_number?: string;
  department?: string;
}

export interface UserPermissions {
  can_view_employees: boolean;
  can_edit_employees: boolean;
  can_delete_employees: boolean;
  can_view_payroll: boolean;
  can_edit_payroll: boolean;
  can_view_attendance: boolean;
  can_edit_attendance: boolean;
  can_manage_users: boolean;
}

// Employee
export interface EmployeeProfile {
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
  shift_start_time: string;
  shift_end_time: string;
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

// Attendance
export interface DailyAttendance {
  id: number;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  employment_type: string;
  attendance_status: 'PRESENT' | 'ABSENT' | 'UNMARKED' | 'HALF_DAY' | 'PAID_LEAVE' | 'OFF';
  date: string;
  check_in?: string;
  check_out?: string;
  working_hours?: number;
  time_status?: 'ON_TIME' | 'LATE';
  ot_hours: number;
  late_minutes: number;
}

export interface Attendance {
  id: number;
  employee_id: string;
  name: string;
  department?: string;
  date: string;
  calendar_days: number;
  total_working_days: number;
  present_days: number;
  absent_days: number;
  unmarked_days: number;
  holiday_days: number;
  ot_hours: number;
  late_minutes: number;
}

// Payroll
export interface PayrollPeriod {
  id: number;
  year: number;
  month: string;
  data_source: 'UPLOADED' | 'FRONTEND' | 'HYBRID';
  is_locked: boolean;
  working_days_in_month: number;
  tds_rate: number;
}

export interface CalculatedSalary {
  id: number;
  payroll_period: number;
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

// Leave
export interface Leave {
  id: number;
  employee: number;
  leave_type: 'SICK' | 'CASUAL' | 'EARNED' | 'LOP' | 'OTHER';
  start_date: string;
  end_date: string;
  days: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  applied_at: string;
}

// Holiday
export interface Holiday {
  id: number;
  name: string;
  date: string;
  is_recurring: boolean;
  description?: string;
}

// API Response Types
export interface AuthResponse {
  access: string;
  refresh: string;
  session_key?: string;
  user: CustomUser;
  tenant: Tenant;
  account_recovered?: boolean;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DashboardStats {
  total_employees: number;
  active_employees: number;
  total_salary: string;
  average_salary: string;
  attendance_rate: number;
  department_data: Array<{
    department: string;
    count: number;
    total_salary: string;
  }>;
  salary_trends: Array<{
    month: string;
    year: number;
    total: string;
  }>;
}

// Error Types
export interface APIError {
  error?: string;
  message?: string;
  detail?: string;
  code?: string;
  logout_required?: boolean;
  reason?: string;
}

