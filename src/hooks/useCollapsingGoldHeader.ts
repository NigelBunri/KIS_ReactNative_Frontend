// src/hooks/useCollapsingGoldHeader.ts
import { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { resolveNaturalHeight } from './goldHeaderNaturalHeight';

/**
 * Shared mechanism for every main-tab screen's Golden Section: a sticky
 * identity/action row that never collapses, plus a "collapsing card" below
 * it (search bars, stat cards, tagline/pills, cover images - whatever's
 * specific to that screen) that shrinks and fades away as the screen's own
 * content scrolls, via one Reanimated `scrollY` shared value.
 *
 * Each of the 5 screens previously hand-rolled its own version of this
 * (different value types - RN Animated vs Reanimated - different collapse
 * math, some binary show/hide instead of continuous), which is how they
 * drifted into 5 different behaviors. Centralizing it here keeps the math
 * identical everywhere and fixes it in one place.
 *
 * `collapseDistance`: scroll px over which the card fully collapses.
 *
 * The natural height is measured via `onHeaderLayout`, attached to the
 * un-clipped content inside the collapsing card. Measurements are trusted
 * unconditionally only while the header is at rest (fully expanded, where
 * maxHeight can't be constraining anything) and are grow-only otherwise —
 * see goldHeaderNaturalHeight.ts's resolveNaturalHeight for the full
 * rationale (shared with ProfileDashboardBlocks.tsx's bespoke equivalent).
 * This lets genuinely shorter content shrink the reserved space back down
 * (once scrolled back to rest) without reintroducing the old bug where a
 * mid-collapse remeasurement could permanently ratchet the ceiling down.
 *
 * For screens that also need a direct drag on the header (Bible, Messages),
 * write into the returned `scrollY.value` from a PanResponder's
 * onPanResponderMove instead of introducing a second value - one shared
 * value should drive the collapse regardless of input source.
 */
export function useCollapsingGoldHeader(collapseDistance: number) {
  const scrollY = useSharedValue(0);
  // Seeded to collapseDistance, not 0. On every first focus of a session
  // (see GoldenSectionContext's per-owner remount), this card renders for at
  // least one frame before onHeaderLayout has ever measured it — a 0 seed
  // meant that frame rendered at maxHeight: 0, then snapped to the real
  // measured height the instant layout ran. Since this whole card sits
  // inside App.tsx's shared GoldenSection, a normal-flow sibling above the
  // entire NavigationContainer (see GoldHeaderShell.tsx), that snap resized
  // the space available to the tab navigator below it, visibly moving the
  // bottom tab bar on every screen's startup. collapseDistance is already
  // hand-tuned per screen to roughly match this same card's real height (see
  // each call site), making it a much closer estimate than a flat 0 — same
  // fix shape as ProfileDashboardBlocks.tsx's hand-rolled equivalent, which
  // seeds from an estimate instead of 0 for the same reason.
  const naturalHeight = useSharedValue(collapseDistance);
  // Eased mirror of scrollY used only to drive collapseStyle below — never
  // returned, never used for anything else. collapseStyle animates
  // maxHeight, a real layout property, on a box that sits as a normal-flow
  // sibling above the screen's own ScrollView (see GoldHeaderShell.tsx).
  // Shrinking it on every raw scroll frame resizes the ScrollView's own
  // container, which perturbs its content offset and re-fires the scroll
  // handler on literally every touch-move frame. On a slow drag there's
  // time for each correction to land before the next touch-move, so it
  // reads as the whole screen vibrating in place (a fast flick outruns the
  // loop and looks fine, which is why this only showed up while scrolling
  // slowly). Retargeting only once the raw offset has moved a few pixels,
  // then easing to it, is coarse enough that the resize can no longer fire
  // on every frame. Same fix as ProfileScreen's hand-rolled profileHeaderY,
  // applied once here so every consumer of this hook gets it for free
  // instead of each screen needing its own copy.
  const collapseScrollY = useSharedValue(0);
  useAnimatedReaction(
    () => scrollY.value,
    (current) => {
      if (Math.abs(current - collapseScrollY.value) > 6) {
        collapseScrollY.value = withTiming(current, { duration: 160 });
      }
    },
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  // A screen's real header content typically doesn't settle in one
  // onHeaderLayout call during initial load — e.g. Messages' online-count
  // badge, or any tier/subscription-gated row, mounts once with placeholder
  // content then again once its own async fetch resolves, each a separate
  // layout pass. Since the header is at rest for the whole loading window,
  // resolveNaturalHeight trusts every one of those measurements immediately
  // (that's correct in isolation — see its own doc comment), but committing
  // each one straight to naturalHeight.value means every intermediate
  // measurement is its own visible correction to maxHeight, and since this
  // card sits as a normal-flow sibling above the entire tab navigator (see
  // GoldenSection in App.tsx), each correction visibly nudges the bottom tab
  // bar's containing box too — the reported "tab bar moves during load" bug.
  // Debouncing the *commit* (not the measurement policy itself) collapses
  // however many of these fire in quick succession into the one that
  // actually matters — the final, settled height — so there's at most one
  // visible correction instead of one per async data source. 150ms matches
  // collapseScrollY's own withTiming duration just above, for the same
  // "don't react to every individual layout blip" reasoning.
  //
  // That still leaves one real commit per async data source when those
  // sources resolve more than 150ms apart (a slow badge-count fetch, say) —
  // the debounce window has nothing left to collapse against by then. That
  // commit was landing as an instant snap (a bare .value assignment), which
  // on screens whose data legitimately arrives a moment after the screen is
  // already visible (every screen except Bible, which has no such
  // secondary async source) read as the tab bar suddenly jumping on its
  // own. Wrapping the commit in withTiming doesn't try to prevent this
  // still-legitimate late correction — it just eases it, so a correction
  // that has to happen reads as a soft settle instead of a jump.
  const pendingLayoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (pendingLayoutTimer.current) clearTimeout(pendingLayoutTimer.current);
  }, []);

  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.height;
    if (pendingLayoutTimer.current) clearTimeout(pendingLayoutTimer.current);
    pendingLayoutTimer.current = setTimeout(() => {
      pendingLayoutTimer.current = null;
      const resolved = resolveNaturalHeight({
        measured,
        current: naturalHeight.value,
        collapseDriverValue: collapseScrollY.value,
      });
      naturalHeight.value = withTiming(resolved, { duration: 220 });
    }, 150);
  }, [naturalHeight, collapseScrollY]);

  const collapseStyle = useAnimatedStyle(() => ({
    maxHeight: interpolate(
      collapseScrollY.value,
      [0, collapseDistance],
      [naturalHeight.value, 0],
      Extrapolation.CLAMP,
    ),
    opacity: interpolate(
      collapseScrollY.value,
      [0, collapseDistance * 0.6],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return { scrollY, naturalHeight, onScroll, onHeaderLayout, collapseStyle };
}
