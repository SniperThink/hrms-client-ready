import React, { useState, useEffect } from 'react';
import { Clock, RotateCcw, CheckCircle, X } from 'lucide-react';
import { apiCall } from '../services/api';
import { logger } from '../utils/logger';

interface BulkAction {
  action_id: string;
  action_type: string;
  employee_count: number;
  performed_at: string;
  performed_by: string | null;
  reverted: boolean;
  reverted_at: string | null;
  reverted_by: string | null;
  changes_summary: {
    fields_updated: string[];
    employee_count: number;
  };
}

interface RecentBulkActionsProps {
  isOpen: boolean;
  onClose: () => void;
  onActionReverted?: () => void;
}

const RecentBulkActions: React.FC<RecentBulkActionsProps> = ({ isOpen, onClose, onActionReverted }) => {
  const [actions, setActions] = useState<BulkAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchActions();
    }
  }, [isOpen]);

  const fetchActions = async () => {
    setLoading(true);
    try {
      const response = await apiCall('/api/employees/bulk-update-history/?limit=10');
      if (response.ok) {
        const data = await response.json();
        setActions(data.history || []);
      }
    } catch (error) {
      logger.error('Failed to fetch bulk actions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async (actionId: string) => {
    setReverting(actionId);
    try {
      const response = await apiCall('/api/employees/revert-bulk-update/', {
        method: 'POST',
        body: JSON.stringify({ action_id: actionId })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ ${data.message}`);
        fetchActions(); // Refresh the list
        if (onActionReverted) {
          onActionReverted(); // Refresh employee data
        }
      } else {
        const errorData = await response.json();
        alert(`❌ Failed to revert: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      logger.error('Failed to revert action:', error);
      alert('❌ Failed to revert action. Please try again.');
    } finally {
      setReverting(null);
      setShowConfirm(null);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  const formatFieldName = (field: string) => {
    return field
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-600" />
            Recent Bulk Actions
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : actions.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No recent bulk actions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {actions.map((action) => (
                <div
                  key={action.action_id}
                  className={`border rounded-lg p-4 ${
                    action.reverted ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Time */}
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <Clock className="w-4 h-4" />
                        {formatTimeAgo(action.performed_at)}
                      </div>

                      {/* Action Description */}
                      <p className="text-gray-900 font-medium mb-1">
                        Updated {action.employee_count} employee{action.employee_count !== 1 ? 's' : ''}
                      </p>

                      {/* Fields Updated */}
                      <p className="text-sm text-gray-600 mb-2">
                        Fields: {action.changes_summary.fields_updated.map(formatFieldName).join(', ')}
                      </p>

                      {/* Performed By */}
                      <p className="text-xs text-gray-500">
                        By: {action.performed_by || 'Unknown'}
                      </p>

                      {/* Reverted Info */}
                      {action.reverted && (
                        <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span>Reverted by {action.reverted_by || 'Unknown'}</span>
                        </div>
                      )}
                    </div>

                    {/* Undo Button */}
                    {!action.reverted && (
                      <div>
                        {showConfirm === action.action_id ? (
                          <div className="flex flex-col gap-2">
                            <p className="text-xs text-gray-600 mb-1">Confirm revert?</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRevert(action.action_id)}
                                disabled={reverting === action.action_id}
                                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                              >
                                {reverting === action.action_id ? (
                                  <>
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Reverting...
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="w-3 h-3" />
                                    Yes
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => setShowConfirm(null)}
                                className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                              >
                                No
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowConfirm(action.action_id)}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Undo
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecentBulkActions;
