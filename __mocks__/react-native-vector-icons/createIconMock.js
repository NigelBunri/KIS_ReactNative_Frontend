// Shared factory behind the per-icon-set mocks in this directory.
// react-native-vector-icons ships ESM source under Jest's transform
// allow-list gap (same class of issue as react-native-video/-fs above);
// this renders as a plain Text with the icon name so tests can assert on
// which icon was requested without needing the real font/glyph rendering.
const React = require('react');

function createIconMock(setName) {
  function IconMock(props) {
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: `icon-${setName}-${props.name}`, ...props }, props.name);
  }
  IconMock.getImageSource = jest.fn(() => Promise.resolve({ uri: 'mock-icon' }));
  IconMock.getRawGlyphMap = jest.fn(() => ({}));
  IconMock.hasIcon = jest.fn(() => true);
  IconMock.loadFont = jest.fn(() => Promise.resolve());
  return IconMock;
}

module.exports = createIconMock;
