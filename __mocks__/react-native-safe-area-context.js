// Jest manual mock for react-native-safe-area-context. The package ships
// its own official mock, but as a .tsx/ESM source file that would need its
// own transformIgnorePatterns carve-out — this is a plain-CJS equivalent
// covering the surface KIS actually uses (SafeAreaProvider/SafeAreaView as
// simple passthrough Views, useSafeAreaInsets/useSafeAreaFrame with fixed
// zero-inset values), so components relying on real device insets don't
// need a device to unit test.
const React = require('react');

const MOCK_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };
const MOCK_FRAME = { x: 0, y: 0, width: 320, height: 640 };

function SafeAreaProvider(props) {
  const { View } = require('react-native');
  return React.createElement(View, { style: props.style }, props.children);
}

function SafeAreaView(props) {
  const { View } = require('react-native');
  return React.createElement(View, { style: props.style, testID: props.testID }, props.children);
}

module.exports = {
  SafeAreaProvider,
  SafeAreaConsumer: ({ children }) => (typeof children === 'function' ? children(MOCK_INSETS) : children),
  SafeAreaView,
  SafeAreaInsetsContext: React.createContext(MOCK_INSETS),
  SafeAreaFrameContext: React.createContext(MOCK_FRAME),
  useSafeAreaInsets: () => MOCK_INSETS,
  useSafeAreaFrame: () => MOCK_FRAME,
  initialWindowMetrics: { insets: MOCK_INSETS, frame: MOCK_FRAME },
  initialWindowSafeAreaInsets: MOCK_INSETS,
  withSafeAreaInsets: (Component) => (props) =>
    React.createElement(Component, { ...props, insets: MOCK_INSETS }),
};
