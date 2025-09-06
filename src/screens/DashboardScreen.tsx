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
} from 'react-native';
import auth from '../../utils/AppwriteAuth';
import PdfScreen from './PdfScreen';
import SettingsScreen from './SettingsScreen';
import type { User } from '../../types/AuthModule';
import PdfTextExtractor from '../../utils/PdfTextExtractor';
import { ProcessDocumentResult } from '../../utils/RAGService';
import { Document } from '../../utils/AppwriteDB';
import { useBackgroundRAG } from '../../utils/useBackgroundServices';
import DocumentPicker from '../components/DocumentPicker';
interface DashboardScreenProps {
  user: User;
  onLogout: () => void;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ user, onLogout }) => {
  // Performance debugging
  const mountTime = useRef(Date.now());

  const [loading, setLoading] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'pdf' | 'settings'>('dashboard');
  const [showDropdown, setShowDropdown] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [deletingDocument, setDeletingDocument] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const screenHeight = Dimensions.get('window').height;

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

  const handleDocumentPress = async (document: Document) => {
    // Set the selected document and navigate to chat
    setSelectedDocument(document);
    setCurrentScreen('pdf');
  };

  const handleDocumentAction = (document: Document) => {
    setDocumentToDelete(document);
    setShowDeleteModal(true);
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

  const handlePdfUpload = async () => {
    hideSourceDropdown();
    setUploading(true);

    try {
      console.log("Starting PDF document picker...");
      
      // Use document picker to select PDF from device
      const selectedDocument = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf],
      });

      if (!selectedDocument) {
        // User cancelled the picker
        setUploading(false);
        return;
      }

      console.log("Selected document:", selectedDocument);
      
      // Copy the content URI to internal storage
      const internalPath = await PdfTextExtractor.copyContentUriToInternalStorage(selectedDocument.uri);
      console.log("Document copied to internal storage:", internalPath);
      
      // Get the document name
      const documentName = selectedDocument.name || 'Selected PDF';
      
      const { NativeModules } = require('react-native');
      let response = null;
      let extractionMethod = '';

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
      console.log("Final extraction check:", { 
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

      // Process document through RAG pipeline
      if (ragService && response.text) {
        await processDocumentThroughRAG(
          documentName,
          response.text,
          internalPath
        );
      } else {
        Alert.alert('Error', 'Document processing service not available. Please try again.');
      }
    } catch (e: any) {
      console.error('PDF upload error:', e);
      
      let errorMessage = 'Failed to process PDF';
      
      if (e?.message?.includes('User cancelled') || e?.message?.includes('CANCELLED')) {
        // Don't show error for user cancellation
        setUploading(false);
        return;
      } else if (e?.message?.includes('No application found')) {
        errorMessage = 'No PDF viewer app found on your device. Please install a PDF app to select documents.';
      } else if (e?.message?.includes('Permission denied')) {
        errorMessage = 'Permission denied. Please grant file access permission and try again.';
      } else if (e?.message?.includes('Failed to copy content URI')) {
        errorMessage = 'Unable to access the selected file. Please try selecting a different PDF or ensure the file is accessible.';
      } else {
        errorMessage = e?.message || errorMessage;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleCopiedText = () => {
    hideSourceDropdown();
    Alert.alert('Coming Soon', 'Copied text feature will be available soon!');
  };

  const handleWebsite = () => {
    hideSourceDropdown();
    Alert.alert('Coming Soon', 'Website feature will be available soon!');
  };

  const handleYoutube = () => {
    hideSourceDropdown();
    Alert.alert('Coming Soon', 'YouTube feature will be available soon!');
  };

  // If settings screen is active, show it
  if (currentScreen === 'settings') {
    return (
      <SafeAreaView style={styles.container}>
        <SettingsScreen
          user={user}
          onBack={() => setCurrentScreen('dashboard')}
          onLogout={onLogout}
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
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity>
              <Text style={styles.title}>ChatWithLLm</Text>
            </TouchableOpacity>
            <View style={styles.userInfo}>
              <TouchableOpacity style={styles.avatar} onPress={handleProfilePress}>
                <Text style={styles.avatarText}>
                  {user.name.charAt(0).toUpperCase()}
                </Text>
              </TouchableOpacity>
              {/* <View style={styles.userDetails}>
                <Text style={styles.welcomeText}>Welcome back,</Text>
                <Text style={styles.userName}>{user.name}</Text>
              </View> */}
            </View>
            {/* <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              disabled={loading}
            >
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity> */}
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            {/* Tab Navigation */}
            {/* <View style={styles.tabNavigation}>
              <TouchableOpacity style={styles.tabActive}>
                <Text style={styles.tabTextActive}>Recent</Text>
              </TouchableOpacity>
            </View> */}

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
                    <View style={styles.documentIcon}>
                      <Text style={styles.documentEmoji}>📄</Text>
                    </View>
                    <View style={styles.documentInfo}>
                      <Text style={styles.documentTitle} numberOfLines={1}>
                        {user.name}: {doc.title}
                      </Text>
                      <Text style={styles.documentMeta}>
                        1 source • {formatTimeAgo(doc.createdAt)}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.documentAction} onPress={() => handleDocumentAction(doc)}>
                      <Text style={styles.documentActionIcon}>⋯</Text>
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


        {/* Fixed Create New Button at Bottom */}
        <View style={styles.bottomContainer}>
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
                <Text style={styles.createNewButtonText}>+ Create New</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Source Selection Modal */}
      <Modal
        visible={showDropdown}
        transparent={true}
        animationType="none"
        onRequestClose={hideSourceDropdown}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
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
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
                <View style={styles.addSourceIcon}>
                  <Text style={styles.addSourceEmoji}>📄</Text>
                </View>
                <Text style={styles.dropdownTitle}>Add Source</Text>
                <Text style={styles.dropdownSubtitle}>
                  Sources let NotebookLM base its responses on the information that matters most to you.
                </Text>
              </View>

              <View style={styles.sourceOptions}>
                <TouchableOpacity style={styles.sourceOption} onPress={handlePdfUpload}>
                  <Text style={styles.sourceOptionText}>Upload PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.sourceOption} onPress={handleWebsite}>
                  <Text style={styles.sourceOptionText}>Website</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.sourceOption} onPress={handleYoutube}>
                  <Text style={styles.sourceOptionText}>YouTube</Text>
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
        <View style={styles.deleteModalOverlay}>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2c2c2e',
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
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
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    width: '100%',
  },
  title: {
    color: "white",
    width: "100%",
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    display: "flex",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 12,
    color: '#999',
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
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
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
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
  tabActive: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
    backgroundColor: '#3a3a3c',
    borderRadius: 20,
  },
  tabText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
    marginTop: 12,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a3a3c',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#4a7dff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    fontWeight: '600',
    marginBottom: 4,
  },
  documentMeta: {
    color: '#999',
    fontSize: 14,
  },
  documentAction: {
    padding: 8,
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
    backgroundColor: '#3a3a3c',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
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
  notebookIcon: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#3a3a3c',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
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
    backgroundColor: 'white',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    alignItems: 'center',
  },
  createNewButtonText: {
    color: '#333',
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
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dropdownContainer: {
    backgroundColor: '#2c2c2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    minHeight: 400,
  },
  dropdownHeader: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3c',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3a3a3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#999',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addSourceIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#4a7dff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  addSourceEmoji: {
    fontSize: 24,
    color: 'white',
  },
  dropdownTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  dropdownSubtitle: {
    fontSize: 14,
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
    fontWeight: '500',
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
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteModalMessage: {
    fontSize: 16,
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
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#ff3b30',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DashboardScreen;
