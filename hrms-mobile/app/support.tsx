// Support Screen - Redesigned with Modern UI
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supportService } from '@/services/supportService';
import { SupportTicket } from '@/services/supportService';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { format } from 'date-fns';

export default function SupportScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    priority: 'medium',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await supportService.getTickets(1);
      setTickets(response.results || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTickets();
    setRefreshing(false);
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ticket.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' ||
                      (activeTab === 'open' && ticket.status !== 'resolved' && ticket.status !== 'closed') ||
                      (activeTab === 'resolved' && (ticket.status === 'resolved' || ticket.status === 'closed'));
    return matchesSearch && matchesTab;
  });

  const ticketCounts = {
    all: tickets.length,
    open: tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
  };

  const handleSubmit = async () => {
    if (!formData.subject || !formData.message) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      await supportService.createTicket(formData);
      Alert.alert('Success', 'Ticket created successfully', [
        { text: 'OK', onPress: () => {
          setShowForm(false);
          setFormData({ subject: '', message: '', priority: 'medium' });
          loadTickets();
        }},
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return colors.success;
      case 'in_progress': return colors.info;
      case 'closed': return colors.textLight;
      default: return colors.warning;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return colors.error;
      case 'medium': return colors.warning;
      default: return colors.info;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color="white" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Support Center</Text>
          <Text style={styles.headerSubtitle}>We're here to help</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowForm(!showForm)}
          style={styles.addButton}
        >
          <FontAwesome name={showForm ? "times" : "plus"} size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      {!showForm && (
        <View style={[styles.quickActions, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[styles.quickActionButton, { borderColor: colors.border }]}
            onPress={() => Linking.openURL('mailto:support@company.com')}
          >
            <MaterialIcons name="email" size={24} color={colors.primary} />
            <Text style={[styles.quickActionText, { color: colors.text }]}>Email Us</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionButton, { borderColor: colors.border }]}
            onPress={() => Linking.openURL('tel:+1234567890')}
          >
            <MaterialIcons name="phone" size={24} color={colors.primary} />
            <Text style={[styles.quickActionText, { color: colors.text }]}>Call Us</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionButton, { borderColor: colors.border }]}
            onPress={() => setShowForm(true)}
          >
            <MaterialIcons name="add-circle" size={24} color={colors.primary} />
            <Text style={[styles.quickActionText, { color: colors.text }]}>New Ticket</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Bar */}
      {!showForm && (
        <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
          <MaterialIcons name="search" size={20} color={colors.textLight} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search tickets..."
            placeholderTextColor={colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={20} color={colors.textLight} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Tabs */}
      {!showForm && (
        <View style={[styles.tabsContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {(['all', 'open', 'resolved'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                activeTab === tab && [styles.activeTab, { borderBottomColor: colors.primary }]
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab ? colors.primary : colors.textSecondary },
                  activeTab === tab && styles.activeTabText
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              <View style={[
                styles.tabBadge,
                { backgroundColor: activeTab === tab ? colors.primary : colors.border }
              ]}>
                <Text style={[
                  styles.tabBadgeText,
                  { color: activeTab === tab ? 'white' : colors.textSecondary }
                ]}>
                  {ticketCounts[tab]}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Create Ticket Form */}
      {showForm && (
        <ScrollView
          style={styles.formScrollView}
          contentContainerStyle={styles.formScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.formContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.formHeader}>
              <MaterialIcons name="support-agent" size={32} color={colors.primary} />
              <Text style={[styles.formTitle, { color: colors.text }]}>Create Support Ticket</Text>
              <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>Describe your issue and we'll help you resolve it</Text>
            </View>
          
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Subject *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Brief description of your issue"
                placeholderTextColor={colors.textLight}
                value={formData.subject}
                onChangeText={(text) => setFormData({ ...formData, subject: text })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Message *</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Provide detailed information about your issue..."
                placeholderTextColor={colors.textLight}
                value={formData.message}
                onChangeText={(text) => setFormData({ ...formData, message: text })}
                multiline
                numberOfLines={6}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Priority Level</Text>
              <View style={styles.priorityButtons}>
                {[
                  { value: 'low', label: 'Low', icon: 'arrow-downward', color: '#10b981' },
                  { value: 'medium', label: 'Medium', icon: 'remove', color: '#f59e0b' },
                  { value: 'high', label: 'High', icon: 'arrow-upward', color: '#ef4444' },
                ].map((priority) => (
                  <TouchableOpacity
                    key={priority.value}
                    style={[
                      styles.priorityButton,
                      {
                        backgroundColor: formData.priority === priority.value ? priority.color : colors.background,
                        borderColor: formData.priority === priority.value ? priority.color : colors.border,
                      },
                    ]}
                    onPress={() => setFormData({ ...formData, priority: priority.value })}
                  >
                    <MaterialIcons
                      name={priority.icon as any}
                      size={16}
                      color={formData.priority === priority.value ? 'white' : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.priorityText,
                        {
                          color: formData.priority === priority.value ? 'white' : colors.text,
                          fontWeight: formData.priority === priority.value ? '600' : 'normal',
                        },
                      ]}
                    >
                      {priority.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <MaterialIcons name="send" size={20} color="white" />
                  <Text style={styles.submitButtonText}>Submit Ticket</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Tickets List */}
      {!showForm && (
        <ScrollView
          style={styles.ticketsList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading tickets...</Text>
            </View>
          ) : filteredTickets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="support-agent" size={64} color={colors.textLight} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {searchQuery ? 'No tickets found' : 'No support tickets yet'}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery ? 'Try adjusting your search' : 'Create your first ticket to get help'}
              </Text>
              {!searchQuery && (
                <TouchableOpacity
                  style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                  onPress={() => setShowForm(true)}
                >
                  <MaterialIcons name="add" size={20} color="white" />
                  <Text style={styles.emptyButtonText}>Create Ticket</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredTickets.map((ticket) => (
              <TouchableOpacity
                key={ticket.id}
                style={[styles.ticketCard, { backgroundColor: colors.surface, borderLeftColor: getStatusColor(ticket.status) }]}
                activeOpacity={0.7}
              >
                {/* Ticket Header */}
                <View style={styles.ticketHeader}>
                  <View style={styles.ticketTitleRow}>
                    <Text style={[styles.ticketSubject, { color: colors.text }]} numberOfLines={1}>
                      {ticket.subject}
                    </Text>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(ticket.status) }]} />
                  </View>
                  <View style={styles.ticketMetaRow}>
                    <View style={styles.ticketMetaItem}>
                      <MaterialIcons name="schedule" size={12} color={colors.textLight} />
                      <Text style={[styles.ticketMetaText, { color: colors.textLight }]}>
                        {format(new Date(ticket.created_at), 'MMM dd, yyyy')}
                      </Text>
                    </View>
                    <View style={styles.ticketMetaDivider} />
                    <View style={styles.ticketMetaItem}>
                      <MaterialIcons 
                        name={ticket.priority === 'high' ? 'arrow-upward' : ticket.priority === 'low' ? 'arrow-downward' : 'remove'} 
                        size={12} 
                        color={getPriorityColor(ticket.priority)} 
                      />
                      <Text style={[styles.ticketMetaText, { color: getPriorityColor(ticket.priority) }]}>
                        {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Ticket Message */}
                <Text style={[styles.ticketMessage, { color: colors.textSecondary }]} numberOfLines={2}>
                  {ticket.message}
                </Text>

                {/* Ticket Footer */}
                <View style={styles.ticketFooter}>
                  <View style={[styles.statusChip, { backgroundColor: getStatusColor(ticket.status) + '15', borderColor: getStatusColor(ticket.status) + '30' }]}>
                    <Text style={[styles.statusChipText, { color: getStatusColor(ticket.status) }]}>
                      {ticket.status.replace('_', ' ')}
                    </Text>
                  </View>
                  {ticket.admin_response && (
                    <View style={styles.responseChip}>
                      <MaterialIcons name="mark-chat-read" size={12} color={colors.primary} />
                      <Text style={[styles.responseChipText, { color: colors.primary }]}>Replied</Text>
                    </View>
                  )}
                </View>

                {/* Admin Response */}
                {ticket.admin_response && (
                  <View style={[styles.adminResponse, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '20' }]}>
                    <View style={styles.adminResponseHeader}>
                      <View style={[styles.adminAvatarCircle, { backgroundColor: colors.primary }]}>
                        <MaterialIcons name="support-agent" size={12} color="white" />
                      </View>
                      <Text style={[styles.adminResponseLabel, { color: colors.text }]}>
                        Support Team
                      </Text>
                    </View>
                    <Text style={[styles.adminResponseText, { color: colors.text }]}>
                      {ticket.admin_response}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  addButton: {
    padding: 8,
  },
  quickActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: '600',
  },
  tabBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  formScrollView: {
    flex: 1,
  },
  formScrollContent: {
    padding: 16,
  },
  formContainer: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  priorityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    gap: 6,
  },
  priorityText: {
    fontSize: 13,
    fontWeight: '500',
  },
  submitButton: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  ticketsList: {
    flex: 1,
    padding: 16,
  },
  ticketCard: {
    padding: 12,
    paddingLeft: 16,
    borderRadius: 10,
    borderLeftWidth: 3,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  ticketHeader: {
    marginBottom: 8,
  },
  ticketTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ticketSubject: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginLeft: 6,
  },
  ticketMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ticketMetaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  ticketMetaDivider: {
    width: 1,
    height: 10,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 8,
  },
  ticketMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  ticketFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  responseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  responseChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  ticketDate: {
    fontSize: 12,
  },
  adminResponse: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  adminAvatarCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminResponseLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  adminResponseText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    alignItems: 'center',
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  ticketHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ticketIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketHeaderInfo: {
    flex: 1,
  },
  ticketMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  responseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  responseText: {
    fontSize: 12,
    fontWeight: '500',
  },
  adminResponseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
});

