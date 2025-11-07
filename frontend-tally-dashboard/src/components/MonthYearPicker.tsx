import React from 'react';
import Dropdown, { DropdownOption } from './Dropdown';

interface MonthYearPickerProps {
  value: string; // YYYY-MM format
  onChange: (value: string) => void;
  label?: string;
  minYear?: number;
  maxYear?: number;
}

const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  value,
  onChange,
  label = 'For Month',
  minYear = 2020,
  maxYear = new Date().getFullYear() + 5
}) => {
  // Parse current value
  const [year, month] = value.split('-').map(Number);

  // Generate month options
  const monthOptions: DropdownOption[] = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  // Generate year options (recent years first)
  const yearOptions: DropdownOption[] = [];
  for (let y = maxYear; y >= minYear; y--) {
    yearOptions.push({ value: y.toString(), label: y.toString() });
  }

  const handleMonthChange = (newMonth: string) => {
    const newValue = `${year}-${newMonth}`;
    onChange(newValue);
  };

  const handleYearChange = (newYear: string) => {
    const currentMonth = month.toString().padStart(2, '0');
    const newValue = `${newYear}-${currentMonth}`;
    onChange(newValue);
  };

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Dropdown
          options={monthOptions}
          value={month.toString().padStart(2, '0')}
          onChange={handleMonthChange}
          placeholder="Month"
        />
        <Dropdown
          options={yearOptions}
          value={year.toString()}
          onChange={handleYearChange}
          placeholder="Year"
        />
      </div>
    </div>
  );
};

export default MonthYearPicker;

