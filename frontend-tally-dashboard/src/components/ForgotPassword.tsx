import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Key, Eye, EyeOff, CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { apiPost } from '../services/api';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1); // 1: email, 2: otp, 3: new password
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSendOTP = async () => {
    if (!email) {
      setMessage({ type: 'error', text: 'Please enter your email address' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }

    try {
      setLoading(true);
      const response = await apiPost('/api/password-reset/request/', { email });

      if (response.ok) {
        setMessage({ type: 'success', text: 'OTP sent to your email address' });
        setStep(2);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to send OTP' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send OTP';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode) {
      setMessage({ type: 'error', text: 'Please enter the OTP code' });
      return;
    }

    if (otpCode.length !== 6) {
      setMessage({ type: 'error', text: 'OTP code must be 6 digits' });
      return;
    }

    try {
      setLoading(true);
      const response = await apiPost('/api/password-reset/verify-otp/', {
        email,
        otp_code: otpCode
      });

      if (response.ok) {
        const data = await response.json();
        setResetToken(data.reset_token);
        setMessage({ type: 'success', text: 'OTP verified successfully' });
        setStep(3);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Invalid OTP code' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify OTP';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long' });
      return;
    }

    try {
      setLoading(true);
      const response = await apiPost('/api/password-reset/reset/', {
        reset_token: resetToken,
        email,
        new_password: newPassword,
        confirm_password: confirmPassword
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Password reset successfully! Redirecting to login...' });
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              message: 'Password reset successfully! You can now login with your new password.',
              email: email
            } 
          });
        }, 2000);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to reset password' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset password';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setMessage({ type: '', text: '' });
    } else {
      navigate('/login');
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Mail className="w-16 h-16 text-teal-600 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-gray-900">Forgot Password</h2>
              <p className="text-gray-600 mt-2">Enter your email address to receive an OTP code</p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Enter your email address"
              />
            </div>

            <button
              onClick={handleSendOTP}
              disabled={loading || !email}
              className="w-full bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending OTP...
                </>
              ) : (
                'Send OTP'
              )}
            </button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Key className="w-16 h-16 text-teal-600 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-gray-900">Enter OTP Code</h2>
              <p className="text-gray-600 mt-2">We've sent a 6-digit code to {email}</p>
            </div>

            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                OTP Code
              </label>
              <input
                id="otp"
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-center text-2xl tracking-widest"
                placeholder="000000"
              />
              <p className="text-xs text-gray-500 mt-1">Enter the 6-digit code sent to your email</p>
            </div>

            <button
              onClick={handleVerifyOTP}
              disabled={loading || otpCode.length !== 6}
              className="w-full bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify OTP'
              )}
            </button>

            <div className="text-center">
              <button
                onClick={handleSendOTP}
                disabled={loading}
                className="text-teal-600 hover:text-teal-700 text-sm"
              >
                Didn't receive the code? Resend OTP
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Key className="w-16 h-16 text-teal-600 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-gray-900">Set New Password</h2>
              <p className="text-gray-600 mt-2">Create a new secure password for your account</p>
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters long</p>
            </div>

            <div>
              <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirmNewPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              onClick={handleResetPassword}
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white p-8 rounded-lg shadow-md">
          {/* Back Button */}
          <div className="mb-6">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {step === 1 ? 'Back to Login' : 'Back'}
            </button>
          </div>

          {/* Status Message */}
          {message.text && (
            <div className={`p-4 rounded-lg flex items-center gap-2 mb-6 ${
              message.type === 'success' 
                ? 'bg-teal-50 text-teal-700 border border-teal-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              {message.text}
            </div>
          )}

          {/* Step Content */}
          {renderStepContent()}

          {/* Progress Indicator */}
          <div className="mt-8">
            <div className="flex items-center justify-center space-x-2">
              {[1, 2, 3].map((stepNumber) => (
                <div
                  key={stepNumber}
                  className={`w-3 h-3 rounded-full ${
                    stepNumber <= step ? 'bg-teal-600' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            <div className="text-center mt-2 text-sm text-gray-500">
              Step {step} of 3
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword; 