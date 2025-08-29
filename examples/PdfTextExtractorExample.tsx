import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import PdfTextExtractor from '../utils/PdfTextExtractor';
import type { PdfExtractionResult, PdfInfoResult } from '../types/PdfTextExtractor';

const PdfTextExtractorExample = () => {
  const [extractedText, setExtractedText] = useState<string>('');
  const [pdfInfo, setPdfInfo] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  

  const extractFromAsset = async () => {
    setLoading(true);
    try {
      // Extract from a PDF asset file named 'set.pdf'
      const result: PdfExtractionResult = await PdfTextExtractor.extractFromAsset('set.pdf');
      
      if (result.success) {
        setExtractedText(result.text);
        setPdfInfo(result.metadata);
        Alert.alert('Success', 'Text extracted successfully using iText library!');
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to extract text: ${error}`);
    } finally {
      setLoading(false);
    } 
  };

  const extractFromSpecificPage = async () => {
    setLoading(true);
    try {
      // Extract from page 1 of the asset PDF
      const copiedPath = await PdfTextExtractor.copyAssetToInternalStorage('set.pdf');
      const result: PdfExtractionResult = await PdfTextExtractor.extractPdfTextFromPage(copiedPath, 1);
      
      if (result.success) {
        setExtractedText(result.text);
        setPdfInfo(result.metadata);
        Alert.alert('Success', `Text extracted from page ${result.page} using iText library!`);
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to extract text from page: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const getPdfInformation = async () => {
    setLoading(true);
    try {
      const copiedPath = await PdfTextExtractor.copyAssetToInternalStorage('set.pdf');
      const result: PdfInfoResult = await PdfTextExtractor.getPdfInfo(copiedPath);
      
      if (result.success) {
        setPdfInfo(result.metadata);
        Alert.alert('Success', 'PDF information retrieved using iText library!');
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to get PDF info: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const validatePdf = async () => {
    setLoading(true);
    try {
      const copiedPath = await PdfTextExtractor.copyAssetToInternalStorage('set.pdf');
      const validation = await PdfTextExtractor.validatePdfFile(copiedPath);
      
      if (validation.isValid) {
        Alert.alert('Validation Success', 'PDF file is valid and readable!');
      } else {
        Alert.alert('Validation Failed', validation.error || 'PDF file is invalid');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to validate PDF: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>PDF Text Extractor (iText)</Text>
      <Text style={styles.subtitle}>Native Android module using iText library</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={extractFromAsset}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Extract Full Text</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={extractFromSpecificPage}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Extract Page 1</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.infoButton]} 
          onPress={getPdfInformation}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Get PDF Info</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.validateButton]} 
          onPress={validatePdf}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Validate PDF</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Processing PDF...</Text>
        </View>
      )}

      {pdfInfo && (
        <View style={styles.infoContainer}>
          <Text style={styles.sectionTitle}>PDF Information:</Text>
          <Text style={styles.infoText}>Pages: {pdfInfo.numberOfPages}</Text>
          <Text style={styles.infoText}>File Size: {pdfInfo.fileSize} bytes</Text>
          <Text style={styles.infoText}>PDF Version: {pdfInfo.pdfVersion}</Text>
          {pdfInfo.title && <Text style={styles.infoText}>Title: {pdfInfo.title}</Text>}
          {pdfInfo.author && <Text style={styles.infoText}>Author: {pdfInfo.author}</Text>}
          {pdfInfo.creator && <Text style={styles.infoText}>Creator: {pdfInfo.creator}</Text>}
          <Text style={styles.infoText}>Encrypted: {pdfInfo.isEncrypted ? 'Yes' : 'No'}</Text>
        </View>
      )}

      {extractedText ? (
        <View style={styles.textContainer}>
          <Text style={styles.sectionTitle}>Extracted Text:</Text>
          <ScrollView style={styles.textScrollView}>
            <Text style={styles.extractedText}>{extractedText}</Text>
          </ScrollView>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
    fontStyle: 'italic',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#34C759',
  },
  infoButton: {
    backgroundColor: '#FF9500',
  },
  validateButton: {
    backgroundColor: '#5856D6',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  infoContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#555',
  },
  textContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  textScrollView: {
    maxHeight: 300,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 10,
  },
  extractedText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
});

export default PdfTextExtractorExample;
