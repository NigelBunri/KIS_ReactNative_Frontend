// Jest manual mock for react-native-view-shot — its native module isn't
// linked under Jest. Renders as a plain View exposing a `capture()` method
// on its ref (see StickerEditor.tsx: `viewShotRef.current.capture()`), so
// callers get a resolved fake URI instead of a native-module crash.
const React = require('react');

const ViewShot = React.forwardRef(function MockViewShot(props, ref) {
  React.useImperativeHandle(ref, () => ({
    capture: jest.fn().mockResolvedValue('file:///mock/view-shot.png'),
  }));
  const { View } = require('react-native');
  return React.createElement(View, { testID: props.testID ?? 'mock-view-shot', style: props.style }, props.children);
});

module.exports = ViewShot;
module.exports.default = ViewShot;
module.exports.captureRef = jest.fn().mockResolvedValue('file:///mock/view-shot.png');
