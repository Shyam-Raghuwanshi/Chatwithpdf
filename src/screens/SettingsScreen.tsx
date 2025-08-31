import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import type { User } from '../../types/AuthModule';
import auth from '../../utils/AppwriteAuth';

interface SettingsScreenProps {
  user: User;
  onBack: () => void;
  onLogout: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ user, onBack, onLogout }) => {
  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await auth.signOut();
              onLogout();
            } catch (error: any) {
              Alert.alert('Error', `Sign out failed: ${error.message}`);
            }
          },
        },
      ]
    );
  };

  const handleUpgradePlan = () => {
    Alert.alert(
      'Upgrade Plan',
      'Pro features coming soon! Stay tuned for advanced chat capabilities, unlimited documents, and priority support.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const handleSupport = () => {
    Alert.alert(
      'Support',
      'Need help? Contact us at support@chatwithpdf.com or visit our help center.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const handlePrivacy = () => {
    Alert.alert(
      'Privacy Policy',
      'Your privacy is important to us. We only store necessary data to provide our services and never share your information with third parties.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const handleTerms = () => {
    Alert.alert(
      'Terms of Service',
      'By using this app, you agree to our terms of service. Please use responsibly and respect intellectual property rights.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Profile Section */}
        <View style={styles.section}>
          <View style={styles.profileSection}>
            <View style={styles.profileAvatar}>
              <Text style={styles.avatarText}>
                {user.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
          </View>
        </View>

        {/* Plan Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plan</Text>
          <View style={styles.planCard}>
            <View style={styles.planInfo}>
              <Text style={styles.planName}>Free Plan</Text>
              <Text style={styles.planDescription}>
                • Up to 10 documents
                {'\n'}• Basic chat features
                {'\n'}• Community support
              </Text>
            </View>
            <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgradePlan}>
              <Text style={styles.upgradeButtonText}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingsGroup}>
            <TouchableOpacity style={styles.settingItem} onPress={handleSupport}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingEmoji}>🎧</Text>
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Support</Text>
                <Text style={styles.settingSubtitle}>Get help and contact us</Text>
              </View>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={handlePrivacy}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingEmoji}>🔒</Text>
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Privacy Policy</Text>
                <Text style={styles.settingSubtitle}>How we handle your data</Text>
              </View>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={handleTerms}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingEmoji}>📋</Text>
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Terms of Service</Text>
                <Text style={styles.settingSubtitle}>App usage terms</Text>
              </View>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>
          <View style={styles.settingsGroup}>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingEmoji}>📱</Text>
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Version</Text>
                <Text style={styles.settingSubtitle}>1.0.0</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2c2c2e',
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1c1c1e',
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3c',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
  },
  headerSpacer: {
    width: 34, // Same width as back button to center title
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: '#999',
  },
  planCard: {
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3a3a3c',
    flexDirection: 'row',
    alignItems: 'center',
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  planDescription: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  upgradeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsGroup: {
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3a3a3c',
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3c',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#3a3a3c',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingEmoji: {
    fontSize: 18,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#999',
  },
  settingArrow: {
    fontSize: 18,
    color: '#999',
    fontWeight: '300',
  },
  logoutSection: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  logoutButton: {
    backgroundColor: '#ff3b30',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SettingsScreen;
