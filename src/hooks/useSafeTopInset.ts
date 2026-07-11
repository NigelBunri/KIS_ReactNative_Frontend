// src/hooks/useSafeTopInset.ts
import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Every screen in the app reads its top spacing through this hook, so this is
// the one dial for nudging that spacing app-wide — change it here instead of
// hardcoding a literal in any individual screen.
//
// The 5 main-tab screens (Messages, Bible, Broadcast, Partners, Profile) opt
// out of this dial — they read useRawTopInset() directly — so they keep
// their own hand-tuned gold-header spacing when this changes.
const GLOBAL_TOP_PADDING = 20;

// react-native-safe-area-context misreports the Android top inset as a
// near-zero garbage value on Android 15+ (API 35+), where the OS itself force-
// enables edge-to-edge regardless of app config — a long-standing upstream
// bug (github.com/AppAndFlow/react-native-safe-area-context/issues/634) that
// affects real devices (Samsung Galaxy S21 among them) and emulators alike.
// StatusBar.currentHeight is accurate there instead, so this only substitutes
// it above API 35 — it's the unreliable one on older Android.
const ANDROID_BROKEN_INSET_SDK = 35;

/**
 * The device's real top safe-area inset (status bar / notch / Dynamic
 * Island), corrected for the Android 15+ safe-area-context bug above. Use
 * this anywhere raw useSafeAreaInsets().top would otherwise be read.
 */
export function useRawTopInset(): number {
  const insetsTop = useSafeAreaInsets().top;
  if (
    Platform.OS === 'android' &&
    Platform.Version >= ANDROID_BROKEN_INSET_SDK &&
    StatusBar.currentHeight
  ) {
    return StatusBar.currentHeight;
  }
  return insetsTop;
}

/**
 * useRawTopInset() plus GLOBAL_TOP_PADDING. Single source of truth so screens
 * never hardcode a top-spacing literal — hardcoded values under-compensate on
 * Dynamic Island devices (~59pt) and over-compensate on older/Android devices
 * (~20-25pt).
 */
export function useSafeTopInset(): number {
  return useRawTopInset() + GLOBAL_TOP_PADDING;
}
