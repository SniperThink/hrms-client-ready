// Auth Redux Slice
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CustomUser, Tenant } from '@/types';
import { authService } from '@/services/authService';

interface AuthState {
  user: CustomUser | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  tenant: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<CustomUser>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    setTenant: (state, action: PayloadAction<Tenant>) => {
      state.tenant = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.tenant = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    initializeAuth: (state) => {
      // This will be handled by async thunk
      state.isLoading = true;
    },
    initializeAuthSuccess: (state, action: PayloadAction<{ user: CustomUser; tenant: Tenant }>) => {
      state.user = action.payload.user;
      state.tenant = action.payload.tenant;
      state.isAuthenticated = true;
      state.isLoading = false;
    },
    initializeAuthFailure: (state) => {
      state.user = null;
      state.tenant = null;
      state.isAuthenticated = false;
      state.isLoading = false;
    },
  },
});

export const {
  setUser,
  setTenant,
  setLoading,
  setError,
  logout,
  initializeAuth,
  initializeAuthSuccess,
  initializeAuthFailure,
} = authSlice.actions;

export default authSlice.reducer;

