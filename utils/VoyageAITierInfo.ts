/**
 * VoyageAI Tier Information and Rate Limit Helper
 * 
 * This utility helps users understand VoyageAI rate limits and provides
 * guidance on upgrading tiers for better production performance.
 */

export interface TierInfo {
  tier: number;
  rpm: number; // Requests per minute
  tpm: string; // Tokens per minute
  requirements: string;
  cost: string;
  description: string;
}

export const VOYAGE_AI_TIERS: Record<number, TierInfo> = {
  1: {
    tier: 1,
    rpm: 2000,
    tpm: '3M',
    requirements: 'Add payment method to dashboard',
    cost: 'Free tier (with payment method)',
    description: 'Basic production usage - good for small apps'
  },
  2: {
    tier: 2,
    rpm: 4000,
    tpm: '6M',
    requirements: 'Spend $100+ on VoyageAI API',
    cost: '$100+ total spending',
    description: 'Medium production usage - 2x Tier 1 limits'
  },
  3: {
    tier: 3,
    rpm: 6000,
    tpm: '9M',
    requirements: 'Spend $1000+ on VoyageAI API',
    cost: '$1000+ total spending',
    description: 'High production usage - 3x Tier 1 limits'
  }
};

/**
 * Get tier information for a specific tier
 */
export function getTierInfo(tier: 1 | 2 | 3): TierInfo {
  return VOYAGE_AI_TIERS[tier];
}

/**
 * Get all available tiers
 */
export function getAllTiers(): TierInfo[] {
  return Object.values(VOYAGE_AI_TIERS);
}

/**
 * Calculate estimated requests needed for document processing
 */
export function estimateRequestsForDocument(
  textLength: number,
  chunkSize: number = 800,
  overlap: number = 150
): {
  estimatedChunks: number;
  estimatedRequests: number;
  tierRecommendation: number;
} {
  // Rough estimation of chunks needed
  const effectiveChunkSize = chunkSize - overlap;
  const estimatedChunks = Math.ceil(textLength / effectiveChunkSize);
  
  // Each batch can handle up to 128 chunks
  const batchSize = 128;
  const estimatedRequests = Math.ceil(estimatedChunks / batchSize);
  
  // Recommend tier based on request volume
  let tierRecommendation = 1;
  if (estimatedRequests > 100) tierRecommendation = 2;
  if (estimatedRequests > 500) tierRecommendation = 3;
  
  return {
    estimatedChunks,
    estimatedRequests,
    tierRecommendation
  };
}

/**
 * Get user-friendly rate limit explanation
 */
export function getRateLimitExplanation(currentTier: number = 1): string {
  const tier = getTierInfo(currentTier as 1 | 2 | 3);
  
  return `Your current VoyageAI limits (Tier ${tier.tier}):
• ${tier.rpm.toLocaleString()} requests per minute
• ${tier.tpm} tokens per minute
• ${tier.description}

${currentTier < 3 ? `To upgrade to Tier ${currentTier + 1}:
• ${VOYAGE_AI_TIERS[currentTier + 1].requirements}
• Get ${VOYAGE_AI_TIERS[currentTier + 1].rpm.toLocaleString()} requests/minute
• ${VOYAGE_AI_TIERS[currentTier + 1].description}` : 'You have the highest tier available!'}`;
}

/**
 * Check if current usage would hit rate limits
 */
export function checkRateLimitRisk(
  requestsPerMinute: number,
  currentTier: number = 1
): {
  withinLimits: boolean;
  utilizationPercent: number;
  recommendation: string;
} {
  const tier = getTierInfo(currentTier as 1 | 2 | 3);
  const utilizationPercent = (requestsPerMinute / tier.rpm) * 100;
  
  let recommendation = '';
  let withinLimits = true;
  
  if (utilizationPercent > 100) {
    withinLimits = false;
    recommendation = `You're exceeding Tier ${tier.tier} limits. Consider upgrading to Tier ${Math.min(currentTier + 1, 3)}.`;
  } else if (utilizationPercent > 80) {
    recommendation = `You're using ${utilizationPercent.toFixed(1)}% of your rate limit. Consider upgrading soon.`;
  } else if (utilizationPercent > 50) {
    recommendation = `Moderate usage (${utilizationPercent.toFixed(1)}%). You're within limits.`;
  } else {
    recommendation = `Low usage (${utilizationPercent.toFixed(1)}%). Your current tier is sufficient.`;
  }
  
  return {
    withinLimits,
    utilizationPercent,
    recommendation
  };
}

/**
 * Get upgrade instructions for VoyageAI dashboard
 */
export function getUpgradeInstructions(targetTier: 2 | 3): string {
  const tier = getTierInfo(targetTier);
  
  return `To upgrade to Tier ${targetTier}:

1. Visit https://dashboard.voyageai.com/
2. Go to your organization settings
3. Add a payment method (if not done)
4. ${tier.requirements}
5. Limits will automatically increase to ${tier.rpm.toLocaleString()} RPM

Note: Billing is monthly, and usage credits count towards tier qualification.`;
}

export default {
  getTierInfo,
  getAllTiers,
  estimateRequestsForDocument,
  getRateLimitExplanation,
  checkRateLimitRisk,
  getUpgradeInstructions,
  VOYAGE_AI_TIERS
};
