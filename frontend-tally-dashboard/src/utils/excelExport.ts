import * as XLSX from 'xlsx';

export interface EmployeeData {
  id: number;
  employee_id: string;
  name: string;
  mobile_number: string;
  email: string;
  department: string;
  designation: string;
  employment_type: string;
  date_of_joining?: string;
  branch_location: string;
  attendance: string;
  ot_hours: string;
  late_hours: string;
  days_present?: string;
  days_absent?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  basic_salary?: string;
  is_active: boolean;
  inactive_marked_at?: string | null;
  off_days?: string;
}

export interface PayrollData {
  id: number;
  employee_id: string;
  employee_name: string;
  department: string;
  basic_salary: number;
  working_days: number;
  present_days: number;
  absent_days: number;
  ot_hours: number;
  late_minutes: number;
  gross_salary: number;
  ot_charges: number;
  late_deduction: number;
  tds_percentage: number;
  tds_amount: number;
  salary_after_tds: number;
  total_advance_balance: number;
  advance_deduction_amount: number;
  remaining_advance_balance: number;
  net_payable: number;
  is_paid: boolean;
  payment_date?: string;
}

export const exportToExcel = (data: EmployeeData[], fileName: string = 'employees') => {
  // Define headers with proper capitalization
  const headers = [
    'Employee ID',
    'Employee Name',
    'Mobile Number',
    'Email',
    'Department',
    'Designation',
    'Employment Type',
    'Branch Location',
    'Attendance',
    'OT Hours',
    'Late Hours',
    'Shift Start Time',
    'Shift End Time',
    'Basic Salary',
    'Off Days'
  ];

  // Create worksheet data with a blank row after headers
  const wsData = [
    headers,
    [], // Empty row for spacing
    ...data.map(item => [
      item.employee_id,
      item.name,
      item.mobile_number,
      item.email,
      item.department,
      item.designation,
      item.employment_type,
      item.branch_location,
      item.attendance,
      item.ot_hours,
      item.late_hours,
      item.shiftStartTime || '-',
      item.shiftEndTime || '-',
      item.basic_salary || '-',
      item.off_days || 'None'
    ])
  ];

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  const columnWidths = headers.map(() => ({ wch: 15 }));
  worksheet['!cols'] = columnWidths;

  // Apply bold style to headers
  const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!worksheet[cellRef]) continue;
    
    worksheet[cellRef].s = {
      font: {
        bold: true,
        sz: 12
      },
      alignment: {
        horizontal: 'center'
      }
    };
  }

  // Create workbook and add the worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');

  // Generate Excel file
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportPayrollToExcel = (data: PayrollData[], fileName: string = 'payroll_details') => {
  // Define headers for payroll data
  const headers = [
    'Employee ID',
    'Employee Name',
    'Department',
    'Basic Salary',
    'Working Days',
    'Present Days',
    'Absent Days',
    'OT Hours',
    'OT Charges',
    'Late Minutes',
    'Late Deduction',
    'Gross Salary',
    'TDS %',
    'TDS Amount',
    'Salary After TDS',
    'Advance Balance',
    'Advance Deduction',
    'Remaining Advance Balance',
    'Net Payable',
    'Payment Status',
    'Payment Date'
  ];

  // Create worksheet data with a blank row after headers
  const wsData = [
    headers,
    [], // Empty row for spacing
    ...data.map(item => [
      item.employee_id,
      item.employee_name,
      item.department,
      item.basic_salary,
      item.working_days,
      item.present_days,
      item.absent_days,
      item.ot_hours,
      item.ot_charges,
      item.late_minutes,
      item.late_deduction,
      item.gross_salary,
      `${item.tds_percentage}%`,
      item.tds_amount,
      item.salary_after_tds,
      item.total_advance_balance,
      item.advance_deduction_amount,
      item.remaining_advance_balance,
      item.net_payable,
      item.is_paid ? 'Paid' : 'Pending',
      item.payment_date || '-'
    ])
  ];

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  const columnWidths = [
    { wch: 12 }, // Employee ID
    { wch: 20 }, // Employee Name
    { wch: 15 }, // Department
    { wch: 12 }, // Basic Salary
    { wch: 12 }, // Working Days
    { wch: 12 }, // Present Days
    { wch: 12 }, // Absent Days
    { wch: 10 }, // OT Hours
    { wch: 12 }, // OT Charges
    { wch: 12 }, // Late Minutes
    { wch: 15 }, // Late Deduction
    { wch: 12 }, // Gross Salary
    { wch: 8 },  // TDS %
    { wch: 12 }, // TDS Amount
    { wch: 15 }, // Salary After TDS
    { wch: 15 }, // Advance Balance
    { wch: 15 }, // Advance Deduction
    { wch: 20 }, // Remaining Advance Balance
    { wch: 12 }, // Net Payable
    { wch: 12 }, // Payment Status
    { wch: 12 }  // Payment Date
  ];
  worksheet['!cols'] = columnWidths;

  // Apply bold style to headers
  const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!worksheet[cellRef]) continue;
    
    worksheet[cellRef].s = {
      font: {
        bold: true,
        sz: 12
      },
      alignment: {
        horizontal: 'center'
      }
    };
  }

  // Create workbook and add the worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Payroll Details');

  // Generate Excel file
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}; 