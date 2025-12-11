// API Service Layer using native fetch (React Native compatible)
import { API_BASE_URL, API_ENDPOINTS, STORAGE_KEYS } from '@/constants/Config';
import { storage } from '@/utils/storage';
import { AuthResponse, APIError } from '@/types';

// Helper function to refresh token
const refreshAuthToken = async (): Promise<boolean> => {
  const refreshToken = await storage.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.refreshToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (response.ok) {
      const data: AuthResponse = await response.json();
      await storage.setAccessToken(data.access);
      if (data.refresh) await storage.setRefreshToken(data.refresh);
      if (data.session_key) await storage.setSessionKey(data.session_key);
      return true;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }
  
  return false;
};

// Helper function to make authenticated API calls
const apiCall = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = await storage.getAccessToken();
  const tenant = await storage.getTenant();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Type': 'mobile', // Indicate this is a mobile client
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Add tenant subdomain header (skip for super-admin endpoints)
  if (tenant?.subdomain && !endpoint.startsWith('/api/super-admin/')) {
    headers['X-Tenant-Subdomain'] = tenant.subdomain;
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // If token invalid (401), try to refresh and retry once
  if (response.status === 401 && token) {
    const refreshed = await refreshAuthToken();
    if (refreshed) {
      // Retry the request with new token
      const newToken = await storage.getAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers,
        });
      }
    } else {
      // Refresh failed - check if it's a session conflict
      try {
        const errorData: APIError = await response.clone().json();
        if (errorData?.logout_required || errorData?.code === 'SESSION_INVALID') {
          // Handle session conflict - clear storage
          await storage.clearAll();
          throw new Error(errorData.reason || 'SESSION_INVALID');
        }
      } catch (e) {
        // If we can't parse error, it might be a network issue
        if (e instanceof Error && e.message === 'SESSION_INVALID') {
          throw e;
        }
      }
      // Fallback: clear storage
      await storage.clearAll();
      throw new Error('Authentication failed. Please login again.');
    }
  }

  // Handle session errors (500) that might occur during login
  // These are usually Django session UpdateError but JWT tokens are still valid
  if (response.status === 500 && endpoint.includes('/login/')) {
    try {
      // Try to parse response - if it contains tokens, we can still use them
      const data = await response.clone().json();
      if (data.access && data.refresh) {
        // Session error occurred but we got tokens - this is acceptable for mobile
        console.warn('Session error during login, but JWT tokens received');
        // Return a modified response that indicates success
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: response.headers,
        });
      }
    } catch {
      // Can't parse response, let it fail normally
    }
  }

  return response;
};

// API Methods
export const api = {
  // GET request
  get: async <T>(endpoint: string, config?: RequestInit): Promise<T> => {
    const response = await apiCall(endpoint, { ...config, method: 'GET' });
    if (!response.ok) {
      const error: APIError = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }
    return await response.json();
  },

  // POST request
  post: async <T>(endpoint: string, data?: any, config?: RequestInit): Promise<T> => {
    const response = await apiCall(endpoint, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      const error: APIError = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }
    return await response.json();
  },

  // PUT request
  put: async <T>(endpoint: string, data?: any, config?: RequestInit): Promise<T> => {
    const response = await apiCall(endpoint, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      const error: APIError = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }
    return await response.json();
  },

  // PATCH request
  patch: async <T>(endpoint: string, data?: any, config?: RequestInit): Promise<T> => {
    const response = await apiCall(endpoint, {
      ...config,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      const error: APIError = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }
    return await response.json();
  },

  // DELETE request
  delete: async <T>(endpoint: string, config?: RequestInit): Promise<T> => {
    const response = await apiCall(endpoint, { ...config, method: 'DELETE' });
    if (!response.ok) {
      const error: APIError = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }
    return await response.json();
  },

  // File upload
  upload: async <T>(endpoint: string, formData: FormData, config?: RequestInit): Promise<T> => {
    const token = await storage.getAccessToken();
    const tenant = await storage.getTenant();

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (tenant?.subdomain && !endpoint.startsWith('/api/super-admin/')) {
      headers['X-Tenant-Subdomain'] = tenant.subdomain;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...config,
      method: 'POST',
      headers,
      body: formData,
      // Don't set Content-Type for FormData, let the browser set it with boundary
    });

    if (!response.ok) {
      const error: APIError = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    return await response.json();
  },
};

export default api;
