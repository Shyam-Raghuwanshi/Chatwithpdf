/**
 * Ultra-Fast React Hooks for Background Services
 * 
 * These hooks use the background service manager for instant performance.
 * Documents load immediately without waiting for RAG initialization.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { backgroundService } from './BackgroundServiceManager';
import RAGService from './RAGService';

interface UseBackgroundRAGReturn {
  ragService: RAGService | null;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  documents: any[];
  loadingDocuments: boolean;
  loadUserDocuments: () => Promise<void>;
  refreshServices: () => Promise<void>;
  cacheStatus: any;
}

/**
 * Ultra-fast hook that loads documents immediately using background services
 */
export const useBackgroundRAG = (userId?: string): UseBackgroundRAGReturn => {
  const [ragService, setRagService] = useState<RAGService | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<any>({});
  
  const documentsLoadedRef = useRef(false);
  const serviceLoadedRef = useRef(false);
  const lastUserIdRef = useRef<string | undefined>(undefined);

  // Reset state when user changes
  useEffect(() => {
    if (lastUserIdRef.current !== userId) {
      console.log('👤 useBackgroundRAG: User changed, resetting state...');
      documentsLoadedRef.current = false;
      setDocuments([]);
      setError(null);
      lastUserIdRef.current = userId;
    }
  }, [userId]);

  // Load documents immediately using background service
  const loadUserDocuments = useCallback(async () => {
    if (!userId || documentsLoadedRef.current) return; // Prevent re-loading if already loaded

    console.log('⚡ useBackgroundRAG: Loading documents instantly...');
    setLoadingDocuments(true);
    const startTime = Date.now();

    try {
      // Load documents directly from background service (never blocks)
      const docs = await backgroundService.loadUserDocuments(userId);
      setDocuments(docs);
      documentsLoadedRef.current = true;
      
      const duration = Date.now() - startTime;
      console.log(`✅ useBackgroundRAG: Documents loaded in ${duration}ms`);
    } catch (error) {
      console.error('❌ useBackgroundRAG: Document loading failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to load documents');
    } finally {
      setLoadingDocuments(false);
    }
  }, [userId]); // Remove loadingDocuments from dependencies to prevent infinite loops

  // Get RAG service from background cache
  const loadRAGService = useCallback(async () => {
    if (serviceLoadedRef.current) return;

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('⚡ useBackgroundRAG: Getting cached RAG service...');
      const service = await backgroundService.getRAGService();
      setRagService(service);
      setIsReady(true);
      serviceLoadedRef.current = true;
      
      console.log('✅ useBackgroundRAG: RAG service ready');
    } catch (error) {
      console.error('❌ useBackgroundRAG: Failed to get RAG service:', error);
      setError(error instanceof Error ? error.message : 'Failed to initialize service');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load documents immediately on mount - don't wait for anything
  useEffect(() => {
    if (userId && !documentsLoadedRef.current) {
      console.log('🚀 useBackgroundRAG: Starting immediate document load...');
      loadUserDocuments();
    }
  }, [userId]); // Remove loadUserDocuments from dependencies to prevent re-fetching

  // Load RAG service in parallel (non-blocking) - only once
  useEffect(() => {
    if (!serviceLoadedRef.current) {
      loadRAGService();
    }
  }, []); // Empty dependency array - only run once

  // Update cache status for debugging - only update when needed
  useEffect(() => {
    const updateStatus = () => {
      setCacheStatus(backgroundService.getCacheStatus());
    };
    
    updateStatus(); // Initial update
    // Only update every 10 seconds instead of every 2 seconds to reduce performance impact
    const interval = setInterval(updateStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Refresh all services
  const refreshServices = useCallback(async () => {
    console.log('🔄 useBackgroundRAG: Refreshing all services...');
    setIsLoading(true);
    setError(null);
    documentsLoadedRef.current = false;
    serviceLoadedRef.current = false;
    
    try {
      await backgroundService.refresh();
      await Promise.all([
        loadRAGService(),
        loadUserDocuments()
      ]);
    } catch (error) {
      console.error('❌ useBackgroundRAG: Refresh failed:', error);
      setError(error instanceof Error ? error.message : 'Refresh failed');
    } finally {
      setIsLoading(false);
    }
  }, [loadRAGService, loadUserDocuments]);

  // Manual refresh for documents only (for after uploading new documents)
  const refreshDocuments = useCallback(async () => {
    console.log('🔄 useBackgroundRAG: Refreshing documents only...');
    documentsLoadedRef.current = false; // Reset the flag
    await loadUserDocuments();
  }, [loadUserDocuments]);

  return {
    ragService,
    isLoading,
    isReady: isReady || backgroundService.isReady(),
    error,
    documents,
    loadingDocuments,
    loadUserDocuments: refreshDocuments, // Use refreshDocuments to prevent infinite loops
    refreshServices,
    cacheStatus
  };
};

/**
 * Simple hook just for getting cached RAG service
 */
export const useCachedRAGService = () => {
  const [ragService, setRagService] = useState<RAGService | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getService = async () => {
      try {
        const service = await backgroundService.getRAGService();
        setRagService(service);
      } catch (error) {
        console.error('Failed to get cached service:', error);
      } finally {
        setIsLoading(false);
      }
    };

    getService();
  }, []);

  return { ragService, isLoading };
};

export default useBackgroundRAG;
