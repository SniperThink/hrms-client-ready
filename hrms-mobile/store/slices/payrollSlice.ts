// Payroll Redux Slice
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PayrollPeriod, CalculatedSalary } from '@/types';

interface PayrollState {
  periods: PayrollPeriod[];
  calculatedSalaries: CalculatedSalary[];
  selectedPeriod: PayrollPeriod | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: PayrollState = {
  periods: [],
  calculatedSalaries: [],
  selectedPeriod: null,
  isLoading: false,
  error: null,
};

const payrollSlice = createSlice({
  name: 'payroll',
  initialState,
  reducers: {
    setPeriods: (state, action: PayloadAction<PayrollPeriod[]>) => {
      state.periods = action.payload;
    },
    setCalculatedSalaries: (state, action: PayloadAction<CalculatedSalary[]>) => {
      state.calculatedSalaries = action.payload;
    },
    setSelectedPeriod: (state, action: PayloadAction<PayrollPeriod | null>) => {
      state.selectedPeriod = action.payload;
    },
    updateCalculatedSalary: (state, action: PayloadAction<CalculatedSalary>) => {
      const index = state.calculatedSalaries.findIndex((salary) => salary.id === action.payload.id);
      if (index !== -1) {
        state.calculatedSalaries[index] = action.payload;
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearPayroll: (state) => {
      state.periods = [];
      state.calculatedSalaries = [];
      state.selectedPeriod = null;
    },
  },
});

export const {
  setPeriods,
  setCalculatedSalaries,
  setSelectedPeriod,
  updateCalculatedSalary,
  setLoading,
  setError,
  clearPayroll,
} = payrollSlice.actions;

export default payrollSlice.reducer;

