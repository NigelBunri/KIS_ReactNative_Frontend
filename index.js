/**
 * @format
 */
// index.js
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import QuickCrypto from 'react-native-quick-crypto';
import { AppRegistry, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import App from './App';
import { name as appName } from './app.json';
import { installLocalizationRuntime } from './src/languages/runtimePatch';
import { registerAndroidEvents } from './src/services/calls/callKitService';

// react-native-reorderable-list's documented nested-list pattern
// (ScrollViewContainer + NestedReorderableList, scrollable={false} —
// see WebsiteBuilderScreen/SectionPreview) renders its FlatList inside a
// real Animated.ScrollView, which trips RN's static "VirtualizedLists
// should never be nested" heuristic. The inner list has scrolling
// disabled and delegates entirely to the outer ScrollViewContainer via
// shared gesture coordination, so there's no actual double-scroll/
// windowing conflict — a known false positive for this exact library
// combination, not a real bug.
LogBox.ignoreLogs(['VirtualizedLists should never be nested']);

installLocalizationRuntime();

// Must run unconditionally at JS entry (Android-only, no-op on iOS/if
// react-native-callkeep isn't installed) so headless JS invocations from a
// killed-state FCM call push can still route native answer/decline actions.
registerAndroidEvents();

if (!global.Buffer) {
  global.Buffer = Buffer;
}
if (!global.window) {
  global.window = global;
}
if (!global.crypto || !global.crypto.subtle) {
  global.crypto = QuickCrypto;
}

function Root() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <App />
    </GestureHandlerRootView>
  );
}

AppRegistry.registerComponent(appName, () => Root);
