import React from 'react';
import { X, CheckCircle, Sparkles, Clock } from 'lucide-react';

interface AccountRecoveryWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantName?: string;
  userName?: string;
}

const AccountRecoveryWelcomeModal: React.FC<AccountRecoveryWelcomeModalProps> = ({
  isOpen,
  onClose,
  tenantName = 'your organization',
  userName = 'there'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 p-6 text-white relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -ml-12 -mb-12"></div>
          
          <div className="relative z-10 flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white bg-opacity-20 rounded-full backdrop-blur-sm">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">Welcome Back!</h2>
                <p className="text-teal-100 text-sm">Your account has been successfully reactivated</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <div className="absolute -top-2 -right-2">
                <Sparkles className="w-6 h-6 text-teal-600 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Welcome Message */}
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold text-gray-900">
              Account Reactivated Successfully!
            </h3>
            <p className="text-gray-600">
              Hello <strong>{userName}</strong>, your account for <strong>{tenantName}</strong> has been successfully reactivated.
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 mb-1">What Happened?</h4>
                <p className="text-sm text-blue-800">
                  Your account was deactivated and has now been automatically recovered. All your data has been preserved and is ready to use.
                </p>
              </div>
            </div>
          </div>

          {/* Features List */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span>All your data has been preserved</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span>Your account is fully active and ready to use</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span>You can continue using all features immediately</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full bg-teal-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Continue to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountRecoveryWelcomeModal;

