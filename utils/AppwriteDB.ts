import { Client, Databases, ID, Query, Account, TablesDB } from 'appwrite';
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
  private tablesDB: TablesDB;
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
    this.tablesDB = new TablesDB(appwriteClient.getClient());
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
        console.log(`\nTesting ${collection.name} table (${collection.id})...`);
        const result = await this.tablesDB.listRows(
          this.config.databaseId,
          collection.id,
          [Query.limit(1)]
        );
        console.log(`✅ ${collection.name}: Access OK (${result.rows.length} rows found)`);
      } catch (error: any) {
        console.log(`❌ ${collection.name}: Access FAILED`);
        console.log(`   Error: ${error.message}`);

        if (error.message?.includes('missing scopes') || error.message?.includes('guests')) {
          console.log(`   ⚠️  PERMISSION ISSUE: Table permissions not configured properly`);
          console.log(`   To fix this:`);
          console.log(`   1. Go to Appwrite Console`);
          console.log(`   2. Navigate to Databases > ${this.config.databaseId}`);
          console.log(`   3. Click on "${collection.name}" table`);
          console.log(`   4. Go to Settings > Permissions`);
          console.log(`   5. Add these permissions:`);
          console.log(`      - Read: Any (for guests) or Users (for authenticated only)`);
          console.log(`      - Create: Users (for authenticated users)`);
          console.log(`      - Update: Users (for authenticated users)`);
          console.log(`      - Delete: Users (for authenticated users)`);
        } else if (error.message?.includes('Table with the requested ID could not be found')) {
          console.log(`   ⚠️  TABLE NOT FOUND: Table ID "${collection.id}" doesn't exist`);
          console.log(`   Please check your table IDs in the Appwrite Console`);
        }
      }
    }
    console.log('\n=== END COLLECTION ACCESS TEST ===\n');
  }

  /**
   * Test basic document storage to verify table schema
   */
  async testDocumentSchema(): Promise<void> {
    console.log('\n=== DOCUMENT SCHEMA TEST ===');
    
    try {
      // Test with minimal required fields only
      const testData = {
        userId: 'test-user-id',
        title: 'Test Document',
      };

      console.log('Testing document storage with minimal data:', testData);
      
      const result = await this.tablesDB.createRow(
        this.config.databaseId,
        this.COLLECTIONS.DOCUMENTS,
        ID.unique(),
        {
          ...testData,
          createdAt: new Date().toISOString(),
        }
      );

      console.log('✅ Document schema test PASSED');
      console.log('   Created test document:', result.$id);
      
      // Clean up test document
      await this.tablesDB.deleteRow(
        this.config.databaseId,
        this.COLLECTIONS.DOCUMENTS,
        result.$id
      );
      console.log('   Test document cleaned up');

    } catch (error: any) {
      console.log('❌ Document schema test FAILED');
      console.log('   Error:', error.message);
      
      if (error.message.includes('Unknown attribute')) {
        console.log('   ⚠️  SCHEMA ISSUE: Your table is missing required columns');
        console.log('   Please ensure your Documents table has these columns:');
        console.log('     - userId (String)');
        console.log('     - title (String)');
        console.log('     - embeddingId (String, optional)');
        console.log('     - createdAt (String/DateTime)');
      }
    }
    
    console.log('\n=== END DOCUMENT SCHEMA TEST ===\n');
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
        // Update existing profile - prepare data carefully
        const updateData: any = {
          updatedAt: new Date().toISOString(),
        };

        // Only include fields that are provided and valid
        if (profileData.plan) updateData.plan = profileData.plan;
        if (typeof profileData.tokensUsed === 'number') updateData.tokensUsed = profileData.tokensUsed;
        if (typeof profileData.tokensLimit === 'number') updateData.tokensLimit = profileData.tokensLimit;
        if (profileData.subscriptionValidTill) updateData.subscriptionValidTill = profileData.subscriptionValidTill.toISOString();

        console.log('Updating user profile with data:', JSON.stringify(updateData, null, 2));

        const updatedProfile = await this.tablesDB.updateRow(
          this.config.databaseId,
          this.COLLECTIONS.USER_PROFILES,
          existingProfile.$id!,
          updateData
        );
        return this.transformUserProfile(updatedProfile);
      } else {
        // Create new profile - prepare data with defaults
        const createData: any = {
          userId,
          plan: profileData.plan || 'free',
          tokensUsed: profileData.tokensUsed || 0,
          tokensLimit: profileData.tokensLimit || 400000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Only include optional fields if provided
        if (profileData.subscriptionValidTill) {
          createData.subscriptionValidTill = profileData.subscriptionValidTill.toISOString();
        }

        console.log('Creating user profile with data:', JSON.stringify(createData, null, 2));

        const newProfile = await this.tablesDB.createRow(
          this.config.databaseId,
          this.COLLECTIONS.USER_PROFILES,
          ID.unique(),
          createData
        );
        return this.transformUserProfile(newProfile);
      }
    } catch (error) {
      console.error('Error creating/updating user profile:', error);
      console.error('Profile data that failed:', JSON.stringify(profileData, null, 2));
      
      if (error instanceof Error && error.message.includes('Unknown attribute')) {
        const attributeMatch = error.message.match(/Unknown attribute: "([^"]+)"/);
        const unknownAttribute = attributeMatch ? attributeMatch[1] : 'unknown';
        throw new Error(`Database schema error: The user profiles table is missing the "${unknownAttribute}" column. Please add this column to your Appwrite database table.`);
      }
      
      throw new Error(`Failed to create/update user profile: ${error}`);
    }
  }

  /**
   * Get user profile by userId
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const result = await this.tablesDB.listRows(
        this.config.databaseId,
        this.COLLECTIONS.USER_PROFILES,
        [Query.equal('userId', userId)]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.transformUserProfile(result.rows[0]);
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
      // Prepare data, excluding undefined/null values and fields that might not exist in schema
      const dataToStore: any = {
        userId: documentData.userId,
        title: documentData.title,
        createdAt: new Date().toISOString(),
      };

      // Only include optional fields if they have values
      if (documentData.embeddingId) {
        dataToStore.embeddingId = documentData.embeddingId;
      }

      console.log('Storing document with data:', JSON.stringify(dataToStore, null, 2));

      const document = await this.tablesDB.createRow(
        this.config.databaseId,
        this.COLLECTIONS.DOCUMENTS,
        ID.unique(),
        dataToStore
      );

      return this.transformDocument(document);
    } catch (error) {
      console.error('Error storing document:', error);
      console.error('Document data that failed:', JSON.stringify(documentData, null, 2));
      
      // Provide more specific error information
      if (error instanceof Error && error.message.includes('Unknown attribute')) {
        const attributeMatch = error.message.match(/Unknown attribute: "([^"]+)"/);
        const unknownAttribute = attributeMatch ? attributeMatch[1] : 'unknown';
        throw new Error(`Database schema error: The table is missing the "${unknownAttribute}" column. Please add this column to your Appwrite database table or remove it from the data being stored.`);
      }
      
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
      const result = await this.tablesDB.listRows(
        this.config.databaseId,
        this.COLLECTIONS.DOCUMENTS,
        [
          Query.equal('userId', userId),
          Query.orderDesc('createdAt'),
          Query.limit(limit),
        ]
      );

      console.log('Documents fetched successfully:', result.rows.length);
      return result.rows.map(doc => this.transformDocument(doc));

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
      const document = await this.tablesDB.getRow(
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
      // Prepare data, ensuring all required fields are present
      const dataToStore: any = {
        userId: chatData.userId,
        message: chatData.message,
        response: chatData.response,
        tokensUsed: chatData.tokensUsed,
        createdAt: new Date().toISOString(),
      };

      // Only include documentId if it exists
      if (chatData.documentId) {
        dataToStore.documentId = chatData.documentId;
      }

      console.log('Storing chat with data:', JSON.stringify(dataToStore, null, 2));

      const chat = await this.tablesDB.createRow(
        this.config.databaseId,
        this.COLLECTIONS.CHATS,
        ID.unique(),
        dataToStore
      );
      return this.transformChat(chat);
    } catch (error) {
      console.error('Error storing chat message:', error);
      console.error('Chat data that failed:', JSON.stringify(chatData, null, 2));
      
      if (error instanceof Error && error.message.includes('Unknown attribute')) {
        const attributeMatch = error.message.match(/Unknown attribute: "([^"]+)"/);
        const unknownAttribute = attributeMatch ? attributeMatch[1] : 'unknown';
        throw new Error(`Database schema error: The chat table is missing the "${unknownAttribute}" column. Please add this column to your Appwrite database table.`);
      }
      
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

      const result = await this.tablesDB.listRows(
        this.config.databaseId,
        this.COLLECTIONS.CHATS,
        queries
      );

      return result.rows.map(chat => this.transformChat(chat));
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
      let profile = await this.getUserProfile(userId);
      
      // If profile doesn't exist, create it with default values
      if (!profile) {
        console.log(`User profile not found for ${userId}, creating new profile...`);
        profile = await this.createOrUpdateUserProfile(userId, {
          plan: 'free',
          tokensUsed: 0,
          tokensLimit: 400000,
        });
      }

      const newTokenUsage = profile.tokensUsed + tokensUsed;
      
      await this.tablesDB.updateRow(
        this.config.databaseId,
        this.COLLECTIONS.USER_PROFILES,
        profile.$id!,
        {
          tokensUsed: newTokenUsage,
          updatedAt: new Date().toISOString(),
        }
      );
      
      console.log(`Updated token usage for user ${userId}: ${profile.tokensUsed} + ${tokensUsed} = ${newTokenUsage}`);
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
      let profile = await this.getUserProfile(userId);
      
      // If profile doesn't exist, create it with default values
      if (!profile) {
        console.log(`User profile not found for ${userId} during token check, creating new profile...`);
        profile = await this.createOrUpdateUserProfile(userId, {
          plan: 'free',
          tokensUsed: 0,
          tokensLimit: 400000,
        });
      }
      
      const hasEnoughTokens = (profile.tokensUsed + requiredTokens) <= profile.tokensLimit;
      console.log(`Token check for user ${userId}: ${profile.tokensUsed} + ${requiredTokens} <= ${profile.tokensLimit} = ${hasEnoughTokens}`);
      
      return hasEnoughTokens;
    } catch (error) {
      console.error('Error checking token limit:', error);
      // Return true by default to not block users due to errors
      return true;
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
        await this.tablesDB.deleteRow(
          this.config.databaseId,
          this.COLLECTIONS.CHATS,
          chat.$id!
        );
      }

      // Delete the document
      await this.tablesDB.deleteRow(
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
      const result = await this.tablesDB.listRows(
        this.config.databaseId,
        this.COLLECTIONS.PLANS
      );

      return result.rows.map(plan => this.transformPlan(plan));
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
   * Ensure user profile exists, create if not
   */
  async ensureUserProfile(userId: string): Promise<UserProfile> {
    try {
      let profile = await this.getUserProfile(userId);
      
      if (!profile) {
        console.log(`Creating new user profile for user: ${userId}`);
        
        try {
          profile = await this.createOrUpdateUserProfile(userId, {
            plan: 'free',
            tokensUsed: 0,
            tokensLimit: 400000,
          });
          console.log(`✅ Successfully created user profile for: ${userId}`);
        } catch (createError) {
          console.error('Failed to create user profile, attempting simple creation:', createError);
          
          // Fallback: try creating with minimal data
          const newRow = await this.tablesDB.createRow(
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
            }
          );
          
          profile = this.transformUserProfile(newRow);
          console.log(`✅ Successfully created user profile with fallback method for: ${userId}`);
        }
      }
      
      return profile;
    } catch (error) {
      console.error('Error ensuring user profile exists:', error);
      throw new Error(`Failed to ensure user profile: ${error}`);
    }
  }

  /**
   * Set authentication session
   */
  setSession(session: string): void {
    appwriteClient.setSession(session);
  }

  /**
   * Utility method to safely store data by removing fields that cause schema errors
   */
  private sanitizeDataForTable(data: any, tableType: 'document' | 'chat' | 'userProfile'): any {
    const sanitized = { ...data };
    
    // Convert Date objects to ISO strings
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] instanceof Date) {
        sanitized[key] = sanitized[key].toISOString();
      }
      // Remove undefined/null values
      if (sanitized[key] === undefined || sanitized[key] === null) {
        delete sanitized[key];
      }
    });

    return sanitized;
  }

  /**
   * Test and get available table structure information
   */
  async getTableInfo(tableId: string): Promise<void> {
    try {
      console.log(`\n=== TABLE INFO FOR ${tableId} ===`);
      
      // Try to get one row to see what fields are available
      const result = await this.tablesDB.listRows(
        this.config.databaseId,
        tableId,
        [Query.limit(1)]
      );

      if (result.rows.length > 0) {
        const sampleRow = result.rows[0];
        console.log('Available columns in table:');
        Object.keys(sampleRow).forEach(key => {
          console.log(`  - ${key}: ${typeof sampleRow[key]}`);
        });
      } else {
        console.log('No rows found in table - cannot determine structure');
      }
      
      console.log(`=== END TABLE INFO ===\n`);
    } catch (error: any) {
      console.log(`Error getting table info: ${error.message}`);
    }
  }
}

export default AppwriteDB;
