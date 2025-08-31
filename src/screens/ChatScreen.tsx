import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Modal,
} from 'react-native';
import RAGService, { ChatResponse } from '../../utils/RAGService';
import { Document } from '../../utils/AppwriteDB';
import { defaultConfig } from '../../utils/Config';

interface ChatMessage {
  id: string;
  message: string;
  response: string;
  timestamp: Date;
  isLoading?: boolean;
  sources?: Array<{
    chunkId: string;
    text: string;
    score: number;
    documentTitle?: string;
  }>;
}

interface Props {
  userId: string;
  selectedDocument?: Document;
  onBack: () => void;
  existingRAGService?: RAGService;
  userDocuments?: Document[];
  onAddSource?: () => void;
  onDeleteSource?: (document: Document) => void;
  chatId?: string; // Unique identifier for this chat session
}

const ChatScreen: React.FC<Props> = ({ 
  userId, 
  selectedDocument, 
  onBack, 
  existingRAGService,
  userDocuments = [],
  onAddSource,
  onDeleteSource,
  chatId
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ragService, setRagService] = useState<RAGService | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<'sources' | 'chat'>('chat');
  const [chatSources, setChatSources] = useState<Document[]>([]); // Sources specific to this chat
  const [availableSources, setAvailableSources] = useState<Document[]>([]); // Available sources to add
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const screenHeight = Dimensions.get('window').height;
  const currentChatId = chatId || `chat_${selectedDocument?.$id || Date.now()}`;

  // Initialize RAG service and sources
  useEffect(() => {
    if (existingRAGService) {
      setRagService(existingRAGService);
      setIsInitialized(true);
    } else {
      initializeRAGService();
    }
  }, [existingRAGService]);

  // Initialize sources with selected document and manage chat-specific sources
  useEffect(() => {
    // Initialize chat sources with the selected document (if any)
    if (selectedDocument) {
      setChatSources([selectedDocument]);
    }
    
    // Set available sources (excluding already selected ones)
    const available = userDocuments.filter(doc => 
      !selectedDocument || doc.$id !== selectedDocument.$id
    );
    setAvailableSources(available);
  }, [selectedDocument, userDocuments]);

  // Load chat history when component mounts or document changes
  useEffect(() => {
    if (ragService && isInitialized) {
      loadChatHistory();
    }
  }, [ragService, isInitialized, selectedDocument]);

  const initializeRAGService = async () => {
    try {
      setIsLoading(true);
      
      // Use existing service if provided (avoids re-initialization and rate limits)
      if (existingRAGService) {
        console.log('Using existing RAG service to avoid rate limits');
        setRagService(existingRAGService);
        setIsInitialized(true);
        return;
      }

      // Only create new service if none provided
      console.log('Creating new RAG service...');
      const rag = new RAGService(defaultConfig);
      // Initialize without forced connection test to avoid rate limits
      await rag.initialize(false);
      setRagService(rag);
      setIsInitialized(true);
    } catch (error) {
      console.error('Error initializing RAG service:', error);
      Alert.alert(
        'Initialization Error', 
        'Failed to initialize chat service. This might be due to rate limiting. Please wait a moment and try again.',
        [
          { text: 'OK', style: 'default' },
          { text: 'Retry', style: 'default', onPress: () => setTimeout(initializeRAGService, 5000) }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadChatHistory = async () => {
    if (!ragService) return;

    try {
      // Load chat history for this specific chat session
      // Use the primary document or chat ID for history retrieval
      const primaryDocumentId = chatSources.length > 0 ? chatSources[0].$id : selectedDocument?.$id;
      
      const history = await ragService.getChatHistory(
        userId,
        primaryDocumentId
      );

      const chatMessages: ChatMessage[] = history.map(chat => ({
        id: chat.$id!,
        message: chat.message,
        response: chat.response,
        timestamp: chat.createdAt,
      }));

      setMessages(chatMessages.reverse()); // Show oldest first
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  // Handle adding a source to this chat
  const handleAddSourceToChat = (source: Document) => {
    if (!chatSources.find(s => s.$id === source.$id)) {
      setChatSources(prev => [...prev, source]);
      setAvailableSources(prev => prev.filter(s => s.$id !== source.$id));
    }
    setShowAddSourceModal(false);
  };

  // Handle removing a source from this chat
  const handleRemoveSourceFromChat = (source: Document) => {
    setChatSources(prev => prev.filter(s => s.$id !== source.$id));
    setAvailableSources(prev => [...prev, source]);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !ragService || isLoading) return;

    const userMessage = inputText.trim();
    const messageId = Date.now().toString();

    // Add user message to UI immediately
    const newMessage: ChatMessage = {
      id: messageId,
      message: userMessage,
      response: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      setIsLoading(true);

      // Chat with all sources in this chat, not just the selected document
      const documentIds = chatSources.map(source => source.$id).filter(Boolean) as string[];
      const primaryDocumentId = documentIds.length > 0 ? documentIds[0] : undefined;
      
      const chatResponse: ChatResponse = await ragService.chatWithDocument(
        userId,
        userMessage,
        primaryDocumentId // Use the first source as primary, but RAG should search across all user documents
      );

      // Update message with response
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? {
              ...msg,
              response: chatResponse.response,
              sources: chatResponse.sources,
              isLoading: false,
            }
            : msg
        )
      );
    } catch (error: any) {
      console.error('Error sending message:', error);

      // Update message with error
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? {
              ...msg,
              response: `Error: ${error?.message || String(error) || 'Failed to get response'}`,
              isLoading: false,
            }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={styles.messageContainer}>
      {/* User Message */}
      <View style={styles.userMessageContainer}>
        <Text style={styles.userMessage}>{item.message}</Text>
        <Text style={styles.timestamp}>
          {item.timestamp.toLocaleTimeString()}
        </Text>
      </View>

      {/* AI Response */}
      <View style={styles.aiMessageContainer}>
        {item.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        ) : (
          <>
            <Text style={styles.aiMessage}>{item.response}</Text>

            {/* Sources */}
            {item.sources && item.sources.length > 0 && (
              <View style={styles.sourcesContainer}>
                <Text style={styles.sourcesTitle}>Sources:</Text>
                {item.sources.map((source, index) => (
                  <View key={source.chunkId} style={styles.sourceItem}>
                    <Text style={styles.sourceText} numberOfLines={2}>
                      {index + 1}. {source.text.substring(0, 100)}...
                    </Text>
                    <Text style={styles.sourceScore}>
                      Score: {(source.score * 100).toFixed(1)}%
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingScreenText}>Initializing chat service...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render sources tab content
  const renderSourcesTab = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.sourcesContainer}>
      <View style={styles.sourcesHeader}>
        <Text style={styles.sourcesTitle}>Sources</Text>
        <Text style={styles.sourcesSubtitle}>{chatSources.length} source{chatSources.length !== 1 ? 's' : ''}</Text>
      </View>

      {chatSources.map((source: Document, index: number) => (
        <View key={source.$id} style={styles.sourceCard}>
          <View style={styles.sourceIcon}>
            <Text style={styles.sourceEmoji}>📄</Text>
          </View>
          <View style={styles.sourceInfo}>
            <Text style={styles.sourceTitle} numberOfLines={2}>
              {source.title}
            </Text>
            <Text style={styles.sourceMeta}>
              {(source as any).pageCount || 'Unknown'} pages • {new Date(source.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.sourceActions}
            onPress={() => handleRemoveSourceFromChat(source)}
          >
            <Text style={styles.sourceActionIcon}>⋯</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.addSourceButton} onPress={() => setShowAddSourceModal(true)}>
        <Text style={styles.addSourceIcon}>+</Text>
        <Text style={styles.addSourceText}>Add source</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Render chat tab content
  const renderChatTab = () => (
    <View style={styles.chatContainer}>
      {messages.length === 0 ? (
        <View style={styles.chatWelcome}>
          <View style={styles.welcomeIcon}>
            <Text style={styles.welcomeEmoji}>💬</Text>
          </View>
          <Text style={styles.welcomeTitle}>
            {chatSources.length > 0 ? chatSources[0].title : 'Chat with your sources'}
          </Text>
          <Text style={styles.welcomeSubtitle}>
            {chatSources.length > 0
              ? `The provided document${chatSources.length > 1 ? 's' : ''} outline${chatSources.length === 1 ? 's' : ''} ${chatSources.map(s => s.title).join(', ')}.`
              : 'Ask questions about your uploaded documents.'
            }
          </Text>
          <View style={styles.askSection}>
            <Text style={styles.askLabel}>Ask {chatSources.length || 0} source{chatSources.length !== 1 ? 's' : ''}...</Text>
            <View style={styles.sourceIndicator}>
              <Text style={styles.sourceCount}>📄{chatSources.length}</Text>
            </View>
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Chat Input */}
      <View style={styles.chatInputContainer}>
        <TextInput
          style={styles.chatInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask about your sources..."
          placeholderTextColor="#999"
          multiline
          maxLength={500}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={isLoading || !inputText.trim()}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>↗</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingScreenText}>Initializing chat service...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              {chatSources.length > 0 
                ? chatSources.length === 1 
                  ? chatSources[0].title
                  : `${chatSources.length} Sources Chat`
                : 'Chat with Sources'
              }
            </Text>
          </View>
          <TouchableOpacity style={styles.headerAction}>
            <Text style={styles.headerActionText}>⋯</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.contentContainer}>
          {activeTab === 'sources' ? renderSourcesTab() : renderChatTab()}
        </View>

        {/* Bottom Navigation */}
        <View style={styles.bottomNavigation}>
          <TouchableOpacity
            style={[styles.navTab, activeTab === 'sources' && styles.activeNavTab]}
            onPress={() => setActiveTab('sources')}
          >
            <Text style={styles.navIcon}>📑</Text>
            <Text style={[styles.navLabel, activeTab === 'sources' && styles.activeNavLabel]}>
              Sources
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, activeTab === 'chat' && styles.activeNavTab]}
            onPress={() => setActiveTab('chat')}
          >
            <Text style={styles.navIcon}>💬</Text>
            <Text style={[styles.navLabel, activeTab === 'chat' && styles.activeNavLabel]}>
              Chat
            </Text>
          </TouchableOpacity>

          <View style={styles.navTab}>
            <Text style={[styles.navIcon, styles.disabledIcon]}>🎨</Text>
            <Text style={[styles.navLabel, styles.disabledLabel]}>Studio</Text>
          </View>
        </View>

        {/* Add Source Modal */}
        <Modal
          visible={showAddSourceModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowAddSourceModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Source</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowAddSourceModal(false)}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={styles.modalSubtitle}>Available Documents</Text>
                {availableSources.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                      No additional sources available. Upload more documents from the dashboard.
                    </Text>
                  </View>
                ) : (
                  availableSources.map((source: Document) => (
                    <TouchableOpacity
                      key={source.$id}
                      style={styles.availableSourceCard}
                      onPress={() => handleAddSourceToChat(source)}
                    >
                      <View style={styles.sourceIcon}>
                        <Text style={styles.sourceEmoji}>📄</Text>
                      </View>
                      <View style={styles.sourceInfo}>
                        <Text style={styles.sourceTitle} numberOfLines={2}>
                          {source.title}
                        </Text>
                        <Text style={styles.sourceMeta}>
                          {(source as any).pageCount || 'Unknown'} pages • {new Date(source.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={styles.addIcon}>
                        <Text style={styles.addIconText}>+</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2c2c2e',
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingScreenText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1c1c1e',
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3c',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '500',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
  },
  headerAction: {
    padding: 8,
  },
  headerActionText: {
    fontSize: 20,
    color: '#999',
  },
  contentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  
  // Sources Tab Styles
  sourcesContainer: {
    padding: 16,
  },
  sourcesHeader: {
    marginBottom: 20,
  },
  sourcesTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  sourcesSubtitle: {
    fontSize: 14,
    color: '#999',
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  sourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#3a3a3c',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sourceEmoji: {
    fontSize: 20,
  },
  sourceInfo: {
    flex: 1,
  },
  sourceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  sourceMeta: {
    fontSize: 14,
    color: '#999',
  },
  sourceActions: {
    padding: 8,
  },
  sourceActionIcon: {
    fontSize: 20,
    color: '#999',
  },
  addSourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a3a3c',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#555',
    borderStyle: 'dashed',
  },
  addSourceIcon: {
    fontSize: 20,
    color: '#007AFF',
    marginRight: 8,
  },
  addSourceText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },

  // Chat Tab Styles
  chatContainer: {
    flex: 1,
  },
  chatWelcome: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  welcomeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3a3a3c',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeEmoji: {
    fontSize: 32,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  askSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  askLabel: {
    fontSize: 16,
    color: '#999',
    flex: 1,
  },
  sourceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceCount: {
    fontSize: 14,
    color: '#007AFF',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#1c1c1e',
    borderTopWidth: 1,
    borderTopColor: '#3a3a3c',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#2c2c2e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
    color: 'white',
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#3a3a3c',
  },
  sendButtonText: {
    fontSize: 18,
    color: 'white',
    fontWeight: '600',
  },

  // Bottom Navigation
  bottomNavigation: {
    flexDirection: 'row',
    backgroundColor: '#1c1c1e',
    borderTopWidth: 1,
    borderTopColor: '#3a3a3c',
    paddingBottom: 8,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeNavTab: {
    borderTopWidth: 2,
    borderTopColor: '#007AFF',
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  navLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  activeNavLabel: {
    color: '#007AFF',
  },
  disabledIcon: {
    opacity: 0.3,
  },
  disabledLabel: {
    opacity: 0.3,
  },

  // Message styles (keeping existing for chat functionality)
  messageContainer: {
    marginBottom: 20,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  userMessage: {
    backgroundColor: '#007AFF',
    color: 'white',
    padding: 12,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    maxWidth: '80%',
    fontSize: 16,
    lineHeight: 20,
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
  },
  aiMessage: {
    backgroundColor: '#1c1c1e',
    color: 'white',
    padding: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    maxWidth: '85%',
    fontSize: 16,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    padding: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#999',
  },
  sourcesContainer_old: {
    marginTop: 12,
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    padding: 12,
  },
  sourcesTitle_old: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
  },
  sourceItem: {
    backgroundColor: '#3a3a3c',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  sourceText: {
    fontSize: 14,
    color: 'white',
    lineHeight: 18,
    marginBottom: 4,
  },
  sourceScore: {
    fontSize: 12,
    color: '#007AFF',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#2c2c2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3c',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#999',
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#999',
    marginVertical: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
  },
  availableSourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  addIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIconText: {
    fontSize: 18,
    color: 'white',
    fontWeight: '600',
  },
});

export default ChatScreen;
