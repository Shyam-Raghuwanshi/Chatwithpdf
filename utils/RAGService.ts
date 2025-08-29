import TextChunker, { TextChunk } from './TextChunker';
import VoyageAIEmbedding from './VoyageAIEmbedding';
import QdrantVectorDB from './QdrantVectorDB';
import AppwriteDB, { Document, Chat } from './AppwriteDB';
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
  private config: RAGConfig;
  private readonly COLLECTION_NAME = 'document_embeddings';

  constructor(config: RAGConfig) {
    this.config = config;
    this.textChunker = TextChunker;
    this.embeddingService = new VoyageAIEmbedding(config.voyageAI);
    this.vectorDB = new QdrantVectorDB(config.qdrant);
    this.appwriteDB = new AppwriteDB(config.appwrite);
  }

  /**
   * Initialize the RAG system
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing RAG system...');
      
      // Test connections
      const embeddingTest = await this.embeddingService.testConnection();
      if (!embeddingTest) {
        throw new Error('Failed to connect to VoyageAI embedding service');
      }

      const vectorDBTest = await this.vectorDB.testConnection();
      if (!vectorDBTest) {
        throw new Error('Failed to connect to Qdrant vector database');
      }

      // Initialize collection with proper vector size
      const vectorSize = await this.embeddingService.getEmbeddingDimension();
      await this.vectorDB.initializeCollection(this.COLLECTION_NAME, vectorSize);

      console.log('RAG system initialized successfully');
    } catch (error) {
      console.error('Error initializing RAG system:', error);
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
    fileId: string
  ): Promise<ProcessDocumentResult> {
    try {
      console.log(`Processing document: ${documentTitle}`);
      
      // Check if user has enough tokens (rough estimation)
      const estimatedTokens = Math.ceil(textContent.length / 4) * 0.1; // Rough estimation for processing cost
      const hasTokens = await this.appwriteDB.checkTokenLimit(userId, estimatedTokens);
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

      console.log(`Generated embeddings for ${embeddings.length} chunks`);

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
        },
      }));

      await this.vectorDB.storeDocumentChunks(this.COLLECTION_NAME, chunksWithEmbeddings);

      // Step 4: Store document metadata in Appwrite
      const document = await this.appwriteDB.storeDocument({
        userId,
        title: documentTitle,
        fileId,
        textContent: textContent.substring(0, 5000), // Store first 5000 chars as per schema
        embeddingId: documentId,
        createdAt: new Date(),
      });

      // Update token usage
      await this.appwriteDB.updateTokenUsage(userId, Math.ceil(estimatedTokens));

      console.log(`Document processed successfully: ${documentId}`);

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
   * Chat with a document using RAG
   */
  async chatWithDocument(
    userId: string,
    message: string,
    documentId?: string,
    maxSources: number = 5
  ): Promise<ChatResponse> {
    try {
      console.log(`Processing chat message for user: ${userId}`);

      // Check token limit
      const estimatedTokens = Math.ceil(message.length / 4) * 2; // Rough estimation
      const hasTokens = await this.appwriteDB.checkTokenLimit(userId, estimatedTokens);
      if (!hasTokens) {
        throw new Error('Insufficient tokens for chat');
      }

      // Step 1: Generate embedding for the query
      const queryEmbedding = await this.embeddingService.generateEmbedding(message, 'query');

      // Step 2: Search for relevant chunks
      let searchResults;
      if (documentId) {
        // Search within specific document
        const document = await this.appwriteDB.getDocument(documentId);
        if (!document || document.userId !== userId) {
          throw new Error('Document not found or unauthorized');
        }
        searchResults = await this.vectorDB.searchDocumentChunks(
          this.COLLECTION_NAME,
          queryEmbedding,
          document.embeddingId!,
          maxSources
        );
      } else {
        // Search across all user's documents
        searchResults = await this.vectorDB.searchSimilarChunks(
          this.COLLECTION_NAME,
          queryEmbedding,
          maxSources,
          { userId }
        );
      }

      // Step 3: Generate context from search results
      const context = searchResults
        .map(result => result.payload.text)
        .join('\n\n');

      // Step 4: Generate response using the context
      // Note: You'll need to integrate with your preferred LLM here
      // For now, we'll create a simple response based on the retrieved context
      const response = await this.generateResponse(message, context);

      // Step 5: Store chat in database
      await this.appwriteDB.storeChatMessage({
        userId,
        documentId,
        message,
        response,
        tokensUsed: estimatedTokens,
        createdAt: new Date(),
      });

      // Update token usage
      await this.appwriteDB.updateTokenUsage(userId, estimatedTokens);

      return {
        response,
        sources: searchResults.map(result => ({
          chunkId: result.id,
          text: result.payload.text,
          score: result.score,
          documentTitle: result.payload.documentTitle,
        })),
        tokensUsed: estimatedTokens,
      };
    } catch (error) {
      console.error('Error in chat:', error);
      throw error;
    }
  }

  /**
   * Get user's documents
   */
  async getUserDocuments(userId: string): Promise<Document[]> {
    return this.appwriteDB.getUserDocuments(userId);
  }

  /**
   * Get chat history
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
   * Simple response generation (to be replaced with actual LLM integration)
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
}

export default RAGService;
