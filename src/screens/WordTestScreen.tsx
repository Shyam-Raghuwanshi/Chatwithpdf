import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import WordTextExtractor from '../../utils/WordTextExtractor';
import DocumentPicker from '../components/DocumentPicker';
import { FONT_FAMILY } from '../../utils/FontConfig';

interface WordTestScreenProps {
  onBack: () => void;
}

const WordTestScreen: React.FC<WordTestScreenProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [extractionResult, setExtractionResult] = useState<any>(null);

  const runWordTest = async () => {
    setLoading(true);
    setTestResult('');
    setExtractionResult(null);
    
    try {
      // Test if Word extraction is available
      const testResult = await WordTextExtractor.testExtraction();
      
      // Get supported formats
      const formatsInfo = await WordTextExtractor.getSupportedFormats();
      
      const result = `✅ Word Text Extraction Test Results\n\n` +
        `Module Available: ${WordTextExtractor.isAvailable() ? 'Yes' : 'No'}\n` +
        `POI Available: ${testResult.poiAvailable ? 'Yes' : 'No'}\n` +
        `Status: ${testResult.status}\n\n` +
        `📋 Supported Formats:\n` +
        `- Library: ${formatsInfo.library} v${formatsInfo.version}\n` +
        `- .doc files: ${formatsInfo.docReader}\n` +
        `- .docx files: ${formatsInfo.docxReader}\n` +
        `- Formats: ${formatsInfo.formats.join(', ')}\n\n` +
        `🔧 Technical Details:\n` +
        `- HWPF Version: ${testResult.hwpfVersion}\n` +
        `- XWPF Version: ${testResult.xwpfVersion}`;
      
      setTestResult(result);
      
    } catch (error: any) {
      console.error('Word test failed:', error);
      setTestResult(`❌ Word Test Failed\n\n${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testDocumentExtraction = async () => {
    setLoading(true);
    setExtractionResult(null);
    
    try {
      console.log("Starting Word document picker...");

      // Use document picker to select Word document from device
      const selectedDocument = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.doc, DocumentPicker.types.docx],
      });

      if (!selectedDocument) {
        setLoading(false);
        return;
      }

      console.log("Selected Word document:", selectedDocument);

      // Copy the content URI to internal storage
      const internalPath = await WordTextExtractor.copyContentUriToInternalStorage(selectedDocument.uri);
      console.log("Word document copied to internal storage:", internalPath);

      // Extract text using Apache POI
      const result = await WordTextExtractor.extractText(internalPath);
      console.log("Word extraction result:", result);

      setExtractionResult(result);
      
      Alert.alert(
        'Extraction Complete!',
        `Successfully extracted ${result.textLength} characters from ${result.fileType.toUpperCase()} file.\n\n` +
        `Processing time: ${result.processingTime}ms\n` +
        `Method: ${result.extractionMethod}`,
        [{ text: 'OK' }]
      );
      
    } catch (error: any) {
      console.error('Word extraction test failed:', error);
      Alert.alert('Extraction Failed', error.message);
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
        <Text style={styles.title}>Word Text Extraction Test</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Word Extraction Module</Text>
          <Text style={styles.sectionDescription}>
            Test if Apache POI Word text extraction is working properly
          </Text>
          
          <TouchableOpacity
            style={[styles.testButton, loading && styles.disabledButton]}
            onPress={runWordTest}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.testButtonText}>Run Module Test</Text>
            )}
          </TouchableOpacity>

          {testResult ? (
            <View style={styles.resultContainer}>
              <Text style={styles.resultText}>{testResult}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Document Extraction</Text>
          <Text style={styles.sectionDescription}>
            Select a Word document (.doc or .docx) to test text extraction
          </Text>
          
          <TouchableOpacity
            style={[styles.testButton, styles.secondaryButton, loading && styles.disabledButton]}
            onPress={testDocumentExtraction}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text style={styles.secondaryButtonText}>Select Word Document</Text>
            )}
          </TouchableOpacity>

          {extractionResult ? (
            <View style={styles.resultContainer}>
              <Text style={styles.resultTitle}>📄 Extraction Results</Text>
              <Text style={styles.resultText}>
                File Type: {extractionResult.fileType.toUpperCase()}{'\n'}
                Text Length: {extractionResult.textLength} characters{'\n'}
                Processing Time: {extractionResult.processingTime}ms{'\n'}
                Method: {extractionResult.extractionMethod}
                {extractionResult.paragraphCount && `\nParagraphs: ${extractionResult.paragraphCount}`}
                {extractionResult.tableCount && `\nTables: ${extractionResult.tableCount}`}
              </Text>
              
              <Text style={styles.resultTitle}>📝 Extracted Text (First 500 chars)</Text>
              <Text style={styles.extractedText}>
                {extractionResult.text.substring(0, 500)}
                {extractionResult.text.length > 500 ? '...' : ''}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontFamily: FONT_FAMILY.semiBold,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontFamily: FONT_FAMILY.bold,
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontFamily: FONT_FAMILY.semiBold,
    marginBottom: 8,
  },
  sectionDescription: {
    color: '#999',
    fontSize: 14,
    fontFamily: FONT_FAMILY.regular,
    marginBottom: 16,
    lineHeight: 20,
  },
  testButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: FONT_FAMILY.semiBold,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontFamily: FONT_FAMILY.semiBold,
  },
  disabledButton: {
    opacity: 0.6,
  },
  resultContainer: {
    backgroundColor: '#2c2c2e',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  resultTitle: {
    color: 'white',
    fontSize: 16,
    fontFamily: FONT_FAMILY.semiBold,
    marginBottom: 8,
  },
  resultText: {
    color: '#e5e5e7',
    fontSize: 14,
    fontFamily: FONT_FAMILY.regular,
    lineHeight: 20,
  },
  extractedText: {
    color: '#e5e5e7',
    fontSize: 12,
    fontFamily: FONT_FAMILY.regular,
    lineHeight: 16,
    backgroundColor: '#1c1c1e',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
});

export default WordTestScreen;
