import { Client, Databases, ID, Query, Account } from 'appwrite';
import { appwriteClient } from './AppwriteClient';
import { authSessionManager } from './AuthSessionManager';

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
  private databases: Databases;
  private account: Account;
  private config: AppwriteConfig;

  // Collection IDs (should match your Appwrite setup)
  private readonly COLLECTIONS = {
    USER_PROFILES: '68a75893002ed0b3d872',
    DOCUMENTS: '68a75b180016b4e52d00',
    CHATS: '68a7662100185c305b45',
    PLANS: '68a766cb0021ae9a983c',
  };

  constructor(config: AppwriteConfig) {
    this.config = config;
    
    // Always reinitialize to ensure fresh session state
    appwriteClient.reinitialize(config.endpoint, config.projectId);
    authSessionManager.initialize(config.endpoint, config.projectId);
    
    this.databases = appwriteClient.getDatabases();
    this.account = appwriteClient.getAccount();
  }

  /**
   * Test collection access and provide detailed error information
   */
  async testCollectionAccess(): Promise<void> {
    console.log('\n=== COLLECTION ACCESS TEST ===');
    
    const collections = [
      { id: this.COLLECTIONS.DOCUMENTS, name: 'Documents' },
      { id: this.COLLECTIONS.CHATS, name: 'Chats' },
      { id: this.COLLECTIONS.PLANS, name: 'Plans' },
      { id: this.COLLECTIONS.USER_PROFILES, name: 'UserProfile' },
    ];

    for (const collection of collections) {
      try {
        console.log(`\nTesting ${collection.name} collection (${collection.id})...`);
        const result = await this.databases.listDocuments(
          this.config.databaseId,
          collection.id,
          [Query.limit(1)]
        );
        console.log(`✅ ${collection.name}: Access OK (${result.documents.length} documents found)`);
      } catch (error: any) {
        console.log(`❌ ${collection.name}: Access FAILED`);
        console.log(`   Error: ${error.message}`);
        
        if (error.message?.includes('missing scopes') || error.message?.includes('guests')) {
          console.log(`   ⚠️  PERMISSION ISSUE: Collection permissions not configured properly`);
          console.log(`   To fix this:`);
          console.log(`   1. Go to Appwrite Console`);
          console.log(`   2. Navigate to Databases > ${this.config.databaseId}`);
          console.log(`   3. Click on "${collection.name}" collection`);
          console.log(`   4. Go to Settings > Permissions`);
          console.log(`   5. Add these permissions:`);
          console.log(`      - Read: Any (for guests) or Users (for authenticated only)`);
          console.log(`      - Create: Users (for authenticated users)`);
          console.log(`      - Update: Users (for authenticated users)`);
          console.log(`      - Delete: Users (for authenticated users)`);
        }
      }
    }
    console.log('\n=== END COLLECTION ACCESS TEST ===\n');
  }

  /**
   * Test authentication status
   */
  async testAuthentication(): Promise<{ isAuthenticated: boolean; user?: any; error?: string }> {
    try {
      const user = await this.account.get();
      return { isAuthenticated: true, user };
    } catch (error: any) {
      return { isAuthenticated: false, error: error.message };
    }
  }

  /**
   * Try to create an OAuth session directly from JavaScript client
   * This bypasses the native module and creates a session the JavaScript client can use
   */
  async createOAuthSession(provider: string = 'google'): Promise<void> {
    try {
      // Create OAuth2 session directly with JavaScript client
      await this.account.createOAuth2Session(
        provider as any,
        'chatwithpdf://oauth-success', // Success redirect
        'chatwithpdf://oauth-failure'   // Failure redirect
      );
    } catch (error: any) {
      console.error('OAuth session creation failed:', error);
      throw error;
    }
  }

  /**
   * Try to create an anonymous session and then authenticate with OAuth
   * This is a workaround for the native OAuth session not being shared
   */
  async createAnonymousSessionAndAuth(): Promise<void> {
    try {
      // First, try to create an anonymous session to get access
      await this.account.createAnonymousSession();
      console.log('Anonymous session created');
    } catch (error: any) {
      console.log('Anonymous session creation failed or already exists:', error.message);
    }
  }

  /**
   * Initialize and ensure user is authenticated
   */
  async ensureAuthenticated(): Promise<void> {
    try {
      // Try to get current account to verify authentication
      const user = await this.account.get();
      console.log('User authenticated:', user.email);
    } catch (error: any) {
      console.error('Authentication error:', error);
      throw new Error(`User not authenticated: ${error.message}`);
    }
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
   * Get documents for a user (updated with working permissions)
   */
  async getUserDocuments(userId: string, limit: number = 50): Promise<Document[]> {
    try {
      console.log('Attempting to get user documents for:', userId);
      
      // Since collections are now accessible, proceed directly with the query
      // The user is currently in guest mode, but collections allow guest access
      const result = await this.databases.listDocuments(
        this.config.databaseId,
        this.COLLECTIONS.DOCUMENTS,
        [
          Query.equal('userId', userId),
          Query.orderDesc('createdAt'),
          Query.limit(limit),
        ]
      );

      console.log('Documents fetched successfully:', result.documents.length);
      return result.documents.map(doc => this.transformDocument(doc));
      
    } catch (error: any) {
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
      console.log(profile, "profile")
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
    appwriteClient.setSession(session);
  }
}

export default AppwriteDB;
