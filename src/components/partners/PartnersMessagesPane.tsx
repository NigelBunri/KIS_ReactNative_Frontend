// src/screens/tabs/PartnersMessagesPane.tsx
import React, { useMemo } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import styles from './partnersStyles';
import { useKISTheme } from '../../theme/useTheme';
import { Partner, PartnerChannel, PartnerCommunity, PartnerGroup } from './partnersTypes';
import ChatRoomPage from '@/Module/ChatRoom/ChatRoomPage';
import PartnerFeedScreen from '@/components/feeds/PartnerFeedScreen';
import CommunityFeedScreen from '@/components/feeds/CommunityFeedScreen';
import { KISIcon } from '@/constants/kisIcons';

type Props = {
  width: number;
  messagesOffsetAnim: Animated.Value;
  isMessagesExpanded: boolean;
  toggleMessagesPane: () => void;
  closeMessagesPane: () => void;
  selectedGroupId: string | null;
  selectedChannelId: string | null;
  selectedFeed: 'general' | null;
  groupsForPartner: PartnerGroup[];
  channelsForPartner: PartnerChannel[];
  selectedCommunityFeedId: string | null;
  communitiesForPartner: PartnerCommunity[];
  selectedPartner?: Partner;
  onOpenInfo?: (payload: { chat: any; currentUserId: string | null }) => void;
};

export default function PartnersMessagesPane({
  width,
  messagesOffsetAnim,
  isMessagesExpanded, // kept for future, even if not used directly now
  toggleMessagesPane,
  closeMessagesPane,
  selectedGroupId,
  selectedChannelId,
  selectedFeed,
  groupsForPartner,
  channelsForPartner,
  selectedCommunityFeedId,
  communitiesForPartner,
  selectedPartner,
  onOpenInfo,
}: Props) {
  const { palette } = useKISTheme();

  const selectedGroup = useMemo(
    () =>
      selectedGroupId
        ? groupsForPartner.find((g) => g.id === selectedGroupId) || null
        : null,
    [selectedGroupId, groupsForPartner],
  );

  const selectedChannel = useMemo(
    () =>
      selectedChannelId
        ? channelsForPartner.find((c) => c.id === selectedChannelId) || null
        : null,
    [selectedChannelId, channelsForPartner],
  );

  const selectedCommunity = useMemo(
    () =>
      selectedCommunityFeedId
        ? communitiesForPartner.find((c) => c.id === selectedCommunityFeedId) || null
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
    selectedFeed ||
      selectedCommunity ||
      selectedGroupId ||
      selectedChannelId,
  );

  return (
    <Animated.View
      style={[
        styles.messagesPane,
        {
          width,
          backgroundColor: palette.chatBg,
          borderLeftColor: palette.divider,
          transform: [{ translateX: messagesOffsetAnim }],
        },
      ]}
    >
      {!hasDestination ? (
        <View style={[styles.messagesHeader, { borderBottomColor: palette.divider }]}>
          <Pressable
            onPress={() =>
              isMessagesExpanded ? closeMessagesPane() : toggleMessagesPane()
            }
            style={({ pressed }) => [
              styles.toggleButton,
              { backgroundColor: palette.surface, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <KISIcon
              name="arrow-left"
              size={18}
              color={palette.text}
              style={isMessagesExpanded ? { transform: [{ rotate: '180deg' }] } : undefined}
            />
          </Pressable>
          <View style={styles.messagesTitleWrap}>
            <Text style={[styles.messagesTitle, { color: palette.text }]}>
              Messages
            </Text>
            <Text style={[styles.messagesSubtitle, { color: palette.subtext }]}>
              Tap the arrow to toggle
            </Text>
          </View>
        </View>
      ) : null}
      {selectedFeed && selectedPartner ? (
        <PartnerFeedScreen partner={selectedPartner} onBack={closeMessagesPane} />
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
        />
      ) : selectedGroupId && chatForGroup ? (
        <ChatRoomPage
          chat={chatForGroup}
          onBack={closeMessagesPane}
          allChats={[]}
          onOpenInfo={onOpenInfo}
        />
      ) : (
        <View style={[styles.messagesBody, { paddingHorizontal: 10 }]}>
          <Text
            style={[
              styles.messagesPlaceholderTitle,
              { color: palette.text },
            ]}
          >
            No destination selected
          </Text>
          <Text
            style={[
              styles.messagesPlaceholderText,
              { color: palette.subtext },
            ]}
          >
            Choose the partner feed, a group, or a channel to open it here.
          </Text>
        </View>
      )}
    </Animated.View>
  );
}
