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
  selectedDocument?: Document | null; // Pre-selected document to load
  ragService?: RAGService | null; // Pre-initialized RAG service
  userDocuments?: Document[]; // Pre-loaded user documents
}

const PdfScreen: React.FC<Props> = ({ userId, selectedDocument, ragService: externalRagService, userDocuments: externalUserDocuments }) => {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [pdfInfo, setPdfInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ragService, setRagService] = useState<RAGService | null>(externalRagService || null);
  const [processedDocument, setProcessedDocument] = useState<Document | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [userDocuments, setUserDocuments] = useState<Document[]>(externalUserDocuments || []);

  // Initialize RAG service or use external one
  useEffect(() => {
    if (externalRagService) {
      // Use external RAG service (faster)
      setRagService(externalRagService);
    } else if (!ragService) {
      // Initialize RAG service when component mounts (fallback)
      initializeRAGService().then(service => {
        if (service) {
          setRagService(service);
        }
      });
    }
  }, [externalRagService]);

  // Load user documents when RAG service is ready (only if no documents provided)
  useEffect(() => {
    if (ragService && !selectedDocument && (!externalUserDocuments || externalUserDocuments.length === 0)) {
      loadUserDocuments();
    }
  }, [ragService, selectedDocument, externalUserDocuments]);

  // Handle selected document from dashboard
  useEffect(() => {
    if (selectedDocument && ragService) {
      console.log('Loading pre-selected document:', selectedDocument.title);
      setProcessedDocument(selectedDocument);
      setShowChat(true); // Directly show chat for pre-selected documents

      // Skip loading user documents if we have them already
      if (externalUserDocuments && externalUserDocuments.length > 0) {
        setUserDocuments(externalUserDocuments);
      }
    }
  }, [selectedDocument, ragService, externalUserDocuments]);

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

      // Ensure user profile exists
      console.log('Ensuring user profile exists...');
      await ragService.ensureUserProfile(userId);

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
        // Set the ragService state so it can be reused for chat
        setRagService(ragService);
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
        text
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

      // Provide user-friendly error messages
      let errorMessage = 'Failed to process document for chat';
      let errorTitle = 'Processing Error';

      if (error.message.includes('429') || error.message.includes('Rate limit')) {
        errorTitle = 'Rate Limit Reached';
        errorMessage = 'VoyageAI API limit reached. Current limits:\n\n' +
          '• Tier 1: 2,000 requests/minute\n' +
          '• Tier 2: 4,000 requests/minute ($100+ spent)\n' +
          '• Tier 3: 6,000 requests/minute ($1000+ spent)\n\n' +
          'The app will retry automatically. For production use, consider upgrading your VoyageAI tier.';
      } else if (error.message.includes('401') || error.message.includes('authentication')) {
        errorTitle = 'Authentication Error';
        errorMessage = 'There was an issue with the AI service authentication. Please check your configuration.';
      } else if (error.message.includes('Network error')) {
        errorTitle = 'Connection Error';
        errorMessage = 'Unable to connect to the AI service. Please check your internet connection and try again.';
      } else {
        errorMessage = error.message || errorMessage;
      }

      Alert.alert(errorTitle, errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ChatScreen
      userId={userId}
      selectedDocument={processedDocument || selectedDocument || undefined}
      onBack={() => setShowChat(false)}
      existingRAGService={ragService || undefined}
      userDocuments={userDocuments}
      chatId={`chat_${processedDocument?.$id || selectedDocument?.$id || Date.now()}`}
      onAddSource={() => {
        // TODO: Implement add source functionality
        console.log('Add source functionality to be implemented');
      }}
      onDeleteSource={(document) => {
        // TODO: Implement delete source functionality
        console.log('Delete source functionality to be implemented for:', document.title);
      }}
    />
  );
};

export default PdfScreen;
