import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Bell, Moon, Sun, Zap } from 'lucide-react';
import { logout } from '../services/authService';
import { apiGet } from '../services/api';

interface CreditsResponse {
  tenant_id: number;
  tenant_name: string;
  credits: number;
  is_active: boolean;
}

interface HRHeaderProps {
  pageName?: string;
}

const HRHeader: React.FC<HRHeaderProps> = ({ pageName }) => {
  const location = useLocation();
  const tenant = JSON.parse(localStorage.getItem('tenant') || '{}');
  
  // Function to determine current page title and subtitle based on route
  const getPageInfo = () => {
    const path = location.pathname;
    
    // If the pageName is directly provided, try to match it
    if (pageName) {
      switch (pageName) {
        case 'overview':
          return { 
            title: 'Dashboard Overview', 
            subtitle: "View key metrics and performance indicators" 
          };
        case 'directory':
          return { 
            title: 'All Employees', 
            subtitle: "View and manage all employee records" 
          };
        case 'add-employee':
          return { 
            title: 'Add New Employee', 
            subtitle: "Create a new employee record in the system" 
          };
        case 'payroll':
          return { 
            title: 'Payroll Management', 
            subtitle: "All employee payroll" 
          };
        case 'attendance-tracker':
          return { 
            title: 'Attendance Tracker', 
            subtitle: "All employee attendance" 
          };
        case 'attendance-log':
          return { 
            title: 'Attendance Log', 
            subtitle: "View detailed attendance records" 
          };
        case 'team':
          return { 
            title: 'Leave Management', 
            subtitle: "All employee leaves" 
          };
        case 'data-upload':
          return { 
            title: 'Data Upload', 
            subtitle: "Import and export data in bulk" 
          };
        case 'operations-log':
          return { 
            title: 'Operations Log', 
            subtitle: "Track and review system activities" 
          };
        case 'settings':
          return { 
            title: 'Settings', 
            subtitle: "Admin Details" 
          };
        default:
          // Fallback to path-based detection
          break;
      }
    }
    
    // Path-based detection (fallback)
    if (path.includes('/hr-management/directory/add')) {
      return { 
        title: 'Add New Employee', 
        subtitle: "Create a new employee record in the system" 
      };
    } 
    else if (path.includes('/hr-management/team')) {
        return {
          title: "Team Management",
          subtitle: "Invite and manage your team members " + tenant.name
      };
    }
    else if (path.includes('/hr-management/directory')) {
      return { 
        title: 'All Employees', 
        subtitle: "View and manage all employee records" 
      };
    } else if (path.includes('/hr-management/data-upload')) {
      return { 
        title: 'Data Upload', 
        subtitle: "Import and export data in bulk" 
      };
    } else if (path.includes('/hr-management/operations-log')) {
      return { 
        title: 'Operations Log', 
        subtitle: "Track and review system activities" 
      };
    } else if (path.includes('/hr-management/payroll')) {
      return { 
        title: 'Payroll Management', 
        subtitle: "Process and manage employee compensation" 
      };
    } else if (path.includes('/hr-management/attendance-tracker')) {
      return { 
        title: 'Attendance Tracker', 
        subtitle: "Monitor daily employee attendance" 
      };
    } else if (path.includes('/hr-management/attendance-log')) {
      return { 
        title: 'Attendance Log', 
        subtitle: "View detailed attendance records" 
      };
    } else if (path.includes('/hr-management/leave-management')) {
      return { 
        title: 'Leave Management', 
        subtitle: "Process and track employee leave requests" 
      };
    } else if (path.includes('/hr-management/settings')) {
      return { 
        title: 'Settings', 
        subtitle: "Configure system preferences and options" 
      }
    } else {
      return { 
        title: 'Dashboard Overview', 
        subtitle: "View key metrics and performance indicators" 
      };
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };  

  // Check if we're on the overview page
  const isOverviewPage = location.pathname === '/hr-management' || location.pathname === '/';

  // Get the page information based on current route
  const pageInfo = getPageInfo();

  // Get user info from localStorage
  let user = null;
  let username = '';
  let email = '';
  let tenantName = tenant?.name || 'Your Company';
  let initial = '';
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
    email = user?.email || '';
    if (email) {
      username = email.split('@')[0];
      initial = username.charAt(0).toUpperCase();
      // Capitalize username for display
      username = username.charAt(0).toUpperCase() + username.slice(1);
    }
    // Use first_name if available, otherwise use email username
    if (user?.first_name) {
      username = user.first_name;
      initial = user.first_name.charAt(0).toUpperCase();
    }
    if (user?.tenantName) {
      tenantName = user.tenant_name;
    }
  } catch {
    // Ignore parsing errors
  }

  // Dropdown state and ref
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  
  // Fetch remaining credits on component mount and when forced
  const fetchCredits = async (forceRefresh = false) => {
    try {
      // Add a timestamp query parameter to prevent caching when force refreshing
      const url = forceRefresh 
        ? `/api/tenant/credits/?_t=${new Date().getTime()}`
        : '/api/tenant/credits/';
        
      const response = await apiGet(url);
      const data: CreditsResponse = await response.json();
      
      if (data) {
        // Update credits if available
        if (typeof data.credits === 'number') {
          setRemainingCredits(data.credits);
        }
        // Handle account activation status if needed
        if (data.is_active === false) {
          console.log('Account is not active');
          // Add any account deactivation logic here if needed
        }
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
      setRemainingCredits(0);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    fetchCredits();
  }, []);
  
  // Add a refresh function that can be called when needed
  const refreshCredits = () => {
    fetchCredits(true);
  };

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-gray-200 shadow-sm dark:bg-gray-900 dark:border-gray-700">
      {/* Left section: Logo, Title and subtitle */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1">
          {isOverviewPage ? (
            <>
              <h1 className="text-xl font-semibold text-black dark:text-white">Hello <span className="text-[#0B5E59] font-bold">{tenantName}</span> 👋</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {(() => {
                  const hour = new Date().getHours()
                  if (hour < 12) return "Good morning"
                  if (hour < 18) return "Good afternoon"
                  return "Good evening"
                })()}
              </p>

            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{pageInfo.title}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{pageInfo.subtitle}</p>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Search bar - desktop */}
        {/* <div className="relative hidden md:flex">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input 
            type="text" 
            placeholder="Search..." 
            className="pl-10 pr-4 py-2 w-72 bg-gray-100 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0B5E59] focus:bg-white"
          />
        </div> */}
        
        
         <div className="flex items-center space-x-4">
            {/* Credits Display */}
            {remainingCredits !== null && (
              <div 
                className={`flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                  remainingCredits < 5 
                    ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                    : 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                }`}
              >
                <Zap 
                  className={`w-4 h-4 mr-1.5 ${
                    remainingCredits < 5 ? 'text-red-500' : 'text-teal-500'
                  }`} 
                />
                {remainingCredits} Credits
                {remainingCredits < 5 && (
                  <span className="ml-2 text-xs font-normal">
                    (Expiring soon! Contact admin)
                  </span>
                )}
              </div>
            )}
          </div>

        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <button
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none"
            onClick={() => setNotificationOpen(!notificationOpen)}
          >
            <Bell size={22} className="text-gray-600 dark:text-gray-300" />
          </button>
          {notificationOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg z-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white">Notifications</h3>
              </div>
              <div className="max-h-80 overflow-y-auto hide-scrollbar">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400">No new notifications</p>
                </div>
              </div>
              <div className="p-2 text-center">
                <button className="text-sm text-[#0B5E59] hover:underline">
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative" ref={dropdownRef}>
          <button
            className="flex items-center gap-2 focus:outline-none"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div className="w-8 h-8 rounded-full bg-[#0B5E59] flex items-center justify-center text-white">
              {initial}
            </div>
            <span className="hidden md:inline text-sm font-medium text-gray-700 dark:text-gray-300">
              {username}
            </span>
          </button>
          
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{username}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{email}</p>
              </div>
              <div className="py-1">
                <button
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  onClick={() => {/* Handle profile click */}}
                >
                  Profile Settings
                </button>
                <button
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  onClick={logout}
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HRHeader;