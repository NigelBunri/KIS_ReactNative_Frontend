// Jest manual mock for @react-native-clipboard/clipboard — its native
// module ('RNCClipboard') isn't registered under Jest, which throws at
// import time and broke every test that transitively imports
// InteractiveMessageRow.tsx (ChatRoom) or FeedsDiscoverPage.tsx. Only
// setString is used anywhere in this codebase; the rest of the package's
// static API is stubbed out generically in case a future caller needs it.
module.exports = {
  __esModule: true,
  default: {
    setString: jest.fn(),
    getString: jest.fn().mockResolvedValue(''),
    hasString: jest.fn().mockResolvedValue(false),
    setImage: jest.fn(),
    getImage: jest.fn().mockResolvedValue(''),
    hasImage: jest.fn().mockResolvedValue(false),
    hasURL: jest.fn().mockResolvedValue(false),
    hasNumber: jest.fn().mockResolvedValue(false),
    hasWebURL: jest.fn().mockResolvedValue(false),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
  },
};
