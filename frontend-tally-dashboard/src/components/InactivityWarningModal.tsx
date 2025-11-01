import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

interface InactivityWarningModalProps {
  isOpen: boolean;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

const InactivityWarningModal: React.FC<InactivityWarningModalProps> = ({
  isOpen,
  onStayLoggedIn,
  onLogout
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-amber-100 p-2 rounded-full">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Session Timeout Warning</h3>
        </div>
        
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-gray-500" />
            <p className="text-gray-700">
              You will be automatically logged out in 30 seconds due to inactivity.
            </p>
          </div>
          <p className="text-sm text-gray-600">
            Click "Stay Logged In" to continue your session or "Logout" to logout now.
          </p>
        </div>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={onLogout}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Logout
          </button>
          <button
            onClick={onStayLoggedIn}
            className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
};

export default InactivityWarningModal; 