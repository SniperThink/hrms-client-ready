import React, { useState } from 'react';
import { 
  Search, Users, CheckCircle, XCircle, 
  Clock, TrendingUp, ChevronLeft, ChevronRight, Plus
} from 'lucide-react';
import CustomDateInput from './CustomDateInput';
import Dropdown, { DropdownOption } from './Dropdown';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#4A90E2', '#50E3C2', '#F5A623', '#FF5252', '#8E44AD'];

interface LeaveRequest {
  id: number;
  employeeName: string;
  department: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  duration: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
}

const HRLeaveManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [showLeaveForm, setShowLeaveForm] = useState<boolean>(false);
  const [leaveStartDate, setLeaveStartDate] = useState<string>('');
  const [leaveEndDate, setLeaveEndDate] = useState<string>('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>('');
  const itemsPerPage = 8;

  // Dropdown options
  const employeeOptions: DropdownOption[] = [
    { value: '', label: 'Select Employee' },
    { value: '1', label: 'John Smith' },
    { value: '2', label: 'Sarah Williams' },
    { value: '3', label: 'Mike Johnson' },
    { value: '4', label: 'Emily Davis' }
  ];

  const leaveTypeOptions: DropdownOption[] = [
    { value: '', label: 'Select Leave Type' },
    { value: 'sick', label: 'Sick Leave' },
    { value: 'casual', label: 'Casual Leave' },
    { value: 'annual', label: 'Annual Leave' },
    { value: 'maternity', label: 'Maternity Leave' },
    { value: 'paternity', label: 'Paternity Leave' }
  ];

  // Mock leave data
  const leaveRequests: LeaveRequest[] = [
    {
      id: 1,
      employeeName: 'John Smith',
      department: 'Engineering',
      leaveType: 'Sick Leave',
      startDate: '2023-07-15',
      endDate: '2023-07-16',
      duration: 2,
      reason: 'Not feeling well',
      status: 'approved'
    },
    {
      id: 2,
      employeeName: 'Sarah Williams',
      department: 'Finance',
      leaveType: 'Casual Leave',
      startDate: '2023-07-20',
      endDate: '2023-07-22',
      duration: 3,
      reason: 'Family function',
      status: 'pending'
    },
    {
      id: 3,
      employeeName: 'Michael Brown',
      department: 'Engineering',
      leaveType: 'Annual Leave',
      startDate: '2023-08-01',
      endDate: '2023-08-10',
      duration: 10,
      reason: 'Vacation',
      status: 'pending'
    },
    {
      id: 4,
      employeeName: 'Jessica Jones',
      department: 'Marketing',
      leaveType: 'Sick Leave',
      startDate: '2023-07-12',
      endDate: '2023-07-12',
      duration: 1,
      reason: 'Doctor appointment',
      status: 'approved'
    },
    {
      id: 5,
      employeeName: 'David Johnson',
      department: 'Engineering',
      leaveType: 'Casual Leave',
      startDate: '2023-07-18',
      endDate: '2023-07-18',
      duration: 1,
      reason: 'Personal work',
      status: 'rejected'
    }
  ];

  // Create summary stats
  const leaveSummary = [
    {
      title: 'Pending Requests',
      value: leaveRequests.filter(req => req.status === 'pending').length,
      icon: Clock,
      color: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
      trend: '+2',
      trendUp: true
    },
    {
      title: 'Approved Leaves',
      value: leaveRequests.filter(req => req.status === 'approved').length,
      icon: CheckCircle,
      color: 'bg-teal-50',
      iconColor: 'text-teal-600',
      trend: '+1',
      trendUp: true
    },
    {
      title: 'Rejected Leaves',
      value: leaveRequests.filter(req => req.status === 'rejected').length,
      icon: XCircle,
      color: 'bg-red-50',
      iconColor: 'text-red-500',
      trend: '0',
      trendUp: false
    },
    {
      title: 'Total Employees',
      value: 120,
      icon: Users,
        color: 'bg-teal-50',
        iconColor: 'text-teal-600',
      trend: '0',
      trendUp: false
    }
  ];

  // Leave type distribution for chart
  const leaveTypeData = [
    { name: 'Sick Leave', value: 25 },
    { name: 'Casual Leave', value: 18 },
    { name: 'Annual Leave', value: 12 },
    { name: 'Maternity Leave', value: 2 },
    { name: 'Paternity Leave', value: 1 }
  ];

  // Department leave distribution for chart
  const departmentLeaveData = [
    { department: 'HR', count: 5 },
    { department: 'Engineering', count: 22 },
    { department: 'Design', count: 10 },
    { department: 'Marketing', count: 8 },
    { department: 'Finance', count: 13 }
  ];

  // Calculate rounded max and ticks for Department Leave Distribution
  const maxLeaveCount = Math.max(...departmentLeaveData.map(item => item.count));
  const roundedMaxLeaveCount = Math.ceil(maxLeaveCount / 5) * 5;
  const yAxisTicksLeave = [0, roundedMaxLeaveCount * 0.25, roundedMaxLeaveCount * 0.5, roundedMaxLeaveCount * 0.75, roundedMaxLeaveCount];

  // Filter leave requests based on tab and search
  const filteredLeaveRequests = leaveRequests.filter(req => {
    const matchesSearch = 
      req.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.leaveType.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    return req.status === activeTab && matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredLeaveRequests.length / itemsPerPage);
  const paginatedLeaveRequests = filteredLeaveRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{
      name?: string;
      value?: number;
      color?: string;
      fill?: string;
    }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-md rounded">
          <p className="font-semibold">{label || payload[0].name}</p>
          {payload.map((entry, index: number) => (
            <p key={index} style={{ color: entry.color || entry.fill }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {leaveSummary.map((card, index) => (
          <div key={index} className={`${card.color} p-5 rounded-lg shadow-sm border border-gray-100`}>
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-gray-500 text-sm">{card.title}</h3>
              <card.icon size={18} className={card.iconColor} />
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-semibold">{card.value}</span>
              <span className={`${card.trendUp ? 'text-teal-500' : 'text-gray-500'} text-sm flex items-center`}>
                {card.trendUp ? <TrendingUp size={16} className="mr-1" /> : null}
                {card.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Leave Type Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="font-semibold mb-4">Leave Type Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={leaveTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  fill="#8884d8"
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {leaveTypeData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Department Leave Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="font-semibold mb-4">Department Leave Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentLeaveData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="department" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false}
                  domain={[0, roundedMaxLeaveCount]}
                  ticks={yAxisTicksLeave}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Leave Count" fill="#4A90E2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <div className="flex space-x-2">
            <button
              className={`px-4 py-2 rounded-md text-sm ${
                activeTab === 'all' ? 'bg-[#0B5E59] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setActiveTab('all')}
            >
              All Requests
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm ${
                activeTab === 'pending' ? 'bg-[#0B5E59] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setActiveTab('pending')}
            >
              Pending
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm ${
                activeTab === 'approved' ? 'bg-[#0B5E59] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setActiveTab('approved')}
            >
              Approved
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm ${
                activeTab === 'rejected' ? 'bg-[#0B5E59] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setActiveTab('rejected')}
            >
              Rejected
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search..."
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-teal-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              className="flex items-center gap-2 text-sm px-3 py-2 bg-[#0B5E59] hover:bg-[#0a5350] rounded-md text-white"
              onClick={() => setShowLeaveForm(true)}
            >
              <Plus size={16} />
              Create Request
            </button>
          </div>
        </div>

        {/* Leave Requests Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 border-b">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Leave Type</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Start Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedLeaveRequests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{request.id}</td>
                  <td className="px-4 py-3 font-medium">{request.employeeName}</td>
                  <td className="px-4 py-3">{request.department}</td>
                  <td className="px-4 py-3">{request.leaveType}</td>
                  <td className="px-4 py-3">{request.duration} day{request.duration > 1 ? 's' : ''}</td>
                  <td className="px-4 py-3">{request.startDate}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                      request.status === 'approved' ? 'bg-teal-100 text-teal-800' : 
                      'bg-red-100 text-red-800'
                    }`}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {request.status === 'pending' ? (
                      <div className="flex justify-end space-x-2">
                        <button className="text-xs px-2 py-1 bg-teal-50 text-teal-600 hover:bg-teal-100 rounded">
                          Approve
                        </button>
                        <button className="text-xs px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded">
                          Reject
                        </button>
                      </div>
                    ) : (
                      <button className="text-sm text-teal-600 hover:underline">
                        View Details
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6">
            <div className="text-sm text-gray-500">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLeaveRequests.length)} of {filteredLeaveRequests.length} entries
            </div>
            <div className="flex space-x-1">
              <button
                className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`w-8 h-8 rounded-md ${
                    currentPage === page
                      ? 'bg-[#0B5E59] text-white'
                      : 'hover:bg-gray-100'
                  }`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Leave Request Form Modal (would normally be a separate component) */}
      {showLeaveForm && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Leave Request</h3>
            <form className="space-y-4">
              <div>
                <Dropdown
                  options={employeeOptions}
                  value={selectedEmployee}
                  onChange={setSelectedEmployee}
                  label="Employee"
                  required
                />
              </div>

              <div>
                <Dropdown
                  options={leaveTypeOptions}
                  value={selectedLeaveType}
                  onChange={setSelectedLeaveType}
                  label="Leave Type"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <CustomDateInput
                    value={leaveStartDate}
                    onChange={setLeaveStartDate}
                    placeholder="Select start date"
                    maxDate={leaveEndDate ? new Date(leaveEndDate) : undefined}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <CustomDateInput
                    value={leaveEndDate}
                    onChange={setLeaveEndDate}
                    placeholder="Select end date"
                    minDate={leaveStartDate ? new Date(leaveStartDate) : undefined}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea 
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  rows={3}
                ></textarea>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button 
                  type="button"
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setShowLeaveForm(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-[#0B5E59] text-white rounded-md text-sm hover:bg-[#0a5350]"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRLeaveManagement; 