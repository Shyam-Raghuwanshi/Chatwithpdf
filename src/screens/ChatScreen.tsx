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
}

const ChatScreen: React.FC<Props> = ({ userId, selectedDocument, onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ragService, setRagService] = useState<RAGService | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Initialize RAG service
  useEffect(() => {
    initializeRAGService();
  }, []);

  // Load chat history when component mounts or document changes
  useEffect(() => {
    if (ragService && isInitialized) {
      loadChatHistory();
    }
  }, [ragService, isInitialized, selectedDocument]);

  const initializeRAGService = async () => {
    try {
      setIsLoading(true);
      const rag = new RAGService(defaultConfig);
      await rag.initialize();
      setRagService(rag);
      setIsInitialized(true);
    } catch (error) {
      console.error('Error initializing RAG service:', error);
      Alert.alert('Error', 'Failed to initialize chat service. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadChatHistory = async () => {
    if (!ragService) return;

    try {
      const history = await ragService.getChatHistory(
        userId,
        selectedDocument?.$id
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

      const chatResponse: ChatResponse = await ragService.chatWithDocument(
        userId,
        userMessage,
        selectedDocument?.$id
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
              response: `Error: ${error.message || 'Failed to get response'}`,
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text style={styles.headerTitleText}>Chat with PDF</Text>
            {selectedDocument && (
              <Text style={styles.headerSubtitle}>{selectedDocument.title}</Text>
            )}
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask a question about your document..."
            multiline
            maxLength={500}
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={isLoading || !inputText.trim()}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingScreenText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 24,
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 12,
    maxWidth: '80%',
    marginBottom: 8,
  },
  userMessage: {
    color: 'white',
    fontSize: 16,
  },
  timestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  aiMessageContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  aiMessage: {
    color: '#333',
    fontSize: 16,
    lineHeight: 22,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  sourcesContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  sourcesTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  sourceItem: {
    marginBottom: 6,
    padding: 6,
    backgroundColor: 'white',
    borderRadius: 4,
  },
  sourceText: {
    fontSize: 11,
    color: '#333',
    lineHeight: 16,
  },
  sourceScore: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ChatScreen;
