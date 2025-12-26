// Authentication Service
import { api } from './api';
import { API_ENDPOINTS } from '@/constants/Config';
import { storage } from '@/utils/storage';
import { AuthResponse, CustomUser, Tenant } from '@/types';

export interface LoginCredentials {
  email: string;
  password: string;
  confirmRecovery?: boolean;
}

export interface SignupData {
  company_name: string;
  subdomain: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetVerify {
  email: string;
  otp: string;
}

export interface PasswordReset {
  email: string;
  otp: string;
  new_password: string;
}

export const authService = {
  // Login
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>(API_ENDPOINTS.login, {
        email: credentials.email,
        password: credentials.password,
        confirm_recovery: credentials.confirmRecovery || false,
        client_type: 'mobile', // Indicate mobile client to backend
      });

      // Store tokens and user data
      await storage.setAccessToken(response.access);
      await storage.setRefreshToken(response.refresh);
      if (response.session_key) {
        await storage.setSessionKey(response.session_key);
      }
      await storage.setUser(response.user);
      await storage.setTenant(response.tenant);

      return response;
    } catch (error: any) {
      // Handle session errors gracefully - if we get tokens, we can still proceed
      // Session errors in Django don't prevent JWT token generation
      if (error.message && error.message.includes('session')) {
        console.warn('Session error during login, but continuing with JWT tokens');
        // Try to extract tokens from error response if available
        // For now, rethrow to let caller handle it
      }
      throw error;
    }
  },

  // Signup (Tenant registration)
  async signup(data: SignupData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>(API_ENDPOINTS.signup, {
      company_name: data.company_name,
      subdomain: data.subdomain,
      email: data.email,
      password: data.password,
      first_name: data.first_name,
      last_name: data.last_name,
    });

    // Store tokens and user data
    await storage.setAccessToken(response.access);
    await storage.setRefreshToken(response.refresh);
    if (response.session_key) {
      await storage.setSessionKey(response.session_key);
    }
    await storage.setUser(response.user);
    await storage.setTenant(response.tenant);

    return response;
  },

  // Logout
  async logout(): Promise<void> {
    try {
      await api.post(API_ENDPOINTS.logout);
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Clear all storage regardless of API call success
      await storage.clearAll();
    }
  },

  // Get current user
  async getCurrentUser(): Promise<CustomUser | null> {
    return await storage.getUser();
  },

  // Get current tenant
  async getCurrentTenant(): Promise<Tenant | null> {
    return await storage.getTenant();
  },

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const token = await storage.getAccessToken();
    return !!token;
  },

  // Request password reset OTP
  async requestPasswordReset(data: PasswordResetRequest): Promise<void> {
    await api.post(API_ENDPOINTS.requestPasswordReset, data);
  },

  // Verify OTP
  async verifyOTP(data: PasswordResetVerify): Promise<void> {
    await api.post(API_ENDPOINTS.verifyOTP, data);
  },

  // Reset password
  async resetPassword(data: PasswordReset): Promise<void> {
    await api.post(API_ENDPOINTS.resetPassword, data);
  },

  // Change password
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await api.post(API_ENDPOINTS.changePassword, {
      old_password: oldPassword,
      new_password: newPassword,
    });
  },

  // Get user profile
  async getUserProfile(): Promise<CustomUser> {
    return await api.get<CustomUser>(API_ENDPOINTS.userProfile);
  },

  // Check if PIN is required for user
  async checkPINRequired(email: string): Promise<{ pin_required: boolean }> {
    return await api.post('/api/pin/check-required/', { email });
  },

  // Verify PIN
  async verifyPIN(email: string, pin: string): Promise<{ success: boolean; message: string }> {
    return await api.post('/api/pin/verify/', { email, pin });
  },

  // Get PIN status
  async getPINStatus(): Promise<{ has_pin: boolean; pin_enabled: boolean; is_locked: boolean; locked_until: string | null }> {
    return await api.get('/api/pin/status/');
  },

  // Setup or change PIN
  async setupPIN(pin: string, password: string): Promise<{ success: boolean; message: string; pin_enabled: boolean }> {
    return await api.post('/api/pin/setup/', { pin, password });
  },

  // Disable PIN
  async disablePIN(password: string): Promise<{ success: boolean; message: string; pin_enabled: boolean }> {
    return await api.post('/api/pin/disable/', { password });
  },
};

export default authService;

