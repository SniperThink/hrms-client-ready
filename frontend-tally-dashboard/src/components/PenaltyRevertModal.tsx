import React, { useState } from 'react';
import { AlertCircle, X, Loader2 } from 'lucide-react';
import { apiCall } from '../services/api';
import { logger } from '../utils/logger';

interface PenaltyRevertModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  date: string;
  weeklyAbsentThreshold: number | null;
  weeklyAttendance: { [day: string]: boolean };
  initialPenaltyIgnored?: boolean;
  onSuccess?: (newIgnored?: boolean) => void;
}

const PenaltyRevertModal: React.FC<PenaltyRevertModalProps> = ({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  date,
  weeklyAbsentThreshold,
  weeklyAttendance,
  initialPenaltyIgnored,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate week boundaries
  const selectedDate = new Date(date);
  const dayOfWeek = selectedDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const weekStart = new Date(selectedDate);
  weekStart.setDate(selectedDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Monday
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Sunday

  // Count absences in the week
  const dayMap = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];
  const absentCount = Object.entries(weeklyAttendance)
    .filter(([day, status]) => status === false)
    .length;

  const threshold = weeklyAbsentThreshold || 4;
  const isThresholdBreached = absentCount >= threshold;

  // Format dates
  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatDay = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' });

  const handleRevertPenalty = async () => {
    try {
      setLoading(true);
      setError(null);

      logger.info(`🔄 Reverting penalty for ${employeeId} on ${date}`);

      const response = await apiCall('/api/attendance-actions/revert-penalty/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: employeeId,
          date: date
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revert penalty');
      }

      const result = await response.json();
      logger.info('✅ Penalty toggle result:', result);

      const newIgnored = result?.data?.penalty_ignored;

      // Show success message
      if (newIgnored) {
        alert(`✅ Penalty Reverted Successfully!\n\nEmployee: ${employeeName}\nDate: ${date}\nThis day's ABSENT will not count toward weekly penalty.`);
      } else {
        alert(`↺ Penalty Revert Undone\n\nEmployee: ${employeeName}\nDate: ${date}\nThis day's ABSENT will now count toward weekly penalty.`);
      }

      onClose();
      onSuccess?.(newIgnored);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to revert penalty';
      logger.error('❌ Error reverting penalty:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Penalty Day Information</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Employee Info */}
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Employee:</span> {employeeName} ({employeeId})
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Date:</span> {formatDate(selectedDate)} ({formatDay(selectedDate)})
            </p>
          </div>

          {/* Week Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900 mb-3">Week Summary ({formatDate(weekStart)} - {formatDate(weekEnd)}):</p>
            <div className="grid grid-cols-7 gap-2">
              {dayMap.map((dayCode) => {
                const status = weeklyAttendance[dayCode];
                const isAbsent = status === false;
                const isPresent = status === true;

                return (
                  <div key={dayCode} className="text-center">
                    <div className="text-xs font-medium text-gray-600 mb-1">{dayCode}</div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      isPresent
                        ? 'bg-green-100 text-green-800'
                        : isAbsent
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {isPresent ? '✓' : isAbsent ? '✗' : '-'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Penalty Status */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="space-y-1">
                <p className="text-sm font-medium text-yellow-900">Penalty Status</p>
                <p className="text-sm text-yellow-800">
                  Absent Count: <span className="font-semibold">{absentCount}</span> (Threshold: {threshold})
                </p>
                <p className="text-sm text-yellow-800">
                  Penalty Applied: <span className="font-semibold">{isThresholdBreached ? 'YES (1 day)' : 'NO'}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Info Message */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-sm text-gray-700">
              Clicking "Revert Penalty" will remove the penalty day without changing the attendance status. The penalty will be recalculated based on the current week's absences.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleRevertPenalty}
            disabled={loading}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 ${
              'bg-teal-600 hover:bg-teal-700 disabled:opacity-50'
            }`}
            title={initialPenaltyIgnored ? 'Undo Revert (count day toward weekly penalty again)' : 'Revert Penalty (ignore this day for weekly penalty)'}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                {initialPenaltyIgnored ? '↺ Undo Revert' : '✓ Revert Penalty'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PenaltyRevertModal;
