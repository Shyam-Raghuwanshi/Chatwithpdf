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
import { useServices } from '../../utils/useServices';

interface Props {
  userId: string; // Pass this from your auth system
  selectedDocument?: Document | null; // Pre-selected document to load
  ragService?: RAGService | null; // Pre-initialized RAG service
  userDocuments?: Document[]; // Pre-loaded user documents
  onBack?: () => void; // Function to navigate back to home screen
}

const PdfScreen: React.FC<Props> = ({ userId, selectedDocument, ragService: externalRagService, userDocuments: externalUserDocuments, onBack }) => {
  const [processedDocument, setProcessedDocument] = useState<Document | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [userDocuments, setUserDocuments] = useState<Document[]>(externalUserDocuments || []);

  // Use centralized service management, but prefer external service if provided
  const {
    ragService: centralizedRagService,
    isLoading: servicesLoading,
    isInitialized: servicesInitialized,
    getRagService
  } = useServices({ 
    autoInitialize: !externalRagService, // Don't auto-initialize if external service provided
    userId 
  });

  // Use external RAG service if provided, otherwise use centralized one
  const ragService = externalRagService || centralizedRagService;

  // Initialize user documents when RAG service is ready (only if no documents provided)
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

  const loadUserDocuments = async () => {
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

  return (
    <ChatScreen
      userId={userId}
      selectedDocument={processedDocument || selectedDocument || undefined}
      onBack={onBack || (() => setShowChat(false))}
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
