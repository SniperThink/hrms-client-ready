import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { apiPost } from '../services/api';

interface InvitationDetails {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  tenant_name: string;
  invited_by: string;
}

const AcceptInvitation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [invitationDetails, setInvitationDetails] = useState<InvitationDetails | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const validateInvitation = useCallback(async () => {
    try {
      const response = await fetch('/api/invitations/validate/', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (response.ok) {
        const data = await response.json();
        setInvitationDetails(data);
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error || 'Invalid or expired invitation' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to validate invitation' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      validateInvitation();
    } else {
      setMessage({ type: 'error', text: 'Invalid invitation link' });
      setLoading(false);
    }
  }, [token, validateInvitation]);

  const handleAcceptInvitation = async () => {
    if (!password || !confirmPassword) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    if (password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long' });
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiPost('/api/invitations/accept/', {
        token,
        password,
        confirm_password: confirmPassword
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Account created successfully! Redirecting to login...' });
        
        // Store user data and redirect to login
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              message: 'Account created successfully! You can now login with your credentials.',
              email: invitationDetails?.email 
            } 
          });
        }, 2000);
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error || 'Failed to accept invitation' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to accept invitation';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-teal-600" />
          <p className="text-gray-600">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (!invitationDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Invalid Invitation</h2>
            <p className="text-gray-600 mb-6">{message.text}</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="text-center mb-8">
            <Shield className="w-16 h-16 text-teal-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900">Accept Invitation</h2>
            <p className="text-gray-600 mt-2">Set up your password to join {invitationDetails.tenant_name}</p>
          </div>

          {/* Invitation Details */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-medium text-gray-900 mb-2">Invitation Details</h3>
            <div className="space-y-1 text-sm text-gray-600">
              <p><span className="font-medium">Name:</span> {invitationDetails.first_name} {invitationDetails.last_name}</p>
              <p><span className="font-medium">Email:</span> {invitationDetails.email}</p>
              <p><span className="font-medium">Role:</span> {invitationDetails.role}</p>
              <p><span className="font-medium">Organization:</span> {invitationDetails.tenant_name}</p>
              <p><span className="font-medium">Invited by:</span> {invitationDetails.invited_by}</p>
            </div>
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

          {/* Password Form */}
          <div className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Enter your password"
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
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Confirm your password"
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
              onClick={handleAcceptInvitation}
              disabled={submitting || !password || !confirmPassword}
              className="w-full bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>

            <div className="text-center">
              <button
                onClick={() => navigate('/login')}
                className="text-teal-600 hover:text-teal-700 text-sm"
              >
                Already have an account? Login here
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcceptInvitation; 