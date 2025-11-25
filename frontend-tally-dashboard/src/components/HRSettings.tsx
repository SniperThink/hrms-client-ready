import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPatch, apiPost } from '../services/api';
import ChangePasswordModal from './ChangePasswordModal';
import DeleteAccountModal from './DeleteAccountModal';
import HRHolidayManagement from './HRHolidayManagement';
import { logger } from '../utils/logger';

const API_ENDPOINTS = {
  userProfile: '/api/user/profile/',
  users: '/api/users/',
  userPermissions: (userId: string) => `/api/users/${userId}/permissions/`,
  deleteAccount: '/api/user/delete-account/'
};

const HRSettings: React.FC = () => {
  const navigate = useNavigate();

  // Get user info from localStorage
  let user = null;
  let email = '';
  let userRoleFromStorage = null;
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
    email = user?.email || '';
    userRoleFromStorage = user?.role || null;
  } catch {
    // Ignore parsing errors and use defaults
  }

  const [currentUser, setCurrentUser] = useState<{
    id?: number;
    first_name?: string;
    last_name?: string;
    email?: string;
    is_superuser?: boolean;
    role?: string;
  } | null>(user);
  const [users, setUsers] = useState<Array<{
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    is_superuser: boolean;
    is_active: boolean;
    is_staff: boolean;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'holidays' | 'salary'>('profile');
  const [averageDaysPerMonth, setAverageDaysPerMonth] = useState<number>(30.4);
  const [salaryConfigLoading, setSalaryConfigLoading] = useState(false);
  const [salaryConfigError, setSalaryConfigError] = useState<string | null>(null);
  const [salaryConfigSuccess, setSalaryConfigSuccess] = useState<string | null>(null);

  // Fetch current user info (in case localStorage is stale)
  useEffect(() => {
    setLoading(true);
    logger.info( 'Fetching current user...');
    apiGet(API_ENDPOINTS.userProfile)
      .then(res => {
        logger.info( 'Current user fetch response:', res);
        if (!res.ok) throw new Error('Failed to fetch current user');
        return res.json();
      })
      .then(data => {
        logger.info( 'Current user data:', data);
        logger.info( 'User role from API:', data?.role);
        setCurrentUser(data);
        // Update localStorage with role if it's not there
        if (data?.role) {
          try {
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            storedUser.role = data.role;
            localStorage.setItem('user', JSON.stringify(storedUser));
          } catch {
            // Ignore errors
          }
        }
      })
      .catch((err) => {
        logger.error('Error fetching current user:', err);
        setCurrentUser(user);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch all users if current user is superuser
  useEffect(() => {
    if (currentUser?.is_superuser) {
      setLoading(true);
      logger.info( 'Fetching all users...');
      apiGet(API_ENDPOINTS.users)
        .then(res => {
          logger.info( 'All users fetch response:', res);
          if (!res.ok) throw new Error('Failed to fetch users');
          return res.json();
        })
        .then(data => {
          logger.info( 'All users data:', data);
          setUsers(data);
        })
        .catch((err) => {
          logger.error('Error fetching all users:', err);
          setError('Failed to load users');
        })
        .finally(() => setLoading(false));
    }
  }, [currentUser]);

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    localStorage.removeItem('is_superuser');
    navigate('/login');
  };

  const handleDeleteAccount = () => {
    // Check if user is admin (same logic as sidebar)
    const userIsAdmin = userFromStorage?.role === 'admin' || 
                        userFromStorage?.is_admin || 
                        userFromStorage?.is_superuser || 
                        currentUser?.is_superuser || 
                        false;
    
    // Check if user is payroll master (cannot delete their account)
    const userIsPayrollMaster = userRole === 'payroll_master' || false;

    // Only allow admins to delete accounts (payroll masters cannot delete their account)
    if (!userIsAdmin || userIsPayrollMaster) {
      alert('Only administrators can delete accounts. Please contact your administrator.');
      return;
    }

    // Open the delete account modal
    setShowDeleteAccountModal(true);
  };

  const handleDeleteAccountSuccess = () => {
    // This will be called when account is successfully deleted
    // The modal will handle the redirect/logout
    setShowDeleteAccountModal(false);
  };

  // Generalized handler for toggling user permissions
  const handleTogglePermission = (userId: number, field: string, value: boolean) => {
    if (field === 'is_superuser' && !value && userId === currentUser?.id) {
      alert('You cannot remove your own superuser status.');
      return;
    }
    if (field === 'is_superuser' && !value) {
      if (!window.confirm('Are you sure you want to remove superuser status?')) return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    apiPatch(API_ENDPOINTS.userPermissions(userId.toString()), { [field]: value })
      .then(res => {
        if (!res.ok) throw new Error('Failed to update user');
        return res.json();
      })
      .then(updatedUser => {
        setUsers(users.map(u => u.id === updatedUser.user.id ? updatedUser.user : u));
        setSuccess('User permissions updated successfully!');
        setTimeout(() => setSuccess(null), 2000);
      })
      .catch(() => {
        setError('Failed to update user');
      })
      .finally(() => setLoading(false));
  };

  let username = email ? email.split('@')[0] : '';
  username = username.charAt(0).toUpperCase() + username.slice(1);

  // Get user info from localStorage (same as sidebar)
  const userFromStorage = user || (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();
  
  // Get user role from either currentUser (API) or localStorage user
  // Priority: currentUser (API) > localStorage (initial)
  const userRole = currentUser?.role || userRoleFromStorage || userFromStorage?.role || null;
  
  // Check if user is admin (same logic as sidebar)
  const isAdmin = userFromStorage?.role === 'admin' || 
                  userFromStorage?.is_admin || 
                  userFromStorage?.is_superuser || 
                  currentUser?.is_superuser || 
                  false;
  
  // Check if user is HR Manager (same logic as sidebar)
  const isHRManager = userRole === 'hr_manager' || 
                      userRole === 'hr-manager' || 
                      false;
  
  // Check if user is Payroll Master
  const isPayrollMaster = userRole === 'payroll_master' || false;
  
  // Fetch salary config if user is admin or payroll master
  useEffect(() => {
    if (isAdmin || isPayrollMaster) {
      setSalaryConfigLoading(true);
      apiGet('/api/salary-config/')
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch salary config');
          return res.json();
        })
        .then(data => {
          setAverageDaysPerMonth(data.average_days_per_month || 30.4);
        })
        .catch((err) => {
          logger.error('Error fetching salary config:', err);
          setSalaryConfigError('Failed to load salary configuration');
        })
        .finally(() => setSalaryConfigLoading(false));
    }
  }, [isAdmin, isPayrollMaster]);
  
  // Debug logging
  useEffect(() => {
    logger.info('HRSettings - Current user role:', userRole);
    logger.info('HRSettings - Current user object:', currentUser);
    logger.info('HRSettings - User from localStorage:', userFromStorage);
    logger.info('HRSettings - Is HR Manager?', isHRManager);
    logger.info('HRSettings - Is Admin?', isAdmin);
  }, [userRole, currentUser, userFromStorage, isHRManager, isAdmin]);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'profile'
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Profile Settings
          </button>
          <button
            onClick={() => setActiveTab('holidays')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'holidays'
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Holiday Management
          </button>
          {(isAdmin || isPayrollMaster) && (
            <button
              onClick={() => setActiveTab('salary')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'salary'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Salary Settings
            </button>
          )}
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <>
          <div className="bg-white rounded-lg p-8 shadow-sm max-w-lg mx-auto">
            <form className="space-y-6">
              <div>
                <label className="block text-gray-700 mb-1">Email</label>
                <input type="text" value={email} readOnly className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-100" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Username</label>
                <input type="text" value={username} readOnly className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-100" />
              </div>
            </form>
            <div className="flex flex-col gap-4 mt-8">
              <button
                onClick={() => setShowChangePasswordModal(true)}
                className="bg-teal-600 text-white px-6 py-2 rounded hover:bg-teal-700 transition-colors"
              >
                Change Password
              </button>
              {/* Only show delete button if user is admin (same logic as sidebar) */}
              {isAdmin && (
                <button
                  onClick={handleDeleteAccount}
                  className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 transition-colors"
                >
                  Delete Account
                </button>
              )}
              <button
                onClick={handleLogout}
                className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
          {/* Superuser User Management Section */}
          {currentUser?.is_superuser && (
            <div className="bg-white rounded-lg p-8 shadow-sm max-w-3xl mx-auto mt-8">
              <h2 className="text-xl font-bold mb-4">User Management</h2>
              {success && <div className="text-teal-600 mb-2">{success}</div>}
              {loading ? (
                <div>Loading users...</div>
              ) : (
                <>
                  <table className="min-w-full border">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 border">Email</th>
                        <th className="px-4 py-2 border">Active</th>
                        <th className="px-4 py-2 border">Staff</th>
                        <th className="px-4 py-2 border">Superuser</th>
                        <th className="px-4 py-2 border">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user.id}>
                          <td className="px-4 py-2 border">{user.email}</td>
                          <td className="px-4 py-2 border">
                            <input
                              type="checkbox"
                              checked={user.is_active}
                              disabled={user.id === currentUser?.id}
                              onChange={e => handleTogglePermission(user.id, 'is_active', e.target.checked)}
                            />
                          </td>
                          <td className="px-4 py-2 border">
                            <input
                              type="checkbox"
                              checked={user.is_staff}
                              disabled={user.id === currentUser?.id}
                              onChange={e => handleTogglePermission(user.id, 'is_staff', e.target.checked)}
                            />
                          </td>
                          <td className="px-4 py-2 border">
                            <input
                              type="checkbox"
                              checked={user.is_superuser}
                              disabled={user.id === currentUser?.id}
                              onChange={e => handleTogglePermission(user.id, 'is_superuser', e.target.checked)}
                            />
                          </td>
                          <td className="px-4 py-2 border">
                            {user.id === currentUser?.id && (
                              <span className="text-xs text-gray-500 ml-2">(You)</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {error && <div className="text-red-500 mt-2">{error}</div>}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Holiday Management Tab */}
      {activeTab === 'holidays' && (
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <HRHolidayManagement />
        </div>
      )}

      {/* Salary Settings Tab */}
      {activeTab === 'salary' && (isAdmin || isPayrollMaster) && (
        <div className="bg-white rounded-lg p-8 shadow-sm max-w-2xl mx-auto">
          <h2 className="text-xl font-bold mb-6">Salary Configuration</h2>
          <p className="text-sm text-gray-600 mb-6">
            Configure the average days per month used for salary and overtime rate calculations.
          </p>
          
          {salaryConfigError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
              {salaryConfigError}
            </div>
          )}
          
          {salaryConfigSuccess && (
            <div className="mb-4 p-3 bg-teal-50 border border-teal-200 text-teal-700 rounded">
              {salaryConfigSuccess}
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSalaryConfigLoading(true);
              setSalaryConfigError(null);
              setSalaryConfigSuccess(null);

              try {
                const response = await apiPost('/api/salary-config/update/', {
                  average_days_per_month: averageDaysPerMonth,
                });

                if (!response.ok) {
                  const errorData = await response.json().catch(() => ({}));
                  throw new Error(errorData.error || 'Failed to update salary configuration');
                }

                const data = await response.json();
                setSalaryConfigSuccess(data.message || 'Salary configuration updated successfully!');
                setTimeout(() => setSalaryConfigSuccess(null), 3000);
              } catch (err: any) {
                logger.error('Error updating salary config:', err);
                setSalaryConfigError(err.message || 'Failed to update salary configuration');
              } finally {
                setSalaryConfigLoading(false);
              }
            }}
            className="space-y-6"
          >
            <div>
              <label className="block text-gray-700 mb-2 font-medium">
                Average Days Per Month
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="31"
                value={averageDaysPerMonth}
                onChange={(e) => setAverageDaysPerMonth(parseFloat(e.target.value) || 30.4)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="30.4"
                required
                disabled={salaryConfigLoading}
              />
              <p className="mt-2 text-sm text-gray-500">
                Total calendar days per month (default: 30.4). Used for calculating daily rates and overtime rates.
                Formula: OT Rate = Basic Salary ÷ (Shift Hours × Average Days Per Month)
              </p>
            </div>

            <button
              type="submit"
              disabled={salaryConfigLoading}
              className="w-full bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {salaryConfigLoading ? 'Saving...' : 'Save Configuration'}
            </button>
          </form>
        </div>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        onSuccess={() => {
          setSuccess('Password changed successfully!');
          setTimeout(() => setSuccess(null), 3000);
        }}
        userEmail={email}
      />

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={showDeleteAccountModal}
        onClose={() => setShowDeleteAccountModal(false)}
        onSuccess={handleDeleteAccountSuccess}
        userEmail={email}
        userRole={userRole}
      />
    </div>
  );
};

export default HRSettings; 