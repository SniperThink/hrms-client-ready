import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isAfter, isBefore } from 'date-fns';
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
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedDate = value ? new Date(value) : null;
  const today = new Date();
  
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

  const isDateDisabled = (date: Date) => {
    if (maxDate && isAfter(date, maxDate)) return true;
    if (minDate && isBefore(date, minDate)) return true;
    return false;
  };

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
            >
              <ChevronLeft size={16} />
            </button>
            <h3 className="font-medium text-gray-900">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-gray-100 rounded"
              type="button"
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