// Holiday Service
import { api } from './api';
import { API_ENDPOINTS } from '@/constants/Config';
import { Holiday } from '@/types';

export const holidayService = {
  // Get all holidays
  async getHolidays(): Promise<Holiday[]> {
    const response = await api.get<any>(API_ENDPOINTS.holidays);
    console.log('Raw holidays response:', response);
    
    // Check if response is paginated (has results array)
    if (response && typeof response === 'object' && 'results' in response) {
      console.log('Paginated response detected, returning results array');
      return response.results || [];
    }
    
    // Check if response is already an array
    if (Array.isArray(response)) {
      console.log('Array response detected');
      return response;
    }
    
    console.log('Unexpected response format, returning empty array');
    return [];
  },

  // Get holiday by ID
  async getHolidayById(id: number): Promise<Holiday> {
    return await api.get<Holiday>(`${API_ENDPOINTS.holidays}${id}/`);
  },

  // Get upcoming holidays
  async getUpcomingHolidays(): Promise<Holiday[]> {
    const response = await api.get<any>(API_ENDPOINTS.upcomingHolidays);
    console.log('Raw upcoming holidays response:', response);
    
    // Check if response is paginated or array
    if (response && typeof response === 'object' && 'results' in response) {
      return response.results || [];
    }
    
    if (Array.isArray(response)) {
      return response;
    }
    
    return [];
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
    console.log('Calling delete API for holiday ID:', id);
    console.log('Delete URL:', `${API_ENDPOINTS.holidays}${id}/`);
    
    try {
      await api.delete(`${API_ENDPOINTS.holidays}${id}/`);
      console.log('Delete successful for holiday ID:', id);
    } catch (error: any) {
      console.error('Delete API error:', error);
      console.error('Error response:', error.response);
      throw error;
    }
  },
};

export default holidayService;

