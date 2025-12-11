// Attendance Redux Slice
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DailyAttendance, Attendance } from '@/types';

interface AttendanceState {
  dailyRecords: DailyAttendance[];
  monthlyRecords: Attendance[];
  selectedDate: string | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    count: number;
    next: string | null;
    previous: string | null;
  };
}

const initialState: AttendanceState = {
  dailyRecords: [],
  monthlyRecords: [],
  selectedDate: null,
  isLoading: false,
  error: null,
  pagination: {
    count: 0,
    next: null,
    previous: null,
  },
};

const attendanceSlice = createSlice({
  name: 'attendance',
  initialState,
  reducers: {
    setDailyRecords: (state, action: PayloadAction<DailyAttendance[]>) => {
      state.dailyRecords = action.payload;
    },
    addDailyRecords: (state, action: PayloadAction<DailyAttendance[]>) => {
      state.dailyRecords = [...state.dailyRecords, ...action.payload];
    },
    setMonthlyRecords: (state, action: PayloadAction<Attendance[]>) => {
      state.monthlyRecords = action.payload;
    },
    setSelectedDate: (state, action: PayloadAction<string | null>) => {
      state.selectedDate = action.payload;
    },
    updateDailyRecord: (state, action: PayloadAction<DailyAttendance>) => {
      const index = state.dailyRecords.findIndex((record) => record.id === action.payload.id);
      if (index !== -1) {
        state.dailyRecords[index] = action.payload;
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
    clearAttendance: (state) => {
      state.dailyRecords = [];
      state.monthlyRecords = [];
      state.selectedDate = null;
      state.pagination = {
        count: 0,
        next: null,
        previous: null,
      };
    },
  },
});

export const {
  setDailyRecords,
  addDailyRecords,
  setMonthlyRecords,
  setSelectedDate,
  updateDailyRecord,
  setLoading,
  setError,
  setPagination,
  clearAttendance,
} = attendanceSlice.actions;

export default attendanceSlice.reducer;

