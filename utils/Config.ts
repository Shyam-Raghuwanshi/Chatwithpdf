/**
 * Configuration file for the RAG (Retrieval-Augmented Generation) system
 * 
 * IMPORTANT: Update these values with your actual service endpoints and credentials
 * before running the application in production.
 */

export interface AppConfig {
      appwrite: {
            endpoint: string;
            projectId: string;
            databaseId: string;
      };
      qdrant: {
            url: string;
            apiKey?: string;
      };
      voyageAI: {
            apiKey?: string;
            model?: string;
            apiUrl?: string;
      };
      chunking: {
            chunkSize: number;
            overlap: number;
            preserveParagraphs: boolean;
            minChunkSize: number;
      };
}

// Default configuration - PLEASE UPDATE THESE VALUES
export const defaultConfig: AppConfig = {
      appwrite: {
            endpoint: 'https://nyc.cloud.appwrite.io/v1', // Update with your Appwrite endpoint
            projectId: '68a74c460028f0e4cfac', // Update with your Appwrite project ID
            databaseId: '68a7552c0009a09693b0',
      },
      qdrant: {
            // Replace with your Qdrant cluster URL
            url: process.env.EXPO_PUBLIC_QDRANT_URL || 'https://your-cluster-url.qdrant.tech:6333',
            // API key is provided in the main RAG service
            apiKey: process.env.EXPO_PUBLIC_QDRANT_API_KEY ||
                  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.hQN7aD0bsLnlY3VnkGKu4wBjA58TOEuTYrrdSbIocTE",
      },
      voyageAI: {
            // API key is provided in the main RAG service
            apiKey: process.env.EXPO_PUBLIC_VOYAGEAI_API_KEY ||
                  "pa-xOPYGN_PFfIcfrHVI30NkWO3xhEgPcLE32vJGd_tGBp",
            model: 'voyage-large-2',
            apiUrl: 'https://api.voyageai.com/v1/embeddings',
      },
      chunking: {
            // Chunk size in tokens (approximately)
            chunkSize: 600,
            // Overlap between chunks in tokens
            overlap: 200,
            // Try to preserve paragraph boundaries
            preserveParagraphs: true,
            // Minimum chunk size to avoid tiny chunks
            minChunkSize: 100,
      },
};

/**
 * Collection names for Qdrant and Appwrite
 */
export const COLLECTION_NAMES = {
      // Qdrant collection for storing document embeddings
      EMBEDDINGS: 'document_embeddings',
      // Appwrite collections (these should match your database schema)
      USER_PROFILES: 'userProfiles',
      DOCUMENTS: 'documents',
      CHATS: 'chats',
      PLANS: 'plans',
} as const;

/**
 * Token limits and pricing configuration
 */
export const TOKEN_CONFIG = {
      FREE_PLAN_LIMIT: 400000,
      PRO_PLAN_LIMIT: 2000000,
      ENTERPRISE_PLAN_LIMIT: 10000000,
      // Rough estimation: 1 token ≈ 4 characters for English text
      CHARS_PER_TOKEN: 4,
      // Cost estimation for different operations (in tokens)
      EMBEDDING_COST_MULTIPLIER: 0.1, // 10% of text length in tokens
      CHAT_COST_MULTIPLIER: 2.0, // 2x the query length for response generation
} as const;

/**
 * UI Configuration
 */
export const UI_CONFIG = {
      MAX_CHAT_HISTORY: 50,
      MAX_DOCUMENT_DISPLAY: 20,
      MAX_SOURCE_CHUNKS: 5,
      CHAT_INPUT_MAX_LENGTH: 500,
      DOCUMENT_TITLE_MAX_LENGTH: 255,
} as const;

/**
 * System limits and timeouts
 */
export const SYSTEM_LIMITS = {
      MAX_PDF_SIZE_MB: 50,
      MAX_TEXT_LENGTH: 1000000, // 1M characters
      API_TIMEOUT_MS: 30000,
      EMBEDDING_BATCH_SIZE: 50,
      MAX_RETRIES: 3,
      RETRY_DELAY_MS: 1000,
} as const;

/**
 * Get configuration with environment variable overrides
 */
export function getConfig(): AppConfig {
      return {
            ...defaultConfig,
            // Override with any additional environment-specific configs here
      };
}

/**
 * Validate configuration
 */
export function validateConfig(config: AppConfig): { isValid: boolean; errors: string[] } {
      const errors: string[] = [];

      // Check Appwrite configuration
      if (!config.appwrite.endpoint || config.appwrite.endpoint.includes('your-')) {
            errors.push('Appwrite endpoint not configured');
      }
      if (!config.appwrite.projectId || config.appwrite.projectId.includes('your-')) {
            errors.push('Appwrite project ID not configured');
      }
      if (!config.appwrite.databaseId) {
            errors.push('Appwrite database ID not configured');
      }

      // Check Qdrant configuration
      if (!config.qdrant.url || config.qdrant.url.includes('your-')) {
            errors.push('Qdrant URL not configured');
      }
      if (!config.qdrant.apiKey) {
            errors.push('Qdrant API key not configured');
      }

      // Check VoyageAI configuration
      if (!config.voyageAI.apiKey) {
            errors.push('VoyageAI API key not configured');
      }

      // Check chunking parameters
      if (config.chunking.chunkSize <= 0) {
            errors.push('Invalid chunk size');
      }
      if (config.chunking.overlap >= config.chunking.chunkSize) {
            errors.push('Overlap must be less than chunk size');
      }

      return {
            isValid: errors.length === 0,
            errors,
      };
}

export default {
      getConfig,
      validateConfig,
      defaultConfig,
      COLLECTION_NAMES,
      TOKEN_CONFIG,
      UI_CONFIG,
      SYSTEM_LIMITS,
};
