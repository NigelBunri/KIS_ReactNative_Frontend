// src/screens/tabs/PartnersMessagesPane.tsx
import React, { useMemo } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import styles from './partnersStyles';
import { useKISTheme } from '../../theme/useTheme';
import {
  Partner,
  PartnerChannel,
  PartnerCommunity,
  PartnerGroup,
} from './partnersTypes';
import ChatRoomPage from '@/Module/ChatRoom/ChatRoomPage';
import PartnerFeedScreen from '@/components/feeds/PartnerFeedScreen';
import CommunityFeedScreen from '@/components/feeds/CommunityFeedScreen';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  width: number;
  messagesOffsetAnim: Animated.Value;
  /** True while open OR while a drag gesture is actively dragging it open/
   * closed — see useMessagesPane.ts's isDragging doc comment. Used instead
   * of the settled isMessagesExpanded state so the pane is elevated above
   * the Golden Section/tab bar for the whole opening drag, not just once
   * fully open. */
  isMessagesPaneOnTop: boolean;
  toggleMessagesPane: () => void;
  closeMessagesPane: () => void;
  messagePanHandlers?: Record<string, any>;
  selectedGroupId: string | null;
  selectedChannelId: string | null;
  selectedFeed: 'general' | null;
  groupsForPartner: PartnerGroup[];
  channelsForPartner: PartnerChannel[];
  selectedCommunityFeedId: string | null;
  communitiesForPartner: PartnerCommunity[];
  selectedPartner?: Partner;
  onOpenInfo?: (payload: { chat: any; currentUserId: string | null }) => void;
  onOpenTasks?: () => void;
};

export default function PartnersMessagesPane({
  width,
  messagesOffsetAnim,
  isMessagesPaneOnTop,
  toggleMessagesPane: _toggleMessagesPane,
  closeMessagesPane,
  messagePanHandlers,
  selectedGroupId,
  selectedChannelId,
  selectedFeed,
  groupsForPartner,
  channelsForPartner,
  selectedCommunityFeedId,
  communitiesForPartner,
  selectedPartner,
  onOpenInfo,
  onOpenTasks,
}: Props) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const safeAreaInsets = useSafeAreaInsets();
  const paneWidth = Math.min(width, responsive.isTablet ? Math.max(520, Math.round(width * 0.62)) : width);

  const selectedGroup = useMemo(
    () =>
      selectedGroupId
        ? groupsForPartner.find(g => g.id === selectedGroupId) || null
        : null,
    [selectedGroupId, groupsForPartner],
  );

  const selectedChannel = useMemo(
    () =>
      selectedChannelId
        ? channelsForPartner.find(c => c.id === selectedChannelId) || null
        : null,
    [selectedChannelId, channelsForPartner],
  );

  const selectedCommunity = useMemo(
    () =>
      selectedCommunityFeedId
        ? communitiesForPartner.find(c => c.id === selectedCommunityFeedId) ||
          null
        : null,
    [selectedCommunityFeedId, communitiesForPartner],
  );

  // ✅ Build a minimal "chat" object for ChatRoomPage
  const chatForGroup = useMemo(() => {
    if (!selectedGroup?.conversation_id) return null;
    return {
      id: selectedGroup.conversation_id,
      conversationId: selectedGroup.conversation_id,
      title: selectedGroup.name,
      name: selectedGroup.name,
      partnerId: selectedPartner?.id,
      partnerName: selectedPartner?.name,
    } as any;
  }, [selectedGroup, selectedPartner]);

  const chatForChannel = useMemo(() => {
    if (!selectedChannel?.conversation_id) return null;
    return {
      id: selectedChannel.conversation_id,
      conversationId: selectedChannel.conversation_id,
      title: selectedChannel.name,
      name: selectedChannel.name,
      partnerId: selectedPartner?.id,
      partnerName: selectedPartner?.name,
    } as any;
  }, [selectedChannel, selectedPartner]);

  const hasDestination = Boolean(
    selectedFeed || selectedCommunity || selectedGroupId || selectedChannelId,
  );

  return (
    <Animated.View
      style={[
        styles.messagesPane,
        {
          width: paneWidth,
          backgroundColor: palette.chatBg,
          borderLeftColor: palette.divider,
          transform: [{ translateX: messagesOffsetAnim }],
          // Always full height (top:0/bottom:0), identical in both states —
          // the closed "peek sliver" and the fully-open pane are the exact
          // same box; only the horizontal translateX and the zIndex below
          // change between them. While closed, dropping below the Golden
          // Section's and tab bar's own stacking means those two opaque
          // layers naturally paint over the sliver's top/bottom ends, which
          // is what keeps it looking like a confined sliver rather than a
          // full-height strip - no separate inset math needed to track
          // either one's (live, Reanimated-driven) height. While open (or
          // mid-drag toward open — isMessagesPaneOnTop, not isMessagesExpanded
          // alone), this rises back above both so the pane can cover them.
          // Using isMessagesExpanded here instead would keep the pane
          // beneath the Golden Section/tab bar for the ENTIRE opening drag
          // (isMessagesExpanded only flips at the end, on release), so the
          // user's finger would visibly slide the pane while it stayed
          // invisibly tucked behind those two layers, then have it "pop"
          // into view all at once on release - correct on close (where
          // being covered by them throughout the drag is exactly the
          // desired look) but wrong on open.
          zIndex: isMessagesPaneOnTop ? 20 : -1,
        },
      ]}
      {...messagePanHandlers}
    >
      {!hasDestination ? (
        <View style={{ flex: 1 }}>
          {/* Same closeMessagesPane the drag gesture and every other
              destination's header use (see the onBack props below) — one
              shared animated-close path, so the button and the drag-close
              animation always end up in sync instead of two separate ways
              to "be closed" that could disagree. */}
          <Pressable
            onPress={closeMessagesPane}
            hitSlop={12}
            style={{
              position: 'absolute',
              top: safeAreaInsets.top + 12,
              right: 16,
              zIndex: 1,
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: palette.chrome,
            }}
          >
            <KISIcon name="close" size={20} color={palette.subtext} />
          </Pressable>
          <View
            style={[
              styles.messagesBody,
              {
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: responsive.pageGutter,
              },
            ]}
          >
            <Text
              style={[
                styles.messagesPlaceholderTitle,
                { color: palette.text, textAlign: 'center' },
              ]}
            >
              No destination selected
            </Text>
            <Text
              style={[
                styles.messagesPlaceholderText,
                { color: palette.subtext, textAlign: 'center' },
              ]}
            >
              Choose the partner feed, a group, or a channel to open it here.
            </Text>
          </View>
        </View>
      ) : null}
      {selectedFeed && selectedPartner ? (
        <PartnerFeedScreen
          partner={selectedPartner}
          onBack={closeMessagesPane}
        />
      ) : selectedCommunity ? (
        <CommunityFeedScreen
          community={{ id: selectedCommunity.id, name: selectedCommunity.name }}
          onBack={closeMessagesPane}
        />
      ) : selectedChannelId && chatForChannel ? (
        <ChatRoomPage
          chat={chatForChannel}
          onBack={closeMessagesPane}
          allChats={[]}
          onOpenInfo={onOpenInfo}
          onOpenTasks={onOpenTasks}
        />
      ) : selectedGroupId && chatForGroup ? (
        <ChatRoomPage
          chat={chatForGroup}
          onBack={closeMessagesPane}
          allChats={[]}
          onOpenInfo={onOpenInfo}
        />
      ) : null}
    </Animated.View>
  );
}
