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
  const {
    autoInitialize = true,
    enablePreloading = true,
    userId
  } = options;

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
  const services = useServices({ 
    autoInitialize: true, 
    enablePreloading: true, 
    userId 
  });

  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const documentsLoadedRef = useRef(false);

  // Load documents in parallel with service initialization
  const loadUserDocuments = useCallback(async (ragService?: RAGService) => {
    if (!userId) return;

    setLoadingDocuments(true);
    try {
      // Use provided service or get from services
      const serviceToUse = ragService || services.ragService;
      
      if (!serviceToUse) {
        // If no service available, try to get one
        const service = await services.getRagService();
        const docs = await service.getUserDocuments(userId);
        setDocuments(docs);
      } else {
        const docs = await serviceToUse.getUserDocuments(userId);
        setDocuments(docs);
      }
      
      documentsLoadedRef.current = true;
    } catch (error) {
      console.error('Failed to load user documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  }, [userId, services]);

  // Start loading documents immediately, even before service is fully ready
  useEffect(() => {
    if (userId && !documentsLoadedRef.current) {
      // Try to load documents immediately if we have a cached service
      const cachedService = serviceManager.getCachedRAGService();
      if (cachedService) {
        console.log('🚀 Loading documents with cached service');
        loadUserDocuments(cachedService);
      } else {
        // Start loading in parallel with service initialization
        console.log('🚀 Starting parallel service init + document loading');
        services.getRagService().then(service => {
          loadUserDocuments(service);
        }).catch(error => {
          console.error('Failed to get service for document loading:', error);
          setLoadingDocuments(false);
        });
      }
    }
  }, [userId, loadUserDocuments, services]);

  return {
    ...services,
    documents,
    loadingDocuments,
    loadUserDocuments: () => loadUserDocuments(),
  };
};

export default useServices;
