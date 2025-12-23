import React, { useState, useRef, useEffect } from 'react';
import { User, Briefcase, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiCall, apiUpload } from '../services/api';
import { getDropdownOptions } from '../services/dropdownService';
import { getCountryOptions, getStateOptions, getCityOptions } from '../services/locationService';
import CustomDateInputWithOverlay from './CustomDateInputWithOverlay';
import Dropdown, { DropdownOption } from './Dropdown';
import './HRAddEmployee.css';
import './TimeInput.css';
import { logger } from '../utils/logger';

// Define interface for form state
interface EmployeeFormState {
  // Personal Information
  first_name: string;
  last_name: string;
  mobile_number: string;
  email: string;
  date_of_birth: string;
  marital_status: string;
  gender: string;
  nationality: string;
  address: string;
  city: string;
  state: string;

  // Professional Information
  department: string;
  designation: string;
  employment_type: string;
  date_of_joining: string;
  location_branch: string;
  shift_start_time: string;
  shift_end_time: string;
  basic_salary: string;
  tds_percentage: string;
  ot_charge: string;

  // Off Days
  off_monday: boolean;
  off_tuesday: boolean;
  off_wednesday: boolean;
  off_thursday: boolean;
  off_friday: boolean;
  off_saturday: boolean;
  off_sunday: boolean;

  // Employee Status
  is_active: boolean;
  weekly_rules_enabled: boolean;
}


const HRAddEmployee: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'personal' | 'professional'>('personal');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isOTChargeManuallyEdited, setIsOTChargeManuallyEdited] = useState<boolean>(false);
  const [averageDaysPerMonth, setAverageDaysPerMonth] = useState<number>(30.4); // Default fallback
  const [breakTime, setBreakTime] = useState<number>(0.5); // Default fallback (30 minutes)
  const [tenantWeeklyRulesEnabled, setTenantWeeklyRulesEnabled] = useState<boolean>(false);

  // Dropdown options state
  const [dropdownOptions, setDropdownOptions] = useState({
    departments: [] as string[],
    locations: [] as string[],
    designations: [] as string[],
    cities: [] as string[],
    states: [] as string[]
  });

  // Location dropdown options
  const [countryOptions, setCountryOptions] = useState<DropdownOption[]>([]);
  const [stateOptions, setStateOptions] = useState<DropdownOption[]>([]);
  const [cityOptions, setCityOptions] = useState<DropdownOption[]>([]);
  
  // Store all employees for counting by department
  const [allEmployees, setAllEmployees] = useState<EmployeeFormState[]>([]);

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

  const locationOptions: DropdownOption[] = dropdownOptions.locations.map(loc => ({
    value: loc,
    label: loc
  }));

  const designationOptions: DropdownOption[] = dropdownOptions.designations.map(desig => ({
    value: desig,
    label: desig
  }));


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

  const salaryOptions: DropdownOption[] = [
    { value: '', label: 'Select Basic Salary' },
    { value: '0', label: '₹0' },
    { value: '15000', label: '₹15,000' },
    { value: '30000', label: '₹30,000' },
    { value: '45000', label: '₹45,000' },
    { value: '60000', label: '₹60,000' }
  ];


  // Load location data
  useEffect(() => {
    const loadLocationData = async () => {
      try {
        const countries = await getCountryOptions();
        setCountryOptions(countries);
      } catch (error) {
        logger.error('Error loading location data:', error);
      }
    };

    loadLocationData();
  }, []);

  // Load all employees for department count
  useEffect(() => {
    const loadAllEmployees = async () => {
      try {
        const response = await apiCall('/api/excel/employees/?page_size=1000', { method: 'GET' });
        if (response.ok) {
          const data = await response.json();
          const employees = Array.isArray(data) ? data : (data?.results || []);
          setAllEmployees(employees);
          logger.info('✅ Loaded all employees for department count:', employees.length);
        }
      } catch (error) {
        logger.error('Error loading all employees:', error);
        // Continue without employee counts if fetch fails
      }
    };

    loadAllEmployees();
  }, []);

  // Handle country change
  const handleCountryChange = async (countryCode: string) => {
    setFormData(prev => ({ ...prev, nationality: countryCode }));
    setStateOptions([]);
    setCityOptions([]);

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
    setFormData(prev => ({ ...prev, state: stateCode }));
    setCityOptions([]);

    if (stateCode && formData.nationality) {
      try {
        // Create a combined identifier for backward compatibility
        const stateId = `${formData.nationality}_${stateCode}`;
        const cities = await getCityOptions(stateId);
        setCityOptions(cities);
      } catch (error) {
        logger.error('Error loading cities:', error);
      }
    }
  };

  // Handle city change
  const handleCityChange = (cityId: string) => {
    setFormData(prev => ({ ...prev, city: cityId }));
  };

  // Initialize form state with default values
  const [formData, setFormData] = useState<EmployeeFormState>({
    // Personal Information
    first_name: '',
    last_name: '',
    mobile_number: '',
    email: '',
    date_of_birth: '',
    marital_status: '',
    gender: '',
    nationality: '',
    address: '',
    city: '',
    state: '',

    // Professional Information
    department: '',
    designation: '',
    employment_type: '',
    date_of_joining: '',
    location_branch: '',
    shift_start_time: '',
    shift_end_time: '',
    basic_salary: '',
    tds_percentage: '',
    ot_charge: '',

    // Off Days
    off_monday: false,
    off_tuesday: false,
    off_wednesday: false,
    off_thursday: false,
    off_friday: false,
    off_saturday: false,
    off_sunday: true,

    // Employee Status
    is_active: true,
    weekly_rules_enabled: true, // Default to true
  });


  // Fetch salary config on component mount
  useEffect(() => {
    const loadSalaryConfig = async () => {
      try {
        const response = await apiCall('/api/salary-config/', { method: 'GET' });
        if (response.ok) {
          const data = await response.json();
          if (data && data.average_days_per_month) {
            setAverageDaysPerMonth(data.average_days_per_month);
          }
          if (data && data.break_time !== undefined) {
            setBreakTime(data.break_time);
          } else {
            setBreakTime(0.5); // Default to 30 minutes if not provided
          }
          // Check if tenant weekly rules are enabled
          if (data && data.weekly_absent_penalty_enabled !== undefined) {
            setTenantWeeklyRulesEnabled(!!data.weekly_absent_penalty_enabled);
          }
        }
      } catch (error) {
        // Use default value if fetch fails
        logger.warn('Failed to load salary config, using default 30.4');
        setAverageDaysPerMonth(30.4);
      }
    };
    loadSalaryConfig();
  }, []);

  // Fetch dropdown options on component mount
  useEffect(() => {
    const loadDropdownOptions = async () => {
      try {
        const options = await getDropdownOptions();
        setDropdownOptions(options);
      } catch (error) {
        logger.error('Failed to load dropdown options:', error);
        // Set empty arrays as fallback
        setDropdownOptions({
          departments: [],
          locations: [],
          designations: [],
          cities: [],
          states: []
        });
      }
    };

    loadDropdownOptions();
  }, []);



  // Custom add handlers for new dropdown component
  const handleCustomDepartmentAdd = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      departments: prev.departments.includes(value) ? prev.departments : [...prev.departments, value]
    }));
  };

  const handleDepartmentRemove = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      departments: prev.departments.filter(d => d !== value)
    }));
    if (formData.department === value) {
      setFormData(prev => ({ ...prev, department: '' }));
    }
  };

  const handleCustomLocationAdd = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      locations: prev.locations.includes(value) ? prev.locations : [...prev.locations, value]
    }));
  };

  const handleCustomDesignationAdd = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      designations: prev.designations.includes(value) ? prev.designations : [...prev.designations, value]
    }));
  };

  const handleDesignationRemove = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      designations: prev.designations.filter(d => d !== value)
    }));
    if (formData.designation === value) {
      setFormData(prev => ({ ...prev, designation: '' }));
    }
  };

  const handleCustomCityAdd = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      cities: prev.cities.includes(value) ? prev.cities : [...prev.cities, value]
    }));
  };

  const handleCustomStateAdd = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      states: prev.states.includes(value) ? prev.states : [...prev.states, value]
    }));
  };

  // Helper function to calculate shift hours from start and end times
  const calculateShiftHours = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    
    try {
      // Parse time strings (format: HH:MM or HH:MM:SS)
      const parseTime = (timeStr: string): number => {
        const parts = timeStr.split(':');
        const hours = parseInt(parts[0] || '0', 10);
        const minutes = parseInt(parts[1] || '0', 10);
        return hours + minutes / 60;
      };
      
      const start = parseTime(startTime);
      let end = parseTime(endTime);
      
      // Handle overnight shifts (end time before start time means next day)
      if (end <= start) {
        end += 24;
      }
      
      return end - start;
    } catch (error) {
      logger.error('Error calculating shift hours:', error);
      return 0;
    }
  };

  // Helper function to calculate working days from off days
  const calculateWorkingDays = (offDays: {
    off_monday: boolean;
    off_tuesday: boolean;
    off_wednesday: boolean;
    off_thursday: boolean;
    off_friday: boolean;
    off_saturday: boolean;
    off_sunday: boolean;
  }): number => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // Get total days in current month
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    // Build off-day set (0 = Monday, 6 = Sunday)
    const offDaySet = new Set<number>();
    if (offDays.off_monday) offDaySet.add(0);
    if (offDays.off_tuesday) offDaySet.add(1);
    if (offDays.off_wednesday) offDaySet.add(2);
    if (offDays.off_thursday) offDaySet.add(3);
    if (offDays.off_friday) offDaySet.add(4);
    if (offDays.off_saturday) offDaySet.add(5);
    if (offDays.off_sunday) offDaySet.add(6);
    
    // Calculate working days excluding off days
    let workingDays = 0;
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      const weekday = (date.getDay() + 6) % 7; // Convert to Monday=0 format
      if (!offDaySet.has(weekday)) {
        workingDays++;
      }
    }
    
    return workingDays;
  };

  // Helper function to calculate OT rate using STATIC formula: basic_salary / ((shift_hours - break_time) × AVERAGE_DAYS_PER_MONTH)
  const calculateOTRate = (
    basicSalary: string,
    shiftStartTime: string,
    shiftEndTime: string,
    offDays: {
      off_monday: boolean;
      off_tuesday: boolean;
      off_wednesday: boolean;
      off_thursday: boolean;
      off_friday: boolean;
      off_saturday: boolean;
      off_sunday: boolean;
    }
  ): string => {
    if (!shiftStartTime || !shiftEndTime || !basicSalary) {
      return '';
    }
    
    // Calculate (end_time - start_time) in hours
    const rawShiftHours = calculateShiftHours(shiftStartTime, shiftEndTime);
    if (rawShiftHours <= 0) {
      return '';
    }
    
    // Subtract break time from shift hours
    const breakTimeHours = breakTime !== undefined ? breakTime : 0.5;
    const shiftHours = Math.max(0, rawShiftHours - breakTimeHours);
    if (shiftHours <= 0) {
      return '';
    }
    
    // Parse basic salary (remove commas if any)
    const basicSalaryNum = parseFloat(basicSalary.replace(/,/g, ''));
    if (isNaN(basicSalaryNum) || basicSalaryNum <= 0) {
      return '';
    }
    
    // Use averageDaysPerMonth from state, fallback to 30.4 if not loaded yet
    const avgDays = averageDaysPerMonth || 30.4;
    
    // OT Charge per Hour = basic_salary / ((shift_hours - break_time) × AVERAGE_DAYS_PER_MONTH)
    // Using AVERAGE_DAYS_PER_MONTH and break_time from backend config for consistent OT rates
    const otRate = basicSalaryNum / (shiftHours * avgDays);
    
    return otRate.toFixed(2);
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    // Handle checkboxes separately
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => {
        const updated = { ...prev, [name]: checked };
        // Recalculate OT rate when off days change
        if (name.startsWith('off_')) {
          updated.ot_charge = calculateOTRate(
            updated.basic_salary,
            updated.shift_start_time,
            updated.shift_end_time,
            {
              off_monday: updated.off_monday,
              off_tuesday: updated.off_tuesday,
              off_wednesday: updated.off_wednesday,
              off_thursday: updated.off_thursday,
              off_friday: updated.off_friday,
              off_saturday: updated.off_saturday,
              off_sunday: updated.off_sunday,
            }
          );
        }
        return updated;
      });
    } else {
      setFormData(prev => {
        const updated = { ...prev, [name]: value };
        
        // Track if OT charge is manually edited
        if (name === 'ot_charge') {
          // If field is cleared, show hint again
          setIsOTChargeManuallyEdited(value !== '' && value !== null && value !== undefined);
          return updated;
        }
        
        // Recalculate OT rate when shift start time or shift end time changes
        if (name === 'shift_start_time' || name === 'shift_end_time') {
          const autoCalculated = calculateOTRate(
            updated.basic_salary,
            updated.shift_start_time,
            updated.shift_end_time,
            {
              off_monday: updated.off_monday,
              off_tuesday: updated.off_tuesday,
              off_wednesday: updated.off_wednesday,
              off_thursday: updated.off_thursday,
              off_friday: updated.off_friday,
              off_saturday: updated.off_saturday,
              off_sunday: updated.off_sunday,
            }
          );
          updated.ot_charge = autoCalculated;
          // Reset manual edit flag when auto-calculated
          setIsOTChargeManuallyEdited(false);
        }
        return updated;
      });
    }
  };

  // Handle salary dropdown changes
  const handleSalaryChange = (value: string) => {
    setFormData(prev => {
      const updated = { ...prev, basic_salary: value };
      // Recalculate OT rate when basic salary changes
      updated.ot_charge = calculateOTRate(
        updated.basic_salary,
        updated.shift_start_time,
        updated.shift_end_time,
        {
          off_monday: updated.off_monday,
          off_tuesday: updated.off_tuesday,
          off_wednesday: updated.off_wednesday,
          off_thursday: updated.off_thursday,
          off_friday: updated.off_friday,
          off_saturday: updated.off_saturday,
          off_sunday: updated.off_sunday,
        }
      );
      // Reset manual edit flag when auto-calculated
      setIsOTChargeManuallyEdited(false);
      return updated;
    });
  };

  // Handle checkbox changes for off days
  const handleCheckboxChange = (day: string) => {
    const fieldName = `off_${day.toLowerCase()}` as keyof EmployeeFormState;
    setFormData(prev => {
      const updated = { ...prev, [fieldName]: !prev[fieldName] };
      // Recalculate OT rate when off days change
      updated.ot_charge = calculateOTRate(
        updated.basic_salary,
        updated.shift_start_time,
        updated.shift_end_time,
        {
          off_monday: updated.off_monday,
          off_tuesday: updated.off_tuesday,
          off_wednesday: updated.off_wednesday,
          off_thursday: updated.off_thursday,
          off_friday: updated.off_friday,
          off_saturday: updated.off_saturday,
          off_sunday: updated.off_sunday,
        }
      );
      // Reset manual edit flag when auto-calculated
      setIsOTChargeManuallyEdited(false);
      return updated;
    });
  };

  // Function to validate the form based on active tab
  const validateForm = (): boolean => {
    if (activeTab === 'personal') {
      if (!formData.first_name || !formData.first_name.trim()) {
        setError('Please fill in all required fields: First Name is required');
        return false;
      }
    } else if (activeTab === 'professional') {
      const missingFields: string[] = [];
      
      if (!formData.shift_start_time || !formData.shift_start_time.trim()) {
        missingFields.push('Shift Start Time');
      }
      if (!formData.shift_end_time || !formData.shift_end_time.trim()) {
        missingFields.push('Shift End Time');
      }
      if (!formData.basic_salary || !formData.basic_salary.trim()) {
        missingFields.push('Basic Salary');
      }
      if (!formData.date_of_joining || !formData.date_of_joining.trim()) {
        missingFields.push('Date of Joining');
      }
      
      if (missingFields.length > 0) {
        setError(`Please fill in all required fields: ${missingFields.join(', ')}`);
        return false;
      }
    }

    setError(null);
    return true;
  };

  // Handle file upload events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setSelectedFile(file);
      } else {
        alert('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setSelectedFile(file);
      } else {
        alert('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
      }
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleTemplateDownload = async () => {
    try {
      const response = await apiCall('/api/employees/download_template/', { method: 'GET' });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'employee_upload_template.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to download template');
      }
    } catch (error) {
      logger.error('Template download error:', error);
      alert('Failed to download template');
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await apiUpload('/api/employees/bulk_upload/', formData);

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('Upload error details:', errorData);

        let errorMessage = 'Upload failed: ';
        if (errorData.error) {
          errorMessage += errorData.error;
        }
        if (errorData.expected_columns) {
          errorMessage += '\n\nExpected columns:\n' + errorData.expected_columns.join(', ');
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();

      let message = `Upload completed!\n`;
      message += `✅ ${result.employees_created} employees created successfully\n`;
      if (result.employees_failed > 0) {
        message += `❌ ${result.employees_failed} employees failed\n`;
        if (result.error_details && result.error_details.length > 0) {
          message += `\nError details:\n${result.error_details.join('\n')}`;
        }
      }

      alert(message);

      if (result.employees_created > 0) {
        setSelectedFile(null);
        
        // Dispatch refresh event to update all components
        logger.info( '📡 Dispatching employeeAdded and refreshEmployeeData events');
        window.dispatchEvent(new CustomEvent('employeeAdded', { detail: { timestamp: Date.now() } }));
        window.dispatchEvent(new CustomEvent('refreshEmployeeData'));
        
        navigate('/hr-management/directory');
      }
    } catch (error) {
      logger.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to handle form submission
  const handleSubmit = async (e?: React.FormEvent) => {
    // Prevent default form submission if event is provided
    if (e) {
      e.preventDefault();
    }
    
    if (!validateForm()) {
      // Scroll to error message
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (activeTab === 'personal') {
      // Move to professional tab if on personal tab
      setActiveTab('professional');
      return;
    }

    // Final validation before submission
    if (!formData.date_of_joining || !formData.date_of_joining.trim()) {
      setError('Date of Joining is required');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // If on professional tab, submit the form
    setIsSubmitting(true);
    setError(null);

    try {
      // Structure data according to the backend expectation
      // Separate personal and professional information
      const personalInfo = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        mobile_number: formData.mobile_number,
        email: formData.email,
        date_of_birth: formData.date_of_birth,
        marital_status: formData.marital_status,
        gender: formData.gender,
        nationality: formData.nationality,
        address: formData.address,
        city: formData.city,
        state: formData.state
      };

      const professionalInfo = {
        department: formData.department,
        designation: formData.designation,
        employment_type: formData.employment_type,
        date_of_joining: formData.date_of_joining,
        location_branch: formData.location_branch,
        shift_start_time: formData.shift_start_time,
        shift_end_time: formData.shift_end_time,
        basic_salary: formData.basic_salary.replace(/,/g, ''), // Remove commas from salary
        tds_percentage: formData.tds_percentage.replace('%', ''), // Remove % sign from TDS
        ot_charge: formData.ot_charge,
        // Send individual off day boolean fields as expected by backend
        off_monday: formData.off_monday,
        off_tuesday: formData.off_tuesday,
        off_wednesday: formData.off_wednesday,
        off_thursday: formData.off_thursday,
        off_friday: formData.off_friday,
        off_saturday: formData.off_saturday,
        off_sunday: formData.off_sunday,
        is_active: formData.is_active,
        weekly_rules_enabled: formData.weekly_rules_enabled
      };

      // Make the API call to your backend endpoint using apiCall for authentication
      const response = await apiCall('/api/employees/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...personalInfo,
          ...professionalInfo
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
      }

      await response.json();

      // If successful, show a success message and navigate to the directory page
      alert('Employee added successfully!');
      
      // Dispatch refresh event to update all components
      logger.info( '📡 Dispatching employeeAdded and refreshEmployeeData events');
      window.dispatchEvent(new CustomEvent('employeeAdded', { detail: { timestamp: Date.now() } }));
      window.dispatchEvent(new CustomEvent('refreshEmployeeData'));
      
      navigate('/hr-management/directory');
    } catch (err) {
      logger.error('Error creating employee:', err);
      let errorMessage = 'An error occurred while saving the employee data';

      // Try to parse error message if it's JSON
      if (err instanceof Error) {
        try {
          const parsedError = JSON.parse(err.message);
          errorMessage = '';

          // Format error messages for each field
          for (const [field, messages] of Object.entries(parsedError)) {
            errorMessage += `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}\n`;
          }
        } catch {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* File Upload Area */}
      <div className="m-6">
        {/* <h3 className="text-lg font-medium mb-4">Add New Employee</h3> */}

        <div
          className={`border-2 border-dashed rounded-lg p-8 ${dragActive ? 'border-teal-500 bg-teal-50' : 'border-gray-300'
            }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 flex items-center justify-center mb-4">
              {/* Custom folder upload icon */}
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g>
                  <rect x="8" y="16" width="40" height="28" rx="4" fill="#176B6B" />
                  <rect x="8" y="16" width="40" height="28" rx="4" stroke="#176B6B" strokeWidth="2" />
                  <rect x="16" y="8" width="24" height="12" rx="2" fill="#B2F4F4" />
                  <rect x="16" y="8" width="24" height="12" rx="2" stroke="#B2F4F4" strokeWidth="2" />
                  <circle cx="28" cy="30" r="8" fill="#EAF6F6" />
                  <path d="M28 26v6" stroke="#176B6B" strokeWidth="2" strokeLinecap="round" />
                  <path d="M25 29l3 3 3-3" stroke="#176B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              </svg>
            </div>

            <h4 className="text-lg font-medium mb-2">Drag your file(s) to start uploading</h4>
            <p className="text-gray-500 mb-4">OR</p>

            <button
              onClick={handleBrowseClick}
              className="px-5 py-2 border-2 border-[#176B6B] text-[#176B6B] rounded-lg bg-white hover:bg-[#EAF6F6] font-medium text-base transition"
            >
              Browse files
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Bulk Upload Instructions */}
      <div className="mx-8 mb-6">
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-teal-800 mb-3 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            Bulk Upload Instructions
          </h3>
          <div className="space-y-2 text-sm text-teal-700">
            <p className="font-medium">Please follow these guidelines when preparing your employee data:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Fill in employee data starting from row 4</li>
              <li><strong>Employment Type:</strong> Full Time, Part Time, Contract, Intern (leave empty if not available)</li>
              <li><strong>Marital Status:</strong> Single, Married, Divorced, Widowed</li>
              <li><strong>Gender:</strong> Male, Female, Other</li>
              <li><strong>Shift Times:</strong> Use HH:MM:SS format (e.g., 09:00:00)</li>
              <li><strong>Basic Salary:</strong> Enter as number only (e.g., 50000)</li>
              <li><strong>OT Rate (per hour):</strong> Overtime hourly rate. Auto-calculated as Basic Salary / ((Shift Hours - Break Time) × {averageDaysPerMonth})
                <ul className="ml-4 mt-1 list-disc space-y-0.5 text-xs">
                  <li>Raw Shift Hours = End Time - Start Time</li>
                  <li>Effective Shift Hours = Raw Shift Hours - Break Time ({breakTime} hours)</li>
                  <li>OT Rate = Basic Salary ÷ (Effective Shift Hours × {averageDaysPerMonth} days)</li>
                </ul>
              </li>
              <li><strong>Dates:</strong> Use YYYY-MM-DD format (e.g., 2024-01-01)</li>
              <li><strong>TDS:</strong> Enter as percentage number (e.g., 10 for 10%)</li>
              <li><strong>OFF DAY:</strong> Monday, Tuesday, etc. (comma-separated for multiple days)</li>
              <li>If TDS not provided, defaults to 0</li>
              <li>If OFF DAY not provided, defaults to no off days</li>
              <li>If Date of joining not provided, defaults to upload date</li>
            </ol>
            <div className="mt-3 p-2 bg-teal-100 rounded border-l-4 border-teal-400">
              <p className="text-xs font-medium">💡 <strong>Pro Tip:</strong> Download the template first to see the exact column structure and format requirements.</p>
            </div>
          </div>
        </div>
      </div>

      {/* File upload note and controls */}
      <div className="flex justify-between items-center mt-2 ml-8 mr-8 mb-6">
        <div className="flex items-center">
          <span className="text-gray-500 text-sm">Supports Excel (.xlsx, .xls) and CSV files. </span>
          <button
            onClick={handleTemplateDownload}
            className="ml-1 text-[#176B6B] underline text-sm font-medium hover:text-[#0B5E59]"
            type="button"
            disabled={isSubmitting}
          >
            Download Template
          </button>
        </div>

        {/* Selected file and upload button */}
        {selectedFile && (
          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg mx-8 mb-6">
            <span className="text-sm text-gray-700">
              Selected: {selectedFile.name}
            </span>
            <button
              onClick={handleFileUpload}
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#176B6B] text-white rounded-lg hover:bg-[#0B5E59] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Uploading...' : 'Upload Employees'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mx-6">
        <div className="flex border-b">
          <div className="relative px-6">
            <button
              className={`flex items-center gap-2 pb-4 ${activeTab === 'personal' ? 'text-teal-600 font-medium' : 'text-gray-600'
                }`}
              onClick={() => setActiveTab('personal')}
            >
              <User size={18} />
              <span>Personal Information</span>
            </button>
            {activeTab === 'personal' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-teal-600"></div>
            )}
          </div>
          <div className="relative px-6">
            <button
              className={`flex items-center gap-2 pb-4 ${activeTab === 'professional' ? 'text-teal-600 font-medium' : 'text-gray-600'
                }`}
              onClick={() => setActiveTab('professional')}
            >
              <Briefcase size={18} />
              <span>Professional Information</span>
            </button>
            {activeTab === 'professional' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-teal-600"></div>
            )}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-6 pt-4">
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2 text-red-700">
            <AlertCircle size={18} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Personal Information Form */}
        {activeTab === 'personal' && (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className='block mb-1 text-sm font-medium px-1 text-gray-700'>
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                placeholder="First Name"
                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-gray-500 placeholder-gray-500"
                required
              />
            </div>
            <div>
              <label className='block mb-1 text-sm font-medium px-1 text-gray-700'>
                Last Name
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                placeholder="Last Name"
                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-gray-500 placeholder-gray-500"
              />
            </div>
            <div>
              <input
                type="text"
                name="mobile_number"
                value={formData.mobile_number}
                onChange={handleInputChange}
                placeholder="Mobile Number"
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-1 
      ${!/^\d{10}$/.test(formData.mobile_number) && formData.mobile_number
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-200 focus:ring-teal-500"} 
      text-gray-500 placeholder-gray-500`}
              />
              {!/^\d{10}$/.test(formData.mobile_number) && formData.mobile_number && (
                <p className="text-red-500 text-sm mt-1">Enter a valid 10-digit mobile number</p>
              )}
            </div>

            <div>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Email Address"
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-1 
                              ${!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && formData.email
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-200 focus:ring-teal-500"} 
                                text-gray-500 placeholder-gray-500`}
              />
              {!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && formData.email && (
                <p className="text-red-500 text-sm mt-1">Enter a valid email address</p>
              )}
            </div>

            <div>
              <label htmlFor="date_of_birth" className="block mb-1 text-sm font-medium px-1 text-gray-700">
                Date of Birth
              </label>
              <CustomDateInputWithOverlay
                value={formData.date_of_birth}
                onChange={(date) => setFormData(prev => ({ ...prev, date_of_birth: date }))}
                placeholder="Date of Birth"
                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 pointer-events-auto bg-transparent"
                name="date_of_birth"
              />
            </div>
            <Dropdown
              options={maritalStatusOptions}
              value={formData.marital_status}
              onChange={(value) => setFormData(prev => ({ ...prev, marital_status: value }))}
              placeholder="Marital Status"
              label="Marital Status"
              required
            />
            <Dropdown
              options={genderOptions}
              value={formData.gender}
              onChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
              placeholder="Gender"
              label="Gender"
              required
            />
            <Dropdown
              options={countryOptions}
              value={formData.nationality}
              onChange={handleCountryChange}
              placeholder="Select Country"
              label="Country"
              required
            />
            <Dropdown
              options={stateOptions}
              value={formData.state}
              onChange={handleStateChange}
              placeholder="Select State"
              label="State"
              required
              disabled={stateOptions.length === 0}
            />
            <Dropdown
              options={cityOptions}
              value={formData.city}
              onChange={handleCityChange}
              placeholder="Select City"
              label="City"
              required
              disabled={cityOptions.length === 0}
            />
            <div className="col-span-2">
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Address"
                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-gray-500 placeholder-gray-500"
              />
            </div>
          </div>
        )}

        {/* Professional Information Form */}
        {activeTab === 'professional' && (
          <div className="grid grid-cols-2 gap-6">
            <Dropdown
              options={departmentOptions}
              value={formData.department}
              onChange={(value) => setFormData(prev => ({ ...prev, department: value }))}
              placeholder="Select Department"
              allowCustom
              onCustomAdd={handleCustomDepartmentAdd}
              customPlaceholder="Enter new department"
              label="Department"
              required
              onRemoveOption={handleDepartmentRemove}
            />
            <Dropdown
              options={designationOptions}
              value={formData.designation}
              onChange={(value) => setFormData(prev => ({ ...prev, designation: value }))}
              placeholder="Select Designation"
              allowCustom
              onCustomAdd={handleCustomDesignationAdd}
              customPlaceholder="Enter new designation"
              label="Designation"
              required
            onRemoveOption={handleDesignationRemove}
            />
            <Dropdown
              options={employmentTypeOptions}
              value={formData.employment_type}
              onChange={(value) => setFormData(prev => ({ ...prev, employment_type: value }))}
              placeholder="Employment Type"
              label="Employment Type"
              required
            />
            <div>
              <label
                htmlFor="date_of_joining"
                className="block mt-1 text-sm font-medium text-gray-700"
              >
                Date of Joining <span className="text-red-500">*</span>
              </label>
              <CustomDateInputWithOverlay
                value={formData.date_of_joining}
                onChange={(date) =>
                  setFormData((prev) => ({ ...prev, date_of_joining: date }))
                }
                placeholder="Date of Joining"
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-1 pointer-events-auto bg-transparent ${
                  !formData.date_of_joining && activeTab === 'professional'
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-gray-200 focus:ring-teal-500'
                }`}
                name="date_of_joining"
                required={true}
              />
              {!formData.date_of_joining && activeTab === 'professional' && (
                <p className="text-red-500 text-sm mt-1">Date of Joining is required</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <label htmlFor="shift_start_time" className="block mb-1 text-sm font-medium text-gray-700">Shift Start Time</label>
                <input
                  id="shift_start_time"
                  type="time"
                  name="shift_start_time"
                  value={formData.shift_start_time}
                  onClick={(e) => {
                    const input = e.currentTarget as HTMLInputElement;
                    if (input.showPicker) {
                      input.showPicker();
                    }
                  }}
                  onFocus={(e) => {
                    const input = e.currentTarget as HTMLInputElement;
                    if (input.showPicker) {
                      input.showPicker();
                    }
                  }}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 bg-white text-gray-700 hover:border-gray-300 transition-colors duration-200 cursor-pointer ${
                    !formData.shift_start_time && activeTab === 'professional'
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-200 focus:border-teal-500 focus:ring-teal-500'
                  }`}
                />
                {!formData.shift_start_time && activeTab === 'professional' && (
                  <p className="text-red-500 text-sm mt-1">Shift Start Time is required</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <label htmlFor="shift_end_time" className="block mb-1 text-sm font-medium text-gray-700">Shift End Time</label>
                <input
                  id="shift_end_time"
                  type="time"
                  name="shift_end_time"
                  value={formData.shift_end_time}
                  onClick={(e) => {
                    const input = e.currentTarget as HTMLInputElement;
                    if (input.showPicker) {
                      input.showPicker();
                    }
                  }}
                  onFocus={(e) => {
                    const input = e.currentTarget as HTMLInputElement;
                    if (input.showPicker) {
                      input.showPicker();
                    }
                  }}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 bg-white text-gray-700 hover:border-gray-300 transition-colors duration-200 cursor-pointer ${
                    !formData.shift_end_time && activeTab === 'professional'
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-200 focus:border-teal-500 focus:ring-teal-500'
                  }`}
                />
                {!formData.shift_end_time && activeTab === 'professional' && (
                  <p className="text-red-500 text-sm mt-1">Shift End Time is required</p>
                )}
              </div>
            </div>
            <Dropdown
              options={locationOptions}
              value={formData.location_branch}
              onChange={(value) => setFormData(prev => ({ ...prev, location_branch: value }))}
              placeholder="Select Location/Branch"
              allowCustom
              onCustomAdd={handleCustomLocationAdd}
              customPlaceholder="Enter new location"
              label="Location/Branch"
              required
            />

            <div>
              <label className='block mb-1 text-sm font-medium px-1 text-gray-700'>
                Basic Salary <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="basic_salary"
                value={formData.basic_salary}
                onChange={(e) => handleSalaryChange(e.target.value)}
                placeholder="Enter Basic Salary"
                className={`w-full h-[45px] border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 ${
                  !formData.basic_salary && activeTab === 'professional'
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-gray-200 focus:ring-teal-500'
                }`}
                required
              />
              {!formData.basic_salary && activeTab === 'professional' && (
                <p className="text-red-500 text-sm mt-1">Basic Salary is required</p>
              )}
            </div>


            <div className="relative">
              <label className='block mb-1 text-sm font-medium px-1 text-gray-700'>
                TDS (e.g., 7%)
              </label>
              <input
                type="text"
                name="tds_percentage"
                value={formData.tds_percentage}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-gray-500 placeholder-gray-500"
              />
            </div>
            <div className="relative">
              <label className='block mb-1 text-sm font-medium px-1 text-gray-700'>
                OT Charge per Hour
              </label>
              <input
                type="text"
                name="ot_charge"
                value={formData.ot_charge}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-gray-700 placeholder-gray-400 bg-white"
                placeholder="Will be calculated automatically if not provided"
              />
              {!isOTChargeManuallyEdited && (
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
              )}
              {!isOTChargeManuallyEdited && formData.ot_charge && formData.shift_start_time && formData.shift_end_time && formData.basic_salary && (
                <div className="mt-2 text-xs text-gray-600 bg-teal-50 p-2 rounded border border-teal-200">
                  <p className="font-semibold mb-1">📊 Current Calculation:</p>
                  {(() => {
                    const rawShiftHours = calculateShiftHours(formData.shift_start_time, formData.shift_end_time);
                    const effectiveShiftHours = Math.max(0, rawShiftHours - breakTime);
                    const basicSalaryNum = parseFloat(formData.basic_salary.replace(/,/g, ''));
                    return (
                      <div className="space-y-1">
                        <p>• Raw Shift Hours: {rawShiftHours.toFixed(2)} hours (End Time - Start Time)</p>
                        <p>• Break Time: {breakTime} hours (deducted)</p>
                        <p>• Effective Shift Hours: {effectiveShiftHours.toFixed(2)} hours (Raw - Break)</p>
                        <p>• OT Rate = ₹{basicSalaryNum.toLocaleString()} ÷ ({effectiveShiftHours.toFixed(2)} × {averageDaysPerMonth}) = ₹{formData.ot_charge}</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-2">Off Days</label>
              <div className="grid grid-cols-7 gap-2">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                  <div key={day} className="flex items-center">
                    <input
                      type="checkbox"
                      id={day}
                      name={`off_${day.toLowerCase()}`}
                      checked={formData[`off_${day.toLowerCase()}` as keyof EmployeeFormState] as boolean}
                      onChange={() => handleCheckboxChange(day)}
                      className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                    />
                    <label htmlFor={day} className="ml-2 text-sm text-gray-600">
                      {day}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-2">Employee Status</label>
              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  checked={formData.is_active !== undefined ? formData.is_active : true}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                />
                <label htmlFor="is_active" className="ml-2 text-sm text-gray-600">
                  Active Employee (checked = active, unchecked = inactive)
                </label>
              </div>
              {tenantWeeklyRulesEnabled && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="weekly_rules_enabled"
                    name="weekly_rules_enabled"
                    checked={formData.weekly_rules_enabled !== undefined ? formData.weekly_rules_enabled : true}
                    onChange={(e) => setFormData(prev => ({ ...prev, weekly_rules_enabled: e.target.checked }))}
                    className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                  />
                  <label htmlFor="weekly_rules_enabled" className="ml-2 text-sm text-gray-600">
                    Enable Weekly Rules (for penalty days calculation)
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer with Action Buttons */}
        <div className="flex justify-end gap-4 mt-8">
          <button
            onClick={() => navigate('/hr-management/directory')}
            className="px-5 py-2 border border-gray-200 text-gray-700 rounded-lg"
            disabled={isSubmitting}
          >
            Cancel
          </button>

          {activeTab === 'personal' ? (
            <button
              onClick={handleSubmit}
              className={`px-5 py-2 bg-teal-600 text-white rounded-lg transition-colors ${
                isSubmitting 
                  ? 'opacity-70 cursor-not-allowed' 
                  : 'hover:bg-teal-700'
              }`}
              disabled={isSubmitting}
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className={`px-5 py-2 bg-teal-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors ${
                isSubmitting 
                  ? 'opacity-70 cursor-not-allowed' 
                  : 'hover:bg-teal-700'
              }`}
              disabled={isSubmitting || !formData.date_of_joining || !formData.shift_start_time || !formData.shift_end_time || !formData.basic_salary}
              title={
                (!formData.date_of_joining || !formData.shift_start_time || !formData.shift_end_time || !formData.basic_salary)
                  ? 'Please fill in all required fields'
                  : ''
              }
            >
              {isSubmitting && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default HRAddEmployee; 