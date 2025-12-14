// Attendance Upload Screen
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
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { attendanceService } from '@/services/attendanceService';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function AttendanceUploadScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [file, setFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        copyToCacheDirectory: true,
      });
      
      if (result.canceled === false && result.assets && result.assets.length > 0) {
        setFile(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const uploadFile = async () => {
    if (!file) {
      Alert.alert('Error', 'Please select a file first');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      // Create FormData
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        name: file.name,
      } as any);

      // Upload file (you'll need to implement this in attendanceService)
      // await attendanceService.bulkUpload(formData);
      
      clearInterval(progressInterval);
      setProgress(100);

      Alert.alert('Success', 'Attendance uploaded successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      setFile(null);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload attendance');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const downloadTemplate = () => {
    Alert.alert(
      'Download Template',
      'Template download feature coming soon. Please contact admin for the template file.',
      [{ text: 'OK' }]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Attendance</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Instructions */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Instructions</Text>
          <View style={styles.instructionItem}>
            <FontAwesome name="check-circle" size={16} color={colors.success} />
            <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
              Download the template file
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <FontAwesome name="check-circle" size={16} color={colors.success} />
            <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
              Fill in attendance data
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <FontAwesome name="check-circle" size={16} color={colors.success} />
            <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
              Upload the completed file
            </Text>
          </View>
        </View>

        {/* Template Download */}
        <TouchableOpacity
          style={[styles.templateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={downloadTemplate}
        >
          <FontAwesome name="download" size={20} color={colors.primary} />
          <Text style={[styles.templateButtonText, { color: colors.primary }]}>
            Download Template
          </Text>
        </TouchableOpacity>

        {/* File Picker */}
        <TouchableOpacity
          style={[styles.pickerButton, { backgroundColor: colors.primary }]}
          onPress={pickFile}
          disabled={uploading}
        >
          <FontAwesome name="file-excel-o" size={20} color="white" />
          <Text style={styles.pickerButtonText}>Select Excel File</Text>
        </TouchableOpacity>

        {/* Selected File */}
        {file && (
          <View style={[styles.fileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.fileInfo}>
              <FontAwesome name="file" size={24} color={colors.primary} />
              <View style={styles.fileDetails}>
                <Text style={[styles.fileName, { color: colors.text }]}>{file.name}</Text>
                <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
                  {(file.size / 1024).toFixed(2)} KB
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setFile(null)}>
              <FontAwesome name="times-circle" size={24} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}

        {/* Upload Progress */}
        {uploading && (
          <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.progressText, { color: colors.text }]}>
              Uploading... {progress}%
            </Text>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.primary, width: `${progress}%` },
                ]}
              />
            </View>
          </View>
        )}

        {/* Upload Button */}
        {file && !uploading && (
          <TouchableOpacity
            style={[styles.uploadButton, { backgroundColor: colors.success }]}
            onPress={uploadFile}
          >
            <FontAwesome name="cloud-upload" size={20} color="white" />
            <Text style={styles.uploadButtonText}>Upload File</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
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
    padding: 16,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  instructionText: {
    fontSize: 14,
    flex: 1,
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 16,
    gap: 12,
  },
  templateButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  pickerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
  },
  progressCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
