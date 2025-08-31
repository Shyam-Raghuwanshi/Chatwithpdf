import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Image,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import auth from '../../utils/AppwriteAuth';
import PdfScreen from './PdfScreen';
import type { User } from '../../types/AuthModule';
import PdfTextExtractor from '../../utils/PdfTextExtractor';
import DocumentPicker from '../components/DocumentPicker';
import RAGService, { ProcessDocumentResult } from '../../utils/RAGService';
import { Document } from '../../utils/AppwriteDB';
import { defaultConfig } from '../../utils/Config';

interface DashboardScreenProps {
  user: User;
  onLogout: () => void;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'pdf'>('dashboard');
  const [showDropdown, setShowDropdown] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [userDocuments, setUserDocuments] = useState<Document[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [ragService, setRagService] = useState<RAGService | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [deletingDocument, setDeletingDocument] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const screenHeight = Dimensions.get('window').height;
  
  // Cache RAG service to avoid reinitializing
  const ragServiceRef = useRef<RAGService | null>(null);

  // Load user documents on component mount
  React.useEffect(() => {
    loadUserDocuments();
  }, []);

  const loadUserDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const rag = await initializeRAGService();
      if (rag) {
        setRagService(rag);

        // Test authentication first
        const authTest = await rag.testDatabaseAuth();
        console.log('Database auth test:', authTest);

        if (!authTest.isAuthenticated) {
          console.log('User appears as guest, but collections are accessible. Proceeding...');
          // Run collection access test to verify collections work
          console.log('Running collection access diagnostics...');
          await rag.testCollectionAccess();
        }

        // Ensure user profile exists
        console.log('Ensuring user profile exists...');
        await rag.ensureUserProfile(user.id);

        // Get documents
        const documents = await rag.getUserDocuments(user.id);
        setUserDocuments(documents);
        console.log('Successfully loaded user documents:', documents.length);
      }
    } catch (error) {
      console.error('Error loading user documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
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
      
      // Optimistically remove from UI first (for better UX)
      setUserDocuments(prev => prev.filter(doc => doc.$id !== documentId));
      
      // Close modal immediately
      setShowDeleteModal(false);
      setDocumentToDelete(null);
      
      // Delete from database in background
      await ragService.deleteDocument(userId, documentId);
      
    } catch (error) {
      console.error('Error deleting document:', error);
      
      // Revert optimistic update on error
      await loadUserDocuments();
      
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

  const initializeRAGService = async () => {
    // Return cached service if available
    if (ragServiceRef.current) {
      return ragServiceRef.current;
    }
    
    try {
      const rag = new RAGService(defaultConfig);
      await rag.initialize();
      
      // Cache the service
      ragServiceRef.current = rag;
      return rag;
    } catch (error) {
      console.error('Error initializing RAG service:', error);
      Alert.alert('Error', 'Failed to initialize document processing service.');
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

  const handlePdfUpload = async () => {
    hideSourceDropdown();
    setUploading(true);

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

      // Process document through RAG pipeline
      const ragService = await initializeRAGService();
      if (ragService && response.text) {
        await processDocumentThroughRAG(result?.name || 'Uploaded Document', response.text, result?.uri || '', ragService);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to extract PDF text');
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

  // If PDF screen is active, show it
  if (currentScreen === 'pdf') {
    return (
      <SafeAreaView style={styles.container}>
        <PdfScreen 
          userId={user.id} 
          selectedDocument={selectedDocument} 
          ragService={ragService}
          userDocuments={userDocuments}
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
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user.name.charAt(0).toUpperCase()}
                </Text>
              </View>
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
              {loadingDocuments ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.loadingText}>Loading documents...</Text>
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
                  <Text style={styles.sourceOptionText}>PDF</Text>
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
