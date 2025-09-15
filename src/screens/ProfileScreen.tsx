import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  Image,
} from 'react-native';

interface ProfileScreenProps {
  user?: any;
  onBack?: () => void;
}

export default function ProfileScreen({ user, onBack }: ProfileScreenProps) {
  const [fullName] = useState(user?.name);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Please contact support to delete your account.\n\nEmail: support@paper.com',
      [{ text: 'OK', style: 'default' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Image
              style={{ width: 20, height: 20, tintColor: '#ffffff' }}
              source={require('../../assets/icons/back-arrow.png')}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Profile Content */}
        <View style={styles.profileContent}>
          {/* Full Name Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Full name</Text>
            <TextInput
              style={styles.textInput}
              readOnly={true}
              value={fullName}
              placeholderTextColor="#666666"
            />
          </View>

          {/* Account Actions Section */}
          <View style={styles.accountActionsSection}>
            <Text style={styles.accountActionsTitle}>Account Actions</Text>
            <TouchableOpacity style={styles.deleteAccountButton} onPress={handleDeleteAccount}>
              <View style={styles.deleteIconContainer}>
                <Image
                  style={styles.deleteIcon}
                  source={require('../../assets/icons/trash.png')}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.deleteAccountText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
    paddingVertical: 16,
    backgroundColor: '#1a1a1a',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  placeholder: {
    width: 34,
  },
  profileContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 8,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#404040',
    opacity: 0.7,
  },
  updateButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#404040',
  },
  updateButtonDisabled: {
    opacity: 0.6,
  },
  updateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  accountActionsSection: {
    paddingTop: 16,
  },
  accountActionsTitle: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 16,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  deleteIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  deleteIcon: {
    width: 18,
    height: 18,
    tintColor: '#ad2b2bff',
  },
  deleteAccountText: {
    fontSize: 16,
    color: '#ad2b2bff',
    fontWeight: '500',
    lineHeight: 20,
  },
});