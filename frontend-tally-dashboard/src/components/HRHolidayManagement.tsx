import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Trash2, Edit, CheckCircle, AlertCircle, X } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '../services/api';
import { format, parseISO, isPast } from 'date-fns';
import CustomDateInputWithOverlay from './CustomDateInputWithOverlay';
import Dropdown, { DropdownOption } from './Dropdown';

interface Holiday {
  id: number;
  name: string;
  date: string;
  holiday_type: 'NATIONAL' | 'REGIONAL' | 'COMPANY' | 'FESTIVAL' | 'EXAM' | 'OTHER';
  description?: string;
  is_active: boolean;
  applies_to_all: boolean;
  specific_departments?: string;
  is_past: boolean;
  created_at: string;
  updated_at: string;
}

interface HolidayFormData {
  name: string;
  date: string;
  holiday_type: Holiday['holiday_type'];
  description?: string;
  applies_to_all: boolean;
  specific_departments?: string;
}

const HRHolidayManagement: React.FC = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<HolidayFormData>({
    name: '',
    date: '',
    holiday_type: 'COMPANY',
    description: '',
    applies_to_all: true, // Always true by default
    specific_departments: '',
  });

  // Holiday type options for dropdown
  const holidayTypeOptions: DropdownOption[] = [
    { value: 'NATIONAL', label: 'National Holiday' },
    { value: 'REGIONAL', label: 'Regional Holiday' },
    { value: 'COMPANY', label: 'Company Holiday' },
    { value: 'FESTIVAL', label: 'Festival' },
    { value: 'EXAM', label: 'Examination' },
    { value: 'OTHER', label: 'Other' },
  ];

  useEffect(() => {
    loadHolidays();
  }, []);

  const loadHolidays = async () => {
    setLoading(true);
    try {
      const response = await apiGet('/api/holidays/');
      if (!response.ok) {
        throw new Error('Failed to load holidays');
      }
      const data = await response.json();
      // Handle paginated response
      const holidaysData = data.results || data;
      setHolidays(Array.isArray(holidaysData) ? holidaysData : []);
    } catch (err: any) {
      console.error('Failed to load holidays:', err);
      setError('Failed to load holidays: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (editingId) {
        const response = await apiPut(`/api/holidays/${editingId}/`, formData);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to update holiday');
        }
        setSuccess('Holiday updated successfully!');
      } else {
        const response = await apiPost('/api/holidays/', formData);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to create holiday');
        }
        setSuccess('Holiday added successfully!');
      }
      
      // Dispatch event to invalidate holiday cache
      window.dispatchEvent(new CustomEvent('holidayUpdated', { detail: { timestamp: Date.now() } }));
      
      resetForm();
      loadHolidays();
    } catch (err: any) {
      setError(err.message || 'Failed to save holiday. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (holiday: Holiday) => {
    setFormData({
      name: holiday.name,
      date: holiday.date,
      holiday_type: holiday.holiday_type,
      description: holiday.description || '',
      applies_to_all: holiday.applies_to_all,
      specific_departments: holiday.specific_departments || '',
    });
    setEditingId(holiday.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this holiday?')) {
      return;
    }

    try {
      const response = await apiDelete(`/api/holidays/${id}/`);
      if (!response.ok) {
        throw new Error('Failed to delete holiday');
      }
      setSuccess('Holiday deleted successfully!');
      
      // Dispatch event to invalidate holiday cache
      window.dispatchEvent(new CustomEvent('holidayUpdated', { detail: { timestamp: Date.now() } }));
      
      loadHolidays();
    } catch (err) {
      setError('Failed to delete holiday.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      date: '',
      holiday_type: 'COMPANY',
      description: '',
      applies_to_all: true,
      specific_departments: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const getHolidayTypeBadge = (type: string) => {
    const badgeStyles: Record<string, string> = {
      NATIONAL: 'bg-red-100 text-red-800',
      REGIONAL: 'bg-orange-100 text-orange-800',
      COMPANY: 'bg-blue-100 text-blue-800',
      FESTIVAL: 'bg-purple-100 text-purple-800',
      EXAM: 'bg-yellow-100 text-yellow-800',
      OTHER: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badgeStyles[type] || 'bg-gray-100 text-gray-800'}`}>
        {type.replace('_', ' ')}
      </span>
    );
  };

  // Separate upcoming and past holidays
  const upcomingHolidays = holidays.filter(h => {
    try {
      return !isPast(parseISO(h.date)) && h.is_active;
    } catch {
      return false;
    }
  });
  
  const pastHolidays = holidays.filter(h => {
    try {
      return isPast(parseISO(h.date)) || !h.is_active;
    } catch {
      return false;
    }
  });

  if (loading && holidays.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading holidays...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Holiday Management</h2>
          <p className="text-gray-600 mt-1">Manage organization holidays and breaks</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold shadow-lg hover:shadow-xl transition-all"
        >
          <Plus size={20} />
          {showForm ? 'Cancel' : 'Add Holiday'}
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
          <CheckCircle className="text-green-600 mr-3 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-sm text-green-600">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="text-green-600">
            <X size={20} />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="text-red-600 mr-3 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600">
            <X size={20} />
          </button>
        </div>
      )}

      {/* Add/Edit Holiday Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Holiday' : 'Add New Holiday'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Holiday Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="e.g., Independence Day"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <CustomDateInputWithOverlay
                  value={formData.date}
                  onChange={(date) => setFormData(prev => ({ ...prev, date }))}
                  placeholder="Select holiday date"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required={true}
                />
              </div>

              <div>
                <Dropdown
                  options={holidayTypeOptions}
                  value={formData.holiday_type}
                  onChange={(value) => setFormData(prev => ({ ...prev, holiday_type: value as HolidayFormData['holiday_type'] }))}
                  placeholder="Select holiday type"
                  label="Holiday Type"
                  required={true}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Additional details about the holiday..."
              />
            </div>

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Saving...' : editingId ? 'Update Holiday' : 'Add Holiday'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upcoming Holidays */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-600" />
            Upcoming Holidays ({upcomingHolidays.length})
          </h3>
        </div>
        <div className="divide-y divide-gray-200">
          {upcomingHolidays.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No upcoming holidays scheduled
            </div>
          ) : (
            upcomingHolidays.map((holiday) => (
              <div key={holiday.id} className="px-6 py-4 hover:bg-gray-50 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-medium text-gray-900">{holiday.name}</h4>
                      {getHolidayTypeBadge(holiday.holiday_type)}
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      <Calendar className="inline mr-1" size={14} />
                      {format(parseISO(holiday.date), 'EEEE, MMMM dd, yyyy')}
                    </p>
                    {holiday.description && (
                      <p className="text-sm text-gray-500 mt-2">{holiday.description}</p>
                    )}
                    {!holiday.applies_to_all && holiday.specific_departments && (
                      <p className="text-xs text-blue-600 mt-1">
                        Applies to: {holiday.specific_departments}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(holiday)}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                      title="Edit holiday"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(holiday.id)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-all"
                      title="Delete holiday"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Past Holidays */}
      {pastHolidays.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-500">
              Past Holidays ({pastHolidays.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {pastHolidays.slice(0, 5).map((holiday) => (
              <div key={holiday.id} className="px-6 py-3 opacity-60">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-700">{holiday.name}</p>
                    <p className="text-sm text-gray-500">
                      {format(parseISO(holiday.date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  {getHolidayTypeBadge(holiday.holiday_type)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HRHolidayManagement;


