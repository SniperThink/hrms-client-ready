// Payroll Service
import { api } from './api';
import { API_ENDPOINTS } from '@/constants/Config';
import { PayrollPeriod, CalculatedSalary, PaginatedResponse } from '@/types';

export interface PayrollStats {
  total_employees: number;
  total_salary: string;
  average_salary: string;
  total_advance: string;
}

export const payrollService = {
  // Get payroll overview (includes periods with stats)
  async getPayrollOverview(): Promise<any> {
    return await api.get(API_ENDPOINTS.payrollOverview);
  },

  // Get payroll periods
  async getPayrollPeriods(): Promise<PayrollPeriod[]> {
    const response = await api.get<{ success: boolean; periods: PayrollPeriod[] }>(API_ENDPOINTS.payrollPeriods);
    return response.periods || [];
  },

  // Get payroll period detail
  async getPayrollPeriodDetail(periodId: number): Promise<any> {
    return await api.get(API_ENDPOINTS.payrollPeriodDetail(periodId.toString()));
  },

  // Create payroll period
  async createPayrollPeriod(data: Partial<PayrollPeriod>): Promise<PayrollPeriod> {
    return await api.post<PayrollPeriod>(API_ENDPOINTS.payrollPeriods, data);
  },

  // Get calculated salaries for a period
  async getCalculatedSalaries(periodId: number, page: number = 1): Promise<PaginatedResponse<CalculatedSalary>> {
    const params = new URLSearchParams();
    params.append('period_id', periodId.toString());
    params.append('page', page.toString());
    
    return await api.get<PaginatedResponse<CalculatedSalary>>(`${API_ENDPOINTS.calculatedSalaries}?${params.toString()}`);
  },

  // Get calculated salary by ID
  async getCalculatedSalaryById(id: number): Promise<CalculatedSalary> {
    return await api.get<CalculatedSalary>(API_ENDPOINTS.calculatedSalaryById(id.toString()));
  },

  // Get monthly payroll summary
  async getMonthlyPayroll(month: string, year: number): Promise<any> {
    const params = new URLSearchParams();
    params.append('month', month);
    params.append('year', year.toString());
    
    return await api.get(`${API_ENDPOINTS.payrollMonthly}?${params.toString()}`);
  },

  // Update calculated salary
  async updateCalculatedSalary(id: number, data: Partial<CalculatedSalary>): Promise<CalculatedSalary> {
    return await api.patch<CalculatedSalary>(`${API_ENDPOINTS.calculatedSalaries}${id}/`, data);
  },

  // Get advance payments
  async getAdvancePayments(employeeId?: string, page: number = 1): Promise<PaginatedResponse<any>> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    if (employeeId) params.append('employee_id', employeeId);
    
    return await api.get<PaginatedResponse<any>>(`${API_ENDPOINTS.advancePayments}?${params.toString()}`);
  },

  // Create advance payment
  async createAdvancePayment(data: any): Promise<any> {
    return await api.post(API_ENDPOINTS.advancePayments, data);
  },

  // Update advance payment
  async updateAdvancePayment(id: number, data: any): Promise<any> {
    return await api.patch(`${API_ENDPOINTS.advancePayments}${id}/`, data);
  },

  // Calculate payroll
  async calculatePayroll(periodId: number, forceRecalculate: boolean = false): Promise<any> {
    return await api.post(API_ENDPOINTS.calculatePayroll, {
      period_id: periodId,
      force_recalculate: forceRecalculate,
      mode: 'calculate',
    });
  },

  // Mark salaries as paid
  async markSalariesPaid(salaryIds: number[], paymentDate?: string): Promise<any> {
    return await api.post(API_ENDPOINTS.markSalaryPaid, {
      salary_ids: salaryIds,
      mark_as_paid: true,
      payment_date: paymentDate || new Date().toISOString().split('T')[0],
    });
  },
};

export default payrollService;

