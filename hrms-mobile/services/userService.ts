// User/Team Management Service
import { api } from './api';
import { API_ENDPOINTS } from '@/constants/Config';
import { CustomUser, PaginatedResponse } from '@/types';

export interface UserInvitation {
  id: number;
  email: string;
  role: string;
  permissions?: any;
  invited_by: number;
  invited_at: string;
  accepted: boolean;
  accepted_at?: string;
}

export const userService = {
  // Get all users/invitations
  async getUsers(page: number = 1): Promise<PaginatedResponse<CustomUser>> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    
    return await api.get<PaginatedResponse<CustomUser>>(`${API_ENDPOINTS.userInvitations}?${params.toString()}`);
  },

  // Get user by ID
  async getUserById(id: number): Promise<CustomUser> {
    return await api.get<CustomUser>(`${API_ENDPOINTS.userInvitations}${id}/`);
  },

  // Invite user
  async inviteUser(data: { email: string; role: string; permissions?: any }): Promise<UserInvitation> {
    return await api.post<UserInvitation>(API_ENDPOINTS.userInvitations, data);
  },

  // Update user
  async updateUser(id: number, data: Partial<CustomUser>): Promise<CustomUser> {
    return await api.patch<CustomUser>(`${API_ENDPOINTS.userInvitations}${id}/`, data);
  },

  // Update user permissions
  async updateUserPermissions(id: number, permissions: any): Promise<any> {
    return await api.patch(`${API_ENDPOINTS.userInvitations}${id}/permissions/`, permissions);
  },

  // Delete user
  async deleteUser(id: number): Promise<void> {
    return await api.delete(`${API_ENDPOINTS.userInvitations}${id}/`);
  },
};

export default userService;

