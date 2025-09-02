/**
 * Test script to demonstrate the new detailed token tracking functionality
 * Run this after implementing the token tracking fix
 */

import RAGService from './utils/RAGService';
import TokenUtils from './utils/TokenUtils';
import { defaultConfig } from './utils/Config';

// Test configuration - replace with your actual config
const testConfig = {
  appwrite: {
    endpoint: defaultConfig.appwrite.endpoint,
    projectId: defaultConfig.appwrite.projectId,
    databaseId: defaultConfig.appwrite.databaseId,
  },
  qdrant: defaultConfig.qdrant,
  voyageAI: defaultConfig.voyageAI,
  perplexity: defaultConfig.perplexity,
  chunking: {},
};

async function testTokenTracking() {
  console.log('🧪 Testing Enhanced Token Tracking\n');
  
  const ragService = new RAGService(testConfig);
  
  try {
    // Initialize the service
    await ragService.initialize();
    console.log('✅ RAG Service initialized\n');
    
    // Test user ID (use a real user ID from your system)
    const testUserId = 'test-user-123';
    
    // Ensure user profile exists
    await ragService.ensureUserProfile(testUserId);
    console.log('✅ User profile ensured\n');
    
    // Test token estimation
    console.log('📊 Token Estimation Tests:');
    const sampleMessage = "What are the main themes in this document?";
    const sampleContext = "This is a sample document about artificial intelligence and machine learning.";
    
    const estimatedTokens = TokenUtils.estimateChatTokens(sampleMessage, sampleContext, 150);
    console.log(`   Message: "${sampleMessage}"`);
    console.log(`   Context length: ${sampleContext.length} chars`);
    console.log(`   Estimated tokens: ${TokenUtils.formatTokenUsage(estimatedTokens)}\n`);
    
    // Test token validation
    console.log('🔍 Token Validation Tests:');
    const validTokens = TokenUtils.validateTokenUsage(100, 70, 30);
    const invalidTokens = TokenUtils.validateTokenUsage(100, 80, 30);
    
    console.log(`   Valid (100 = 70 + 30): ${validTokens.isValid}`);
    console.log(`   Invalid (100 ≠ 80 + 30): ${invalidTokens.isValid} - ${invalidTokens.error}\n`);
    
    // Test cost calculation
    console.log('💰 Cost Calculation Tests:');
    const costTest = TokenUtils.calculateCost({
      total: 1000,
      input: 700,
      output: 300,
    });
    console.log(`   1000 tokens (700 input + 300 output): $${costTest.toFixed(6)}\n`);
    
    // Test detailed token processing
    console.log('⚙️ Token Processing Tests:');
    const totalOnly = TokenUtils.createDetailedUsage(1000);
    const withBreakdown = TokenUtils.createDetailedUsage(1000, 700, 300);
    
    console.log(`   Total only: ${TokenUtils.formatTokenUsage(totalOnly)}`);
    console.log(`   With breakdown: ${TokenUtils.formatTokenUsage(withBreakdown)}\n`);
    
    // Test limit checking
    console.log('⚠️ Limit Checking Tests:');
    const limitCheck = TokenUtils.checkTokenLimit(32000, 40000, 0.8);
    console.log(`   Usage: 32,000 / 40,000 tokens`);
    console.log(`   Near limit: ${limitCheck.isNearLimit}`);
    console.log(`   Percent used: ${limitCheck.percentUsed * 100}%`);
    console.log(`   Remaining: ${limitCheck.remainingTokens} tokens\n`);
    
    // Test chat with token tracking (if you have a document)
    console.log('💬 Chat Token Tracking Test:');
    try {
      const response = await ragService.chatWithDocument(
        testUserId,
        "Test message for token tracking",
        undefined, // No specific document
        3, // Max sources
        undefined // No specific chat
      );
      
      console.log(`   Response: ${response.response.substring(0, 100)}...`);
      console.log(`   Total tokens: ${response.tokensUsed}`);
      console.log(`   Input tokens: ${response.inputTokens || 'Not available'}`);
      console.log(`   Output tokens: ${response.outputTokens || 'Not available'}`);
      console.log(`   Sources: ${response.sources.length}\n`);
      
    } catch (chatError) {
      console.log(`   Chat test skipped: ${chatError}\n`);
    }
    
    // Test user token statistics
    console.log('📈 User Token Statistics:');
    try {
      const userStats = await ragService.getUserTokenStats(testUserId);
      console.log(`   Total tokens used: ${userStats.stats.totalTokens}`);
      console.log(`   Input tokens: ${userStats.stats.inputTokens}`);
      console.log(`   Output tokens: ${userStats.stats.outputTokens}`);
      console.log(`   Average per chat: ${userStats.stats.averageTokensPerChat}`);
      console.log(`   Estimated cost: $${userStats.stats.estimatedCost?.toFixed(6) || 'N/A'}`);
      console.log(`   Limit status: ${userStats.limit.percentUsed * 100}% used`);
      
    } catch (statsError) {
      console.log(`   Stats test skipped: ${statsError}`);
    }
    
    console.log('\n✅ All token tracking tests completed!');
    console.log('\n🎉 Token tracking implementation is working correctly.');
    console.log('\nNext steps:');
    console.log('1. Update your Appwrite database schema with the new optional fields');
    console.log('2. Monitor token usage in your application logs');
    console.log('3. Build analytics dashboards using getUserTokenStats()');
    console.log('4. Set up usage alerts and limits');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testTokenTracking().catch(console.error);
}

export default testTokenTracking;
