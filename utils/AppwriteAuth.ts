import { NativeModules } from 'react-native';
import type { User, Session, OAuthResult, OAuthProvider } from '../types/AuthModule';

const { AuthModule } = NativeModules;

class AppwriteAuth {
  private isInitialized = false;
  
  /**
   * Initialize Appwrite client
   */
  async initialize(endpoint: string, projectId: string): Promise<void> {
    try {
      await AuthModule.initializeClient(endpoint, projectId);
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize Appwrite: ${error}`);
    }
  }
  
  /**
   * Check if client is initialized
   */
  private checkInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Appwrite client not initialized. Call initialize() first.');
    }
  }
  
  /**
   * Sign in with OAuth provider
   */
  async signInWithOAuth(provider: OAuthProvider, scopes?: string[]): Promise<OAuthResult> {
    this.checkInitialized();
    return AuthModule.createOAuth2Session(provider, scopes || []);
  }
  
  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string): Promise<Session> {
    this.checkInitialized();
    return AuthModule.createEmailPasswordSession(email, password);
  }
  
  /**
   * Create new account
   */
  async createAccount(email: string, password: string, name?: string): Promise<User> {
    this.checkInitialized();
    return AuthModule.createAccount(email, password, name);
  }
  
  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User> {
    this.checkInitialized();
    return AuthModule.getCurrentUser();
  }
  
  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    this.checkInitialized();
    await AuthModule.logout();
  }
  
  /**
   * Check if user is signed in
   */
  async isSignedIn(): Promise<boolean> {
    try {
      this.checkInitialized();
      await this.getCurrentUser();
      return true;
    } catch (error: any) {
      // If the error is about missing scopes or guests role, user is not signed in
      if (error.message?.includes('guests') || error.message?.includes('scopes') || error.message?.includes('Unauthorized')) {
        return false;
      }
      // For other errors, also consider as not signed in
      return false;
    }
  }
}

export const auth = new AppwriteAuth();
export default auth;
