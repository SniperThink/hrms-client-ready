// Employee Service
import { api } from './api';
import { API_ENDPOINTS } from '@/constants/Config';
import { EmployeeProfile, PaginatedResponse } from '@/types';

export interface EmployeeStats {
  total: number;
  active: number;
  inactive: number;
  by_department: Array<{
    department: string;
    count: number;
  }>;
}

export const employeeService = {
  // Get all employees (paginated)
  async getEmployees(page: number = 1, search?: string, department?: string): Promise<PaginatedResponse<EmployeeProfile>> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    if (search) params.append('search', search);
    if (department && department !== 'All') params.append('department', department);
    
    return await api.get<PaginatedResponse<EmployeeProfile>>(`${API_ENDPOINTS.employees}?${params.toString()}`);
  },

  // Get employee by ID
  async getEmployeeById(id: number): Promise<EmployeeProfile> {
    return await api.get<EmployeeProfile>(`${API_ENDPOINTS.employees}${id}/`);
  },

  // Get employee directory data (progressive loading)
  async getDirectoryData(page: number = 1, search?: string): Promise<any> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    if (search) params.append('search', search);
    
    return await api.get(`${API_ENDPOINTS.employeeDirectory}?${params.toString()}`);
  },

  // Get employee details
  async getEmployeeDetails(id: number): Promise<any> {
    return await api.get(`${API_ENDPOINTS.employees}${id}/get_employee_details/`);
  },

  // Create employee
  async createEmployee(data: Partial<EmployeeProfile>): Promise<EmployeeProfile> {
    return await api.post<EmployeeProfile>(API_ENDPOINTS.employees, data);
  },

  // Update employee
  async updateEmployee(id: number, data: Partial<EmployeeProfile>): Promise<EmployeeProfile> {
    return await api.patch<EmployeeProfile>(`${API_ENDPOINTS.employees}${id}/`, data);
  },

  // Update employee details
  async updateEmployeeDetails(id: number, data: any): Promise<EmployeeProfile> {
    return await api.patch<EmployeeProfile>(`${API_ENDPOINTS.employees}${id}/update_employee_details/`, data);
  },

  // Delete employee
  async deleteEmployee(id: number): Promise<void> {
    return await api.delete(`${API_ENDPOINTS.employees}${id}/`);
  },

  // Get employee statistics
  async getEmployeeStats(): Promise<EmployeeStats> {
    return await api.get<EmployeeStats>(API_ENDPOINTS.employeeStats);
  },
};

export default employeeService;

