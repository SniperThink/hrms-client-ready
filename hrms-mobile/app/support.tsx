// Support Screen
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { supportService } from '@/services/supportService';
import { SupportTicket } from '@/services/supportService';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format } from 'date-fns';

export default function SupportScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
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
        <Text style={styles.headerTitle}>Support</Text>
        <TouchableOpacity
          onPress={() => setShowForm(!showForm)}
          style={styles.addButton}
        >
          <FontAwesome name={showForm ? "times" : "plus"} size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Create Ticket Form */}
      {showForm && (
        <View style={[styles.formContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.text }]}>Create Support Ticket</Text>
          
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="Subject"
            placeholderTextColor={colors.textLight}
            value={formData.subject}
            onChangeText={(text) => setFormData({ ...formData, subject: text })}
          />

          <TextInput
            style={[styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="Describe your issue..."
            placeholderTextColor={colors.textLight}
            value={formData.message}
            onChangeText={(text) => setFormData({ ...formData, message: text })}
            multiline
            numberOfLines={4}
          />

          <View style={styles.priorityButtons}>
            {['low', 'medium', 'high'].map((priority) => (
              <TouchableOpacity
                key={priority}
                style={[
                  styles.priorityButton,
                  {
                    backgroundColor: formData.priority === priority ? colors.primary : colors.background,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setFormData({ ...formData, priority })}
              >
                <Text
                  style={[
                    styles.priorityText,
                    {
                      color: formData.priority === priority ? 'white' : colors.text,
                      fontWeight: formData.priority === priority ? '600' : 'normal',
                    },
                  ]}
                >
                  {priority.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.primary }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Ticket</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Tickets List */}
      <ScrollView style={styles.ticketsList}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : tickets.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome name="question-circle" size={48} color={colors.textLight} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No support tickets yet
            </Text>
          </View>
        ) : (
          tickets.map((ticket) => (
            <View
              key={ticket.id}
              style={[styles.ticketCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.ticketHeader}>
                <Text style={[styles.ticketSubject, { color: colors.text }]}>
                  {ticket.subject}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ticket.status) }]}>
                  <Text style={styles.statusText}>{ticket.status.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={[styles.ticketMessage, { color: colors.textSecondary }]} numberOfLines={2}>
                {ticket.message}
              </Text>
              <View style={styles.ticketFooter}>
                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(ticket.priority) }]}>
                  <Text style={styles.priorityBadgeText}>{ticket.priority.toUpperCase()}</Text>
                </View>
                <Text style={[styles.ticketDate, { color: colors.textLight }]}>
                  {format(new Date(ticket.created_at), 'MMM dd, yyyy')}
                </Text>
              </View>
              {ticket.admin_response && (
                <View style={[styles.adminResponse, { backgroundColor: colors.background }]}>
                  <Text style={[styles.adminResponseLabel, { color: colors.textSecondary }]}>
                    Admin Response:
                  </Text>
                  <Text style={[styles.adminResponseText, { color: colors.text }]}>
                    {ticket.admin_response}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  addButton: {
    padding: 8,
  },
  formContainer: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
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
    gap: 8,
    marginBottom: 16,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  priorityText: {
    fontSize: 12,
  },
  submitButton: {
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  ticketsList: {
    flex: 1,
    padding: 16,
  },
  ticketCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  ticketSubject: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
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
  ticketMessage: {
    fontSize: 14,
    marginBottom: 12,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
  },
  adminResponseLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  adminResponseText: {
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
});

