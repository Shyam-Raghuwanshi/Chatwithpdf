import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { NativeModules } from 'react-native';
import PdfTextExtractor from '../../utils/PdfTextExtractor';

const { PdfTextExtractorModule } = NativeModules;

interface TestOCRScreenProps {
  onBack: () => void;
}

const TestOCRScreen: React.FC<TestOCRScreenProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [extractedText, setExtractedText] = useState<string>('');
  const [autoStarted, setAutoStarted] = useState(false);

  // Auto-start fast OCR test when component mounts
  useEffect(() => {
    if (!autoStarted) {
      setAutoStarted(true);
      handleFastOCRTest();
    }
  }, [autoStarted]);

  const handleFastOCRTest = async () => {
    setLoading(true);
    setResult('');
    setExtractedText('');
    
    const startTime = Date.now();
    
    try {
      console.log('🔬 Starting Textricator-inspired OCR test...');
      
      // First copy asset to get internal path using the utility class
      const copiedPath = await PdfTextExtractor.copyAssetToInternalStorage('bio.pdf');
      console.log('🔬 Asset copied to:', copiedPath);
      
      // Use the new Textricator-inspired method
      const response = await PdfTextExtractorModule.extractTextWithTextricatorApproach(copiedPath);
      
      const endTime = Date.now();
      const timeTaken = ((endTime - startTime) / 1000).toFixed(2);
      
      console.log('🔬 Textricator OCR response:', response);
      
      if (response.text) {
        setResult(`✅ Textricator-Inspired OCR Success!\n⏱️ Total Time: ${timeTaken}s\n📊 Processing Time: ${response.processingTime}ms\n📄 Pages: ${response.pageCount}\n🔍 Method: ${response.extractionMethod}\n📝 Text Length: ${response.text.length} chars\n🎯 Segments: ${response.segmentCount}`);
        setExtractedText(response.text);
      } else {
        setResult(`❌ Textricator OCR Failed!\n⏱️ Time: ${timeTaken}s\n🚫 Error: No text extracted`);
      }
    } catch (error: any) {
      const endTime = Date.now();
      const timeTaken = ((endTime - startTime) / 1000).toFixed(2);
      console.error('🔬 Textricator OCR test failed:', error);
      setResult(`❌ Textricator OCR Test Failed!\n⏱️ Time: ${timeTaken}s\n🚫 Error: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

    const handleTestPdfCreation = async () => {
    try {
      setLoading(true);
      const result = await NativeModules.PdfTextExtractorModule.createTestPdfAndExtract();
      
      console.log('Test PDF Creation Result:', result);
      const resultText = `Test PDF Creation Result:
        Test PDF Path: ${result.testPdfPath}
        Extracted Text: ${result.text}
        Processing Time: ${result.processingTime}ms
        Page Count: ${result.pageCount}
        Segment Count: ${result.segmentCount}
        Extraction Method: ${result.extractionMethod}`;
      
      setResult(resultText);
      setExtractedText(result.text);
    } catch (error: any) {
      console.error('Test PDF creation failed:', error);
      const errorText = `Test PDF Creation Failed: ${error.message || 'Unknown error occurred'}`;
      setResult(errorText);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectOCRTest = async () => {
    setLoading(true);
    setResult('');
    setExtractedText('');
    
    try {
      console.log("🔬 Starting DIRECT OCR test with bio.pdf...");
      
      // First copy the asset to get the path using the utility class
      const copiedPath = await PdfTextExtractor.copyAssetToInternalStorage('bio.pdf');
      console.log("🔬 Copied bio.pdf to:", copiedPath);
      
      // Call fast OCR method directly
      const startTime = Date.now();
      const response = await PdfTextExtractorModule.extractTextWithFastOCR(copiedPath);
      const endTime = Date.now();
      
      console.log('🔬 Direct OCR result:', response);
      
      if (response.text) {
        const timeTaken = ((endTime - startTime) / 1000).toFixed(2);
        setResult(`✅ OCR SUCCESS (${timeTaken}s)\n\nText Length: ${response.text.length} characters`);
        setExtractedText(response.text);
      } else {
        setResult(`❌ Direct OCR Failed!\nNo text extracted`);
      }
    } catch (error: any) {
      console.error('🔬 Direct OCR error:', error);
      setResult(`❌ OCR ERROR\n${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBasicExtractionTest = async () => {
    setLoading(true);
    setResult('');
    setExtractedText('');
    
    try {
      console.log("🔬 Starting BASIC extraction test with bio.pdf...");
      
      // First copy the asset to get the path using the utility class
      const copiedPath = await PdfTextExtractor.copyAssetToInternalStorage('bio.pdf');
      console.log("🔬 Copied bio.pdf to:", copiedPath);
      
      const startTime = Date.now();
      const response = await PdfTextExtractorModule.extractTextFromPdf(copiedPath);
      const endTime = Date.now();
      
      console.log('🔬 Basic extraction result:', response);
      
      if (response.text) {
        const timeTaken = ((endTime - startTime) / 1000).toFixed(2);
        setResult(`✅ BASIC SUCCESS (${timeTaken}s)\n\nText Length: ${response.text.length} characters`);
        setExtractedText(response.text);
      } else {
        setResult(`❌ BASIC FAILED\nError: No text extracted`);
      }
    } catch (error: any) {
      console.error('🔬 Basic extraction error:', error);
      setResult(`❌ BASIC ERROR\n${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>OCR Test Page</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔬 PDF Extraction Tests</Text>
          <Text style={styles.description}>
            Test different extraction methods with bio.pdf file
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.testButton, styles.fastButton]} 
            onPress={handleFastOCRTest}
            disabled={loading}
          >
            <Text style={styles.buttonText}>🚀 Textricator OCR Test</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.testButton, styles.ocrButton]} 
            onPress={handleDirectOCRTest}
            disabled={loading}
          >
            <Text style={styles.buttonText}>🔍 Direct OCR Test</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.testButton, styles.basicButton]} 
            onPress={handleBasicExtractionTest}
            disabled={loading}
          >
            <Text style={styles.buttonText}>📄 Basic Extraction Test</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.testButton, styles.testPdfButton]} 
            onPress={handleTestPdfCreation}
            disabled={loading}
          >
            <Text style={styles.buttonText}>📝 Test PDF Creation</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Processing PDF...</Text>
          </View>
        )}

        {result && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>📋 Test Result:</Text>
            <ScrollView style={styles.resultScroll}>
              <Text style={styles.resultText}>{result}</Text>
            </ScrollView>
          </View>
        )}

        {extractedText && (
          <View style={styles.textContainer}>
            <Text style={styles.textTitle}>📄 Extracted Text:</Text>
            <ScrollView style={styles.textScroll}>
              <Text style={styles.extractedText}>{extractedText}</Text>
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2c2c2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3c',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#3a3a3c',
    borderRadius: 8,
    marginRight: 16,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    color: '#999',
    fontSize: 14,
    lineHeight: 20,
  },
  buttonContainer: {
    marginBottom: 30,
  },
  testButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  fastButton: {
    backgroundColor: '#32D74B',
  },
  ocrButton: {
    backgroundColor: '#FF6B35',
  },
  basicButton: {
    backgroundColor: '#007AFF',
  },
  testPdfButton: {
    backgroundColor: '#AF52DE',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    color: '#999',
    fontSize: 16,
    marginTop: 12,
  },
  resultContainer: {
    backgroundColor: '#3a3a3c',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  resultTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  resultScroll: {
    maxHeight: 300,
  },
  resultText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  textContainer: {
    backgroundColor: '#3a3a3c',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  textTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  textScroll: {
    maxHeight: 400,
  },
  extractedText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'monospace',
  },
});

export default TestOCRScreen;
