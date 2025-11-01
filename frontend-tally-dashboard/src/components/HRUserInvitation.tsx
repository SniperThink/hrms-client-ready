import React, { useState, useEffect } from 'react';
import { UserPlus, Eye, Edit, Trash2, Send, CheckCircle, XCircle } from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../services/api';
import Dropdown, { DropdownOption } from './Dropdown';
import { SkeletonTable, SkeletonButton } from './SkeletonComponents';

interface TeamMember {
  id: number;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  role: string;
  permissions?: {
    can_view: boolean;
    can_modify: boolean;
    can_invite_users: boolean;
    can_manage_payroll?: boolean;
    can_export_data?: boolean;
    can_access_settings?: boolean;
  };
  is_active: boolean;
  date_joined: string;
  is_invited: boolean;
  phone_number?: string;
  department?: string;
  tenant_name: string;
}

interface InvitationData {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  permissions: {
    can_view: boolean;
    can_modify: boolean;
    can_invite_users: boolean;
    can_manage_payroll?: boolean;
    can_export_data?: boolean;
    can_access_settings?: boolean;
  };
}

interface EditingMember {
  id: number;
  role: string;
  permissions: {
    can_view: boolean;
    can_modify: boolean;
    can_invite_users: boolean;
    can_manage_payroll?: boolean;
    can_export_data?: boolean;
    can_access_settings?: boolean;
  };
}

const HRUserInvitation: React.FC = () => {
  // Predefined permission sets for each role
  const rolePermissions = {
    admin: {
      can_view: true,
      can_modify: true,
      can_invite_users: true,
      can_manage_payroll: true,
      can_export_data: true,
      can_access_settings: true
    },
    hr_manager: {
      can_view: true,
      can_modify: true,
      can_invite_users: false, // HR Managers cannot invite other users
      can_manage_payroll: false, // HR Managers cannot manage payroll
      can_export_data: true,
      can_access_settings: true
    }
  };

  // Get permissions for a specific role
  const getPermissionsForRole = (role: string) => {
    return rolePermissions[role as keyof typeof rolePermissions] || rolePermissions.hr_manager;
  };

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [editingMember, setEditingMember] = useState<EditingMember | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | '', text: string }>({ 
    type: '', 
    text: '' 
  });
  
  const [inviteForm, setInviteForm] = useState<InvitationData>({
    email: '',
    first_name: '',
    last_name: '',
    role: 'hr_manager',
    permissions: getPermissionsForRole('hr_manager')
  });

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    loadTeamMembers();
  }, []);

  // Re-sort team members when sort order changes
  useEffect(() => {
    if (teamMembers.length > 0) {
      const sortedMembers = sortTeamMembers(teamMembers, sortOrder);
      setTeamMembers(sortedMembers);
    }
  }, [sortOrder]);

  // Function to sort team members by name
  const sortTeamMembers = (members: TeamMember[], order: 'asc' | 'desc') => {
    return [...members].sort((a, b) => {
      const nameA = (a.full_name || `${a.first_name} ${a.last_name}`).toLowerCase();
      const nameB = (b.full_name || `${b.first_name} ${b.last_name}`).toLowerCase();
      
      if (order === 'asc') {
        return nameA.localeCompare(nameB);
      } else {
        return nameB.localeCompare(nameA);
      }
    });
  };

  const loadTeamMembers = async () => {
    setLoading(true);
    try {
      const response = await apiGet('/api/user-invitations/');
      if (response.ok) {
        const data = await response.json();
        const members = data.results || data;
        const sortedMembers = sortTeamMembers(members, sortOrder);
        setTeamMembers(sortedMembers);
      } else {
        setMessage({ type: 'error', text: 'Failed to load team members' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load team members' });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteForm.email || !inviteForm.first_name || !inviteForm.last_name) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteForm.email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }

    try {
      setInviting(true);
      // Use the new invitation endpoint
      const response = await apiPost('/api/invitations/send-invitation/', {
        email: inviteForm.email,
        first_name: inviteForm.first_name,
        last_name: inviteForm.last_name,
        role: inviteForm.role,
        permissions: inviteForm.permissions
      });

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `Invitation email sent successfully to ${inviteForm.email}! They will receive an email with instructions to set up their account.` 
        });
        setInviteForm({
          email: '',
          first_name: '',
          last_name: '',
          role: 'hr_manager',
          permissions: getPermissionsForRole('hr_manager')
        });
        setShowInviteForm(false);
        // Refresh the team members list
        loadTeamMembers();
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error || 'Failed to send invitation' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send invitation. Please try again.';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setInviting(false);
    }
  };

  const handleDeactivateUser = async (userId: number) => {
    if (!confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) return;

    try {
      const response = await apiDelete('/api/users/' + userId + '/deactivate/');

      if (response.ok) {
        setMessage({ type: 'success', text: 'User deleted successfully' });
        loadTeamMembers();
      } else {
        setMessage({ type: 'error', text: 'Failed to delete user' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete user' });
    }
  };

  const handleEditMember = (member: TeamMember) => {
    setEditingMember({
      id: member.id,
      role: member.role,
      permissions: getPermissionsForRole(member.role)
    });
  };

  // Handle role change in edit form - automatically set permissions
  const handleEditRoleChange = (role: string) => {
    setEditingMember(prev => prev ? {
      ...prev,
      role: role,
      permissions: getPermissionsForRole(role)
    } : null);
  };

  const handleSaveEdit = async () => {
    if (!editingMember) return;

    try {
      const response = await apiPatch(`/api/users/${editingMember.id}/permissions/`, {
        role: editingMember.role,
        permissions: editingMember.permissions
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Member updated successfully' });
        setEditingMember(null);
        loadTeamMembers();
      } else {
        setMessage({ type: 'error', text: 'Failed to update member' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update member' });
    }
  };

  const handleCancelEdit = () => {
    setEditingMember(null);
  };

  // Handle role change in invite form - automatically set permissions
  const handleRoleChange = (role: string) => {
    setInviteForm(prev => ({
      ...prev,
      role: role,
      permissions: getPermissionsForRole(role)
    }));
  };

  const roleOptions: DropdownOption[] = [
    { 
      value: 'admin', 
      label: 'Admin',
      description: 'Full system access - Can manage all employees, payroll, settings, and invite HR managers'
    },
    { 
      value: 'hr_manager', 
      label: 'HR Manager',
      description: 'HR management access - Can manage attendance, employees, team management, and settings'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-end">
        <button
          onClick={() => setShowInviteForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Invite Team Member
        </button>
      </div>

      {/* Status Message */}
      {message.text && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-teal-50 text-teal-700 border border-teal-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
          {message.text}
          <button 
            onClick={() => setMessage({ type: '', text: '' })}
            className="ml-auto text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Invite Team Member</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={inviteForm.first_name}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, first_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={inviteForm.last_name}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, last_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="john.doe@company.com"
                />
              </div>

              <div>
                <Dropdown
                  options={roleOptions}
                  value={inviteForm.role}
                  onChange={handleRoleChange}
                  placeholder="Select Role"
                  label="Role"
                  required
                />
              </div>

              {/* Role Permissions Info */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Role Permissions</h4>
                <div className="text-sm text-gray-600 mb-3">
                  {roleOptions.find(role => role.value === inviteForm.role)?.description}
                </div>
                <div className="space-y-1">
                  {inviteForm.permissions.can_view && (
                    <div className="flex items-center text-xs text-gray-600">
                      <Eye className="w-3 h-3 mr-2" />
                      Can view data and reports
                    </div>
                  )}
                  {inviteForm.permissions.can_modify && (
                    <div className="flex items-center text-xs text-gray-600">
                      <Edit className="w-3 h-3 mr-2" />
                      Can modify data and settings
                    </div>
                  )}
                  {inviteForm.permissions.can_invite_users && (
                    <div className="flex items-center text-xs text-gray-600">
                      <UserPlus className="w-3 h-3 mr-2" />
                      Can invite new team members
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInviteForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInviteUser}
                disabled={inviting}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
              >
                {inviting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {inviting ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Members List */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium">Team Members ({teamMembers.length})</h3>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            title={`Sort by name ${sortOrder === 'asc' ? 'A-Z' : 'Z-A'}`}
          >
            <span className="text-xs">Sort by name:</span>
            <span className="font-medium">{sortOrder === 'asc' ? 'A-Z' : 'Z-A'}</span>
            <svg 
              className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
              <SkeletonButton width="w-32" />
              <SkeletonButton width="w-40" />
            </div>
            
            {/* Table skeleton */}
            <SkeletonTable columns={8} rows={6} />
          </div>
        ) : teamMembers.length === 0 ? (
          <div className="p-8 text-center">
            <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No team members yet</h4>
            <p className="text-gray-500 mb-4">Start by inviting your first team member</p>
            <button
              onClick={() => setShowInviteForm(true)}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              Invite Team Member
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Permissions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teamMembers.map((member) => (
                  <tr key={member.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                          <span className="text-teal-600 font-medium">
                            {(member.full_name || member.first_name || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{member.full_name || `${member.first_name} ${member.last_name}`}</div>
                          <div className="text-sm text-gray-500">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingMember?.id === member.id ? (
                        <Dropdown
                          options={roleOptions}
                          value={editingMember.role}
                          onChange={handleEditRoleChange}
                          placeholder="Select Role"
                          className="w-32"
                        />
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                          {member.role}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingMember?.id === member.id ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 max-w-xs">
                          <div className="text-xs text-gray-600 mb-1">
                            {roleOptions.find(role => role.value === editingMember.role)?.description}
                          </div>
                          <div className="space-y-1">
                            {editingMember.permissions.can_view && (
                              <div className="flex items-center text-xs text-gray-600">
                                <Eye className="w-3 h-3 mr-1" />
                                View
                              </div>
                            )}
                            {editingMember.permissions.can_modify && (
                              <div className="flex items-center text-xs text-gray-600">
                                <Edit className="w-3 h-3 mr-1" />
                                Modify
                              </div>
                            )}
                            {editingMember.permissions.can_invite_users && (
                              <div className="flex items-center text-xs text-gray-600">
                                <UserPlus className="w-3 h-3 mr-1" />
                                Invite
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-1 flex-wrap">
                          {/* Always use role-based permissions for consistent display */}
                          {(() => {
                            // Always use role-based permissions to ensure consistency
                            const permissions = getPermissionsForRole(member.role);
                            
                            const hasAnyPermission = permissions.can_view || permissions.can_modify || permissions.can_invite_users;
                            
                            if (!hasAnyPermission) {
                              return (
                                <span className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                                  {member.role} (no permissions)
                                </span>
                              );
                            }
                            
                            return (
                              <>
                                {permissions.can_view && (
                                  <span className="inline-flex items-center px-2 py-1 text-xs bg-teal-100 text-teal-800 rounded">
                                    <Eye className="w-3 h-3 mr-1" />
                                    View
                                  </span>
                                )}
                                {permissions.can_modify && (
                                  <span className="inline-flex items-center px-2 py-1 text-xs bg-teal-100 text-teal-800 rounded">
                                    <Edit className="w-3 h-3 mr-1" />
                                    Modify
                                  </span>
                                )}
                                {permissions.can_invite_users && (
                                  <span className="inline-flex items-center px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">
                                    <UserPlus className="w-3 h-3 mr-1" />
                                    Invite
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        member.is_active 
                          ? 'bg-teal-100 text-teal-800' 
                          : 'bg-red-100 text-orange-800'
                      }`}>
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {editingMember?.id === member.id ? (
                          <>
                            <button
                              onClick={handleSaveEdit}
                              className="text-teal-600 hover:text-teal-900"
                              title="Save changes"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="text-gray-600 hover:text-gray-900"
                              title="Cancel editing"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            {member.id !== currentUser.id && (
                              <>
                                <button
                                  onClick={() => handleEditMember(member)}
                                  className="text-teal-600 hover:text-teal-900"
                                  title="Edit permissions"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeactivateUser(member.id)}
                                  className="text-red-600 hover:text-red-900"
                                  title={member.is_active ? "Deactivate user" : "Activate user"}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HRUserInvitation; 