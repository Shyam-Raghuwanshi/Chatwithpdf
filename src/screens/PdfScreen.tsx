import React, { useState, useEffect } from 'react';
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
import RAGService, { ProcessDocumentResult } from '../../utils/RAGService';
import ChatScreen from './ChatScreen';
import { Document } from '../../utils/AppwriteDB';
import { defaultConfig } from '../../utils/Config';

interface Props {
  userId: string; // Pass this from your auth system
}

const PdfScreen: React.FC<Props> = ({ userId }) => {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [pdfInfo, setPdfInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ragService, setRagService] = useState<RAGService | null>(null);
  const [processedDocument, setProcessedDocument] = useState<Document | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [userDocuments, setUserDocuments] = useState<Document[]>([]);

  // Load user documents
  useEffect(() => {
    if (ragService) {
      loadUserDocuments();
    }
  }, [ragService]);

  const initializeRAGService = async () => {
    try {
      const rag = new RAGService(defaultConfig);
      await rag.initialize();

      // Reinitialize the database connection to pick up OAuth session
      // console.log('Reinitializing RAG service for authenticated user...');
      // rag.reinitializeAfterAuth();
      return rag;
    } catch (error) {
      console.error('Error initializing RAG service:', error);
      Alert.alert('Error', 'Failed to initialize document processing service.');
    }
  }; const loadUserDocuments = async () => {
    if (!ragService) return;

    try {
      // Test authentication first
      const authTest = await ragService.testDatabaseAuth();
      console.log('Database auth test:', authTest);

      if (!authTest.isAuthenticated) {
        console.log('User appears as guest, but collections are accessible. Proceeding...');

        // Run collection access test to verify collections work
        console.log('Running collection access diagnostics...');
        await ragService.testCollectionAccess();
      }

      // Proceed to get documents since collections are accessible
      const documents = await ragService.getUserDocuments(userId);
      setUserDocuments(documents);
      console.log('Successfully loaded user documents:', documents.length);

    } catch (error) {
      console.error('Error loading user documents:', error);
      Alert.alert('Error', 'Failed to load documents. Please try again.');
    }
  };

  const handleUploadAndExtract = async () => {
    setUploading(true);
    setExtractedText(null);
    setPdfInfo(null);
    setError(null);
    setProcessedDocument(null);

    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf]
      });

      console.log('Extraction result:', result);
      console.log('File URI:', result?.uri);
      console.log("Starting PDF text extraction...");

      const response = await PdfTextExtractor.extractPdfText(result?.uri || '');
      console.log('Extraction response:', response);

      if (!response.success || !response.text) {
        throw new Error(response.error || 'Failed to extract text from PDF');
      }

      setExtractedText(response.text);
      setPdfInfo(response.metadata);
      // Process document through RAG pipeline if service is available
      const ragService = await initializeRAGService()
      console.log(ragService, response.text, "------------")
      if (ragService && response.text) {
        console.log("inside if ----------")
        await processDocumentThroughRAG(result?.name || 'Uploaded Document', response.text, result?.uri || '', ragService);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
      Alert.alert('Error', e?.message || 'Failed to extract PDF text');
    } finally {
      setUploading(false);
    }
  };

  const processDocumentThroughRAG = async (title: string, text: string, fileUri: string, rag: RAGService) => {

    if (!rag) {
      Alert.alert('Error', 'Document processing service not available');
      return;
    }

    console.log('Processing document through RAG pipeline...');
    setProcessing(true);
    try {

      const result: ProcessDocumentResult = await rag.processDocument(
        userId,
        title,
        text,
        fileUri // Using file URI as fileId for now
      );

      if (result.success) {
        console.log(`Document processed successfully: ${result.chunksProcessed} chunks, ${result.totalTokensUsed} tokens used`);

        // Reload user documents
        await loadUserDocuments();

        // Set the processed document for chat
        const documents = await rag.getUserDocuments(userId);
        const newDocument = documents.find(doc => doc.$id === result.documentId);
        if (newDocument) {
          setProcessedDocument(newDocument);
        }

        Alert.alert(
          'Success!',
          `Document processed successfully!\n\n• ${result.chunksProcessed} text chunks created\n• ${result.totalTokensUsed} tokens used\n\nYou can now chat with this document.`,
          [
            { text: 'OK', style: 'default' },
            { text: 'Start Chat', style: 'default', onPress: () => setShowChat(true) }
          ]
        );
      } else {
        throw new Error(result.error || 'Failed to process document');
      }
    } catch (error: any) {
      console.error('Error processing document:', error);
      Alert.alert('Processing Error', error.message || 'Failed to process document for chat');
    } finally {
      setProcessing(false);
    }
  };

  const handleClearResults = () => {
    setExtractedText(null);
    setPdfInfo(null);
    setError(null);
    setProcessedDocument(null);
  };

  const handleChatWithDocument = (document: Document) => {
    setProcessedDocument(document);
    setShowChat(true);
  };

  if (showChat) {
    return (
      <ChatScreen
        userId={userId}
        selectedDocument={processedDocument || undefined}
        onBack={() => setShowChat(false)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>PDF Chat with RAG</Text>
          <Text style={styles.subtitle}>
            Upload PDFs, extract text, and chat with your documents using AI
          </Text>
        </View>

        {/* Existing Documents */}
        {userDocuments.length > 0 && (
          <View style={styles.documentsSection}>
            <Text style={styles.sectionTitle}>📚 Your Documents</Text>
            {userDocuments.map(doc => (
              <TouchableOpacity
                key={doc.$id}
                style={styles.documentItem}
                onPress={() => handleChatWithDocument(doc)}
              >
                <View style={styles.documentInfo}>
                  <Text style={styles.documentTitle}>{doc.title}</Text>
                  <Text style={styles.documentDate}>
                    {doc.createdAt.toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.chatButton}>💬 Chat</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Upload Button */}
        <TouchableOpacity
          style={[styles.uploadButton, (uploading || processing) && styles.disabledButton]}
          onPress={handleUploadAndExtract}
          disabled={uploading || processing}
        >
          {(uploading || processing) ? (
            <View style={styles.buttonLoading}>
              <ActivityIndicator size="small" color="white" />
              <Text style={styles.uploadButtonText}>
                {uploading ? 'Extracting...' : 'Processing...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.uploadButtonText}>📤 Upload & Process PDF</Text>
          )}
        </TouchableOpacity>

        {/* Loading State */}
        {(uploading || processing) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>
              {uploading ? 'Extracting text using iText...' : 'Processing through RAG pipeline...'}
            </Text>
            {processing && (
              <Text style={styles.loadingSubtext}>
                This may take a few moments while we chunk the text and generate embeddings.
              </Text>
            )}
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
                style={[styles.actionButton, styles.chatActionButton]}
                onPress={() => {
                  if (processedDocument) {
                    setShowChat(true);
                  } else {
                    Alert.alert('Processing Required', 'Please wait for document processing to complete before chatting.');
                  }
                }}
                disabled={!processedDocument}
              >
                <Text style={styles.actionButtonText}>
                  {processedDocument ? '🤖 Chat with AI' : '⏳ Processing...'}
                </Text>
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
          <Text style={styles.featuresTitle}>✨ RAG Features</Text>
          <Text style={styles.featuresText}>
            • High-quality PDF text extraction using native iText library{'\n'}
            • Smart text chunking with overlap for better context{'\n'}
            • Vector embeddings using VoyageAI for semantic search{'\n'}
            • Qdrant vector database for fast similarity search{'\n'}
            • Persistent chat history stored in Appwrite{'\n'}
            • AI-powered document Q&A with source citations
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
  documentsSection: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  documentDate: {
    fontSize: 12,
    color: '#666',
  },
  chatButton: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
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
  buttonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
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
  chatActionButton: {
    backgroundColor: '#007AFF',
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
