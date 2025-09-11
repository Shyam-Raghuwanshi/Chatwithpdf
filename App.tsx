/**
 * Chat with PDF App
 * Integrated with Appwrite Authentication and Centralized Service Management
 */

import React, { useState, useEffect } from 'react';
import {
  StatusBar,
} from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import type { User } from './types/AuthModule';
import ServiceInitializer from './utils/ServiceInitializer';

function App(): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);

  // 🚀 Start background service warmup immediately when app loads
  useEffect(() => {
    console.log('🚀 App: Starting background service warmup...');
    // Background service starts warming up automatically when imported
    // This is completely non-blocking and runs in the background
    console.log('🎯 App: Background services will be ready soon!');
  }, []);

  const handleLoginSuccess = (authenticatedUser: User) => {
    setUser(authenticatedUser);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <ServiceInitializer userId={user?.id} enableWarmup={true}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#232222"
      />
      {user ? (
        <DashboardScreen user={user} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
    </ServiceInitializer>
  );
}

export default App;
