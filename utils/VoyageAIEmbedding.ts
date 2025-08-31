import axios, { AxiosResponse } from 'axios';

/**
 * Simple rate limiter to prevent hitting API limits
 */
class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private timeWindow: number;

  constructor(maxRequests: number = 10, timeWindow: number = 60000) { // 10 requests per minute by default
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    
    // Remove old requests outside the time window
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.timeWindow - (now - oldestRequest);
      
      if (waitTime > 0) {
        console.log(`⏳ Rate limit protection: waiting ${waitTime}ms before next request...`);
        await this.delay(waitTime);
      }
    }
    
    this.requests.push(now);
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
}

export class VoyageAIEmbedding {
  private config: VoyageAIConfig;
  private rateLimiter: RateLimiter;

  constructor(config: Partial<VoyageAIConfig> = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.EXPO_PUBLIC_VOYAGEAI_API_KEY || "pa-DwJLlC6KMr4In_-Hn6k1BXFjumu54MRV66Z9-Xn3kg1",
      apiUrl: config.apiUrl || "https://api.voyageai.com/v1/embeddings",
      model: config.model || "voyage-large-2",
      timeout: config.timeout || 30000,
    };
    
    // Initialize rate limiter: 10 requests per minute to be conservative
    this.rateLimiter = new RateLimiter(10, 60000);
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
      // Apply rate limiting
      await this.rateLimiter.waitIfNeeded();

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
    batchSize: number = 20 // Reduced from 50 to be more conservative
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

      // Longer delay between batches to avoid rate limits
      if (i + batchSize < texts.length) {
        const delay = 2000; // 2 seconds between batches
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
        
        // Wait between individual requests
        if (i < texts.length - 1) {
          await this.delay(3000); // 3 seconds between individual requests
        }
      } catch (error) {
        console.error(`Failed to process individual text ${i + 1}:`, error);
        throw error;
      }
    }
    
    return embeddings;
  }

  /**
   * Test the embedding service with a simple text
   */
  async testConnection(): Promise<boolean> {
    try {
      const testText = "This is a test embedding request.";
      const embedding = await this.generateEmbedding(testText);
      return embedding.length > 0;
    } catch (error) {
      console.error('VoyageAI connection test failed:', error);
      return false;
    }
  }

  /**
   * Get the dimension of embeddings for this model
   */
  async getEmbeddingDimension(): Promise<number> {
    try {
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
}

export default VoyageAIEmbedding;
