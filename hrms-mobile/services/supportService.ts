// Support Ticket Service
import { api } from './api';
import { API_ENDPOINTS } from '@/constants/Config';

export interface SupportTicket {
  id: number;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
  created_by: number;
  admin_response?: string;
  attachment?: string;
}

export const supportService = {
  // Get all support tickets
  async getTickets(page: number = 1, status?: string): Promise<any> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    if (status) params.append('status', status);
    
    return await api.get(`${API_ENDPOINTS.supportTickets}?${params.toString()}`);
  },

  // Get ticket by ID
  async getTicketById(id: number): Promise<SupportTicket> {
    return await api.get<SupportTicket>(`${API_ENDPOINTS.supportTickets}${id}/`);
  },

  // Create support ticket
  async createTicket(data: { subject: string; message: string; priority?: string; attachment?: any }): Promise<SupportTicket> {
    return await api.post<SupportTicket>(API_ENDPOINTS.supportTickets, data);
  },

  // Update ticket
  async updateTicket(id: number, data: Partial<SupportTicket>): Promise<SupportTicket> {
    return await api.patch<SupportTicket>(`${API_ENDPOINTS.supportTickets}${id}/`, data);
  },
};

export default supportService;

