import React from 'react';
import { Platform, NativeModules } from 'react-native';

const { SimpleDocumentPicker } = NativeModules;

/**
 * Simple document picker component that works with React Native 0.81
 * Uses platform-specific native intent system on Android
 */
class DocumentPicker {
  static types = {
    allFiles: '*/*',
    images: 'image/*',
    plainText: 'text/plain',
    audio: 'audio/*',
    pdf: 'application/pdf',
    zip: 'application/zip',
    csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  static async pick(options = {}) {
    try {
      if (Platform.OS === 'android' && SimpleDocumentPicker) {
        const result = await SimpleDocumentPicker.pickDocument();
        return [result];
      } else {
        // For iOS or if native module is not available, return null
        // You can implement iOS native module similarly if needed
        console.warn('Document picker not available on this platform');
        return null;
      }
    } catch (error) {
      if (error.message === 'User cancelled') {
        return null;
      }
      throw error;
    }
  }
  
  static async pickSingle(options = {}) {
    const result = await this.pick(options);
    return result ? result[0] : null;
  }
}

export default DocumentPicker;
