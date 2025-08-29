import axios, { AxiosResponse } from 'axios';

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

  constructor(config: Partial<VoyageAIConfig> = {}) {
    const VOYAGE_API_KEY =
      process.env.EXPO_PUBLIC_VOYAGEAI_API_KEY ||
      "pa-xOPYGN_PFfIcfrHVI30NkWO3xhEgPcLE32vJGd_tGBp";
    
    this.config = {
      apiKey: config.apiKey || VOYAGE_API_KEY,
      apiUrl: config.apiUrl || "https://api.voyageai.com/v1/embeddings",
      model: config.model || "voyage-large-2",
      timeout: config.timeout || 30000,
    };
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
        const errorMessage = error.response.data?.error?.message || 
                           error.response.data?.message || 
                           `HTTP ${error.response.status}: ${error.response.statusText}`;
        throw new Error(`VoyageAI API Error: ${errorMessage}`);
      } else if (error.request) {
        throw new Error('Network error: Unable to reach VoyageAI API');
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
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<number[][]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.generateEmbeddings(texts, inputType);
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on authentication or bad request errors
        if (error.message.includes('401') || error.message.includes('400')) {
          throw error;
        }

        if (attempt < maxRetries - 1) {
          console.warn(`Embedding attempt ${attempt + 1} failed, retrying in ${retryDelay}ms...`);
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
    batchSize: number = 50
  ): Promise<number[][]> {
    if (texts.length <= batchSize) {
      return this.generateEmbeddingsWithRetry(texts, inputType);
    }

    const allEmbeddings: number[][] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      console.log(`Processing embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
      
      try {
        const batchEmbeddings = await this.generateEmbeddingsWithRetry(batch, inputType);
        allEmbeddings.push(...batchEmbeddings);
      } catch (error) {
        console.error(`Error processing batch starting at index ${i}:`, error);
        throw error;
      }

      // Small delay between batches to be respectful to the API
      if (i + batchSize < texts.length) {
        await this.delay(100);
      }
    }

    return allEmbeddings;
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
