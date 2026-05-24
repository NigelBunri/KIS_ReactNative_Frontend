module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
          '@/SocketProvider': './SocketProvider',
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      },
    ],
    // keep this if you use Reanimated
    'react-native-reanimated/plugin',
    // Strip console.log in production builds; keep warn and error for diagnostics
    ...(process.env.NODE_ENV === 'production'
      ? [['transform-remove-console', { exclude: ['warn', 'error'] }]]
      : []),
  ],
};
