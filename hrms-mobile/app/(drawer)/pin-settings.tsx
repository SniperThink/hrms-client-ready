// PIN Settings Screen for Mobile
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '@/services/authService';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function PINSettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [pinStatus, setPinStatus] = useState({
    has_pin: false,
    pin_enabled: false,
    is_locked: false,
    locked_until: null as string | null,
  });
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);

  // Setup PIN states
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Refs for PIN inputs
  const pinInputRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

  const confirmPinInputRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

  useEffect(() => {
    fetchPINStatus();
  }, []);

  const fetchPINStatus = async () => {
    try {
      const status = await authService.getPINStatus();
      setPinStatus(status);
    } catch (err) {
      console.error('Error fetching PIN status:', err);
    }
  };

  const handlePinChange = (index: number, value: string, isConfirm: boolean = false) => {
    if (value && !/^\d$/.test(value)) return;

    const currentPin = isConfirm ? [...confirmPin] : [...pin];
    currentPin[index] = value;

    if (isConfirm) {
      setConfirmPin(currentPin);
    } else {
      setPin(currentPin);
    }

    // Auto-focus next input
    if (value && index < 3) {
      const refs = isConfirm ? confirmPinInputRefs : pinInputRefs;
      refs[index + 1].current?.focus();
    }
  };

  const handleSetupPIN = async () => {
    const pinValue = pin.join('');
    const confirmPinValue = confirmPin.join('');

    if (pinValue.length !== 4) {
      Alert.alert('Error', 'Please enter a 4-digit PIN');
      return;
    }

    if (pinValue !== confirmPinValue) {
      Alert.alert('Error', 'PINs do not match');
      return;
    }

    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.setupPIN(pinValue, password);

      if (response.success) {
        Alert.alert('Success', 'PIN setup successfully!');
        setShowSetup(false);
        setPin(['', '', '', '']);
        setConfirmPin(['', '', '', '']);
        setPassword('');
        await fetchPINStatus();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to setup PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleDisablePIN = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.disablePIN(password);

      if (response.success) {
        Alert.alert('Success', 'PIN authentication disabled');
        setShowDisable(false);
        setPassword('');
        await fetchPINStatus();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to disable PIN');
    } finally {
      setLoading(false);
    }
  };

  if (showSetup) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowSetup(false)} style={styles.backButton}>
              <FontAwesome name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {pinStatus.pin_enabled ? 'Change PIN' : 'Setup PIN'}
            </Text>
          </View>

          <View style={styles.content}>
            {/* New PIN */}
            <Text style={[styles.label, { color: colors.text }]}>Enter New PIN</Text>
            <View style={styles.pinContainer}>
              {pin.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={pinInputRefs[index]}
                  style={[styles.pinInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
                  value={digit}
                  onChangeText={(value) => handlePinChange(index, value, false)}
                  keyboardType="numeric"
                  returnKeyType="done"
                  maxLength={1}
                  secureTextEntry
                  selectTextOnFocus
                  autoComplete="off"
                  textContentType="oneTimeCode"
                />
              ))}
            </View>

            {/* Confirm PIN */}
            <Text style={[styles.label, { color: colors.text }]}>Confirm PIN</Text>
            <View style={styles.pinContainer}>
              {confirmPin.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={confirmPinInputRefs[index]}
                  style={[styles.pinInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
                  value={digit}
                  onChangeText={(value) => handlePinChange(index, value, true)}
                  keyboardType="numeric"
                  returnKeyType="done"
                  maxLength={1}
                  secureTextEntry
                  selectTextOnFocus
                  autoComplete="off"
                  textContentType="oneTimeCode"
                />
              ))}
            </View>

            {/* Password */}
            <Text style={[styles.label, { color: colors.text }]}>Current Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.passwordInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.textLight}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <FontAwesome name={showPassword ? 'eye-slash' : 'eye'} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Buttons */}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#176d67' }, loading && styles.buttonDisabled]}
              onPress={handleSetupPIN}
              disabled={loading || pin.some(d => !d) || confirmPin.some(d => !d) || !password}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (showDisable) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowDisable(false)} style={styles.backButton}>
              <FontAwesome name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Disable PIN</Text>
          </View>

          <View style={styles.content}>
            <View style={[styles.warningBox, { backgroundColor: '#fef3c7', borderColor: '#fbbf24' }]}>
              <Text style={[styles.warningText, { color: '#92400e' }]}>
                Are you sure you want to disable PIN authentication? This will remove the extra layer of security from your account.
              </Text>
            </View>

            {/* Password */}
            <Text style={[styles.label, { color: colors.text }]}>Current Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.passwordInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.textLight}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <FontAwesome name={showPassword ? 'eye-slash' : 'eye'} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Buttons */}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#ef4444' }, loading && styles.buttonDisabled]}
              onPress={handleDisablePIN}
              disabled={loading || !password}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Disable PIN</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>PIN Authentication</Text>
      </View>

      <View style={styles.content}>
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statusHeader}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: pinStatus.pin_enabled ? '#10b981' : '#6b7280' }]}>
              <Text style={styles.statusBadgeText}>
                {pinStatus.pin_enabled ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
          </View>
          <Text style={[styles.statusDescription, { color: colors.textSecondary }]}>
            {pinStatus.pin_enabled
              ? 'PIN authentication is active. You will be asked to enter your PIN after logging in with your password.'
              : 'PIN authentication is not enabled. Enable it for an extra layer of security.'}
          </Text>
        </View>

        {/* Locked Warning */}
        {pinStatus.is_locked && (
          <View style={[styles.warningBox, { backgroundColor: '#fee2e2', borderColor: '#ef4444' }]}>
            <FontAwesome name="exclamation-circle" size={20} color="#ef4444" />
            <Text style={[styles.warningText, { color: '#991b1b' }]}>
              PIN Locked. Too many failed attempts. Please try again later.
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        {!pinStatus.pin_enabled ? (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#176d67' }]}
            onPress={() => setShowSetup(true)}
          >
            <FontAwesome name="lock" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Enable PIN Authentication</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#176d67' }]}
              onPress={() => setShowSetup(true)}
            >
              <Text style={styles.actionButtonText}>Change PIN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ef4444' }]}
              onPress={() => setShowDisable(true)}
            >
              <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>Disable PIN Authentication</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  statusCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statusDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 16,
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  pinInput: {
    width: 50,
    height: 50,
    borderWidth: 2,
    borderRadius: 8,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 8,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
