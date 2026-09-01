// Jest manual mock for react-native-pdf. It ships an unbuilt ESM source
// file (import/export syntax Jest's default node_modules ignore pattern
// never transforms), and its native module isn't linked under Jest anyway
// — same situation as react-native-video.js in this folder. Renders as a
// plain View so component tests can assert on the props passed to it
// (source, page, style, etc.); it never actually renders a PDF.
const React = require('react');

const Pdf = React.forwardRef(function MockPdf(props, ref) {
  React.useImperativeHandle(ref, () => ({}));
  const { View } = require('react-native');
  return React.createElement(View, { testID: props.testID ?? 'mock-pdf', ...props });
});

module.exports = Pdf;
module.exports.default = Pdf;
