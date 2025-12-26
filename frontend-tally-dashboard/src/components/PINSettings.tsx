import React, { useState, useEffect, useRef } from 'react';
import { Lock, Shield, AlertCircle, CheckCircle, Eye, EyeOff, X } from 'lucide-react';
import axios from 'axios';
import { API_CONFIG } from '../config/apiConfig';

interface PINSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const PINSettings: React.FC<PINSettingsProps> = ({ isOpen, onClose }) => {
  const [pinStatus, setPinStatus] = useState({
    has_pin: false,
    pin_enabled: false,
    is_locked: false,
    locked_until: null as string | null,
  });
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  
  // Setup PIN states
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const pinInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  
  const confirmPinInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (isOpen) {
      fetchPINStatus();
    }
  }, [isOpen]);

  const fetchPINStatus = async () => {
    try {
      const token = localStorage.getItem('access');
      const response = await axios.get(
        API_CONFIG.getApiUrl('/pin/status/'),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setPinStatus(response.data);
    } catch (err) {
      console.error('Error fetching PIN status:', err);
    }
  };

  const handlePinChange = (index: number, value: string, isConfirm: boolean = false) => {
    if (value && !/^\d$/.test(value)) return;

    const currentPin = isConfirm ? [...confirmPin] : [...pin];
    currentPin[index] = value;
    
    if (isConfirm) {
      setConfirmPin(currentPin);
    } else {
      setPin(currentPin);
    }
    
    setError('');

    // Auto-focus next input
    if (value && index < 3) {
      const refs = isConfirm ? confirmPinInputRefs : pinInputRefs;
      refs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>, isConfirm: boolean = false) => {
    const currentPin = isConfirm ? confirmPin : pin;
    const refs = isConfirm ? confirmPinInputRefs : pinInputRefs;
    
    if (e.key === 'Backspace' && !currentPin[index] && index > 0) {
      refs[index - 1].current?.focus();
    }
  };

  const handleSetupPIN = async () => {
    const pinValue = pin.join('');
    const confirmPinValue = confirmPin.join('');

    if (pinValue.length !== 4) {
      setError('Please enter a 4-digit PIN');
      return;
    }

    if (pinValue !== confirmPinValue) {
      setError('PINs do not match');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('access');
      const response = await axios.post(
        API_CONFIG.getApiUrl('/pin/setup/'),
        {
          pin: pinValue,
          password: password,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setSuccess('PIN setup successfully!');
        setShowSetup(false);
        setPin(['', '', '', '']);
        setConfirmPin(['', '', '', '']);
        setPassword('');
        await fetchPINStatus();
        
        setTimeout(() => {
          setSuccess('');
        }, 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to setup PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleDisablePIN = async () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('access');
      const response = await axios.post(
        API_CONFIG.getApiUrl('/pin/disable/'),
        { password },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setSuccess('PIN authentication disabled');
        setShowDisable(false);
        setPassword('');
        await fetchPINStatus();
        
        setTimeout(() => {
          setSuccess('');
        }, 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to disable PIN');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-teal-700" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">PIN Authentication</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Success Message */}
          {success && (
            <div className="bg-teal-50 text-teal-700 p-3 rounded-lg border border-teal-200 flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5" />
              {success}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* Current Status */}
          {!showSetup && !showDisable && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Status</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    pinStatus.pin_enabled
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {pinStatus.pin_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {pinStatus.pin_enabled
                    ? 'PIN authentication is active. You will be asked to enter your PIN after logging in with your password.'
                    : 'PIN authentication is not enabled. Enable it for an extra layer of security.'}
                </p>
              </div>

              {pinStatus.is_locked && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-700" />
                    <span className="text-sm font-medium text-red-700">PIN Locked</span>
                  </div>
                  <p className="text-sm text-red-600">
                    Too many failed attempts. Please try again later.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 mt-6">
                {!pinStatus.pin_enabled ? (
                  <button
                    onClick={() => setShowSetup(true)}
                    className="w-full bg-teal-700 text-white py-3 rounded-lg font-medium hover:bg-teal-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <Lock className="w-5 h-5" />
                    Enable PIN Authentication
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setShowSetup(true)}
                      className="w-full bg-teal-700 text-white py-3 rounded-lg font-medium hover:bg-teal-800 transition-colors"
                    >
                      Change PIN
                    </button>
                    <button
                      onClick={() => setShowDisable(true)}
                      className="w-full border border-red-300 text-red-700 py-3 rounded-lg font-medium hover:bg-red-50 transition-colors"
                    >
                      Disable PIN Authentication
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Setup/Change PIN Form */}
          {showSetup && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter New PIN
                </label>
                <div className="flex justify-center gap-3">
                  {pin.map((digit, index) => (
                    <input
                      key={index}
                      ref={pinInputRefs[index]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(index, e.target.value, false)}
                      onKeyDown={(e) => handleKeyDown(index, e, false)}
                      className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm PIN
                </label>
                <div className="flex justify-center gap-3">
                  {confirmPin.map((digit, index) => (
                    <input
                      key={index}
                      ref={confirmPinInputRefs[index]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(index, e.target.value, true)}
                      onKeyDown={(e) => handleKeyDown(index, e, true)}
                      className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowSetup(false);
                    setPin(['', '', '', '']);
                    setConfirmPin(['', '', '', '']);
                    setPassword('');
                    setError('');
                  }}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetupPIN}
                  disabled={loading || pin.some(d => !d) || confirmPin.some(d => !d) || !password}
                  className="flex-1 bg-teal-700 text-white py-3 rounded-lg font-medium hover:bg-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Setting up...' : 'Confirm'}
                </button>
              </div>
            </div>
          )}

          {/* Disable PIN Form */}
          {showDisable && (
            <div className="space-y-4">
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  Are you sure you want to disable PIN authentication? This will remove the extra layer of security from your account.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowDisable(false);
                    setPassword('');
                    setError('');
                  }}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisablePIN}
                  disabled={loading || !password}
                  className="flex-1 bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Disabling...' : 'Disable PIN'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PINSettings;
