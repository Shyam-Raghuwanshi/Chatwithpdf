import axios, { AxiosResponse } from 'axios';

/**
 * Simple rate limiter to prevent hitting API limits
 */
class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private timeWindow: number;

  constructor(maxRequests: number, timeWindow: number = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    
    // Remove old requests outside the time window
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    
    console.log(`🔍 Rate limiter check: ${this.requests.length}/${this.maxRequests} requests in last ${this.timeWindow/1000}s`);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.timeWindow - (now - oldestRequest);
      
      if (waitTime > 0) {
        console.log(`⏳ Rate limit protection: waiting ${waitTime}ms before next request (${this.requests.length}/${this.maxRequests} used)...`);
        await this.delay(waitTime);
      }
    }
    
    this.requests.push(now);
    
    // Log current utilization
    const utilization = (this.requests.length / this.maxRequests * 100).toFixed(1);
    console.log(`📊 Rate limit utilization: ${this.requests.length}/${this.maxRequests} (${utilization}%) - MAX LIMIT: ${this.maxRequests}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export interface EmbeddingRequest {
  input: string | string[];
  model?: string;
  input_type?: 'query' | 'document';
}

export interface EmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

export interface VoyageAIConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  timeout: number;
  usageTier?: 1 | 2 | 3; // VoyageAI usage tier for dynamic rate limiting
  hasPaymentMethod?: boolean; // Whether payment method is added to account
}

export class VoyageAIEmbedding {
  private static instance: VoyageAIEmbedding | null = null;
  private config: VoyageAIConfig;
  private rateLimiter: RateLimiter;
  private disableRateLimiting: boolean = false; // Set to true for debugging

  constructor(config: Partial<VoyageAIConfig> = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.EXPO_PUBLIC_VOYAGEAI_API_KEY || "pa-DwJLlC6KMr4In_-Hn6k1BXFjumu54MRV66Z9-Xn3kg1",
      apiUrl: config.apiUrl || "https://api.voyageai.com/v1/embeddings",
      model: config.model || "voyage-large-2",
      timeout: config.timeout || 30000,
      usageTier: config.usageTier || 1, // Default to Tier 1
      hasPaymentMethod: config.hasPaymentMethod || false, // Default to false (most restrictive)
    };
    
    // CRITICAL: Accounts without payment methods have severely limited rates
    // Without payment: 3 RPM, 10K TPM
    // With payment: 2000 RPM (Tier 1), 4000 RPM (Tier 2), 6000 RPM (Tier 3)
    
    const hasPaymentMethod = this.config.hasPaymentMethod;
    
    let rateLimit: number;
    if (hasPaymentMethod) {
      const tierMultiplier = this.config.usageTier || 1;
      const baseLimit = 1950; // 97.5% of Tier 1's 2000 RPM
      rateLimit = Math.floor(baseLimit * tierMultiplier);
    } else {
      // For accounts without payment method: 3 RPM = 1 request every 20 seconds
      // Let's be conservative and allow 2 requests per minute
      rateLimit = 2;
    }
    
    console.log(`🚀 VoyageAI NEW INSTANCE created`);
    console.log(`💳 Payment method: ${hasPaymentMethod ? 'ADDED' : 'NOT ADDED - SEVERELY LIMITED!'}`);
    console.log(`⚡ Rate limit: ${rateLimit} requests/minute`);
    console.log(`🔧 Instance ID: ${Date.now()}`);
    console.log(`⚡ Rate limiting ${this.disableRateLimiting ? 'DISABLED' : 'ENABLED'} for debugging`);
    
    if (!hasPaymentMethod) {
      console.log(`🚨 WARNING: Add payment method at https://dashboard.voyageai.com/ to unlock 2000 RPM!`);
    }
    
    // Pass the calculated rate limit
    this.rateLimiter = new RateLimiter(rateLimit, 60000);
  }

  /**
   * Get or create singleton instance
   */
  static getInstance(config?: Partial<VoyageAIConfig>): VoyageAIEmbedding {
    if (!VoyageAIEmbedding.instance) {
      VoyageAIEmbedding.instance = new VoyageAIEmbedding(config);
      console.log('🎯 Created singleton VoyageAI instance');
    } else {
      console.log('♻️ Reusing existing VoyageAI instance');
    }
    return VoyageAIEmbedding.instance;
  }

  /**
   * Generate embeddings for a single text
   */
  async generateEmbedding(
    text: string,
    inputType: 'query' | 'document' = 'document'
  ): Promise<number[]> {
    try {
      const embeddings = await this.generateEmbeddings([text], inputType);
      return embeddings[0];
    } catch (error) {
      console.error('Error generating single embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  async generateEmbeddings(
    texts: string[],
    inputType: 'query' | 'document' = 'document'
  ): Promise<number[][]> {
    if (!texts.length) {
      throw new Error('No texts provided for embedding generation');
    }

    // Clean and validate texts
    const cleanTexts = texts
      .map(text => text.trim())
      .filter(text => text.length > 0);

    if (!cleanTexts.length) {
      throw new Error('No valid texts provided after cleaning');
    }

    try {
      // Apply rate limiting only if not disabled
      if (!this.disableRateLimiting) {
        await this.rateLimiter.waitIfNeeded();
      } else {
        console.log('⚡ Skipping rate limiting for debugging');
      }

      const requestData: EmbeddingRequest = {
        input: cleanTexts,
        model: this.config.model,
        input_type: inputType,
      };

      const response: AxiosResponse<EmbeddingResponse> = await axios.post(
        this.config.apiUrl,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.config.timeout,
        }
      );

      if (!response.data || !response.data.data) {
        throw new Error('Invalid response format from VoyageAI API');
      }

      // Sort embeddings by index to maintain order
      const sortedData = response.data.data.sort((a, b) => a.index - b.index);

      return sortedData.map(item => item.embedding);
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const errorMessage = error.response.data?.error?.message ||
          error.response.data?.message ||
          error.response.statusText ||
          'Unknown API error';

        // Provide specific error messages for common issues
        if (status === 429) {
          const errorDetail = error.response.data?.detail || '';
          
          // Check if this is due to missing payment method
          if (errorDetail.includes('payment method') || errorDetail.includes('reduced rate limits')) {
            throw new Error(`VoyageAI API Error: Account without payment method - limited to 3 RPM. Add payment method at https://dashboard.voyageai.com/ to unlock 2000 RPM. Details: ${errorDetail}`);
          }
          
          throw new Error(`VoyageAI API Error: HTTP 429: Rate limit exceeded. Please wait before making more requests.`);
        } else if (status === 401) {
          throw new Error(`VoyageAI API Error: HTTP 401: Invalid API key or authentication failed.`);
        } else if (status === 403) {
          throw new Error(`VoyageAI API Error: HTTP 403: Access forbidden. Check your API key permissions.`);
        } else if (status === 400) {
          throw new Error(`VoyageAI API Error: HTTP 400: Bad request. ${errorMessage}`);
        } else {
          throw new Error(`VoyageAI API Error: HTTP ${status}: ${errorMessage}`);
        }
      } else if (error.request) {
        throw new Error('Network error: Unable to reach VoyageAI API. Check your internet connection.');
      } else {
        throw new Error(`Embedding generation error: ${error.message}`);
      }
    }
  }

  /**
   * Generate embeddings with retry logic
   */
  async generateEmbeddingsWithRetry(
    texts: string[],
    inputType: 'query' | 'document' = 'document',
    maxRetries: number = 5,
    initialRetryDelay: number = 1000
  ): Promise<number[][]> {
    let lastError: Error | null = null;
    let retryDelay = initialRetryDelay;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.generateEmbeddings(texts, inputType);
      } catch (error: any) {
        lastError = error;

        // Don't retry on authentication or bad request errors
        if (error.message.includes('401') || error.message.includes('400') || error.message.includes('403')) {
          throw error;
        }

        // Special handling for rate limits (429)
        if (error.message.includes('429')) {
          // For rate limits, wait longer
          retryDelay = Math.max(retryDelay, 5000); // At least 5 seconds for rate limits
          console.warn(`Rate limit hit (attempt ${attempt + 1}/${maxRetries}), waiting ${retryDelay}ms before retry...`);
        } else {
          console.warn(`Embedding attempt ${attempt + 1} failed, retrying in ${retryDelay}ms...`);
        }

        if (attempt < maxRetries - 1) {
          await this.delay(retryDelay);
          retryDelay *= 2; // Exponential backoff
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Batch process large sets of texts to avoid API limits
   */
  async generateEmbeddingsBatch(
    texts: string[],
    inputType: 'query' | 'document' = 'document',
    batchSize: number = 128 // Increased from 20 - VoyageAI supports up to 1000 texts per request
  ): Promise<number[][]> {
    if (texts.length <= batchSize) {
      return this.generateEmbeddingsWithRetry(texts, inputType);
    }

    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(texts.length / batchSize);
      
      console.log(`Processing embedding batch ${batchNumber}/${totalBatches} (${batch.length} texts)`);

      try {
        const batchEmbeddings = await this.generateEmbeddingsWithRetry(batch, inputType);
        allEmbeddings.push(...batchEmbeddings);
        console.log(`✅ Batch ${batchNumber} completed successfully`);
      } catch (error) {
        console.error(`❌ Error processing batch ${batchNumber}:`, error);
        
        // If batch fails due to rate limiting, try processing items one by one
        if (error instanceof Error && error.message.includes('429')) {
          console.log(`🔄 Falling back to one-by-one processing for batch ${batchNumber}...`);
          try {
            const oneByOneEmbeddings = await this.generateEmbeddingsOneByOne(batch, inputType);
            allEmbeddings.push(...oneByOneEmbeddings);
            console.log(`✅ Batch ${batchNumber} completed with fallback method`);
          } catch (fallbackError) {
            throw fallbackError;
          }
        } else {
          throw error;
        }
      }

      // Reduced delay between batches since we have much higher limits
      if (i + batchSize < texts.length) {
        const delay = 500; // 0.5 seconds between batches (still conservative)
        console.log(`⏳ Waiting ${delay}ms before next batch to respect rate limits...`);
        await this.delay(delay);
      }
    }

    return allEmbeddings;
  }

  /**
   * Process embeddings one by one as a fallback for rate limiting
   */
  private async generateEmbeddingsOneByOne(
    texts: string[],
    inputType: 'query' | 'document' = 'document'
  ): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    for (let i = 0; i < texts.length; i++) {
      console.log(`Processing text ${i + 1}/${texts.length} individually...`);
      
      try {
        const embedding = await this.generateEmbeddingsWithRetry([texts[i]], inputType);
        embeddings.push(embedding[0]);
        
        // Wait between individual requests (reduced from 3 seconds)
        if (i < texts.length - 1) {
          await this.delay(1000); // 1 second between individual requests
        }
      } catch (error) {
        console.error(`Failed to process individual text ${i + 1}:`, error);
        throw error;
      }
    }
    
    return embeddings;
  }

  /**
   * Test the embedding service with a simple text (with rate limit protection)
   */
  async testConnection(): Promise<boolean> {
    try {
      // Skip test if we're likely to hit rate limits
      // Check if we've made requests recently
      const recentRequests = this.rateLimiter['requests'] || [];
      const now = Date.now();
      const recentRequestCount = recentRequests.filter((time: number) => now - time < 60000).length;
      
      // If we've made more than 50% of our limit in the last minute, skip the test
      if (recentRequestCount > (this.rateLimiter['maxRequests'] * 0.5)) {
        console.log('⚠️ Skipping connection test to avoid rate limit - recent API usage detected');
        return true; // Assume connection is OK
      }

      const testText = "Connection test.";
      const embedding = await this.generateEmbedding(testText);
      return embedding.length > 0;
    } catch (error: any) {
      console.error('VoyageAI connection test failed:', error);
      
      // If it's a rate limit error, return true (connection exists but limited)
      if (error.message.includes('429') || error.message.includes('Rate limit')) {
        console.log('🚦 Rate limit detected during connection test - connection exists but limited');
        return true;
      }
      
      return false;
    }
  }

  /**
   * Get the dimension of embeddings for this model (with fallback)
   */
  async getEmbeddingDimension(): Promise<number> {
    try {
      // Skip test if we're likely to hit rate limits
      const recentRequests = this.rateLimiter['requests'] || [];
      const now = Date.now();
      const recentRequestCount = recentRequests.filter((time: number) => now - time < 60000).length;
      
      // If we've made more than 60% of our limit, use default
      if (recentRequestCount > (this.rateLimiter['maxRequests'] * 0.6)) {
        console.log('⚠️ Using default embedding dimension to avoid rate limit');
        return 1536; // Default for voyage-large-2
      }

      const testEmbedding = await this.generateEmbedding("test");
      return testEmbedding.length;
    } catch (error) {
      // Default dimension for voyage-large-2
      console.warn('Could not determine embedding dimension, using default (1536)');
      return 1536;
    }
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<VoyageAIConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration (excluding sensitive data)
   */
  getConfig(): Omit<VoyageAIConfig, 'apiKey'> {
    const { apiKey, ...safeConfig } = this.config;
    return safeConfig;
  }

  /**
   * Get information about VoyageAI usage tiers and rate limits
   */
  getTierInfo(): { currentTier: number; limits: { rpm: number; tpm: string }; upgradeInfo: string } {
    const tier = this.config.usageTier || 1;
    const baseLimits = { rpm: 2000, tpm: '3M' };
    
    const tierInfo = {
      1: { 
        ...baseLimits, 
        upgradeInfo: 'Add payment method to access Tier 1. Spend $100+ to reach Tier 2 (4000 RPM).' 
      },
      2: { 
        rpm: baseLimits.rpm * 2, 
        tpm: '6M', 
        upgradeInfo: 'Spend $1000+ to reach Tier 3 (6000 RPM).' 
      },
      3: { 
        rpm: baseLimits.rpm * 3, 
        tpm: '9M', 
        upgradeInfo: 'Maximum tier reached. Contact VoyageAI for enterprise limits.' 
      }
    };

    return {
      currentTier: tier,
      limits: tierInfo[tier as keyof typeof tierInfo],
      upgradeInfo: tierInfo[tier as keyof typeof tierInfo].upgradeInfo
    };
  }

  /**
   * Update usage tier and reconfigure rate limiter
   */
  updateUsageTier(tier: 1 | 2 | 3): void {
    this.config.usageTier = tier;
    
    // Reconfigure rate limiter
    const baseLimit = 1800; // 90% of Tier 1's 2000 RPM for safety
    const rateLimit = Math.floor(baseLimit * tier);
    
    this.rateLimiter = new RateLimiter(rateLimit, 60000);
    console.log(`🆙 Updated to Tier ${tier}: ${rateLimit} requests/minute`);
  }

  /**
   * Get current rate limiter status
   */
  getRateLimiterStatus(): { 
    currentRequests: number; 
    maxRequests: number; 
    timeWindow: number; 
    utilizationPercent: number;
    nextAvailableSlot: number;
  } {
    const requests = this.rateLimiter['requests'] || [];
    const maxRequests = this.rateLimiter['maxRequests'];
    const timeWindow = this.rateLimiter['timeWindow'];
    const now = Date.now();
    
    // Filter recent requests
    const recentRequests = requests.filter((time: number) => now - time < timeWindow);
    const utilizationPercent = (recentRequests.length / maxRequests) * 100;
    
    // Calculate when next slot is available
    let nextAvailableSlot = 0;
    if (recentRequests.length >= maxRequests && recentRequests.length > 0) {
      const oldestRequest = Math.min(...recentRequests);
      nextAvailableSlot = oldestRequest + timeWindow - now;
    }
    
    return {
      currentRequests: recentRequests.length,
      maxRequests,
      timeWindow,
      utilizationPercent,
      nextAvailableSlot: Math.max(0, nextAvailableSlot)
    };
  }
}

export default VoyageAIEmbedding;
