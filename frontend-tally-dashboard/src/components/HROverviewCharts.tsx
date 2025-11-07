import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, PieChart, Pie, Legend, AreaChart, Area
} from 'recharts';
import { fetchSalaryData, SalaryData, TimePeriod, formatSalary, clearSalaryDataCache } from '../services/salaryService';
import {
  SkeletonChartGrid
} from './SkeletonComponents';
import NoDataMessage from './NoDataMessage';
import { logger } from '../utils/logger';

const COLORS = ['#1A6262', '#FF6700', '#334155', '#E1A940', '#8B5CF6', '#60A5FA'];

interface HROverviewChartsProps {
  timePeriod: TimePeriod | 'custom_range';
  selectedDepartment: string;
  onSalaryData?: (data: SalaryData) => void;
  customStartDate?: string;
  customEndDate?: string;
}

const generateUniqueKey = (item: { department?: string; name?: string; month?: string }, index: number, prefix: string = 'item'): string => {
  if (item.department) {
    return `${prefix}-${item.department.replace(/\s+/g, '-')}-${index}`;
  }
  if (item.name) {
    return `${prefix}-${item.name.replace(/\s+/g, '-')}-${index}`;
  }
  if (item.month) {
    return `${prefix}-${item.month.replace(/\s+/g, '-')}-${index}`;
  }
  return `${prefix}-${index}`;
};

const HROverviewCharts: React.FC<HROverviewChartsProps> = ({
  timePeriod,
  selectedDepartment,
  onSalaryData,
  customStartDate,
  customEndDate,
}) => {
  const [salaryData, setSalaryData] = useState<SalaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isFiltering, setIsFiltering] = useState<boolean>(false);

  // Helper function to transform backend data to frontend format
  const transformBackendData = (data: any): SalaryData => {
    return {
      ...data,
      // Transform top-level KPI fields from snake_case to camelCase
      totalEmployees: data.totalEmployees || data.total_employees || 0,
      avgAttendancePercentage: data.avgAttendancePercentage || data.avg_attendance_percentage || 0,
      totalWorkingDays: data.totalWorkingDays || data.total_working_days || 0,
      totalOTHours: data.totalOTHours || data.total_ot_hours || 0,
      totalLateMinutes: data.totalLateMinutes || data.total_late_minutes || 0,
      employeesChange: data.employeesChange || data.employees_change || 0,
      attendanceChange: data.attendanceChange || data.attendance_change || 0,
      lateMinutesChange: data.lateMinutesChange || data.late_minutes_change || 0,
      otHoursChange: data.otHoursChange || data.ot_hours_change || 0,
      
      departmentData: data.departmentData?.map((dept: any) => ({
        department: dept.department,
        averageSalary: dept.averageSalary || dept.avg_salary || 0,
        headcount: dept.headcount || dept.employee_count || 0,
        totalSalary: dept.totalSalary || dept.total_salary || 0,
        attendancePercentage: dept.attendancePercentage || 0,
        totalOTHours: dept.totalOTHours || dept.total_ot_hours || 0,
        totalLateMinutes: dept.totalLateMinutes || dept.total_late_minutes || 0,
      })),
      salaryTrends: data.salaryTrends?.map((trend: any) => ({
        month: trend.month,
        averageSalary: trend.averageSalary || trend.avgSalary || 0,
        totalSalary: trend.totalSalary || 0,
      })),
      otTrends: data.otTrends?.map((trend: any) => ({
        month: trend.month,
        averageOTHours: trend.averageOTHours || trend.avgOT || trend.totalOT || 0,
      })),
      departmentDistribution: data.departmentDistribution?.map((dept: any) => ({
        department: dept.department,
        count: dept.count || dept.employee_count || 0,
      })),
    };
  };

  // Use full trends data without year filtering
  const filteredOTTrends = salaryData?.otTrends || [];
  const filteredSalaryTrends = salaryData?.salaryTrends || [];

  useEffect(() => {
    const loadSalaryData = async () => {
      try {
        if (!salaryData) {
          setLoading(true);
        } else {
          setIsFiltering(true);
        }
        const data = await fetchSalaryData(
          timePeriod,
          selectedDepartment || 'All',
          customStartDate,
          customEndDate
        );
        const transformedData = transformBackendData(data);
        setSalaryData(transformedData);

        if (typeof onSalaryData === 'function') {
          try {
            onSalaryData(transformedData);
          } catch (e) { }
        }

        setError(null);
      } catch {
        setError('Failed to load salary data');
        setSalaryData(null);
      } finally {
        setLoading(false);
        setIsFiltering(false);
      }
    };
    loadSalaryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timePeriod, selectedDepartment, customStartDate, customEndDate]);

  useEffect(() => {
    const handleDataChange = (event: Event) => {
      // Skip filterChanged events - already handled by props change useEffect
      if (event.type === 'filterChanged') {
        return;
      }
      clearSalaryDataCache();
      const loadSalaryData = async () => {
        try {
          setLoading(true);
          setError(null);
          const data = await fetchSalaryData(
            timePeriod,
            selectedDepartment || 'All',
            customStartDate,
            customEndDate
          );
          const transformedData = transformBackendData(data);
          setSalaryData(transformedData);

          setError(null);
        } catch {
          setError('Failed to load salary data');
          setSalaryData(null);
        } finally {
          setLoading(false);
        }
      };
      loadSalaryData();
    };

    window.addEventListener('dataUploaded', handleDataChange);
    window.addEventListener('employeeAdded', handleDataChange);
    window.addEventListener('attendanceUpdated', handleDataChange);
    window.addEventListener('filterChanged', handleDataChange);
    window.addEventListener('salaryDataCacheCleared', handleDataChange);

    return () => {
      window.removeEventListener('dataUploaded', handleDataChange);
      window.removeEventListener('employeeAdded', handleDataChange);
      window.removeEventListener('attendanceUpdated', handleDataChange);
      window.removeEventListener('filterChanged', handleDataChange);
      window.removeEventListener('salaryDataCacheCleared', handleDataChange);
    };
  }, [timePeriod, selectedDepartment, customStartDate, customEndDate]);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonChartGrid
          charts={['line', 'line', 'bar', 'line']}
          columns={2}
        />
        <SkeletonChartGrid
          charts={['line', 'area']}
          columns={2}
        />
      </div>
    );
  }

  if (error || !salaryData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">
          {error || 'Failed to load HR data'}
        </div>
      </div>
    );
  }

  if ((salaryData && salaryData.departmentData && salaryData.departmentData.length === 0) || (salaryData && salaryData.departmentDistribution && salaryData.departmentDistribution.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 text-lg font-semibold">No data found for the selected filter.</div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color?: string; fill?: string }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-md rounded">
          <p className="font-semibold">{label}</p>
          {payload.map((entry: { name: string; value: number; color?: string; fill?: string }, index: number) => {
            // Format the value based on what type of data it is
            let formattedValue: string | number = entry.value;

            if (entry.name.includes('Salary')) {
              formattedValue = formatSalary(entry.value);
            } else if (entry.name.includes('Percentage')) {
              formattedValue = `${Number(entry.value).toFixed(1)}%`;
            } else if (entry.name.includes('Hours')) {
              formattedValue = `${Number(entry.value).toFixed(1)} hrs`;
            } else if (typeof entry.value === 'number') {
              formattedValue = Number(entry.value).toFixed(1);
            }

            return (
              <p key={`tooltip-${index}`} style={{ color: entry.color || entry.fill }}>
                {entry.name}: {formattedValue}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };


  // Ensure we have valid data to avoid errors
  const departmentData = salaryData.departmentData || [];
  const departmentDistribution = salaryData.departmentDistribution || [];
  const topSalariedEmployees = salaryData.topSalariedEmployees || [];


  // Check if we have any data to render
  const hasAnyData = departmentData.length > 0 ||
    departmentDistribution.length > 0 ||
    filteredOTTrends.length > 0 ||
    filteredSalaryTrends.length > 0 ||
    (salaryData.topAttendanceEmployees && salaryData.topAttendanceEmployees.length > 0) ||
    (salaryData.topSalariedEmployees && salaryData.topSalariedEmployees.length > 0) ||
    (salaryData.salaryDistribution && salaryData.salaryDistribution.length > 0);


  // More permissive check - only show "no data" if we truly have no data at all
  if (!hasAnyData && salaryData && Object.keys(salaryData).length > 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 text-lg font-semibold">No chart data available for the selected filters.</div>
      </div>
    );
  }

  // Use data directly from API - no fallbacks
  const topAttendanceEmployees = salaryData.topAttendanceEmployees || [];
  const lateMinuteTrends = salaryData.lateMinuteTrends || [];


  // Determine if a specific department filter is active (not 'All' and not empty)
  const isDepartmentFiltered = Boolean(selectedDepartment && selectedDepartment !== 'All');






  try {
    // Emergency fallback - if we somehow reach here without data
    if (!salaryData) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500">No data available for charts</div>
        </div>
      );
    }


    return (
      <div className="space-y-6">
        {/* Updating indicator - shown when filtering with existing data */}
        {isFiltering && (
          <div className="bg-blue-teal border border-teal-200 rounded-lg p-3 transition-all animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-blue-300 border-t-teal-600 rounded-full animate-spin"></div>
              <span className="text-sm text-teal-700 font-medium">Updating charts...</span>
            </div>
          </div>
        )}

        {/* Apply subtle opacity when filtering to indicate update in progress */}
        <div className={`space-y-6 transition-opacity duration-300 ${isFiltering ? 'opacity-60' : 'opacity-100'}`}>

          {/* First row of charts */}
          {!isDepartmentFiltered && (
            <div className="grid grid-cols-2 gap-6">
              {/* Department Distribution Line Chart */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h3 className="font-semibold mb-6">Department Distribution</h3>
                <div className="h-64">
                  {(() => {
                    try {
                      // Validate data before rendering
                      if (!departmentDistribution || departmentDistribution.length === 0) {
                        return <NoDataMessage message="No department distribution data available" />;
                      }

                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={departmentDistribution}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                              dataKey="department"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#666666', fontSize: 12 }}
                              textAnchor="end"
                              angle={-45}
                              height={80}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#666666', fontSize: 12 }}
                              tickFormatter={(value) => Math.round(value).toString()}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Line
                              type="monotone"
                              dataKey="count"
                              stroke="#1A6262"
                              strokeWidth={3}
                              dot={{ fill: '#1A6262', strokeWidth: 2, r: 4 }}
                              name="Employee Count"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      );
                    } catch (error) {
                      logger.error('🚨 Error rendering Department Distribution chart:', error);
                      return (
                        <div className="flex items-center justify-center h-full text-red-500">
                          Error rendering chart
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>

              {/* Department-wise Attendance Line Chart */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h3 className="font-semibold mb-6">Department-wise Attendance</h3>
                <div className="h-64">
                  {!departmentData || departmentData.length === 0 ? (
                    <NoDataMessage message="No attendance data available" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={departmentData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="department"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#666666', fontSize: 12 }}
                        textAnchor="end"
                        angle={-45}
                        height={80}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#666666', fontSize: 12 }}
                        tickFormatter={(value) => `${value}%`}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        formatter={(value) => [`${value}%`, "Attendance"]}
                        cursor={{ fill: "rgba(60, 122, 122, 0.1)" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="attendancePercentage"
                        stroke="#1A6262"
                        strokeWidth={3}
                        dot={{ fill: '#1A6262', strokeWidth: 2, r: 4 }}
                        name="Attendance %"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* Second row of charts */}
          {!isDepartmentFiltered && (
            <div className="grid grid-cols-2 gap-6">
              {/* OT Hours vs Department Line Chart */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h3 className="font-semibold mb-6">OT Hours by Department</h3>
                <div className="h-64">
                  {!departmentData || departmentData.length === 0 ? (
                    <NoDataMessage message="No OT hours data available" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={departmentData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="department"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#666666', fontSize: 12 }}
                        textAnchor="end"
                        angle={-45}
                        height={80}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#666666', fontSize: 12 }}
                        tickFormatter={(value) => `${value}h`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="totalOTHours"
                        stroke="#1A6262"
                        strokeWidth={3}
                        dot={{ fill: '#1A6262', strokeWidth: 2, r: 4 }}
                        name="OT Hours"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h3 className="font-semibold mb-6">Dept. Salary Comparison</h3>
                <div className="h-64">
                  {!departmentData || departmentData.length === 0 ? (
                    <NoDataMessage message="No salary comparison data available" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={departmentData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="department"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#666666', fontSize: 12 }}
                        textAnchor="end"
                        angle={-45}
                        height={80}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#666666', fontSize: 12 }}
                        tickFormatter={(value) => `₹${value.toLocaleString()}`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="averageSalary"
                        stroke="#1A6262"
                        strokeWidth={3}
                        dot={{ fill: '#1A6262', strokeWidth: 2, r: 4 }}
                        name="Average Salary"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Third row of charts */}
          <div className="grid grid-cols-2 gap-6">
            {/* Top Attendance Employees Bar Chart */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <h3 className="font-semibold mb-6">Top 5 Employees by Attendance</h3>
              <div className="w-full">
                {topAttendanceEmployees.length === 0 ? (
                  <div className="h-96">
                    <NoDataMessage message="No attendance data available" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={topAttendanceEmployees.slice(0, 5)}
                    layout="vertical"
                    barCategoryGap="20%"
                    barSize={20}
                    margin={{ top: 20, right: 30, left: 60, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />

                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#666666", fontSize: 12, dy: 0 }}
                      interval={0}
                      padding={{ bottom: 0 }}
                    />

                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#666666", fontSize: 12 }}
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />

                    <Tooltip content={<CustomTooltip />} />

                    <Bar dataKey="attendancePercentage" name="Attendance %" radius={[4, 4, 0, 0]}>
                      {topAttendanceEmployees.slice(0, 5).map((entry, index) => (
                        <Cell
                          key={generateUniqueKey(entry, index, "top-attendance")}
                          fill={index % 2 === 0 ? "#3C7A7A" : "#1A626299"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <h3 className="font-semibold mb-6">Top Salaried Employees</h3>
              <div className="w-full">
                {!topSalariedEmployees || topSalariedEmployees.length === 0 ? (
                  <div className="h-96">
                    <NoDataMessage message="No salary data available" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={topSalariedEmployees}
                    layout="vertical"
                    barCategoryGap="20%"
                    barSize={20}
                    margin={{ top: 20, right: 30, left: 60, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />

                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#666666", fontSize: 12, dy: 0 }}
                      interval={0}
                      padding={{ bottom: 0 }}
                    />

                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#666666", fontSize: 12 }}
                      domain={[0, (() => {
                        const maxSalary = Math.max(...topSalariedEmployees.map(d => d.salary), 1);
                        const buffer = maxSalary * 0.2;
                        const adjustedMax = maxSalary + buffer;
                        return Math.ceil(adjustedMax / 10000) * 10000; // Round up to nearest 10k
                      })()]}
                    />

                    <Tooltip content={<CustomTooltip />} />

                    <Bar dataKey="salary" name="Salary" radius={[4, 4, 0, 0]}>
                      {topSalariedEmployees.map((entry, index) => (
                        <Cell
                          key={generateUniqueKey(entry, index, "top-salary")}
                          fill={index % 2 === 0 ? "#3C7A7A" : "#1A626299"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>


          </div>

          {/* Fourth row of charts - OT and Salary Trends */}
          <div className="grid grid-cols-2 gap-6">
            {/* Average OT Trends Line Chart */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <h3 className="font-semibold mb-6">Avg. OT Trends</h3>
              <div className="h-64">
                {!filteredOTTrends || filteredOTTrends.length === 0 ? (
                  <NoDataMessage message="No OT trends data available" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredOTTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#666666' }}
                      textAnchor="end"
                      fontSize={12}
                      dy={20}
                      height={60}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#666666' }}
                      tickFormatter={(value) => `${Math.round(value)}h`}
                      fontSize={12}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="averageOTHours"
                      stroke="#1A6262"
                      strokeWidth={3}
                      dot={{ fill: '#1A6262', strokeWidth: 2, r: 4 }}
                      name="Avg OT Hours"
                    />
                  </LineChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Enhanced Salary Trends Area Chart */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <h3 className="font-semibold mb-6">Salary Trends</h3>
              <div className="h-64">
                {!filteredSalaryTrends || filteredSalaryTrends.length === 0 ? (
                  <NoDataMessage message="No salary trends data available" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredSalaryTrends}>
                    <defs>
                      <linearGradient id="colorSalary" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1A6262" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#1A6262" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#666666' }}
                      textAnchor="end"
                      fontSize={12}
                      dy={40}
                      padding={{ left: 30 }}
                      height={60}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#666666' }}
                      fontSize={12}
                      tickFormatter={(value) => formatSalary(value).replace('₹', '').replace(',', '')}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="averageSalary"
                      name="Average Salary"
                      stroke="#1A6262"
                      fillOpacity={1}
                      fill="url(#colorSalary)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Fifth row of charts - Distribution and Top Employees */}
          <div className="grid grid-cols-2 gap-6">
            {/* Salary Distribution Pie Chart */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <h3 className="font-semibold mb-6">Salary Distribution</h3>
              <div className="h-64">
                {!salaryData.salaryDistribution || salaryData.salaryDistribution.length === 0 ? (
                  <NoDataMessage message="No salary distribution data available" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie
                      data={salaryData.salaryDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      fill="#8884d8"
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="range"
                    >
                      {salaryData.salaryDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      formatter={(value) => (
                        <span style={{ color: '#666666' }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>
            {/* Average Late Minute Trends Line Chart */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <h3 className="font-semibold mb-6">Average Late Minute Trends</h3>
              {/* {lateMinuteTrends.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No late minute trends data available
              <br />
              <small className="text-xs">
                Debug: {JSON.stringify(salaryData.lateMinuteTrends)}
                <br />
                Total Late Minutes: {salaryData.totalLateMinutes}
                <br />
                Time Period: {timePeriod}
                <br />
                Department: {selectedDepartment}
              </small>
            </div>
          )} */}
              <div className="h-64">
                {!lateMinuteTrends || lateMinuteTrends.length === 0 ? (
                  <NoDataMessage message="No late minute trends data available" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lateMinuteTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#666666' }}
                      textAnchor="end"
                      fontSize={12}
                      dy={20}
                      height={60}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#666666' }}
                      tickFormatter={(value) => `${Math.round(value)}m`}
                      fontSize={12}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="averageLateMinutes"
                      stroke="#FF6700"
                      strokeWidth={3}
                      dot={{ fill: '#FF6700', strokeWidth: 2, r: 4 }}
                      name="Avg Late Minutes"
                    />
                  </LineChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>


          </div>

        </div> {/* End opacity wrapper */}
      </div>
    );
  } catch (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">
          Error rendering charts: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }
};

export default HROverviewCharts; 