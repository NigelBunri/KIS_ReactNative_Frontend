// Jest manual mock for react-native-encrypted-storage — the real module
// throws at import time when its native module isn't linked (always true
// under Jest), which broke every test that transitively imports
// src/security/authStorage.ts (nearly everything touching @/network). No
// official jest mock ships with this package, so this is a minimal,
// generic in-memory implementation of its real static API — nothing
// KIS-specific.
let store = {};

module.exports = {
  __esModule: true,
  default: {
    setItem: jest.fn((key, value) => {
      store[key] = String(value);
      return Promise.resolve();
    }),
    getItem: jest.fn((key) => Promise.resolve(Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null)),
    removeItem: jest.fn((key) => {
      delete store[key];
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      store = {};
      return Promise.resolve();
    }),
    __resetMockStore: () => {
      store = {};
    },
  },
};
