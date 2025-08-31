/**
 * Performance Monitor for Services
 * 
 * This component monitors service performance and provides debugging information
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { serviceManager } from './ServiceManager';

interface ServicePerformanceMonitorProps {
  enabled?: boolean;
  position?: 'top' | 'bottom';
}

const ServicePerformanceMonitor: React.FC<ServicePerformanceMonitorProps> = ({ 
  enabled = __DEV__, // Only show in development by default
  position = 'top' 
}) => {
  const [stats, setStats] = React.useState(serviceManager.getServiceStats());

  React.useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setStats(serviceManager.getServiceStats());
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [enabled]);

  if (!enabled) return null;

  const formatAge = (age: number) => {
    const seconds = Math.floor(age / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getStatusColor = () => {
    if (!stats.ragServiceExists) return '#ff3b30'; // Red
    if (stats.isInitializing) return '#ff9500'; // Orange
    return '#30d158'; // Green
  };

  return (
    <View style={[
      styles.container, 
      position === 'bottom' ? styles.bottom : styles.top
    ]}>
      <View style={styles.content}>
        <View style={[styles.indicator, { backgroundColor: getStatusColor() }]} />
        <Text style={styles.text}>
          RAG: {stats.ragServiceExists ? `${formatAge(stats.ragServiceAge)}` : 'N/A'}
          {stats.isInitializing && ' (init...)'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  top: {
    top: 60, // Below status bar
  },
  bottom: {
    bottom: 100, // Above bottom navigation
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});

export default ServicePerformanceMonitor;
