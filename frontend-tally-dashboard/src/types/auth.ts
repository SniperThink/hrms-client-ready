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