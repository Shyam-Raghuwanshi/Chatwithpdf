import { Account } from 'appwrite';
import { appwriteClient } from './AppwriteClient';

export class AuthSessionManager {
  private account: Account | null = null;

  constructor() {
    if (appwriteClient.getIsInitialized()) {
      this.account = appwriteClient.getAccount();
    }
  }

  /**
   * Initialize with client if not already done
   */
  initialize(endpoint: string, projectId: string): void {
    if (!appwriteClient.getIsInitialized()) {
      appwriteClient.initialize(endpoint, projectId);
    }
    this.account = appwriteClient.getAccount();
  }

  /**
   * Attempt to get current session or create anonymous session
   */
  async ensureValidSession(): Promise<{ success: boolean; method: string; error?: string; data?: any }> {
    if (!this.account) {
      return { success: false, method: 'none', error: 'Account service not initialized' };
    }

    try {
      // First, try to get current user (this works if there's an active session)
      const user = await this.account.get();
      return { success: true, method: 'existing_session', data: user };
    } catch (error: any) {
      console.log('No existing session found:', error.message);

      // If no session exists, try to create an anonymous session as fallback
      try {
        console.log('Attempting to create anonymous session...');
        const session = await this.account.createAnonymousSession();
        return { success: true, method: 'anonymous_session', data: session };
      } catch (anonError: any) {
        console.error('Failed to create anonymous session:', anonError.message);
        return { success: false, method: 'anonymous_session', error: anonError.message };
      }
    }
  }

  /**
   * Create a new OAuth session (this will open browser/webview)
   */
  async createOAuth2Session(provider: string = 'google'): Promise<void> {
    if (!this.account) {
      throw new Error('Account service not initialized');
    }

    try {
      // This will open browser for OAuth - using app scheme for React Native
      await this.account.createOAuth2Session(
        provider as any,
        'chatwithpdf://auth/success',
        'chatwithpdf://auth/failure'
      );
    } catch (error) {
      console.error('OAuth session creation failed:', error);
      throw error;
    }
  }

  /**
   * Get current session info
   */
  async getSessionInfo(): Promise<any> {
    if (!this.account) {
      return null;
    }

    try {
      const user = await this.account.get();
      return user;
    } catch (error) {
      return null;
    }
  }

  /**
   * Logout current session
   */
  async logout(): Promise<void> {
    if (!this.account) {
      return;
    }

    try {
      await this.account.deleteSession('current');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }
}

export const authSessionManager = new AuthSessionManager();
export default authSessionManager;
