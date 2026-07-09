// src/hooks/useCollapsingGoldHeader.ts
import { useCallback } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

/**
 * Shared mechanism for every main-tab screen's Golden Section: a sticky
 * identity/action row that never collapses, plus a "collapsing card" below
 * it (search bars, stat cards, tagline/pills, cover images — whatever's
 * specific to that screen) that shrinks and fades away as the screen's own
 * content scrolls, via one Reanimated `scrollY` shared value.
 *
 * Each of the 5 screens previously hand-rolled its own version of this
 * (different value types — RN Animated vs Reanimated — different collapse
 * math, some binary show/hide instead of continuous), which is how they
 * drifted into 5 different behaviors. Centralizing it here keeps the math
 * identical everywhere and fixes it in one place.
 *
 * `collapseDistance`: scroll px over which the card fully collapses.
 *
 * The natural height is measured via `onHeaderLayout`, attached to the
 * un-clipped content inside the collapsing card. It's grow-only — once the
 * card starts being clipped by its own shrinking maxHeight, onLayout can
 * re-fire with the *constrained* height; recording that would shrink the
 * "expanded" target on every scroll-down tick, so scrolling back up could
 * never fully re-open the header. Only genuine content growth (e.g. longer
 * text) should ever raise the recorded value.
 *
 * For screens that also need a direct drag on the header (Bible, Messages),
 * write into the returned `scrollY.value` from a PanResponder's
 * onPanResponderMove instead of introducing a second value — one shared
 * value should drive the collapse regardless of input source.
 */
export function useCollapsingGoldHeader(collapseDistance: number) {
  const scrollY = useSharedValue(0);
  const naturalHeight = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.height;
    if (measured > naturalHeight.value) {
      naturalHeight.value = measured;
    }
  }, [naturalHeight]);

  const collapseStyle = useAnimatedStyle(() => ({
    maxHeight: interpolate(
      scrollY.value,
      [0, collapseDistance],
      [naturalHeight.value, 0],
      Extrapolation.CLAMP,
    ),
    opacity: interpolate(
      scrollY.value,
      [0, collapseDistance * 0.6],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return { scrollY, naturalHeight, onScroll, onHeaderLayout, collapseStyle };
}
