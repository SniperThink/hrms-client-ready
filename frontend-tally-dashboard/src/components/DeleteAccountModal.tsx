import React, { useState, useEffect, useCallback } from 'react';
import { X, AlertTriangle, Trash2, Clock, Shield, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiDelete } from '../services/api';
import { logger } from '../utils/logger';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  userEmail?: string;
  userRole?: string;
}

interface RecoveryInfo {
  can_recover: boolean;
  recovery_period_days: number;
  days_remaining: number;
  recovery_deadline: string;
  recovery_message: string;
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userEmail = '',
  userRole = ''
}) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'warning' | 'confirm' | 'processing' | 'success' | 'error'>('warning');
  const [confirmationText, setConfirmationText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recoveryInfo, setRecoveryInfo] = useState<RecoveryInfo | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [countdown, setCountdown] = useState(5);

  const isAdmin = userRole === 'admin';

  const handleAutoLogout = useCallback(() => {
    // Clear all local storage
    localStorage.clear();
    // Redirect to login page
    navigate('/login');
    // Call onSuccess callback if provided
    onSuccess?.();
  }, [navigate, onSuccess]);

  // Auto-logout countdown effect
  useEffect(() => {
    if (step === 'success' && !recoveryInfo) {
      // For permanent deletion, start countdown and auto-logout
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleAutoLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else if (step === 'success' && recoveryInfo) {
      // For soft-deleted accounts (recovery period), auto-logout after showing message
      const timer = setTimeout(() => {
        handleAutoLogout();
      }, 5000); // 5 seconds delay to show recovery info

      return () => clearTimeout(timer);
    }
  }, [step, recoveryInfo, handleAutoLogout]);

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    
    try {
      logger.info('Delete account request initiated');
      
      const response = await apiDelete('/api/user/delete-account/');
      
      if (response.ok) {
        const data = await response.json();
        logger.info('Delete account response:', data);
        
        // Check if recovery info is present (admin account - soft delete)
        if (data.recovery_info) {
          setRecoveryInfo(data.recovery_info);
          setSuccessMessage(data.message || 'Your account has been deactivated.');
          setStep('success');
        } else {
          // Regular account deletion (permanent)
          setSuccessMessage(data.message || 'Your account has been successfully deleted.');
          setStep('success');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete account');
        setStep('error');
      }
    } catch (err) {
      logger.error('Error deleting account:', err);
      setError('Network error. Please try again.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading && step !== 'processing') {
      // Reset state
      setStep('warning');
      setConfirmationText('');
      setError('');
      setRecoveryInfo(null);
      setSuccessMessage('');
      onClose();
    }
  };

  const handleFinalConfirm = () => {
    if (confirmationText.trim().toUpperCase() === 'DELETE') {
      setStep('processing');
      handleDelete();
    } else {
      setError('Please type "DELETE" exactly to confirm');
    }
  };

  const handleSuccessClose = () => {
    // Always logout and redirect to login
    handleAutoLogout();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              step === 'success' ? 'bg-green-100' : 
              step === 'error' ? 'bg-red-100' : 
              'bg-red-100'
            }`}>
              {step === 'success' ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : step === 'error' ? (
                <AlertCircle className="w-6 h-6 text-red-600" />
              ) : (
                <Trash2 className="w-6 h-6 text-red-600" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {step === 'success' ? 'Account Deactivated' : 
                 step === 'error' ? 'Error' :
                 step === 'confirm' ? 'Final Confirmation' :
                 'Delete Account'}
              </h2>
              <p className="text-sm text-gray-500">
                {step === 'success' ? 'Account status updated' :
                 step === 'error' ? 'Unable to complete request' :
                 step === 'confirm' ? 'Please confirm your decision' :
                 'Permanently delete your account'}
              </p>
            </div>
          </div>
          {step !== 'processing' && (
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Warning Step */}
        {step === 'warning' && (
          <div className="p-6 space-y-6">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900 mb-2">⚠️ Warning: This Action Cannot Be Undone</h3>
                  <p className="text-sm text-red-800 mb-3">
                    You are about to delete your account. This action will have the following consequences:
                  </p>
                  <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                    {isAdmin ? (
                      <>
                        <li>Your organization account will be deactivated</li>
                        <li>All users in your organization will be unable to access the system</li>
                        <li>All your data will be preserved for 30 days</li>
                        <li>You can recover your account by logging in within 30 days</li>
                        <li>After 30 days, the account will be permanently deleted</li>
                      </>
                    ) : (
                      <>
                        <li>All your personal data will be permanently removed</li>
                        <li>All your attendance, payroll, and other records will be deleted</li>
                        <li>This action cannot be reversed</li>
                        <li>You will be immediately logged out</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 mb-2">📋 Admin Account - Recovery Period Available</h3>
                    <p className="text-sm text-blue-800 mb-3">
                      Since you are an administrator, your account deletion will trigger a <strong>30-day recovery period</strong> for your entire organization.
                    </p>
                    <div className="space-y-2 text-sm text-blue-800">
                      <p><strong>✓ Recovery Period:</strong> 30 days from deletion</p>
                      <p><strong>✓ Recovery Method:</strong> Simply log in within 30 days to automatically recover</p>
                      <p><strong>✓ Data Preservation:</strong> All data will be preserved during the recovery period</p>
                      <p><strong>✗ After 30 Days:</strong> Account will be permanently deleted</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-2">What Happens Next?</h4>
                  <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                    {isAdmin ? (
                      <>
                        <li>Your organization account will be marked as inactive</li>
                        <li>All users in your organization will be logged out</li>
                        <li>You'll receive a confirmation message with recovery instructions</li>
                        <li>You can recover by logging in anytime within 30 days</li>
                      </>
                    ) : (
                      <>
                        <li>Your account will be permanently deleted</li>
                        <li>All your data will be removed from the system</li>
                        <li>You will be redirected to the login page</li>
                        <li>You will need to create a new account to use the system again</li>
                      </>
                    )}
                  </ol>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                className="flex-1 px-4 py-3 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors"
              >
                Continue to Confirmation
              </button>
            </div>
          </div>
        )}

        {/* Confirmation Step */}
        {step === 'confirm' && (
          <div className="p-6 space-y-6">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900 mb-2">Final Warning</h3>
                  <p className="text-sm text-red-800">
                    This is your last chance to cancel. Are you absolutely sure you want to proceed?
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <strong>"DELETE"</strong> to confirm:
              </label>
              <input
                type="text"
                value={confirmationText}
                onChange={(e) => {
                  setConfirmationText(e.target.value);
                  setError('');
                }}
                placeholder="Type DELETE to confirm"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${
                  error ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                autoFocus
              />
              {error && (
                <p className="mt-2 text-sm text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setStep('warning');
                  setConfirmationText('');
                  setError('');
                }}
                className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleFinalConfirm}
                disabled={confirmationText.trim().toUpperCase() !== 'DELETE'}
                className="flex-1 px-4 py-3 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Account
              </button>
            </div>
          </div>
        )}

        {/* Processing Step */}
        {step === 'processing' && (
          <div className="p-6 text-center">
            <div className="mx-auto w-16 h-16 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing...</h3>
            <p className="text-gray-600">Please wait while we process your request.</p>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <div className="p-6 space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {recoveryInfo ? 'Account Deactivated' : 'Account Deleted'}
              </h3>
              <p className="text-gray-600 mb-4">{successMessage}</p>
            </div>

            {/* Recovery Information */}
            {recoveryInfo && recoveryInfo.can_recover && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-900 mb-2">⏰ Recovery Period Active</h4>
                    <div className="space-y-2 text-sm text-blue-800">
                      <p><strong>Days Remaining:</strong> {recoveryInfo.days_remaining} day(s)</p>
                      <p><strong>Recovery Deadline:</strong> {new Date(recoveryInfo.recovery_deadline).toLocaleString()}</p>
                      <p className="mt-3 p-3 bg-blue-100 rounded-lg">
                        <strong>How to Recover:</strong> Simply log in with your credentials within {recoveryInfo.days_remaining} day(s) to automatically recover your account. Your account and all data will be restored immediately upon login.
                      </p>
                      <p className="text-xs text-blue-700 mt-2">
                        ⚠️ After {recoveryInfo.recovery_period_days} days, your account will be permanently deleted and cannot be recovered.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <div className="space-y-3">
              {!recoveryInfo && (
                <div className="text-center text-sm text-gray-600">
                  <p>Redirecting to login page in <strong>{countdown}</strong> second{countdown !== 1 ? 's' : ''}...</p>
                </div>
              )}
              {recoveryInfo && (
                <div className="text-center text-sm text-gray-600">
                  <p>You will be logged out automatically in a few seconds...</p>
                </div>
              )}
              <button
                type="button"
                onClick={handleSuccessClose}
                className="w-full px-4 py-3 bg-teal-600 text-white hover:bg-teal-700 rounded-lg font-medium transition-colors"
              >
                {recoveryInfo ? 'Logout Now' : `Go to Login ${!countdown ? 'Now' : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* Error Step */}
        {step === 'error' && (
          <div className="p-6 space-y-6">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900 mb-2">Error</h3>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-3 bg-gray-600 text-white hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('warning');
                  setError('');
                }}
                className="flex-1 px-4 py-3 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeleteAccountModal;

