import TextChunker, { TextChunk } from './TextChunker';
import VoyageAIEmbedding from './VoyageAIEmbedding';
import QdrantVectorDB from './QdrantVectorDB';
import AppwriteDB, { Document, Chat, UserProfile } from './AppwriteDB';
import PerplexityAI, { ChatContext, PerplexityResponse } from './PerplexityAI';
import TokenUtils from './TokenUtils';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export interface RAGConfig {
  appwrite: {
    endpoint: string;
    projectId: string;
    databaseId: string;
  };
  qdrant: {
    url: string;
    apiKey?: string;
  };
  voyageAI: {
    apiKey?: string;
    model?: string;
    usageTier?: 1 | 2 | 3;
  };
  perplexity: {
    apiKey?: string;
    model?: string;
  };
  chunking: {
    chunkSize?: number;
    overlap?: number;
    preserveParagraphs?: boolean;
    minChunkSize?: number;
  };
}

export interface ProcessDocumentResult {
  documentId: string;
  chunksProcessed: number;
  totalTokensUsed: number;
  success: boolean;
  error?: string;
}

export interface ChatResponse {
  response: string;
  sources: Array<{
    chunkId: string;
    text: string;
    score: number;
    documentTitle?: string;
  }>;
  tokensUsed: number;
}

export class RAGService {
  private textChunker: typeof TextChunker;
  private embeddingService: VoyageAIEmbedding;
  private vectorDB: QdrantVectorDB;
  private appwriteDB: AppwriteDB;
  private perplexityAI: PerplexityAI;
  private config: RAGConfig;
  private readonly COLLECTION_NAME = 'document_embeddings';
  private isInitialized: boolean = false;
  private lastInitializationTime: number = 0;

  constructor(config: RAGConfig) {
    this.config = config;
    this.textChunker = TextChunker;
    this.embeddingService = VoyageAIEmbedding.getInstance(config.voyageAI);
    this.vectorDB = new QdrantVectorDB();
    this.appwriteDB = new AppwriteDB(config.appwrite);
    this.perplexityAI = new PerplexityAI(config.perplexity);
  }

  /**
   * Reinitialize after authentication (useful for OAuth flows)
   */
  reinitializeAfterAuth(): void {
    this.appwriteDB = new AppwriteDB(this.config.appwrite);
  }

  /**
   * Set authentication session for database operations
   */
  setAuthSession(session: string): void {
    this.appwriteDB.setSession(session);
  }

  /**
   * Test database authentication
   */
  async testDatabaseAuth(): Promise<{ isAuthenticated: boolean; user?: any; error?: string }> {
    return this.appwriteDB.testAuthentication();
  }

  /**
   * Test collection access and permissions
   */
  async testCollectionAccess(): Promise<void> {
    return this.appwriteDB.testCollectionAccess();
  }

  /**
   * Try to create OAuth session for database access
   */
  async createDatabaseOAuthSession(provider: string = 'google'): Promise<void> {
    return this.appwriteDB.createOAuthSession(provider);
  }

  /**
   * Try to fix authentication by creating anonymous session
   */
  async fixAuthentication(): Promise<void> {
    return this.appwriteDB.createAnonymousSessionAndAuth();
  }

  /**
   * Initialize the RAG system with ultra-fast startup
   */
  async initialize(forceTest: boolean = false): Promise<void> {
    try {
      console.log('🚀 RAG: Ultra-fast initialization starting...');
      
      // Skip expensive connection tests completely for speed
      if (!forceTest) {
        console.log('⚡ RAG: Skipping connection tests for speed');
        
        // Just initialize collection with default vector size - super fast
        let vectorSize = 1536; // Default for voyage-large-2
        await this.vectorDB.initializeCollection(this.COLLECTION_NAME, vectorSize);
        
        this.isInitialized = true;
        this.lastInitializationTime = Date.now();
        console.log('✅ RAG: Ultra-fast initialization completed in <100ms');
        return;
      }

      // Only do full initialization if explicitly requested
      console.log('🔍 RAG: Full initialization with tests...');
      
      // Skip expensive connection tests if recently initialized (within 5 minutes)
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      const recentlyInitialized = (now - this.lastInitializationTime) < fiveMinutes;
      
      if (this.isInitialized && recentlyInitialized) {
        console.log('♻️ RAG: Already initialized recently, skipping tests');
        return;
      }

      // Only test connections if forced or not recently tested
      console.log('🔍 Testing embedding service connection...');
      const embeddingTest = await this.embeddingService.testConnection();
      if (!embeddingTest) {
        console.warn('⚠️ VoyageAI connection test failed, but continuing (may be rate limited)');
        // Don't throw error - the service might still work for actual requests
      }

      console.log('🔍 Testing vector database connection...');
      const vectorDBTest = await this.vectorDB.testConnection();
      if (!vectorDBTest) {
        throw new Error('Failed to connect to Qdrant vector database');
      }

      // Initialize collection with default vector size if we can't get it dynamically
      let vectorSize = 1536; // Default for voyage-large-2
      try {
        vectorSize = await this.embeddingService.getEmbeddingDimension();
      } catch (error) {
        console.warn('Could not get embedding dimension, using default (1536):', error);
      }
      
      await this.vectorDB.initializeCollection(this.COLLECTION_NAME, vectorSize);

      this.isInitialized = true;
      this.lastInitializationTime = now;
      console.log('✅ RAG: Full initialization completed');
    } catch (error) {
      console.error('❌ RAG: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Process a document through the RAG pipeline
   */
  async processDocument(
    userId: string,
    documentTitle: string,
    textContent: string,
    chatId?: string // Optional: associates document with specific chat
  ): Promise<ProcessDocumentResult> {
    try {
      console.log(`Processing document: ${documentTitle}${chatId ? ` (for chat: ${chatId})` : ''}`);
      
      // Ensure user profile exists before processing
      await this.appwriteDB.ensureUserProfile(userId);
      
      // Check if user has enough tokens (rough estimation)
      const estimatedTokens = Math.ceil(textContent.length / 4) * 0.1; // Rough estimation for processing cost
      // const hasTokens = await this.appwriteDB.checkTokenLimit(userId, estimatedTokens);
      const hasTokens = true; // Temporary bypass for testing
      if (!hasTokens) {
        throw new Error('Insufficient tokens to process document');
      }

      // Generate unique document ID
      const documentId = uuidv4();

      // Step 1: Chunk the text
      const chunks = this.textChunker.chunkDocument(
        textContent,
        documentId,
        documentTitle,
        this.config.chunking
      );

      console.log(chunks)

      // return new Promise((resolve) => resolve({
      //   documentId: '',
      //   chunksProcessed: 0,
      //   totalTokensUsed: 0,
      //   success: true,
      // }))
      if (chunks.length === 0) {
        throw new Error('No chunks generated from document text');
      }

      console.log(`Generated ${chunks.length} chunks`);

      // Step 2: Generate embeddings for chunks
      const chunkTexts = chunks.map(chunk => chunk.text);
      const embeddings = await this.embeddingService.generateEmbeddingsBatch(
        chunkTexts,
        'document'
      );

      console.log(`Generated embeddings for ${embeddings} chunks`);

      // Step 3: Store embeddings in vector database
      const chunksWithEmbeddings = chunks.map((chunk, index) => ({
        id: chunk.id,
        text: chunk.text,
        embedding: embeddings[index],
        metadata: {
          ...chunk.metadata,
          userId,
          chunkIndex: chunk.chunkIndex,
          startIndex: chunk.startIndex,
          endIndex: chunk.endIndex,
          chatId, // Include chatId in metadata for filtering
        },
      }));

      await this.vectorDB.storeDocumentChunks(this.COLLECTION_NAME, chunksWithEmbeddings);

      // Step 4: Store document metadata in Appwrite
      const documentData: Omit<Document, '$id'> = {
        userId,
        title: documentTitle,
        embeddingId: documentId,
        createdAt: new Date(),
      };

      // Include chatId if provided (for chat-specific documents)
      if (chatId) {
        documentData.chatId = chatId;
      }

      const document = await this.appwriteDB.storeDocument(documentData);

      // Update token usage
      await this.appwriteDB.updateTokenUsage(userId, Math.ceil(estimatedTokens));

      console.log(`Document processed successfully: ${documentId}${chatId ? ` (linked to chat: ${chatId})` : ''}`);

      return {
        documentId: document.$id!,
        chunksProcessed: chunks.length,
        totalTokensUsed: Math.ceil(estimatedTokens),
        success: true,
      };
    } catch (error) {
      console.error('Error processing document:', error);
      return {
        documentId: '',
        chunksProcessed: 0,
        totalTokensUsed: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Chat with a document using RAG with Perplexity fallback
   */
  async chatWithDocument(
    userId: string,
    message: string,
    documentId?: string,
    maxSources: number = 5,
    chatId?: string // Optional: search within chat-specific documents
  ): Promise<ChatResponse> {
    try {
      console.log(`Processing chat message for user: ${userId}${chatId ? ` (chat: ${chatId})` : ''}`);
      
      // Ensure user profile exists before processing
      await this.appwriteDB.ensureUserProfile(userId);

      // Check token limit
      const estimatedTokens = Math.ceil(message.length / 4) * 2; // Rough estimation
      const hasTokens = await this.appwriteDB.checkTokenLimit(userId, estimatedTokens);
      if (!hasTokens) {
        throw new Error('Insufficient tokens for chat');
      }

      // Try vector search first, fall back to Perplexity if VoyageAI is rate limited
      let chatResponse: ChatResponse;
      
      try {
        // Step 1: Generate embedding for the query
        console.log('🔍 Generating query embedding with VoyageAI...');
        const queryEmbedding = await this.embeddingService.generateEmbedding(message, 'query');

        // Step 2: Search for relevant chunks
        let searchResults;
        if (documentId) {
          // Search within specific document
          const document = await this.appwriteDB.getDocument(documentId);
          if (!document || document.userId !== userId) {
            throw new Error('Document not found or unauthorized');
          }
          // Use the embedding ID directly (no longer encoded with chat info)
          searchResults = await this.vectorDB.searchDocumentChunks(
            this.COLLECTION_NAME,
            queryEmbedding,
            document.embeddingId!,
            maxSources
          );
        } else {
          // Search across user's documents with optional chat filtering
          const searchFilters: Record<string, any> = { userId };
          
          // If chatId is provided, search only within that chat's documents
          if (chatId) {
            searchFilters.chatId = chatId;
          }

          searchResults = await this.vectorDB.searchSimilarChunks(
            this.COLLECTION_NAME,
            queryEmbedding,
            maxSources,
            searchFilters
          );
        }

        // Step 3: Generate response using Perplexity with retrieved context
        const relevantChunks = searchResults.map(result => ({
          text: result.payload.text,
          score: result.score
        }));

        const perplexityResponse = await this.generateResponseWithPerplexity(
          message, 
          relevantChunks, 
          documentId
        );

        // Process token usage - just use total tokens
        const totalTokens = perplexityResponse.tokensUsed || estimatedTokens;

        chatResponse = {
          response: perplexityResponse.response || 'No response generated',
          sources: searchResults.map(result => ({
            chunkId: result.id,
            text: result.payload.text,
            score: result.score,
            documentTitle: result.payload.documentTitle,
          })),
          tokensUsed: totalTokens,
        };

        console.log('✅ Successfully used vector search + Perplexity for chat');

      } catch (embeddingError: any) {
        // If VoyageAI is rate limited, fall back to Perplexity with document content
        if (embeddingError.message.includes('429') || embeddingError.message.includes('Rate limit')) {
          console.log('🚨 VoyageAI rate limited, falling back to Perplexity with document content...');
          
          chatResponse = await this.chatWithPerplexityFallback(
            userId,
            message,
            documentId,
            estimatedTokens,
            chatId
          );
          
          console.log('✅ Successfully used Perplexity fallback for chat');
        } else {
          throw embeddingError;
        }
      }

      // Step 4: Store chat in database using new conversation-based approach
      await this.appwriteDB.storeConversationExchange(
        userId,
        message, // user message
        chatResponse.response, // AI response
        documentId,
        chatId // conversation ID (optional, will be generated if not provided)
      );

      // Update token usage (decrease remaining tokens)
      await this.appwriteDB.updateTokenUsage(userId, chatResponse.tokensUsed);

      return chatResponse;
      
    } catch (error) {
      console.error('Error in chat:', error);
      throw error;
    }
  }

  /**
   * Get user's documents
   */
  async getUserDocuments(userId: string, chatId?: string): Promise<Document[]> {
    return this.appwriteDB.getUserDocuments(userId, 50, chatId);
  }

  /**
   * Ensure user profile exists
   */
  async ensureUserProfile(userId: string): Promise<UserProfile> {
    return await this.appwriteDB.ensureUserProfile(userId);
  }

  /**
   * Get chat history for a user
   */
  async getChatHistory(userId: string, documentId?: string): Promise<Chat[]> {
    return this.appwriteDB.getChatHistory(userId, documentId);
  }

  /**
   * Delete a document and its embeddings
   */
  async deleteDocument(userId: string, documentId: string): Promise<void> {
    try {
      const document = await this.appwriteDB.getDocument(documentId);
      if (!document || document.userId !== userId) {
        throw new Error('Document not found or unauthorized');
      }

      // Delete from vector database
      if (document.embeddingId) {
        await this.vectorDB.deleteDocumentChunks(this.COLLECTION_NAME, document.embeddingId);
      }

      // Delete from Appwrite database
      await this.appwriteDB.deleteDocument(documentId, userId);

      console.log(`Document deleted successfully: ${documentId}`);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Generate response using Perplexity AI with retrieved context
   */
  private async generateResponseWithPerplexity(
    question: string,
    relevantChunks: Array<{ text: string; score: number }>,
    documentId?: string
  ): Promise<PerplexityResponse> {
    try {
      // Get document info if available
      let documentTitle = undefined;
      if (documentId) {
        const document = await this.appwriteDB.getDocument(documentId);
        documentTitle = document?.title;
      }

      // Build context for Perplexity
      const context: ChatContext = {
        documentTitle,
        relevantChunks,
      };

      const result = await this.perplexityAI.generateAnswer(question, context);
      
      if (result.success && result.response) {
        return result;
      } else {
        throw new Error(result.error || 'Failed to generate response with Perplexity');
      }
    } catch (error) {
      console.error('Error generating response with Perplexity:', error);
      throw error;
    }
  }

  /**
   * Fallback chat method using Perplexity with full document content
   */
  private async chatWithPerplexityFallback(
    userId: string,
    message: string,
    documentId?: string,
    estimatedTokens: number = 0,
    chatId?: string
  ): Promise<ChatResponse> {
    try {
      let documentContent = "";
      let documentTitle = "User Documents";
      
      if (documentId) {
        // Get specific document
        const document = await this.appwriteDB.getDocument(documentId);
        if (document && document.userId === userId) {
          documentTitle = document.title;
          documentContent = `Document: ${document.title}\nCreated: ${document.createdAt.toLocaleDateString()}`;
          
          // Note: Without being able to retrieve the actual document content,
          // we'll use the document metadata and let Perplexity work with the question
        }
      } else {
        // Get user documents (chat-specific if chatId provided)
        const userDocuments = await this.appwriteDB.getUserDocuments(userId, 50, chatId);
        documentContent = userDocuments
          .map(doc => `Document: ${doc.title}\nCreated: ${doc.createdAt.toLocaleDateString()}\n`)
          .join('\n');
        documentTitle = `${userDocuments.length} Documents${chatId ? ' (Chat-specific)' : ''}`;
      }

      // Get recent chat history for context
      const recentChats = await this.appwriteDB.getChatHistory(userId, documentId);
      
      // Group chats by conversationId and build Q&A pairs
      const chatHistory: Array<{question: string, answer: string}> = [];
      const conversationMap = new Map<string, {user?: string, assistant?: string}>();
      
      // Process chats to pair user messages with assistant responses
      recentChats.slice(-6).forEach(chat => {
        const conversation = conversationMap.get(chat.conversationId) || {};
        
        if (chat.messageType === 'user') {
          conversation.user = chat.content;
        } else if (chat.messageType === 'assistant') {
          conversation.assistant = chat.content;
        }
        
        conversationMap.set(chat.conversationId, conversation);
        
        // If we have both user and assistant messages, add to history
        if (conversation.user && conversation.assistant) {
          chatHistory.push({
            question: conversation.user,
            answer: conversation.assistant
          });
          // Clear the conversation to avoid duplicates
          conversationMap.set(chat.conversationId, {});
        }
      });
      
      // Take the last 3 complete conversations
      const recentHistory = chatHistory.slice(-3);

      // Build context for Perplexity
      const context: ChatContext = {
        documentTitle,
        documentContent: documentContent.length > 8000 
          ? documentContent.substring(0, 8000) + "\n\n[Content truncated due to length]"
          : documentContent,
        chatHistory: recentHistory
      };

      const result = await this.perplexityAI.generateAnswer(message, context);
      
      if (!result.success || !result.response) {
        throw new Error(result.error || 'Failed to generate response with Perplexity fallback');
      }

      // Process token usage from Perplexity response
      const totalTokens = result.tokensUsed || estimatedTokens;

      return {
        response: result.response,
        sources: [{
          chunkId: 'perplexity-fallback',
          text: 'Response generated using Perplexity AI with document context (VoyageAI rate limited)',
          score: 1.0,
          documentTitle
        }],
        tokensUsed: totalTokens,
      };

    } catch (error) {
      console.error('Error in Perplexity fallback:', error);
      
      // Last resort: simple error response
      return {
        response: "I'm experiencing some technical difficulties accessing your documents right now. This might be due to API rate limits. Please try again in a few moments. If the issue persists, the document analysis service may need some time to reset.",
        sources: [],
        tokensUsed: 0,
      };
    }
  }

  /**
   * Simple response generation (fallback method)
   */
  private async generateResponse(query: string, context: string): Promise<string> {
    // This is a placeholder implementation
    // In a real application, you would integrate with OpenAI, Claude, or another LLM
    
    if (!context.trim()) {
      return "I couldn't find relevant information in your documents to answer that question. Please make sure you've uploaded a relevant document.";
    }

    // Simple keyword-based response generation
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('summary') || queryLower.includes('summarize')) {
      return `Based on your document, here's a summary:\n\n${context.substring(0, 500)}...`;
    }
    
    if (queryLower.includes('what') || queryLower.includes('how') || queryLower.includes('why')) {
      return `Based on the relevant sections from your document:\n\n${context.substring(0, 800)}\n\nThis information should help answer your question about: "${query}"`;
    }

    return `Here's what I found in your document related to "${query}":\n\n${context.substring(0, 600)}...\n\nWould you like me to look for more specific information?`;
  }

  /**
   * Get system status
   */
  async getSystemStatus(): Promise<{
    embeddingService: boolean;
    vectorDatabase: boolean;
    collections: string[];
  }> {
    try {
      const embeddingService = await this.embeddingService.testConnection();
      const vectorDatabase = await this.vectorDB.testConnection();
      const collections = vectorDatabase ? await this.vectorDB.listCollections() : [];

      return {
        embeddingService,
        vectorDatabase,
        collections,
      };
    } catch (error) {
      console.error('Error getting system status:', error);
      return {
        embeddingService: false,
        vectorDatabase: false,
        collections: [],
      };
    }
  }

  /**
   * Update Perplexity model configuration
   */
  updatePerplexityModel(model: string): void {
    this.config.perplexity = {
      ...this.config.perplexity,
      model: model
    };
    this.perplexityAI.updateConfig({ model });
  }

  /**
   * Get current Perplexity model
   */
  getCurrentPerplexityModel(): string {
    return this.config.perplexity?.model || 'sonar-pro';
  }

  /**
   * Generate response using Perplexity AI with retrieved context
   */

  /**
   * Get detailed token statistics for a user
   */
  async getUserTokenStats(userId: string): Promise<{
    profile: UserProfile;
    stats: any;
    limit: any;
  }> {
    try {
      const profile = await this.appwriteDB.getUserProfile(userId);
      if (!profile) {
        throw new Error('User profile not found');
      }

      // Get chat count for average calculation
      const chatHistory = await this.appwriteDB.getChatHistory(userId);
      const totalChats = chatHistory.length;

      // Calculate total tokens used from remaining tokens
      const totalTokensUsed = 10000 - profile.tokenRemaining; // Assuming default 10000

      // Calculate statistics - simplified for tokenRemaining model
      const stats = {
        totalTokens: totalTokensUsed,
        inputTokens: Math.floor(totalTokensUsed * 0.7), // Estimated
        outputTokens: Math.floor(totalTokensUsed * 0.3), // Estimated
        averageTokensPerChat: totalChats > 0 ? Math.round(totalTokensUsed / totalChats) : 0,
        estimatedCost: (totalTokensUsed / 1000) * 0.001, // Rough estimate
      };

      // Check limit status - simplified
      const limit = {
        isNearLimit: profile.tokenRemaining < 1000, // Warning if less than 1000 tokens
        percentUsed: ((10000 - profile.tokenRemaining) / 10000),
        remainingTokens: profile.tokenRemaining,
      };

      return {
        profile,
        stats,
        limit,
      };
    } catch (error) {
      console.error('Error getting user token stats:', error);
      throw error;
    }
  }
}

export default RAGService;
