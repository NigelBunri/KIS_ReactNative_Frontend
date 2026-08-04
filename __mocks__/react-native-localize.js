// Jest manual mock for react-native-localize — its native module isn't
// linked under Jest. Minimal, generic stand-in matching a fixed en-US
// locale, not KIS-specific.
module.exports = {
  getLocales: jest.fn(() => [
    { countryCode: 'US', languageTag: 'en-US', languageCode: 'en', isRTL: false },
  ]),
  findBestLanguageTag: jest.fn(() => ({ languageTag: 'en-US', isRTL: false })),
  getCountry: jest.fn(() => 'US'),
  getCurrencies: jest.fn(() => ['USD']),
  getCalendar: jest.fn(() => 'gregorian'),
  getNumberFormatSettings: jest.fn(() => ({ decimalSeparator: '.', groupingSeparator: ',' })),
  getTemperatureUnit: jest.fn(() => 'fahrenheit'),
  getTimeZone: jest.fn(() => 'UTC'),
  uses24HourClock: jest.fn(() => false),
  usesMetricSystem: jest.fn(() => false),
  usesAutoDateAndTime: jest.fn(() => Promise.resolve(true)),
  usesAutoTimeZone: jest.fn(() => Promise.resolve(true)),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};
