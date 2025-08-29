/**
 * Utility to help debug and set up Appwrite collection permissions
 * This should be run once to configure your collections properly
 */

import { Client, Databases, Permission, Role, Query } from 'appwrite';

interface CollectionConfig {
  id: string;
  name: string;
  permissions: string[];
}

export class AppwriteCollectionSetup {
  private client: Client;
  private databases: Databases;
  private databaseId: string;

  constructor(endpoint: string, projectId: string, databaseId: string) {
    this.client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId);
    
    this.databases = new Databases(this.client);
    this.databaseId = databaseId;
  }

  /**
   * Check current collection permissions (API not available in SDK)
   */
  async checkCollectionPermissions(collectionId: string): Promise<any> {
    console.log(`Note: Collection permission checking requires direct API access or Appwrite Console.`);
    console.log(`Please check collection ${collectionId} permissions in Appwrite Console.`);
    return null;
  }

  /**
   * Update collection permissions (API not available in SDK)
   */
  async updateCollectionPermissions(collectionId: string): Promise<boolean> {
    console.log(`Note: Collection permission updates must be done through Appwrite Console.`);
    console.log(`Please update collection ${collectionId} permissions manually in Appwrite Console.`);
    console.log(`Instructions:`);
    console.log(`1. Go to Appwrite Console > Databases > Your Database`);
    console.log(`2. Click on collection ${collectionId}`);
    console.log(`3. Go to Settings > Permissions`);
    console.log(`4. Add permissions for authenticated users and/or guests`);
    return false;
  }

  /**
   * Set up all collections with proper permissions
   */
  async setupAllCollections(): Promise<void> {
    const collections: CollectionConfig[] = [
      { id: '68a75893002ed0b3d872', name: 'UserProfile', permissions: [] },
      { id: '68a75b180016b4e52d00', name: 'Documents', permissions: [] },
      { id: '68a7662100185c305b45', name: 'Chats', permissions: [] },
      { id: '68a766cb0021ae9a983c', name: 'Plans', permissions: [] },
    ];

    console.log('Checking current collection permissions...');
    
    for (const collection of collections) {
      console.log(`\n--- ${collection.name} (${collection.id}) ---`);
      await this.checkCollectionPermissions(collection.id);
    }

    console.log('\nAttempting to update permissions...');
    
    for (const collection of collections) {
      console.log(`\nUpdating ${collection.name}...`);
      const success = await this.updateCollectionPermissions(collection.id);
      if (success) {
        console.log(`✅ ${collection.name} permissions updated`);
      } else {
        console.log(`❌ Failed to update ${collection.name} permissions`);
      }
    }
  }

  /**
   * Test database access with current permissions
   */
  async testDatabaseAccess(): Promise<void> {
    try {
      console.log('Testing database access...');
      
      // Try to list documents from each collection
      const collections = [
        { id: '68a75b180016b4e52d00', name: 'Documents' },
        { id: '68a7662100185c305b45', name: 'Chats' },
        { id: '68a766cb0021ae9a983c', name: 'Plans' },
        { id: '68a75893002ed0b3d872', name: 'UserProfile' },
      ];

      for (const collection of collections) {
        try {
          const result = await this.databases.listDocuments(
            this.databaseId,
            collection.id,
            [Query.limit(1)] // Just get 1 document to test access
          );
          console.log(`✅ ${collection.name}: Access OK (${result.documents.length} documents)`);
        } catch (error: any) {
          console.log(`❌ ${collection.name}: Access FAILED - ${error.message}`);
        }
      }
    } catch (error) {
      console.error('Database access test failed:', error);
    }
  }
}

export default AppwriteCollectionSetup;
