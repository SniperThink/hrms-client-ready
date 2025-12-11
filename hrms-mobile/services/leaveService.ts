// Leave Service
import { api } from './api';
import { API_ENDPOINTS } from '@/constants/Config';
import { Leave, PaginatedResponse } from '@/types';

export interface LeaveStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  by_type: Array<{
    leave_type: string;
    count: number;
  }>;
}

export const leaveService = {
  // Get all leaves (paginated)
  async getLeaves(page: number = 1, status?: string, employeeId?: number): Promise<PaginatedResponse<Leave>> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    if (status) params.append('status', status);
    if (employeeId) params.append('employee', employeeId.toString());
    
    return await api.get<PaginatedResponse<Leave>>(`${API_ENDPOINTS.leaves}?${params.toString()}`);
  },

  // Get leave by ID
  async getLeaveById(id: number): Promise<Leave> {
    return await api.get<Leave>(`${API_ENDPOINTS.leaves}${id}/`);
  },

  // Create leave request
  async createLeave(data: Partial<Leave>): Promise<Leave> {
    return await api.post<Leave>(API_ENDPOINTS.leaves, data);
  },

  // Update leave (approve/reject)
  async updateLeave(id: number, data: Partial<Leave>): Promise<Leave> {
    return await api.patch<Leave>(`${API_ENDPOINTS.leaves}${id}/`, data);
  },

  // Get leave statistics
  async getLeaveStats(): Promise<LeaveStats> {
    return await api.get<LeaveStats>(API_ENDPOINTS.leaveStats);
  },

  // Get leave data (progressive loading)
  async getLeaveData(page: number = 1): Promise<any> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    
    return await api.get(`${API_ENDPOINTS.leaves}get_leave_data/?${params.toString()}`);
  },
};

export default leaveService;

