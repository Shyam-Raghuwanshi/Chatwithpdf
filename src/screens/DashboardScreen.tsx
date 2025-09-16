import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import auth from '../../utils/AppwriteAuth';
import PdfScreen from './PdfScreen';
import SettingsScreen from './SettingsScreen';
import ProfileScreen from './ProfileScreen';
import BillingScreen from './BillingScreen';
import WordTestScreen from './WordTestScreen';
import type { User } from '../../types/AuthModule';
import PdfTextExtractor from '../../utils/PdfTextExtractor';
import WordTextExtractor from '../../utils/WordTextExtractor';
import { ProcessDocumentResult } from '../../utils/RAGService';
import { Document } from '../../utils/AppwriteDB';
import { useBackgroundRAG } from '../../utils/useBackgroundServices';
import { FONT_FAMILY, } from '../../utils/FontConfig';

import DocumentPicker from '../components/DocumentPicker';
interface DashboardScreenProps {
  user: User;
  onLogout: () => void;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ user, onLogout }) => {

  const [loading, setLoading] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'pdf' | 'settings' | 'search' | 'profile' | 'billing' | 'wordtest'>('dashboard');
  const [showDropdown, setShowDropdown] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [deletingDocument, setDeletingDocument] = useState(false);
  const [showDocumentActionModal, setShowDocumentActionModal] = useState(false);
  const [selectedDocumentForAction, setSelectedDocumentForAction] = useState<Document | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [documentToRename, setDocumentToRename] = useState<Document | null>(null);
  const [renamingDocument, setRenamingDocument] = useState(false);
  const [newDocumentTitle, setNewDocumentTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchScreen, setShowSearchScreen] = useState(false);
  const [showTextInputModal, setShowTextInputModal] = useState(false);
  const [textInputContent, setTextInputContent] = useState('');
  const slideAnim = useRef(new Animated.Value(0)).current;
  const searchSlideAnim = useRef(new Animated.Value(Dimensions.get('window').width)).current;
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;

  // Use ultra-fast background services
  const serviceCallTime = Date.now();

  const {
    ragService,
    isLoading: servicesLoading,
    isReady: servicesInitialized,
    error: servicesError,
    documents: userDocuments,
    loadingDocuments,
    loadUserDocuments,
    cacheStatus
  } = useBackgroundRAG(user.id);

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
  };

  const handleProfilePress = () => {
    setCurrentScreen('settings');
  };

  const handleSearchPress = () => {
    setShowSearchScreen(true);
    Animated.timing(searchSlideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleSearchClose = () => {
    Animated.timing(searchSlideAnim, {
      toValue: screenWidth,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowSearchScreen(false);
      setSearchQuery('');
    });
  };

  const handleSearchDocumentPress = async (document: Document) => {
    // Close search screen first
    handleSearchClose();
    // Set the selected document and navigate to chat
    setSelectedDocument(document);
    setCurrentScreen('pdf');
  };

  // Filter documents based
  const filteredDocuments = userDocuments.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDocumentPress = async (document: Document) => {
    // Set the selected document and navigate to chat
    setSelectedDocument(document);
    setCurrentScreen('pdf');
  };

  const handleDocumentAction = (document: Document) => {
    setSelectedDocumentForAction(document);
    setShowDocumentActionModal(true);
  };

  const handleRenameDocument = (document: Document) => {
    setDocumentToRename(document);
    setNewDocumentTitle(document.title);
    setShowDocumentActionModal(false);
    setShowRenameModal(true);
  };

  const handleDeleteDocument = async () => {
    if (!documentToDelete || !ragService || !user || !user.id || !documentToDelete.$id) {
      Alert.alert('Error', 'Unable to delete document at this time.');
      return;
    }

    setDeletingDocument(true);
    try {
      const userId = user.id;
      const documentId = documentToDelete.$id;

      // Close modal immediately
      setShowDeleteModal(false);
      setDocumentToDelete(null);

      // Delete from database
      await ragService.deleteDocument(userId, documentId);

      // Reload documents to reflect changes
      await loadUserDocuments();

    } catch (error) {
      console.error('Error deleting document:', error);
      Alert.alert('Error', 'Failed to delete document. Please try again.');
    } finally {
      setDeletingDocument(false);
    }
  };

  const handleConfirmDelete = (document: Document) => {
    setDocumentToDelete(document);
    setShowDocumentActionModal(false);
    setShowDeleteModal(true);
  };

  const handleRenameSubmit = async () => {
    const trimmedTitle = newDocumentTitle.trim();

    if (!trimmedTitle) {
      Alert.alert('Error', 'Please enter a valid document title.');
      return;
    }

    if (!documentToRename || !ragService || !user || !user.id || !documentToRename.$id) {
      Alert.alert('Error', 'Unable to rename document at this time.');
      return;
    }

    setRenamingDocument(true);
    try {
      // Access the AppwriteDB instance directly from ragService
      const appwriteDB = (ragService as any).appwriteDB;
      if (!appwriteDB) {
        throw new Error('Database connection not available');
      }

      // Update document title in the database
      await appwriteDB.tablesDB.updateRow(
        appwriteDB.config.databaseId,
        '68a75b180016b4e52d00', // DOCUMENTS collection ID
        documentToRename.$id,
        {
          title: trimmedTitle,
        }
      );

      // Close modal
      setShowRenameModal(false);
      setDocumentToRename(null);
      setNewDocumentTitle('');

      // Reload documents to reflect changes
      await loadUserDocuments();

      Alert.alert('Success', 'Document renamed successfully!');

    } catch (error) {
      console.error('Error renaming document:', error);
      Alert.alert('Error', 'Failed to rename document. Please try again.');
    } finally {
      setRenamingDocument(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await auth.signOut();
              onLogout();
            } catch (error: any) {
              Alert.alert('Error', `Sign out failed: ${error.message}`);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const showSourceDropdown = () => {
    setShowDropdown(true);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const hideSourceDropdown = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowDropdown(false);
    });
  };

  const processDocumentThroughRAG = async (title: string, text: string, fileUri: string) => {
    if (!ragService) {
      Alert.alert('Error', 'Document processing service not available');
      return;
    }

    console.log('Processing document through RAG pipeline...');
    setProcessing(true);
    try {
      const result: ProcessDocumentResult = await ragService.processDocument(
        user.id,
        title,
        text
      );

      if (result.success) {
        console.log(`Document processed successfully: ${result.chunksProcessed} chunks, ${result.totalTokensUsed} tokens used`);

        Alert.alert(
          'Success!',
          `Document processed successfully!\n\n• ${result.chunksProcessed} text chunks created\n• ${result.totalTokensUsed} tokens used\n\nYou can now access it from your documents.`,
          [
            { text: 'OK', style: 'default' },
            { text: 'View Documents', style: 'default', onPress: () => setCurrentScreen('pdf') }
          ]
        );

        // Reload user documents
        await loadUserDocuments();
      } else {
        throw new Error(result.error || 'Failed to process document');
      }
    } catch (error: any) {
      console.error('Error processing document:', error);

      let errorMessage = 'Failed to process document for chat';
      let errorTitle = 'Processing Error';

      if (error.message.includes('429') || error.message.includes('Rate limit')) {
        errorTitle = 'Rate Limit Reached';
        errorMessage = 'VoyageAI API limwit reached. Current limits:\n\n' +
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

  const handleDocumentUpload = async () => {
    hideSourceDropdown();
    setUploading(true);

    try {
      console.log("Starting document picker...");

      // Use document picker to select PDF, DOC, or DOCX from device
      const selectedDocument = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.doc, DocumentPicker.types.docx], // Supports PDF, DOC, and DOCX
      });

      if (!selectedDocument) {
        // User cancelled the picker
        setUploading(false);
        return;
      }

      console.log("Selected document:", selectedDocument);

      // Get the document name and type
      const documentName = selectedDocument.name || 'Selected Document';
      const documentType = selectedDocument.type;
      const fileName = documentName.toLowerCase();

      console.log("Document details:", { documentName, documentType, fileName });

      let extractedText = '';
      let processingTime = 0;
      let extractionMethod = '';

      // Determine file type and extract text accordingly
      if (fileName.endsWith('.pdf') || documentType?.includes('pdf')) {
        console.log("Processing as PDF document...");

        // Copy the content URI to internal storage
        const internalPath = await PdfTextExtractor.copyContentUriToInternalStorage(selectedDocument.uri);
        console.log("PDF copied to internal storage:", internalPath);

        const { NativeModules } = require('react-native');
        let response = null;

        // Step 1: Test with fast OCR to determine extraction quality
        try {
          console.log("Starting fast OCR extraction (all pages)...");
          const fastOCRResult = await NativeModules.PdfTextExtractorModule.extractTextWithFastOCR(internalPath);
          console.log("Fast OCR result:", fastOCRResult);

          if (fastOCRResult && fastOCRResult.text && fastOCRResult.text.trim().length > 50) {
            console.log("✅ Fast OCR successful - using result");
            response = fastOCRResult;
            extractionMethod = `Fast OCR Extraction (${fastOCRResult.totalPages || 'All'} pages)`;

            // Also try full OCR in the background to compare quality
            try {
              console.log("Also attempting full OCR for comparison...");
              const fullOCRResult = await NativeModules.PdfTextExtractorModule.extractTextWithTextricatorApproach(internalPath);
              console.log("Full OCR result:", fullOCRResult);

              if (fullOCRResult && fullOCRResult.text && fullOCRResult.text.trim().length > fastOCRResult.text.trim().length * 1.5) {
                // Full OCR got significantly more text (at least 50% more)
                response = fullOCRResult;
                extractionMethod = 'Full OCR Extraction (All pages)';
                console.log("✅ Full OCR got significantly more text, using it instead!");
              } else {
                console.log("⚠️ Full OCR didn't improve significantly, keeping fast OCR result");
              }
            } catch (fullOCRError) {
              console.log("Full OCR failed, keeping successful fast OCR result:", fullOCRError);
            }
          } else {
            console.log("Fast OCR failed or insufficient text, trying full OCR directly...");
            // Try full OCR directly
            response = await NativeModules.PdfTextExtractorModule.extractTextWithTextricatorApproach(internalPath);
            console.log("Direct full OCR result:", response);
            extractionMethod = 'Direct OCR Extraction (All pages)';
            if (response && response.text && response.text.trim().length > 10) {
              console.log("✅ Direct OCR extraction successful!");
            } else {
              console.log("❌ Direct OCR also failed or insufficient text");
            }
          }
        } catch (testError) {
          console.log('❌ OCR extraction failed:', testError);
          console.log('This might be a complex PDF or contain only images');
        }

        // Check if we got any meaningful text
        console.log("Final PDF extraction check:", {
          hasResponse: !!response,
          hasText: !!response?.text,
          textLength: response?.text?.trim().length || 0,
          extractionMethod
        });

        if (!response || !response.text || response.text.trim().length < 10) {
          // Be more lenient with text length requirement
          if (response?.text && response.text.trim().length > 0) {
            console.log("⚠️ Found some text but it's very short:", response.text.trim());
            // Still try to process it if we found any text at all
          } else {
            throw new Error(`PDF extraction failed. The document may be corrupted, password-protected, contain only images, or be in an unsupported format.\n\nExtraction method tried: ${extractionMethod || 'Multiple methods'}\nFile: ${documentName}`);
          }
        }

        extractedText = response.text;
        processingTime = response.processingTime || 0;

      } else if (fileName.endsWith('.doc') || fileName.endsWith('.docx') ||
        documentType?.includes('msword') ||
        documentType?.includes('wordprocessingml')) {
        console.log("Processing as Word document...");

        // Copy the content URI to internal storage
        const internalPath = await WordTextExtractor.copyContentUriToInternalStorage(selectedDocument.uri);
        console.log("Word document copied to internal storage:", internalPath);

        // Extract text using Apache POI
        const wordResult = await WordTextExtractor.extractText(internalPath);
        console.log("Word extraction result:", wordResult);

        extractedText = wordResult.text;
        processingTime = wordResult.processingTime;
        extractionMethod = wordResult.extractionMethod;

        if (!extractedText || extractedText.trim().length < 10) {
          throw new Error(`Word document extraction failed. The document may be corrupted, password-protected, or in an unsupported format.\n\nExtraction method: ${extractionMethod}\nFile: ${documentName}`);
        }

      } else {
        throw new Error(`Unsupported document format. Please select a PDF (.pdf), Word document (.doc or .docx).\n\nSelected file: ${documentName}\nType: ${documentType}`);
      }

      // Process document through RAG pipeline
      if (ragService && extractedText) {
        await processDocumentThroughRAG(
          documentName,
          extractedText,
          selectedDocument.uri
        );
      } else {
        Alert.alert('Error', 'Document processing service not available. Please try again.');
      }
    } catch (e: any) {
      console.error('Document upload error:', e);

      let errorMessage = 'Failed to process document';

      if (e?.message?.includes('User cancelled') || e?.message?.includes('CANCELLED')) {
        // Don't show error for user cancellation
        setUploading(false);
        return;
      } else if (e?.message?.includes('No application found')) {
        errorMessage = 'No document viewer app found on your device. Please install a document app to select files.';
      } else if (e?.message?.includes('Permission denied')) {
        errorMessage = 'Permission denied. Please grant file access permission and try again.';
      } else if (e?.message?.includes('Failed to copy content URI')) {
        errorMessage = 'Unable to access the selected file. Please try selecting a different document or ensure the file is accessible.';
      } else {
        errorMessage = e?.message || errorMessage;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleCopiedText = async () => {
    hideSourceDropdown();
    try {
      // Try to get clipboard content
      const { Clipboard } = require('react-native');
      const content = await Clipboard.getString();
      if (content) {
        setTextInputContent(content);
      }
    } catch (error) {
      console.log('Could not access clipboard:', error);
    }
    setShowTextInputModal(true);
  };

  const handleTextInputSubmit = async () => {
    const text = textInputContent.trim();
    if (!text) {
      Alert.alert('Error', 'Please enter some text content.');
      return;
    }

    // Validate minimum text length
    if (text.length < 50) {
      Alert.alert(
        'Text Too Short',
        'Please enter at least 50 characters of text to ensure meaningful processing.',
        [
          {
            text: 'OK',
            onPress: () => null,
          }
        ]
      );
      return;
    }

    setShowTextInputModal(false);
    try {
      setProcessing(true);

      // Generate a meaningful title from the first sentence or first few words
      let title = '';
      const firstSentenceMatch = text.match(/^[^.!?]+[.!?]/);
      if (firstSentenceMatch && firstSentenceMatch[0].length <= 50) {
        title = firstSentenceMatch[0].trim();
      } else {
        const words = text.split(' ');
        title = words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
      }

      // Ensure text has proper paragraph breaks
      const formattedText = text
        .replace(/\s+/g, ' ')           // Normalize whitespace
        .replace(/([.!?])\s+/g, '$1\n\n') // Add paragraph breaks after sentences
        .trim();

      await processDocumentThroughRAG(
        `Note: ${title}`,
        formattedText,
        ''
      );

      setTextInputContent('');
    } catch (error: any) {
      console.error('Error processing text:', error);

      let errorMessage = 'Failed to process text';
      if (error.message.includes('No chunks generated')) {
        errorMessage = 'Text could not be processed. Please ensure your text has enough content and try again.';
      } else {
        errorMessage = error.message || errorMessage;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  // If settings screen is active, show it
  if (currentScreen === 'settings') {
    return (
      <SafeAreaView style={styles.container}>
        <SettingsScreen
          user={user}
          onBack={() => setCurrentScreen('dashboard')}
          onLogout={onLogout}
          onNavigateToProfile={() => setCurrentScreen('profile')}
          onNavigateToBilling={() => setCurrentScreen('billing')}
          onNavigateToWordTest={() => setCurrentScreen('wordtest')}
        />
      </SafeAreaView>
    );
  }

  // If profile screen is active, show it
  if (currentScreen === 'profile') {
    return (
      <SafeAreaView style={styles.container}>
        <ProfileScreen
          user={user}
          onBack={() => setCurrentScreen('settings')}
        />
      </SafeAreaView>
    );
  }

  // If billing screen is active, show it
  if (currentScreen === 'billing') {
    return (
      <SafeAreaView style={styles.container}>
        <BillingScreen
          userId={user.id}
          onBack={() => setCurrentScreen('settings')}
        />
      </SafeAreaView>
    );
  }

  // If Word test screen is active, show it
  if (currentScreen === 'wordtest') {
    return (
      <SafeAreaView style={styles.container}>
        <WordTestScreen
          onBack={() => setCurrentScreen('settings')}
        />
      </SafeAreaView>
    );
  }

  // If PDF screen is active, show it
  if (currentScreen === 'pdf') {
    return (
      <SafeAreaView style={styles.container}>
        <PdfScreen
          userId={user.id}
          selectedDocument={selectedDocument}
          ragService={ragService}
          userDocuments={userDocuments}
          onBack={() => setCurrentScreen('dashboard')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header - moved outside ScrollView to make it sticky */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Paper</Text>
          </View>
          <View style={styles.userInfo}>
            <TouchableOpacity style={styles.search} onPress={handleSearchPress}>
              <Image
                source={require('../../assets/icons/search.png')}
                style={{ width: 20, height: 20 }}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatar} onPress={handleProfilePress}>
              <Image
                style={{ width: 36, height: 36, borderRadius: 18 }}
                source={{ uri: user.avatarUrl }}
              />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContainer}>
          {/* Main Content */}
          <View style={styles.mainContent}>
            {/* Tab Navigation */}
            <View style={styles.tabNavigation}>
              <TouchableOpacity >
                <Text style={styles.tabTextActive}>Chats</Text>
              </TouchableOpacity>
            </View>

            {/* Documents List */}
            <View style={styles.documentsContainer}>
              {(loadingDocuments || servicesLoading) ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.loadingText}>
                    {servicesLoading ? 'Initializing services...' : 'Loading documents...'}
                  </Text>
                  {servicesError && (
                    <Text style={styles.errorText}>{servicesError}</Text>
                  )}
                </View>
              ) : userDocuments.length > 0 ? (
                userDocuments.map((doc) => (
                  <TouchableOpacity
                    key={doc.$id}
                    style={styles.documentCard}
                    onPress={() => handleDocumentPress(doc)}
                  >
                    <View style={styles.documentInfo}>
                      <Text style={styles.documentTitle} numberOfLines={1}>
                        {doc.title}
                      </Text>
                      <Text style={styles.documentMeta}>
                        1 source • {formatTimeAgo(doc.createdAt)}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.documentAction} onPress={() => handleDocumentAction(doc)}>
                      <Image
                        source={require('../../assets/icons/dots-horizontal.png')}
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <View style={styles.laptopScreen}></View>
                    <View style={styles.laptopBase}></View>
                  </View>
                  <Text style={styles.emptyTitle}>Let's get started</Text>
                  <Text style={styles.emptySubtitle}>
                    Create your first notebook below.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Floating Create New Button */}
        <TouchableOpacity
          style={[styles.createNewButton, (uploading || processing) && styles.disabledButton]}
          onPress={showSourceDropdown}
          disabled={uploading || processing}
        >
          {(uploading || processing) ? (
            <View style={styles.buttonLoading}>
              <ActivityIndicator size="small" color="#333" />
              <Text style={styles.createNewButtonText}>
                {uploading ? 'Uploading...' : 'Processing...'}
              </Text>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Image
                  style={{ width: 12, height: 12, marginRight: 8 }}
                  source={require('../../assets/icons/plus.png')}
                />
                <Text style={styles.createNewButtonText}> New Chat</Text>
              </View>
            </>
          )}
        </TouchableOpacity>

      </View>

      {/* Source Selection Modal */}
      <Modal
        visible={showDropdown}
        transparent={true}
        animationType="none"
        onRequestClose={hideSourceDropdown}
      >
        <TouchableOpacity
          style={styles.sourceModalOverlay}
          activeOpacity={1}
          onPress={hideSourceDropdown}
        >
          <Animated.View
            style={[
              styles.dropdownContainer,
              {
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [screenHeight, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.dropdownHeader}>
                <TouchableOpacity onPress={hideSourceDropdown} style={styles.closeButton}>
                  <Image
                    source={require('../../assets/icons/x.png')}
                    style={{ width: 15, height: 15 }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
                <View>
                  <Image
                    source={require('../../assets/icons/file-fill.png')}
                    style={{ width: 40, height: 40 }}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.dropdownTitle}>Add Source</Text>
                <Text style={styles.dropdownSubtitle}>
                  Sources let Paper base its responses on the information that matters most to you.
                </Text>
              </View>

              <View style={styles.sourceOptions}>
                <TouchableOpacity style={styles.sourceOption} onPress={handleDocumentUpload}>
                  <Text style={styles.sourceOptionText}>Upload Document</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sourceOption} onPress={handleCopiedText}>
                  <Text style={styles.sourceOptionText}>Copied text</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <Text style={styles.deleteModalTitle}>Delete Document</Text>
            <Text style={styles.deleteModalMessage}>
              Are you sure you want to delete "{documentToDelete?.title}"? This action cannot be undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.cancelButton]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDocumentToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteButton]}
                onPress={handleDeleteDocument}
                disabled={deletingDocument}
              >
                {deletingDocument ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.deleteButtonText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Document Action Modal */}
      <Modal
        visible={showDocumentActionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDocumentActionModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowDocumentActionModal(false);
            setSelectedDocumentForAction(null);
          }}
        >
          <View style={styles.actionModalContainer}>
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.actionModalHeader}>
                <Text style={styles.actionModalTitle}>
                  {selectedDocumentForAction?.title}
                </Text>
              </View>

              <View style={styles.actionOptions}>
                <TouchableOpacity
                  style={styles.actionOption}
                  onPress={() => handleRenameDocument(selectedDocumentForAction!)}
                >
                  <View style={styles.actionOptionContent}>
                    <Image
                      source={require('../../assets/icons/file.png')}
                      style={styles.actionOptionIcon}
                      resizeMode="contain"
                    />
                    <Text style={styles.actionOptionText}>Rename Chat</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionOption, styles.actionOptionDanger]}
                  onPress={() => handleConfirmDelete(selectedDocumentForAction!)}
                >
                  <View style={styles.actionOptionContent}>
                    <Image
                      source={require('../../assets/icons/trash.png')}
                      style={[styles.actionOptionIcon, styles.actionOptionIconDanger]}
                      resizeMode="contain"
                    />
                    <Text style={[styles.actionOptionText, styles.actionOptionTextDanger]}>Delete Chat</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Rename Document Modal */}
      <Modal
        visible={showRenameModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRenameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.renameModalContainer}>
            <View style={styles.renameModalHeader}>
              <Text style={styles.renameModalTitle}>Rename Chat</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowRenameModal(false);
                  setDocumentToRename(null);
                  setNewDocumentTitle('');
                }}
                style={styles.renameModalCloseButton}
              >
                <Image
                  source={require('../../assets/icons/x.png')}
                  style={{ width: 20, height: 20 }}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.renameModalSubtitle}>
              Enter a new name for this chat:
            </Text>

            <TextInput
              style={styles.renameInput}
              value={newDocumentTitle}
              onChangeText={setNewDocumentTitle}
              placeholder="Enter new chat name..."
              placeholderTextColor="#999"
              autoFocus={true}
              maxLength={100}
            />

            <View style={styles.renameModalButtons}>
              <TouchableOpacity
                style={[styles.renameModalButton, styles.cancelButton]}
                onPress={() => {
                  setShowRenameModal(false);
                  setDocumentToRename(null);
                  setNewDocumentTitle('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.renameModalButton, styles.confirmButton]}
                onPress={handleRenameSubmit}
                disabled={!newDocumentTitle.trim() || renamingDocument}
              >
                {renamingDocument ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.confirmButtonText}>Rename</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Search Screen Modal */}
      <Modal
        visible={showSearchScreen}
        transparent={true}
        animationType="none"
        onRequestClose={handleSearchClose}
      >
        <View style={styles.searchModalOverlay}>
          <Animated.View
            style={[
              styles.searchContainer,
              {
                transform: [
                  {
                    translateX: searchSlideAnim,
                  },
                ],
              },
            ]}
          >
            <SafeAreaView style={styles.searchContent}>
              {/* Search Header */}
              <View style={styles.searchHeader}>
                <TouchableOpacity onPress={handleSearchClose} style={styles.searchBackButton}>
                  <Image
                    source={require('../../assets/icons/back-arrow.png')}
                    style={{ width: 20, height: 20 }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
                <View style={styles.searchInputContainer}>
                  <Image
                    source={require('../../assets/icons/search.png')}
                    style={styles.searchInputIcon}
                    resizeMode="contain"
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search documents..."
                    placeholderTextColor="#666"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus={true}
                  />
                </View>
              </View>

              {/* Search Results */}
              <ScrollView style={styles.searchResults} contentContainerStyle={styles.searchResultsContainer}>
                {(loadingDocuments || servicesLoading) ? (
                  <View style={styles.searchLoadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.searchLoadingText}>
                      {servicesLoading ? 'Initializing services...' : 'Loading documents...'}
                    </Text>
                  </View>
                ) : searchQuery.trim() === '' ? (
                  userDocuments.length > 0 ? (
                    <>
                      {userDocuments.map((doc) => (
                        <TouchableOpacity
                          key={doc.$id}
                          style={styles.searchDocumentCard}
                          onPress={() => handleSearchDocumentPress(doc)}
                        >
                          <View style={styles.searchDocumentInfo}>
                            <Text style={styles.searchDocumentTitle} numberOfLines={1} ellipsizeMode="tail">
                              {doc.title}
                            </Text>
                            <Text style={styles.searchDocumentMeta}>
                              {formatTimeAgo(doc.createdAt)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </>
                  ) : (
                    <View style={styles.searchEmptyState}>
                      <Image
                        source={require('../../assets/icons/search.png')}
                        style={styles.searchEmptyIcon}
                        resizeMode="contain"
                      />
                      <Text style={styles.searchEmptyTitle}>No Documents Yet</Text>
                      <Text style={styles.searchEmptySubtitle}>
                        Upload a PDF to start chatting
                      </Text>
                    </View>
                  )
                ) : filteredDocuments.length > 0 ? (
                  <>
                    <Text style={styles.searchResultsHeader}>
                      {filteredDocuments.length} result{filteredDocuments.length !== 1 ? 's' : ''} found
                    </Text>
                    {filteredDocuments.map((doc) => (
                      <TouchableOpacity
                        key={doc.$id}
                        style={styles.searchDocumentCard}
                        onPress={() => handleSearchDocumentPress(doc)}
                      >
                        <View style={styles.searchDocumentInfo}>
                          <Text style={styles.searchDocumentTitle} numberOfLines={2}>
                            {doc.title}
                          </Text>
                          <Text style={styles.searchDocumentMeta}>
                            1 source • {formatTimeAgo(doc.createdAt)}
                          </Text>
                        </View>
                        <View style={styles.searchDocumentIcon}>
                          <Image
                            source={require('../../assets/icons/file.png')}
                            style={{ width: 24, height: 24 }}
                            resizeMode="contain"
                          />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                ) : (
                  <View style={styles.searchNoResults}>
                    <Text style={styles.searchNoResultsTitle}>No documents found</Text>
                    <Text style={styles.searchNoResultsSubtitle}>
                      Try searching with different keywords
                    </Text>
                  </View>
                )}
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>

      {/* Text Input Modal */}
      <Modal
        visible={showTextInputModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTextInputModal(false)}
      >
        <View style={styles.sourceModalOverlay}>
          <View style={[styles.dropdownContainer, { padding: 20 }]}> {/* Reuse dropdownContainer for modal styling */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, color: 'white', fontFamily: FONT_FAMILY.bold }}>Add Text Content</Text>
              <TouchableOpacity onPress={() => { setShowTextInputModal(false); setTextInputContent(''); }}>
                <Text style={{ fontSize: 22, color: '#999' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 16, color: '#999', marginBottom: 12 }}>
              Paste or type the text content you want to add as a document:
            </Text>
            <TextInput
              style={{
                backgroundColor: '#1c1c1e',
                borderRadius: 12,
                padding: 16,
                fontSize: 16,
                color: 'white',
                borderWidth: 1,
                borderColor: '#3a3a3c',
                minHeight: 120,
                maxHeight: 200,
                marginBottom: 12,
                textAlignVertical: 'top',
              }}
              value={textInputContent}
              onChangeText={setTextInputContent}
              placeholder="Enter your text content here..."
              placeholderTextColor="#999"
              multiline
              maxLength={10000}
            />
            <Text style={{ fontSize: 12, color: '#999', textAlign: 'right', marginBottom: 12 }}>
              {textInputContent.length}/10,000 characters
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#3a3a3c', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                onPress={() => { setShowTextInputModal(false); setTextInputContent(''); }}
              >
                <Text style={{ fontSize: 16, color: 'white', fontWeight: '500' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#FF734C', borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: !textInputContent.trim() ? 0.6 : 1 }}
                onPress={handleTextInputSubmit}
                disabled={!textInputContent.trim() || processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={{ fontSize: 16, color: 'white', fontWeight: '600' }}>Add Text</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#232222',
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 100,
  },
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontFamily: FONT_FAMILY.semiBold,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  title: {
    color: "white",
    fontSize: 20,
    fontFamily: FONT_FAMILY.bold,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    display: "flex",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  search: {
    width: 36,
    height: 36,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontFamily: FONT_FAMILY.bold,
  },
  userDetails: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.regular,
    color: '#999',
  },
  userName: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.bold,
    color: 'white',
    marginBottom: 2,
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: 'white',
    fontSize: 14,
    fontFamily: FONT_FAMILY.semiBold,
  },
  mainContent: {
    flex: 1,
  },
  tabNavigation: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  tabText: {
    color: '#999',
    fontSize: 14,
    fontFamily: FONT_FAMILY.medium,
  },
  tabTextActive: {
    color: 'white',
    fontSize: 30,
    fontFamily: FONT_FAMILY.semiBold,
  },
  documentsContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#999',
    fontSize: 16,
    fontFamily: FONT_FAMILY.regular,
    marginTop: 12,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    fontFamily: FONT_FAMILY.regular,
    marginTop: 8,
    textAlign: 'center',
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#393837',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  documentEmoji: {
    fontSize: 18,
    color: 'white',
  },
  documentInfo: {
    flex: 1,
    marginRight: 12,
  },
  documentTitle: {
    color: 'white',
    fontSize: 16,
    fontFamily: FONT_FAMILY.semiBold,
    marginBottom: 4,
  },
  documentMeta: {
    color: '#999',
    fontSize: 14,
    fontFamily: FONT_FAMILY.regular,
  },
  documentAction: {
    marginRight: 9,
  },
  documentActionIcon: {
    color: '#999',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#232222',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: FONT_FAMILY.bold,
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.regular,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 60,
  },
  appLogo: {
    width: 60,
    height: 60,
    marginBottom: 16,
    tintColor: 'white',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  getStartedSection: {
    alignItems: 'center',
    marginBottom: 60,
  },
  laptopScreen: {
    width: 36,
    height: 24,
    backgroundColor: '#1c1c1e',
    borderRadius: 2,
    borderWidth: 2,
    borderColor: '#6c6c70',
    marginBottom: 2,
  },
  laptopBase: {
    width: 48,
    height: 6,
    backgroundColor: '#6c6c70',
    borderRadius: 3,
  },
  getStartedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  getStartedSubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },
  createNewButton: {
    backgroundColor: '#FF734C',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 64,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    alignItems: 'center',
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    left: '50%',
    transform: [{ translateX: -75 }],
  },
  createNewButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: FONT_FAMILY.semiBold,
  },
  buttonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  documentsButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#555',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  documentsButtonText: {
    color: '#999',
    fontSize: 14,
    fontFamily: FONT_FAMILY.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sourceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dropdownContainer: {
    backgroundColor: '#2c2c2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    // minHeight: 100,
  },
  dropdownHeader: {
    alignItems: 'center',
    padding: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#999',
    fontSize: 16,
    fontFamily: FONT_FAMILY.bold,
  },
  dropdownTitle: {
    fontSize: 20,
    fontFamily: FONT_FAMILY.bold,
    color: 'white',
    marginBottom: 8,
  },
  dropdownSubtitle: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.regular,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  sourceOptions: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  sourceOption: {
    backgroundColor: '#3a3a3c',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  sourceOptionText: {
    color: 'white',
    fontSize: 16,
    fontFamily: FONT_FAMILY.medium,
  },
  // Delete Modal Styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  deleteModalTitle: {
    fontSize: 20,
    fontFamily: FONT_FAMILY.bold,
    color: 'white',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteModalMessage: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.regular,
    color: '#999',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#3a3a3c',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: FONT_FAMILY.semiBold,
  },
  deleteButton: {
    backgroundColor: '#ff3b30',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: FONT_FAMILY.semiBold,
  },
  // Search Screen Styles
  searchModalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  searchContainer: {
    flex: 1,
    backgroundColor: '#1c1c1e',
    width: '100%',
  },
  searchContent: {
    flex: 1,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
    backgroundColor: '#1c1c1e',
  },
  searchBackButton: {
    padding: 8,
    marginRight: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInputIcon: {
    width: 16,
    height: 16,
    marginRight: 8,
    tintColor: '#666',
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    fontFamily: FONT_FAMILY.regular,
    paddingVertical: 4,
  },
  searchResults: {
    flex: 1,
  },
  searchResultsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  searchLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  searchLoadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  searchEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  searchEmptyIcon: {
    width: 48,
    height: 48,
    marginBottom: 16,
    tintColor: '#666',
  },
  searchEmptyTitle: {
    fontSize: 20,
    fontFamily: FONT_FAMILY.bold,
    color: 'white',
    marginBottom: 8,
  },
  searchEmptySubtitle: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.regular,
    color: '#666',
    textAlign: 'center',
  },
  searchResultsHeader: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.medium,
    color: '#666',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchDocumentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  searchDocumentInfo: {
    flex: 1,
    marginRight: 12,
  },
  searchDocumentTitle: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.semiBold,
    color: 'white',
    marginBottom: 4,
  },
  searchDocumentMeta: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.regular,
    color: '#666',
  },
  searchDocumentIcon: {
    padding: 8,
  },
  searchNoResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  searchNoResultsTitle: {
    fontSize: 18,
    fontFamily: FONT_FAMILY.bold,
    color: 'white',
    marginBottom: 8,
  },
  searchNoResultsSubtitle: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.regular,
    color: '#666',
    textAlign: 'center',
  },
  // Action Modal Styles
  actionModalContainer: {
    backgroundColor: '#2c2c2e',
    borderRadius: 16,
    maxWidth: 400,
    width: '90%',
  },
  actionModalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3c',
  },
  actionModalTitle: {
    fontSize: 18,
    fontFamily: FONT_FAMILY.semiBold,
    color: 'white',
    textAlign: 'center',
  },
  actionOptions: {
    padding: 8,
  },
  actionOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginVertical: 4,
  },
  actionOptionDanger: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  actionOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionOptionIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
    tintColor: '#999',
  },
  actionOptionIconDanger: {
    tintColor: '#ff3b30',
  },
  actionOptionText: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.medium,
    color: 'white',
  },
  actionOptionTextDanger: {
    color: '#ff3b30',
  },
  // Rename Modal Styles
  renameModalContainer: {
    backgroundColor: '#2c2c2e',
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
    width: '90%',
  },
  renameModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  renameModalTitle: {
    fontSize: 20,
    fontFamily: FONT_FAMILY.bold,
    color: 'white',
  },
  renameModalCloseButton: {
    padding: 4,
  },
  renameModalSubtitle: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.regular,
    color: '#999',
    marginBottom: 16,
  },
  renameInput: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: 'white',
    borderWidth: 1,
    borderColor: '#3a3a3c',
    marginBottom: 20,
    fontFamily: FONT_FAMILY.regular,
  },
  renameModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  renameModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#FF734C',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: FONT_FAMILY.semiBold,
  },
});

export default DashboardScreen;
