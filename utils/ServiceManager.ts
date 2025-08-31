/**
 * Centralized Service Manager
 * 
 * This singleton class manages all service instances across the app to:
 * 1. Prevent multiple RAG service initializations
 * 2. Reduce API rate limit hits
 * 3. Improve app performance
 * 4. Centralize service lifecycle management
 */

import RAGService from './RAGService';
import VoyageAIEmbedding from './VoyageAIEmbedding';
import QdrantVectorDB from './QdrantVectorDB';
import AppwriteDB from './AppwriteDB';
import { defaultConfig } from './Config';

interface ServiceManagerConfig {
  enableServiceReuse: boolean;
  maxServiceAge: number; // in milliseconds
  enableLogging: boolean;
}

class ServiceManager {
  private static instance: ServiceManager | null = null;
  private ragService: RAGService | null = null;
  private ragServiceCreatedAt: number = 0;
  private isInitializing: boolean = false;
  private initializationPromise: Promise<RAGService> | null = null;
  private backgroundInitPromise: Promise<void> | null = null;
  private config: ServiceManagerConfig;

  private constructor() {
    this.config = {
      enableServiceReuse: true,
      maxServiceAge: 30 * 60 * 1000, // 30 minutes
      enableLogging: true,
    };
    
    // Start background initialization immediately
    this.startBackgroundInitialization();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  /**
   * Configure service manager
   */
  configure(config: Partial<ServiceManagerConfig>): void {
    this.config = { ...this.config, ...config };
    this.log('Service Manager configured:', this.config);
  }

  /**
   * Get or create RAG service instance
   */
  async getRAGService(forceNew: boolean = false): Promise<RAGService> {
    const now = Date.now();
    const serviceAge = now - this.ragServiceCreatedAt;
    const isServiceExpired = serviceAge > this.config.maxServiceAge;

    // Return existing service if valid and not expired
    if (
      !forceNew &&
      this.config.enableServiceReuse &&
      this.ragService &&
      !isServiceExpired
    ) {
      this.log('♻️ Reusing existing RAG service (age:', Math.round(serviceAge / 1000), 'seconds)');
      return this.ragService;
    }

    // If background initialization is in progress, wait for it
    if (this.backgroundInitPromise && !this.ragService) {
      this.log('⏳ Waiting for background RAG service initialization...');
      await this.backgroundInitPromise;
      if (this.ragService && !isServiceExpired) {
        return this.ragService;
      }
    }

    // If already initializing, wait for the existing promise
    if (this.isInitializing && this.initializationPromise) {
      this.log('⏳ Waiting for existing RAG service initialization...');
      return this.initializationPromise;
    }

    // Create new service
    this.log('🚀 Creating new RAG service...');
    this.isInitializing = true;
    
    this.initializationPromise = this.createRAGService();
    
    try {
      const service = await this.initializationPromise;
      this.ragService = service;
      this.ragServiceCreatedAt = now;
      this.log('✅ RAG service created successfully');
      return service;
    } finally {
      this.isInitializing = false;
      this.initializationPromise = null;
    }
  }

  /**
   * Create a new RAG service instance with ultra-fast initialization
   */
  private async createRAGService(): Promise<RAGService> {
    const service = new RAGService(defaultConfig);
    
    // Skip all connection tests - just create the service instances
    // This makes initialization nearly instant
    await service.initialize(false); // false = skip connection tests completely
    return service;
  }

  /**
   * Start background initialization immediately when ServiceManager is created
   */
  private startBackgroundInitialization(): void {
    this.backgroundInitPromise = this.performBackgroundInit();
  }

  /**
   * Perform background initialization without blocking the UI
   */
  private async performBackgroundInit(): Promise<void> {
    try {
      this.log('🔥 Starting background RAG service initialization...');
      
      const service = new RAGService(defaultConfig);
      
      // Initialize with minimal tests to avoid rate limits
      await service.initialize(false);
      
      this.ragService = service;
      this.ragServiceCreatedAt = Date.now();
      
      this.log('✅ Background RAG service initialization completed');
    } catch (error) {
      this.log('⚠️ Background initialization failed (this is OK):', error);
      // Don't throw - app should still work
    } finally {
      this.backgroundInitPromise = null;
    }
  }

  /**
   * Get cached RAG service without creating new one
   */
  getCachedRAGService(): RAGService | null {
    const now = Date.now();
    const serviceAge = now - this.ragServiceCreatedAt;
    const isServiceExpired = serviceAge > this.config.maxServiceAge;

    if (this.ragService && !isServiceExpired) {
      this.log('📋 Returning cached RAG service');
      return this.ragService;
    }

    this.log('❌ No valid cached RAG service available');
    return null;
  }

  /**
   * Pre-initialize services (call this during app startup)
   */
  async warmupServices(): Promise<void> {
    this.log('🔥 Warming up services...');
    
    // If background init is still running, wait for it
    if (this.backgroundInitPromise) {
      await this.backgroundInitPromise;
    }
    
    // If we don't have a service yet, create one quickly
    if (!this.ragService) {
      try {
        await this.getRAGService();
        this.log('✅ Service warmup completed');
      } catch (error) {
        this.log('❌ Service warmup failed:', error);
        // Don't throw - app should still work
      }
    } else {
      this.log('✅ Service already warmed up from background init');
    }
  }

  /**
   * Invalidate cached services (call this when user logs out)
   */
  invalidateServices(): void {
    this.log('🗑️ Invalidating cached services...');
    this.ragService = null;
    this.ragServiceCreatedAt = 0;
    this.isInitializing = false;
    this.initializationPromise = null;
    this.backgroundInitPromise = null;
    
    // Restart background initialization for next user
    this.startBackgroundInitialization();
  }

  /**
   * Get service health status
   */
  getServiceHealth(): {
    ragService: {
      available: boolean;
      age: number;
      expired: boolean;
    };
  } {
    const now = Date.now();
    const serviceAge = now - this.ragServiceCreatedAt;
    const isServiceExpired = serviceAge > this.config.maxServiceAge;

    return {
      ragService: {
        available: !!this.ragService,
        age: serviceAge,
        expired: isServiceExpired,
      },
    };
  }

  /**
   * Force refresh of all services
   */
  async refreshServices(): Promise<void> {
    this.log('🔄 Refreshing all services...');
    this.invalidateServices();
    await this.getRAGService(true);
  }

  /**
   * Update service configuration and reinitialize if needed
   */
  async updateServiceConfig(newConfig: typeof defaultConfig): Promise<void> {
    this.log('⚙️ Updating service configuration...');
    
    // If configuration changed significantly, recreate services
    this.invalidateServices();
    
    // Update default config (you might want to make this more sophisticated)
    Object.assign(defaultConfig, newConfig);
    
    // Recreate services with new config
    await this.getRAGService(true);
  }

  /**
   * Get service statistics
   */
  getServiceStats(): {
    ragServiceAge: number;
    ragServiceExists: boolean;
    isInitializing: boolean;
    lastInitialization: Date | null;
  } {
    return {
      ragServiceAge: Date.now() - this.ragServiceCreatedAt,
      ragServiceExists: !!this.ragService,
      isInitializing: this.isInitializing,
      lastInitialization: this.ragServiceCreatedAt > 0 ? new Date(this.ragServiceCreatedAt) : null,
    };
  }

  /**
   * Log with service manager prefix
   */
  private log(...args: any[]): void {
    if (this.config.enableLogging) {
      console.log('🔧 ServiceManager:', ...args);
    }
  }

  /**
   * Static method to trigger background initialization
   */
  static startBackgroundInit(): void {
    const instance = ServiceManager.getInstance();
    instance.startBackgroundInitialization();
  }
}

// Export singleton instance
export const serviceManager = ServiceManager.getInstance();

// Export class for type checking
export default ServiceManager;
