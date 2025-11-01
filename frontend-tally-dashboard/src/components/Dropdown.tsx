import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  onRemoveOption?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  searchable?: boolean;
  onSearch?: (query: string) => void;
  loading?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
  allowCustom?: boolean;
  onCustomAdd?: (value: string) => void;
  customPlaceholder?: string;
}

const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  className = "",
  searchable = false,
  onSearch,
  loading = false,
  error,
  label,
  required = false,
  allowCustom = false,
  onCustomAdd,
  customPlaceholder = "Enter custom value",
  onRemoveOption
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customValue, setCustomValue] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
        setCustomValue("");
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (onSearch) {
      onSearch(query);
    }
  };

  // Filter options based on search
  const filteredOptions = searchable 
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  // Get selected option label
  const selectedOption = options.find(option => option.value === value);
  const displayValue = selectedOption ? selectedOption.label : placeholder;

  const handleOptionSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery("");
    setCustomValue("");
  };

  const handleCustomAdd = () => {
    if (customValue.trim() && onCustomAdd) {
      onCustomAdd(customValue.trim());
      onChange(customValue.trim());
      setIsOpen(false);
      setCustomValue("");
      setSearchQuery("");
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div
        className={`
          w-full p-3 border rounded-lg cursor-pointer text-sm
          flex items-center justify-between
          transition-colors duration-200
          ${error 
            ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500' 
            : 'border-gray-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
          }
          ${disabled 
            ? 'bg-gray-50 text-gray-400 cursor-not-allowed' 
            : 'bg-white text-gray-700 hover:border-gray-300'
          }
          ${isOpen ? 'border-teal-500 ring-1 ring-teal-500' : ''}
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {displayValue}
        </span>
        <ChevronDown 
          size={16} 
          className={`text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
          {searchable && (
            <div className="p-2 border-b border-gray-200">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <div className="max-h-48 overflow-y-auto hide-scrollbar">
            {loading ? (
              <div className="px-4 py-3 flex items-center justify-center gap-2 text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-500"></div>
                Loading...
              </div>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={`
                    px-4 py-3 text-sm transition-colors duration-150 flex items-center justify-between
                    ${option.disabled 
                      ? 'text-gray-400 cursor-not-allowed' 
                      : 'text-gray-700 hover:bg-teal-50 cursor-pointer'
                    }
                    ${option.value === value ? 'bg-teal-100 text-teal-900' : ''}
                  `}
                  onClick={() => !option.disabled && handleOptionSelect(option.value)}
                >
                  <span className="truncate pr-2">{option.label}</span>
                  {onRemoveOption && !option.disabled && (
                    <button
                      type="button"
                      className="ml-2 text-gray-400 hover:text-red-600"
                      title="Remove from options"
                      onClick={(e) => {
                        e.stopPropagation();
                        const confirmed = window.confirm('This will remove the name from the dropdown. Continue?');
                        if (confirmed) {
                          onRemoveOption(option.value);
                        }
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-gray-500 text-center text-sm">
                {searchable && searchQuery ? 'No options found' : 'No options available'}
              </div>
            )}

            {allowCustom && (
              <>
                <div className="border-t border-gray-200"></div>
                <div className="p-3">
                  <div className="text-xs text-gray-500 font-medium mb-2">Add Custom</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      placeholder={customPlaceholder}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                      onClick={(e) => e.stopPropagation()}
                      onKeyPress={(e) => e.key === 'Enter' && handleCustomAdd()}
                    />
                    <button
                      type="button"
                      onClick={handleCustomAdd}
                      disabled={!customValue.trim()}
                      className="px-3 py-2 bg-teal-500 text-white text-sm rounded-md hover:bg-teal-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dropdown;