// Jest manual mock for react-native-country-picker-modal. It ships an
// unbuilt ESM source file Jest's default node_modules ignore pattern never
// transforms ("Cannot use import statement outside a module"). Renders as
// a plain View so component tests can assert on the props passed to it
// (countryCode, visible, etc.); it never renders a real country list.
const React = require('react');

const CountryPicker = React.forwardRef(function MockCountryPicker(props, ref) {
  const { View } = require('react-native');
  return React.createElement(View, { testID: props.testID ?? 'mock-country-picker', ref, ...props });
});

module.exports = CountryPicker;
module.exports.default = CountryPicker;
// Named exports SafeCountryPicker.tsx imports as types only (CountryCode,
// Country) don't need runtime values, but DARK_THEME/DEFAULT_THEME and
// similar constants some callers read off this package are covered
// generically here in case future code needs them.
module.exports.DARK_THEME = {};
module.exports.DEFAULT_THEME = {};
module.exports.Flag = CountryPicker;
