// Jest manual mock for react-native-keyboard-controller. Its native module
// isn't linked under Jest ("doesn't seem to be linked... pod install"),
// which broke every test that transitively imports App.tsx, AppNavigator,
// or ChatRoomBody (all three pull this package in at module scope). Minimal
// generic stand-ins for the surface KIS actually uses:
//  - KeyboardProvider / KeyboardAvoidingView: passthrough wrappers, like
//    the real components render when there's no keyboard to react to.
//  - useKeyboardAnimation: { height } is read straight into transform:
//    [{ translateY: keyboardHeight }] (see AppNavigator.tsx) as either a
//    plain number or an Animated.Value — 0 satisfies both.
//  - useKeyboardState(selector): the real hook derives a reanimated value
//    and applies `selector` to it; mocking it as selector(state) against a
//    fixed "keyboard closed" state keeps that contract without reanimated.
const React = require('react');

function KeyboardProvider(props) {
  return props.children ?? null;
}

const KeyboardAvoidingView = React.forwardRef(function MockKeyboardAvoidingView(props, ref) {
  const { View } = require('react-native');
  return React.createElement(View, { ...props, ref }, props.children);
});

const useKeyboardAnimation = () => ({ height: 0, progress: 0 });

const MOCK_KEYBOARD_STATE = { isVisible: false, height: 0 };
const useKeyboardState = (selector) =>
  typeof selector === 'function' ? selector(MOCK_KEYBOARD_STATE) : MOCK_KEYBOARD_STATE;

module.exports = {
  KeyboardProvider,
  KeyboardAvoidingView,
  useKeyboardAnimation,
  useKeyboardState,
};
