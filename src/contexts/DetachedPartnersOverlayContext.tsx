// src/contexts/DetachedPartnersOverlayContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import type PartnersMessagesPane from '@/components/partners/PartnersMessagesPane';
import type PartnerSheet from '@/components/partners/PartnerSheet';

/**
 * Bridges Partners' own chat/feed pane and settings sheet out of
 * PartnerLayout's own View (nested inside PartnersScreen, itself nested
 * inside MainTabs' Tab.Navigator, capped by App.tsx's zIndex:1 wrapper) to a
 * true top-level sibling in App.tsx — the same "detach the pixels, keep the
 * state where it already lives" shape as DetachedTabBarContext.tsx and
 * DetachedChatOverlayContext.tsx, and for the same underlying reason: RN's
 * zIndex only orders siblings within the same stacking context, so these
 * overlays' local zIndex (20, in partnersStyles.ts) could never out-paint
 * anything outside PartnerLayout's own box — not the tab bar (already
 * detached to its own zIndex:10 top-level sibling) and not the Golden
 * Section (a preceding top-level sibling with no zIndex of its own, at
 * App.tsx's very top).
 *
 * Only the two overlays Partners actually needs to fully cover the Golden
 * Section are bridged here: PartnersMessagesPane (the right-to-left
 * chat/feed pane — group chats, channel chats, the partner's own feed,
 * community feeds) and PartnerSheet (the bottom-to-top settings sheet).
 * PartnerPanels (the 30+ individual settings sub-panels opened from that
 * sheet) is deliberately left rendering exactly where it already does,
 * inline in PartnerLayout — it wasn't part of what was asked for, and
 * bridging it too would mean re-verifying zIndex/positioning for every one
 * of those panels' own local styling, a much larger surface than this pass
 * covers. See PartnerLayout.tsx for where it still renders.
 *
 * All the real state (messagesOffsetAnim, sheetOffsetAnim, isMessagesExpanded,
 * isPartnerSheetOpen, the pan handlers, etc.) stays exactly where it already
 * lives, in PartnersScreen.tsx's hooks — only the rendered pixels move, via
 * the same two-piece shape as the other Detached*Context files: a Bridge
 * mounted where the state lives, an Outlet mounted where the pixels need to
 * actually paint.
 *
 * Props are captured as `React.ComponentProps<typeof X>` rather than
 * hand-duplicated field-by-field (unlike DetachedChatOverlayContext's own
 * flat prop list) because PartnersMessagesPane and PartnerSheet's prop
 * shapes are large and PartnerLayout already assembles them in full to hand
 * to those exact components today — deriving the bridge's type from the
 * components themselves means it can never drift out of sync with a prop
 * rename on either side.
 */
export type PartnersOverlayBridgeProps = {
  // Both bridged unconditionally, permanently - the same "always bridged,
  // never conditionally unbridged" shape as DetachedChatOverlayContext
  // (which forwards chatVisible: false just as readily as true, always to
  // the same Outlet). PartnersMessagesPane's "closed" state isn't actually
  // hidden - it's an intentional, always-visible peek sliver at the right
  // edge (RIGHT_PEEK_WIDTH) - so its own top/bottom insets (peekTopInset/
  // peekBottomInset props) do the work of staying clear of the Golden
  // Section and tab bar while closed, expanding to full coverage while
  // open. An earlier version of this file instead conditionally rendered
  // PartnersMessagesPane inline (while closed) vs. via this bridge (while
  // open) to solve the same visual problem - that broke the close
  // animation: the remount happens while the closing spring animation
  // (useNativeDriver: true) is still in flight, and destroying/recreating
  // the native view mid-animation desyncs it from messagesOffsetAnim,
  // leaving the pane visually stuck partway closed until the user manually
  // dragged it the rest of the way. A single, permanently-stable render
  // location avoids that entirely - see PartnerLayout.tsx for where
  // peekTopInset/peekBottomInset are computed.
  messagesPaneProps: React.ComponentProps<typeof PartnersMessagesPane>;
  // PartnerSheet's closed state genuinely is invisible regardless of render
  // location (0 backdrop opacity + the sheet itself translated fully
  // off-screen — see PartnerSheet.tsx), so it never needed insets at all.
  partnerSheetProps: React.ComponentProps<typeof PartnerSheet>;
};

const DetachedPartnersOverlayContext = createContext<{
  props: PartnersOverlayBridgeProps | null;
  setProps: (p: PartnersOverlayBridgeProps | null) => void;
}>({
  props: null,
  setProps: () => {},
});

export function DetachedPartnersOverlayProvider({ children }: { children: React.ReactNode }) {
  const [props, setProps] = useState<PartnersOverlayBridgeProps | null>(null);
  return (
    <DetachedPartnersOverlayContext.Provider value={{ props, setProps }}>
      {children}
    </DetachedPartnersOverlayContext.Provider>
  );
}

/**
 * Mounted inside PartnerLayout in place of rendering PartnersMessagesPane/
 * PartnerSheet directly — forwards everything up to the provider instead of
 * painting them in place. Re-syncs on every render (props is a fresh object
 * each time from PartnerLayout, same as DetachedChatOverlayBridge's own
 * props) and clears on unmount so a stale overlay can never linger after
 * PartnerLayout itself goes away (e.g. the user leaves the Partners tab's
 * mounted screen entirely).
 */
export function DetachedPartnersOverlayBridge(props: PartnersOverlayBridgeProps) {
  const { setProps } = useContext(DetachedPartnersOverlayContext);
  useEffect(() => {
    setProps(props);
    return () => setProps(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props]);
  return null;
}

/** Read out wherever the real overlays should actually render. */
export function useDetachedPartnersOverlayProps() {
  return useContext(DetachedPartnersOverlayContext).props;
}
