// AuthModule.d.ts
declare module 'react-native' {
  interface NativeModulesStatic {
    AuthModule: {
      /**
       * Initialize the Appwrite client
       * @param endpoint - Appwrite API endpoint URL
       * @param projectId - Your Appwrite project ID
       * @returns Promise that resolves when client is initialized
       */
      initializeClient(endpoint: string, projectId: string): Promise<string>;
      
      /**
       * Create OAuth2 session with external provider
       * @param provider - OAuth provider name (google, github, facebook, etc.)
       * @param scopes - Optional array of OAuth scopes
       * @returns Promise that resolves to OAuth result
       */
      createOAuth2Session(provider: string, scopes?: string[]): Promise<OAuthResult>;
      
      /**
       * Get current authenticated user
       * @returns Promise that resolves to user data
       */
      getCurrentUser(): Promise<User>;
      
      /**
       * Logout current user
       * @returns Promise that resolves when logout is complete
       */
      logout(): Promise<string>;
      
      /**
       * Create session with email and password
       * @param email - User email
       * @param password - User password
       * @returns Promise that resolves to session data
       */
      createEmailPasswordSession(email: string, password: string): Promise<Session>;
      
      /**
       * Create new user account
       * @param email - User email
       * @param password - User password
       * @param name - Optional user name
       * @returns Promise that resolves to user data
       */
      createAccount(email: string, password: string, name?: string): Promise<User>;
    };
  }
}

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerification: boolean;
  phone: string;
  phoneVerification: boolean;
  registration: string;
  status: string;
  passwordUpdate: number;
  prefs: Record<string, any>;
}

export interface Session {
  id: string;
  userId: string;
  provider: string;
  providerUid: string;
  providerAccessToken: string;
  expire: string;
}

export interface OAuthResult {
  type: 'success' | 'error';
  url?: string;
  error?: string;
}

export type OAuthProvider = 
  | 'google'
  | 'github'
  | 'facebook'
  | 'apple'
  | 'twitter'
  | 'discord'
  | 'twitch'
  | 'linkedin'
  | 'microsoft';
