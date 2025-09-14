import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import type { User } from '../../types/AuthModule';
import auth from '../../utils/AppwriteAuth';
import { FONT_FAMILY } from '../../utils/FontConfig';

interface SettingsScreenProps {
  user: User;
  onBack: () => void;
  onLogout: () => void;
  onNavigateToProfile: () => void;
  onNavigateToBilling: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ user, onBack, onLogout, onNavigateToProfile, onNavigateToBilling }) => {

  const handleLogout = async () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            try {
              await auth.signOut();
              onLogout();
            } catch (error: any) {
              Alert.alert('Error', `Log out failed: ${error.message}`);
            }
          },
        },
      ]
    );
  };

  const handleUpgrade = () => {
    Alert.alert(
      'Upgrade',
      'Pro features coming soon! Stay tuned for advanced chat capabilities, unlimited documents, and priority support.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const handleBilling = () => {
    onNavigateToBilling();
  };

  const handleAppearance = () => {
    Alert.alert('Appearance', 'Currently set to Dark theme. Theme options coming soon!');
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
          <TouchableOpacity style={styles.infoButton}>
            <Text style={styles.infoButtonText}>ⓘ</Text>
          </TouchableOpacity>
        </View>

        {/* Upgrade Section */}
        <View style={styles.upgradeSection}>
          <Text style={styles.upgradeTitle}>Want more?</Text>
          <Text style={styles.upgradeSubtitle}>
            Upgrade for more usage and capabilities.
          </Text>
          <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
            <Text style={styles.upgradeButtonText}>Upgrade</Text>
          </TouchableOpacity>
        </View>

        {/* Settings List */}
        <View style={styles.settingsList}>
          <TouchableOpacity style={styles.settingItem} onPress={onNavigateToProfile}>
            <Image
              style={{ width: 20, height: 20, marginRight: 8 }}
              source={require('../../assets/icons/user.png')}
            />
            <Text style={styles.settingTitle}>Profile</Text>
          </TouchableOpacity>

          {/* Billing */}
          <TouchableOpacity style={{ borderBottomWidth: 1, borderBottomColor: '#333333', ...styles.settingItem }} onPress={handleBilling}>
            <Image
              style={{ width: 20, height: 20, marginRight: 8 }}
              source={require('../../assets/icons/dollar.png')}
            />
            <Text style={styles.settingTitle}>Billing</Text>
          </TouchableOpacity>

          {/* Appearance */}
          <TouchableOpacity style={styles.settingItem} onPress={handleAppearance}>
            <Image
              style={{ width: 20, height: 20, marginRight: 8 }}
              source={require('../../assets/icons/moon.png')}
            />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Color mode</Text>
              <Text style={styles.settingSubtitle}>Dark</Text>
            </View>
          </TouchableOpacity>

          {/* Log out */}
          <TouchableOpacity style={styles.logoutItem} onPress={handleLogout}>
            <Image
              style={{ width: 20, height: 20, marginRight: 8 }}
              source={require('../../assets/icons/logout.png')}
            />
            <Text style={styles.logoutTitle}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
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
    paddingBottom: 12,
    backgroundColor: '#232222',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  infoButton: {
    padding: 8,
  },
  infoButtonText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '400',
  },
  upgradeSection: {
    backgroundColor: "#393837",
    margin: 16,
    borderRadius: 16,
    padding: 20,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  upgradeSubtitle: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 16,
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  upgradeButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsList: {
    paddingHorizontal: 16,
    paddingLeft: 28,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  settingIconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingIcon: {
    fontSize: 18,
  },
  settingTitle: {
    fontSize: 16,
    paddingLeft: 5,
    color: '#ffffff',
    fontWeight: '400',
    fontFamily: FONT_FAMILY.semiBold,
  },
  settingContent: {
    flex: 1,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#999999',
    marginTop: 2,
  },
  settingContentFlex: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 0,
    marginTop: 20,
  },
  logoutIcon: {
    fontSize: 18,
  },
  logoutTitle: {
    fontSize: 16,
    color: '#ff6b6b',
    fontWeight: '400',
  },
});

export default SettingsScreen;
