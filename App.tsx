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
import ServicePerformanceMonitor from './utils/ServicePerformanceMonitor';
import ServiceManager from './utils/ServiceManager';

function App(): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);

  // 🚀 Start background RAG initialization immediately when app loads
  useEffect(() => {
    console.log('🚀 App: Starting background RAG initialization...');
    ServiceManager.startBackgroundInit();
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
        backgroundColor="#f8f9fa"
      />
      
      {/* Performance Monitor - only shows in development */}
      <ServicePerformanceMonitor enabled={__DEV__} position="top" />
      
      {user ? (
        <DashboardScreen user={user} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
    </ServiceInitializer>
  );
}

export default App;
