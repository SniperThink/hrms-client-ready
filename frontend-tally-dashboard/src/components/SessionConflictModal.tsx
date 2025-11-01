/**
 * Modal Component for Session Conflict Notifications
 * Shows when user is forcefully logged out due to another login
 */

import React, { useEffect } from 'react';
import { logger } from '../utils/logger';

export interface SessionConflictModalProps {
  show: boolean;
  message: string;
  onClose: () => void;
}

export const SessionConflictModal: React.FC<SessionConflictModalProps> = ({
  show,
  message,
  onClose,
}) => {
  logger.info( '🎨 SessionConflictModal render:', { show, message });

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (show) {
      logger.info( '🔒 Disabling body scroll');
      document.body.style.overflow = 'hidden';
    } else {
      logger.info( '🔓 Enabling body scroll');
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [show]);

  if (!show) {
    logger.info( '❌ Modal not shown (show=false)');
    return null;
  }

  logger.info( '✅ Rendering modal!');

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center animate-fadeIn">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl p-8 md:p-12 max-w-md w-11/12 md:w-full animate-slideUp">
        {/* Icon */}
        <div className="text-center mb-6">
          <div className="text-7xl mb-4">🚪</div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            You've Been Logged Out
          </h2>
        </div>

        {/* Message */}
        <p className="text-center text-gray-600 text-base md:text-lg leading-relaxed mb-8">
          {message}
        </p>

        {/* Security Notice */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Security Notice:</span> For your protection, only one active session is allowed at a time.
          </p>
        </div>

        {/* Button */}
        <button
          onClick={onClose}
          className="w-full bg-gradient-to-r from-teal-600 to-teal-600 hover:from-teal-700 hover:to-teal-700 text-white font-semibold py-3 md:py-4 px-6 rounded-lg transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
        >
          Go to Login
        </button>

        {/* Auto logout timer indicator */}
        <p className="text-center text-xs text-gray-500 mt-4">
          Redirecting to login in 5 seconds...
        </p>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

