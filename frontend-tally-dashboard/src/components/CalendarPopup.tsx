import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isAfter, isBefore } from 'date-fns';

interface CalendarPopupProps {
  value: string; // Date string in YYYY-MM-DD format
  onChange: (date: string) => void;
  onClose: () => void;
  maxDate?: Date;
  minDate?: Date;
  loading?: boolean;
  position?: { top: number; left: number; width: number };
}

const CalendarPopup: React.FC<CalendarPopupProps> = ({
  value,
  onChange,
  onClose,
  maxDate,
  minDate,
  loading = false,
  position
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    return value ? new Date(value) : new Date();
  });
  
  const popupRef = useRef<HTMLDivElement>(null);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const selectedDate = value ? new Date(value) : null;
  const today = new Date();
  
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
    onClose();
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

  const popupStyle = position ? {
    position: 'fixed' as const,
    top: position.top,
    left: position.left,
    zIndex: 9999
  } : {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    zIndex: 50
  };

  return (
    <div
      ref={popupRef}
      className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[280px]"
      style={popupStyle}
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

          return (
            <button
              key={index}
              type="button"
              onClick={() => !isDisabled && handleDateSelect(date)}
              disabled={isDisabled}
              className={`
                p-2 text-sm rounded transition-colors
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
              {format(date, 'd')}
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
          onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default CalendarPopup;