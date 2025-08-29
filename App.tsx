/**
 * Chat with PDF App
 * Integrated with Appwrite Authentication
 */

import React, { useState } from 'react';
import {
  StatusBar,
} from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import type { User } from './types/AuthModule';

function App(): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);

  const handleLoginSuccess = (authenticatedUser: User) => {
    setUser(authenticatedUser);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#f8f9fa"
      />
      {user ? (
        <DashboardScreen user={user} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
}

export default App;
