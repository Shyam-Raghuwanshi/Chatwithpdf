// Using fetch instead of QdrantClient for React Native compatibility

import { defaultConfig } from "./Config";

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, any>;
}

export interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, any>;
}

export interface QdrantConfig {
  url: string;
  apiKey: string;
  timeout: number;
}

export interface CollectionConfig {
  name: string;
  vectorSize: number;
  distance: 'Cosine';
}

export class QdrantVectorDB {
  private config: QdrantConfig;

  constructor() {
    this.config = {
      url: defaultConfig.qdrant.url,
      apiKey: defaultConfig.qdrant.apiKey!,
      timeout: defaultConfig.qdrant.timeout || 30000,
    };
  }

  /**
   * Make HTTP request to Qdrant API
   */
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<any> {
    try {
      const url = `${this.config.url}${endpoint}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.apiKey) {
        headers['api-key'] = this.config.apiKey;
      }

      const requestConfig: any = {
        method,
        headers,
      };

      if (body && method !== 'GET') {
        requestConfig.body = JSON.stringify(body);
      }

      const response = await fetch(url, requestConfig);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('Qdrant API request failed:', error);
      throw new Error(`Qdrant request failed: ${error.message}`);
    }
  }

  /**
   * Initialize a collection for storing document embeddings
   */
  async initializeCollection(collectionName: string, vectorSize: number): Promise<void> {
    try {
      // Check if collection exists
      const collections = await this.listCollections();
      
      if (!collections.includes(collectionName)) {
        console.log(`Creating collection: ${collectionName}`);
        
        const collectionConfig = {
          vectors: {
            size: vectorSize,
            distance: 'Cosine',
          },
        };

        await this.makeRequest(
          `/collections/${collectionName}`,
          'PUT',
          collectionConfig
        );
        
        console.log(`Collection ${collectionName} created successfully`);
      } else {
        console.log(`Collection ${collectionName} already exists`);
      }
    } catch (error) {
      console.error('Error initializing collection:', error);
      throw new Error(`Failed to initialize collection ${collectionName}: ${error}`);
    }
  }

  /**
   * Store document chunks with their embeddings
   */
  async storeDocumentChunks(
    collectionName: string,
    chunks: Array<{
      id: string;
      text: string;
      embedding: number[];
      metadata: Record<string, any>;
    }>
  ): Promise<void> {
    try {
      const points = chunks.map(chunk => ({
        id: chunk.id,
        vector: chunk.embedding,
        payload: {
          text: chunk.text,
          ...chunk.metadata,
        },
      }));

      const upsertBody = {
        points,
      };

      await this.makeRequest(
        `/collections/${collectionName}/points?wait=true`,
        'PUT',
        upsertBody
      );

      console.log(`Stored ${chunks.length} chunks in collection ${collectionName}`);
    } catch (error) {
      console.error('Error storing document chunks:', error);
      throw new Error(`Failed to store chunks: ${error}`);
    }
  }

  /**
   * Search for similar chunks using vector similarity
   */
  async searchSimilarChunks(
    collectionName: string,
    queryEmbedding: number[],
    limit: number = 5,
    filters?: Record<string, any>
  ): Promise<SearchResult[]> {
    try {
      const searchBody: any = {
        vector: queryEmbedding,
        limit,
        with_payload: true,
      };

      if (filters) {
        searchBody.filter = {
          must: Object.entries(filters).map(([key, value]) => ({
            key,
            match: { value },
          })),
        };
      }

      const response = await this.makeRequest(
        `/collections/${collectionName}/points/search`,
        'POST',
        searchBody
      );

      return response.result?.map((point: any) => ({
        id: point.id,
        score: point.score || 0,
        payload: point.payload || {},
      })) || [];
    } catch (error) {
      console.error('Error searching similar chunks:', error);
      throw new Error(`Failed to search chunks: ${error}`);
    }
  }

  /**
   * Search for chunks related to a specific document
   */
  async searchDocumentChunks(
    collectionName: string,
    queryEmbedding: number[],
    documentId: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    return this.searchSimilarChunks(
      collectionName,
      queryEmbedding,
      limit,
      { documentId }
    );
  }

  /**
   * Delete all chunks for a specific document
   */
  async deleteDocumentChunks(
    collectionName: string,
    documentId: string
  ): Promise<void> {
    try {
      const deleteBody = {
        filter: {
          must: [
            {
              key: 'documentId',
              match: { value: documentId },
            },
          ],
        },
      };

      await this.makeRequest(
        `/collections/${collectionName}/points/delete`,
        'POST',
        deleteBody
      );

      console.log(`Deleted chunks for document ${documentId}`);
    } catch (error) {
      console.error('Error deleting document chunks:', error);
      throw new Error(`Failed to delete document chunks: ${error}`);
    }
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(collectionName: string): Promise<any> {
    try {
      return await this.makeRequest(`/collections/${collectionName}`);
    } catch (error) {
      console.error('Error getting collection info:', error);
      throw new Error(`Failed to get collection info: ${error}`);
    }
  }

  /**
   * Count points in collection
   */
  async countPoints(collectionName: string, filters?: Record<string, any>): Promise<number> {
    try {
      const countBody: any = {};

      if (filters) {
        countBody.filter = {
          must: Object.entries(filters).map(([key, value]) => ({
            key,
            match: { value },
          })),
        };
      }

      const response = await this.makeRequest(
        `/collections/${collectionName}/points/count`,
        'POST',
        countBody
      );

      return response.result?.count || 0;
    } catch (error) {
      console.error('Error counting points:', error);
      throw new Error(`Failed to count points: ${error}`);
    }
  }

  /**
   * Test the connection to Qdrant
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/collections');
      return true;
    } catch (error) {
      console.error('Qdrant connection test failed:', error);
      return false;
    }
  }

  /**
   * List all collections
   */
  async listCollections(): Promise<string[]> {
    try {
      const response = await this.makeRequest('/collections');
      return response.result?.collections?.map((c: any) => c.name) || [];
    } catch (error) {
      console.error('Error listing collections:', error);
      throw new Error(`Failed to list collections: ${error}`);
    }
  }

  /**
   * Delete a collection
   */
  async deleteCollection(collectionName: string): Promise<void> {
    try {
      await this.makeRequest(`/collections/${collectionName}`, 'DELETE');
      console.log(`Collection ${collectionName} deleted`);
    } catch (error) {
      console.error('Error deleting collection:', error);
      throw new Error(`Failed to delete collection: ${error}`);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<QdrantConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration (excluding sensitive data)
   */
  getConfig(): Omit<QdrantConfig, 'apiKey'> {
    const { apiKey, ...safeConfig } = this.config;
    return safeConfig;
  }
}

export default QdrantVectorDB;
