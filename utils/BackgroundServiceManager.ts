/**
 * Background Service Manager
 * 
 * This service starts immediately when the app loads and runs completely in the background.
 * It pre-initializes and caches all services so the UI is never blocked.
 */

import RAGService from './RAGService';
import VoyageAIEmbedding from './VoyageAIEmbedding';
import QdrantVectorDB from './QdrantVectorDB';
import AppwriteDB from './AppwriteDB';
import { defaultConfig } from './Config';

interface CachedServices {
  ragService: RAGService | null;
  appwriteDB: AppwriteDB | null;
  voyageAI: VoyageAIEmbedding | null;
  qdrantDB: QdrantVectorDB | null;
  lastCacheTime: number;
  isWarm: boolean;
}

class BackgroundServiceManager {
  private static instance: BackgroundServiceManager | null = null;
  private cache: CachedServices = {
    ragService: null,
    appwriteDB: null,
    voyageAI: null,
    qdrantDB: null,
    lastCacheTime: 0,
    isWarm: false
  };
  
  private isWarming = false;
  private warmupPromise: Promise<void> | null = null;
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    // Start warming up immediately
    this.startWarmup();
  }

  static getInstance(): BackgroundServiceManager {
    if (!BackgroundServiceManager.instance) {
      BackgroundServiceManager.instance = new BackgroundServiceManager();
    }
    return BackgroundServiceManager.instance;
  }

  /**
   * Start background warmup immediately - non-blocking
   */
  private startWarmup(): void {
    console.log('🔥 BackgroundService: Starting immediate warmup...');
    this.warmupPromise = this.performWarmup();
  }

  /**
   * Perform the actual warmup in the background
   */
  private async performWarmup(): Promise<void> {
    if (this.isWarming) return;
    
    this.isWarming = true;
    const startTime = Date.now();

    try {
      console.log('🚀 BackgroundService: Pre-initializing all services...');

      // Create all services in parallel for maximum speed
      const [ragService, appwriteDB, voyageAI, qdrantDB] = await Promise.all([
        this.createRAGService(),
        this.createAppwriteDB(),
        this.createVoyageAI(),
        this.createQdrantDB()
      ]);

      // Cache everything
      this.cache = {
        ragService,
        appwriteDB,
        voyageAI,
        qdrantDB,
        lastCacheTime: Date.now(),
        isWarm: true
      };

      const duration = Date.now() - startTime;
      console.log(`✅ BackgroundService: All services ready in ${duration}ms`);
      console.log('🎯 BackgroundService: App can now load documents instantly!');

    } catch (error) {
      console.warn('⚠️ BackgroundService: Warmup failed (app will still work):', error);
      // Don't throw - app should work even if background warmup fails
    } finally {
      this.isWarming = false;
      this.warmupPromise = null;
    }
  }

  /**
   * Create RAG service with ultra-fast initialization
   */
  private async createRAGService(): Promise<RAGService> {
    const service = new RAGService(defaultConfig);
    // Initialize with ultra-fast mode (no connection tests)
    await service.initialize(false);
    return service;
  }

  /**
   * Create and cache AppwriteDB
   */
  private async createAppwriteDB(): Promise<AppwriteDB> {
    const appwriteConfig = {
      endpoint: defaultConfig.appwrite.endpoint,
      projectId: defaultConfig.appwrite.projectId,
      databaseId: defaultConfig.appwrite.databaseId
    };
    const db = new AppwriteDB(appwriteConfig);
    // Pre-authenticate if possible
    try {
      await db.testCollectionAccess();
    } catch (error) {
      // Ignore auth errors - will handle later
    }
    return db;
  }

  /**
   * Create and cache VoyageAI
   */
  private async createVoyageAI(): Promise<VoyageAIEmbedding> {
    const voyageConfig = {
      apiKey: defaultConfig.voyageAI.apiKey,
      model: defaultConfig.voyageAI.model
    };
    return new VoyageAIEmbedding(voyageConfig);
  }

  /**
   * Create and cache QdrantDB
   */
  private async createQdrantDB(): Promise<QdrantVectorDB> {
    const db = new QdrantVectorDB();
    // Pre-test connection
    try {
      await db.testConnection();
    } catch (error) {
      // Ignore connection errors - will handle later
    }
    return db;
  }

  /**
   * Get cached RAG service instantly - never blocks
   */
  async getRAGService(): Promise<RAGService> {
    // If cache is warm, return immediately
    if (this.cache.isWarm && this.cache.ragService && this.isCacheValid()) {
      console.log('⚡ BackgroundService: Returning cached RAG service instantly');
      return this.cache.ragService;
    }

    // If still warming up, wait for it
    if (this.warmupPromise) {
      console.log('⏳ BackgroundService: Waiting for warmup to complete...');
      await this.warmupPromise;
      if (this.cache.ragService) {
        return this.cache.ragService;
      }
    }

    // Fallback: create new service if cache failed
    console.log('🔧 BackgroundService: Creating fallback RAG service...');
    return await this.createRAGService();
  }

  /**
   * Get cached AppwriteDB instantly
   */
  async getAppwriteDB(): Promise<AppwriteDB> {
    if (this.cache.appwriteDB && this.isCacheValid()) {
      return this.cache.appwriteDB;
    }

    if (this.warmupPromise) {
      await this.warmupPromise;
      if (this.cache.appwriteDB) {
        return this.cache.appwriteDB;
      }
    }

    return await this.createAppwriteDB();
  }

  /**
   * Load user documents instantly using cached services
   */
  async loadUserDocuments(userId: string): Promise<any[]> {
    try {
      console.log('📄 BackgroundService: Loading documents with cached services...');
      const startTime = Date.now();

      // Get cached AppwriteDB
      const appwriteDB = await this.getAppwriteDB();
      const documents = await appwriteDB.getUserDocuments(userId);

      const duration = Date.now() - startTime;
      console.log(`✅ BackgroundService: Loaded ${documents.length} documents in ${duration}ms`);
      
      return documents;
    } catch (error) {
      console.error('❌ BackgroundService: Failed to load documents:', error);
      return [];
    }
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    const age = Date.now() - this.cache.lastCacheTime;
    return age < this.CACHE_DURATION;
  }

  /**
   * Check if services are ready
   */
  isReady(): boolean {
    return this.cache.isWarm && this.isCacheValid();
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus() {
    return {
      isWarm: this.cache.isWarm,
      isWarming: this.isWarming,
      hasRAGService: !!this.cache.ragService,
      hasAppwriteDB: !!this.cache.appwriteDB,
      cacheAge: Date.now() - this.cache.lastCacheTime,
      isValid: this.isCacheValid()
    };
  }

  /**
   * Force refresh cache
   */
  async refresh(): Promise<void> {
    this.cache.isWarm = false;
    this.startWarmup();
    if (this.warmupPromise) {
      await this.warmupPromise;
    }
  }
}

// Export singleton instance
export const backgroundService = BackgroundServiceManager.getInstance();
export default BackgroundServiceManager;
