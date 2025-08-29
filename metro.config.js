const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Ignore Node.js specific modules that don't work in React Native
    blacklistRE: /node_modules\/.*\/node_modules\/react-native\/.*/,
    alias: {
      // Add any polyfills for Node.js modules if needed
      crypto: 'react-native-crypto',
      stream: 'stream-browserify',
      buffer: '@craftzdog/react-native-buffer',
    },
    // Resolve React Native compatible versions first
    resolverMainFields: ['react-native', 'browser', 'main'],
    platforms: ['ios', 'android', 'web', 'native']
  },
  transformer: {
    // Support for additional file types
    assetExts: ['bin', 'txt', 'jpg', 'png', 'json'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
