// src/hooks/useSafeTopInset.ts
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Every screen in the app reads its top spacing through this hook, so this is
// the one dial for nudging that spacing app-wide — change it here instead of
// hardcoding a literal in any individual screen.
//
// The 5 main-tab screens (Messages, Bible, Broadcast, Partners, Profile) opt
// out of this dial — they read useSafeAreaInsets().top directly — so they
// keep their own hand-tuned gold-header spacing when this changes.
const GLOBAL_TOP_PADDING = 20;

/**
 * The device's real top safe-area inset (status bar / notch / Dynamic Island),
 * plus GLOBAL_TOP_PADDING. Single source of truth so screens never hardcode a
 * top-spacing literal — hardcoded values under-compensate on Dynamic Island
 * devices (~59pt) and over-compensate on older/Android devices (~20-25pt).
 */
export function useSafeTopInset(): number {
  return useSafeAreaInsets().top + GLOBAL_TOP_PADDING;
}
