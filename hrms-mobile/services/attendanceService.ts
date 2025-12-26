// Attendance Service
import { api } from './api';
import { API_ENDPOINTS } from '@/constants/Config';
import { DailyAttendance, Attendance, PaginatedResponse } from '@/types';

export interface AttendanceStats {
  total_records: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_rate: number;
}

export const attendanceService = {
  // Get daily attendance records (paginated)
  async getDailyAttendance(page: number = 1, date?: string, employeeId?: string): Promise<PaginatedResponse<DailyAttendance>> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    if (date) params.append('date', date);
    if (employeeId) params.append('employee_id', employeeId);
    
    return await api.get<PaginatedResponse<DailyAttendance>>(`${API_ENDPOINTS.dailyAttendance}?${params.toString()}`);
  },

  // Get attendance records (monthly)
  async getAttendance(page: number = 1, date?: string): Promise<PaginatedResponse<Attendance>> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    if (date) params.append('date', date);
    
    return await api.get<PaginatedResponse<Attendance>>(`${API_ENDPOINTS.attendance}?${params.toString()}`);
  },

  // Get attendance data (progressive loading)
  async getAttendanceData(page: number = 1, month?: string, year?: number): Promise<any> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    if (month) params.append('month', month);
    if (year) params.append('year', year.toString());
    
    return await api.get(`${API_ENDPOINTS.attendance}get_attendance_data/?${params.toString()}`);
  },

  // Create daily attendance
  async createDailyAttendance(data: Partial<DailyAttendance>): Promise<DailyAttendance> {
    return await api.post<DailyAttendance>(API_ENDPOINTS.dailyAttendance, data);
  },

  // Update daily attendance
  async updateDailyAttendance(id: number, data: Partial<DailyAttendance>): Promise<DailyAttendance> {
    return await api.patch<DailyAttendance>(`${API_ENDPOINTS.dailyAttendance}${id}/`, data);
  },

  // Bulk update attendance
  async bulkUpdateAttendance(records: Partial<DailyAttendance>[]): Promise<any> {
    return await api.post(`${API_ENDPOINTS.dailyAttendance}bulk_update/`, { records });
  },

  // Get attendance statistics
  async getAttendanceStats(month?: string, year?: number): Promise<AttendanceStats> {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (year) params.append('year', year.toString());
    
    return await api.get<AttendanceStats>(`${API_ENDPOINTS.attendanceStats}?${params.toString()}`);
  },

  // Get eligible employees for attendance marking
  async getEligibleEmployees(date: string): Promise<any> {
    const params = new URLSearchParams();
    params.append('date', date);
    
    return await api.get(`${API_ENDPOINTS.employees}eligible_for_attendance/?${params.toString()}`);
  },

  // Save attendance data - using bulk-update-attendance endpoint (same as web dashboard)
  async saveAttendance(date: string, attendanceData: any[]): Promise<any> {
    return await api.post('/api/bulk-update-attendance/', {
      date: date,
      attendance_records: attendanceData
    });
  },

  // Check if Excel attendance was uploaded for a date
  async checkExcelAttendance(date: string): Promise<any> {
    const params = new URLSearchParams();
    params.append('date', date);
    
    return await api.get(`${API_ENDPOINTS.uploadAttendance}check/?${params.toString()}`);
  },

  // Check if a date is a holiday
  async checkHoliday(date: string): Promise<any> {
    const params = new URLSearchParams();
    params.append('date', date);
    
    return await api.get(`${API_ENDPOINTS.holidays}check/?${params.toString()}`);
  },
};

export default attendanceService;

