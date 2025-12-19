import React, { useState, useEffect } from 'react';
import { Users, Clock, AlertTriangle, TrendingUp, Upload, FileSpreadsheet } from 'lucide-react';
import { fetchSalaryData, SalaryData, TimePeriod } from '../services/salaryService';
import { useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';

interface HRStatsProps {
  timePeriod: TimePeriod | 'custom_range';
  selectedDepartment?: string;
  // Optional: salary data provided by the overview charts so cards can sync to selected month/period
  overviewSalaryData?: SalaryData | null;
  // Custom date range props
  customStartDate?: string;
  customEndDate?: string;
}

interface FilterItem {
  department?: string;
}

const HRStats: React.FC<HRStatsProps> = ({ timePeriod, selectedDepartment = 'All', overviewSalaryData = null, customStartDate, customEndDate }) => {
  const navigate = useNavigate();
  const [data, setData] = useState<SalaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  // If parent provides overviewSalaryData, use it as the primary source ONLY for 'All' department
  useEffect(() => {
    if (overviewSalaryData && (selectedDepartment === 'All' || !selectedDepartment)) {
      setData(overviewSalaryData);
      const hasActualData = overviewSalaryData.totalEmployees > 0 ||
        (overviewSalaryData.salaryTrends && overviewSalaryData.salaryTrends.length > 0) ||
        (overviewSalaryData.departmentData && overviewSalaryData.departmentData.length > 0);
      setHasData(hasActualData);
      setLoading(false);
    }
  }, [overviewSalaryData, selectedDepartment]);

  useEffect(() => {
    const loadData = async () => {
      // If overview provided data AND department is 'All', don't fetch - use parent's data as source of truth
      if (overviewSalaryData && (selectedDepartment === 'All' || !selectedDepartment)) return;
      try {
        setLoading(true);
        const salaryData = await fetchSalaryData(
          timePeriod, 
          selectedDepartment || 'All',
          customStartDate,
          customEndDate
        );
        setData(salaryData);

        // Check if there's actual data (employees, salary records, etc.)
        const hasActualData = salaryData.totalEmployees > 0 ||
          salaryData.salaryTrends.length > 0 ||
          salaryData.departmentData.length > 0;

        setHasData(hasActualData);
        
        // Notify parent that data has loaded (for custom range loading state)
        if (timePeriod === 'custom_range' && customStartDate && customEndDate) {
          window.dispatchEvent(new CustomEvent('customRangeDataLoaded'));
        }
      } catch (error) {
        logger.error('Error loading salary data:', error);
        setHasData(false);
        setData(null);
        
        // Notify parent even on error
        if (timePeriod === 'custom_range' && customStartDate && customEndDate) {
          window.dispatchEvent(new CustomEvent('customRangeDataLoaded'));
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [timePeriod, selectedDepartment, customStartDate, customEndDate, overviewSalaryData]);

  // Listen for filter changes and cache clearing
  useEffect(() => {
    const handleFilterChange = (event: Event) => {
      logger.info( '🔄 Filter change detected in HRStats, refreshing data');
      logger.info( '🔄 Event type:', event.type);
      logger.info( '🔄 Event detail:', (event as CustomEvent).detail);
      
      // Force refresh by clearing overview data and triggering re-fetch
      // Note: This will be handled by the parent component
    };

    const handleCacheCleared = (event: Event) => {
      logger.info( '🔄 Cache cleared detected in HRStats, refreshing data');
      logger.info( '🔄 Event type:', event.type);
      logger.info( '🔄 Event detail:', (event as CustomEvent).detail);
      
      // Force refresh by clearing overview data and triggering re-fetch
      // Note: This will be handled by the parent component
    };

    // Listen for custom events that indicate data changes
    window.addEventListener('filterChanged', handleFilterChange);
    window.addEventListener('salaryDataCacheCleared', handleCacheCleared);

    return () => {
      window.removeEventListener('filterChanged', handleFilterChange);
      window.removeEventListener('salaryDataCacheCleared', handleCacheCleared);
    };
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg p-6 shadow-sm animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
              <div className="w-16 h-4 bg-gray-200 rounded"></div>
            </div>
            <div className="w-20 h-8 bg-gray-200 rounded mb-2"></div>
            <div className="w-24 h-4 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  // No data state - Show welcome message with upload prompt
  if (!hasData) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <div className="max-w-md mx-auto">
          <FileSpreadsheet className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Welcome to Your HRMS Dashboard!
          </h3>
          <p className="text-gray-600 mb-6">
            Get started by uploading your salary data. Our system will automatically generate
            insights and KPIs from your data.
          </p>

          <div className="space-y-4">
            <button
              onClick={() => navigate('/hr-management/data-upload')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              <Upload className="w-5 h-5" />
              Upload Your First Data
            </button>

            <div className="border-t pt-4">
              <p className="text-sm text-gray-500 mb-3">What you'll get after uploading:</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Users className="w-4 h-4" />
                  Employee Analytics
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <TrendingUp className="w-4 h-4" />
                  Salary Insights
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  Attendance Reports
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <AlertTriangle className="w-4 h-4" />
                  Performance KPIs
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Filter data by department if needed
  let filteredData = data;
  if (selectedDepartment !== 'All' && data) {
    const departmentFilter = (item: FilterItem) =>
      selectedDepartment === 'N/A' ?
        (!item.department || item.department === 'N/A') :
        item.department === selectedDepartment;

    filteredData = {
      ...data,
      departmentData: data.departmentData.filter(departmentFilter),
      topSalariedEmployees: data.topSalariedEmployees.filter(departmentFilter)
    };
  }

  // Calculate percentage changes with proper validation
  const calculateChange = (changePercentage: number) => {
    // Ensure the change percentage is valid and not NaN
    if (
      changePercentage === null ||
      changePercentage === undefined ||
      isNaN(Number(changePercentage))
    ) {
      return 0;
    }
    const v = Number(changePercentage);
    // Heuristics:
    // - If absolute value <= 1, treat as fraction and convert to %
    // - If absolute value is very large (e.g., >100 and <= 10000), assume basis points and scale down
    // - Otherwise, assume it's already a percentage
    let pct = v;
    if (Math.abs(v) <= 1) {
      pct = v * 100;
    } else if (Math.abs(v) > 100 && Math.abs(v) <= 10000) {
      pct = v / 100;
    }
    // Clamp to [-100, 100] to avoid extreme swings
    if (pct > 100) pct = 100;
    if (pct < -100) pct = -100;
    // Round to 2 decimals
    return Math.round(pct * 100) / 100;
  };

  // Debug logging for percentage calculations
  logger.info( '🔍 HRStats Percentage Debug:', {
    timePeriod,
    selectedDepartment,
    employeesChange: filteredData?.employeesChange,
    attendanceChange: filteredData?.attendanceChange,
    lateMinutesChange: filteredData?.lateMinutesChange,
    otHoursChange: filteredData?.otHoursChange,
    normalized: {
      employees: calculateChange(filteredData?.employeesChange || 0),
      attendance: calculateChange(filteredData?.attendanceChange || 0),
      lateMinutes: calculateChange(filteredData?.lateMinutesChange || 0),
      otHours: calculateChange(filteredData?.otHoursChange || 0),
    },
    selectedPeriod: filteredData?.selectedPeriod
  });

  const stats = [
    {
      title: 'Total Employees',
      value: filteredData?.totalEmployees?.toString() || '0',
      change: calculateChange(filteredData?.employeesChange || 0),
    },
    {
      title: 'Avg Attendance',
      value: `${Math.round((filteredData?.avgAttendancePercentage || 0))}%`,
      change: calculateChange(filteredData?.attendanceChange || 0),
    },
    {
      title: 'Late Minutes',
      value: Math.round(filteredData?.totalLateMinutes || 0).toString(),
      change: calculateChange(filteredData?.lateMinutesChange || 0),
    },
    {
      title: 'OT Hours',
      value: Math.round(filteredData?.totalOTHours || 0).toString(),
      change: calculateChange(filteredData?.otHoursChange || 0),
    }
  ];

  // Generate dynamic period label based on timePeriod and custom dates
  // PRIORITY: Use backend's selectedPeriod.label if available (most accurate)
  const getPeriodLabel = () => {
    // For custom_range, always prefer backend's selectedPeriod.label as it's more accurate
    if (timePeriod === 'custom_range' && filteredData?.selectedPeriod?.label) {
      return filteredData.selectedPeriod.label;
    }
    
    // For other periods, prefer backend label if available
    if (filteredData?.selectedPeriod?.label) {
      return filteredData.selectedPeriod.label;
    }
    
    // Fallback to frontend-generated labels if backend label not available
    if (customStartDate && customEndDate) {
      const startDate = new Date(customStartDate);
      const endDate = new Date(customEndDate);
      return `${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    }
    
    const now = new Date();
    const currentMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    switch (timePeriod) {
      case 'this_month':
        return currentMonth;
      case 'last_6_months': {
        // Calculate 6 months ago
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(now.getMonth() - 6);
        const startMonth = sixMonthsAgo.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const endMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return `${startMonth} - ${endMonth}`;
      }
      case 'last_12_months': {
        // Calculate 12 months ago
        const twelveMonthsAgo = new Date(now);
        twelveMonthsAgo.setMonth(now.getMonth() - 12);
        const startMonth = twelveMonthsAgo.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const endMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return `${startMonth} - ${endMonth}`;
      }
      case 'last_5_years': {
        // Calculate 5 years ago
        const fiveYearsAgo = new Date(now);
        fiveYearsAgo.setFullYear(now.getFullYear() - 5);
        const startMonth = fiveYearsAgo.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const endMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return `${startMonth} - ${endMonth}`;
      }
      default:
        return 'Current Period';
    }
  };

  // Generate dynamic comparison period label
  const getComparisonLabel = () => {
    switch (timePeriod) {
      case 'this_month':
        return 'vs Last Month';
      case 'last_6_months':
        return 'vs Previous 6 Months';
      case 'last_12_months':
        return 'vs Previous 12 Months';
      case 'last_5_years':
        return 'vs Previous 5 Years';
      case 'custom_range':
        return 'vs Previous Period';
      default:
        return 'vs Previous Period';
    }
  };

  const periodLabel = getPeriodLabel();
  const comparisonLabel = getComparisonLabel();

  return (
    <div className="space-y-4">
      <div className="text-gray-600 text-sm font-medium">
        Data for: <span className="font-semibold text-gray-900">{periodLabel}</span>
        {selectedDepartment !== 'All' && (
          <span className="ml-2 text-gray-500">• {selectedDepartment} Department</span>
        )}
      </div>
      {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <span className={`text-sm font-medium ${
                stat.change > 0 ? 'text-teal-600' : stat.change < 0 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {stat.change > 0 ? '+' : ''}{stat.change.toFixed(1)}%
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
            <p className="text-gray-600 text-sm">{stat.title}</p>
          </div>
        ))}
      </div> */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm"
          >
            {/* Title */}
            <p className="text-gray-500 text-sm font-medium">{stat.title}</p>

            {/* Value */}
            <h3 className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</h3>

            {/* Status */}
            {/* <div className="flex items-center gap-1 mt-2">
              {stat.change > 0 && (
                <img src="/img/trendup.png" alt="" className='w-5 h-5' />
              )}
              {stat.change < 0 && (
                <img src="/img/trenddown.png" alt="" className='w-5 h-5' />
              )}
              {stat.title.includes("Pending") && (
                <img src="/img/caution.png" alt="" className='w-5 h-5' />
              )}

              <span
                className={`text-sm font-medium ${stat.change > 0
                    ? "text-teal-600"
                    : stat.change < 0
                      ? "text-red-600"
                      : stat.title.includes("Pending")
                        ? "text-yellow-600"
                        : "text-gray-500"
                  }`}
              >
                {stat.title.includes("Pending")
                  ? "Action Needed"
                  : stat.change === 0
                    ? `No change ${comparisonLabel.toLowerCase()}`
                    : `${stat.change > 0 ? "+" : ""}${stat.change.toFixed(2)}% ${comparisonLabel}`}
              </span>
            </div> */}
            <div className="flex items-center gap-1 mt-2">
              <span
                className={`text-sm font-medium ${
                  stat.change > 0
                    ? 'text-teal-600'
                    : stat.change < 0
                      ? 'text-red-600'
                      : 'text-gray-500'
                }`}
              >
                {stat.change === 0
                  ? `No change ${comparisonLabel.toLowerCase()}`
                  : `${stat.change > 0 ? '+' : ''}${stat.change.toFixed(2)}% ${comparisonLabel}`}
              </span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default HRStats;