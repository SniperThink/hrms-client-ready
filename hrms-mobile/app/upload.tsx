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
import * as FileSystem from 'expo-file-system/legacy';
import { api } from '@/services/api';
import { API_ENDPOINTS, API_BASE_URL } from '@/constants/Config';
import { storage } from '@/utils/storage';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function DataUploadScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'salary' | 'attendance' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number; type: 'salary' | 'attendance' } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadType, setDownloadType] = useState<'salary' | 'attendance' | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleFilePick = async (type: 'salary' | 'attendance') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size && file.size > maxSize) {
        Alert.alert('Error', 'File size exceeds 10MB limit. Please upload a smaller file.');
        return;
      }

      // Validate file extension
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!validExtensions.includes(fileExtension)) {
        Alert.alert('Error', 'Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV file.');
        return;
      }

      setSelectedFile({
        name: file.name,
        size: file.size || 0,
        type,
      });

      // Confirm before upload
      Alert.alert(
        'Confirm Upload',
        `Upload ${file.name} (${formatFileSize(file.size || 0)})?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setSelectedFile(null) },
          { 
            text: 'Upload', 
            onPress: async () => {
              setUploadType(type);
              await uploadFile(file, type);
            }
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to pick file');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const uploadFile = async (fileAsset: any, type: 'salary' | 'attendance') => {
    setUploading(true);
    setUploadProgress(0);
    
    try {
      // Create FormData for React Native
      const formData = new FormData();
      
      // React Native FormData expects file object with uri, type, and name
      formData.append('file', {
        uri: fileAsset.uri,
        type: fileAsset.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        name: fileAsset.name || 'upload.xlsx',
      } as any);

      // Simulate progress (since React Native doesn't support upload progress easily)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      let response;
      if (type === 'salary') {
        response = await api.upload(API_ENDPOINTS.uploadSalary, formData);
      } else {
        response = await api.upload(API_ENDPOINTS.uploadAttendance, formData);
      }

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Show success message with details
      const message = type === 'salary' 
        ? 'Salary data uploaded and processed successfully'
        : 'Attendance data uploaded and processed successfully';
      
      Alert.alert(
        'Upload Successful',
        message,
        [
          { 
            text: 'OK', 
            onPress: () => {
              setSelectedFile(null);
              setUploadProgress(0);
            }
          }
        ]
      );
    } catch (error: any) {
      setUploadProgress(0);
      
      // Parse error message for better user feedback
      let errorMessage = 'Failed to upload file';
      if (error.message) {
        if (error.message.includes('Network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('401') || error.message.includes('403')) {
          errorMessage = 'Authentication error. Please login again.';
        } else if (error.message.includes('400')) {
          errorMessage = 'Invalid file format or data. Please check the template and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert('Upload Failed', errorMessage);
      setSelectedFile(null);
    } finally {
      setUploading(false);
      setUploadType(null);
    }
  };

  const handleDownloadTemplate = async (type: 'salary' | 'attendance') => {
    setDownloading(true);
    setDownloadType(type);

    try {
      // Get auth token and tenant
      const token = await storage.getAccessToken();
      const tenant = await storage.getTenant();

      if (!token) {
        Alert.alert('Error', 'Please login to download templates');
        setDownloading(false);
        setDownloadType(null);
        return;
      }

      // Template filename
      const fileName = type === 'salary' 
        ? 'salary_template.xlsx' 
        : 'attendance_template.xlsx';

      // Template endpoint
      const templateEndpoint = type === 'salary'
        ? API_ENDPOINTS.downloadSalaryTemplate
        : API_ENDPOINTS.downloadAttendanceTemplate;

      const templateUrl = `${API_BASE_URL}${templateEndpoint}`;

      console.log('Downloading template from:', templateUrl);

      // Prepare headers
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
      };

      if (tenant?.subdomain) {
        headers['X-Tenant-Subdomain'] = tenant.subdomain;
      }

      // Try to download the file
      try {
        // Use app's document directory (guaranteed to have permissions)
        // This is the safest approach that works on both Android and iOS
        const docDir = FileSystem.documentDirectory;
        
        if (!docDir) {
          throw new Error('Unable to access document directory');
        }
        
        const downloadPath = docDir + fileName;
        
        console.log('Downloading to:', downloadPath);
        
        const downloadResult = await FileSystem.downloadAsync(
          templateUrl,
          downloadPath,
          { headers }
        );

        console.log('Download result:', downloadResult);

        if (downloadResult.status === 200) {
          Alert.alert(
            'Download Successful',
            `Template downloaded successfully!\n\nFile: ${fileName}\n\nYou can now fill it out and upload it back.`,
            [
              {
                text: 'OK',
                onPress: () => {
                  console.log('File saved at:', downloadPath);
                }
              }
            ]
          );
        } else {
          throw new Error(`Download failed with status ${downloadResult.status}`);
        }
      } catch (downloadError: any) {
        console.error('FileSystem download error:', downloadError);
        
        // Fallback: Show download URL to user
        Alert.alert(
          'Template Download',
          `Unable to auto-download to Downloads folder.\n\nPlease contact your administrator for the ${type} template file, or try again.`,
          [
            { text: 'OK' }
          ]
        );
      }
    } catch (error: any) {
      console.error('Template download error:', error);
      
      let errorMessage = 'Failed to download template';
      if (error.message) {
        if (error.message.includes('404')) {
          errorMessage = 'Template not found on server. Please contact your administrator.';
        } else if (error.message.includes('Network')) {
          errorMessage = 'Network error. Please check your connection.';
        } else if (error.message.includes('401') || error.message.includes('403')) {
          errorMessage = 'Authentication error. Please login again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert('Download Failed', errorMessage);
    } finally {
      setDownloading(false);
      setDownloadType(null);
      setDownloadProgress(0);
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
        {/* Download Progress Notification */}
        {downloading && (
          <View style={[styles.downloadingCard, { backgroundColor: colors.primary }]}>
            <View style={styles.downloadingContent}>
              <ActivityIndicator color="white" size="small" />
              <Text style={styles.downloadingText}>
                Downloading {downloadType === 'salary' ? 'Salary' : 'Attendance'} Template...
              </Text>
            </View>
          </View>
        )}

        {/* Upload Progress */}
        {uploading && (
          <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <View style={styles.progressHeader}>
              <MaterialIcons name="cloud-upload" size={24} color={colors.primary} />
              <Text style={[styles.progressTitle, { color: colors.text }]}>
                Uploading {uploadType === 'salary' ? 'Salary' : 'Attendance'} Data...
              </Text>
            </View>
            <View style={[styles.progressBarContainer, { backgroundColor: colors.border }]}>
              <View style={[styles.progressBar, { width: `${uploadProgress}%`, backgroundColor: colors.primary }]} />
            </View>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              {uploadProgress}% Complete
            </Text>
          </View>
        )}

        {/* Selected File Info */}
        {selectedFile && !uploading && (
          <View style={[styles.fileInfoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.fileInfoHeader}>
              <MaterialIcons name="insert-drive-file" size={20} color={colors.primary} />
              <Text style={[styles.fileInfoTitle, { color: colors.text }]}>Selected File</Text>
            </View>
            <Text style={[styles.fileName, { color: colors.text }]}>{selectedFile.name}</Text>
            <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
              {formatFileSize(selectedFile.size)}
            </Text>
          </View>
        )}

        {/* Salary Upload */}
        <View style={[styles.uploadCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="attach-money" size={28} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Upload Salary Data</Text>
          </View>
          <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
            Upload Excel file containing salary information for employees
          </Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.downloadButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => handleDownloadTemplate('salary')}
              disabled={uploading || downloading}
            >
              {downloading && downloadType === 'salary' ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <>
                  <MaterialIcons name="download" size={18} color={(uploading || downloading) ? colors.textLight : colors.primary} />
                  <Text style={[styles.downloadButtonText, { color: (uploading || downloading) ? colors.textLight : colors.primary }]}>
                    {downloading && downloadType === 'salary' ? 'Downloading...' : 'Template'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.uploadButton, { backgroundColor: uploading ? colors.border : colors.primary }]}
              onPress={() => handleFilePick('salary')}
              disabled={uploading}
            >
              {uploading && uploadType === 'salary' ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <MaterialIcons name="cloud-upload" size={18} color="white" />
                  <Text style={styles.uploadButtonText}>Upload File</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Attendance Upload */}
        <View style={[styles.uploadCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="event-note" size={28} color={colors.info || '#3b82f6'} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Upload Attendance Data</Text>
          </View>
          <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
            Upload Excel file containing attendance records for employees
          </Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.downloadButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => handleDownloadTemplate('attendance')}
              disabled={uploading || downloading}
            >
              {downloading && downloadType === 'attendance' ? (
                <ActivityIndicator color={colors.info || '#3b82f6'} size="small" />
              ) : (
                <>
                  <MaterialIcons name="download" size={18} color={(uploading || downloading) ? colors.textLight : colors.info || '#3b82f6'} />
                  <Text style={[styles.downloadButtonText, { color: (uploading || downloading) ? colors.textLight : colors.info || '#3b82f6' }]}>
                    {downloading && downloadType === 'attendance' ? 'Downloading...' : 'Template'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.uploadButton, { backgroundColor: uploading ? colors.border : (colors.info || '#3b82f6') }]}
              onPress={() => handleFilePick('attendance')}
              disabled={uploading}
            >
              {uploading && uploadType === 'attendance' ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <MaterialIcons name="cloud-upload" size={18} color="white" />
                  <Text style={styles.uploadButtonText}>Upload File</Text>
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
  progressCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  fileInfoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  fileInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  fileInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
  },
  downloadingCard: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  downloadingContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  downloadingText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});

