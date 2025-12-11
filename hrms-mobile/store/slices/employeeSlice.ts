// Employee Redux Slice
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { EmployeeProfile } from '@/types';

interface EmployeeState {
  employees: EmployeeProfile[];
  selectedEmployee: EmployeeProfile | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    count: number;
    next: string | null;
    previous: string | null;
  };
}

const initialState: EmployeeState = {
  employees: [],
  selectedEmployee: null,
  isLoading: false,
  error: null,
  pagination: {
    count: 0,
    next: null,
    previous: null,
  },
};

const employeeSlice = createSlice({
  name: 'employees',
  initialState,
  reducers: {
    setEmployees: (state, action: PayloadAction<EmployeeProfile[]>) => {
      state.employees = action.payload;
    },
    addEmployees: (state, action: PayloadAction<EmployeeProfile[]>) => {
      state.employees = [...state.employees, ...action.payload];
    },
    setSelectedEmployee: (state, action: PayloadAction<EmployeeProfile | null>) => {
      state.selectedEmployee = action.payload;
    },
    updateEmployee: (state, action: PayloadAction<EmployeeProfile>) => {
      const index = state.employees.findIndex((emp) => emp.id === action.payload.id);
      if (index !== -1) {
        state.employees[index] = action.payload;
      }
      if (state.selectedEmployee?.id === action.payload.id) {
        state.selectedEmployee = action.payload;
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setPagination: (state, action: PayloadAction<{ count: number; next: string | null; previous: string | null }>) => {
      state.pagination = action.payload;
    },
    clearEmployees: (state) => {
      state.employees = [];
      state.selectedEmployee = null;
      state.pagination = {
        count: 0,
        next: null,
        previous: null,
      };
    },
  },
});

export const {
  setEmployees,
  addEmployees,
  setSelectedEmployee,
  updateEmployee,
  setLoading,
  setError,
  setPagination,
  clearEmployees,
} = employeeSlice.actions;

export default employeeSlice.reducer;

