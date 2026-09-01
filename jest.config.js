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
  // just matched against pnpm's virtual-store path shape too. @react-navigation
  // is added for the same reason: its packages ship ESM-only builds
  // (lib/module/index.js uses `export`), and any test that transitively
  // pulls in App.tsx (e.g. via SocketProvider's `useAuth` import) drags the
  // real navigator in with it.
  // react-native-reanimated and its react-native-worklets dependency are
  // the same story again, reached via MessagesScreen.tsx ->
  // AppNavigator.tsx -> App.tsx.
  transformIgnorePatterns: [
    'node_modules/(?!\\.pnpm/[^/]*/node_modules/((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-reanimated|react-native-worklets)/|((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-reanimated|react-native-worklets)/)',
  ],
  // 20+ files import `useAuth` straight from App.tsx (App.tsx being the
  // app's root component, that pulls the entire navigation stack and every
  // screen's native dependencies in behind it — see
  // __tests__/mocks/socketProviderAuthStub.ts for the full rationale).
  // Matches any relative specifier resolving to root App.tsx EXCEPT the
  // single '../App' hop, which is __tests__/App.test.tsx's own import of
  // the real default-exported App component (deliberately not stubbed);
  // no useAuth-importer is one directory level up from root, so this
  // can't collide with it.
  moduleNameMapper: {
    '^(\\./App|(\\.\\./){2,}App)$': '<rootDir>/__tests__/mocks/socketProviderAuthStub.ts',
    // react-native-reanimated's real entry point requires react-native-
    // worklets' native module, which (like every other native module in
    // this file) isn't linked under Jest — reanimated ships this mock
    // (src/mock.js under the hood) as its own officially documented jest
    // stand-in specifically to avoid that, so use it instead of hand-
    // rolling one.
    '^react-native-reanimated$': 'react-native-reanimated/mock',
  },
  // phase5.jest.setup.ts is a per-file import (see broadcast-feeds.*.test.tsx),
  // not a test suite itself; __tests__/mocks/* are manual mocks. Both live
  // under __tests__/, which Jest's default testMatch treats as "every file
  // here is a test suite" — exclude them so they don't show up as spurious
  // failures ("must contain at least one test").
  // react-native-gesture-handler's own official jest setup — mocks its
  // native module (RNGestureHandlerModule) so GestureDetector/Gesture
  // imports (e.g. src/screens/calls/components/InCallWhiteboardSheet.tsx)
  // don't throw "could not be found" for a module that's never linked
  // under Jest. Standard per the package's own docs, not KIS-specific.
  setupFiles: ['react-native-gesture-handler/jestSetup'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/phase5\\.jest\\.setup\\.ts$',
    '/__tests__/mocks/',
    // App.test.tsx: excluded, not just skipped — see the comment at the
    // top of that file for why (reanimated v4/worklets can't be required
    // under Jest at all right now, even via reanimated's own mock, so
    // test.skip can't save it: the crash is in the static import, before
    // Jest ever reaches the skip).
    '/__tests__/App\\.test\\.tsx$',
  ],
};
