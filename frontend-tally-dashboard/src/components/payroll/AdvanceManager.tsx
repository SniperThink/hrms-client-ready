import React, { useState, useEffect } from 'react';
import { Search, Plus, DollarSign, User, AlertCircle, CheckCircle, Edit, Trash2, Loader2 } from 'lucide-react';
import { apiCall } from '../../services/api';
import Dropdown, { DropdownOption } from '../Dropdown';
import MonthYearPicker from '../MonthYearPicker';
import { logger } from '../../utils/logger';

interface Employee {
  id: string | number;
  employee_id: string;
  name: string;
  department: string;
  designation: string;
}

interface AdvanceRecord {
  id: number;
  employee_id: string;
  employee_name: string;
  amount: number;
  advance_date: string;
  for_month: string;
  payment_method: string;
  remarks: string;
  remaining_balance: number;
  is_active: boolean;
  is_fully_repaid: boolean;
  status: string;
  status_display: string;
  amount_formatted: string;
  created_at: string;
}

interface AdvanceManagerProps {
  showModal: boolean;
  onClose: () => void;
}

const AdvanceManager: React.FC<AdvanceManagerProps> = ({ showModal, onClose }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [advancesLoading, setAdvancesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    amountRange: '',
    paymentMethod: '',
    status: '',
    dateRange: '',
    department: ''
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<AdvanceRecord | null>(null);

  // Employee search states
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const [advanceForm, setAdvanceForm] = useState({
    employee_id: '',
    amount: '',
    for_month: new Date().toISOString().slice(0, 7), // YYYY-MM format
    payment_method: 'CASH',
    remarks: ''
  });

  const paymentMethodOptions: DropdownOption[] = [
    { value: 'CASH', label: 'Cash' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'CHEQUE', label: 'Cheque' },
    { value: 'UPI', label: 'UPI' }
  ];

  // Combined filter options for single dropdown
  const allFilterOptions: DropdownOption[] = [
    // Separator
    { value: 'separator1', label: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', disabled: true },

    // Amount Range Filters
    { value: 'amount_header', label: 'AMOUNT RANGE', disabled: true },
    { value: 'amount_0_5000', label: '  ₹0 - ₹5,000' },
    { value: 'amount_5000_10000', label: '  ₹5,000 - ₹10,000' },
    { value: 'amount_10000_25000', label: '  ₹10,000 - ₹25,000' },
    { value: 'amount_25000_50000', label: '  ₹25,000 - ₹50,000' },
    { value: 'amount_50000_plus', label: '  ₹50,000+' },

    // Separator
    { value: 'separator2', label: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', disabled: true },

    // Payment Method Filters
    { value: 'payment_header', label: 'PAYMENT METHOD', disabled: true },
    { value: 'payment_CASH', label: '  Cash' },
    { value: 'payment_BANK_TRANSFER', label: '  Bank Transfer' },
    { value: 'payment_CHEQUE', label: '  Cheque' },
    { value: 'payment_UPI', label: '  UPI' },

    // Separator
    { value: 'separator3', label: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', disabled: true },

    // Status Filters
    { value: 'status_header', label: 'STATUS', disabled: true },
    { value: 'status_PENDING', label: '  Pending' },
    { value: 'status_PARTIALLY_PAID', label: '  Partially Paid' },
    { value: 'status_REPAID', label: '  Fully Repaid' },
    { value: 'status_ACTIVE', label: '  Active' },

    // Separator
    { value: 'separator4', label: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', disabled: true },

    // Date Range Filters
    { value: 'date_header', label: 'DATE RANGE', disabled: true },
    { value: 'date_today', label: '  Today' },
    { value: 'date_this_week', label: '  This Week' },
    { value: 'date_this_month', label: '  This Month' },
    { value: 'date_last_month', label: '  Last Month' },
    { value: 'date_last_3_months', label: '  Last 3 Months' },
    { value: 'date_this_year', label: '  This Year' },

    // Separator
    { value: 'separator5', label: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', disabled: true },

    // Department Filters
    { value: 'dept_header', label: 'DEPARTMENT', disabled: true },
    ...Array.from(new Set(employees.map(emp => emp.department)))
      .filter(dept => dept)
      .map(dept => ({ value: `dept_${dept}`, label: `  ${dept}` }))
  ];

  useEffect(() => {
    if (showModal) {
      loadEmployees();
      loadAdvances();
    } else {
      // Clear all filters and form when modal is closed
      clearAllFilters();
      resetAddForm();
    }
  }, [showModal]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.employee-search-container')) {
        setShowEmployeeDropdown(false);
      }
    };

    if (showEmployeeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmployeeDropdown]);

  // Optimized employee loading: Only loads active employees with minimal data
  // Uses /api/employees/active_employees_list/ instead of full directory_data for faster performance
  const loadEmployees = async () => {
    try {
      setEmployeesLoading(true);
      const response = await apiCall('/api/employees/active_employees_list/');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const employeesData = await response.json();

      // The API returns only active employees with essential fields
      const employeesArray: Employee[] = Array.isArray(employeesData) ? employeesData : [];

      setEmployees(employeesArray);
    } catch (error) {
      logger.error('Error loading active employees:', error);
      setEmployees([]);
    } finally {
      setEmployeesLoading(false);
    }
  };

  const loadAdvances = async () => {
    try {
      setAdvancesLoading(true);
      const response = await apiCall('/api/advance-payments/');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const advancesData = await response.json();

      // The API returns an object with success, count, and results fields
      const advancesArray: AdvanceRecord[] = advancesData?.results && Array.isArray(advancesData.results)
        ? advancesData.results
        : [];

      setAdvances(advancesArray);
    } catch (error) {
      logger.error('Error loading advances:', error);
      setAdvances([]);
    } finally {
      setAdvancesLoading(false);
    }
  };

  const handleAddAdvance = async () => {
    try {
      // Format month from YYYY-MM to 'Mon YYYY' (e.g., '2025-03' to 'Mar 2025')
      const [year, month] = advanceForm.for_month.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formattedMonth = `${monthNames[parseInt(month) - 1]} ${year}`;

      const requestData = {
        ...advanceForm,
        for_month: formattedMonth,
        amount: parseFloat(advanceForm.amount)
      };

      await apiCall('/api/advance-payments/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      // Reset form and reload data
      setAdvanceForm({
        employee_id: '',
        amount: '',
        for_month: new Date().toISOString().slice(0, 7),
        payment_method: 'CASH',
        remarks: ''
      });
      setEmployeeSearchQuery('');
      setShowEmployeeDropdown(false);
      setShowAddForm(false);
      loadAdvances();
      alert('Advance payment added successfully!');
    } catch (error) {
      logger.error('Error adding advance:', error);
      alert('Failed to add advance payment');
    }
  };

  const handleEditAdvance = async () => {
    if (!editingAdvance) return;

    try {
      // Format month from YYYY-MM to 'Mon YYYY' (e.g., '2025-03' to 'Mar 2025')
      const [year, month] = advanceForm.for_month.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formattedMonth = `${monthNames[parseInt(month) - 1]} ${year}`;

      const requestData = {
        ...advanceForm,
        for_month: formattedMonth,
        amount: parseFloat(advanceForm.amount)
      };

      await apiCall(`/api/advance-payments/${editingAdvance.id}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      setEditingAdvance(null);
      setAdvanceForm({
        employee_id: '',
        amount: '',
        for_month: new Date().toISOString().slice(0, 7),
        payment_method: 'CASH',
        remarks: ''
      });
      setEmployeeSearchQuery('');

      setShowEmployeeDropdown(false);
      loadAdvances();
      alert('Advance payment updated successfully!');
    } catch (error) {
      logger.error('Error updating advance:', error);
      alert('Failed to update advance payment');
    }
  };

  const handleDeleteAdvance = async (advanceId: number) => {
    if (!confirm('Are you sure you want to delete this advance payment?')) return;

    try {
      await apiCall(`/api/advance-payments/${advanceId}/`, {
        method: 'DELETE'
      });

      loadAdvances();
      alert('Advance payment deleted successfully!');
    } catch (error) {
      logger.error('Error deleting advance:', error);
      alert('Failed to delete advance payment');
    }
  };

  const startEdit = (advance: AdvanceRecord) => {
    setEditingAdvance(advance);
    
    // Convert for_month from 'Mar 2025' to 'YYYY-MM' format
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let formattedForMonth = new Date().toISOString().slice(0, 7); // default to current month
    
    if (advance.for_month) {
      const parts = advance.for_month.split(' ');
      if (parts.length === 2) {
        const monthIndex = monthNames.indexOf(parts[0]);
        if (monthIndex !== -1) {
          const monthNumber = (monthIndex + 1).toString().padStart(2, '0');
          formattedForMonth = `${parts[1]}-${monthNumber}`;
        }
      }
    }
    
    setAdvanceForm({
      employee_id: advance.employee_id,
      amount: advance.amount.toString(),
      for_month: formattedForMonth,
      payment_method: advance.payment_method,
      remarks: advance.remarks
    });

    // Set employee search state for editing
    const employee = employees.find(emp => emp.employee_id === advance.employee_id);
    if (employee) {

      setEmployeeSearchQuery(employee.name);
    }

    setShowAddForm(true);
  };

  const cancelEdit = () => {
    setEditingAdvance(null);
    setAdvanceForm({
      employee_id: '',
      amount: '',
      for_month: new Date().toISOString().slice(0, 7),
      payment_method: 'CASH',
      remarks: ''
    });
    setShowAddForm(false);
    setEmployeeSearchQuery('');

    setShowEmployeeDropdown(false);
  };

  // Filter employees based on search query (lightning fast)
  const filteredEmployees = employeeSearchQuery.length >= 2
    ? employees.filter(employee => {
      const matchesName = employee.name?.toLowerCase().includes(employeeSearchQuery.toLowerCase());
      const matchesId = employee.employee_id?.toLowerCase().includes(employeeSearchQuery.toLowerCase());
      const matchesDept = employee.department?.toLowerCase().includes(employeeSearchQuery.toLowerCase());
      return matchesName || matchesId || matchesDept;
    }).slice(0, 10) // Limit to 10 results for performance
    : [];

  const handleEmployeeSelect = (employee: Employee) => {

    setEmployeeSearchQuery(employee.name);
    setAdvanceForm(prev => ({ ...prev, employee_id: employee.employee_id }));
    setShowEmployeeDropdown(false);
  };

  const handleEmployeeSearchChange = (value: string) => {
    setEmployeeSearchQuery(value);
    setShowEmployeeDropdown(value.length >= 2);
    setHighlightedIndex(-1);
    if (value.length < 2) {

      setAdvanceForm(prev => ({ ...prev, employee_id: '' }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showEmployeeDropdown || filteredEmployees.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredEmployees.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredEmployees.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredEmployees.length) {
          handleEmployeeSelect(filteredEmployees[highlightedIndex]);
        }
        break;
      case 'Escape':
        setShowEmployeeDropdown(false);
        setHighlightedIndex(-1);
        break;
    }
  };


  // Helper function to check amount range
  const isAmountInRange = (amount: number, range: string): boolean => {
    if (!range) return true;

    switch (range) {
      case 'amount_0_5000':
        return amount >= 0 && amount <= 5000;
      case 'amount_5000_10000':
        return amount > 5000 && amount <= 10000;
      case 'amount_10000_25000':
        return amount > 10000 && amount <= 25000;
      case 'amount_25000_50000':
        return amount > 25000 && amount <= 50000;
      case 'amount_50000_plus':
        return amount > 50000;
      default:
        return true;
    }
  };

  // Helper function to check date range
  const isDateInRange = (dateString: string, range: string): boolean => {
    if (!range) return true;

    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (range) {
      case 'date_today':
        return date.toDateString() === today.toDateString();
      case 'date_this_week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        return date >= weekStart && date <= today;
      case 'date_this_month':
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      case 'date_last_month':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return date >= lastMonth && date <= lastMonthEnd;
      case 'date_last_3_months':
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        return date >= threeMonthsAgo && date <= now;
      case 'date_this_year':
        return date.getFullYear() === now.getFullYear();
      default:
        return true;
    }
  };

  // Filter advances based on search and all filters
  const filteredAdvances = advances.filter(advance => {
    const matchesSearch = advance.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(advance.employee_id).toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAmount = isAmountInRange(advance.amount, filters.amountRange);

    const matchesPaymentMethod = !filters.paymentMethod || advance.payment_method === filters.paymentMethod;

    const matchesStatus = !filters.status || advance.status === filters.status;

    const matchesDateRange = isDateInRange(advance.advance_date, filters.dateRange);

    // Get employee department for department filter
    const employee = employees.find(emp => emp.employee_id === advance.employee_id);
    const matchesDepartment = !filters.department || employee?.department === filters.department;

    return matchesSearch && matchesAmount && matchesPaymentMethod &&
      matchesStatus && matchesDateRange && matchesDepartment;
  });

  // Handle single dropdown filter selection
  const handleFilterChange = (value: string) => {
    // Keep existing filters and only update the specific category
    const newFilters = { ...filters };

    // Set the appropriate filter based on the selected value
    if (value.startsWith('amount_')) {
      newFilters.amountRange = value;
    } else if (value.startsWith('payment_')) {
      newFilters.paymentMethod = value.replace('payment_', '');
    } else if (value.startsWith('status_')) {
      newFilters.status = value.replace('status_', '');
    } else if (value.startsWith('date_')) {
      newFilters.dateRange = value;
    } else if (value.startsWith('dept_')) {
      newFilters.department = value.replace('dept_', '');
    }

    setFilters(newFilters);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({
      amountRange: '',
      paymentMethod: '',
      status: '',
      dateRange: '',
      department: ''
    });
    setSearchQuery('');
  };

  // Reset add advance form
  const resetAddForm = () => {
    setAdvanceForm({
      employee_id: '',
      amount: '',
      for_month: new Date().toISOString().slice(0, 7),
      payment_method: 'CASH',
      remarks: ''
    });
    setEmployeeSearchQuery('');
    setShowEmployeeDropdown(false);
    setShowAddForm(false);
    setEditingAdvance(null);
    setHighlightedIndex(-1);
  };

  // Check if any filters are active
  const hasActiveFilters = Object.values(filters).some(filter => filter !== '') || searchQuery !== '';

  // Get current filter display value
  const getCurrentFilterDisplay = () => {
    const activeFilters = [];

    if (filters.amountRange) {
      const option = allFilterOptions.find(opt => opt.value === filters.amountRange);
      activeFilters.push(option?.label?.trim() || 'Amount Filter');
    }
    if (filters.paymentMethod) {
      const option = allFilterOptions.find(opt => opt.value === `payment_${filters.paymentMethod}`);
      activeFilters.push(option?.label?.trim() || 'Payment Filter');
    }
    if (filters.status) {
      const option = allFilterOptions.find(opt => opt.value === `status_${filters.status}`);
      activeFilters.push(option?.label?.trim() || 'Status Filter');
    }
    if (filters.dateRange) {
      const option = allFilterOptions.find(opt => opt.value === filters.dateRange);
      activeFilters.push(option?.label?.trim() || 'Date Filter');
    }
    if (filters.department) {
      activeFilters.push(filters.department);
    }

    if (activeFilters.length > 0) {
      return `${activeFilters.length} filter${activeFilters.length > 1 ? 's' : ''} active`;
    }

    return 'Select Filter...';
  };

  // Get current month's advances and remaining balances
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthAdvances = filteredAdvances.filter(advance =>
    advance.for_month === currentMonth && advance.is_active
  );

  const totalAdvancesThisMonth = currentMonthAdvances.reduce((sum, advance) => sum + advance.amount, 0);
  const totalRemainingBalance = filteredAdvances
    .filter(advance => advance.is_active && advance.remaining_balance > 0)
    .reduce((sum, advance) => sum + advance.remaining_balance, 0);

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Advance Payments Manager</h2>
              <p className="text-sm text-gray-600">Manage employee advance payments with flexible month selection</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] hide-scrollbar">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
              <div className="flex items-center gap-3">
                <DollarSign className="text-teal-600" size={24} />
                <div>
                  <p className="text-sm text-teal-700">This Month Advances</p>
                  <p className="text-xl font-semibold text-teal-900">₹{totalAdvancesThisMonth.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="flex items-center gap-3">
                <AlertCircle className="text-orange-600" size={24} />
                <div>
                  <p className="text-sm text-orange-700">Total Remaining Balance</p>
                  <p className="text-xl font-semibold text-orange-900">₹{totalRemainingBalance.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
              <div className="flex items-center gap-3">
                <CheckCircle className="text-teal-600" size={24} />
                <div>
                  <p className="text-sm text-teal-700">Active Advances</p>
                  <p className="text-xl font-semibold text-teal-900">
                    {filteredAdvances.filter(a => a.is_active && a.remaining_balance > 0).length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mb-6">
            {/* Search Bar and Filter Row */}
            <div className="flex items-center space-x-8 gap-4 mb-4">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search by employee name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* Filter Dropdown */}
              <div className="flex-1 max-w-sm">
                <Dropdown
                  options={allFilterOptions}
                  value={getCurrentFilterDisplay()}
                  onChange={handleFilterChange}
                  placeholder="Select Filter..."
                />
              </div>


              {/* Add Advance Button */}
              <button
                onClick={() => setShowAddForm(true)}
                disabled={employeesLoading || advancesLoading}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {employeesLoading || advancesLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                {employeesLoading || advancesLoading ? 'Loading...' : 'Add Advance'}
              </button>
            </div>

            {/* Active Filter Display */}
            {hasActiveFilters && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                    <span>Active filters:</span>
                    {searchQuery && (
                      <span className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-xs">
                        Search: "{searchQuery}"
                      </span>
                    )}
                    {filters.amountRange && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                        {allFilterOptions.find(opt => opt.value === filters.amountRange)?.label?.trim()}
                      </span>
                    )}
                    {filters.paymentMethod && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                        {allFilterOptions.find(opt => opt.value === `payment_${filters.paymentMethod}`)?.label?.trim()}
                      </span>
                    )}
                    {filters.status && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">
                        {allFilterOptions.find(opt => opt.value === `status_${filters.status}`)?.label?.trim()}
                      </span>
                    )}
                    {filters.dateRange && (
                      <span className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-xs">
                        {allFilterOptions.find(opt => opt.value === filters.dateRange)?.label?.trim()}
                      </span>
                    )}
                    {filters.department && (
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs">
                        {filters.department}
                      </span>
                    )}
                  </div>

                  {/* Clear All Filters Button - Bottom Right */}
                  <button
                    onClick={clearAllFilters}
                    className="px-3 py-2 text-sm text-teal-600 rounded-lg hover:text-teal-700 flex items-center gap-2 whitespace-nowrap"
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
              <h3 className="font-medium text-gray-900 mb-4">
                {editingAdvance ? 'Edit Advance Payment' : 'Add New Advance Payment'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative employee-search-container">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={employeeSearchQuery}
                      onChange={(e) => handleEmployeeSearchChange(e.target.value)}
                      onFocus={() => setShowEmployeeDropdown(employeeSearchQuery.length >= 2)}
                      onKeyDown={handleKeyDown}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                      placeholder="Type employee name to search..."
                      disabled={!!editingAdvance}
                      autoComplete="off"
                    />
                    <User className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />

                    {/* Search Results Dropdown */}
                    {showEmployeeDropdown && filteredEmployees.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto hide-scrollbar">
                        {filteredEmployees.map((employee, index) => (
                          <div
                            key={employee.employee_id}
                            onClick={() => handleEmployeeSelect(employee)}
                            className={`px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 ${index === highlightedIndex
                                ? 'bg-teal-100 text-teal-900'
                                : 'hover:bg-teal-50'
                              }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-gray-900">{employee.name}</div>
                                <div className="text-sm text-gray-500">
                                  ID: {employee.employee_id} • {employee.department}
                                </div>
                              </div>
                              <div className="text-xs text-gray-400">
                                {employee.designation}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Loading Employees */}
                    {showEmployeeDropdown && employeesLoading && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                        <div className="px-4 py-3 flex items-center justify-center gap-2 text-gray-500">
                          <Loader2 size={16} className="animate-spin" />
                          Loading data...
                        </div>
                      </div>
                    )}

                    {/* No Results Message */}
                    {showEmployeeDropdown && !employeesLoading && employeeSearchQuery.length >= 2 && filteredEmployees.length === 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                        <div className="px-4 py-3 text-gray-500 text-center">
                          No employees found matching "{employeeSearchQuery}"
                        </div>
                      </div>
                    )}

                    {/* Helper Text */}
                    {employeeSearchQuery.length > 0 && employeeSearchQuery.length < 2 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                        <div className="px-4 py-3 text-gray-400 text-center text-sm">
                          Type at least 2 characters to search
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={advanceForm.amount}
                    onChange={(e) => setAdvanceForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    placeholder="Enter amount"
                    min="0"
                    step="0.01"
                  />
                </div>

                <MonthYearPicker
                  value={advanceForm.for_month}
                  onChange={(value) => setAdvanceForm(prev => ({ ...prev, for_month: value }))}
                  label="For Month"
                />

                <div>
                  <Dropdown
                    options={paymentMethodOptions}
                    value={advanceForm.payment_method}
                    onChange={(value) => setAdvanceForm(prev => ({ ...prev, payment_method: value }))}
                    placeholder="Select Payment Method"
                    label="Payment Method"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Remarks
                  </label>
                  <input
                    type="text"
                    value={advanceForm.remarks}
                    onChange={(e) => setAdvanceForm(prev => ({ ...prev, remarks: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    placeholder="Optional remarks"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4">
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={editingAdvance ? handleEditAdvance : handleAddAdvance}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                  disabled={!advanceForm.employee_id || !advanceForm.amount}
                >
                  {editingAdvance ? 'Update' : 'Add'} Advance
                </button>
              </div>
            </div>
          )}

          {/* Advances Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-20">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      For Month
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Remaining Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {advancesLoading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center">
                        <div className="flex items-center justify-center gap-2 text-gray-500">
                          <Loader2 size={20} className="animate-spin" />
                          Loading advance records...
                        </div>
                      </td>
                    </tr>
                  ) : filteredAdvances.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        No advance records found
                      </td>
                    </tr>
                  ) : (
                    filteredAdvances.map((advance) => (
                      <tr key={advance.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-gray-200">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{advance.employee_name}</div>
                            <div className="text-sm text-gray-500">ID: {advance.employee_id}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₹{advance.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {advance.for_month}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${advance.remaining_balance > 0 ? 'text-orange-600' : 'text-teal-600'
                            }`}>
                            ₹{advance.remaining_balance.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {advance.payment_method}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(advance.advance_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${advance.status === 'REPAID'
                              ? 'bg-teal-100 text-teal-800'
                              : advance.status === 'PARTIALLY_PAID'
                                ? 'bg-yellow-100 text-yellow-800'
                                : advance.status === 'PENDING'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-gray-100 text-gray-800'
                            }`}>
                            {advance.status_display || advance.status || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEdit(advance)}
                              className="text-teal-600 hover:text-teal-900 p-1 rounded hover:bg-teal-50"
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteAdvance(advance.id)}
                              className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )))}
                </tbody>
              </table>
            </div>

            {!advancesLoading && filteredAdvances.length === 0 && (
              <div className="text-center py-12">
                <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No advance payments found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {hasActiveFilters ? 'Try adjusting your search filters or clear all filters to see all records.' : 'Get started by adding a new advance payment.'}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="mt-3 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvanceManager;
