import { Client, Databases, ID, Query } from 'appwrite';

export interface UserProfile {
  $id?: string;
  userId: string;
  plan: 'free' | 'pro' | 'enterprise';
  tokensUsed: number;
  tokensLimit: number;
  subscriptionValidTill?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  $id?: string;
  userId: string;
  title: string;
  fileId: string;
  textContent?: string;
  embeddingId?: string;
  createdAt: Date;
}

export interface Chat {
  $id?: string;
  userId: string;
  documentId?: string;
  message: string;
  response: string;
  tokensUsed: number;
  createdAt: Date;
}

export interface Plan {
  $id?: string;
  name: string;
  price: number; // in paisa/cents
  tokensLimit: number;
  durationDays: number;
}

export interface AppwriteConfig {
  endpoint: string;
  projectId: string;
  databaseId: string;
}

export class AppwriteDB {
  private client: Client;
  private databases: Databases;
  private config: AppwriteConfig;

  // Collection IDs (should match your Appwrite setup)
  private readonly COLLECTIONS = {
    USER_PROFILES: 'userProfiles',
    DOCUMENTS: 'documents',
    CHATS: 'chats',
    PLANS: 'plans',
  };

  constructor(config: AppwriteConfig) {
    this.config = config;
    this.client = new Client()
      .setEndpoint(config.endpoint)
      .setProject(config.projectId);
    
    this.databases = new Databases(this.client);
  }

  /**
   * Create or update user profile
   */
  async createOrUpdateUserProfile(userId: string, profileData: Partial<UserProfile>): Promise<UserProfile> {
    try {
      // Try to get existing profile first
      const existingProfile = await this.getUserProfile(userId);
      
      if (existingProfile) {
        // Update existing profile
        const updatedProfile = await this.databases.updateDocument(
          this.config.databaseId,
          this.COLLECTIONS.USER_PROFILES,
          existingProfile.$id!,
          {
            ...profileData,
            updatedAt: new Date().toISOString(),
          }
        );
        return this.transformUserProfile(updatedProfile);
      } else {
        // Create new profile
        const newProfile = await this.databases.createDocument(
          this.config.databaseId,
          this.COLLECTIONS.USER_PROFILES,
          ID.unique(),
          {
            userId,
            plan: 'free',
            tokensUsed: 0,
            tokensLimit: 400000,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...profileData,
          }
        );
        return this.transformUserProfile(newProfile);
      }
    } catch (error) {
      console.error('Error creating/updating user profile:', error);
      throw new Error(`Failed to create/update user profile: ${error}`);
    }
  }

  /**
   * Get user profile by userId
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const result = await this.databases.listDocuments(
        this.config.databaseId,
        this.COLLECTIONS.USER_PROFILES,
        [Query.equal('userId', userId)]
      );

      if (result.documents.length === 0) {
        return null;
      }

      return this.transformUserProfile(result.documents[0]);
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Store a document in the database
   */
  async storeDocument(documentData: Omit<Document, '$id'>): Promise<Document> {
    try {
      const document = await this.databases.createDocument(
        this.config.databaseId,
        this.COLLECTIONS.DOCUMENTS,
        ID.unique(),
        {
          ...documentData,
          createdAt: new Date().toISOString(),
        }
      );
      return this.transformDocument(document);
    } catch (error) {
      console.error('Error storing document:', error);
      throw new Error(`Failed to store document: ${error}`);
    }
  }

  /**
   * Get documents for a user
   */
  async getUserDocuments(userId: string, limit: number = 50): Promise<Document[]> {
    try {
      const result = await this.databases.listDocuments(
        this.config.databaseId,
        this.COLLECTIONS.DOCUMENTS,
        [
          Query.equal('userId', userId),
          Query.orderDesc('createdAt'),
          Query.limit(limit),
        ]
      );

      return result.documents.map(doc => this.transformDocument(doc));
    } catch (error) {
      console.error('Error getting user documents:', error);
      throw new Error(`Failed to get user documents: ${error}`);
    }
  }

  /**
   * Get a specific document
   */
  async getDocument(documentId: string): Promise<Document | null> {
    try {
      const document = await this.databases.getDocument(
        this.config.databaseId,
        this.COLLECTIONS.DOCUMENTS,
        documentId
      );
      return this.transformDocument(document);
    } catch (error) {
      console.error('Error getting document:', error);
      return null;
    }
  }

  /**
   * Store a chat message and response
   */
  async storeChatMessage(chatData: Omit<Chat, '$id'>): Promise<Chat> {
    try {
      const chat = await this.databases.createDocument(
        this.config.databaseId,
        this.COLLECTIONS.CHATS,
        ID.unique(),
        {
          ...chatData,
          createdAt: new Date().toISOString(),
        }
      );
      return this.transformChat(chat);
    } catch (error) {
      console.error('Error storing chat message:', error);
      throw new Error(`Failed to store chat message: ${error}`);
    }
  }

  /**
   * Get chat history for a user
   */
  async getChatHistory(
    userId: string,
    documentId?: string,
    limit: number = 50
  ): Promise<Chat[]> {
    try {
      const queries = [
        Query.equal('userId', userId),
        Query.orderDesc('createdAt'),
        Query.limit(limit),
      ];

      if (documentId) {
        queries.push(Query.equal('documentId', documentId));
      }

      const result = await this.databases.listDocuments(
        this.config.databaseId,
        this.COLLECTIONS.CHATS,
        queries
      );

      return result.documents.map(chat => this.transformChat(chat));
    } catch (error) {
      console.error('Error getting chat history:', error);
      throw new Error(`Failed to get chat history: ${error}`);
    }
  }

  /**
   * Update user token usage
   */
  async updateTokenUsage(userId: string, tokensUsed: number): Promise<void> {
    try {
      const profile = await this.getUserProfile(userId);
      if (!profile) {
        throw new Error('User profile not found');
      }

      await this.databases.updateDocument(
        this.config.databaseId,
        this.COLLECTIONS.USER_PROFILES,
        profile.$id!,
        {
          tokensUsed: profile.tokensUsed + tokensUsed,
          updatedAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error('Error updating token usage:', error);
      throw new Error(`Failed to update token usage: ${error}`);
    }
  }

  /**
   * Check if user has enough tokens
   */
  async checkTokenLimit(userId: string, requiredTokens: number): Promise<boolean> {
    try {
      const profile = await this.getUserProfile(userId);
      if (!profile) {
        return false;
      }

      return (profile.tokensUsed + requiredTokens) <= profile.tokensLimit;
    } catch (error) {
      console.error('Error checking token limit:', error);
      return false;
    }
  }

  /**
   * Delete a document and its related data
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    try {
      // Delete associated chats first
      const chats = await this.getChatHistory(userId, documentId);
      for (const chat of chats) {
        await this.databases.deleteDocument(
          this.config.databaseId,
          this.COLLECTIONS.CHATS,
          chat.$id!
        );
      }

      // Delete the document
      await this.databases.deleteDocument(
        this.config.databaseId,
        this.COLLECTIONS.DOCUMENTS,
        documentId
      );
    } catch (error) {
      console.error('Error deleting document:', error);
      throw new Error(`Failed to delete document: ${error}`);
    }
  }

  /**
   * Get available plans
   */
  async getPlans(): Promise<Plan[]> {
    try {
      const result = await this.databases.listDocuments(
        this.config.databaseId,
        this.COLLECTIONS.PLANS
      );

      return result.documents.map(plan => this.transformPlan(plan));
    } catch (error) {
      console.error('Error getting plans:', error);
      throw new Error(`Failed to get plans: ${error}`);
    }
  }

  // Transform functions to convert Appwrite documents to typed interfaces
  private transformUserProfile(doc: any): UserProfile {
    return {
      ...doc,
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt),
      subscriptionValidTill: doc.subscriptionValidTill ? new Date(doc.subscriptionValidTill) : undefined,
    };
  }

  private transformDocument(doc: any): Document {
    return {
      ...doc,
      createdAt: new Date(doc.createdAt),
    };
  }

  private transformChat(doc: any): Chat {
    return {
      ...doc,
      createdAt: new Date(doc.createdAt),
    };
  }

  private transformPlan(doc: any): Plan {
    return {
      ...doc,
    };
  }

  /**
   * Set authentication session
   */
  setSession(session: string): void {
    this.client.setSession(session);
  }
}

export default AppwriteDB;
