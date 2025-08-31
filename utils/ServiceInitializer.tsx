/**
 * App-level Service Initializer
 * 
 * This component should be placed at the top level of your app
 * to initialize services early and reduce subsequent loading times.
 */

import React, { useEffect } from 'react';
import { serviceManager } from './ServiceManager';

interface ServiceInitializerProps {
  children: React.ReactNode;
  enableWarmup?: boolean;
  userId?: string;
}

const ServiceInitializer: React.FC<ServiceInitializerProps> = ({ 
  children, 
  enableWarmup = true,
  userId 
}) => {
  useEffect(() => {
    if (enableWarmup) {
      console.log('🔥 App: Starting service warmup...');
      
      // Start service warmup in background
      serviceManager.warmupServices().then(() => {
        console.log('✅ App: Service warmup completed');
      }).catch((error) => {
        console.log('⚠️ App: Service warmup failed (this is OK):', error);
      });
    }
  }, [enableWarmup]);

  // Handle user changes
  useEffect(() => {
    if (userId) {
      console.log('👤 App: User authenticated, services ready for:', userId);
    } else {
      console.log('👤 App: User logged out, invalidating services...');
      serviceManager.invalidateServices();
    }
  }, [userId]);

  return <>{children}</>;
};

export default ServiceInitializer;
