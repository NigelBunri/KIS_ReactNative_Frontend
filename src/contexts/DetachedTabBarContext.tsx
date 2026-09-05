// src/contexts/DetachedTabBarContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AnimatedKISTabBarProps } from '@/navigation/AppNavigator';

/**
 * Bridges the bottom tab bar's render props out of wherever React Navigation
 * mounts them (deep inside MainTabs' own Tab.Navigator, itself nested inside
 * the NavigationContainer box that sits below the Golden Section) to wherever
 * the actual visible tab bar needs to render instead: a sibling of the Golden
 * Section's entire content column, in App.tsx.
 *
 * Why this exists: AnimatedKISTabBar pins itself via position:absolute,
 * bottom:0 — but that only decouples it from its own parent's layout *flow*,
 * not from that parent's *size*. Its nearest View ancestor used to be a box
 * that's a flex sibling of the Golden Section, so whenever the Golden
 * Section's live, per-screen height changed, that box's own height changed
 * with it, and the tab bar's bottom:0 anchor moved right along — the root
 * cause of the "bottom nav moves during load / on every tab switch" bug (see
 * useCollapsingGoldHeader.ts and ProfileDashboardBlocks.tsx for the
 * height-measurement side of that same investigation). Debouncing and
 * easing the height commit there made each correction less jarring, but
 * couldn't fix this part: the coupling was structural, not timing.
 *
 * The real fix is to give the tab bar a different nearest View ancestor —
 * one the Golden Section can never resize. App.tsx now renders the actual
 * AnimatedKISTabBar as a sibling *after* the Golden Section's whole content
 * column (not nested inside it), so its bottom:0 resolves against the
 * outer, Golden-Section-independent container instead: in a flex column,
 * a flex:1 sibling (the content column) always absorbs however much the
 * Golden Section's variable height claims, which means the *next* sibling
 * after it always starts at exactly (container height − its own fixed
 * height), regardless of what the Golden Section is doing.
 *
 * React Navigation still needs something mounted in its own `tabBar` render
 * slot — that's where `state`/`descriptors`/`navigation` naturally come
 * from. `DetachedTabBarBridge` is exactly that: it mounts in the normal
 * `tabBar` slot and forwards its props here instead of painting them in
 * place; `useDetachedTabBarProps` reads them back out at the real render
 * site. This is the standard, documented shape of "a custom tab bar that
 * doesn't render where it's declared" — the `tabBar` prop is designed to
 * accept any component, and nothing about it requires that component to
 * paint its own pixels where React Navigation mounts it.
 */
const DetachedTabBarContext = createContext<{
  props: AnimatedKISTabBarProps | null;
  setProps: (p: AnimatedKISTabBarProps | null) => void;
}>({
  props: null,
  setProps: () => {},
});

export function DetachedTabBarProvider({ children }: { children: React.ReactNode }) {
  const [props, setProps] = useState<AnimatedKISTabBarProps | null>(null);
  return (
    <DetachedTabBarContext.Provider value={{ props, setProps }}>
      {children}
    </DetachedTabBarContext.Provider>
  );
}

/**
 * Mounted in React Navigation's own `tabBar` render slot in place of the
 * real bar — forwards whatever it's given up to the provider above instead
 * of rendering it, and clears on unmount so a stale bar can never linger
 * after MainTabs itself goes away (e.g. sign-out). Only one of these is
 * ever mounted at a time (MainTabs owns a single Tab.Navigator), so unlike
 * GoldenSectionContext's multi-owner registration there's no race to guard
 * against here — an unconditional clear on unmount is enough.
 */
export function DetachedTabBarBridge(props: AnimatedKISTabBarProps) {
  const { setProps } = useContext(DetachedTabBarContext);
  useEffect(() => {
    setProps(props);
    return () => setProps(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props]);
  return null;
}

/** Read out wherever the real AnimatedKISTabBar should actually render. */
export function useDetachedTabBarProps() {
  return useContext(DetachedTabBarContext).props;
}
