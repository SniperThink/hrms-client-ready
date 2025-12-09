import React, { useState, useEffect } from 'react';
import { Calculator, CheckCircle, Users, Loader2, Plus, Download, IndianRupee, Timer, Receipt } from 'lucide-react';
import { apiCall } from '../../services/api';
import { clearSalaryDataCache } from '../../services/salaryService';
import AdvanceManager from './AdvanceManager';
import Dropdown, { DropdownOption } from '../Dropdown';
import { exportPayrollToExcel, PayrollData } from '../../utils/excelExport';
import { SkeletonButton, SkeletonBase } from '../SkeletonComponents';
import { logger } from '../../utils/logger';

interface AttendancePeriod {
  year: number;
  month: string;
  month_num: number;
  month_display: string;
  attendance_records: number;
  employees_with_attendance: number;
}

interface PayrollEntry {
  employee_id: string;
  employee_name: string;
  department: string;
  base_salary: number;
  total_days?: number; // Total days in the month
  working_days: number;
  raw_present_days?: number;  // Present days without holidays
  paid_days?: number;  // Present days + holidays
  present_days: number;
  holiday_days?: number;          // Paid holidays
  weekly_penalty_days?: number;   // Weekly absent penalty days
  absent_days: number;
  off_days?: number;              // Off days for the employee
  ot_hours: number;
  late_minutes: number;
  gross_salary: number;
  ot_charges: number;
  late_deduction: number;
  tds_percentage: number;
  tds_amount: number;
  total_advance_balance?: number; // Optional - not returned by optimized API
  advance_deduction: number;
  remaining_balance?: number; // Optional - not returned by optimized API
  net_salary: number;
  is_paid: boolean;
  editable: boolean;
}

interface PayrollSummary {
  total_employees: number;
  total_days?: number; // Total days in the month
  working_days: number;
  month_year: string;
  total_base_salary: number;
  total_gross_salary: number;
  total_net_salary: number;
}

const SimplePayrollCalculator: React.FC = () => {
  const [attendancePeriods, setAttendancePeriods] = useState<AttendancePeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<AttendancePeriod | null>(null);
  const [payrollData, setPayrollData] = useState<PayrollEntry[]>([]);
  const [averageDaysPerMonth, setAverageDaysPerMonth] = useState<number>(30.4); // Default fallback
  const [weeklyAbsentPenaltyEnabled, setWeeklyAbsentPenaltyEnabled] = useState<boolean>(false);
  const [sundayBonusEnabled, setSundayBonusEnabled] = useState<boolean>(false);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{[key: string]: string | number}>({});
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);

  // Fetch salary config on component mount
  useEffect(() => {
    const loadSalaryConfig = async () => {
      try {
        const response = await apiCall('/api/salary-config/', { method: 'GET' });
        if (response && response.ok) {
          const data = await response.json();
          if (data && data.average_days_per_month) {
            setAverageDaysPerMonth(data.average_days_per_month);
          }
          setWeeklyAbsentPenaltyEnabled(!!data.weekly_absent_penalty_enabled);
          setSundayBonusEnabled(!!data.sunday_bonus_enabled);
        }
      } catch (error) {
        // Use default value if fetch fails
        logger.warn('Failed to load salary config, using default 30.4');
      }
    };
    loadSalaryConfig();
  }, []);

  useEffect(() => {
    fetchAttendancePeriods();
  }, []);

  // Convert PayrollEntry to PayrollData format for export
  const convertToPayrollData = (entries: PayrollEntry[]): PayrollData[] => {
    return entries.map(entry => ({
      id: 0, // Not available in PayrollEntry
      employee_id: entry.employee_id,
      employee_name: entry.employee_name,
      department: entry.department,
      basic_salary: entry.base_salary,
      total_days: entry.total_days,
      working_days: entry.working_days,
      present_days: entry.present_days,
      absent_days: entry.absent_days,
      off_days: entry.off_days,
      holiday_days: entry.holiday_days ?? 0,
      weekly_penalty_days: entry.weekly_penalty_days ?? 0,
      ot_hours: entry.ot_hours,
      late_minutes: entry.late_minutes,
      gross_salary: entry.gross_salary,
      ot_charges: entry.ot_charges,
      late_deduction: entry.late_deduction,
      tds_percentage: entry.tds_percentage,
      tds_amount: entry.tds_amount,
      salary_after_tds: entry.gross_salary - entry.tds_amount,
      total_advance_balance: entry.total_advance_balance || 0,
      advance_deduction_amount: entry.advance_deduction,
      remaining_advance_balance: entry.remaining_balance || 0,
      net_payable: entry.net_salary,
      is_paid: entry.is_paid,
      payment_date: undefined // Not available in PayrollEntry
    }));
  };

  const fetchAttendancePeriods = async () => {
    try {
      setLoading(true);
      
      const response = await apiCall('/api/months-with-attendance/');
      
      if (!response.ok) {
        logger.error('❌ API Error:', response.status, response.statusText);
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setAttendancePeriods(data.periods);
      } else {
        logger.error('❌ API returned success: false');
        logger.error('Error message:', data.error || 'Unknown error');
      }
    } catch (error) {
      logger.error('💥 Error fetching attendance periods:', error);
      // Show user-friendly error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to load attendance periods: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const calculatePayroll = async () => {
    if (!selectedPeriod) return;

    try {
      setCalculating(true);
      // Use ultra-fast payroll calculation for better performance
      const response = await apiCall('/api/calculate-simple-payroll-ultra-fast/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          year: selectedPeriod.year,
          month: selectedPeriod.month_num
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        logger.info( 'Payroll calculation data received:', data.payroll_data);
        logger.info( 'Sample employee data:', data.payroll_data?.[0]);
        logger.info('Working vs Present days sample:', data.payroll_data?.slice(0, 3).map((emp: PayrollEntry) => ({
          name: emp.employee_name,
          working_days: emp.working_days,
          present_days: emp.present_days,
          absent_days: emp.absent_days
        })));
        logger.info( 'Gross salary values:', data.payroll_data?.map((emp: PayrollEntry) => {
          // Calculate expected gross salary based on formula
          const expectedGross = ((emp.base_salary / emp.working_days) * emp.present_days) + (emp.ot_charges || 0) - (emp.late_deduction || 0);
          return { 
            name: emp.employee_name, 
            gross_salary: emp.gross_salary,
            expected_gross: expectedGross,
            base_salary: emp.base_salary,
            present_days: emp.present_days,
            working_days: emp.working_days,
            ot_charges: emp.ot_charges,
            late_deduction: emp.late_deduction,
            calculation: `(${emp.base_salary} / ${emp.working_days} * ${emp.present_days}) + ${emp.ot_charges || 0} - ${emp.late_deduction || 0} = ${expectedGross}`
          };
        }));
        setPayrollData(data.payroll_data);
        setSummary(data.summary);

        // Invalidate cached KPI data so overview components fetch fresh info
        clearSalaryDataCache();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      logger.error('Error calculating payroll:', error);
      alert('Failed to calculate payroll');
    } finally {
      setCalculating(false);
    }
  };

  const startEdit = (employeeId: string, entry: PayrollEntry) => {
    setEditingEntry(employeeId);
    setEditValues({
      net_salary: entry.net_salary,
      advance_deduction: entry.advance_deduction,
      tds_amount: entry.tds_amount
    });
  };

  const saveEdit = (employeeId: string) => {
    const currentEntry = payrollData.find(entry => entry.employee_id === employeeId);
    if (!currentEntry) return;

    const newAdvanceDeduction = Number(editValues.advance_deduction) || 0;
    const totalAdvanceBalance = currentEntry.total_advance_balance || 0;
    
    // Calculate salary after TDS (maximum deductible amount)
    const salaryAfterTds = currentEntry.gross_salary + currentEntry.ot_charges - currentEntry.late_deduction - currentEntry.tds_amount;
    const maxDeductible = Math.max(0, salaryAfterTds);
    
    // Validate advance deduction doesn't exceed balance or make salary negative
    if (newAdvanceDeduction > totalAdvanceBalance) {
      alert(`Advance deduction (₹${newAdvanceDeduction}) cannot exceed total balance (₹${totalAdvanceBalance})`);
      return;
    }
    
    if (newAdvanceDeduction > maxDeductible) {
      alert(`Advance deduction (₹${newAdvanceDeduction}) cannot exceed salary after TDS (₹${maxDeductible.toFixed(2)}). Net salary cannot be negative.`);
      return;
    }

    // Calculate remaining balance and new net salary
    const remainingBalance = totalAdvanceBalance - newAdvanceDeduction;
    const newNetSalary = salaryAfterTds - newAdvanceDeduction;

        // Update local data
        setPayrollData(prev => prev.map(entry => 
          entry.employee_id === employeeId 
        ? { 
            ...entry, 
            advance_deduction: newAdvanceDeduction,
            remaining_balance: remainingBalance,
            net_salary: newNetSalary
          }
            : entry
        ));

    // Update summary
    if (summary) {
      const oldNetSalary = currentEntry.net_salary;
      const netDifference = newNetSalary - oldNetSalary;
      setSummary(prev => prev ? {
        ...prev,
        total_net_salary: prev.total_net_salary + netDifference
      } : null);
    }

        setEditingEntry(null);
        setEditValues({});
  };

  const savePayrollPeriod = async () => {
    try {
      if (!selectedPeriod) {
        alert('Please select a period first');
        return;
      }

      // Prepare the data exactly as displayed (preserves manual edits)
      const payrollPeriodData = {
        year: selectedPeriod.year,
        month: selectedPeriod.month_num, // Use month number for consistency
        payroll_entries: payrollData.map(entry => ({
          employee_id: entry.employee_id,
          employee_name: entry.employee_name,
          department: entry.department,
          base_salary: entry.base_salary,
          working_days: entry.working_days,
          present_days: entry.present_days,
          absent_days: entry.absent_days,
          holiday_days: entry.holiday_days || 0,
          weekly_penalty_days: entry.weekly_penalty_days || 0,
          ot_hours: entry.ot_hours,
          late_minutes: entry.late_minutes,
          gross_salary: entry.gross_salary,
          ot_charges: entry.ot_charges,
          late_deduction: entry.late_deduction,
          tds_percentage: entry.tds_percentage,
          tds_amount: entry.tds_amount,
          total_advance_balance: entry.total_advance_balance || 0,
          advance_deduction: entry.advance_deduction,
          remaining_balance: entry.remaining_balance || 0,
          net_salary: entry.net_salary,
          is_paid: entry.is_paid || false
        }))
      };

      // Use the new direct save endpoint (no recalculation)
      const response = await apiCall('/api/save-payroll-period-direct/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payrollPeriodData)
      });

      if (response.ok) {
        const result = await response.json();
        const savedCount = result.saved_entries || payrollData.length || 0;
        alert(`Payroll period saved successfully! Saved ${savedCount} salary calculations as displayed.`);

        // Clear caches so overview reloads with new payroll data
        clearSalaryDataCache();

  // Stay on the current page so the user can review the results
  // If navigation is desired, consider using React Router's navigate for SPA navigation:
  // navigate('/hr-management/payroll-overview');
      } else {
        const error = await response.json();
        alert(`Failed to save payroll period: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      logger.error('Error saving payroll period:', error);
      alert('Error saving payroll period. Please try again.');
    }
  };



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Simple Payroll Calculator</h3>
          <p className="text-sm text-gray-600">Calculate payroll for months with attendance data</p>
        </div>
        <div className="flex items-end justify-end">
        {/* Add Advance Button - Always visible */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowAdvanceModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            Add Advance
          </button>
        </div>
      </div>
      </div>

      

      {/* Period Selection */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="font-medium text-gray-900 mb-4">Select Month with Attendance</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Available Periods
            </label>
            {loading ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                <SkeletonBase className="h-6 w-full" />
              </div>
            ) : (
              <Dropdown
                options={[
                  { value: '', label: 'Select a period' },
                  ...attendancePeriods.map((period) => ({
                    value: `${period.year}-${period.month_num}`,
                    label: `${period.month_display} (${period.employees_with_attendance} employees)`
                  }))
                ]}
                value={selectedPeriod ? `${selectedPeriod.year}-${selectedPeriod.month_num}` : ''}
                onChange={(value) => {
                  if (value === '') {
                    setSelectedPeriod(null);
                    return;
                  }
                  const [year, month_num] = value.split('-');
                  const period = attendancePeriods.find(p => 
                    p.year === parseInt(year) && p.month_num === parseInt(month_num)
                  );
                  setSelectedPeriod(period || null);
                }}
                placeholder="Select a period"
                loading={loading}
              />
            )}
          </div>
          
          <div className="flex items-end">
            <button
              onClick={calculatePayroll}
              disabled={calculating || !selectedPeriod || loading}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {calculating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Calculator size={16} />
              )}
              {calculating ? 'Calculating...' : loading ? 'Loading...' : 'Calculate Payroll'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <Users className="text-teal-600" size={20} />
              <div>
                <p className="text-sm text-gray-600">Total Employees</p>
                <p className="text-xl font-semibold text-gray-900">{summary.total_employees}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <IndianRupee className="text-teal-600" size={20} />
              <div>
                <p className="text-sm text-gray-600">Total Base</p>
                <p className="text-xl font-semibold text-gray-900">₹{summary.total_base_salary.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <IndianRupee className="text-blue-600" size={20} />
              <div>
                <p className="text-sm text-gray-600">Total OT Charges</p>
                <p className="text-xl font-semibold text-gray-900">₹{(payrollData?.reduce((sum, emp) => sum + (emp.ot_charges || 0), 0) || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <Timer className="text-red-600" size={20} />
              <div>
                <p className="text-sm text-gray-600">Total Late Deduction</p>
                <p className="text-xl font-semibold text-gray-900">₹{(payrollData?.reduce((sum, emp) => sum + (emp.late_deduction || 0), 0) || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <Calculator className="text-orange-600" size={20} />
              <div>
                <p className="text-sm text-gray-600">Total Gross</p>
                <p className="text-xl font-semibold text-gray-900">₹{summary.total_gross_salary.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <Receipt className="text-indigo-600" size={20} />
              <div>
                <p className="text-sm text-gray-600">Total TDS Amount</p>
                <p className="text-xl font-semibold text-gray-900">₹{(payrollData?.reduce((sum, emp) => sum + (emp.tds_amount || 0), 0) || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <CheckCircle className="text-purple-600" size={20} />
              <div>
                <p className="text-sm text-gray-600">Total Net</p>
                <p className="text-xl font-semibold text-gray-900">₹{summary.total_net_salary.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Payroll Calculation Table */}
      {payrollData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h4 className="font-medium text-gray-900">Detailed Payroll Calculation - {summary?.month_year}</h4>
              <p className="text-sm text-gray-600">Complete breakdown of salary calculations</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (payrollData.length > 0) {
                    const fileName = selectedPeriod 
                      ? `payroll_calculation_${selectedPeriod.month_display}_${selectedPeriod.year}` 
                      : 'payroll_calculation';
                    exportPayrollToExcel(convertToPayrollData(payrollData), fileName);
                  }
                }}
                disabled={payrollData.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <Download size={16} />
                Download Excel
              </button>
              <button
                onClick={savePayrollPeriod}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                <CheckCircle size={16} />
                Save 
              </button>
            </div>
          </div>
          
          <div className="overflow-auto max-h-[70vh]">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-20">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-21 border-r border-gray-300">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Base Salary</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Days</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Holidays</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Off Days</th>
                  {/* <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Working Days</th> */}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid Days</th>
                  {weeklyAbsentPenaltyEnabled && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Penalty Days
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OT Hours</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OT Charges</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late (Min)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late Deduction</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gross Salary</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TDS %</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TDS Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Advance Balance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Advance Deduction</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Salary</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payrollData.map((entry) => (
                  <tr key={entry.employee_id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-gray-200">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{entry.employee_name}</div>
                        <div className="text-sm text-gray-500">{entry.employee_id}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{entry.department}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">₹{entry.base_salary.toLocaleString()}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{entry.total_days || summary?.total_days || 30}</td>
                    {/* <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{entry.working_days}</td> */}
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                      {entry.holiday_days || 0}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{entry.off_days || 0}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.raw_present_days || entry.present_days - (entry.holiday_days || 0)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{entry.absent_days}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.paid_days || entry.present_days}
                    </td>
                    {weeklyAbsentPenaltyEnabled && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(entry as any).employee_weekly_rules_enabled === false ? 'NA' : (entry.weekly_penalty_days ?? 0)}
                      </td>
                    )}
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{entry.ot_hours}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">₹{(entry.ot_charges || 0).toLocaleString()}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{entry.late_minutes || 0}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">₹{(entry.late_deduction || 0).toLocaleString()}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>₹{(entry.gross_salary || 0).toLocaleString()}</div>
                      {/* {(() => {
                        const expectedGross = ((entry.base_salary / entry.working_days) * entry.present_days) + (entry.ot_charges || 0) - (entry.late_deduction || 0);
                        const isDiscrepancy = Math.abs((entry.gross_salary || 0) - expectedGross) > 0.01;
                        return isDiscrepancy ? (
                          <div className="text-xs text-red-600">
                            Expected: ₹{expectedGross.toLocaleString()}
                          </div>
                        ) : null;
                      })()} */}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{entry.tds_percentage || 0}%</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">₹{(entry.tds_amount || 0).toLocaleString()}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">₹{(entry.total_advance_balance || 0).toLocaleString()}</div>
                      <div className="text-xs text-gray-500">Remaining: ₹{(entry.remaining_balance || 0).toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {editingEntry === entry.employee_id ? (
                        <div className="flex items-center gap-2">
                        <input
                          type="number"
                            value={editValues.advance_deduction || 0}
                          onChange={(e) => setEditValues(prev => ({
                            ...prev,
                              advance_deduction: parseFloat(e.target.value) || 0
                          }))}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                            max={entry.total_advance_balance || 0}
                          />
                          <button
                            onClick={() => saveEdit(entry.employee_id)}
                            className="text-teal-600 hover:text-teal-800"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setEditingEntry(null)}
                            className="text-red-600 hover:text-red-800"
                          >
                            ✗
                          </button>
                        </div>
                        ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-900">₹{(entry.advance_deduction || 0).toLocaleString()}</span>
                          <button
                            onClick={() => startEdit(entry.employee_id, entry)}
                            className="text-orange-600 hover:text-orange-800 text-xs"
                          >
                            Edit
                          </button>
                        </div>
                        )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-teal-600">₹{(entry.net_salary || 0).toLocaleString()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Calculation Formula Section */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <h5 className="text-sm font-medium text-gray-900 mb-2">Calculation Formula:</h5>
              <div className="text-xs text-gray-600 space-y-1">
                <p><span className="font-medium">Paid Days</span> = Present Days + Paid Holidays (Off days are marked as Present)</p>
                <p><span className="font-medium">Daily Rate</span> = Base Salary ÷ {averageDaysPerMonth}</p>
                <p><span className="font-medium">Base Pay</span> = Daily Rate × Paid Days</p>
                <p><span className="font-medium">Gross Salary</span> = Base Pay + OT Charges - Late Deduction</p>
                <p><span className="font-medium">Advance Deduction</span> = Min(50% of Salary After TDS, Total Advance Balance)</p>
                <p><span className="font-medium">Net Salary</span> = Gross Salary - TDS Amount - Advance Deduction</p>
                <p><span className="font-medium">OT Charges</span> = OT Hours × OT Rate per Hour</p>
                <p className="text-xs text-gray-500 ml-2">
                  <strong>OT Rate Formula:</strong> Base Salary ÷ ((Shift Hours - Break Time) × Average Days Per Month)
                  <br />
                  <span className="ml-2">• Raw Shift Hours = End Time - Start Time</span>
                  <br />
                  <span className="ml-2">• Effective Shift Hours = Raw Shift Hours - Break Time</span>
                  <br />
                  <span className="ml-2">• OT Rate = Base Salary ÷ (Effective Shift Hours × Average Days Per Month)</span>
                </p>
                <p><span className="font-medium">Late Deduction</span> = Late Minutes × (OT Rate ÷ 60)</p>
                <p><span className="font-medium text-orange-600">Advance Balance</span> = Total of all approved advances for employee</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <AdvanceManager 
        showModal={showAdvanceModal}
        onClose={() => setShowAdvanceModal(false)}
      />
    </div>
  );
};

export default SimplePayrollCalculator; 