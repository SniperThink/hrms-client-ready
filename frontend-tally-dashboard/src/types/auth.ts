export interface User {
  id: number;
  email: string;
  name: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  department?: string;
  is_hr: boolean;
  is_admin: boolean;
  is_superuser?: boolean;
  role?: string;
}

export interface Tenant {
  id: number;
  name: string;
  subdomain: string;
  access_url: string;
}

export interface AuthResponse {
  message: string;
  access?: string;
  refresh?: string;
  session_key?: string;
  user: User;
  tenant?: Tenant;
  must_change_password?: boolean;
  no_credits?: boolean;
  credits?: number;
  account_recovered?: boolean;
  recovery_message?: string;
  requires_recovery_confirmation?: boolean;
  recovery_info?: {
    can_recover: boolean;
    recovery_period_days: number;
    days_remaining: number;
    recovery_deadline: string;
    recovery_message: string;
    tenant_name: string;
  };
  recovery_expired?: boolean;
  requires_admin?: boolean;
  account_deactivated?: boolean;
}

export type RegisterRequest = {
  email: string;
  password: string;
  password2: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  department?: string;
};

export type CompanySignupRequest = {
  company_name: string;
  subdomain: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}; 