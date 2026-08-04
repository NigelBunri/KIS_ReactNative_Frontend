module.exports = {
  preset: 'react-native',
  // The react-native preset's default transformIgnorePatterns
  // (node_modules/(?!(jest-)?react-native|@react-native.../)) assumes a
  // flat node_modules layout. Under pnpm, react-native actually resolves
  // to node_modules/.pnpm/react-native@<version>_.../node_modules/react-native/...,
  // so the default pattern's lookahead never matches and react-native's own
  // (unbuilt, Flow/ESM) source — e.g. its jest/setup.js — was silently left
  // untransformed, breaking every RN test with "Cannot use import statement
  // outside a module". This mirrors the same allow-list (react-native and
  // @react-native(-community)? get transformed; other node_modules don't),
  // just matched against pnpm's virtual-store path shape too.
  transformIgnorePatterns: [
    'node_modules/(?!\\.pnpm/[^/]*/node_modules/((jest-)?react-native|@react-native(-community)?)/|((jest-)?react-native|@react-native(-community)?)/)',
  ],
  // phase5.jest.setup.ts is a per-file import (see broadcast-feeds.*.test.tsx),
  // not a test suite itself; __tests__/mocks/* are manual mocks. Both live
  // under __tests__/, which Jest's default testMatch treats as "every file
  // here is a test suite" — exclude them so they don't show up as spurious
  // failures ("must contain at least one test").
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/phase5\\.jest\\.setup\\.ts$',
    '/__tests__/mocks/',
  ],
};
