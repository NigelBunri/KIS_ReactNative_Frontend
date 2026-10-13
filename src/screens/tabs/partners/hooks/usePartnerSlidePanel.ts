import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';

/**
 * Shared slide-panel open/close/animate boilerplate used by the large family
 * of `usePartnerXXXPanel` / `useAdminXXXPanel` hooks under
 * `src/screens/tabs/partners/`.
 *
 * This hook captures the behavior that was byte-for-byte identical across
 * ~36 of those hooks:
 *   - a `panelWidth` derived from the viewport `width` (full width below the
 *     600px breakpoint, otherwise clamped between 520 and 760 at 72% of the
 *     viewport width)
 *   - an `Animated.Value` (`panelTranslateX`) driving a slide-in-from-the-right
 *     transform
 *   - an `isOpen` boolean
 *   - `open()` / `close()` that animate the panel in (260ms) / out (220ms)
 *   - a reset effect that snaps `panelTranslateX` back to `panelWidth`
 *     whenever the panel is closed (so a width change while closed doesn't
 *     leave the animated value stale)
 *
 * Hooks that differ from this shape in any meaningful way (extra state,
 * different width formula, no reset effect, non-boolean "open" state, etc.)
 * are intentionally NOT built on top of this hook — see the P2-1 refactor
 * notes for the list of hooks that were left alone.
 */
export const usePartnerSlidePanel = (width: number) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelWidth = useMemo(() => {
    if (width < 600) return width;
    return Math.min(760, Math.max(520, Math.round(width * 0.72)));
  }, [width]);
  const panelTranslateX = useRef(new Animated.Value(panelWidth)).current;

  useEffect(() => {
    if (!isOpen) {
      panelTranslateX.setValue(panelWidth);
    }
  }, [panelWidth, isOpen, panelTranslateX]);

  const open = () => {
    setIsOpen(true);
    requestAnimationFrame(() => {
      panelTranslateX.setValue(panelWidth);
      Animated.timing(panelTranslateX, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
    });
  };

  const close = () => {
    Animated.timing(panelTranslateX, {
      toValue: panelWidth,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setIsOpen(false);
    });
  };

  return {
    panelWidth,
    panelTranslateX,
    isOpen,
    open,
    close,
  };
};
