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
import { registerBackgroundPushHandler } from './src/push/notifications';

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

// Must also run unconditionally at JS entry, not later inside App.tsx's
// useEffect — Android only spins up a headless JS instance to run a
// background FCM handler that was registered *before* the push arrived.
// A handler attached after App.tsx mounts only exists once the app has
// already booted once (backgrounded-but-alive), never for a fully killed
// process, which silently dropped data-only pushes (incoming call rings)
// while regular notification-block pushes (chat messages) kept working
// since the OS displays those natively without any JS involved at all.
registerBackgroundPushHandler();

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
