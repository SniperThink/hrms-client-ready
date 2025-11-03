import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isAfter, isBefore, setMonth, setYear, getYear, getMonth } from 'date-fns';
import { logger } from '../utils/logger';

interface DatePickerProps {
  value: string; // Date string in YYYY-MM-DD format
  onChange: (date: string) => void;
  maxDate?: Date;
  minDate?: Date;
  className?: string;
  loading?: boolean;
  placeholder?: string;
  attendanceDates?: string[]; // Array of dates with attendance logged (YYYY-MM-DD format)
  alignRight?: boolean; // If true, aligns calendar right edge with button right edge
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  maxDate,
  minDate,
  className = '',
  loading = false,
  placeholder = 'Select date',
  attendanceDates = [],
  alignRight = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    return value ? new Date(value) : new Date();
  });
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowMonthPicker(false);
        setShowYearPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedDate = value ? new Date(value) : null;
  const today = new Date();
  
  // Update current month when value changes
  useEffect(() => {
    if (value) {
      const newDate = new Date(value);
      setCurrentMonth(newDate);
    }
  }, [value]);

  // Debug attendance dates when they change
  useEffect(() => {
    logger.info( '📅 DatePicker received attendanceDates:', attendanceDates);
    logger.info( '📅 Current month being displayed:', format(currentMonth, 'yyyy-MM'));
    
    // Test if we have any attendance dates at all
    if (attendanceDates.length > 0) {
      logger.info( '✅ We have attendance dates!', attendanceDates);
    } else {
      logger.info( '❌ No attendance dates received');
    }
  }, [attendanceDates, currentMonth]);
  
  
  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Add padding days for complete weeks
  const startDayOfWeek = monthStart.getDay();
  const paddingStart = Array.from({ length: startDayOfWeek }, (_, i) => {
    const date = new Date(monthStart);
    date.setDate(date.getDate() - (startDayOfWeek - i));
    return date;
  });
  
  const endDayOfWeek = monthEnd.getDay();
  const paddingEnd = Array.from({ length: 6 - endDayOfWeek }, (_, i) => {
    const date = new Date(monthEnd);
    date.setDate(date.getDate() + (i + 1));
    return date;
  });
  
  const allDays = [...paddingStart, ...calendarDays, ...paddingEnd];

  const handleDateSelect = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    onChange(dateString);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleMonthSelect = (monthIndex: number) => {
    setCurrentMonth(setMonth(currentMonth, monthIndex));
    setShowMonthPicker(false);
  };

  const handleYearSelect = (year: number) => {
    setCurrentMonth(setYear(currentMonth, year));
    setShowYearPicker(false);
  };

  const isDateDisabled = (date: Date) => {
    if (maxDate && isAfter(date, maxDate)) return true;
    if (minDate && isBefore(date, minDate)) return true;
    return false;
  };

  // Generate available years (default: 100 years back to 1 year forward for DOB support)
  const getAvailableYears = (): number[] => {
    const currentYear = getYear(new Date());
    // Default to 1950 minimum for DOB support, or 100 years back if that's earlier
    const defaultMinYear = 1950;
    const minYear = minDate ? getYear(minDate) : Math.max(defaultMinYear, currentYear - 100);
    const maxYear = maxDate ? getYear(maxDate) : currentYear + 1;
    const years: number[] = [];
    for (let year = maxYear; year >= minYear; year--) {
      years.push(year);
    }
    return years;
  };

  // Generate month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const availableYears = getAvailableYears();
  const currentYear = getYear(currentMonth);
  const currentMonthIndex = getMonth(currentMonth);

  const formatDisplayDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, 'MMM dd, yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0B5E59] focus:border-transparent min-w-[140px]"
        disabled={loading}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin text-gray-400" />
        ) : (
          <Calendar size={16} className="text-gray-400" />
        )}
        <span className="flex-1 text-left">
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <ChevronRight 
          size={16} 
          className={`text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} 
        />
      </button>

      {isOpen && (
          <div
            ref={dropdownRef}
            className={`absolute top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4 min-w-[280px] ${
              alignRight ? 'right-0' : 'left-0'
            }`}
          >
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-gray-100 rounded"
              type="button"
              disabled={showMonthPicker || showYearPicker}
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => {
                    setShowMonthPicker(!showMonthPicker);
                    setShowYearPicker(false);
                  }}
                  className="px-2 py-1 text-sm font-medium text-gray-900 hover:bg-gray-100 rounded"
                  type="button"
                >
                  {format(currentMonth, 'MMMM')}
                </button>
                {showMonthPicker && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-32 max-h-48 overflow-y-auto teal-scrollbar">
                    {monthNames.map((month, index) => {
                      const testDate = setMonth(currentMonth, index);
                      const isDisabled = 
                        (minDate && isBefore(testDate, startOfMonth(minDate))) ||
                        (maxDate && isAfter(testDate, endOfMonth(maxDate)));
                      return (
                        <button
                          key={index}
                          onClick={() => !isDisabled && handleMonthSelect(index)}
                          disabled={isDisabled}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                            currentMonthIndex === index ? 'bg-[#0B5E59] text-white' : ''
                          } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          type="button"
                        >
                          {month}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  onClick={() => {
                    setShowYearPicker(!showYearPicker);
                    setShowMonthPicker(false);
                  }}
                  className="px-2 py-1 text-sm font-medium text-gray-900 hover:bg-gray-100 rounded"
                  type="button"
                >
                  {format(currentMonth, 'yyyy')}
                </button>
                {showYearPicker && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-24 max-h-48 overflow-y-auto teal-scrollbar">
                    {availableYears.map((year) => (
                      <button
                        key={year}
                        onClick={() => handleYearSelect(year)}
                        className={`w-full text-center px-3 py-2 text-sm hover:bg-gray-100 ${
                          currentYear === year ? 'bg-[#0B5E59] text-white' : ''
                        }`}
                        type="button"
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-gray-100 rounded"
              type="button"
              disabled={showMonthPicker || showYearPicker}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <div key={day} className="text-xs font-medium text-gray-500 text-center py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {allDays.map((date, index) => {
              const isCurrentMonth = isSameMonth(date, currentMonth);
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              const isToday = isSameDay(date, today);
              const isDisabled = isDateDisabled(date);
              const dateString = format(date, 'yyyy-MM-dd');
              const hasAttendance = attendanceDates.includes(dateString);
              
              // Debug logging for dates with attendance
              if (hasAttendance) {
                logger.info( '🟢 Date with attendance:', dateString);
              }
              
              // Debug all dates being checked
              if (isCurrentMonth && attendanceDates.length > 0) {
                logger.info( `📅 Checking date ${dateString} for attendance:`, hasAttendance);
                logger.info( `📅 Available attendance dates:`, attendanceDates);
              }

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => !isDisabled && handleDateSelect(date)}
                  disabled={isDisabled}
                  className={`
                    p-2 text-sm rounded transition-colors relative min-h-[40px]
                    ${isCurrentMonth 
                      ? 'text-gray-900' 
                      : 'text-gray-300'
                    }
                    ${isSelected 
                      ? 'bg-[#0B5E59] text-white hover:bg-[#0A5048]' 
                      : isToday 
                        ? 'bg-teal-100 text-teal-600 hover:bg-teal-200'
                        : 'hover:bg-gray-100'
                    }
                    ${isDisabled 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'cursor-pointer'
                    }
                  `}
                >
                  <div className="relative flex flex-col items-center justify-center w-full h-full min-h-[40px]">
                    <span className="flex-1 flex items-center justify-center">{format(date, 'd')}</span>
                    {hasAttendance && (
                      <span 
                        className={`absolute bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 rounded-full z-10 ${
                          isSelected 
                            ? 'bg-white border-2 border-teal-900' 
                            : 'bg-teal-600 border border-white shadow-sm'
                        }`}
                        title="Attendance marked"
                      ></span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => handleDateSelect(today)}
              disabled={isDateDisabled(today)}
              className="text-sm text-[#0B5E59] hover:text-[#0A5048] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker; 