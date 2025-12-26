// Login Screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppDispatch } from '@/store/hooks';
import { setUser, setTenant } from '@/store/slices/authSlice';
import { authService, LoginCredentials } from '@/services/authService';
import { storage } from '@/utils/storage';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import SniperThinkLogo from '@/components/SniperThinkLogo';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const savedUser = await storage.getUser();
      const savedTenant = await storage.getTenant();
      const accessToken = await storage.getAccessToken();
      
      if (savedUser && savedTenant && accessToken) {
        console.log('Found existing session for:', savedUser.email);
        
        // Check if PIN is required
        try {
          const pinCheck = await authService.checkPINRequired(savedUser.email);
          
          if (pinCheck.pin_required) {
            console.log('Existing session - navigating to PIN entry');
            // Navigate directly to PIN entry
            const userName = savedUser.name || 
                            `${savedUser.first_name || ''} ${savedUser.last_name || ''}`.trim() || 
                            savedUser.email?.split('@')[0] || 
                            'User';
            const companyName = savedTenant.name || '';
            
            router.replace({
              pathname: '/(auth)/pin-entry',
              params: {
                email: savedUser.email,
                userName,
                companyName,
                existingSession: 'true',
              },
            });
            return;
          }
        } catch (err) {
          console.log('PIN check failed for existing session:', err);
        }
        
        // No PIN required - go directly to dashboard
        dispatch(setUser(savedUser));
        dispatch(setTenant(savedTenant));
        router.replace('/(drawer)');
        return;
      }
    } catch (error) {
      console.log('No existing session found');
    } finally {
      setCheckingSession(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const credentials: LoginCredentials = {
        email,
        password,
      };

      console.log('Attempting login for:', email);
      
      // Retry logic for first-time connection issues
      let response;
      let retries = 0;
      const maxRetries = 2;
      
      while (retries < maxRetries) {
        try {
          response = await authService.login(credentials);
          console.log('Login successful, got response');
          break;
        } catch (loginError: any) {
          retries++;
          console.log(`Login attempt ${retries} failed:`, loginError.message);
          console.log('Error details:', JSON.stringify(loginError, null, 2));
          
          if (retries >= maxRetries) {
            throw loginError;
          }
          
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log('Retrying login...');
        }
      }
      
      if (!response) {
        throw new Error('Login failed after retries');
      }

      // Small delay to ensure login is fully processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if PIN is required
      try {
        console.log('Checking PIN requirement for:', email);
        const pinCheck = await authService.checkPINRequired(email);
        console.log('PIN check result:', pinCheck);
        
        if (pinCheck.pin_required) {
          console.log('PIN required - navigating to PIN entry screen');
          // Navigate to PIN entry screen with temp data
          const userName = response.user?.name || 
                          `${response.user?.first_name || ''} ${response.user?.last_name || ''}`.trim() || 
                          response.user?.email?.split('@')[0] || 
                          'User';
          const companyName = response.tenant?.name || '';
          
          router.push({
            pathname: '/(auth)/pin-entry',
            params: {
              email,
              userName,
              companyName,
              tempLoginData: JSON.stringify(response),
            },
          });
          setLoading(false);
          return;
        } else {
          console.log('PIN not required - proceeding to dashboard');
        }
      } catch (err) {
        console.error('Error checking PIN requirement:', err);
        // Continue with normal login if PIN check fails
        // This allows login to work even if PIN feature is not available on backend
        console.warn('PIN check failed, proceeding with normal login');
      }

      // No PIN required - complete login
      dispatch(setUser(response.user));
      dispatch(setTenant(response.tenant));

      // Navigate to main app
      router.replace('/(drawer)');
    } catch (error: any) {
      // Handle different error types
      let errorMessage = 'Invalid email or password';
      
      if (error.message) {
        if (error.message.includes('SESSION_INVALID') || error.message.includes('session')) {
          errorMessage = 'Session error occurred. Please try logging in again.';
        } else if (error.message.includes('already_logged_in')) {
          errorMessage = 'You are already logged in on another device.';
        } else if (error.message.includes('credits')) {
          errorMessage = 'Company account has no credits. Please contact support.';
        } else if (error.message.includes('verified')) {
          errorMessage = 'Email not verified. Please check your email.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Show loading screen while checking for existing session
  if (checkingSession) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#176d67" />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.content, { backgroundColor: colors.background }]}>
          {/* Logo and Title */}
          <View style={styles.header}>
            <SniperThinkLogo size={60} color="#176d67" marginBottom={32} />
            <Text style={[styles.title, { color: '#176d67' }]}>SniperThink HRMS</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Analyze. Automate. Accelerate.
            </Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Welcome back! Please login to continue.
            </Text>
          </View>

          {/* Login Form */}
          <View style={styles.form}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder="Enter your email"
                placeholderTextColor={colors.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.passwordInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textLight}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <FontAwesome 
                    name={showPassword ? 'eye-slash' : 'eye'} 
                    size={20} 
                    color={colors.textLight} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password */}
            <View style={styles.forgotPasswordContainer}>
              <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
                <Text style={[styles.forgotPassword, { color: '#176d67' }]}>
                  Forgot password?
                </Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: '#176d67' }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={styles.signupContainer}>
              <Text style={[styles.signupText, { color: colors.textSecondary }]}>
                New to SniperThink?{' '}
              </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                <Text style={[styles.signupLink, { color: '#176d67' }]}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingRight: 48,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 4,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPassword: {
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: 14,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});

