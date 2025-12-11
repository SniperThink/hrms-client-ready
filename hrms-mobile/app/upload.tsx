// Data Upload Screen
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '@/services/api';
import { API_ENDPOINTS } from '@/constants/Config';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function DataUploadScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'salary' | 'attendance' | null>(null);

  const handleFilePick = async (type: 'salary' | 'attendance') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      setUploadType(type);
      await uploadFile(result.assets[0], type);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to pick file');
    }
  };

  const uploadFile = async (fileAsset: any, type: 'salary' | 'attendance') => {
    setUploading(true);
    try {
      // Create FormData for React Native
      const formData = new FormData();
      
      // React Native FormData expects file object with uri, type, and name
      formData.append('file', {
        uri: fileAsset.uri,
        type: fileAsset.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        name: fileAsset.name || 'upload.xlsx',
      } as any);

      if (type === 'salary') {
        await api.upload(API_ENDPOINTS.uploadSalary, formData);
        Alert.alert('Success', 'Salary data uploaded successfully');
      } else {
        await api.upload(API_ENDPOINTS.uploadAttendance, formData);
        Alert.alert('Success', 'Attendance data uploaded successfully');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload file');
    } finally {
      setUploading(false);
      setUploadType(null);
    }
  };

  const handleDownloadTemplate = async (type: 'salary' | 'attendance') => {
    try {
      // Download template - this would need proper file download handling
      Alert.alert('Info', 'Template download feature coming soon');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to download template');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data Upload</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Salary Upload */}
        <View style={[styles.uploadCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <FontAwesome name="file-excel-o" size={24} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Upload Salary Data</Text>
          </View>
          <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
            Upload Excel file containing salary information for employees
          </Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.downloadButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => handleDownloadTemplate('salary')}
            >
              <FontAwesome name="download" size={16} color={colors.primary} />
              <Text style={[styles.downloadButtonText, { color: colors.primary }]}>Template</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.uploadButton, { backgroundColor: colors.primary }]}
              onPress={() => handleFilePick('salary')}
              disabled={uploading}
            >
              {uploading && uploadType === 'salary' ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <FontAwesome name="upload" size={16} color="white" />
                  <Text style={styles.uploadButtonText}>Upload</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Attendance Upload */}
        <View style={[styles.uploadCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <FontAwesome name="calendar" size={24} color={colors.info} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Upload Attendance Data</Text>
          </View>
          <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
            Upload Excel file containing attendance records
          </Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.downloadButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => handleDownloadTemplate('attendance')}
            >
              <FontAwesome name="download" size={16} color={colors.primary} />
              <Text style={[styles.downloadButtonText, { color: colors.primary }]}>Template</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.uploadButton, { backgroundColor: colors.info }]}
              onPress={() => handleFilePick('attendance')}
              disabled={uploading}
            >
              {uploading && uploadType === 'attendance' ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <FontAwesome name="upload" size={16} color="white" />
                  <Text style={styles.uploadButtonText}>Upload</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Instructions */}
        <View style={[styles.instructionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.instructionsTitle, { color: colors.text }]}>Instructions</Text>
          <Text style={[styles.instructionsText, { color: colors.textSecondary }]}>
            1. Download the template file{'\n'}
            2. Fill in the required data{'\n'}
            3. Save the file as Excel (.xlsx){'\n'}
            4. Upload the file using the upload button{'\n'}
            5. Wait for the upload to complete
          </Text>
        </View>

        <View style={{ height: 32 }} />
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
  content: {
    flex: 1,
    padding: 16,
  },
  uploadCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  downloadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  instructionsCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 24,
  },
});

