// src/contexts/GoldenSectionContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

export type GoldenSectionPayload = {
  content: React.ReactNode;
  /** Gradient override; defaults to KIS_ROYAL_GRADIENTS.goldHeader inside GoldHeaderShell. */
  colors?: readonly string[];
  /** Merged onto the shared GoldHeaderShell (radius/shadow tweaks per page). */
  shellStyle?: StyleProp<ViewStyle>;
};

// A unique token per registering screen instance. Lets a blurring screen's
// cleanup check "is this still my content?" before clearing — without it, a
// blur-cleanup that fires after the next screen's focus-registration would
// wipe out the new screen's just-registered content (a race during tab
// switches that made the Golden Section, and anything below it, flicker).
type Owner = symbol;

type GoldenSectionSetters = {
  setGoldenSection: (owner: Owner, payload: GoldenSectionPayload) => void;
  clearGoldenSection: (owner: Owner) => void;
  setSuppressed: (owner: Owner, active: boolean) => void;
};

// Split into two contexts so screens registering content (which only need
// the setters) never re-render when the *payload* changes. Bundling both
// into one context/value previously meant every screen calling
// useGoldenSectionContent re-rendered whenever any screen (including itself)
// updated the payload — which rebuilt its JSX, which looked like a changed
// dependency, which re-fired the registration effect, forever (an infinite
// render loop that crashed on the heavier Partners screen and caused visible
// nav-bar churn elsewhere). Setters below are referentially stable forever;
// only the App.tsx-hosted shell subscribes to the payload/suppression state.
const GoldenSectionSettersContext = createContext<GoldenSectionSetters>({
  setGoldenSection: () => {},
  clearGoldenSection: () => {},
  setSuppressed: () => {},
});

const GoldenSectionPayloadContext = createContext<GoldenSectionPayload | null>(null);
const GoldenSectionSuppressedContext = createContext(false);

export function GoldenSectionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ owner: Owner; payload: GoldenSectionPayload } | null>(null);
  // Full-screen overlays that live above a whole tab navigator (e.g. the
  // chat-room/community-room overlays in AppNavigator's MainTabs) aren't
  // "screens" that register their own gold content — they need to force the
  // Golden Section to hide regardless of which tab is focused, since those
  // overlays are position:absolute within MainTabs' own box, below the
  // Golden Section, and can't otherwise cover it. A ref-counted set (rather
  // than a plain boolean) lets more than one such overlay be active without
  // one's cleanup incorrectly un-suppressing for the other.
  const [suppressors, setSuppressors] = useState<Set<Owner>>(() => new Set());

  const setGoldenSection = useCallback((owner: Owner, payload: GoldenSectionPayload) => {
    setState({ owner, payload });
  }, []);

  const clearGoldenSection = useCallback((owner: Owner) => {
    setState((prev) => (prev && prev.owner === owner ? null : prev));
  }, []);

  const setSuppressed = useCallback((owner: Owner, active: boolean) => {
    setSuppressors((prev) => {
      const has = prev.has(owner);
      if (active === has) return prev;
      const next = new Set(prev);
      if (active) next.add(owner);
      else next.delete(owner);
      return next;
    });
  }, []);

  const setters = useMemo(
    () => ({ setGoldenSection, clearGoldenSection, setSuppressed }),
    [setGoldenSection, clearGoldenSection, setSuppressed],
  );

  return (
    <GoldenSectionSettersContext.Provider value={setters}>
      <GoldenSectionPayloadContext.Provider value={state?.payload ?? null}>
        <GoldenSectionSuppressedContext.Provider value={suppressors.size > 0}>
          {children}
        </GoldenSectionSuppressedContext.Provider>
      </GoldenSectionPayloadContext.Provider>
    </GoldenSectionSettersContext.Provider>
  );
}

/** Raw payload/suppression access — used by the App.tsx-hosted GoldenSection shell. */
export function useGoldenSection() {
  const payload = useContext(GoldenSectionPayloadContext);
  const suppressed = useContext(GoldenSectionSuppressedContext);
  return { payload: suppressed ? null : payload };
}

/**
 * Screen-facing hook. Registers `payload` as the active Golden Section
 * content while this screen is focused, and clears it on blur/unmount —
 * single-slot handoff (only one main tab is ever focused at a time), mirrored
 * after the push/pop-on-focus idiom in useStatusBarStyle.
 *
 * `payload.content` is expected to be a fresh element each render, so this
 * re-registers live while focused (search text, menu state, etc. stay in
 * sync) without affecting animation frame rate — Animated.Value/Reanimated
 * shared values driving that JSX are mutated imperatively, not through
 * React re-renders. Subscribing only to the (stable) setters context above
 * means this never causes the calling screen itself to re-render.
 */
export function useGoldenSectionContent(payload: GoldenSectionPayload | null) {
  const { setGoldenSection, clearGoldenSection } = useContext(GoldenSectionSettersContext);
  const isFocused = useIsFocused();
  const ownerRef = useRef<Owner | null>(null);
  if (ownerRef.current === null) ownerRef.current = Symbol('goldenSectionOwner');

  useEffect(() => {
    if (!isFocused || !payload) return;
    const owner = ownerRef.current!;
    setGoldenSection(owner, payload);
    return () => clearGoldenSection(owner);
  }, [isFocused, payload, setGoldenSection, clearGoldenSection]);
}

/**
 * Force-hides the Golden Section while `active` is true, regardless of which
 * tab is focused or what it has registered. For full-screen overlays that
 * live above an entire tab navigator rather than inside a single screen
 * (e.g. AppNavigator's MainTabs chat-room/community-room overlays) — those
 * are position:absolute within the navigator's own box, below the Golden
 * Section, so they can't cover it themselves; hiding the Golden Section
 * instead lets the navigator's box expand to fill that space.
 */
export function useGoldenSectionSuppression(active: boolean) {
  const { setSuppressed } = useContext(GoldenSectionSettersContext);
  const ownerRef = useRef<Owner | null>(null);
  if (ownerRef.current === null) ownerRef.current = Symbol('goldenSectionSuppressor');

  useEffect(() => {
    const owner = ownerRef.current!;
    setSuppressed(owner, active);
    return () => setSuppressed(owner, false);
  }, [active, setSuppressed]);
}
