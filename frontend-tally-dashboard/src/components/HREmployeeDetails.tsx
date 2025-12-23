import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Edit } from 'lucide-react';
import { apiRequest } from '../services/api';
import { getDropdownOptions, DropdownOptions } from '../services/dropdownService';
import { getCountryOptions, getStateOptions, getCityOptions } from '../services/locationService';
import { State, Country } from 'country-state-city';
import CustomDateInput from './CustomDateInput';
import Dropdown, { DropdownOption } from './Dropdown';
import { logger } from '../utils/logger';

// Define types for API responses
interface EmployeeProfileResponse {
  employee: EmployeeProfileData;
}

interface AttendanceApiResponse {
  results?: AttendanceRecord[];
}

interface AttendanceRecord {
  date: string;
  ot_hours: number;
  late_minutes: number;
  attendance_status?: string;
  status: 'Present' | 'Absent' | 'Half Day';
}

interface EmployeeProfileData {
  id?: number;
  employee_id: string;
  name: string;
  first_name: string;
  last_name: string;
  mobile_number: string;
  email: string;
  date_of_birth: string;
  marital_status: string;
  gender: string;
  nationality: string;
  country: string;
  address: string;
  city: string;
  state: string;
  department: string;
  designation: string;
  employment_type: string;
  date_of_joining: string;
  branch_location: string;
  shift_start_time: string;
  shift_end_time: string;
  basic_salary: string;
  tds_percentage: string;
  ot_charge?: string;
  ot_charge_per_hour?: string;
  off_monday?: boolean;
  off_tuesday?: boolean;
  off_wednesday?: boolean;
  off_thursday?: boolean;
  off_friday?: boolean;
  off_saturday?: boolean;
  off_sunday?: boolean;
  is_active?: boolean;
  weekly_rules_enabled?: boolean;
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  'Full Time': 'FULL_TIME',
  'Part Time': 'PART_TIME',
  'Contract': 'CONTRACT',
  'Intern': 'INTERN',
  'FULL_TIME': 'FULL_TIME',
  'PART_TIME': 'PART_TIME',
  'CONTRACT': 'CONTRACT',
  'INTERN': 'INTERN',
};

function formatTimeToHHMM(time: string) {
  // Accepts '09:00', '09:00:00', '09:00 AM', '17:30', etc. Returns 'HH:mm'.
  if (!time) return '';
  if (/^\d{2}:\d{2}$/.test(time)) return time;
  if (/^\d{2}:\d{2}:\d{2}$/.test(time)) return time.slice(0, 5);
  // Handle AM/PM
  const match = time.match(/^(\d{1,2}):(\d{2}) ?([AP]M)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = match[3]?.toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
  return time;
}

const HREmployeeDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('personal');
  const [employeeData, setEmployeeData] = useState<EmployeeProfileData | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [averageDaysPerMonth, setAverageDaysPerMonth] = useState<number>(30.4); // Default fallback
  const [breakTime, setBreakTime] = useState<number>(0.5); // Default fallback (30 minutes)
  const [tenantWeeklyRulesEnabled, setTenantWeeklyRulesEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<EmployeeProfileData> | null>(null);
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOptions>({
    departments: [],
    locations: [],
    designations: [],
    cities: [],
    states: []
  });

  // Location dropdown options
  const [countryOptions, setCountryOptions] = useState<DropdownOption[]>([]);
  const [stateOptions, setStateOptions] = useState<DropdownOption[]>([]);
  const [cityOptions, setCityOptions] = useState<DropdownOption[]>([]);
  
  // Selected location values
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  
  // Store all employees for counting by department
  const [allEmployees, setAllEmployees] = useState<EmployeeProfileData[]>([]);

  // Convert to dropdown format with employee count
  const departmentOptions: DropdownOption[] = React.useMemo(() => {
    // Count employees by department
    const departmentCounts = new Map<string, number>();
    allEmployees.forEach(emp => {
      if (emp.department) {
        departmentCounts.set(emp.department, (departmentCounts.get(emp.department) || 0) + 1);
      }
    });
    
    return dropdownOptions.departments.map(dept => ({
      value: dept,
      label: `${dept} (${departmentCounts.get(dept) || 0})`
    }));
  }, [dropdownOptions.departments, allEmployees]);

  // Static dropdown options
  const maritalStatusOptions: DropdownOption[] = [
    { value: '', label: 'Marital Status' },
    { value: 'SINGLE', label: 'Single' },
    { value: 'MARRIED', label: 'Married' },
    { value: 'DIVORCED', label: 'Divorced' },
    { value: 'WIDOWED', label: 'Widowed' }
  ];

  const genderOptions: DropdownOption[] = [
    { value: '', label: 'Gender' },
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
    { value: 'OTHER', label: 'Other' }
  ];


  const employmentTypeOptions: DropdownOption[] = [
    { value: '', label: 'Employment Type' },
    { value: 'FULL_TIME', label: 'Full-time' },
    { value: 'PART_TIME', label: 'Part-time' },
    { value: 'CONTRACT', label: 'Contract' },
    { value: 'INTERN', label: 'Intern' }
  ];

  const locationOptions: DropdownOption[] = [
    { value: '', label: 'Select Office Location' },
    { value: 'Delhi', label: 'Delhi' },
    { value: 'Mumbai', label: 'Mumbai' }
  ];

  // Function to load salary config (can be called multiple times)
  const loadSalaryConfig = async () => {
    try {
      const data = await apiRequest('/api/salary-config/', { method: 'GET' }) as { average_days_per_month?: number; break_time?: number; weekly_absent_penalty_enabled?: boolean };
      logger.info('📊 Salary config loaded:', data);
      if (data && data.average_days_per_month !== undefined) {
        logger.info('✅ Setting averageDaysPerMonth to:', data.average_days_per_month);
        setAverageDaysPerMonth(data.average_days_per_month);
      } else {
        logger.warn('⚠️ average_days_per_month not found, using default 30.4');
        setAverageDaysPerMonth(30.4);
      }
      if (data && data.break_time !== undefined) {
        logger.info('✅ Setting breakTime to:', data.break_time);
        setBreakTime(data.break_time);
      } else {
        logger.warn('⚠️ break_time not found, using default 0.5');
        setBreakTime(0.5); // Default to 30 minutes
      }
      if (data && data.weekly_absent_penalty_enabled !== undefined) {
        setTenantWeeklyRulesEnabled(!!data.weekly_absent_penalty_enabled);
      }
    } catch (error) {
      // Use default value if fetch fails
      logger.warn('Failed to load salary config, using defaults', error);
      setAverageDaysPerMonth(30.4);
      setBreakTime(0.5);
    }
  };

  // Fetch salary config on component mount
  useEffect(() => {
    loadSalaryConfig();
  }, []);

  // Refetch salary config when editing starts to get latest values
  useEffect(() => {
    if (isEditing) {
      loadSalaryConfig();
    }
  }, [isEditing]);

  // Listen for salary config updates from HRSettings
  useEffect(() => {
    const handleSalaryConfigUpdate = () => {
      loadSalaryConfig();
    };
    
    window.addEventListener('salaryConfigUpdated', handleSalaryConfigUpdate);
    
    return () => {
      window.removeEventListener('salaryConfigUpdated', handleSalaryConfigUpdate);
    };
  }, []);

  // Refetch salary config when page becomes visible (user switches back to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadSalaryConfig();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Load location data
  useEffect(() => {
    const loadLocationData = async () => {
      try {
        logger.info( '🔍 Loading country options...');
        const countries = await getCountryOptions();
        logger.info( '✅ Loaded countries:', countries.length);
        setCountryOptions(countries);
      } catch (error) {
        logger.error('❌ Error loading location data:', error);
      }
    };

    loadLocationData();
  }, []);

  // Load all employees for department count
  useEffect(() => {
    const loadAllEmployees = async () => {
      try {
        const data = await apiRequest('/api/excel/employees/?page_size=1000') as { results?: EmployeeProfileData[] };
        const employees = Array.isArray(data) ? data : (data?.results || []);
        setAllEmployees(employees);
        logger.info('✅ Loaded all employees for department count:', employees.length);
      } catch (error) {
        logger.error('Error loading all employees:', error);
        // Continue without employee counts if fetch fails
      }
    };

    loadAllEmployees();
  }, []);

  // Ensure saved country is in options when employee data loads
  useEffect(() => {
    if (employeeData && countryOptions.length > 0) {
      const countryCode = employeeData.country || employeeData.nationality;
      if (countryCode && !countryOptions.find(c => c.value === countryCode)) {
        // If saved country is not in options, add it
        const country = Country.getCountryByCode(countryCode);
        if (country) {
          setCountryOptions(prev => [...prev, { value: country.isoCode, label: country.name }]);
          logger.info( '✅ Added saved country to options:', country.name);
        } else {
          // Fallback: add with the code as label
          setCountryOptions(prev => [...prev, { value: countryCode, label: countryCode }]);
          logger.info( '⚠️ Added country code to options (not found in library):', countryCode);
        }
      }
    }
  }, [employeeData, countryOptions.length]);

  // Handle country change
  const handleCountryChange = async (countryCode: string) => {
    setSelectedCountry(countryCode);
    setSelectedState('');
    setSelectedCity('');
    setStateOptions([]);
    setCityOptions([]);

    if (countryCode && isEditing) {
      // Update both country and nationality for backward compatibility
      setEditData(prev => ({ ...prev, country: countryCode, nationality: countryCode }));
    }

    if (countryCode) {
      try {
        const states = await getStateOptions(countryCode);
        setStateOptions(states);
      } catch (error) {
        logger.error('Error loading states:', error);
      }
    }
  };

  // Handle state change
  const handleStateChange = async (stateCode: string) => {
    setSelectedState(stateCode);
    setSelectedCity('');
    setCityOptions([]);

    if (stateCode && isEditing) {
      setEditData(prev => ({ ...prev, state: stateCode }));
    }

    if (stateCode && selectedCountry) {
      try {
        const stateId = `${selectedCountry}_${stateCode}`;
        const cities = await getCityOptions(stateId);
        setCityOptions(cities);
      } catch (error) {
        logger.error('Error loading cities:', error);
      }
    }
  };

  // Handle city change
  const handleCityChange = (cityId: string) => {
    setSelectedCity(cityId);
    if (cityId && isEditing) {
      setEditData(prev => ({ ...prev, city: cityId }));
    }
  };


  // Calculate OT charge (Basic Salary / (Shift Hours × AVERAGE_DAYS_PER_MONTH))
  const calculateOTCharge = (basicSalary: string, shiftStart: string, shiftEnd: string) => {
    if (!basicSalary || !shiftStart || !shiftEnd) return '';
    
    // Parse basic salary (remove commas if any)
    const salary = parseFloat(basicSalary.replace(/,/g, ''));
    if (isNaN(salary) || salary <= 0) return '';
    
    // Parse times to hours
    const [startH, startM] = formatTimeToHHMM(shiftStart).split(':').map(Number);
    const [endH, endM] = formatTimeToHHMM(shiftEnd).split(':').map(Number);
    if (
      isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)
    ) return '';
    let rawShiftHours = (endH + endM / 60) - (startH + startM / 60);
    if (rawShiftHours <= 0) rawShiftHours += 24; // handle overnight shifts
    if (rawShiftHours <= 0) return '';
    
    // Subtract break time from shift hours
    const breakTimeHours = breakTime !== undefined ? breakTime : 0.5;
    const shiftHours = Math.max(0, rawShiftHours - breakTimeHours);
    if (shiftHours <= 0) return '';
    
    // Use averageDaysPerMonth from state, fallback to 30.4 if not loaded yet
    const avgDays = averageDaysPerMonth || 30.4;
    const ot = salary / (shiftHours * avgDays);
    return ot ? ot.toFixed(2) : '';
  };

  // Handle custom department add
  const handleCustomDepartmentAdd = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      departments: prev.departments.includes(value) ? prev.departments : [...prev.departments, value]
    }));
  };

  // Handle checkbox changes for off days
  const handleCheckboxChange = (day: string) => {
    const fieldName = `off_${day.toLowerCase()}` as keyof EmployeeProfileData;
    if (isEditing) {
      setEditData(prev => {
        const currentEditData = prev || { ...employeeData };
        const currentValue = currentEditData[fieldName] !== undefined 
          ? (currentEditData[fieldName] as boolean)
          : (employeeData?.[fieldName] as boolean || false);
        return {
          ...currentEditData,
          [fieldName]: !currentValue
        };
      });
    }
  };

  // Note: OT charge recalculation is now handled directly in onChange handlers for shift_start_time, shift_end_time, and basic_salary

  // Move fetchEmployeeData outside useEffect so it can be called after save
  const fetchEmployeeData = async () => {
    try {
      setLoading(true);
      setError(null);
      logger.info( '🔍 Fetching employee data for ID:', id);
      
      const data = await apiRequest(`/api/excel/employees/profile_by_employee_id/?employee_id=${id}`) as EmployeeProfileResponse;
      
      logger.info( '📊 Employee data response:', {
        hasData: !!data,
        hasEmployee: !!data?.employee,
        employeeData: data?.employee
      });
      
      if (data && data.employee) {
        // Map ot_charge_per_hour to ot_charge for consistency
        const employeeDataWithOT = {
          ...data.employee,
          ot_charge: data.employee.ot_charge_per_hour || data.employee.ot_charge || ''
        };
        setEmployeeData(employeeDataWithOT);
        // Initialize selected location values from employee data
        // Use country if available, otherwise use nationality (backward compatibility)
        const countryCode = employeeDataWithOT.country || employeeDataWithOT.nationality;
        if (countryCode) {
          setSelectedCountry(countryCode);
        }
        if (employeeDataWithOT.state) {
          setSelectedState(employeeDataWithOT.state);
        }
        if (employeeDataWithOT.city) {
          setSelectedCity(employeeDataWithOT.city);
        }
        setError(null);
        setInitialLoad(false);
        logger.info( '✅ Employee data loaded successfully', {
          country: countryCode,
          state: data.employee.state,
          city: data.employee.city
        });
      } else {
        logger.warn('⚠️ No employee data in response');
        setError('No employee data found');
        setInitialLoad(false);
      }
    } catch (err) {
      logger.error('❌ Error fetching employee data:', err);
      setError(`Failed to load employee data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setInitialLoad(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchAttendanceData = async () => {
      try {
        const data = await apiRequest(`/api/excel/daily-attendance/?employee_id=${id}&page_size=100`) as AttendanceApiResponse | AttendanceRecord[];

        // Support paginated responses (data.results) or plain list
        const attendanceArrayRaw = Array.isArray(data) ? data : (data && Array.isArray(data.results) ? data.results : []);

        const attendanceArray = attendanceArrayRaw as AttendanceRecord[];
        
        // Process attendance records
        const processedRecords = attendanceArray.map((record: AttendanceRecord) => {
          return {
            date: record.date,
            ot_hours: parseFloat(record.ot_hours?.toString() || '0'),
            late_minutes: Number(record.late_minutes) || 0,
            status: record.attendance_status ?
              (record.attendance_status === 'PRESENT' ? 'Present' :
               record.attendance_status === 'HALF_DAY' ? 'Half Day' : 'Absent') : 'Absent'
          } as AttendanceRecord;
        });

        setAttendanceRecords(processedRecords);
      } catch (err) {
        logger.error('Error fetching attendance data:', err);
        setError('Failed to fetch attendance data');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchEmployeeData();
      fetchAttendanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load dropdown options from the database
  useEffect(() => {
    const loadDropdownOptions = async () => {
      try {
        const options = await getDropdownOptions();
        setDropdownOptions(options);
      } catch (error) {
        logger.error('Failed to load dropdown options:', error);
        // Keep default empty state if loading fails
      }
    };

    loadDropdownOptions();
  }, []);

  // Load state options when country is available from employee data
  useEffect(() => {
    const loadStateOptions = async () => {
      // Use country if available, otherwise use nationality (backward compatibility)
      const countryCode = employeeData?.country || employeeData?.nationality;
      if (countryCode) {
        try {
          const states = await getStateOptions(countryCode);
          // If employee has a saved state that's not in the options, add it
          const savedState = employeeData.state;
          if (savedState && !states.find(s => s.value === savedState)) {
            // Try to find the state name if it's an ISO code
            const stateObj = State.getStatesOfCountry(countryCode)?.find(s => s.isoCode === savedState || s.name === savedState);
            if (stateObj) {
              states.push({ value: stateObj.isoCode, label: stateObj.name });
            } else {
              states.push({ value: savedState, label: savedState });
            }
          }
          setStateOptions(states);
          logger.info( '✅ Loaded state options for country:', countryCode, 'States:', states.length);
        } catch (error) {
          logger.error('Error loading states:', error);
          // If loading fails but employee has a saved state, add it to options
          if (employeeData.state) {
            setStateOptions([{ value: employeeData.state, label: employeeData.state }]);
          }
        }
      }
    };

    loadStateOptions();
  }, [employeeData?.country, employeeData?.nationality, employeeData?.state]);

  // Load city options when state is available from employee data
  useEffect(() => {
    const loadCityOptions = async () => {
      // Use country if available, otherwise use nationality (backward compatibility)
      const countryCode = employeeData?.country || employeeData?.nationality;
      if (employeeData?.state && countryCode) {
        try {
          const stateId = `${countryCode}_${employeeData.state}`;
          const cities = await getCityOptions(stateId);
          // If employee has a saved city that's not in the options, add it
          const savedCity = employeeData.city;
          if (savedCity && !cities.find(c => c.value === savedCity || c.label === savedCity)) {
            cities.push({ value: savedCity, label: savedCity });
          }
          setCityOptions(cities);
          logger.info( '✅ Loaded city options for state:', stateId, 'Cities:', cities.length);
        } catch (error) {
          logger.error('Error loading cities:', error);
          // If loading fails but employee has a saved city, add it to options
          if (employeeData.city) {
            setCityOptions([{ value: employeeData.city, label: employeeData.city }]);
          }
        }
      }
    };

    loadCityOptions();
  }, [employeeData?.state, employeeData?.country, employeeData?.nationality, employeeData?.city]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading employee details...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="text-red-500 text-lg font-medium mb-2">Error Loading Employee</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!employeeData && !initialLoad) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="text-gray-500 text-lg font-medium mb-2">Employee Not Found</div>
          <div className="text-gray-600 mb-4">The requested employee could not be found.</div>
          <button 
            onClick={() => window.history.back()} 
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Helper function to check if a field has valid data
  const hasValidData = (value: string | undefined) => {
    return value && value !== '-' && value.trim() !== '';
  };

  // Type guard to ensure employeeData is not null
  if (!employeeData) {
    return null; // This should never happen due to early returns above
  }

  const handleSave = async () => {
    if (!editData || !employeeData) return;
    
    // Validate required fields before saving
    const missingFields: string[] = [];
    
    if (!editData.first_name || !editData.first_name.trim()) {
      missingFields.push('First Name');
    }
    if (!editData.shift_start_time || !editData.shift_start_time.trim()) {
      missingFields.push('Shift Start Time');
    }
    if (!editData.shift_end_time || !editData.shift_end_time.trim()) {
      missingFields.push('Shift End Time');
    }
    if (!editData.basic_salary || !editData.basic_salary.toString().trim()) {
      missingFields.push('Basic Salary');
    }
    // Check date_of_joining - use editData if available, otherwise use employeeData
    const dateOfJoining = editData.date_of_joining !== undefined 
      ? editData.date_of_joining 
      : employeeData.date_of_joining;
    if (!dateOfJoining || !dateOfJoining.trim()) {
      missingFields.push('Date of Joining');
    }
    
    if (missingFields.length > 0) {
      alert(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }
    
    // Only include fields that have changed and are not empty/null
    const updatedFields: Partial<EmployeeProfileData> = {};
    Object.keys(editData).forEach((key) => {
      const k = key as keyof EmployeeProfileData;
      let newValue = editData[k];
      let oldValue = employeeData[k];
      // Fix employment_type
      if (k === 'employment_type') {
        newValue = EMPLOYMENT_TYPE_MAP[newValue as string] || newValue;
        oldValue = EMPLOYMENT_TYPE_MAP[oldValue as string] || oldValue;
      }
      // Fix time fields
      if (k === 'shift_start_time' || k === 'shift_end_time') {
        newValue = formatTimeToHHMM(newValue as string);
        oldValue = formatTimeToHHMM(oldValue as string);
      }
      // Handle boolean fields differently (off_days, weekly_rules_enabled, is_active)
      // For booleans, we need to include both true and false values
      if (k.startsWith('off_') || k === 'weekly_rules_enabled' || k === 'is_active') {
        // Check if value changed (handle both true and false explicitly)
        if (newValue !== oldValue && typeof newValue === 'boolean') {
          (updatedFields as Record<string, unknown>)[k] = newValue;
        }
      } 
      // Handle ot_charge - map to ot_charge_per_hour for backend
      else if (k === 'ot_charge') {
        // Only include if it's different from old value AND has a value
        // If empty, don't include it (backend will use existing calculation)
        if (newValue !== oldValue && newValue !== '' && newValue !== null && newValue !== undefined) {
          (updatedFields as Record<string, unknown>)['ot_charge_per_hour'] = newValue;
        }
        // If user cleared the field (newValue is empty but oldValue had something), send null to clear
        else if (newValue === '' && oldValue && oldValue !== '') {
          (updatedFields as Record<string, unknown>)['ot_charge_per_hour'] = null;
        }
      }
      else if (newValue !== oldValue && newValue !== '' && newValue !== null && newValue !== undefined) {
        (updatedFields as Record<string, unknown>)[k] = newValue;
      }
    });
    if (Object.keys(updatedFields).length === 0) {
      setIsEditing(false);
      setEditData(null);
      return; // Nothing to update
    }
    try {
      setSaving(true); // Start loading state
      
      // Use the database ID from employeeData (required for PATCH operation)
      if (!employeeData?.id) {
        alert('Cannot save: Employee database ID not found');
        setSaving(false);
        return;
      }
      
      await apiRequest(
        `/api/excel/employees/${employeeData.id}/`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedFields),
        }
      );
      // Instead of using returned data, refresh from backend
      await fetchEmployeeData();
      setIsEditing(false);
      setEditData(null);
      alert('✅ Employee profile saved successfully!');
    } catch {
      alert('Failed to save changes');
    } finally {
      setSaving(false); // End loading state
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with breadcrumb and edit button */}
      <div className="bg-white rounded-lg p-6 shadow-sm relative">
  {/* Main content */}
  <div className="flex justify-between">
    <div>
      <h1 className="text-2xl font-semibold mb-1">
        {`${employeeData.first_name || ''} ${employeeData.last_name || ''}`.trim() || 'Employee'}
      </h1>
      <p className="text-gray-500">
        {hasValidData(employeeData.department) ? employeeData.department : '-'}
      </p>
    </div>

    {/* Button vertically centered */}
    <div className="flex flex-col justify-center">
      {!isEditing ? (
        <button
          onClick={async () => {
            // Ensure state and city options are loaded before entering edit mode
            const countryCode = employeeData?.country || employeeData?.nationality;
            if (countryCode && !stateOptions.length) {
              try {
                const states = await getStateOptions(countryCode);
                // Add saved state if not in options
                if (employeeData?.state && !states.find(s => s.value === employeeData.state)) {
                  const stateObj = State.getStatesOfCountry(countryCode)?.find(s => s.isoCode === employeeData.state || s.name === employeeData.state);
                  if (stateObj) {
                    states.push({ value: stateObj.isoCode, label: stateObj.name });
                  } else {
                    states.push({ value: employeeData.state, label: employeeData.state });
                  }
                }
                setStateOptions(states);
              } catch (error) {
                logger.error('Error loading states:', error);
              }
            }
            if (employeeData?.state && countryCode && !cityOptions.length) {
              try {
                const stateId = `${countryCode}_${employeeData.state}`;
                const cities = await getCityOptions(stateId);
                // Add saved city if not in options
                if (employeeData?.city && !cities.find(c => c.value === employeeData.city || c.label === employeeData.city)) {
                  cities.push({ value: employeeData.city, label: employeeData.city });
                }
                setCityOptions(cities);
              } catch (error) {
                logger.error('Error loading cities:', error);
              }
            }
            setEditData({ ...employeeData });
            setIsEditing(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#0B5E59] text-white rounded-lg hover:bg-[#094947] transition-colors"
        >
          <Edit size={16} />
          Edit Profile
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 bg-[#0B5E59] text-white rounded-lg transition-colors flex items-center gap-2 ${
              saving 
                ? 'opacity-70 cursor-not-allowed' 
                : 'hover:bg-[#094947]'
            }`}
          >
            {saving && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => {
              if (!saving) {
                setIsEditing(false);
                setEditData(null);
              }
            }}
            disabled={saving}
            className={`px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white transition-colors ${
              saving 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:bg-gray-50'
            }`}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  </div>
</div>

      {/* Editing State Banner */}
      {isEditing ? (
        <div className="bg-teal-50 border-l-4 border-teal-400 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Edit className="h-5 w-5 text-teal-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-teal-700">
                 You can now edit the employee details. Click "Save" to save your changes or "Cancel" to discard them.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border-l-4 border-gray-300 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Edit className="h-5 w-5 text-gray-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">
                 Employee details are currently read-only. Click the "Edit Profile" button above to enable editing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="flex border-b">
          <button
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium ${
              activeTab === 'personal'
                ? 'border-b-2 border-[#0B5E59] text-[#0B5E59]'
                : 'text-gray-500'
            }`}
            onClick={() => setActiveTab('personal')}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" />
              <path d="M20.5899 22C20.5899 18.13 16.7399 15 11.9999 15C7.25991 15 3.40991 18.13 3.40991 22" />
            </svg>
            Personal Information
          </button>
          <button
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium ${
              activeTab === 'professional'
                ? 'border-b-2 border-[#0B5E59] text-[#0B5E59]'
                : 'text-gray-500'
            }`}
            onClick={() => setActiveTab('professional')}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            Professional Information
          </button>
          <button
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium ${
              activeTab === 'attendance'
                ? 'border-b-2 border-[#0B5E59] text-[#0B5E59]'
                : 'text-gray-500'
            }`}
            onClick={() => setActiveTab('attendance')}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
              <path d="M16 2v4" />
              <path d="M8 2v4" />
              <path d="M3 10h18" />
            </svg>
            Attendance
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'personal' && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block mb-1 text-sm font-medium px-1 text-gray-700">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={isEditing ? editData?.first_name || '' : employeeData.first_name || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="First Name"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, first_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium px-1 text-gray-700">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={isEditing ? editData?.last_name || '' : employeeData.last_name || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Last Name"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, last_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium px-1 text-gray-700">
                  Mobile Number
                </label>
                <input
                  type="text"
                  value={isEditing ? editData?.mobile_number || '' : employeeData.mobile_number || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Mobile Number"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, mobile_number: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium px-1 text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  value={isEditing ? editData?.email || '' : employeeData.email || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Email Address"
                  
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium px-1 text-gray-700">
                  Date of Birth
                </label>
                <CustomDateInput
                  value={isEditing ? editData?.date_of_birth || '' : employeeData.date_of_birth || ''}
                  onChange={(date) => isEditing && setEditData(prev => ({ ...prev, date_of_birth: date }))}
                  placeholder="Date of Birth"
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  readOnly={!isEditing}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium px-1 text-gray-700">
                  Marital Status
                </label>
                  <Dropdown
                  options={maritalStatusOptions}
                  value={isEditing ? editData?.marital_status || '' : employeeData.marital_status || ''}
                  onChange={(value) => isEditing && setEditData(prev => ({ ...prev, marital_status: value }))}
                  placeholder="Marital Status"
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium px-1 text-gray-700">
                  Gender
                </label>
                <Dropdown
                  options={genderOptions}
                  value={isEditing ? editData?.gender || '' : employeeData.gender || ''}
                  onChange={(value) => isEditing && setEditData(prev => ({ ...prev, gender: value }))}
                  placeholder="Gender"
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium px-1 text-gray-700">
                  Country
                </label>
                {countryOptions.length === 0 ? (
                  <div className="text-sm text-gray-500 italic">Loading countries...</div>
                ) : (
                  <Dropdown
                    options={(() => {
                      // Ensure saved country is always in options
                      const currentValue = isEditing 
                        ? (editData?.country || editData?.nationality || employeeData?.country || employeeData?.nationality || '') 
                        : (employeeData?.country || employeeData?.nationality || '');
                      if (currentValue && !countryOptions.find(c => c.value === currentValue)) {
                        // Try to get country name from library
                        const country = Country.getCountryByCode(currentValue);
                        if (country) {
                          return [...countryOptions, { value: country.isoCode, label: country.name }];
                        }
                        // Fallback: add with the code as label
                        return [...countryOptions, { value: currentValue, label: currentValue }];
                      }
                      return countryOptions;
                    })()}
                    value={isEditing 
                      ? (editData?.country || editData?.nationality || employeeData?.country || employeeData?.nationality || selectedCountry || '') 
                      : (employeeData?.country || employeeData?.nationality || selectedCountry || '')
                    }
                    onChange={handleCountryChange}
                    placeholder={countryOptions.length > 0 ? "Select Country" : "Loading countries..."}
                    disabled={!isEditing || countryOptions.length === 0}
                  />
                )}
              </div>
              
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  State
                </label>
                <Dropdown
                  options={(() => {
                    // Ensure saved state is always in options
                    const currentValue = isEditing 
                      ? (editData?.state || employeeData?.state || '') 
                      : (employeeData?.state || '');
                    if (currentValue && !stateOptions.find(s => s.value === currentValue)) {
                      return [...stateOptions, { value: currentValue, label: currentValue }];
                    }
                    return stateOptions;
                  })()}
                  value={isEditing 
                    ? (editData?.state || employeeData?.state || selectedState || '') 
                    : (employeeData?.state || selectedState || '')
                  }
                  onChange={handleStateChange}
                  placeholder="Select State"
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  City
                </label>
                <Dropdown
                  options={(() => {
                    // Ensure saved city is always in options
                    const currentValue = isEditing 
                      ? (editData?.city || employeeData?.city || '') 
                      : (employeeData?.city || '');
                    if (currentValue && !cityOptions.find(c => c.value === currentValue)) {
                      return [...cityOptions, { value: currentValue, label: currentValue }];
                    }
                    return cityOptions;
                  })()}
                  value={isEditing 
                    ? (editData?.city || employeeData?.city || selectedCity || '') 
                    : (employeeData?.city || selectedCity || '')
                  }
                  onChange={handleCityChange}
                  placeholder="Select City"
                  disabled={!isEditing}
                />
              </div>
              <div className="col-span-2">
                <label className="block mb-1 text-sm font-medium px-1 text-gray-700">
                  Address
                </label>
                <textarea
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Address"
                  rows={3}
                  value={isEditing ? editData?.address || '' : employeeData.address || ''}
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, address: e.target.value }))}
                ></textarea>
              </div>
            </div>

          )}

          {activeTab === 'professional' && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Employee ID
                </label>
                <input
                  type="text"
                  value={employeeData.employee_id}
                  className="w-full px-4 py-3 border rounded-lg transition-colors"
                  placeholder="Employee ID"
                  readOnly={true}
                />
              </div>
              {/* <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  User Name
                </label>
                <input
                  type="text"
                  value={isEditing ? editData?.name || '' : employeeData.name || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="User Name"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div> */}
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Employment Type
                </label>
                <Dropdown
                  options={employmentTypeOptions}
                  value={isEditing ? editData?.employment_type || '' : employeeData.employment_type || ''}
                  onChange={(value) => isEditing && setEditData(prev => ({ ...prev, employment_type: value }))}
                  placeholder="Select Employee Type"
                  disabled={!isEditing}
                />
              </div>
              {/* <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={isEditing ? editData?.email || '' : employeeData.email || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Email Address"
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div> */}
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Department
                </label>
                <Dropdown
                  options={departmentOptions}
                  value={isEditing ? editData?.department || '' : employeeData.department || ''}
                  onChange={(value) => isEditing && setEditData(prev => ({ ...prev, department: value }))}
                  placeholder="Select Department"
                  disabled={!isEditing}
                  allowCustom={isEditing}
                  onCustomAdd={handleCustomDepartmentAdd}
                  customPlaceholder="Enter new department"
                    onRemoveOption={(value) => {
                      setDropdownOptions(prev => ({
                        ...prev,
                        departments: prev.departments.filter(d => d !== value)
                      }));
                      if ((isEditing ? editData?.department : employeeData.department) === value) {
                        setEditData(prev => ({ ...prev, department: '' }));
                      }
                    }}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Designation
                </label>
                <Dropdown
                  options={dropdownOptions.designations.map(d => ({ value: d, label: d }))}
                  value={isEditing ? editData?.designation || '' : employeeData.designation || ''}
                  onChange={(value) => isEditing && setEditData(prev => ({ ...prev, designation: value }))}
                  placeholder="Select Designation"
                  disabled={!isEditing}
                  allowCustom={isEditing}
                  onCustomAdd={(value) => setDropdownOptions(prev => ({
                    ...prev,
                    designations: prev.designations.includes(value) ? prev.designations : [...prev.designations, value]
                  }))}
                  customPlaceholder="Enter new designation"
                  onRemoveOption={(value) => {
                    const confirmed = window.confirm('This will remove the name from the dropdown. Continue?');
                    if (!confirmed) return;
                    setDropdownOptions(prev => ({
                      ...prev,
                      designations: prev.designations.filter(d => d !== value)
                    }));
                    if ((isEditing ? editData?.designation : employeeData.designation) === value) {
                      setEditData(prev => ({ ...prev, designation: '' }));
                    }
                  }}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Office Location
                </label>
                <Dropdown
                  options={locationOptions}
                  value={isEditing ? editData?.branch_location || '' : employeeData.branch_location || ''}
                  onChange={(value) => isEditing && setEditData(prev => ({ ...prev, branch_location: value }))}
                  placeholder="Select Office Location"
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Date of Joining
                </label>
                <CustomDateInput
                  value={isEditing ? editData?.date_of_joining || '' : employeeData.date_of_joining || ''}
                  onChange={(date) => isEditing && setEditData(prev => ({ ...prev, date_of_joining: date }))}
                  placeholder="Date of Joining"
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  readOnly={!isEditing}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Shift Start Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={formatTimeToHHMM(
                    isEditing 
                      ? (editData?.shift_start_time || employeeData.shift_start_time || '')
                      : (employeeData.shift_start_time || '')
                  )}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200 cursor-pointer' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Shift Start Time"
                  readOnly={!isEditing}
                  onClick={(e) => {
                    if (isEditing) {
                      const input = e.currentTarget as HTMLInputElement;
                      if (input.showPicker) {
                        input.showPicker();
                      }
                    }
                  }}
                  onFocus={(e) => {
                    if (isEditing) {
                      const input = e.currentTarget as HTMLInputElement;
                      if (input.showPicker) {
                        input.showPicker();
                      }
                    }
                  }}
                  onChange={e => {
                    if (isEditing) {
                      const newValue = e.target.value;
                      setEditData(prev => {
                        const updated = { ...prev, shift_start_time: newValue };
                        // Recalculate OT charge
                        const newOtCharge = calculateOTCharge(
                          updated.basic_salary || employeeData?.basic_salary || '',
                          newValue,
                          updated.shift_end_time || employeeData?.shift_end_time || ''
                        );
                        if (newOtCharge) {
                          updated.ot_charge = newOtCharge;
                        }
                        return updated;
                      });
                    }
                  }}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Shift End Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={formatTimeToHHMM(
                    isEditing 
                      ? (editData?.shift_end_time || employeeData.shift_end_time || '')
                      : (employeeData.shift_end_time || '')
                  )}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200 cursor-pointer' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Shift End Time"
                  readOnly={!isEditing}
                  onClick={(e) => {
                    if (isEditing) {
                      const input = e.currentTarget as HTMLInputElement;
                      if (input.showPicker) {
                        input.showPicker();
                      }
                    }
                  }}
                  onFocus={(e) => {
                    if (isEditing) {
                      const input = e.currentTarget as HTMLInputElement;
                      if (input.showPicker) {
                        input.showPicker();
                      }
                    }
                  }}
                  onChange={e => {
                    if (isEditing) {
                      const newValue = e.target.value;
                      setEditData(prev => {
                        const updated = { ...prev, shift_end_time: newValue };
                        // Recalculate OT charge
                        const newOtCharge = calculateOTCharge(
                          updated.basic_salary || employeeData?.basic_salary || '',
                          updated.shift_start_time || employeeData?.shift_start_time || '',
                          newValue
                        );
                        if (newOtCharge) {
                          updated.ot_charge = newOtCharge;
                        }
                        return updated;
                      });
                    }
                  }}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  Basic Salary <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={isEditing ? editData?.basic_salary || '' : employeeData.basic_salary || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="Basic Salary"
                  readOnly={!isEditing}
                  onChange={e => {
                    if (isEditing) {
                      const newValue = e.target.value;
                      setEditData(prev => {
                        const updated = { ...prev, basic_salary: newValue };
                        // Recalculate OT charge
                        const newOtCharge = calculateOTCharge(
                          newValue,
                          updated.shift_start_time || employeeData?.shift_start_time || '',
                          updated.shift_end_time || employeeData?.shift_end_time || ''
                        );
                        if (newOtCharge) {
                          updated.ot_charge = newOtCharge;
                        }
                        return updated;
                      });
                    }
                  }}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  TDS (eg: 7%)
                </label>
                <input
                  type="text"
                  value={isEditing ? editData?.tds_percentage || '' : employeeData.tds_percentage || ''}
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  readOnly={!isEditing}
                  onChange={e => isEditing && setEditData(prev => ({ ...prev, tds_percentage: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-700 text-sm font-medium px-1">
                  OT Charge (per hour)
                </label>
                <input
                  type="text"
                  value={isEditing 
                    ? (editData?.ot_charge !== undefined ? editData.ot_charge : (employeeData.ot_charge ? String(employeeData.ot_charge) : '')) 
                    : (employeeData.ot_charge ? String(employeeData.ot_charge) : '')
                  }
                  className={`w-full px-4 py-3 border rounded-lg transition-colors ${
                    isEditing 
                      ? 'border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                  }`}
                  placeholder="OT Charge per hour (optional)"
                  readOnly={!isEditing}
                  onChange={e => {
                    if (isEditing) {
                      const value = e.target.value;
                      // Allow empty value or valid number
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setEditData(prev => ({ ...prev, ot_charge: value }));
                      }
                    }
                  }}
                />
                <div className="mt-1 text-xs text-gray-500">
                  <p className="mb-1">💡 <strong>Formula:</strong> Basic Salary / ((Shift Hours - Break Time) × {averageDaysPerMonth})</p>
                  <p className="mb-1">📋 <strong>Breakdown:</strong></p>
                  <ul className="ml-4 list-disc space-y-0.5">
                    <li>Raw Shift Hours = End Time - Start Time</li>
                    <li>Effective Shift Hours = Raw Shift Hours - Break Time ({breakTime} hours)</li>
                    <li>OT Rate = Basic Salary ÷ (Effective Shift Hours × {averageDaysPerMonth} days)</li>
                  </ul>
                  <p className="mt-1">This will be calculated automatically if not provided. Using {averageDaysPerMonth} days (average days per month) and {breakTime} hours break time (configured in Salary Settings) for consistent OT rates.</p>
                </div>
                {isEditing && editData?.ot_charge && editData?.shift_start_time && editData?.shift_end_time && editData?.basic_salary && (
                  <div className="mt-2 text-xs text-gray-600 bg-teal-50 p-2 rounded border border-teal-200">
                    <p className="font-semibold mb-1">📊 Current Calculation:</p>
                    {(() => {
                      const rawShiftHours = (() => {
                        const [startH, startM] = formatTimeToHHMM(editData.shift_start_time || '').split(':').map(Number);
                        const [endH, endM] = formatTimeToHHMM(editData.shift_end_time || '').split(':').map(Number);
                        if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return 0;
                        let hours = (endH + endM / 60) - (startH + startM / 60);
                        if (hours <= 0) hours += 24;
                        return hours;
                      })();
                      const effectiveShiftHours = Math.max(0, rawShiftHours - breakTime);
                      const basicSalaryNum = parseFloat((editData.basic_salary || '').replace(/,/g, ''));
                      return (
                        <div className="space-y-1">
                          <p>• Raw Shift Hours: {rawShiftHours.toFixed(2)} hours (End Time - Start Time)</p>
                          <p>• Break Time: {breakTime} hours (deducted)</p>
                          <p>• Effective Shift Hours: {effectiveShiftHours.toFixed(2)} hours (Raw - Break)</p>
                          <p>• OT Rate = ₹{basicSalaryNum.toLocaleString()} ÷ ({effectiveShiftHours.toFixed(2)} × {averageDaysPerMonth}) = ₹{editData.ot_charge}</p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <label className="block mb-2 text-gray-700 text-sm font-medium px-1">Off Days</label>
                <div className="grid grid-cols-7 gap-2">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                    const fieldName = `off_${day.toLowerCase()}` as keyof EmployeeProfileData;
                    // When editing, use editData value if available, otherwise fall back to employeeData
                    const isChecked = isEditing 
                      ? (editData?.[fieldName] !== undefined 
                          ? (editData[fieldName] as boolean)
                          : (employeeData?.[fieldName] as boolean || false))
                      : (employeeData?.[fieldName] as boolean || false);
                    
                    return (
                      <div key={day} className="flex items-center">
                        <input
                          type="checkbox"
                          id={day}
                          checked={isChecked}
                          onChange={() => handleCheckboxChange(day)}
                          disabled={!isEditing}
                          className={`h-4 w-4 rounded focus:ring-teal-500 ${
                            isEditing 
                              ? 'text-teal-600 border-gray-300 cursor-pointer' 
                              : 'text-gray-400 border-gray-200 cursor-not-allowed'
                          }`}
                        />
                        <label htmlFor={day} className={`ml-2 text-sm ${
                          isEditing ? 'text-gray-700 cursor-pointer' : 'text-gray-500 cursor-not-allowed'
                        }`}>
                          {day}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
              {tenantWeeklyRulesEnabled && (
                <div className="col-span-2 mt-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="weekly_rules_enabled"
                      name="weekly_rules_enabled"
                      checked={isEditing 
                        ? (editData?.weekly_rules_enabled !== undefined 
                            ? editData.weekly_rules_enabled 
                            : (employeeData?.weekly_rules_enabled ?? true))
                        : (employeeData?.weekly_rules_enabled ?? true)}
                      onChange={(e) => {
                        if (isEditing) {
                          setEditData(prev => ({ ...prev, weekly_rules_enabled: e.target.checked }));
                        }
                      }}
                      disabled={!isEditing}
                      className={`h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 ${
                        isEditing 
                          ? 'cursor-pointer' 
                          : 'cursor-not-allowed opacity-50'
                      }`}
                    />
                    <label htmlFor="weekly_rules_enabled" className={`ml-2 text-sm ${
                      isEditing ? 'text-gray-700 cursor-pointer' : 'text-gray-500 cursor-not-allowed'
                    }`}>
                      Enable Weekly Rules (for penalty days calculation)
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Date</th>
                    <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">OT Hours</th>
                    <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Late Minutes</th>
                    <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                        Loading attendance records...
                      </td>
                    </tr>
                  ) : attendanceRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                        No attendance records found.
                      </td>
                    </tr>
                  ) : (
                    attendanceRecords.map((record, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{record.date}</td>
                        <td className="px-4 py-3 text-sm">{record.ot_hours.toFixed(1)}</td>
                        <td className="px-4 py-3 text-sm">{record.late_minutes}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            record.status === 'Present' 
                              ? 'bg-teal-100 text-teal-600' 
                              : record.status === 'Half Day'
                                ? 'bg-yellow-100 text-yellow-600'
                                : 'bg-red-100 text-red-600'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HREmployeeDetails; 