// src/contexts/DetachedChatOverlayContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Animated as RNAnimatedNamespace } from 'react-native';
import type { Chat } from '@/Module/ChatRoom/messagesUtils';

/**
 * Bridges the chat-room / sub-room / chat-info / community-room / community-
 * info overlays' render props out of MainTabs' own View (nested inside
 * NavigationContainer, itself capped at App.tsx's zIndex:1 wrapper - see
 * AppNavigator.tsx) to a true top-level sibling in App.tsx - the same
 * "detach the pixels, keep the state where it already lives" shape as
 * DetachedTabBarContext.tsx, and for the same underlying reason: RN's
 * zIndex only orders siblings within the same stacking context, so these
 * overlays' local zIndex (1000-1003) could never out-paint anything outside
 * MainTabs' own box - not the tab bar (already detached to its own
 * zIndex:10 top-level sibling) and not the Golden Section (a preceding
 * top-level sibling with no zIndex of its own, at App.tsx's very top).
 *
 * This used to be "fixed" by force-hiding the tab bar (hidNav) and the
 * Golden Section (useGoldenSectionSuppression) whenever a chat overlay
 * opened, so MainTabs' own box could expand to fill the freed space -
 * correct in spirit but the wrong tool: it meant three separate things
 * animating in response to one user action (chat opens -> tab bar hides ->
 * Golden Section hides -> chat slides in) instead of the one thing actually
 * changing (the chat overlay) simply painting over the two that don't need
 * to move at all. Detaching the overlay's render location up to the true
 * top level - same as the tab bar already is - lets it genuinely cover both
 * without either of them reacting to it, and removes two extra animations
 * for every chat open/close.
 *
 * All the real state (chatHistory, openChat/closeChat, the Animated.Value
 * slide progress values, etc.) stays exactly where it already lives, in
 * AppNavigator.tsx's MainTabs - only the rendered pixels move, via the same
 * two-piece shape as DetachedTabBarContext.tsx: a Bridge mounted where the
 * state lives, an Outlet mounted where the pixels need to actually paint.
 */
export type ChatOverlayBridgeProps = {
  chatVisible: boolean;
  chatSlide: RNAnimatedNamespace.Value;
  activeChat: Chat | null;
  subRoomVisible: boolean;
  subRoomSlide: RNAnimatedNamespace.Value;
  activeSubRoom: Chat | null;
  infoVisible: boolean;
  infoSlide: RNAnimatedNamespace.Value;
  activeInfo: { chat: Chat; currentUserId: string | null } | null;
  communityVisible: boolean;
  communitySlide: RNAnimatedNamespace.Value;
  activeCommunity: { id: string; name: string } | null;
  communityInfoVisible: boolean;
  communityInfoSlide: RNAnimatedNamespace.Value;
  activeCommunityInfo: { id: string; name: string } | null;
  currentUserId: string | null;
  openChat: (chat: Chat) => void;
  openInfo: (payload: { chat: Chat | null; currentUserId: string | null }) => void;
  openCommunityInfo: (payload: { id: string; name: string }) => void;
  closeChat: () => void;
  closeInfo: () => void;
  closeCommunity: () => void;
  closeCommunityInfo: () => void;
  /** Replaces the inline onChatUpdated handler ChatInfoPage used to call
   * directly - it touched two of MainTabs' own state setters (chatHistory,
   * activeInfo), which can't cross the context boundary as raw setters
   * without exposing more of MainTabs' internals than this bridge should.
   * MainTabs defines this as one function closing over both setters. */
  onChatInfoUpdated: (updated: Chat) => void;
};

const DetachedChatOverlayContext = createContext<{
  props: ChatOverlayBridgeProps | null;
  setProps: (p: ChatOverlayBridgeProps | null) => void;
}>({
  props: null,
  setProps: () => {},
});

export function DetachedChatOverlayProvider({ children }: { children: React.ReactNode }) {
  const [props, setProps] = useState<ChatOverlayBridgeProps | null>(null);
  return (
    <DetachedChatOverlayContext.Provider value={{ props, setProps }}>
      {children}
    </DetachedChatOverlayContext.Provider>
  );
}

/**
 * Mounted inside MainTabs in place of rendering the overlays directly -
 * forwards everything up to the provider instead of painting them in
 * place. Re-syncs on every render (props is a fresh object each time from
 * MainTabs, same as DetachedTabBarBridge's own props) and clears on unmount
 * so a stale overlay can never linger after MainTabs itself goes away.
 */
export function DetachedChatOverlayBridge(props: ChatOverlayBridgeProps) {
  const { setProps } = useContext(DetachedChatOverlayContext);
  useEffect(() => {
    setProps(props);
    return () => setProps(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props]);
  return null;
}

/** Read out wherever the real overlays should actually render. */
export function useDetachedChatOverlayProps() {
  return useContext(DetachedChatOverlayContext).props;
}
