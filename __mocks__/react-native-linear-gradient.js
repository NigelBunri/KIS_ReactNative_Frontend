// Jest manual mock for react-native-linear-gradient. It ships an unbuilt
// ESM source file Jest's default node_modules ignore pattern never
// transforms ("Cannot use import statement outside a module"), and its
// native module isn't linked under Jest anyway. Renders as a plain View so
// component tests can assert on the props passed to it (colors, start,
// end, style, etc.); it never actually paints a gradient.
const React = require('react');

const LinearGradient = React.forwardRef(function MockLinearGradient(props, ref) {
  const { View } = require('react-native');
  return React.createElement(View, { testID: props.testID ?? 'mock-linear-gradient', ref, ...props }, props.children);
});

module.exports = LinearGradient;
module.exports.default = LinearGradient;
