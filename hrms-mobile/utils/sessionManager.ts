// Session Management Utilities for Mobile App
import { storage } from './storage';
import { api } from '@/services/api';
import { API_ENDPOINTS } from '@/constants/Config';

export interface SessionInfo {
  session_key: string | null;
  user_id: number | null;
  tenant_id: number | null;
  created_at: string | null;
}

export const sessionManager = {
  // Get current session info
  async getSessionInfo(): Promise<SessionInfo> {
    const sessionKey = await storage.getSessionKey();
    const user = await storage.getUser();
    const tenant = await storage.getTenant();

    return {
      session_key: sessionKey,
      user_id: user?.id || null,
      tenant_id: tenant?.id || null,
      created_at: null, // Not stored in mobile app
    };
  },

  // Check if session is valid
  async isSessionValid(): Promise<boolean> {
    const token = await storage.getAccessToken();
    const sessionKey = await storage.getSessionKey();
    return !!(token && sessionKey);
  },

  // Clear session
  async clearSession(): Promise<void> {
    await storage.clearAll();
  },

  // Handle session conflict (when another device logs in)
  async handleSessionConflict(): Promise<void> {
    // Clear all local data
    await storage.clearAll();
    // Could dispatch an event here to notify the app
  },

  // Validate session with backend (optional - for checking session status)
  async validateSession(): Promise<boolean> {
    try {
      const token = await storage.getAccessToken();
      if (!token) return false;

      // Try to make a lightweight API call to validate session
      await api.get(API_ENDPOINTS.userProfile);
      return true;
    } catch (error) {
      // Session invalid or expired
      await storage.clearAll();
      return false;
    }
  },
};

export default sessionManager;

