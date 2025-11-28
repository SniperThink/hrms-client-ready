import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, AlertCircle, CheckCircle, Clock, X, Paperclip, File, Download, Loader2 } from 'lucide-react';
import { apiCall, apiUpload } from '../services/api';
import { logger } from '../utils/logger';

interface Ticket {
  id: number;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
  attachment?: string;
  attachment_url?: string;
  admin_response?: string | null;
  created_by?: {
    id: number;
    email: string;
    name?: string;
  };
}

const HRSupport: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedTickets, setExpandedTickets] = useState<Set<number>>(new Set());

  // Get user info to check if superuser
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperUser = user?.is_superuser || false;

  // Form state
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent'
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Fetch tickets
  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/api/support/tickets/');
      
      if (response.ok) {
        const data = await response.json();
        setTickets(Array.isArray(data) ? data : data.results || []);
      } else {
        // If endpoint doesn't exist, use empty array (for now)
        if (response.status === 404) {
          setTickets([]);
        } else {
          throw new Error('Failed to fetch tickets');
        }
      }
    } catch (err) {
      logger.error('Error fetching tickets:', err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!formData.subject.trim() || !formData.description.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      let response: Response;
      
      // If file is selected, use FormData for multipart upload
      if (selectedFile) {
        const formDataToSend = new FormData();
        formDataToSend.append('subject', formData.subject.trim());
        formDataToSend.append('description', formData.description.trim());
        formDataToSend.append('priority', formData.priority);
        formDataToSend.append('attachment', selectedFile);
        
        response = await apiUpload('/api/support/tickets/', formDataToSend);
      } else {
        // No file, use JSON
        response = await apiCall('/api/support/tickets/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subject: formData.subject.trim(),
            description: formData.description.trim(),
            priority: formData.priority,
          }),
        });
      }

      if (response.ok) {
        try {
          const newTicket = await response.json();
          setTickets(prev => [newTicket, ...prev]);
          setSuccess('Ticket created successfully!');
          setFormData({ subject: '', description: '', priority: 'medium' });
          setSelectedFile(null);
          setShowForm(false);
          
          // Refresh tickets list to get updated data
          await fetchTickets();
          
          // Clear success message after 3 seconds
          setTimeout(() => setSuccess(null), 3000);
        } catch (jsonError) {
          logger.error('Error parsing response JSON:', jsonError);
          // Even if JSON parsing fails, ticket might be created
          setSuccess('Ticket submitted! Please refresh to see it.');
          setFormData({ subject: '', description: '', priority: 'medium' });
          setSelectedFile(null);
          setShowForm(false);
          await fetchTickets();
        }
      } else {
        let errorMessage = 'Failed to create ticket';
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = typeof errorData.error === 'string' 
              ? errorData.error 
              : JSON.stringify(errorData.error);
          } else if (errorData.detail) {
            errorMessage = errorData.detail;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          logger.error('Error parsing error response:', parseError);
          errorMessage = `Server error (${response.status}). Please try again.`;
        }
        setError(errorMessage);
      }
    } catch (err) {
      logger.error('Error creating ticket:', err);
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to create ticket. Please try again.';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Error boundary - prevent white screen
  if (error && !showForm && tickets.length === 0 && !loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="text-center py-12">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Support</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              fetchTickets();
            }}
            className="px-4 py-2 bg-[#1A6262] text-white rounded-lg hover:bg-[#155252]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Support Tickets</h1>
            <p className="text-sm text-gray-600 mt-1">Raise and track support tickets</p>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setError(null);
              setSuccess(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1A6262] text-white rounded-lg hover:bg-[#155252] transition-colors"
          >
            <MessageSquare size={18} />
            {showForm ? 'Cancel' : 'Raise Ticket'}
          </button>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <CheckCircle className="text-green-600" size={20} />
            <span className="text-green-800">{success}</span>
            <button
              onClick={() => setSuccess(null)}
              className="ml-auto text-green-600 hover:text-green-800"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="text-red-600" size={20} />
            <span className="text-red-800">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Ticket Form */}
        {showForm && (
          <div className="mb-6 p-6 bg-gray-50 border border-gray-200 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Ticket</h2>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Enter ticket subject"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs text-gray-500 font-normal">
                    ({formData.description.length} characters)
                  </span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your issue or request in detail..."
                  rows={8}
                  maxLength={5000}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                  required
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-500">
                    You can provide detailed information. Long descriptions are supported.
                  </p>
                  <p className={`text-xs ${formData.description.length > 4000 ? 'text-orange-600' : 'text-gray-500'}`}>
                    {formData.description.length}/5000
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Attachment (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <label className={`flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg ${submitting && selectedFile ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}>
                    {submitting && selectedFile ? (
                      <Loader2 size={18} className="text-teal-600 animate-spin" />
                    ) : (
                      <Paperclip size={18} className="text-gray-600" />
                    )}
                    <span className="text-sm text-gray-700">
                      {submitting && selectedFile ? 'Uploading...' : (selectedFile ? selectedFile.name : 'Choose File')}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      disabled={submitting}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Check file size (max 10MB)
                          if (file.size > 10 * 1024 * 1024) {
                            setError('File size must be less than 10MB');
                            return;
                          }
                          setSelectedFile(file);
                          setError(null);
                        }
                      }}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt,.csv,.xlsx,.xls"
                    />
                  </label>
                  {selectedFile && !submitting && (
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="px-3 py-2 text-sm text-red-600 hover:text-red-800"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Supported formats: PDF, DOC, DOCX, JPG, PNG, GIF, TXT, CSV, XLSX (Max 10MB)
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ subject: '', description: '', priority: 'medium' });
                    setSelectedFile(null);
                    setError(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1A6262] text-white rounded-lg hover:bg-[#155252] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Submit Ticket
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tickets List */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">My Tickets</h2>
          
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
              <MessageSquare className="mx-auto text-gray-400 mb-3" size={48} />
              <p className="text-gray-600 mb-2">No tickets found</p>
              <p className="text-sm text-gray-500">Click "Raise Ticket" to create your first support ticket</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-5 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{ticket.subject}</h3>
                      <div className="text-sm text-gray-600">
                        {expandedTickets.has(ticket.id) ? (
                          <div>
                            <p className="whitespace-pre-wrap break-words">{ticket.description}</p>
                            {isSuperUser && ticket.attachment_url && (
                              <div className="mt-3 flex items-center gap-2">
                                <File size={16} className="text-teal-600" />
                                <a
                                  href={ticket.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-teal-600 hover:text-teal-800 text-sm font-medium flex items-center gap-1"
                                >
                                  <Download size={14} />
                                  View Attachment
                                </a>
                              </div>
                            )}
                            {ticket.admin_response && (
                              <div className="mt-4 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                  <CheckCircle size={16} className="text-teal-600" />
                                  <h4 className="font-semibold text-teal-900 text-sm">Admin Response:</h4>
                                </div>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{ticket.admin_response}</p>
                              </div>
                            )}
                            <button
                              onClick={() => {
                                const newExpanded = new Set(expandedTickets);
                                newExpanded.delete(ticket.id);
                                setExpandedTickets(newExpanded);
                              }}
                              className="text-teal-600 hover:text-teal-800 text-xs mt-2 font-medium"
                            >
                              Show Less
                            </button>
                          </div>
                        ) : (
                          <div>
                            <p className={ticket.description.length > 200 ? 'line-clamp-3' : ''}>
                              {ticket.description}
                            </p>
                            {isSuperUser && ticket.attachment_url && (
                              <div className="mt-2 flex items-center gap-2">
                                <File size={14} className="text-teal-600" />
                                <a
                                  href={ticket.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-teal-600 hover:text-teal-800 text-xs font-medium flex items-center gap-1"
                                >
                                  <Download size={12} />
                                  View Attachment
                                </a>
                              </div>
                            )}
                            {ticket.admin_response && (
                              <div className="mt-3 p-2.5 bg-teal-50 border border-teal-200 rounded-lg">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <CheckCircle size={14} className="text-teal-600" />
                                  <h4 className="font-semibold text-teal-900 text-xs">Admin Response:</h4>
                                </div>
                                <p className="text-xs text-gray-700 line-clamp-2">{ticket.admin_response}</p>
                              </div>
                            )}
                            {(ticket.description.length > 200 || ticket.admin_response) && (
                              <button
                                onClick={() => {
                                  const newExpanded = new Set(expandedTickets);
                                  newExpanded.add(ticket.id);
                                  setExpandedTickets(newExpanded);
                                }}
                                className="text-teal-600 hover:text-teal-800 text-xs mt-1 font-medium"
                              >
                                Show More
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                        {ticket.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>Created: {formatDate(ticket.created_at)}</span>
                      </div>
                      {ticket.updated_at !== ticket.created_at && (
                        <div className="flex items-center gap-1">
                          <span>Updated: {formatDate(ticket.updated_at)}</span>
                        </div>
                      )}
                    </div>
                    {ticket.created_by && (
                      <div className="text-sm text-gray-500">
                        By: {ticket.created_by.name || ticket.created_by.email}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HRSupport;

