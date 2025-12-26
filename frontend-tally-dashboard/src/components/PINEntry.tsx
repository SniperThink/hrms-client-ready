import React, { useState, useRef, useEffect } from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { API_CONFIG } from '../config/apiConfig';

interface PINEntryProps {
  email: string;
  onSuccess: () => void;
  onBack?: () => void;
  userName?: string;
  companyName?: string;
  existingSession?: boolean;
}

const PINEntry: React.FC<PINEntryProps> = ({ email, onSuccess, onBack, userName, companyName, existingSession = false }) => {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    // Focus first input on mount
    inputRefs[0].current?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError('');

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-submit when all 4 digits are entered
    if (index === 3 && value) {
      const fullPin = newPin.join('');
      if (fullPin.length === 4) {
        handleSubmit(fullPin);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    
    // Only allow 4-digit numbers
    if (/^\d{4}$/.test(pastedData)) {
      const newPin = pastedData.split('');
      setPin(newPin);
      inputRefs[3].current?.focus();
      
      // Auto-submit after paste
      setTimeout(() => handleSubmit(pastedData), 100);
    }
  };

  const handleSubmit = async (pinValue?: string) => {
    const fullPin = pinValue || pin.join('');
    
    if (fullPin.length !== 4) {
      setError('Please enter all 4 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(
        API_CONFIG.getApiUrl('/pin/verify/'),
        {
          email,
          pin: fullPin,
        }
      );

      if (response.data.success) {
        onSuccess();
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Invalid PIN. Please try again.';
      setError(errorMessage);
      
      // Clear PIN on error
      setPin(['', '', '', '']);
      inputRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen font-poppins">
      <div className="flex-1 bg-white flex items-center justify-center">
        <div className="w-[640px] min-h-[700px] rounded-3xl flex flex-col items-start justify-start p-20 bg-[#176d67] bg-opacity-100 relative overflow-hidden">
          {/* Curved diagonal shapes */}
          <div className="absolute top-[-250px] left-[-50px] w-[300px] h-full">
            <img src="/img/r1.png" alt="PIN Visual" className="w-full h-full object-contain mb-4" />
          </div>
          <div className="absolute top-[-90px] left-[-150px] w-[600px] h-[600px]">
            <img src="/img/r2.png" alt="PIN Visual" className="w-full h-full object-contain mb-4" />
          </div>
          <div className="absolute bottom-[-0px] right-[-100px] w-[350px] h-[350px]">
            <img src="/img/rr1.png" alt="PIN Visual" className="w-full h-full object-contain mb-4" />
          </div>
          <div className="absolute bottom-[-20px] right-[-20px] w-[350px] h-[350px]">
            <img src="/img/rr2.png" alt="PIN Visual" className="w-full h-full object-contain mb-4" />
          </div>
          
          <img src="/image.png" alt="PIN Visual" className="w-full h-[400px] object-contain mb-4 relative z-10" />
          <img src="/logo.png" alt="SniperThink Logo" className="h-8 w-[230px] mb-4 relative z-10" />
          <h2 className="text-[40px] font-bold text-white mb-2 text-left relative z-10">Secure Access.<br />Protected Data.</h2>
          <p className="text-white text-[15px] text-center mb-4 text-base relative z-10">Your security is our priority.</p>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col justify-center items-center bg-white">
        <div className="w-full max-w-md px-8">
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center">
                  <Lock className="w-8 h-8 text-teal-700" />
                </div>
              </div>
              <h2 className="text-4xl font-semibold text-gray-800 mb-2">Enter PIN</h2>
              {userName && (
                <p className="text-gray-700 font-medium mb-1">Welcome back, {userName}</p>
              )}
              {companyName && (
                <p className="text-gray-500 text-sm mb-2">{companyName}</p>
              )}
              <p className="text-gray-600">Enter your 4-digit PIN to continue</p>
            </div>

            {/* PIN Input */}
            <div className="flex justify-center gap-4 mb-6">
              {pin.map((digit, index) => (
                <input
                  key={index}
                  ref={inputRefs[index]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  className="w-16 h-16 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  disabled={loading}
                />
              ))}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={() => handleSubmit()}
              disabled={loading || pin.some(d => !d)}
              className="w-full bg-teal-700 text-white py-3 rounded-lg font-medium hover:bg-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify PIN'}
            </button>

            {/* Back Button */}
            {onBack && (
              <button
                onClick={onBack}
                disabled={loading}
                className="w-full text-teal-700 py-3 rounded-lg font-medium hover:bg-teal-50 transition-colors disabled:opacity-50"
              >
                Back to Login
              </button>
            )}

            {/* Help Text */}
            <div className="text-center text-sm text-gray-500 mt-4">
              <p>Forgot your PIN?</p>
              <p className="mt-1">Contact your administrator for assistance.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PINEntry;
