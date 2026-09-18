const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
// 'tflite' lets metro treat bundled on-device model files (see
// src/services/contentSafety/onDeviceImageScan.ts) as binary assets
// loadable via require(..), per react-native-fast-tflite's setup docs.
const config = {
  resolver: {
    assetExts: [...getDefaultConfig(__dirname).resolver.assetExts, 'tflite'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
