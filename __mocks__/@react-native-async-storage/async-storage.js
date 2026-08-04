// Jest manual mock for @react-native-async-storage/async-storage.
// Auto-applied to every test (Jest convention: a __mocks__ dir adjacent to
// node_modules mocks that node_modules package for ALL tests, no explicit
// jest.mock() call needed). Re-exports the package's own official, full-
// fidelity in-memory mock rather than hand-rolling a partial one, so
// multiGet/multiSet/mergeItem etc. all behave like the real module, not
// just the couple of methods any one test happens to call today.
module.exports = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
