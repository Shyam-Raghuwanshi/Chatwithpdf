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
  Image,
} from 'react-native';
import RAGService, { ChatResponse, ProcessDocumentResult } from '../../utils/RAGService';
import { Document, Chat, Model } from '../../utils/AppwriteDB';
import PdfTextExtractor from '../../utils/PdfTextExtractor';
import DocumentPicker from '../components/DocumentPicker';
import { useServices } from '../../utils/useServices';

// Global cache for models - persists during app session
const ModelsCache = {
  data: null as Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
  }> | null,
  timestamp: 0,
  isLoading: false,

  // Cache duration: 30 minutes (in milliseconds)
  CACHE_DURATION: 30 * 60 * 1000,

  isValid(): boolean {
    return this.data !== null &&
      (Date.now() - this.timestamp) < this.CACHE_DURATION;
  },

  set(data: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
  }>): void {
    this.data = data;
    this.timestamp = Date.now();
  },

  get(): Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
  }> | null {
    return this.isValid() ? this.data : null;
  },

  clear(): void {
    this.data = null;
    this.timestamp = 0;
  }
};

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
  const [activeTab, setActiveTab] = useState<'sources' | 'chat'>('chat');
  const [chatSources, setChatSources] = useState<Document[]>([]); // Sources specific to this chat
  const [availableSources, setAvailableSources] = useState<Document[]>([]); // Available sources to add
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [selectedSourceForAction, setSelectedSourceForAction] = useState<Document | null>(null);
  const [deletingDocument, setDeletingDocument] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [selectedModel, setSelectedModel] = useState('sonar-pro');
  const [availableModels, setAvailableModels] = useState<Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    icon?: string;
  }>>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [showTextInputModal, setShowTextInputModal] = useState(false);
  const [textInputContent, setTextInputContent] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const currentChatId = chatId || `chat_${selectedDocument?.$id || Date.now()}`;

  // Use centralized service management, but prefer external service if provided
  const {
    ragService: centralizedRagService,
    isLoading: servicesLoading,
    isInitialized: servicesInitialized,
    getRagService
  } = useServices({
    autoInitialize: !existingRAGService, // Don't auto-initialize if external service provided
    userId
  });

  // Use external RAG service if provided, otherwise use centralized one
  const ragService = existingRAGService || centralizedRagService;
  const isInitialized = existingRAGService ? true : servicesInitialized;

  // Initialize sources with selected document and manage chat-specific sources
  useEffect(() => {
    // Initialize chat sources with the selected document (if any)
    if (selectedDocument) {
      setChatSources([selectedDocument]);
    }

    // Set available sources (excluding already selected ones and chat-specific documents)
    // Only show global documents in available sources, not documents from other chats
    const available = userDocuments.filter(doc =>
      (!selectedDocument || doc.$id !== selectedDocument.$id) && !doc.chatId
    );
    setAvailableSources(available);
  }, [selectedDocument, userDocuments]);

  // Load chat history when component mounts or document changes
  useEffect(() => {
    if (ragService && isInitialized) {
      loadChatHistory();
      loadChatSpecificDocuments();
      loadAvailableModels();
    }
  }, [ragService, isInitialized, selectedDocument]);

  // Clear models cache when component unmounts or when needed
  useEffect(() => {
    return () => {
      // Optional: Clear cache on unmount (uncomment if you want cache to clear when leaving chat)
      // ModelsCache.clear();
    };
  }, []);

  // Function to manually refresh models (bypassing cache)
  const refreshModels = async () => {
    ModelsCache.clear();
    await loadAvailableModels();
  };

  // Load available models from database with caching
  const loadAvailableModels = async () => {
    if (!ragService) return;

    // Check if we have valid cached data
    const cachedModels = ModelsCache.get();
    if (cachedModels) {
      console.log('Loading models from cache...');
      setAvailableModels(cachedModels);

      // Update selected model if current one is not in the list
      if (cachedModels.length > 0 && !cachedModels.find(m => m.id === selectedModel)) {
        setSelectedModel(cachedModels[0].id);
      }
      return;
    }

    // Prevent multiple simultaneous requests
    if (ModelsCache.isLoading) {
      console.log('Models already loading, skipping duplicate request...');
      return;
    }

    ModelsCache.isLoading = true;
    setModelsLoading(true);

    try {
      console.log('Loading available models from database...');
      const models = await ragService.getModels();

      // Parse and transform models data
      const transformedModels: Array<{
        id: string;
        name: string;
        description: string;
        category: string;
        icon: string;
      }> = [];

      // Handle the response structure: array of objects with 'models' property
      for (const modelRecord of models as any[]) {
        try {
          // Extract the models string from the record
          let modelsData;
          if (modelRecord.models && typeof modelRecord.models === 'string') {
            // Parse the models string which contains the array
            modelsData = eval(`(${modelRecord.models})`); // Using eval to handle the JavaScript object syntax
          } else if (typeof modelRecord === 'string') {
            // Fallback: if the entire record is a string
            modelsData = eval(`(${modelRecord})`);
          } else {
            // Direct object
            modelsData = [modelRecord];
          }

          // Process each model in the array
          if (Array.isArray(modelsData)) {
            for (const modelData of modelsData) {
              // Add default icon based on category
              const getIconForCategory = (category: string) => {
                if (!category || typeof category !== 'string') return '🤖';
                switch (category.toLowerCase()) {
                  case 'search': return '🔍';
                  case 'reasoning': return '🧠';
                  case 'research': return '📚';
                  default: return '🤖';
                }
              };

              // Validate required fields
              if (modelData.id && modelData.name && modelData.description && modelData.category) {
                transformedModels.push({
                  id: modelData.id,
                  name: modelData.name,
                  description: modelData.description,
                  category: modelData.category,
                  icon: getIconForCategory(modelData.category)
                });
              }
            }
          }
        } catch (parseError) {
          console.error('Error parsing model record:', parseError, modelRecord);
        }
      }

      // Cache the transformed models
      ModelsCache.set(transformedModels);
      setAvailableModels(transformedModels);
      console.log(`Loaded and cached ${transformedModels.length} models from database`);

      // Update selected model if current one is not in the list
      if (transformedModels.length > 0 && !transformedModels.find(m => m.id === selectedModel)) {
        setSelectedModel(transformedModels[0].id);
      }
    } catch (error) {
      console.error('Error loading models:', error);
      // Fallback to a default model if database fetch fails
      const fallbackModels = [{
        id: 'sonar-pro',
        name: 'Sonar Pro',
        description: 'Default search model',
        category: 'Search',
        icon: '🔍'
      }];

      // Cache the fallback models too
      ModelsCache.set(fallbackModels);
      setAvailableModels(fallbackModels);
    } finally {
      ModelsCache.isLoading = false;
      setModelsLoading(false);
    }
  };

  // Load documents specific to this chat
  const loadChatSpecificDocuments = async () => {
    if (!ragService) return;

    try {
      console.log('Loading chat-specific documents for chat:', currentChatId);
      const chatDocuments = await ragService.getUserDocuments(userId, currentChatId);

      // Add chat-specific documents to sources (excluding the already selected document)
      const newChatSources = chatDocuments.filter(doc =>
        !selectedDocument || doc.$id !== selectedDocument.$id
      );

      if (newChatSources.length > 0) {
        setChatSources(prev => {
          // Merge with existing sources, avoiding duplicates
          const existingIds = new Set(prev.map(s => s.$id));
          const uniqueNewSources = newChatSources.filter(doc => !existingIds.has(doc.$id));
          return [...prev, ...uniqueNewSources];
        });
      }
    } catch (error) {
      console.error('Error loading chat-specific documents:', error);
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

      // Convert new conversation-based format to ChatMessage format for UI
      const chatMessages: ChatMessage[] = [];

      // Group messages by conversationId and process them
      const conversationMap = new Map<string, Chat[]>();
      history.forEach(chat => {
        const convId = chat.conversationId || 'legacy';
        if (!conversationMap.has(convId)) {
          conversationMap.set(convId, []);
        }
        conversationMap.get(convId)!.push(chat);
      });

      // Convert grouped conversations to ChatMessage format
      conversationMap.forEach((messages, conversationId) => {
        if (messages.length === 1 && messages[0].messageType === 'legacy') {
          // Handle legacy single message format - extract from content
          const legacyChat = messages[0];
          if (legacyChat.content.includes('User:') && legacyChat.content.includes('Assistant:')) {
            const parts = legacyChat.content.split('\n\nAssistant: ');
            if (parts.length === 2) {
              const userMessage = parts[0].replace('User: ', '');
              const assistantResponse = parts[1];
              chatMessages.push({
                id: legacyChat.$id!,
                message: userMessage,
                response: assistantResponse,
                timestamp: legacyChat.createdAt,
              });
            }
          }
        } else {
          // Handle new conversation format (user + assistant pairs)
          const sortedMessages = messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          let userMessage = '';
          let assistantResponse = '';
          let messageId = '';
          let timestamp = new Date();

          for (const msg of sortedMessages) {
            if (msg.messageType === 'user') {
              userMessage = msg.content;
              messageId = msg.$id!;
              timestamp = msg.createdAt;
            } else if (msg.messageType === 'assistant') {
              assistantResponse = msg.content;
            }
          }

          if (userMessage && assistantResponse) {
            chatMessages.push({
              id: messageId,
              message: userMessage,
              response: assistantResponse,
              timestamp: timestamp,
            });
          }
        }
      });

      // Sort by timestamp and show oldest first
      chatMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      setMessages(chatMessages);
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

    // Only add back to available sources if it's a global document (not chat-specific)
    if (!source.chatId) {
      setAvailableSources(prev => [...prev, source]);
    }
  };

  // Handle source action menu
  const handleSourceAction = (source: Document) => {
    setSelectedSourceForAction(source);
    setShowSourceDropdown(true);
  };

  // Handle delete source from dropdown
  const handleDeleteSourceFromDropdown = async () => {
    if (!selectedSourceForAction) return;

    setShowSourceDropdown(false);

    // Check if this is a chat-specific document (uploaded in this chat)
    if (selectedSourceForAction.chatId === currentChatId) {
      // This is a chat-specific document, delete it permanently
      Alert.alert(
        'Delete Document',
        `This will permanently delete "${selectedSourceForAction.title}" from your account. This action cannot be undone.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setSelectedSourceForAction(null)
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteChatSpecificDocument(selectedSourceForAction)
          }
        ]
      );
    } else {
      // This is a global document, just remove from chat
      handleRemoveSourceFromChat(selectedSourceForAction);
      setSelectedSourceForAction(null);
    }
  };

  // Delete chat-specific document permanently
  const deleteChatSpecificDocument = async (document: Document) => {
    if (!ragService || !document.$id) {
      Alert.alert('Error', 'Unable to delete document at this time.');
      setSelectedSourceForAction(null);
      return;
    }

    setDeletingDocument(true);
    try {
      console.log('Deleting chat-specific document:', document.$id);

      // Delete from database and vector store
      await ragService.deleteDocument(userId, document.$id);

      // Remove from local state
      setChatSources(prev => prev.filter(s => s.$id !== document.$id));

      console.log('Document deleted successfully');
      Alert.alert('Success', 'Document deleted successfully.');

    } catch (error) {
      console.error('Error deleting document:', error);
      Alert.alert('Error', 'Failed to delete document. Please try again.');
    } finally {
      setDeletingDocument(false);
      setSelectedSourceForAction(null);
    }
  };

  // Process document through RAG pipeline
  const processDocumentThroughRAG = async (title: string, text: string, fileUri: string) => {
    let serviceToUse = ragService;

    // Get service if not available
    if (!serviceToUse) {
      try {
        serviceToUse = await getRagService();
      } catch (error) {
        Alert.alert('Error', 'Document processing service not available');
        return;
      }
    }

    console.log('Processing document through RAG pipeline for chat:', currentChatId);
    setProcessing(true);
    try {
      const result: ProcessDocumentResult = await serviceToUse.processDocument(
        userId,
        title,
        text,
        currentChatId // Link document to this specific chat
      );

      if (result.success) {
        console.log(`Document processed successfully: ${result.chunksProcessed} chunks, ${result.totalTokensUsed} tokens used`);

        // Create a document object to add to chat sources
        const newDocument: Document = {
          $id: result.documentId,
          userId: userId,
          title: title,
          embeddingId: undefined, // This will be set internally
          chatId: currentChatId, // Mark as chat-specific
          createdAt: new Date(),
        };

        // Add to current chat sources
        setChatSources(prev => [...prev, newDocument]);

        Alert.alert(
          'Success!',
          `Document processed successfully!\n\n• ${result.chunksProcessed} text chunks created\n• ${result.totalTokensUsed} tokens used\n\nDocument has been added to this chat.`,
          [{ text: 'OK', style: 'default' }]
        );

        // Close the modal
        setShowAddSourceModal(false);
      } else {
        throw new Error(result.error || 'Failed to process document');
      }
    } catch (error: any) {
      console.error('Error processing document:', error);

      let errorMessage = 'Failed to process document for chat';
      let errorTitle = 'Processing Error';

      if (error.message.includes('429') || error.message.includes('Rate limit')) {
        errorTitle = 'Rate Limit Reached';
        errorMessage = 'VoyageAI API limit reached. Please try again in a moment.';
      } else if (error.message.includes('401') || error.message.includes('authentication')) {
        errorTitle = 'Authentication Error';
        errorMessage = 'There was an issue with the AI service authentication.';
      } else if (error.message.includes('Network error')) {
        errorTitle = 'Connection Error';
        errorMessage = 'Unable to connect to the AI service. Please check your internet connection.';
      } else {
        errorMessage = error.message || errorMessage;
      }

      Alert.alert(errorTitle, errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  // Handle PDF upload
  const handlePdfUpload = async () => {
    setUploading(true);

    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf]
      });

      console.log('PDF selection result:', result);
      console.log('Starting PDF text extraction...');

      const response = await PdfTextExtractor.extractPdfText(result?.uri || '');
      console.log('PDF extraction response:', response);

      if (!response.success || !response.text) {
        throw new Error(response.error || 'Failed to extract text from PDF');
      }

      // Process document through RAG pipeline
      if (ragService && response.text) {
        await processDocumentThroughRAG(
          result?.name || 'Uploaded Document',
          response.text,
          result?.uri || ''
        );
      } else {
        Alert.alert('Error', 'Chat service not available');
      }
    } catch (e: any) {
      console.error('PDF upload error:', e);
      Alert.alert('Error', e?.message || 'Failed to upload PDF');
    } finally {
      setUploading(false);
    }
  };

  // Handle other upload types (coming soon)
  const handleWebsiteUpload = () => {
    Alert.alert('Coming Soon', 'Website upload feature will be available soon!');
  };

  const handleYoutubeUpload = () => {
    Alert.alert('Coming Soon', 'YouTube upload feature will be available soon!');
  };

  const handleCopiedTextUpload = () => {
    Alert.alert(
      'Add Text Content',
      'Enter the text you want to add to this chat:',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Add Text',
          onPress: () => {
            // Show text input modal
            setShowTextInputModal(true);
          }
        }
      ]
    );
  };

  // Handle text input submission
  const handleTextInputSubmit = async () => {
    if (!textInputContent.trim()) {
      Alert.alert('Error', 'Please enter some text content.');
      return;
    }

    setShowTextInputModal(false);

    try {
      setProcessing(true);

      // Generate a title from the first few words
      const words = textInputContent.trim().split(' ');
      const title = words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');

      // Process the text through RAG pipeline
      await processDocumentThroughRAG(
        `Text: ${title}`,
        textInputContent.trim(),
        '' // No file URI for text input
      );

      // Clear the input
      setTextInputContent('');

    } catch (error: any) {
      console.error('Error processing text:', error);
      Alert.alert('Error', error?.message || 'Failed to process text');
      setProcessing(false);
    }
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
        primaryDocumentId, // Use the first source as primary
        5, // maxSources
        currentChatId // Search within this chat's documents
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
    <View style={styles.sourcesTabContainer}>
      <ScrollView style={styles.tabContent} contentContainerStyle={styles.sourcesContainer}>
        <View style={styles.sourcesHeader}>
          <Text style={styles.sourcesTitle}>Sources</Text>
          <Text style={styles.sourcesSubtitle}>{chatSources.length} source{chatSources.length !== 1 ? 's' : ''}</Text>
        </View>

        {chatSources.map((source: Document, index: number) => (
          <View key={source.$id} style={styles.sourceCard}>
            <View style={styles.sourceInfo}>
              <View style={styles.sourceTitleContainer}>
                <Text style={styles.sourceTitle} numberOfLines={2}>
                  {source.title}
                </Text>
                {source.chatId === currentChatId && (
                  <View style={styles.chatSpecificBadge}>
                    <Text style={styles.chatSpecificText}>Chat-only</Text>
                  </View>
                )}
              </View>
              <Text style={styles.sourceMeta}>
                {(source as any).pageCount || 'Unknown'} pages • {new Date(source.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.sourceActions}
              onPress={() => handleSourceAction(source)}
            >
              <Text style={styles.sourceActionIcon}>⋯</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View style={styles.addSourceButtonContainer}>
        <TouchableOpacity style={styles.addSourceButton} onPress={() => setShowAddSourceModal(true)}>
          <Image
            style={{ width: 12, height: 12, marginRight: 8 }}
            source={require('../../assets/icons/plus.png')}
          />
          <Text style={styles.addSourceText}>Add Document</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render chat tab content
  const renderChatTab = () => (
    <View style={styles.chatContainer}>
      {messages.length === 0 ? (
        <View style={styles.chatWelcome}>
          <View style={styles.welcomeIcon}>
            <Text style={styles.welcomeEmoji}>💬</Text>
          </View>
          <Text style={styles.welcomeTitle}>Start Chat.</Text>
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
          style={styles.modelSelectorButton}
          onPress={() => setShowModelSelector(true)}
        >
          <Image
            style={styles.navIcon}
            source={require('../../assets/icons/model.png')}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={isLoading || !inputText.trim()}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Image
              style={styles.navIcon}
              source={require('../../assets/icons/send.png')}
            />
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
            <Image
              style={{ width: 16, height: 16, marginRight: 8 }}
              source={require('../../assets/icons/back-arrow.png')}
            />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text numberOfLines={1} style={styles.headerTitle}>
              {chatSources.length > 0
                ? chatSources.length === 1
                  ? chatSources[0].title
                  : `${chatSources.length} Sources Chat`
                : 'Chat with Sources'
              }
            </Text>
          </View>
          <TouchableOpacity style={{ paddingLeft: 20 }}>
            <Image
              source={require('../../assets/icons/dots-horizontal.png')}
            />
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
            <Image
              style={styles.navIcon}
              source={require('../../assets/icons/file-fill.png')}
            />
            <Text style={[styles.navLabel, activeTab === 'sources' && styles.activeNavLabel]}>
              Sources
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, activeTab === 'chat' && styles.activeNavTab]}
            onPress={() => setActiveTab('chat')}
          >
            <Image
              style={styles.navIcon}
              source={require('../../assets/icons/chat-fill.png')}
            />
            <Text style={[styles.navLabel, activeTab === 'chat' && styles.activeNavLabel]}>
              Chat
            </Text>
          </TouchableOpacity>
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
                {/* Upload New Documents Section */}
                <Text style={styles.modalSubtitle}>Upload New Document</Text>
                <View style={styles.uploadOptions}>
                  <TouchableOpacity
                    style={[styles.uploadOption, (uploading || processing) && styles.disabledUploadOption]}
                    onPress={handlePdfUpload}
                    disabled={uploading || processing}
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color="#007AFF" />
                    ) : (
                      <Text style={styles.uploadOptionEmoji}>📄</Text>
                    )}
                    <Text style={styles.uploadOptionText}>Document: pdf, doc, docx</Text>
                  </TouchableOpacity>


                  <TouchableOpacity
                    style={[styles.uploadOption, (uploading || processing) && styles.disabledUploadOption]}
                    onPress={handleCopiedTextUpload}
                    disabled={uploading || processing}
                  >
                    <Text style={styles.uploadOptionEmoji}>📝</Text>
                    <Text style={styles.uploadOptionText}>Copied text</Text>
                  </TouchableOpacity>
                </View>

                {processing && (
                  <View style={styles.processingIndicator}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.processingText}>Processing document...</Text>
                  </View>
                )}

                {/* Existing Documents Section */}
                {availableSources.length > 0 && (
                  <>
                    <Text style={styles.modalSubtitle}>Available Documents</Text>
                    {availableSources.map((source: Document) => (
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
                    ))}
                  </>
                )}

                {availableSources.length === 0 && !processing && !uploading && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                      No additional sources available. Upload a new document above or add more documents from the dashboard.
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Source Action Dropdown Modal */}
        <Modal
          visible={showSourceDropdown}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSourceDropdown(false)}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowSourceDropdown(false)}
          >
            <View style={styles.dropdownContent}>
              <TouchableOpacity
                style={[styles.dropdownOption, deletingDocument && styles.disabledDropdownOption]}
                onPress={handleDeleteSourceFromDropdown}
                activeOpacity={0.7}
                disabled={deletingDocument}
              >
                {deletingDocument ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Text style={styles.dropdownOptionIcon}>
                    {selectedSourceForAction?.chatId === currentChatId ? '🗑️' : '➖'}
                  </Text>
                )}
                <Text style={styles.dropdownOptionText}>
                  {deletingDocument
                    ? 'Deleting...'
                    : selectedSourceForAction?.chatId === currentChatId
                      ? 'Delete document'
                      : 'Remove from chat'
                  }
                </Text>
              </TouchableOpacity>

              <View style={styles.dropdownSeparator} />

              <TouchableOpacity
                style={[styles.dropdownOption, deletingDocument && styles.disabledDropdownOption]}
                onPress={() => setShowSourceDropdown(false)}
                activeOpacity={0.7}
                disabled={deletingDocument}
              >
                <Text style={styles.dropdownOptionIcon}>❌</Text>
                <Text style={styles.dropdownOptionText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Model Selector Modal */}
        <Modal
          visible={showModelSelector}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowModelSelector(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modelSelectorModal}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderRight}>
                  <TouchableOpacity
                    onPress={refreshModels}
                    disabled={modelsLoading}
                  >
                    <Text>
                      {modelsLoading ? <Image
                        style={styles.rotatingIcon}
                        source={require('../../assets/icons/refresh.png')}
                      /> : <Image
                        style={styles.refreshIcon}
                        source={require('../../assets/icons/refresh.png')}
                      />}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => setShowModelSelector(false)}
                  >
                    <Image
                      style={styles.refreshIcon}
                      source={require('../../assets/icons/x.png')}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>

                {modelsLoading ? (
                  <View style={styles.modelsLoadingContainer}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.modelsLoadingText}>Loading models...</Text>
                  </View>
                ) : availableModels.length === 0 ? (
                  <View style={styles.modelsEmptyContainer}>
                    <Text style={styles.modelsEmptyText}>No models available</Text>
                  </View>
                ) : (
                  availableModels.map((model) => (
                    <TouchableOpacity
                      key={model.id}
                      style={[
                        styles.modelOption,
                        selectedModel === model.id && styles.selectedModelOption
                      ]}
                      onPress={() => {
                        setSelectedModel(model.id);
                        setShowModelSelector(false);
                      }}
                    >
                      <View style={styles.modelInfo}>
                        <View style={styles.modelHeader}>
                          <Text style={styles.modelName}>{model.name}</Text>
                          <View style={styles.modelCategoryBadge}>
                            <Text style={styles.modelCategoryText}>{model.category}</Text>
                          </View>
                        </View>
                        <Text style={styles.modelDescription}>{model.description}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}

                <View style={styles.modelInfoSection}>
                  <Text style={styles.modelInfoTitle}>Model Categories:</Text>
                  {availableModels.length > 0 && (
                    <>
                      {[...new Set(availableModels.map(m => m.category))].map(category => (
                        <Text key={category} style={styles.modelInfoText}>
                          <Text style={styles.modelInfoBold}>{category}:</Text> {
                            category.toLowerCase() === 'search' ? 'Best for quick factual queries and information retrieval' :
                              category.toLowerCase() === 'reasoning' ? 'Ideal for complex analysis and multi-step problem solving' :
                                category.toLowerCase() === 'research' ? 'Perfect for comprehensive reports and in-depth analysis' :
                                  'Advanced AI model for various tasks'
                          }
                        </Text>
                      ))}
                    </>
                  )}
                  {availableModels.length === 0 && !modelsLoading && (
                    <Text style={styles.modelInfoText}>
                      Models will be loaded from your database.
                    </Text>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Text Input Modal */}
        <Modal
          visible={showTextInputModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowTextInputModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.textInputModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Text Content</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => {
                    setShowTextInputModal(false);
                    setTextInputContent('');
                  }}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.textInputModalBody}>
                <Text style={styles.textInputLabel}>
                  Paste or type the text content you want to add to this chat:
                </Text>

                <TextInput
                  style={styles.textInputField}
                  value={textInputContent}
                  onChangeText={setTextInputContent}
                  placeholder="Enter your text content here..."
                  placeholderTextColor="#999"
                  multiline
                  textAlignVertical="top"
                  maxLength={10000}
                />

                <View style={styles.textInputFooter}>
                  <Text style={styles.characterCount}>
                    {textInputContent.length}/10,000 characters
                  </Text>

                  <View style={styles.textInputActions}>
                    <TouchableOpacity
                      style={styles.textInputCancelButton}
                      onPress={() => {
                        setShowTextInputModal(false);
                        setTextInputContent('');
                      }}
                    >
                      <Text style={styles.textInputCancelText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.textInputSubmitButton,
                        !textInputContent.trim() && styles.textInputSubmitButtonDisabled
                      ]}
                      onPress={handleTextInputSubmit}
                      disabled={!textInputContent.trim() || processing}
                    >
                      {processing ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.textInputSubmitText}>Add Text</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
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
  headerSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
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
  sourcesTabContainer: {
    flex: 1,
  },
  sourcesContainer: {
    padding: 16,
    paddingBottom: 0, // Remove bottom padding since button is now separate
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
  sourceTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sourceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    flex: 1,
  },
  chatSpecificBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  chatSpecificText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
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
  addSourceButtonContainer: {
    padding: 16,
    paddingTop: 8,
    backgroundColor: '#2c2c2e',
    borderTopWidth: 1,
    borderTopColor: '#3a3a3c',
  },
  addSourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF734C',
    borderRadius: 30,
    gap: 6,
    padding: 16,
    borderColor: '#555',
    borderStyle: 'dashed',
  },
  addSourceText: {
    fontSize: 16,
    color: 'white',
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
    gap: 8,
  },
  sourceCount: {
    fontSize: 14,
    color: '#007AFF',
  },
  modelIndicator: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#3a3a3c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
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
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
    color: 'white',
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  modelSelectorButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  modelSelectorText: {
    fontSize: 16,
  },
  sendButton: {
    display: 'flex',
    width: 45,
    height: 45,
    borderRadius: 10,
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
    borderTopColor: '#FF734C',
  },
  navIcon: {
    marginBottom: 4,
    height: 25,
    width: 25,
  },
  rotatingIcon: {
    transform: [{ rotate: '360deg' }],
    marginBottom: 4,
    height: 25,
    width: 25,
  },
  navLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  activeNavLabel: {
    color: '#FF734C',
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
    color: 'white',
    padding: 12,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    fontSize: 16,
    lineHeight: 20,
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
  },
  aiMessage: {
    color: 'white',
    padding: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
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
    minHeight: '50%', // Ensure minimum height
    paddingTop: 20,
    flex: 1, // Take available space
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
  modalHeaderLeft: {
    flex: 1,
  },
  modalHeaderRight: {
    flex: 1,
    justifyContent: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refreshIcon: {
    height: 20,
    width: 20
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#3a3a3c',
  },
  refreshButtonText: {
    fontSize: 16,
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
    paddingBottom: 20, // Add bottom padding
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

  // Upload Options Styles
  uploadOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  uploadOption: {
    width: '48%',
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  disabledUploadOption: {
    opacity: 0.6,
  },
  uploadOptionEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  uploadOptionText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    marginBottom: 16,
  },
  processingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#007AFF',
  },

  // Dropdown Styles
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContent: {
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    minWidth: 200,
    paddingVertical: 8,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#3a3a3c',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  disabledDropdownOption: {
    opacity: 0.6,
  },
  dropdownOptionIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  dropdownOptionText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
    flex: 1,
  },
  dropdownSeparator: {
    height: 1,
    backgroundColor: '#3a3a3c',
    marginHorizontal: 12,
    marginVertical: 4,
  },

  // Model Selector Styles
  modelSelectorModal: {
    backgroundColor: '#2c2c2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    minHeight: '50%',
    paddingTop: 20,
  },
  modelCategoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 16,
  },
  cacheIndicator: {
    fontSize: 12,
    fontWeight: '400',
    color: '#666',
  },
  modelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  selectedModelOption: {
    borderColor: '#007AFF',
    backgroundColor: '#0A1A2A',
  },
  modelIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#3a3a3c',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modelIconText: {
    fontSize: 20,
  },
  modelInfo: {
    flex: 1,
  },
  modelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modelName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    flex: 1,
  },
  modelCategoryBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  modelCategoryText: {
    fontSize: 11,
    color: 'white',
    fontWeight: '600',
  },
  modelDescription: {
    fontSize: 14,
    color: '#999',
    lineHeight: 18,
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  selectedIndicatorText: {
    fontSize: 14,
    color: 'white',
    fontWeight: 'bold',
  },
  modelInfoSection: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  modelInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 12,
  },
  modelInfoText: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
    marginBottom: 8,
  },
  modelInfoBold: {
    fontWeight: '600',
    color: '#007AFF',
  },

  // Model loading states
  modelsLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modelsLoadingText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#999',
  },
  modelsEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modelsEmptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },

  // Text Input Modal Styles
  textInputModalContent: {
    backgroundColor: '#2c2c2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '60%',
    paddingTop: 20,
  },
  textInputModalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  textInputLabel: {
    fontSize: 16,
    color: '#999',
    marginBottom: 16,
    lineHeight: 22,
  },
  textInputField: {
    flex: 1,
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: 'white',
    borderWidth: 1,
    borderColor: '#3a3a3c',
    minHeight: 150,
  },
  textInputFooter: {
    marginTop: 16,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginBottom: 12,
  },
  textInputActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  textInputCancelButton: {
    flex: 1,
    backgroundColor: '#3a3a3c',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  textInputCancelText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
  },
  textInputSubmitButton: {
    flex: 1,
    backgroundColor: '#FF734C',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  textInputSubmitButtonDisabled: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  textInputSubmitText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
});

export default ChatScreen;
