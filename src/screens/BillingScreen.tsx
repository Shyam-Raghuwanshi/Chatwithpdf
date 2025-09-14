import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Plan, UserProfile } from '../../utils/AppwriteDB';
import { useRAGService } from '../../utils/useServices';
import { FONT_FAMILY } from '../../utils/FontConfig';

interface BillingScreenProps {
  userId: string;
  onBack: () => void;
}

const BillingScreen: React.FC<BillingScreenProps> = ({ userId, onBack }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  
  const { ragService, isLoading: servicesLoading, isInitialized } = useRAGService(userId);

  useEffect(() => {
    if (ragService && isInitialized && !servicesLoading) {
      loadData();
    }
  }, [ragService, isInitialized, servicesLoading]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (!ragService) {
        console.log('RAG service not ready yet, waiting...');
        return;
      }

      console.log('Loading billing data...');
      // Load plans and user profile in parallel
      const [plansData, profileData] = await Promise.all([
        ragService.getPlans(),
        ragService.getUserProfile(userId)
      ]);
      setPlans(plansData);
      setUserProfile(profileData);
      console.log('Billing data loaded successfully');
    } catch (error: any) {
      console.error('Error loading billing data:', error);
      Alert.alert('Error', `Failed to load billing information: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan: Plan) => {
    try {
      setSubscribing(plan.$id!);
      
      // For now, show a coming soon alert
      // In a real app, you would integrate with a payment processor
      Alert.alert(
        'Subscribe to ' + plan.name,
        `You're about to subscribe to ${plan.name} for ₹${(plan.price / 100).toFixed(2)} with ${plan.tokensLimit.toLocaleString()} tokens for ${plan.durationDays} days.\n\nPayment integration coming soon!`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: async () => {
              try {
                // Update user profile with new plan
                if (!ragService || !userProfile) return;
                
                const subscriptionEndDate = new Date();
                subscriptionEndDate.setDate(subscriptionEndDate.getDate() + plan.durationDays);
                
                // await ragService.createOrUpdateUserProfile(userId, {
                //   plan: plan.name.toLowerCase() as 'free' | 'pro' | 'enterprise',
                //   tokenRemaining: plan.tokensLimit,
                //   subscriptionValidTill: subscriptionEndDate,
                // });
                
                Alert.alert('Success', `Successfully subscribed to ${plan.name}!`);
                await loadData(); // Refresh data
              } catch (error: any) {
                Alert.alert('Error', `Failed to update subscription: ${error.message}`);
              }
            }
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSubscribing(null);
    }
  };

  const formatPrice = (priceInPaisa: number) => {
    return `₹${(priceInPaisa / 100).toFixed(2)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return tokens.toString();
  };

  const isCurrentPlan = (plan: Plan) => {
    return userProfile?.plan === plan.name.toLowerCase();
  };

  const isSubscriptionValid = () => {
    if (!userProfile?.subscriptionValidTill) return false;
    return new Date(userProfile.subscriptionValidTill) > new Date();
  };

  if (loading || servicesLoading || !isInitialized) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Billing</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>
            {servicesLoading ? 'Initializing services...' : 'Loading billing information...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Billing</Text>
          <View style={styles.backButton} />
        </View>

        {/* Current Plan Section */}
        {userProfile && (
          <View style={styles.currentPlanSection}>
            <Text style={styles.sectionTitle}>Current Plan</Text>
            <View style={styles.currentPlanCard}>
              <Text style={styles.currentPlanName}>
                {userProfile.plan.charAt(0).toUpperCase() + userProfile.plan.slice(1)}
              </Text>
              <Text style={styles.currentPlanTokens}>
                {userProfile.tokenRemaining.toLocaleString()} tokens remaining
              </Text>
              {userProfile.subscriptionValidTill && (
                <Text style={[
                  styles.subscriptionStatus,
                  isSubscriptionValid() ? styles.validSubscription : styles.expiredSubscription
                ]}>
                  {isSubscriptionValid() 
                    ? `Valid until ${new Date(userProfile.subscriptionValidTill).toLocaleDateString()}`
                    : 'Subscription expired'
                  }
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Available Plans */}
        <View style={styles.plansSection}>
          <Text style={styles.sectionTitle}>Available Plans</Text>
          {plans.map((plan) => (
            <View
              key={plan.$id}
              style={[
                styles.planCard,
                isCurrentPlan(plan) && styles.currentPlanHighlight
              ]}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                {isCurrentPlan(plan) && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Current</Text>
                  </View>
                )}
              </View>
              
              <Text style={styles.planPrice}>{formatPrice(plan.price)}</Text>
              
              <View style={styles.planFeatures}>
                <View style={styles.featureRow}>
                  <Text style={styles.featureText}>
                    💎 {formatTokens(plan.tokensLimit)} tokens
                  </Text>
                </View>
                <View style={styles.featureRow}>
                  <Text style={styles.featureText}>
                    ⏰ {plan.durationDays} days validity
                  </Text>
                </View>
                {plan.name.toLowerCase() === 'spark' && (
                  <View style={styles.featureRow}>
                    <Text style={styles.featureText}>
                      📄 Unlimited PDFs
                    </Text>
                  </View>
                )}
                {(plan.name.toLowerCase() === 'blaze' || plan.name.toLowerCase() === 'spark') && (
                  <>
                    <View style={styles.featureRow}>
                      <Text style={styles.featureText}>
                        🚀 Priority support
                      </Text>
                    </View>
                    <View style={styles.featureRow}>
                      <Text style={styles.featureText}>
                        ⚡ Faster processing
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {!isCurrentPlan(plan) && (
                <TouchableOpacity
                  style={[
                    styles.subscribeButton,
                    subscribing === plan.$id && styles.subscribeButtonDisabled
                  ]}
                  onPress={() => handleSubscribe(plan)}
                  disabled={subscribing === plan.$id}
                >
                  {subscribing === plan.$id ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <Text style={styles.subscribeButtonText}>
                      {plan.name.toLowerCase() === 'free' ? 'Downgrade' : 'Upgrade'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Help Section */}
        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>Need Help?</Text>
          <Text style={styles.helpText}>
            If you have any questions about billing or need assistance with your subscription, 
            please contact our support team.
          </Text>
          <TouchableOpacity style={styles.contactButton}>
            <Text style={styles.contactButtonText}>Contact Support</Text>
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
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#232222',
  },
  backButton: {
    padding: 8,
    width: 40,
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
    fontFamily: FONT_FAMILY.semiBold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 16,
    fontSize: 16,
    fontFamily: FONT_FAMILY.regular,
  },
  currentPlanSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
    fontFamily: FONT_FAMILY.semiBold,
  },
  currentPlanCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  currentPlanName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
    fontFamily: FONT_FAMILY.semiBold,
  },
  currentPlanTokens: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 4,
    fontFamily: FONT_FAMILY.regular,
  },
  subscriptionStatus: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.regular,
  },
  validSubscription: {
    color: '#4CAF50',
  },
  expiredSubscription: {
    color: '#ff6b6b',
  },
  plansSection: {
    padding: 16,
  },
  planCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  currentPlanHighlight: {
    borderColor: '#4CAF50',
    backgroundColor: '#1e2a1e',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: FONT_FAMILY.semiBold,
  },
  currentBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  currentBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONT_FAMILY.semiBold,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    fontFamily: FONT_FAMILY.bold,
  },
  planFeatures: {
    marginBottom: 20,
  },
  featureRow: {
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#cccccc',
    fontFamily: FONT_FAMILY.regular,
  },
  subscribeButton: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  subscribeButtonDisabled: {
    opacity: 0.6,
  },
  subscribeButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FONT_FAMILY.semiBold,
  },
  helpSection: {
    padding: 16,
    backgroundColor: '#2a2a2a',
    margin: 16,
    borderRadius: 12,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
    fontFamily: FONT_FAMILY.semiBold,
  },
  helpText: {
    fontSize: 14,
    color: '#cccccc',
    lineHeight: 20,
    marginBottom: 16,
    fontFamily: FONT_FAMILY.regular,
  },
  contactButton: {
    backgroundColor: '#333333',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  contactButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FONT_FAMILY.semiBold,
  },
});

export default BillingScreen;
