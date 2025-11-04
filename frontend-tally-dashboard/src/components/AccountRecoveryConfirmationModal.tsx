import React from 'react';
import { X, AlertTriangle, Clock, CheckCircle, Shield } from 'lucide-react';

interface AccountRecoveryConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tenantName?: string;
  userName?: string;
  daysRemaining?: number;
  recoveryDeadline?: string;
  loading?: boolean;
}

const AccountRecoveryConfirmationModal: React.FC<AccountRecoveryConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  tenantName = 'your organization',
  userName = 'there',
  daysRemaining = 30,
  recoveryDeadline,
  loading = false
}) => {
  if (!isOpen) return null;

  const formatDeadline = (deadline?: string) => {
    if (!deadline) return '';
    try {
      return new Date(deadline).toLocaleString();
    } catch {
      return deadline;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-orange-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Account Deactivated</h2>
              <p className="text-sm text-gray-600">Recovery confirmation required</p>
            </div>
          </div>
          {!loading && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-orange-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Warning Message */}
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 mb-2">Account Recovery Required</h3>
                <p className="text-sm text-orange-800">
                  Hello <strong>{userName}</strong>, your account for <strong>{tenantName}</strong> has been deactivated.
                </p>
              </div>
            </div>
          </div>

          {/* Recovery Information */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 mb-2">⏰ Recovery Period Active</h4>
                <div className="space-y-2 text-sm text-blue-800">
                  <p><strong>Days Remaining:</strong> {daysRemaining} day(s)</p>
                  {recoveryDeadline && (
                    <p><strong>Recovery Deadline:</strong> {formatDeadline(recoveryDeadline)}</p>
                  )}
                  <p className="mt-2">
                    You can recover your account now by confirming below. All your data has been preserved.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* What Happens */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-2">What Happens When You Confirm?</h4>
                <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                  <li>Your organization account will be reactivated</li>
                  <li>All users in your organization will be able to access the system</li>
                  <li>All your data will be restored and accessible</li>
                  <li>You will be logged in immediately</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>Important:</strong> After {daysRemaining} day(s), your account will be permanently deleted and cannot be recovered. If you want to reactivate your account, please confirm now.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Reactivating...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Yes, Reactivate My Account
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountRecoveryConfirmationModal;

