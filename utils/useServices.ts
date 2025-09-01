/**
 * React Hook for Service Management
 * 
 * This hook provides a React-friendly interface to the ServiceManager
 * and handles service lifecycle in React components.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { serviceManager } from './ServiceManager';
import RAGService from './RAGService';

interface UseServicesOptions {
  autoInitialize?: boolean;
  enablePreloading?: boolean;
  userId?: string;
}

interface UseServicesReturn {
  ragService: RAGService | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  getRagService: () => Promise<RAGService>;
  refreshServices: () => Promise<void>;
  serviceStats: ReturnType<typeof serviceManager.getServiceStats>;
}

/**
 * Hook to manage services across the application
 */
export const useServices = (options: UseServicesOptions = {}): UseServicesReturn => {
  console.log('🔍 useServices: Hook called', options);
  const mainHookStartTime = Date.now();
  
  const { autoInitialize = false, enablePreloading = false, userId } = options;

  const [ragService, setRagService] = useState<RAGService | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceStats, setServiceStats] = useState(serviceManager.getServiceStats());
  
  const initializationAttempted = useRef(false);
  const currentUserId = useRef(userId);

  // Update stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setServiceStats(serviceManager.getServiceStats());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Handle user changes
  useEffect(() => {
    if (currentUserId.current !== userId) {
      console.log('🔄 User changed, invalidating services...');
      currentUserId.current = userId;
      serviceManager.invalidateServices();
      setRagService(null);
      setIsInitialized(false);
      initializationAttempted.current = false;
      
      if (autoInitialize && userId) {
        initializeServices();
      }
    }
  }, [userId, autoInitialize]);

  // Try to get cached service immediately on mount
  useEffect(() => {
    const cachedService = serviceManager.getCachedRAGService();
    if (cachedService && !ragService) {
      console.log('⚡ useServices: Found cached service immediately');
      setRagService(cachedService);
      setIsInitialized(true);
      setIsLoading(false);
      return;
    }
  }, [ragService]);

  // Auto-initialize services
  useEffect(() => {
    if (autoInitialize && !initializationAttempted.current && userId) {
      initializeServices();
    }
  }, [autoInitialize, userId]);

  // Preload services on app start
  useEffect(() => {
    if (enablePreloading && !initializationAttempted.current) {
      preloadServices();
    }
  }, [enablePreloading]);

  const initializeServices = useCallback(async () => {
    if (isLoading || initializationAttempted.current) return;
    
    initializationAttempted.current = true;
    setIsLoading(true);
    setError(null);

    try {
      console.log('🚀 useServices: Initializing services...');
      
      // Check if we have a cached service first
      const cachedService = serviceManager.getCachedRAGService();
      if (cachedService) {
        console.log('♻️ useServices: Using cached service');
        setRagService(cachedService);
        setIsInitialized(true);
        setIsLoading(false);
        return;
      }

      // Get/create RAG service
      const service = await serviceManager.getRAGService();
      setRagService(service);
      setIsInitialized(true);
      
      console.log('✅ useServices: Services initialized successfully');
    } catch (err: any) {
      console.error('❌ useServices: Failed to initialize services:', err);
      setError(err.message || 'Failed to initialize services');
      setIsInitialized(false);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const preloadServices = useCallback(async () => {
    try {
      console.log('🔥 useServices: Preloading services...');
      await serviceManager.warmupServices();
      
      // Get the preloaded service
      const cachedService = serviceManager.getCachedRAGService();
      if (cachedService) {
        setRagService(cachedService);
        setIsInitialized(true);
      }
    } catch (err) {
      console.log('⚠️ useServices: Service preloading failed (this is OK):', err);
      // Don't set error state for preloading failures
    }
  }, []);

  const getRagService = useCallback(async (): Promise<RAGService> => {
    if (ragService && isInitialized) {
      return ragService;
    }

    const service = await serviceManager.getRAGService();
    setRagService(service);
    setIsInitialized(true);
    return service;
  }, [ragService, isInitialized]);

  const refreshServices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔄 useServices: Refreshing services...');
      await serviceManager.refreshServices();
      
      const service = serviceManager.getCachedRAGService();
      setRagService(service);
      setIsInitialized(!!service);
    } catch (err: any) {
      console.error('❌ useServices: Failed to refresh services:', err);
      setError(err.message || 'Failed to refresh services');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    ragService,
    isLoading,
    isInitialized,
    error,
    getRagService,
    refreshServices,
    serviceStats,
  };
};

/**
 * Hook specifically for RAG service with additional utilities and parallel loading
 */
export const useRAGService = (userId?: string) => {
  console.log('🔍 useRAGService: Hook called', { userId });
  const hookStartTime = Date.now();
  
  const services = useServices({ 
    autoInitialize: true, 
    enablePreloading: true, 
    userId 
  });

  console.log('🔍 useRAGService: useServices returned', {
    hasRagService: !!services.ragService,
    isLoading: services.isLoading,
    isInitialized: services.isInitialized,
    timeSinceStart: Date.now() - hookStartTime
  });

  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const documentsLoadedRef = useRef(false);

  // Load documents instantly without waiting for RAG initialization
  const loadUserDocuments = useCallback(async (ragService?: RAGService) => {
    if (!userId || loadingDocuments) return;

    setLoadingDocuments(true);
    console.log('🚀 Loading documents instantly...');
    
    try {
      // Try multiple approaches for instant loading
      let service = ragService;
      
      if (!service) {
        // First try cached service (should be available from background init)
        const cachedService = serviceManager.getCachedRAGService();
        if (cachedService) {
          service = cachedService;
        }
      }
      
      if (!service) {
        // If no cached service, get one quickly (ultra-fast mode)
        console.log('⚡ Getting service in ultra-fast mode...');
        service = await services.getRagService();
      }
      
      if (service) {
        console.log('📄 Loading documents with service...');
        const docs = await service.getUserDocuments(userId);
        setDocuments(docs);
        documentsLoadedRef.current = true;
        console.log(`✅ Loaded ${docs.length} documents instantly`);
      } else {
        console.log('⏳ Service not ready, loading will happen when service initializes');
        setDocuments([]); // Set empty for now
      }
    } catch (error) {
      console.error('📄 Document loading error:', error);
      // Don't fail completely, just set empty documents
      setDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  }, [userId, services, loadingDocuments]);

  // Load documents immediately on component mount - don't wait for anything
  useEffect(() => {
    if (userId && !documentsLoadedRef.current) {
      console.log('🚀 Triggering immediate document loading...');
      loadUserDocuments(); // Start loading immediately
    }
  }, [userId, loadUserDocuments]);

  // Also load when service becomes available (if not already loaded)
  useEffect(() => {
    if (services.ragService && userId && !documentsLoadedRef.current) {
      console.log('🔄 Service ready, loading documents if not already loaded...');
      loadUserDocuments(services.ragService);
    }
  }, [services.ragService, userId, loadUserDocuments]);

  return {
    ...services,
    documents,
    loadingDocuments,
    loadUserDocuments: () => loadUserDocuments(),
  };
};

export default useServices;
