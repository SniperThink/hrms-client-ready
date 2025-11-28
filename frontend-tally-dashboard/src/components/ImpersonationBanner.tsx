import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { API_ENDPOINTS } from '../services/api';
import { logger } from '../utils/logger';

const ImpersonationBanner: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [restoring, setRestoring] = useState(false);

  const checkImpersonation = () => {
    // Check if user is impersonating
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userData = JSON.parse(userStr);
      if (userData.impersonating) {
        setUser(userData);
        const tenantStr = localStorage.getItem('tenant');
        if (tenantStr) {
          setTenant(JSON.parse(tenantStr));
        }
      } else {
        setUser(null);
        setTenant(null);
      }
    } else {
      setUser(null);
      setTenant(null);
    }
  };

  useEffect(() => {
    checkImpersonation();
    
    // Listen for storage changes (when user state is updated)
    const handleStorageChange = () => {
      checkImpersonation();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically in case localStorage is updated in the same window
    const interval = setInterval(checkImpersonation, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const handleRestoreSession = async () => {
    setRestoring(true);
    try {
      const { API_CONFIG } = await import('../config/apiConfig');
      const API_BASE_URL = API_CONFIG.getBaseUrl();
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.superAdminRestoreSession}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access')}`,
        },
        body: JSON.stringify({
          original_super_admin_id: user?.original_super_admin?.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Store authentication data
        if (data.access && data.refresh) {
          localStorage.setItem('access', data.access);
          localStorage.setItem('refresh', data.refresh);
          localStorage.setItem('user', JSON.stringify(data.user));
          
          if (data.session_key) {
            localStorage.setItem('session_key', data.session_key);
          }
          
          if (data.tenant) {
            localStorage.setItem('tenant', JSON.stringify(data.tenant));
          } else {
            localStorage.removeItem('tenant');
          }
          
          // Navigate to super admin dashboard
          navigate('/super-admin');
        } else {
          alert('Failed to restore session - missing authentication tokens');
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to restore super admin session');
      }
    } catch (error) {
      logger.error('Error restoring super admin session:', error);
      alert('Failed to restore super admin session');
    } finally {
      setRestoring(false);
    }
  };

  if (!user?.impersonating) {
    return null;
  }

  return (
    <div className="bg-yellow-500 text-white px-4 py-3 flex items-center justify-between shadow-md z-50">
      <div className="flex items-center gap-3">
        <ArrowLeft size={18} />
        <span className="font-medium">
          You've been logged into tenant: <strong>{tenant?.name || 'Unknown Tenant'}</strong>
        </span>
        <button
          onClick={handleRestoreSession}
          disabled={restoring}
          className="ml-4 px-4 py-1 bg-white text-yellow-600 rounded hover:bg-gray-100 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {restoring ? 'Restoring...' : 'Click here to go back to admin dashboard'}
        </button>
      </div>
    </div>
  );
};

export default ImpersonationBanner;

