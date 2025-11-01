import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { signupCompany } from '../services/authService';
import { CompanySignupRequest } from '../types/auth';

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<CompanySignupRequest>({
    company_name: '',
    subdomain: '',
    email: '',
    password: '',
    first_name: '',
    last_name: ''
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    specialChar: false
  });

  const validatePassword = (password: string) => {
    const validation = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      specialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
    setPasswordValidation(validation);
    return validation;
  };

  const handleInputChange = (field: keyof CompanySignupRequest) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));

    // Auto-generate subdomain from company name
    if (field === 'company_name') {
      const subdomain = value.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
      
      setFormData(prev => ({ ...prev, subdomain }));
    }

    // Validate password when password field changes
    if (field === 'password') {
      validatePassword(value);
    }
  };

  const validateForm = (): string | null => {
    if (!formData.company_name.trim()) return 'Company name is required';
    if (!formData.subdomain.trim()) return 'Subdomain is required';
    if (formData.subdomain.length < 3) return 'Subdomain must be at least 3 characters';
    if (!/^[a-z0-9-]+$/.test(formData.subdomain)) return 'Subdomain can only contain lowercase letters, numbers, and hyphens';
    if (!formData.email.trim()) return 'Email is required';
    if (!formData.password.trim()) return 'Password is required';
    
    // Enhanced password validation
    const validation = validatePassword(formData.password);
    if (!validation.length) return 'Password must be at least 8 characters long';
    if (!validation.uppercase) return 'Password must contain at least one uppercase letter';
    if (!validation.lowercase) return 'Password must contain at least one lowercase letter';
    if (!validation.number) return 'Password must contain at least one number';
    if (!validation.specialChar) return 'Password must contain at least one special character';
    
    if (formData.password !== confirmPassword) return 'Passwords do not match';
    if (!formData.first_name.trim()) return 'First name is required';
    if (!formData.last_name.trim()) return 'Last name is required';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await signupCompany(formData);
      
      // Store authentication data
      if (response.access && response.refresh) {
        localStorage.setItem('access', response.access);
        localStorage.setItem('refresh', response.refresh);
      }
      localStorage.setItem('user', JSON.stringify(response.user));
      
      // Store tenant information
      if (response.tenant) {
        localStorage.setItem('tenant', JSON.stringify(response.tenant));
      }
      
      // Show success message
      alert(`Welcome to ${response.tenant?.name}! Link sent to your mail. Verify your mail to continue to dashboard.`);
      // Navigate to HR management dashboard
      navigate('/login');
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Company registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="flex-1 bg-white flex items-center justify-center">
        <div className="w-[640px] min-h-[700px] rounded-3xl flex flex-col items-start justify-start p-20 bg-[#176d67] bg-opacity-100 relative overflow-hidden">
          {/* Curved diagonal shape at top left */}
          <div className="absolute top-[-250px] left-[-50px] w-[300px] h-full">
            <img src="/img/r1.png" alt="Login Visual" className="w-full h-full object-contain mb-4" />
          </div>
          <div className="absolute top-[-90px] left-[-150px] w-[600px] h-[600px]">
            <img src="/img/r2.png" alt="Login Visual" className="w-full h-full object-contain mb-4" />
          </div>
          <div className="absolute bottom-[-0px] right-[-100px] w-[350px] h-[350px]">
            <img src="/img/rr1.png" alt="Login Visual" className="w-full h-full object-contain mb-4" />
          </div>
          <div className="absolute bottom-[-20px] right-[-20px] w-[350px] h-[350px]">
            <img src="/img/rr2.png" alt="Login Visual" className="w-full h-full object-contain mb-4" />
          </div>
          
          
          <img src="/image.png" alt="Login Visual" className="w-full h-[400px] object-contain mb-4 relative z-10" />
          <img src="/logo.png" alt="SniperThink Logo" className="h-8 w-[230px] mb-4 relative z-10" />
          <h2 className="text-[40px] font-bold text-white mb-2 text-left relative z-10">Analyze. Automate.<br />Accelerate.</h2>
          <p className="text-white text-[15px] text-center mb-4 text-base relative z-10">Welcome to SniperThink, your all-in-one solution.</p>
          <a href="#" className="text-white font-medium flex items-center gap-1 hover:underline text-base relative z-10">Learn More <span aria-hidden>→</span></a>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col justify-center items-center bg-white">
        <form className="w-full max-w-sm space-y-4" onSubmit={handleSubmit}>
          <h2 className="text-3xl font-semibold mb-2 text-center">Create Company Account</h2>
          <p className="text-gray-600 text-center text-sm mb-4">
            Set up your company's HRMS in minutes
          </p>
          
          <div>
            <label className="block text-gray-700 text-sm font-medium">Company Name</label>
            <input 
              type="text" 
              className="mt-1 w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" 
              value={formData.company_name} 
              onChange={handleInputChange('company_name')} 
              required 
              placeholder="Enter your company name"
            />
          </div>
          
          {/* <div>
            <label className="block text-gray-700 text-sm font-medium">Company Subdomain</label>
            <input 
              type="text" 
              className="mt-1 w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" 
              value={formData.subdomain} 
              onChange={handleInputChange('subdomain')} 
              placeholder="yourcompany"
            />
            <p className="text-xs text-gray-500 mt-1">
              This will be your company's unique identifier
            </p>
          </div> */}
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 text-sm font-medium">First Name</label>
              <input 
                type="text" 
                className="mt-1 w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" 
                value={formData.first_name} 
                onChange={handleInputChange('first_name')} 
                required 
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-medium">Last Name</label>
              <input 
                type="text" 
                className="mt-1 w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" 
                value={formData.last_name} 
                onChange={handleInputChange('last_name')} 
                required 
                placeholder="Doe"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-gray-700 text-sm font-medium">Admin Email</label>
            <input 
              type="email" 
              className="mt-1 w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" 
              value={formData.email} 
              onChange={handleInputChange('email')} 
              required 
              placeholder="admin@yourcompany.com"
            />
          </div>
          
          <div>
            <label className="block text-gray-700 text-sm font-medium">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                className="mt-1 w-full border rounded px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-teal-500" 
                value={formData.password} 
                onChange={handleInputChange('password')} 
                required 
                placeholder="Create a strong password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
            
            {/* Password validation indicators */}
            {formData.password && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center text-xs">
                  <div className={`w-2 h-2 rounded-full mr-2 ${passwordValidation.length ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className={passwordValidation.length ? 'text-green-600' : 'text-gray-500'}>
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center text-xs">
                  <div className={`w-2 h-2 rounded-full mr-2 ${passwordValidation.uppercase ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className={passwordValidation.uppercase ? 'text-green-600' : 'text-gray-500'}>
                    One uppercase letter
                  </span>
                </div>
                <div className="flex items-center text-xs">
                  <div className={`w-2 h-2 rounded-full mr-2 ${passwordValidation.lowercase ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className={passwordValidation.lowercase ? 'text-green-600' : 'text-gray-500'}>
                    One lowercase letter
                  </span>
                </div>
                <div className="flex items-center text-xs">
                  <div className={`w-2 h-2 rounded-full mr-2 ${passwordValidation.number ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className={passwordValidation.number ? 'text-green-600' : 'text-gray-500'}>
                    One number
                  </span>
                </div>
                <div className="flex items-center text-xs">
                  <div className={`w-2 h-2 rounded-full mr-2 ${passwordValidation.specialChar ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className={passwordValidation.specialChar ? 'text-green-600' : 'text-gray-500'}>
                    One special character
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-gray-700 text-sm font-medium">Confirm Password</label>
            <div className="relative">
              <input 
                type={showConfirmPassword ? "text" : "password"} 
                className="mt-1 w-full border rounded px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-teal-500" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                required 
                placeholder="Confirm your password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
            
            {/* Password match indicator */}
            {confirmPassword && (
              <div className="mt-2">
                <div className="flex items-center text-xs">
                  <div className={`w-2 h-2 rounded-full mr-2 ${formData.password === confirmPassword ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className={formData.password === confirmPassword ? 'text-green-600' : 'text-red-600'}>
                    {formData.password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded border border-red-200">
              {error}
            </div>
          )}
          
          <button 
            type="submit" 
            className="w-full bg-teal-800 text-white py-2 rounded hover:bg-teal-900 transition-colors disabled:opacity-50" 
            disabled={loading}
          >
            {loading ? 'Creating Company...' : 'Create Company Account'}
          </button>
          
          <div className="text-center text-sm mt-4 pt-4 border-t">
            <p className="text-gray-600 mb-2">Already have an account?</p>
            <a href="/login" className="text-teal-700 hover:underline font-medium">
              Sign in to your company
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Signup; 