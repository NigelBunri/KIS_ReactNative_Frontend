// src/contexts/SearchOverlayContext.tsx
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Global search used to be a RootStack screen (`navigation.navigate('GlobalSearch')`,
 * `presentation: 'modal'`). RootStack sits above MainTabs, so pushing onto it
 * blurs whatever main-tab screen was focused underneath (Broadcast, etc.) —
 * and every Golden Section screen registers its header content only while
 * focused (see GoldenSectionContext's useGoldenSectionContent), so that blur
 * cleared the registration. The Golden Section vanished the instant search
 * opened, then snapped back in on close - the "moving/shifting" this exists
 * to fix.
 *
 * Same shape as DetachedChatOverlayContext/DetachedPartnersOverlayContext:
 * render the overlay as a true top-level sibling in App.tsx instead, so it
 * simply paints over the Golden Section (and everything else) without any
 * navigation occurring underneath it - nothing blurs, nothing re-registers,
 * nothing shifts. Simpler than those two contexts since search has no state
 * living deep inside a specific screen to bridge out; visibility alone is
 * enough for the App.tsx-hosted outlet to know what to render.
 */
type SearchOverlayContextValue = {
  visible: boolean;
  open: () => void;
  close: () => void;
};

const SearchOverlayContext = createContext<SearchOverlayContextValue>({
  visible: false,
  open: () => {},
  close: () => {},
});

export function SearchOverlayProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  const value = useMemo(() => ({ visible, open, close }), [visible, open, close]);
  return (
    <SearchOverlayContext.Provider value={value}>
      {children}
    </SearchOverlayContext.Provider>
  );
}

/** Any screen calls this instead of navigating to open/close global search. */
export function useSearchOverlay() {
  return useContext(SearchOverlayContext);
}
