// Holiday Service
import { api } from './api';
import { API_ENDPOINTS } from '@/constants/Config';
import { Holiday } from '@/types';

export const holidayService = {
  // Get all holidays
  async getHolidays(): Promise<Holiday[]> {
    return await api.get<Holiday[]>(API_ENDPOINTS.holidays);
  },

  // Get holiday by ID
  async getHolidayById(id: number): Promise<Holiday> {
    return await api.get<Holiday>(`${API_ENDPOINTS.holidays}${id}/`);
  },

  // Get upcoming holidays
  async getUpcomingHolidays(): Promise<Holiday[]> {
    return await api.get<Holiday[]>(API_ENDPOINTS.upcomingHolidays);
  },

  // Get holidays by month
  async getHolidaysByMonth(month: number, year: number): Promise<Holiday[]> {
    const params = new URLSearchParams();
    params.append('month', month.toString());
    params.append('year', year.toString());
    
    return await api.get<Holiday[]>(`${API_ENDPOINTS.holidays}by_month/?${params.toString()}`);
  },

  // Check if date is holiday
  async checkDate(date: string): Promise<{ is_holiday: boolean; holiday?: Holiday }> {
    return await api.post(`${API_ENDPOINTS.holidays}check_date/`, { date });
  },

  // Create holiday
  async createHoliday(data: Partial<Holiday>): Promise<Holiday> {
    return await api.post<Holiday>(API_ENDPOINTS.holidays, data);
  },

  // Update holiday
  async updateHoliday(id: number, data: Partial<Holiday>): Promise<Holiday> {
    return await api.patch<Holiday>(`${API_ENDPOINTS.holidays}${id}/`, data);
  },

  // Delete holiday
  async deleteHoliday(id: number): Promise<void> {
    return await api.delete(`${API_ENDPOINTS.holidays}${id}/`);
  },
};

export default holidayService;

