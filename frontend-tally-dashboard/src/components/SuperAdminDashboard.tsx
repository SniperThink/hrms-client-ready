import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Users, UserCheck, CreditCard, Ticket, 
  Edit2, Save, X, Search, File, Download, LogIn
} from 'lucide-react';
import { apiGet, apiPatch, apiPost, API_ENDPOINTS } from '../services/api';
import { logger } from '../utils/logger';

interface DashboardStats {
  tenants: {
    total: number;
    active: number;
    inactive: number;
    with_credits: number;
    without_credits: number;
    plans: Array<{ plan: string; count: number }>;
    avg_credits: number;
  };
  users: {
    total: number;
    active: number;
    inactive: number;
  };
  employees: {
    total: number;
    active: number;
    inactive: number;
  };
  credits: {
    total: number;
    tenants_with_credits: number;
    tenants_without_credits: number;
  };
  support_tickets: {
    total: number;
    open: number;
    in_progress: number;
    resolved: number;
    closed: number;
  };
  recent_activity: {
    tickets_last_7_days: number;
    users_last_7_days: number;
    tenants_last_7_days: number;
  };
}

interface Tenant {
  id: number;
  name: string;
  subdomain: string;
  credits: number;
  is_active: boolean;
  plan: string;
  created_at: string;
  last_credit_deducted: string | null;
  user_count: number;
  employee_count: number;
  ticket_count: number;
}

interface SupportTicket {
  id: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_by: {
    id: number;
    email: string;
    name: string;
  };
  created_at: string;
  updated_at: string;
  admin_response: string | null;
  resolved_at: string | null;
  resolved_by_info: {
    id: number;
    email: string;
    name: string;
  } | null;
  tenant_info: {
    id: number;
    name: string;
    subdomain: string;
  };
  attachment?: string;
  attachment_url?: string;
}

const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'tenants' | 'tickets'>('stats');
  const [editingTenant, setEditingTenant] = useState<number | null>(null);
  const [creditAmount, setCreditAmount] = useState<string>('');
  const [creditAction, setCreditAction] = useState<'add' | 'set'>('add');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketStatus, setTicketStatus] = useState<string>('');
  const [adminResponse, setAdminResponse] = useState<string>('');
  const [loggingInTenant, setLoggingInTenant] = useState<number | null>(null);

  useEffect(() => {
    fetchStats();
    fetchTenants();
    fetchTickets();
  }, []);

  const fetchStats = async () => {
    try {
      logger.info('Fetching super admin stats from:', API_ENDPOINTS.superAdminStats);
      const response = await apiGet(API_ENDPOINTS.superAdminStats);
      logger.info('Stats response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        logger.info('Stats data received:', data);
        setStats(data);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        logger.error('Failed to fetch stats:', response.status, errorData);
        alert(`Failed to load statistics: ${errorData.error || errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      logger.error('Error fetching stats:', error);
      alert('Error loading statistics. Please check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      logger.info('Fetching tenants from:', API_ENDPOINTS.superAdminTenants);
      const response = await apiGet(API_ENDPOINTS.superAdminTenants);
      logger.info('Tenants response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        logger.info('Tenants data received:', data);
        setTenants(data.tenants || []);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        logger.error('Failed to fetch tenants:', response.status, errorData);
        alert(`Failed to load tenants: ${errorData.error || errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      logger.error('Error fetching tenants:', error);
      alert('Error loading tenants. Please check console for details.');
    }
  };

  const fetchTickets = async () => {
    try {
      const params = ticketStatusFilter !== 'all' ? `?status=${ticketStatusFilter}` : '';
      const response = await apiGet(`${API_ENDPOINTS.superAdminSupportTickets}${params}`);
      if (response.ok) {
        const data = await response.json();
        setTickets(data.tickets || []);
      } else {
        logger.error('Failed to fetch tickets');
      }
    } catch (error) {
      logger.error('Error fetching tickets:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'tickets') {
      fetchTickets();
    }
  }, [ticketStatusFilter, activeTab]);

  const handleUpdateCredits = async (tenantId: number) => {
    if (!creditAmount || isNaN(Number(creditAmount)) || Number(creditAmount) < 0) {
      alert('Please enter a valid credit amount');
      return;
    }

    try {
      const response = await apiPatch(API_ENDPOINTS.superAdminTenantCredits(tenantId.toString()), {
        action: creditAction,
        amount: Number(creditAmount)
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message || 'Credits updated successfully');
        setEditingTenant(null);
        setCreditAmount('');
        fetchTenants();
        fetchStats();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update credits');
      }
    } catch (error) {
      logger.error('Error updating credits:', error);
      alert('Failed to update credits');
    }
  };

  const handleUpdateTicketStatus = async (ticketId: number) => {
    if (!ticketStatus) {
      alert('Please select a status');
      return;
    }

    try {
      const response = await apiPatch(API_ENDPOINTS.superAdminTicketStatus(ticketId.toString()), {
        status: ticketStatus,
        admin_response: adminResponse || undefined
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message || 'Ticket status updated successfully');
        setSelectedTicket(null);
        setTicketStatus('');
        setAdminResponse('');
        fetchTickets();
        fetchStats();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update ticket status');
      }
    } catch (error) {
      logger.error('Error updating ticket status:', error);
      alert('Failed to update ticket status');
    }
  };

  const handleLoginAsTenant = async (tenantId: number) => {
    setLoggingInTenant(tenantId);
    try {
      const response = await apiPost(API_ENDPOINTS.superAdminLoginAsTenant(tenantId.toString()), {});
      
      if (response.ok) {
        const data = await response.json();
        
        // Store authentication data with impersonation flag
        if (data.access && data.refresh) {
          localStorage.setItem('access', data.access);
          localStorage.setItem('refresh', data.refresh);
          localStorage.setItem('user', JSON.stringify(data.user));
          
          if (data.session_key) {
            localStorage.setItem('session_key', data.session_key);
          }
          
          if (data.tenant) {
            localStorage.setItem('tenant', JSON.stringify(data.tenant));
          }
          
          // Navigate to tenant dashboard
          navigate('/hr-management');
        } else {
          alert('Failed to login as tenant - missing authentication tokens');
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to login as tenant');
      }
    } catch (error) {
      logger.error('Error logging in as tenant:', error);
      alert('Failed to login as tenant');
    } finally {
      setLoggingInTenant(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredTenants = tenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tenant.subdomain?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTickets = tickets.filter(ticket =>
    ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.tenant_info?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3 py-2 sm:px-4 text-sm sm:text-base rounded-lg font-medium transition-colors ${
              activeTab === 'stats'
                ? 'bg-teal-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            Statistics
          </button>
          <button
            onClick={() => setActiveTab('tenants')}
            className={`px-3 py-2 sm:px-4 text-sm sm:text-base rounded-lg font-medium transition-colors ${
              activeTab === 'tenants'
                ? 'bg-teal-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            <span className="hidden sm:inline">Tenant Management</span>
            <span className="sm:hidden">Tenants</span>
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-3 py-2 sm:px-4 text-sm sm:text-base rounded-lg font-medium transition-colors ${
              activeTab === 'tickets'
                ? 'bg-teal-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            <span className="hidden sm:inline">Support Tickets</span>
            <span className="sm:hidden">Tickets</span>
          </button>
        </div>
      </div>

      {activeTab === 'stats' && (
        <div className="space-y-6">
          {!stats ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">Loading statistics... If this persists, please check the browser console for errors.</p>
            </div>
          ) : (
            <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">Total Tenants</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.tenants.total}</p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    {stats.tenants.active} active
                  </p>
                </div>
                <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-teal-600 flex-shrink-0 ml-2" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">Total Users</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.users.total}</p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    {stats.users.active} active
                  </p>
                </div>
                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0 ml-2" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">Total Employees</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.employees.total}</p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    {stats.employees.active} active
                  </p>
                </div>
                <UserCheck className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 flex-shrink-0 ml-2" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">Total Credits</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.credits.total}</p>
                  <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                    Avg: {stats.tenants.avg_credits}
                  </p>
                </div>
                <CreditCard className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 flex-shrink-0 ml-2" />
              </div>
            </div>
          </div>

          {/* Support Tickets Overview */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">Support Tickets Overview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.support_tickets.total}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.support_tickets.open}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Open</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{stats.support_tickets.in_progress}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">In Progress</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.support_tickets.resolved}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Resolved</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-600">{stats.support_tickets.closed}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Closed</p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">Recent Activity (Last 7 Days)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="flex items-center gap-3">
                <Ticket className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {stats.recent_activity.tickets_last_7_days}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">New Tickets</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6 text-green-600" />
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {stats.recent_activity.users_last_7_days}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">New Users</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-purple-600" />
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {stats.recent_activity.tenants_last_7_days}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">New Tenants</p>
                </div>
              </div>
            </div>
          </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'tenants' && (
        <div className="space-y-6">
          {tenants.length === 0 && !loading ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">No tenants found. If this persists, please check the browser console for errors.</p>
            </div>
          ) : null}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Manage Tenants</h2>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search tenants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 sm:flex-initial min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm sm:text-base"
                />
              </div>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Tenant</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hidden sm:table-cell">Credits</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hidden md:table-cell">Users</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hidden lg:table-cell">Employees</th>
                    <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredTenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="py-3 px-2 sm:px-4">
                        <div className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">{tenant.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">ID: {tenant.id}</div>
                        <div className="sm:hidden mt-1">
                          <span className="text-xs text-gray-600 dark:text-gray-400">Credits: </span>
                          <span className="font-semibold text-gray-900 dark:text-white">{tenant.credits}</span>
                        </div>
                        <div className="sm:hidden mt-1 text-xs text-gray-600 dark:text-gray-400">
                          Users: {tenant.user_count} | Employees: {tenant.employee_count}
                        </div>
                      </td>
                      <td className="py-3 px-2 sm:px-4 hidden sm:table-cell">
                        {editingTenant === tenant.id ? (
                          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                            <select
                              value={creditAction}
                              onChange={(e) => setCreditAction(e.target.value as 'add' | 'set')}
                              className="px-2 py-1 border border-gray-300 rounded text-xs sm:text-sm"
                            >
                              <option value="add">Add</option>
                              <option value="set">Set</option>
                            </select>
                            <input
                              type="number"
                              value={creditAmount}
                              onChange={(e) => setCreditAmount(e.target.value)}
                              placeholder="Amount"
                              className="w-16 sm:w-24 px-2 py-1 border border-gray-300 rounded text-xs sm:text-sm"
                              min="0"
                            />
                            <button
                              onClick={() => handleUpdateCredits(tenant.id)}
                              className="p-1 text-green-600 hover:text-green-700"
                              aria-label="Save"
                            >
                              <Save className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingTenant(null);
                                setCreditAmount('');
                              }}
                              className="p-1 text-red-600 hover:text-red-700"
                              aria-label="Cancel"
                            >
                              <X className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">{tenant.credits}</span>
                            <button
                              onClick={() => {
                                setEditingTenant(tenant.id);
                                setCreditAmount(tenant.credits.toString());
                              }}
                              className="p-1 text-teal-600 hover:text-teal-700"
                              aria-label="Edit credits"
                            >
                              <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 sm:px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                          tenant.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {tenant.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-gray-700 dark:text-gray-300 text-sm hidden md:table-cell">{tenant.user_count}</td>
                      <td className="py-3 px-2 sm:px-4 text-gray-700 dark:text-gray-300 text-sm hidden lg:table-cell">{tenant.employee_count}</td>
                      <td className="py-3 px-2 sm:px-4">
                        <button
                          onClick={() => handleLoginAsTenant(tenant.id)}
                          disabled={loggingInTenant === tenant.id}
                          className="px-2 sm:px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs sm:text-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          <LogIn className="w-3 h-3" />
                          <span className="hidden sm:inline">{loggingInTenant === tenant.id ? 'Logging in...' : 'Login'}</span>
                          <span className="sm:hidden">{loggingInTenant === tenant.id ? '...' : 'Login'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Support Tickets</h2>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <select
                  value={ticketStatusFilter}
                  onChange={(e) => setTicketStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm sm:text-base"
                >
                  <option value="all">All Status</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <div className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search tickets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm sm:text-base"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">#{ticket.id} - {ticket.subject}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getStatusColor(ticket.status)}`}>
                          {ticket.status.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{ticket.description.substring(0, 150)}...</p>
                      {ticket.attachment_url && (
                        <div className="mb-2 flex items-center gap-2">
                          <File size={14} className="text-teal-600 flex-shrink-0" />
                          <a
                            href={ticket.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-600 hover:text-teal-800 text-xs sm:text-sm font-medium flex items-center gap-1"
                          >
                            <Download size={12} />
                            View Attachment
                          </a>
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>Tenant: {ticket.tenant_info?.name || 'N/A'}</span>
                        <span className="hidden sm:inline">•</span>
                        <span>Created by: {ticket.created_by.name}</span>
                        <span className="hidden sm:inline">•</span>
                        <span>Created: {formatDate(ticket.created_at)}</span>
                      </div>
                      {ticket.admin_response && (
                        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs sm:text-sm">
                          <strong>Admin Response:</strong> {ticket.admin_response}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setTicketStatus(ticket.status);
                        setAdminResponse(ticket.admin_response || '');
                      }}
                      className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 text-xs sm:text-sm whitespace-nowrap sm:ml-4"
                    >
                      Update Status
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Update Ticket Modal */}
          {selectedTicket && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                    Update Ticket #{selectedTicket.id}
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedTicket(null);
                      setTicketStatus('');
                      setAdminResponse('');
                    }}
                    className="text-gray-500 hover:text-gray-700 p-1"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Status
                    </label>
                    <select
                      value={ticketStatus}
                      onChange={(e) => setTicketStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm sm:text-base"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Admin Response (Optional)
                    </label>
                    <textarea
                      value={adminResponse}
                      onChange={(e) => setAdminResponse(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm sm:text-base"
                      placeholder="Enter your response..."
                    />
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                    <button
                      onClick={() => {
                        setSelectedTicket(null);
                        setTicketStatus('');
                        setAdminResponse('');
                      }}
                      className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm sm:text-base"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleUpdateTicketStatus(selectedTicket.id)}
                      className="w-full sm:w-auto px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm sm:text-base"
                    >
                      Update Status
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;

