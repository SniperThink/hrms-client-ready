import React from 'react';

// Base skeleton component with animation
export const SkeletonBase: React.FC<{ className?: string; children?: React.ReactNode }> = ({ 
  className = '', 
  children 
}) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`}>
    {children}
  </div>
);

// KPI Card Skeleton
export const SkeletonKPICard: React.FC = () => (
  <div className="bg-white shadow rounded-lg p-4 text-center">
    <div className="mb-2">
      <SkeletonBase className="h-4 w-24 mx-auto" />
    </div>
    <div className="mb-1">
      <SkeletonBase className="h-8 w-16 mx-auto" />
    </div>
  </div>
);

// Table Row Skeleton
export const SkeletonTableRow: React.FC<{ columns: number }> = ({ columns }) => (
  <tr className="animate-pulse">
    {Array.from({ length: columns }).map((_, index) => (
      <td key={index} className="px-4 py-3">
        <div className="flex items-center space-x-2">
          <SkeletonBase className="h-4 w-20" />
        </div>
      </td>
    ))}
  </tr>
);

// Table Header Skeleton
export const SkeletonTableHeader: React.FC<{ columns: number }> = ({ columns }) => (
  <thead className="bg-gray-50 border-b border-gray-200">
    <tr>
      {Array.from({ length: columns }).map((_, index) => (
        <th key={index} className="text-left text-sm font-medium text-gray-600 px-4 py-3">
          <SkeletonBase className="h-4 w-16" />
        </th>
      ))}
    </tr>
  </thead>
);

// Complete Table Skeleton
export const SkeletonTable: React.FC<{ 
  columns: number; 
  rows: number; 
  showHeader?: boolean;
}> = ({ columns, rows, showHeader = true }) => (
  <div className="bg-white rounded-lg border border-gray-200">
    <div>
      <table className="w-full">
        {showHeader && <SkeletonTableHeader columns={columns} />}
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: rows }).map((_, index) => (
            <SkeletonTableRow key={index} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// Search Bar Skeleton
export const SkeletonSearchBar: React.FC = () => (
  <div className="relative">
    <SkeletonBase className="h-10 w-64 rounded-lg" />
  </div>
);

// Filter Dropdown Skeleton
export const SkeletonFilterDropdown: React.FC = () => (
  <SkeletonBase className="h-10 w-40 rounded-lg" />
);

// Stats Bar Skeleton
export const SkeletonStatsBar: React.FC = () => (
  <div className="p-4">
    <div className="flex items-center gap-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-2">
          <SkeletonBase className="h-4 w-20" />
          <SkeletonBase className="h-4 w-8" />
        </div>
      ))}
    </div>
  </div>
);

// Date Picker Skeleton
export const SkeletonDatePicker: React.FC = () => (
  <SkeletonBase className="h-10 w-36 rounded-lg" />
);

// Button Skeleton
export const SkeletonButton: React.FC<{ width?: string }> = ({ width = 'w-32' }) => (
  <SkeletonBase className={`h-10 ${width} rounded-lg`} />
);

// Attendance Log Row Skeleton (more complex)
export const SkeletonAttendanceLogRow: React.FC = () => (
  <tr className="animate-pulse hover:bg-gray-50">
    <td className="px-4 py-3">
      <SkeletonBase className="h-4 w-20" />
    </td>
    <td className="px-4 py-3">
      <SkeletonBase className="h-4 w-32" />
    </td>
    <td className="px-4 py-3">
      <SkeletonBase className="h-4 w-24" />
    </td>
    <td className="px-4 py-3">
      <div className="flex gap-2">
        <SkeletonBase className="h-8 w-16 rounded" />
        <SkeletonBase className="h-8 w-16 rounded" />
      </div>
    </td>
    <td className="px-4 py-3">
      <SkeletonBase className="h-8 w-28 rounded-lg" />
    </td>
    <td className="px-4 py-3">
      <SkeletonBase className="h-8 w-28 rounded-lg" />
    </td>
    <td className="px-4 py-3">
      <SkeletonBase className="h-4 w-12" />
    </td>
    <td className="px-4 py-3">
      <SkeletonBase className="h-4 w-12" />
    </td>
  </tr>
);

// Attendance Log Table Skeleton
export const SkeletonAttendanceLogTable: React.FC<{ rows?: number }> = ({ rows = 10 }) => (
  <div className="bg-white rounded-lg border border-gray-200">
    <div>
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {['Employee ID', 'Name', 'Department', 'Status', 'Clock In', 'Clock Out', 'OT Minutes', 'Late Minutes'].map((header) => (
              <th key={header} className="text-left text-sm font-medium text-gray-600 px-4 py-3">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: rows }).map((_, index) => (
            <SkeletonAttendanceLogRow key={index} />
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// Attendance Tracker Row Skeleton
export const SkeletonAttendanceTrackerRow: React.FC<{ isOneDay?: boolean }> = ({ isOneDay = false }) => (
  <tr className="animate-pulse hover:bg-gray-50">
    <td className="px-4 py-3">
      <SkeletonBase className="h-4 w-20" />
    </td>
    <td className="px-4 py-3">
      <SkeletonBase className="h-4 w-32" />
    </td>
    <td className="px-4 py-3">
      <SkeletonBase className="h-4 w-24" />
    </td>
    {isOneDay ? (
      <>
        <td className="px-4 py-3">
          <SkeletonBase className="h-6 w-16 rounded" />
        </td>
        <td className="px-4 py-3">
          <SkeletonBase className="h-4 w-12" />
        </td>
        <td className="px-4 py-3">
          <SkeletonBase className="h-4 w-12" />
        </td>
        <td className="px-4 py-3">
          <SkeletonBase className="h-4 w-12" />
        </td>
        <td className="px-4 py-3">
          <SkeletonBase className="h-4 w-12" />
        </td>
      </>
    ) : (
      <>
        <td className="px-4 py-3">
          <SkeletonBase className="h-4 w-12" />
        </td>
        <td className="px-4 py-3">
          <SkeletonBase className="h-4 w-12" />
        </td>
        <td className="px-4 py-3">
          <SkeletonBase className="h-4 w-12" />
        </td>
        <td className="px-4 py-3">
          <SkeletonBase className="h-4 w-12" />
        </td>
        <td className="px-4 py-3">
          <SkeletonBase className="h-4 w-12" />
        </td>
        <td className="px-4 py-3">
          <SkeletonBase className="h-6 w-16 rounded" />
        </td>
      </>
    )}
  </tr>
);

// Attendance Tracker Table Skeleton
export const SkeletonAttendanceTrackerTable: React.FC<{ 
  rows?: number; 
  isOneDay?: boolean;
}> = ({ rows = 10, isOneDay = false }) => (
  <div className="bg-white rounded-lg border border-gray-200">
    <div>
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Employee ID</th>
            <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Name</th>
            <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Department</th>
            {isOneDay ? (
              <>
                <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Status</th>
                <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Present Days</th>
                <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Absent Days</th>
                <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">OT Hours</th>
                <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Late Minutes</th>
              </>
            ) : (
              <>
                <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Total Working Days</th>
                <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Present Days</th>
                <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Absent Days</th>
                <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">OT Hours</th>
                <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Late Minutes</th>
                <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Attendance %</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: rows }).map((_, index) => (
            <SkeletonAttendanceTrackerRow key={index} isOneDay={isOneDay} />
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// Loading State with skeleton
export const LoadingState: React.FC<{ 
  message?: string; 
  showSpinner?: boolean;
}> = ({ 
  message = "Loading...", 
  showSpinner = true 
}) => (
  <div className="flex justify-center items-center py-8">
    <div className="flex items-center gap-3 text-gray-500">
      {showSpinner && (
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
      )}
      <span className="animate-pulse">{message}</span>
    </div>
  </div>
);

// Progressive Loading Indicator
export const ProgressiveLoadingIndicator: React.FC<{
  currentCount: number;
  totalCount?: number;
  isComplete: boolean;
}> = ({ currentCount, totalCount, isComplete }) => (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
        <span className="text-sm text-blue-700">
          {isComplete 
            ? `✅ Loaded ${currentCount} employees` 
            : `Loading data... ${currentCount}${totalCount ? ` / ${totalCount}` : ''}`
          }
        </span>
      </div>
      {!isComplete && (
        <div className="text-xs text-blue-600">
          Background loading in progress
        </div>
      )}
    </div>
  </div>
);

// Chart Skeleton Components
export const SkeletonBarChart: React.FC<{ height?: number }> = ({ height = 300 }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
    {/* Chart Header */}
    <div className="flex justify-between items-center mb-6">
      <SkeletonBase className="h-6 w-32" />
      <div className="flex items-center gap-3">
        <SkeletonBase className="h-8 w-24 rounded-lg" />
        <SkeletonBase className="h-4 w-20" />
      </div>
    </div>
    
    {/* Chart Area */}
    <div className="relative" style={{ height: `${height}px` }}>
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between py-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonBase key={index} className="h-3 w-6" />
        ))}
      </div>
      
      {/* Chart bars */}
      <div className="ml-8 mr-4 h-full flex items-end justify-between gap-2 px-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <SkeletonBase 
              className="w-full rounded-t" 
              style={{ height: `${Math.random() * 70 + 20}%` }}
            />
          </div>
        ))}
      </div>
      
      {/* X-axis labels */}
      <div className="absolute bottom-0 left-8 right-4 h-8 flex justify-between items-center px-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <SkeletonBase key={index} className="h-3 w-8" />
        ))}
      </div>
    </div>
  </div>
);

export const SkeletonLineChart: React.FC<{ height?: number }> = ({ height = 300 }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
    {/* Chart Header */}
    <div className="flex justify-between items-center mb-6">
      <SkeletonBase className="h-6 w-32" />
      <div className="flex items-center gap-3">
        <SkeletonBase className="h-8 w-24 rounded-lg" />
        <SkeletonBase className="h-4 w-20" />
      </div>
    </div>
    
    {/* Chart Area */}
    <div className="relative" style={{ height: `${height}px` }}>
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between py-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonBase key={index} className="h-3 w-6" />
        ))}
      </div>
      
      {/* Chart lines */}
      <div className="ml-8 mr-4 h-full relative px-4">
        {/* Grid lines */}
        {Array.from({ length: 5 }).map((_, index) => (
          <div 
            key={index} 
            className="absolute w-full border-t border-gray-100" 
            style={{ top: `${(index + 1) * 20}%` }}
          />
        ))}
        
        {/* Line path skeleton */}
        <svg className="absolute inset-0 w-full h-full">
          <path
            d="M 0,80 Q 50,60 100,70 T 200,50 T 300,40 T 400,30 T 500,20 T 600,10"
            stroke="#e5e7eb"
            strokeWidth="3"
            fill="none"
            className="animate-pulse"
          />
        </svg>
      </div>
      
      {/* X-axis labels */}
      <div className="absolute bottom-0 left-8 right-4 h-8 flex justify-between items-center px-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <SkeletonBase key={index} className="h-3 w-8" />
        ))}
      </div>
    </div>
  </div>
);

export const SkeletonPieChart: React.FC<{ height?: number }> = ({ height = 300 }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
    {/* Chart Header */}
    <div className="flex justify-between items-center mb-6">
      <SkeletonBase className="h-6 w-32" />
      <div className="flex items-center gap-3">
        <SkeletonBase className="h-8 w-24 rounded-lg" />
        <SkeletonBase className="h-4 w-20" />
      </div>
    </div>
    
    {/* Chart Area */}
    <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
      <div className="relative">
        {/* Pie chart skeleton */}
        <div className="w-48 h-48 rounded-full border-8 border-gray-200 animate-pulse"></div>
        
        {/* Legend */}
        <div className="absolute right-0 top-1/2 transform -translate-y-1/2 space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2">
              <SkeletonBase className="h-3 w-3 rounded-full" />
              <SkeletonBase className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const SkeletonAreaChart: React.FC<{ height?: number }> = ({ height = 300 }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
    {/* Chart Header */}
    <div className="flex justify-between items-center mb-6">
      <SkeletonBase className="h-6 w-32" />
      <div className="flex items-center gap-3">
        <SkeletonBase className="h-8 w-24 rounded-lg" />
        <SkeletonBase className="h-4 w-20" />
      </div>
    </div>
    
    {/* Chart Area */}
    <div className="relative" style={{ height: `${height}px` }}>
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between py-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonBase key={index} className="h-3 w-6" />
        ))}
      </div>
      
      {/* Chart area */}
      <div className="ml-8 mr-4 h-full relative px-4">
        {/* Grid lines */}
        {Array.from({ length: 5 }).map((_, index) => (
          <div 
            key={index} 
            className="absolute w-full border-t border-gray-100" 
            style={{ top: `${(index + 1) * 20}%` }}
          />
        ))}
        
        {/* Area path skeleton */}
        <svg className="absolute inset-0 w-full h-full">
          <path
            d="M 0,80 Q 50,60 100,70 T 200,50 T 300,40 T 400,30 T 500,20 T 600,10 L 600,100 L 0,100 Z"
            fill="#e5e7eb"
            className="animate-pulse"
          />
        </svg>
      </div>
      
      {/* X-axis labels */}
      <div className="absolute bottom-0 left-8 right-4 h-8 flex justify-between items-center px-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <SkeletonBase key={index} className="h-3 w-8" />
        ))}
      </div>
    </div>
  </div>
);

// Chart Grid Skeleton
export const SkeletonChartGrid: React.FC<{ 
  charts?: Array<'bar' | 'line' | 'pie' | 'area'>;
  columns?: number;
}> = ({ 
  charts = ['bar', 'line', 'pie', 'area'], 
  columns = 2 
}) => (
  <div className={`grid grid-cols-1 ${columns === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-6`}>
    {charts.map((chartType, index) => {
      switch (chartType) {
        case 'bar':
          return <SkeletonBarChart key={index} />;
        case 'line':
          return <SkeletonLineChart key={index} />;
        case 'pie':
          return <SkeletonPieChart key={index} />;
        case 'area':
          return <SkeletonAreaChart key={index} />;
        default:
          return <SkeletonBarChart key={index} />;
      }
    })}
  </div>
);
