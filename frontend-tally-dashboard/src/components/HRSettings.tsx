import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPatch } from '../services/api';
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
  const [activeTab, setActiveTab] = useState<'profile' | 'holidays'>('profile');

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