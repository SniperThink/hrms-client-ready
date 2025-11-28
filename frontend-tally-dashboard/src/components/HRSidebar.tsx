import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutGrid, 
  Users, 
  PlusCircle, 
  Upload, 
  ClipboardList, 
  CalendarCheck, 
  CircleDollarSign, 
  Shield, 
  Settings,
  MessageSquare,
  Crown
} from 'lucide-react';

interface HRSidebarProps {
  activePage: string;
  onPageChange: (page: string) => void;
}

const HRSidebar: React.FC<HRSidebarProps> = ({ activePage, onPageChange }) => {
  const navigate = useNavigate();
  
  // Get user info from localStorage
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperUser = user?.is_superuser || false;
  // Regular admin (not superuser) - exclude superuser from admin check
  const isAdmin = (user?.role === 'admin' || user?.is_admin) && !isSuperUser;
  const isHRManager = user?.role === 'hr_manager' || user?.role === 'hr-manager' || false;
  const isPayrollMaster = user?.role === 'payroll_master' || false;
  
  const navItems = [
    { name: "Overview", icon: LayoutGrid, id: "overview", path: "/hr-management", roles: ['admin', 'payroll_master'], superUserOnly: false },
    { name: "All Employees", icon: Users, id: "directory", path: "/hr-management/directory", roles: ['admin', 'payroll_master'], superUserOnly: false },
    { name: "Add Employee", icon: PlusCircle, id: "add-employee", path: "/hr-management/directory/add", roles: ['admin', 'payroll_master'], superUserOnly: false },
    { name: "Upload Data", icon: Upload, id: "data-upload", path: "/hr-management/data-upload", roles: ['admin', 'payroll_master'], superUserOnly: false },
    { name: "Attendance Log", icon: ClipboardList, id: "attendance-log", path: "/hr-management/attendance-log", roles: ['admin', 'hr_manager', 'payroll_master'], superUserOnly: false },
    { name: "Attendance Tracker", icon: CalendarCheck, id: "attendance-tracker", path: "/hr-management/attendance-tracker", roles: ['admin', 'hr_manager', 'payroll_master'], superUserOnly: false },
    { name: "Payroll", icon: CircleDollarSign, id: "payroll", path: "/hr-management/payroll", roles: ['admin', 'payroll_master'], superUserOnly: false },
    { name: "Team Management", icon: Shield, id: "team", path: "/hr-management/team", roles: ['admin'], superUserOnly: false },
    { name: "Support", icon: MessageSquare, id: "support", path: "/hr-management/support", roles: ['admin', 'hr_manager', 'payroll_master'], superUserOnly: false },
    { name: "Settings", icon: Settings, id: "settings", path: "/hr-management/settings", roles: ['admin', 'hr_manager', 'payroll_master'], superUserOnly: false },
    { name: "Super Admin", icon: Crown, id: "super-admin", path: "/super-admin", roles: [], superUserOnly: true }
  ];

  // Filter items based on user role
  const itemsToShow = navItems.filter(item => {
    // Super admin only items - ONLY show to superusers
    if (item.superUserOnly) {
      return isSuperUser;
    }
    
    // Superusers ONLY see the Super Admin dashboard, not regular HR management items
    if (isSuperUser) {
      return false; // Superusers don't see regular HR items
    }
    
    // Regular admin can see everything except super admin items
    if (isAdmin) return true;
    
    if (isPayrollMaster) {
      // Payroll master can see everything except Team Management
      return item.id !== 'team';
    }
    if (isHRManager) return ['attendance-log', 'attendance-tracker', 'support', 'settings'].includes(item.id);
    return false; // No access for other roles
  });

  const handleNavigation = (id: string, path: string) => {
    onPageChange(id);
    navigate(path);
  };

  return (
    <div className="w-16 sm:w-64 h-full bg-[#0B5E59] flex-shrink-0 overflow-y-auto hide-scrollbar">
      <div className="p-4 pb-3 flex justify-center sm:justify-start">
        <div className="flex items-center text-[#C2E812] font-bold">
          {/* Mobile logo - using same image but smaller */}
          <div className="sm:hidden">
            <img src="/img/logo-teal.png" alt="Sniperthink Logo" className="h-5" />
          </div>
          {/* Full logo for desktop view */}
          <img src="/img/logo-teal.png" alt="Sniperthink Logo" className="hidden sm:block h-6" />
        </div>
      </div>
      <nav className="mt-4">
        {itemsToShow.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <div 
              key={item.name} 
              className={`relative flex items-center cursor-pointer px-4 py-3 my-1 mx-2
                ${isActive 
                  ? 'bg-[#074E49] rounded-[12px] overflow-hidden shadow-sm' 
                  : 'text-white hover:bg-[#074E49] hover:rounded-[12px] transition-all duration-200'}`}
              onClick={() => handleNavigation(item.id, item.path)}
            >
              <div className="flex items-center justify-center w-8">
                <Icon size={20} className={isActive ? 'text-[#C2E812]' : 'text-white'} />
              </div>
              <span className={`hidden sm:block ml-3 ${isActive ? 'text-[#C2E812] font-medium' : 'text-white'}`}>
                {item.name}
              </span>
            </div>
          );
        })}
      </nav>
    </div>
  );
};

export default HRSidebar;