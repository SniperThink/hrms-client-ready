import { API_CONFIG } from "../config/apiConfig";
import { AuthResponse, User } from "../types/auth";
import { logger } from '../utils/logger';

const API_BASE = API_CONFIG.getApiUrl();
const getToken = () => localStorage.getItem("access");

// Self-service company signup
export async function signupCompany(data: {
  company_name: string;
  subdomain: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/public/signup/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Company signup failed");
  }
  return res.json();
}

// Public login (auto-detects tenant)
export async function login(
  email: string,
  password: string,
  keepSignedIn: boolean = false,
  confirmRecovery: boolean = false
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/public/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, confirm_recovery: confirmRecovery }),
  });
  
  const data = await res.json();
  
  if (!res.ok) {
    // For error responses, create an error with the full response data for better error handling
    const error = new Error(data.error || "Login failed");
    (error as any).responseData = data;
    throw error;
  }

  // Store the "keep signed in" preference
  if (keepSignedIn) {
    localStorage.setItem("keepSignedIn", "true");
  } else {
    localStorage.removeItem("keepSignedIn");
  }

  return data;
}

// Add team member to existing tenant
export async function register(
  data: Omit<User, "id" | "is_hr" | "is_admin"> & {
    password: string;
    password2: string;
  }
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "User registration failed");
  }
  return res.json();
}

export async function refreshToken(
  refresh: string
): Promise<{ access: string }> {
  const res = await fetch(`${API_BASE}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) throw new Error("Token refresh failed");
  return res.json();
}

export async function getProfile(): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/profile/`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

export async function updateUserStatus(
  user: User,
  field: string,
  newValue: boolean
): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${user.id}/update_permissions/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ [field]: newValue }),
  });
  if (!res.ok) throw new Error("Failed to update user status");
}

/* Updated centralized logout function to use /api/auth/force-logout/ and include email in the payload */
export const logout = async () => {
  let email = '';
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    email = user.email || '';
  } catch (error) {
    logger.error('Error parsing user data:', error);
  }

  try {
    const response = await fetch('/api/auth/force-logout/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!response.ok) {
      logger.error('Force logout API failed');
    }
  } catch (error) {
    logger.error('Force logout error:', error);
  } finally {
    localStorage.clear();
    window.location.href = '/login';
  }
};

// Check if user has "keep signed in" enabled
export function hasKeepSignedIn(): boolean {
  return localStorage.getItem("keepSignedIn") === "true";
}

// Health check
export async function healthCheck(): Promise<{
  status: string;
  version: string;
}> {
  const res = await fetch(`${API_BASE}/health/`);
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}
