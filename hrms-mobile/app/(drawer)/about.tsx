// About Screen - Company Information
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
// Check if running in development or production
const isProduction = process.env.NODE_ENV === 'production';

// Update check functionality
const checkForUpdates = async () => {
  if (!isProduction) {
    alert('Update check is only available in production builds.');
    return false;
  }

  try {
    // Try to import expo-updates dynamically
    const { default: Updates } = await import('expo-updates');
    
    if (!Updates) {
      throw new Error('expo-updates module not found');
    }

    const update = await Updates.checkForUpdateAsync();
    
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      alert('Update downloaded! Restart the app to apply the latest changes.');
      return true;
    } else {
      alert('You are using the latest version of the app.');
      return false;
    }
  } catch (error) {
    console.error('Update check failed:', error);
    
    // Provide more specific error messages
    if (error?.message?.includes('expo-updates')) {
      alert('Update functionality is not available in this environment.');
    } else {
      alert('Failed to check for updates. Please try again later.');
    }
    
    return false;
  }
};

const AboutScreen = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [isChecking, setIsChecking] = React.useState(false);

  const handleCheckForUpdates = async () => {
    if (!isProduction) {
      alert('Update check is only available in production builds.');
      return;
    }
    
    try {
      setIsChecking(true);
      await checkForUpdates();
    } catch (error) {
      console.error('Error in update check:', error);
      alert('An error occurred while checking for updates.');
    } finally {
      setIsChecking(false);
    }
  };

  const companyInfo = {
    name: 'SniperThink - HR Management System',
    version: '1.0.0',
    description: 'AI-Driven Automation for Teams. SniperThink is a growth operating system that helps businesses bring all their scattered data and first-touch sales conversations into one platform. Our six-layer system gives you visibility, alerts, forecasts, and reports, while our AI agents qualify and segment leads 24/7.',
    mission: 'Bring clarity to every business decision before it\'s too late.',
    website: 'https://www.sniperthink.com',
    email: 'info@sniperthink.com',
    phone: '+91 98717 52812',
    address: '1st FLOOR, C-25, C Block, Sector 8, Noida, Uttar Pradesh 201301',
    
    features: [
      'AI-Powered Lead Qualification',
      'Real-time KPIs & Alerts',
      'Predictive Insights',
      'Seamless Integration',
      '24/7 AI Agents',
      'Data Security',
      'Growth Analytics',
      'Automated Reporting',
    ],
    
    values: [
      { icon: 'lightbulb-o', title: 'Clarity', description: 'Providing clear insights for better decision making' },
      { icon: 'rocket', title: 'Innovation', description: 'Leveraging AI to drive business growth' },
      { icon: 'shield', title: 'Security', description: 'Enterprise-grade protection for your data' },
      { icon: 'bolt', title: 'Efficiency', description: 'Automating processes to save time and resources' },
    ],
  };

  const handleContactPress = (type: string, value: string) => {
    switch (type) {
      case 'email':
        Linking.openURL(`mailto:${value}`);
        break;
      case 'phone':
        Linking.openURL(`tel:${value}`);
        break;
      case 'website':
        Linking.openURL(value);
        break;
      case 'address':
        Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(value)}`);
        break;
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with Logo */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View style={styles.logoContainer}>
          <View style={[styles.logoPlaceholder, { backgroundColor: 'white' }]}>
            <FontAwesome name="building" size={48} color={colors.primary} />
          </View>
        </View>
        <Text style={styles.companyName}>{companyInfo.name}</Text>
        <Text style={styles.version}>Version {companyInfo.version}</Text>
      </View>

      {/* Company Description */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>About Us</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {companyInfo.description}
        </Text>
        
        <View style={[styles.missionContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FontAwesome name="quote-left" size={20} color={colors.primary} />
          <Text style={[styles.missionText, { color: colors.text }]}>{companyInfo.mission}</Text>
          <FontAwesome name="quote-right" size={20} color={colors.primary} style={styles.quoteRight} />
        </View>
      </View>

      {/* Key Features */}
      {/* <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Key Features</Text>
        <View style={styles.featuresGrid}>
          {companyInfo.features.map((feature, index) => (
            <View key={index} style={[styles.featureItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <FontAwesome name="check-circle" size={16} color={colors.success} />
              <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
            </View>
          ))}
        </View>
      </View> */}

      {/* Company Values */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Our Values</Text>
        {companyInfo.values.map((value, index) => (
          <View key={index} style={[styles.valueItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.valueIcon, { backgroundColor: colors.primary }]}>
              <FontAwesome name={value.icon as any} size={20} color="white" />
            </View>
            <View style={styles.valueContent}>
              <Text style={[styles.valueTitle, { color: colors.text }]}>{value.title}</Text>
              <Text style={[styles.valueDescription, { color: colors.textSecondary }]}>
                {value.description}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Contact Information */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Us</Text>
        
        <TouchableOpacity
          style={[styles.contactItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => handleContactPress('website', companyInfo.website)}
        >
          <FontAwesome name="globe" size={20} color={colors.primary} />
          <View style={styles.contactContent}>
            <Text style={[styles.contactLabel, { color: colors.text }]}>Website</Text>
            <Text style={[styles.contactValue, { color: colors.textSecondary }]}>{companyInfo.website}</Text>
          </View>
          <FontAwesome name="chevron-right" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.contactItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => handleContactPress('email', companyInfo.email)}
        >
          <FontAwesome name="envelope" size={20} color={colors.primary} />
          <View style={styles.contactContent}>
            <Text style={[styles.contactLabel, { color: colors.text }]}>Email</Text>
            <Text style={[styles.contactValue, { color: colors.textSecondary }]}>{companyInfo.email}</Text>
          </View>
          <FontAwesome name="chevron-right" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.contactItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => handleContactPress('phone', companyInfo.phone)}
        >
          <FontAwesome name="phone" size={20} color={colors.primary} />
          <View style={styles.contactContent}>
            <Text style={[styles.contactLabel, { color: colors.text }]}>Phone</Text>
            <Text style={[styles.contactValue, { color: colors.textSecondary }]}>{companyInfo.phone}</Text>
          </View>
          <FontAwesome name="chevron-right" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.contactItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => handleContactPress('address', companyInfo.address)}
        >
          <FontAwesome name="map-marker" size={20} color={colors.primary} />
          <View style={styles.contactContent}>
            <Text style={[styles.contactLabel, { color: colors.text }]}>Address</Text>
            <Text style={[styles.contactValue, { color: colors.textSecondary }]}>{companyInfo.address}</Text>
          </View>
          <FontAwesome name="chevron-right" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Social Links */}
      <View style={[styles.section, { alignItems: 'center' }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Connect With Us</Text>
        <View style={styles.socialIcons}>
          <TouchableOpacity 
            style={[styles.socialIcon, { backgroundColor: colors.primary }]}
            onPress={() => Linking.openURL('https://facebook.com/sniperthink')}
          >
            <FontAwesome name="facebook" size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.socialIcon, { backgroundColor: colors.primary }]}
            onPress={() => Linking.openURL('https://instagram.com/sniperthink')}
          >
            <FontAwesome name="instagram" size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.socialIcon, { backgroundColor: colors.primary }]}
            onPress={() => Linking.openURL('https://linkedin.com/company/sniperthink')}
          >
            <FontAwesome name="linkedin" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Update Check */}
      <View style={[styles.section, { alignItems: 'center' }]}>
        <TouchableOpacity 
          style={[styles.updateButton, { backgroundColor: colors.primary }]}
          onPress={handleCheckForUpdates}
          disabled={isChecking}
        >
          <FontAwesome name="refresh" size={16} color="white" style={isChecking ? styles.rotate : null} />
          <Text style={styles.updateButtonText}>
            {isChecking ? 'Checking for Updates...' : 'Check for Updates'}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.versionText, { color: colors.textSecondary }]}>
          Version {companyInfo.version}
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          © {new Date().getFullYear()} {companyInfo.name}. All rights reserved.
        </Text>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          Analyze • Automate • Accelerate
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  missionContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  missionText: {
    flex: 1,
    fontSize: 16,
    fontStyle: 'italic',
    marginHorizontal: 12,
    textAlign: 'center',
  },
  quoteRight: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  socialIcons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 16,
  },
  socialIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginBottom: 8,
    width: '80%',
    alignSelf: 'center',
  },
  updateButtonText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '600',
  },
  versionText: {
    fontSize: 12,
    marginTop: 4,
  },
  rotate: {
    transform: [{ rotate: '360deg' }],
  },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyName: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  version: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  foundedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  foundedText: {
    fontSize: 14,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    width: '48%',
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  valueItem: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  valueIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  valueContent: {
    flex: 1,
  },
  valueTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  valueDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  contactContent: {
    flex: 1,
    marginLeft: 16,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
});

export default AboutScreen;
