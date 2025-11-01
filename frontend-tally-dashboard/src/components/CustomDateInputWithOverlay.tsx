import React, { useState, useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import CalendarPopup from './CalendarPopup';
import { format } from 'date-fns';

interface CustomDateInputWithOverlayProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
  maxDate?: Date;
  minDate?: Date;
  disabled?: boolean;
  readOnly?: boolean;
  name?: string;
  id?: string;
  required?: boolean;
}

const CustomDateInputWithOverlay: React.FC<CustomDateInputWithOverlayProps> = ({
  value,
  onChange,
  placeholder = 'Select date',
  className = '',
  maxDate,
  minDate,
  disabled = false,
  readOnly = false,
  name,
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return format(date, 'MMM dd, yyyy');
    } catch {
      return dateStr;
    }
  };

  const handleInputClick = () => {
    if (disabled || readOnly) return;
    
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setPopupPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
    setIsOpen(true);
  };

  const handleDateChange = (date: string) => {
    onChange(date);
    setIsOpen(false);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {!value && (
          <span 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-auto cursor-text"
            onClick={handleInputClick}
          >
            {placeholder}
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value ? formatDisplayDate(value) : ''}
          className={`${className} ${!value ? 'text-transparent' : 'text-gray-800'}`}
          onClick={handleInputClick}
          readOnly={true}
          disabled={disabled}
          name={name}
          id={id}
        />
        <Calendar 
          className="absolute right-3 top-1/2 -translate-y-1/2 text-black dark:text-white cursor-pointer pointer-events-auto"
          size={18}
          onClick={handleInputClick}
        />
      </div>
      
      {isOpen && (
        <CalendarPopup
          value={value}
          onChange={handleDateChange}
          onClose={handleClose}
          maxDate={maxDate}
          minDate={minDate}
          position={popupPosition || undefined}
        />
      )}
    </div>
  );
};

export default CustomDateInputWithOverlay;