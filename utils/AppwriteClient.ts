import { Client, Account, Databases, Avatars } from 'appwrite';

class AppwriteClientSingleton {
  private static instance: AppwriteClientSingleton;
  private client: Client | null = null;
  private account: Account | null = null;
  private databases: Databases | null = null;
  private avatar: Avatars | null = null;
  private isInitialized = false;

  private constructor() { }

  static getInstance(): AppwriteClientSingleton {
    if (!AppwriteClientSingleton.instance) {
      AppwriteClientSingleton.instance = new AppwriteClientSingleton();
    }
    return AppwriteClientSingleton.instance;
  }

  initialize(endpoint: string, projectId: string): void {
    this.client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId);
    this.avatar = new Avatars(this.client);
    this.account = new Account(this.client);
    this.databases = new Databases(this.client);
    this.isInitialized = true;
  }

  /**
   * Reinitialize with fresh client (useful after OAuth)
   */
  reinitialize(endpoint: string, projectId: string): void {
    // Only reinitialize if endpoint or projectId has changed
    const currentEndpoint = this.client?.config?.endpoint;
    const currentProjectId = this.client?.config?.project;

    if (currentEndpoint === endpoint && currentProjectId === projectId && this.isInitialized) {
      console.log('♻️ Appwrite client already initialized with same config, skipping reinitialize');
      return;
    }

    console.log('🔄 Reinitializing Appwrite client...', { endpoint, projectId });
    this.client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId);
    this.avatar = new Avatars(this.client);
    this.account = new Account(this.client);
    this.databases = new Databases(this.client);
    this.isInitialized = true;
  }

  getClient(): Client {
    if (!this.client) {
      throw new Error('Appwrite client not initialized');
    }
    return this.client;
  }

  getAvatar(): Avatars {
    if (!this.avatar) {
      throw new Error('Appwrite client not initialized');
    }
    return this.avatar;
  }

  getAccount(): Account {
    if (!this.account) {
      throw new Error('Appwrite client not initialized');
    }
    return this.account;
  }

  getDatabases(): Databases {
    if (!this.databases) {
      throw new Error('Appwrite client not initialized');
    }
    return this.databases;
  }

  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Set session for all Appwrite services
   */
  setSession(session: string): void {
    if (this.client) {
      this.client.setSession(session);
    }
  }
}

export const appwriteClient = AppwriteClientSingleton.getInstance();
export default appwriteClient;
