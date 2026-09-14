// src/hooks/useHeaderDragToScroll.ts
import { useMemo, useRef } from 'react';
import { PanResponder } from 'react-native';
import { withSpring, type SharedValue } from 'react-native-reanimated';

/** Common imperative handle shape for content views a header-drag dispatcher
 * scrolls - implemented by plain ScrollView refs (native `scrollTo` already
 * matches this shape) and by forwardRef'd FlatList/SectionList wrappers
 * (e.g. via `getScrollResponder()?.scrollTo(...)`). */
export type ScrollableHandle = {
  scrollTo: (opts: { y: number; animated?: boolean }) => void;
};

/**
 * Lets a screen's gold header be dragged directly (not just scrolled via its
 * content list) to collapse/expand, while keeping the underlying content in
 * lockstep - the header commonly lives outside the screen's own content tree
 * (registered with the shared Golden Section host), so a drag starting on it
 * has no native scroll gesture to move the page; without the `onScrollTo`
 * callback here, the header would collapse/expand while the content
 * underneath stayed completely still.
 *
 * `collapseDistance` is a shared value rather than a plain number so callers
 * with a dynamically-measured collapse distance (e.g. the header's own
 * natural height) and callers with a fixed constant can use the same hook.
 */
export function useHeaderDragToScroll({
  scrollY,
  collapseDistance,
  onScrollTo,
}: {
  scrollY: SharedValue<number>;
  collapseDistance: SharedValue<number>;
  onScrollTo: (y: number, animated: boolean) => void;
}) {
  const gestureStartOffsetRef = useRef(0);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 8 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.25,
        onPanResponderGrant: () => {
          gestureStartOffsetRef.current = scrollY.value;
        },
        onPanResponderMove: (_, gesture) => {
          const distance = Math.max(collapseDistance.value, 1);
          const nextOffset = Math.max(0, Math.min(distance, gestureStartOffsetRef.current - gesture.dy));
          scrollY.value = nextOffset;
          // Move the real content scroll 1:1 with the finger, immediately -
          // this is what makes dragging the header feel like dragging the
          // page itself, instead of only collapsing the header in place.
          onScrollTo(nextOffset, false);
        },
        onPanResponderRelease: (_, gesture) => {
          const distance = Math.max(collapseDistance.value, 1);
          const nextOffset = Math.max(0, Math.min(distance, gestureStartOffsetRef.current - gesture.dy));
          // Always resolves to a full extreme - 0 (expanded) or `distance`
          // (collapsed) - never partway, no matter how small the drag was.
          // The previous version had shouldCollapse (>45%) and shouldExpand
          // (<18%) as separate conditions with a dead zone between them
          // where NEITHER fired and target fell through to the raw
          // `nextOffset` - a small drag landing in that 18-45% gap (which a
          // small drag does, by construction) left the header stuck exactly
          // where the finger released, with the search row faded out
          // (opacity's interpolation range ends well before maxHeight's
          // does - see collapseStyle in useCollapsingGoldHeader.ts) but the
          // tab row still fully visible below it. A decisive flick still
          // wins outright regardless of how far the drag actually traveled;
          // otherwise this falls back to whichever extreme the release
          // position is nearer to - there is no third outcome.
          const target =
            gesture.vy < -0.35 ? distance :
            gesture.vy > 0.35 ? 0 :
            nextOffset >= distance / 2 ? distance : 0;
          scrollY.value = withSpring(target, { damping: 16, stiffness: 140 });
          // Let the ScrollView's own native scroll animation carry the
          // content to the same resting offset, rather than trying to mirror
          // the spring frame-by-frame - both land on `target` at roughly the
          // same time, which reads as one unified motion.
          onScrollTo(target, true);
        },
        onPanResponderTerminate: () => {
          const distance = Math.max(collapseDistance.value, 1);
          const current = Math.max(0, Math.min(distance, scrollY.value));
          // Same "always a full extreme" rule as release above - a
          // terminated gesture (another responder stole it mid-drag) isn't
          // a special case that gets to leave the header stuck partway.
          const target = current >= distance / 2 ? distance : 0;
          scrollY.value = withSpring(target, { damping: 16, stiffness: 140 });
          onScrollTo(target, true);
        },
      }),
    [scrollY, collapseDistance, onScrollTo],
  );

  return { panHandlers: panResponder.panHandlers };
}
