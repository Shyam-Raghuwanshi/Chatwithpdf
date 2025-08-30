import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Image,
} from 'react-native';
import auth from '../../utils/AppwriteAuth';
import type { User } from '../../types/AuthModule';
import { defaultConfig } from '../../utils/Config';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // Initialize with your Appwrite credentials
      await auth.initialize(
        defaultConfig.appwrite.endpoint, // Your API Endpoint
        defaultConfig.appwrite.projectId // Your project ID
      );

      // Check if user is already signed in
      const isSignedIn = await auth.isSignedIn();
      if (isSignedIn) {
        try {
          const currentUser = await auth.getCurrentUser();
          onLoginSuccess(currentUser);
        } catch (error) {
          console.log('Failed to get current user during initialization:', error);
          // Continue to show login screen
        }
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      // Continue to show login screen even if initialization has issues
    } finally {
      setInitializing(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);

      // Use the JavaScript Appwrite client directly for OAuth instead of native module
      // This ensures session consistency between auth and database operations
      const { appwriteClient } = require('../../utils/AppwriteClient');

      // Initialize the client if not already done
      if (!appwriteClient.getIsInitialized()) {
        appwriteClient.initialize(
          defaultConfig.appwrite.endpoint,
          defaultConfig.appwrite.projectId
        );
      }

      const account = appwriteClient.getAccount();

      try {
        // Try to create OAuth2 session directly with JavaScript client
        // This will open the browser for authentication
        await account.createOAuth2Session(
          'google',
          'chatwithpdf://auth/success', // Success URL scheme
          'chatwithpdf://auth/failure'   // Failure URL scheme  
        );

        // After OAuth completes, get the user
        const user = await account.get();
        Alert.alert('Success', 'Signed in with Google successfully!');
        onLoginSuccess(user);

      } catch (oauthError: any) {
        console.error('Direct OAuth error:', oauthError);

        // Fallback to native module if direct OAuth fails
        console.log('Falling back to native OAuth...');
        const result = await auth.signInWithOAuth('google');

        if (result.type === 'success') {
          try {
            const user = await auth.getCurrentUser();
            Alert.alert('Success', 'Signed in with Google successfully!');
            onLoginSuccess(user);
          } catch (error: any) {
            console.log('Error getting user after OAuth:', error);
            Alert.alert('Error', 'Failed to get user information after OAuth. Please try again.');
          }
        } else {
          Alert.alert('Error', 'Google sign in was cancelled or failed');
        }
      }

    } catch (error: any) {
      console.error('Google sign in error:', error);
      Alert.alert('Error', `Google sign in failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Initializing...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* App Logo/Header */}
        <View style={styles.header}>
          <Image
            source={require('../../assests/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appTitle}>Chat with PDF</Text>
          <Text style={styles.subtitle}>
            Sign in to continue
          </Text>
        </View>

        {/* Auth Form */}
        <View style={styles.form}>
          {/* Google Sign In */}
          <TouchableOpacity
            style={[styles.googleButton, loading && styles.disabledButton]}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#333" />
            ) : (
              <Text style={styles.googleButtonText}>
                Continue with Google
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  googleButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default LoginScreen;
