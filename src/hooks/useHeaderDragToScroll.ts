// src/hooks/useHeaderDragToScroll.ts
import { useMemo, useRef } from 'react';
import { PanResponder } from 'react-native';
import { withSpring, type SharedValue } from 'react-native-reanimated';

/** Common imperative handle shape for content views a header-drag dispatcher
 * scrolls — implemented by plain ScrollView refs (native `scrollTo` already
 * matches this shape) and by forwardRef'd FlatList/SectionList wrappers
 * (e.g. via `getScrollResponder()?.scrollTo(...)`). */
export type ScrollableHandle = {
  scrollTo: (opts: { y: number; animated?: boolean }) => void;
};

/**
 * Lets a screen's gold header be dragged directly (not just scrolled via its
 * content list) to collapse/expand, while keeping the underlying content in
 * lockstep — the header commonly lives outside the screen's own content tree
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
          // Move the real content scroll 1:1 with the finger, immediately —
          // this is what makes dragging the header feel like dragging the
          // page itself, instead of only collapsing the header in place.
          onScrollTo(nextOffset, false);
        },
        onPanResponderRelease: (_, gesture) => {
          const distance = Math.max(collapseDistance.value, 1);
          const nextOffset = Math.max(0, Math.min(distance, gestureStartOffsetRef.current - gesture.dy));
          const shouldCollapse = gesture.vy < -0.35 || nextOffset > distance * 0.45;
          const shouldExpand = gesture.vy > 0.35 || nextOffset < distance * 0.18;
          const target = shouldExpand ? 0 : shouldCollapse ? distance : nextOffset;
          scrollY.value = withSpring(target, { damping: 16, stiffness: 140 });
          // Let the ScrollView's own native scroll animation carry the
          // content to the same resting offset, rather than trying to mirror
          // the spring frame-by-frame — both land on `target` at roughly the
          // same time, which reads as one unified motion.
          onScrollTo(target, true);
        },
        onPanResponderTerminate: () => {
          const distance = Math.max(collapseDistance.value, 1);
          const target = Math.max(0, Math.min(distance, scrollY.value));
          scrollY.value = withSpring(target, { damping: 16, stiffness: 140 });
          onScrollTo(target, true);
        },
      }),
    [scrollY, collapseDistance, onScrollTo],
  );

  return { panHandlers: panResponder.panHandlers };
}
