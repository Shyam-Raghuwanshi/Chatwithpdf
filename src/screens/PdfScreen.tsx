import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import PdfTextExtractor from '../../utils/PdfTextExtractor';
import DocumentPicker from '../components/DocumentPicker';

const PdfScreen: React.FC = () => {
  const [uploading, setUploading] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [pdfInfo, setPdfInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUploadAndExtract = async () => {
    setUploading(true);
    setExtractedText(null);
    setPdfInfo(null);
    setError(null);
    
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf]
      });

      console.log('Extraction result:', result);
      console.log('File URI:', result?.uri);
      console.log("Starting PDF text extraction...");
      
      const response = await PdfTextExtractor.extractPdfText(result?.uri || '');
      console.log('Extraction response:', response);
      
      setExtractedText(response.text);
      setPdfInfo(response.metadata);
    } catch (e: any) {
      setError(e?.message || String(e));
      Alert.alert('Error', e?.message || 'Failed to extract PDF text');
    } finally {
      setUploading(false);
    }
  };

  const handleClearResults = () => {
    setExtractedText(null);
    setPdfInfo(null);
    setError(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>PDF Text Extraction</Text>
          <Text style={styles.subtitle}>
            Upload and extract text from PDF documents using native iText library
          </Text>
        </View>

        {/* Upload Button */}
        <TouchableOpacity
          style={[styles.uploadButton, uploading && styles.disabledButton]}
          onPress={handleUploadAndExtract}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.uploadButtonText}>📤 Upload & Extract PDF</Text>
          )}
        </TouchableOpacity>

        {/* Loading State */}
        {uploading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Extracting text using iText...</Text>
          </View>
        )}

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>❌ Error</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleUploadAndExtract}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* PDF Info Display */}
        {pdfInfo && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>📄 PDF Information</Text>
            <View style={styles.infoGrid}>
              {pdfInfo.numberOfPages && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Pages:</Text>
                  <Text style={styles.infoValue}>{pdfInfo.numberOfPages}</Text>
                </View>
              )}
              {pdfInfo.title && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Title:</Text>
                  <Text style={styles.infoValue}>{pdfInfo.title}</Text>
                </View>
              )}
              {pdfInfo.author && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Author:</Text>
                  <Text style={styles.infoValue}>{pdfInfo.author}</Text>
                </View>
              )}
              {pdfInfo.fileSize && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Size:</Text>
                  <Text style={styles.infoValue}>
                    {(pdfInfo.fileSize / 1024 / 1024).toFixed(2)} MB
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Extracted Text Display */}
        {extractedText && (
          <View style={styles.textContainer}>
            <View style={styles.textHeader}>
              <Text style={styles.textTitle}>📝 Extracted Text</Text>
              <Text style={styles.textLength}>
                {extractedText.length} characters
              </Text>
            </View>
            <ScrollView style={styles.textScrollView} nestedScrollEnabled>
              <Text style={styles.extractedText}>{extractedText}</Text>
            </ScrollView>
            
            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => {
                  Alert.alert('Feature Coming Soon', 'Text-to-speech feature will be available soon!');
                }}
              >
                <Text style={styles.actionButtonText}>🔊 Read Aloud</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => {
                  Alert.alert('Feature Coming Soon', 'AI chat feature will be available soon!');
                }}
              >
                <Text style={styles.actionButtonText}>🤖 Chat with AI</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Clear Results Button */}
        {(extractedText || pdfInfo || error) && (
          <TouchableOpacity style={styles.clearButton} onPress={handleClearResults}>
            <Text style={styles.clearButtonText}>🗑 Clear Results</Text>
          </TouchableOpacity>
        )}

        {/* Features Info */}
        <View style={styles.featuresInfo}>
          <Text style={styles.featuresTitle}>✨ Features</Text>
          <Text style={styles.featuresText}>
            • High-quality PDF text extraction using native iText library{'\n'}
            • Support for complex PDF layouts and fonts{'\n'}
            • Metadata extraction (title, author, page count, etc.){'\n'}
            • Better performance than Python-based solutions{'\n'}
            • Built specifically for React Native Android
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    backgroundColor: '#FFE6E6',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D70015',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#D70015',
    lineHeight: 20,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  textContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  textHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  textTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  textLength: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  textScrollView: {
    maxHeight: 300,
    marginBottom: 16,
  },
  extractedText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#34C759',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#FF9500',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  featuresInfo: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  featuresText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default PdfScreen;
