// src/screens/tabs/PartnersMessagesPane.tsx
import React, { useMemo } from 'react';
import { Animated, Text, View } from 'react-native';
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

type Props = {
  width: number;
  messagesOffsetAnim: Animated.Value;
  isMessagesExpanded: boolean;
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
  /** How far below the true screen top / above the true screen bottom this
   * pane's always-visible "closed" peek sliver must stay, now that it
   * renders as a top-level sibling that can otherwise reach the Golden
   * Section and tab bar (see DetachedPartnersOverlayContext.tsx). Ignored
   * while isMessagesExpanded - the whole point of opening is to cover both. */
  peekTopInset?: number;
  peekBottomInset?: number;
};

export default function PartnersMessagesPane({
  width,
  messagesOffsetAnim,
  isMessagesExpanded,
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
  peekTopInset = 0,
  peekBottomInset = 0,
}: Props) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
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
          // Full coverage while open (overrides styles.messagesPane's own
          // top:0/bottom:0 with the same values - explicit here so the
          // intent reads clearly next to the peeked case below); confined
          // to stay clear of the Golden Section + tab bar while the pane is
          // just its normal always-visible peek sliver. See peekTopInset/
          // peekBottomInset's own doc comment on this component's Props.
          top: isMessagesExpanded ? 0 : peekTopInset,
          bottom: isMessagesExpanded ? 0 : peekBottomInset,
        },
      ]}
      {...messagePanHandlers}
    >
      {!hasDestination ? (
        <View style={[styles.messagesBody, { paddingHorizontal: responsive.pageGutter }]}>
          <Text
            style={[styles.messagesPlaceholderTitle, { color: palette.text }]}
          >
            No destination selected
          </Text>
          <Text
            style={[styles.messagesPlaceholderText, { color: palette.subtext }]}
          >
            Choose the partner feed, a group, or a channel to open it here.
          </Text>
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
