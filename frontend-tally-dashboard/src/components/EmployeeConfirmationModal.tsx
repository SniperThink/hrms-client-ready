import React, { useState, useEffect, useCallback } from 'react';
import { X, Users, AlertTriangle, CheckCircle, UserPlus, Calendar, UserX, Power } from 'lucide-react';
import CalendarPopup from './CalendarPopup';
import { apiCall } from '../services/api';
import { logger } from '../utils/logger';

interface MissingEmployee {
  employee_id: string;
  name: string;
  first_name: string;
  last_name: string;
  department: string;
  row_number: number;
  date_of_joining?: string; // YYYY-MM-DD optional date selected by the user
  basic_salary?: number; // Optional basic salary field
}

interface InactiveEmployee {
  employee_id: string;
  name: string;
  department: string;
  row_number: number;
  id: number; // Database ID for API calls
  is_active: boolean;
}

interface EmployeeConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (missingEmployees: MissingEmployee[]) => void;
  missingEmployees: MissingEmployee[];
  uploadType: 'attendance' | 'salary';
}

const EmployeeConfirmationModal: React.FC<EmployeeConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  missingEmployees,
  uploadType
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isCheckingInactive, setIsCheckingInactive] = useState(false);
  const [joinDates, setJoinDates] = useState<Record<string, string>>({});
  const [basicSalaries, setBasicSalaries] = useState<Record<string, number>>({});
  const [openCalendar, setOpenCalendar] = useState<{
    id: string | null;
    position?: { top: number; left: number; width: number };
  }>({ id: null });
  
  // Separate missing and inactive employees
  const [trulyMissingEmployees, setTrulyMissingEmployees] = useState<MissingEmployee[]>([]);
  const [inactiveEmployees, setInactiveEmployees] = useState<InactiveEmployee[]>([]);
  const [activatingEmployees, setActivatingEmployees] = useState<Set<number>>(new Set());
  const [checkCompleted, setCheckCompleted] = useState(false);

  // Check which employees are inactive vs truly missing
  const checkForInactiveEmployees = useCallback(async () => {
    setIsCheckingInactive(true);
    const inactive: InactiveEmployee[] = [];
    const missing: MissingEmployee[] = [];

    try {
      logger.info(`Checking ${missingEmployees.length} employees for inactive status...`);
      
      // Check each employee to see if they exist but are inactive
      for (const emp of missingEmployees) {
        try {
          const employeeId = emp.employee_id.trim();
          const name = emp.name.trim();
          const department = (emp.department || '').trim();
          
          logger.info(`Checking employee: name="${name}", department="${department}"`);
          
          // Query by name and department instead of employee_id
          const params = new URLSearchParams({
            name: name,
            department: department || ''
          });
          
          const response = await apiCall(
            `/api/employees/profile_by_employee_id/?${params.toString()}`
          );
          
          if (response.ok) {
            const data = await response.json();
            const employee = data.employee;
            
            logger.info(`Employee found: name="${name}", department="${department}". is_active: ${employee.is_active}, id: ${employee.id}, employee_id: ${employee.employee_id}`);
            
            // Employee exists - check if inactive
            if (!employee.is_active) {
              logger.info(`Employee "${name}" (${department}) is inactive - adding to inactive list`);
              inactive.push({
                employee_id: employee.employee_id, // Use the actual employee_id from database
                name: emp.name,
                department: emp.department || employee.department || 'Unknown Department',
                row_number: emp.row_number,
                id: employee.id,
                is_active: false,
              });
            } else {
              // Employee is active, shouldn't be here - skip
              logger.warn(`Employee "${name}" (${department}) is active but was marked as missing - skipping`);
            }
          } else {
            // Check status code
            const status = response.status;
            if (status === 404) {
              logger.info(`Employee "${name}" (${department}) not found (404) - truly missing`);
              missing.push(emp);
            } else {
              // Other error status - log and treat as missing
              const errorData = await response.json().catch(() => ({}));
              logger.error(`Error checking employee "${name}" (${department}): Status ${status}`, errorData);
              missing.push(emp);
            }
          }
        } catch (error) {
          // On error, assume employee is missing
          logger.error(`Exception checking employee "${emp.name}" (${emp.department}):`, error);
          missing.push(emp);
        }
      }

      logger.info(`Check complete: ${inactive.length} inactive, ${missing.length} missing`);
      setInactiveEmployees(inactive);
      setTrulyMissingEmployees(missing);
      setCheckCompleted(true);
    } catch (error) {
      logger.error('Error checking for inactive employees:', error);
      // On error, treat all as missing
      setInactiveEmployees([]);
      setTrulyMissingEmployees(missingEmployees);
      setCheckCompleted(true);
    } finally {
      setIsCheckingInactive(false);
    }
  }, [missingEmployees]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setInactiveEmployees([]);
      setTrulyMissingEmployees([]);
      setActivatingEmployees(new Set());
      setIsCheckingInactive(false);
      setCheckCompleted(false);
    }
  }, [isOpen]);

  // Check for inactive employees when modal opens
  useEffect(() => {
    if (isOpen && missingEmployees.length > 0 && !checkCompleted) {
      // Reset state before checking
      setInactiveEmployees([]);
      setTrulyMissingEmployees([]);
      setCheckCompleted(false);
      logger.info('Modal opened - starting inactive employee check');
      checkForInactiveEmployees();
    }
  }, [isOpen, missingEmployees, checkForInactiveEmployees, checkCompleted]);

  // initialize joinDates and basicSalaries when trulyMissingEmployees change (start empty so user can pick)
  useEffect(() => {
    const initialDates: Record<string, string> = {};
    const initialSalaries: Record<string, number> = {};
    trulyMissingEmployees.forEach((e) => {
      initialDates[e.employee_id] = '';
      initialSalaries[e.employee_id] = e.basic_salary ?? 0;
    });
    setJoinDates((prev) => ({ ...initialDates, ...prev }));
    setBasicSalaries((prev) => ({ ...initialSalaries, ...prev }));
  }, [trulyMissingEmployees]);

  // Handle activating/deactivating an employee
  const handleToggleEmployeeStatus = async (employee: InactiveEmployee) => {
    setActivatingEmployees((prev) => new Set(prev).add(employee.id));
    
    try {
      const response = await apiCall(`/api/employees/${employee.id}/toggle_active_status/`, {
        method: 'PATCH',
      });

      if (response.ok) {
        const data = await response.json();
        // Update the employee's active status in the list (don't remove them)
        setInactiveEmployees((prev) => 
          prev.map((e) => 
            e.id === employee.id 
              ? { ...e, is_active: data.is_active }
              : e
          )
        );
        logger.info(`✅ ${data.is_active ? 'Activated' : 'Deactivated'} employee ${employee.employee_id}`);
        
        // Dispatch event to notify other components (e.g., attendance log) to invalidate cache
        window.dispatchEvent(new CustomEvent('employeeStatusChanged', { 
          detail: { employeeId: employee.employee_id, is_active: data.is_active, timestamp: Date.now() } 
        }));
      } else {
        const errorData = await response.json().catch(() => ({}));
        logger.error(`Failed to toggle employee status ${employee.employee_id}:`, errorData);
        alert(`Failed to ${employee.is_active ? 'deactivate' : 'activate'} employee ${employee.name}. Please try again.`);
      }
    } catch (error) {
      logger.error(`Error toggling employee status ${employee.employee_id}:`, error);
      alert(`Error ${employee.is_active ? 'deactivating' : 'activating'} employee ${employee.name}. Please try again.`);
    } finally {
      setActivatingEmployees((prev) => {
        const newSet = new Set(prev);
        newSet.delete(employee.id);
        return newSet;
      });
    }
  };

  if (!isOpen) return null;

  const handleConfirm = async () => {
    // Activation is optional - proceed even if there are inactive employees
    // They will be skipped during upload (as per backend logic)
    
    setIsCreating(true);
    try {
      // Get today's date in YYYY-MM-DD format for default DOJ
      const today = '2024-04-01';
      
      // attach selected joining dates and basic salary (if any) to the employee objects
      const employeesWithData = trulyMissingEmployees.map((emp) => {
        const salary = basicSalaries[emp.employee_id];
        const selectedDate = joinDates[emp.employee_id];
        return {
          ...emp,
          // If no date is selected (empty string or falsy), use today's date as default
          date_of_joining: (selectedDate && selectedDate.trim()) || today,
          // Backend accepts basic_salary as number (JSON.stringify will serialize correctly)
          basic_salary: salary && salary > 0 ? salary : undefined,
        };
      });

      await onConfirm(employeesWithData);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Employees Not Found or Inactive
              </h2>
              <p className="text-sm text-gray-600">
                {missingEmployees.length} employees from your {uploadType} file need attention
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Loading State */}
          {isCheckingInactive && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-blue-800">
                  Checking employee status... Please wait while we verify if any employees are inactive.
                </p>
              </div>
            </div>
          )}

          {/* Inactive Employees Section */}
          {checkCompleted && !isCheckingInactive && inactiveEmployees.length > 0 && (
            <div className="mb-6 space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <UserX className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-medium text-yellow-900 mb-2">
                      {inactiveEmployees.some(e => !e.is_active) 
                        ? 'Inactive Employees Found' 
                        : 'Employee Status'}
                    </h3>
                    <p className="text-sm text-yellow-800">
                      {inactiveEmployees.some(e => !e.is_active)
                        ? `The following employees exist but are currently inactive. You can activate them to include them in the ${uploadType} upload, or continue without activating (they will be skipped during upload).`
                        : `You can manage employee status below. Inactive employees will be skipped during the ${uploadType} upload.`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Row
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Employee ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Department
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {inactiveEmployees.map((employee) => (
                        <tr key={employee.employee_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {employee.row_number}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {employee.employee_id}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {employee.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {employee.department || 'Not specified'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                employee.is_active 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {employee.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <button
                                onClick={() => handleToggleEmployeeStatus(employee)}
                                disabled={activatingEmployees.has(employee.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm ${
                                  employee.is_active
                                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                                    : 'bg-teal-600 text-white hover:bg-teal-700'
                                }`}
                              >
                                {activatingEmployees.has(employee.id) ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    {employee.is_active ? 'Deactivating...' : 'Activating...'}
                                  </>
                                ) : (
                                  <>
                                    <Power className="w-4 h-4" />
                                    {employee.is_active ? 'Deactivate' : 'Activate'}
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Missing Employees Section */}
          {checkCompleted && !isCheckingInactive && trulyMissingEmployees.length > 0 && (
            <div className="space-y-4">
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium text-orange-900 mb-2">
                      Action Required
                    </h3>
                    <p className="text-sm text-orange-800">
                      The following employees were found in your {uploadType} file but don't exist in the system. 
                      Click "Create Employees & Continue Upload" to automatically create these employees with default settings, 
                      then proceed with the {uploadType} upload.
                    </p>
                  </div>
                </div>
              </div>

              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Employees to be Created ({trulyMissingEmployees.length})
              </h3>
              
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Row
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Employee ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Department
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Basic Salary
                        </th>
                        <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          Date Of Joining
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {trulyMissingEmployees.map((employee) => (
                      <tr key={employee.employee_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {employee.row_number}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {employee.employee_id}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {employee.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {employee.department || 'Not specified'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={basicSalaries[employee.employee_id] && basicSalaries[employee.employee_id] > 0 ? basicSalaries[employee.employee_id] : ''}
                            onChange={(e) => {
                              const value = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                              setBasicSalaries((prev) => ({
                                ...prev,
                                [employee.employee_id]: value,
                              }));
                            }}
                            placeholder="Enter salary"
                            className="w-32 px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          <div className="relative inline-block">
                            <button
                              type="button"
                              onClick={(ev) => {
                                const target = ev.currentTarget as HTMLElement;
                                const rect = target.getBoundingClientRect();
                                setOpenCalendar({
                                  id: employee.employee_id,
                                  position: { top: Math.round(rect.bottom + 6), left: Math.round(rect.left), width: Math.round(rect.width) },
                                });
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Calendar className="w-4 h-4" />
                              <span>
                                {joinDates[employee.employee_id]
                                  ? joinDates[employee.employee_id]
                                  : 'Select date'}
                              </span>
                            </button>

                            {openCalendar.id === employee.employee_id && (
                              <div style={{ position: 'fixed', top: openCalendar.position?.top, left: openCalendar.position?.left, zIndex: 9999 }}>
                                <CalendarPopup
                                  value={joinDates[employee.employee_id] || ''}
                                  onChange={(date) => {
                                    setJoinDates((prev) => ({ ...prev, [employee.employee_id]: date }));
                                  }}
                                  onClose={() => setOpenCalendar({ id: null })}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* No employees to handle */}
          {checkCompleted && !isCheckingInactive && trulyMissingEmployees.length === 0 && inactiveEmployees.length === 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm text-green-800">
                  All employees have been handled. You can proceed with the upload.
                </p>
              </div>
            </div>
          )}

          {/* Show initial state if check hasn't completed yet */}
          {!checkCompleted && !isCheckingInactive && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-gray-600" />
                <p className="text-sm text-gray-800">
                  Preparing to check employee status...
                </p>
              </div>
            </div>
          )}


          {/* Default Settings Info */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Default Settings for New Employees
            </h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• <strong>Employment Type:</strong> Full Time</p>
              <p>• <strong>Designation:</strong> Employee</p>
              <p>• <strong>Shift:</strong> 9:00 AM - 6:00 PM</p>
              <p>• <strong>Off Days:</strong> Saturday & Sunday</p>
              <p>• <strong>Joining Date:</strong> Select from calendar (optional - defaults to today's date if not provided)</p>
              <p>• <strong>Basic Salary:</strong> Enter in the table above (optional)</p>
              <p>• <strong>Email:</strong> Auto-generated from Employee ID</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            💡 You can update employee details later in the Employee Directory
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isCreating}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isCreating || isCheckingInactive || (trulyMissingEmployees.length === 0 && inactiveEmployees.length === 0)}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  {trulyMissingEmployees.length > 0 
                    ? `Create ${trulyMissingEmployees.length} Employee${trulyMissingEmployees.length > 1 ? 's' : ''} & Continue Upload`
                    : inactiveEmployees.length > 0
                    ? 'Continue Upload (Inactive employees will be skipped)'
                    : 'Continue Upload'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeConfirmationModal;
