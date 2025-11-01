import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface PasswordValidation {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
}

interface PasswordStrengthIndicatorProps {
  password: string;
  validation: PasswordValidation;
  showStrength?: boolean;
}

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  validation,
  showStrength = true
}) => {
  const getStrengthLevel = (): { level: number; label: string; color: string } => {
    const validCount = Object.values(validation).filter(Boolean).length;
    
    if (validCount === 0) return { level: 0, label: '', color: 'bg-gray-200' };
    if (validCount <= 2) return { level: 1, label: 'Weak', color: 'bg-red-500' };
    if (validCount <= 3) return { level: 2, label: 'Fair', color: 'bg-yellow-500' };
    if (validCount <= 4) return { level: 3, label: 'Good', color: 'bg-blue-500' };
    return { level: 4, label: 'Strong', color: 'bg-green-500' };
  };

  const strength = getStrengthLevel();

  if (!password) return null;

  return (
    <div className="space-y-3">
      {/* Password Strength Bar */}
      {showStrength && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Password Strength:</span>
            <span className={`font-medium ${
              strength.level === 0 ? 'text-gray-500' :
              strength.level === 1 ? 'text-red-600' :
              strength.level === 2 ? 'text-yellow-600' :
              strength.level === 3 ? 'text-blue-600' :
              'text-green-600'
            }`}>
              {strength.label}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                strength.level === 0 ? 'w-0' :
                strength.level === 1 ? 'w-1/4' :
                strength.level === 2 ? 'w-1/2' :
                strength.level === 3 ? 'w-3/4' :
                'w-full'
              } ${strength.color}`}
            />
          </div>
        </div>
      )}

      {/* Password Requirements */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Password Requirements:</p>
        <div className="space-y-1">
          <div className={`flex items-center gap-2 text-sm ${validation.length ? 'text-green-600' : 'text-gray-500'}`}>
            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${validation.length ? 'bg-green-100' : 'bg-gray-100'}`}>
              {validation.length && <CheckCircle className="w-3 h-3" />}
            </div>
            At least 8 characters
          </div>
          <div className={`flex items-center gap-2 text-sm ${validation.uppercase ? 'text-green-600' : 'text-gray-500'}`}>
            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${validation.uppercase ? 'bg-green-100' : 'bg-gray-100'}`}>
              {validation.uppercase && <CheckCircle className="w-3 h-3" />}
            </div>
            One uppercase letter
          </div>
          <div className={`flex items-center gap-2 text-sm ${validation.lowercase ? 'text-green-600' : 'text-gray-500'}`}>
            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${validation.lowercase ? 'bg-green-100' : 'bg-gray-100'}`}>
              {validation.lowercase && <CheckCircle className="w-3 h-3" />}
            </div>
            One lowercase letter
          </div>
          <div className={`flex items-center gap-2 text-sm ${validation.number ? 'text-green-600' : 'text-gray-500'}`}>
            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${validation.number ? 'bg-green-100' : 'bg-gray-100'}`}>
              {validation.number && <CheckCircle className="w-3 h-3" />}
            </div>
            One number
          </div>
          <div className={`flex items-center gap-2 text-sm ${validation.special ? 'text-green-600' : 'text-gray-500'}`}>
            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${validation.special ? 'bg-green-100' : 'bg-gray-100'}`}>
              {validation.special && <CheckCircle className="w-3 h-3" />}
            </div>
            One special character
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordStrengthIndicator;
