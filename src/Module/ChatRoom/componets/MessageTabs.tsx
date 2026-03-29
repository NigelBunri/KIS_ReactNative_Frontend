// src/screens/tabs/MessageTabs.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image,
} from 'react-native';

import { useKISTheme } from '@/theme/useTheme';
import { KIS_TOKENS } from '@/theme/constants';
import { KISIcon } from '@/constants/kisIcons';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';

import {
  styles,
  type Chat,
  type CustomFilter,
  type QuickChip,
  applyQuickChips,
  applyCustomRules,
  bySearch,
  directConversationAvatar,
  participantsToIds,
  normalizePhoneKey,
  otherParticipantPhone,
} from '../messagesUtils';
import { normalizeConversation } from '../normalizeConversation';
import { MessageStatus } from '../chatTypes';


type ChatsTabProps = {
  conversations: any[]; // raw backend conversations
  filters: CustomFilter[];
  activeQuick: Set<QuickChip>;
  activeCustomId?: string | null;
  search: string;
  typingByConversation?: Record<string, Record<string, number>>;
  presenceByUser?: Record<string, { isOnline: boolean; at: number }>;
  currentUserId?: string;
  conversationMeta?: Record<
    string,
    {
      lastMessage?: string;
      lastAt?: string;
      unreadCount?: number;
      lastStatus?: MessageStatus;
      lastMessageFromMe?: boolean;
    }
  >;
  contactNameByPhone?: Record<string, string>;
  communityByConversationId?: Record<string, { id: string; name: string }>;
  communityGroupConversationIds?: Set<string>;
  statusByUserId?: Record<string, { hasStatus: boolean; hasUnseen: boolean }>;
  onOpenStatus?: (userId: string) => void;
  onOpenAvatarPreview?: (payload: { avatarUrl: string; chat: Chat; userId?: string | null }) => void;

  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onEndReached?: () => void;
  onOpenChat?: (chat: Chat) => void;

  selectedChat?: Chat[];
  setSelectedChat?: (chats: Chat[]) => void;
};

export function ChatsTab({
  conversations = [],
  filters,
  activeQuick,
  activeCustomId,
  search,
  typingByConversation,
  presenceByUser,
  currentUserId,
  conversationMeta,
  contactNameByPhone,
  communityByConversationId,
  communityGroupConversationIds,
  statusByUserId,
  onOpenStatus,
  onOpenAvatarPreview,
  onScroll,
  onEndReached,
  onOpenChat,
  selectedChat = [],
  setSelectedChat,
}: ChatsTabProps) {
  const { palette } = useKISTheme();

  const getStatusSymbol = (status?: MessageStatus) => {
    if (!status) return '';
    if (status === 'local_only' || status === 'pending' || status === 'sending') return '⏳';
    if (status === 'sent') return '✓';
    if (status === 'delivered') return '✓✓';
    if (status === 'read') return '✓✓';
    if (status === 'failed') return '!';
    return '';
  };

  /* ------------------------------------------------------------
   * NORMALIZE RAW BACKEND CONVERSATIONS → SAFE Chat objects
   * ------------------------------------------------------------ */
  const normalizedChats: Chat[] = useMemo(() => {
    return conversations.map((c) => normalizeConversation(c, currentUserId));
  }, [conversations, currentUserId]);

  /* ------------------------------------------------------------
   * ACTIVE CUSTOM FILTER RULES
   * ------------------------------------------------------------ */
  const customRules = useMemo(
    () => filters.find((f) => f.id === activeCustomId)?.rules,
    [filters, activeCustomId]
  );

  const selectionMode = selectedChat.length > 0;

  /* ------------------------------------------------------------
   * FINAL FILTERED DATA
   * ------------------------------------------------------------ */
  const data = useMemo(() => {
    const chipsForApply = new Set(activeQuick);
    if (chipsForApply.has('Community')) chipsForApply.delete('Community');

    const filtered = normalizedChats.filter((c: Chat) => {
      if (c.kind === 'channel') return false;
      const convId = String((c as any).conversationId ?? c.id);
      if (c.isGroup && c.communityId) return false;
      if (communityGroupConversationIds?.has(convId)) return false;
      const isCommunityConv =
        c.isCommunityChat ||
        c.kind === 'community' ||
        Boolean(c.communityId) ||
        Boolean(communityByConversationId?.[convId]);
      if (activeQuick.has('Community') && !isCommunityConv) return false;
      return (
        applyQuickChips(c, chipsForApply) &&
        applyCustomRules(c, customRules) &&
        bySearch(c, search)
      );
    });

    const getLastAt = (item: Chat) => {
      const convId = String((item as any).conversationId ?? item.id);
      const meta = conversationMeta?.[convId];
      const metaAt = meta?.lastAt ?? '';
      const itemAt = item.lastAt ?? '';
      const metaTs = Date.parse(metaAt || '');
      const itemTs = Date.parse(itemAt || '');
      if (!Number.isNaN(metaTs) && (Number.isNaN(itemTs) || metaTs >= itemTs)) {
        return metaAt;
      }
      return itemAt;
    };

    return filtered.sort((a, b) => {
      const aAt = getLastAt(a);
      const bAt = getLastAt(b);
      const aTs = Date.parse(aAt || '');
      const bTs = Date.parse(bAt || '');
      if (!Number.isNaN(aTs) && !Number.isNaN(bTs)) return bTs - aTs;
      if (!Number.isNaN(aTs)) return -1;
      if (!Number.isNaN(bTs)) return 1;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [
    normalizedChats,
    activeQuick,
    customRules,
    search,
    conversationMeta,
    communityByConversationId,
    communityGroupConversationIds,
  ]);

  /* ------------------------------------------------------------
   * CHAT SELECTION HANDLING
   * ------------------------------------------------------------ */
  const toggleSelectChat = (chat: Chat) => {
    if (!setSelectedChat) return;

    const exists = selectedChat.some((c) => c.id === chat.id);
    if (exists) {
      setSelectedChat(selectedChat.filter((c) => c.id !== chat.id));
    } else {
      setSelectedChat([...selectedChat, chat]);
    }
  };

  /* ------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------ */
  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={data}
      keyExtractor={(i) => i.id}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.2}
      ListEmptyComponent={
        <View style={[styles.center, { paddingVertical: 60 }]}>
          <Text style={{ color: palette.subtext }}>
            No chats match your filters.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const isSelected = selectedChat.some((c) => c.id === item.id);
        const convId = String((item as any).conversationId ?? item.id);
        const meta = conversationMeta?.[convId];
        const metaAt = meta?.lastAt ?? '';
        const itemAt = item.lastAt ?? '';
        const metaTs = Date.parse(metaAt || '');
        const itemTs = Date.parse(itemAt || '');
        const useMeta =
          metaAt &&
          (!Number.isNaN(metaTs) &&
            (Number.isNaN(itemTs) || metaTs >= itemTs));
        const displayLastMessage = useMeta
          ? meta?.lastMessage ?? ''
          : item.lastMessage ?? '';
        const displayLastAt = useMeta ? metaAt : itemAt;
        const displayUnread = useMeta
          ? meta?.unreadCount ?? 0
          : item.unreadCount ?? 0;

        const handlePress = () => {
          const displayName = (() => {
            if (item.isDirect) {
              const phone = otherParticipantPhone(item.participants ?? [], currentUserId);
              const key = normalizePhoneKey(phone);
              if (key && contactNameByPhone?.[key]) return contactNameByPhone[key];
            }
            return item.name;
          })();

          if (selectionMode) {
            toggleSelectChat(item);
          } else {
            const convKey = String((item as any).conversationId ?? item.id);
            const community = communityByConversationId?.[convKey];
            const communityId =
              item.communityId ??
              community?.id ??
              (item.isCommunityChat ? item.id : undefined);
            const isCommunity =
              item.isCommunityChat ||
              item.kind === 'community' ||
              Boolean(communityId);
            if (community) {
              onOpenChat?.({
                ...item,
                name: community.name || displayName,
                isCommunityChat: true,
                communityId: community.id,
              });
              return;
            }
            if (isCommunity && communityId) {
              onOpenChat?.({
                ...item,
                name: (item.name || displayName) as string,
                isCommunityChat: true,
                communityId,
              });
              return;
            }
            onOpenChat?.({ ...item, name: displayName });
          }
        };

        const handleLongPress = () => {
          toggleSelectChat(item);
        };

        const avatarUrl = item.avatarUrl || (item.isDirect
          ? directConversationAvatar(item.participants ?? [], currentUserId)
          : null);

        const ids = participantsToIds(item.participants ?? []);
        const otherId = item.isDirect
          ? ids.find((u) => u && u !== currentUserId) ?? null
          : null;
        const statusInfo = otherId ? statusByUserId?.[otherId] : null;
        const hasStatus = Boolean(statusInfo?.hasStatus);
        const ringColor = hasStatus
          ? statusInfo?.hasUnseen
            ? palette.primaryStrong ?? palette.primary
            : palette.subtext ?? palette.divider
          : null;

        return (
          <Pressable
            onPress={handlePress}
            onLongPress={handleLongPress}
            style={[
              styles.row,
            {
              backgroundColor: isSelected
                  ? palette.primarySoft
                  : palette.card,
                borderColor: isSelected
                  ? palette.primaryStrong
                  : palette.inputBorder,
              },
              KIS_TOKENS.elevation.card,
            ]}
          >
            {/* AVATAR */}
            <Pressable
              onPress={() => {
                if (hasStatus && otherId) {
                  onOpenStatus?.(otherId);
                  return;
                }
                if (avatarUrl) {
                  onOpenAvatarPreview?.({
                    avatarUrl,
                    chat: item,
                    userId: otherId ?? null,
                  });
                }
              }}
              disabled={!hasStatus && !avatarUrl}
              style={{ position: 'relative' }}
            >
              <View
                style={{
                  borderWidth: ringColor ? 2 : 0,
                  borderColor: ringColor ?? 'transparent',
                  padding: ringColor ? 2 : 0,
                  borderRadius: 28,
                }}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <ImagePlaceholder size={44} radius={22} style={styles.avatar} />
                )}
              </View>

              {item.isDirect && (() => {
                const online = otherId ? presenceByUser?.[otherId]?.isOnline : false;
                if (!online) return null;
                return (
                  <View
                    style={{
                      position: 'absolute',
                      right: 0,
                      bottom: 0,
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: '#34C759',
                      borderWidth: 2,
                      borderColor: palette.card,
                    }}
                  />
                );
              })()}

              {isSelected && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    borderRadius: 30,
                  }}
                >
                  <Text
                    style={{
                      color: palette.primaryStrong,
                      fontSize: 22,
                      fontWeight: 'bold',
                    }}
                  >
                    ✓
                  </Text>
                </View>
              )}
            </Pressable>

            {/* NAME + LAST MESSAGE */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.name, { color: palette.text }]}>
                  {(() => {
                    if (item.isDirect) {
                      const phone = otherParticipantPhone(item.participants ?? [], currentUserId);
                      const key = normalizePhoneKey(phone);
                      if (key && contactNameByPhone?.[key]) return contactNameByPhone[key];
                    }
                    return item.name;
                  })()}
                </Text>
                {item.isBlocked && (
                  <View
                    style={{
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 6,
                      backgroundColor: palette.error ?? palette.primary,
                    }}
                  >
                    <Text style={{ color: palette.onPrimary ?? '#fff', fontSize: 10 }}>
                      Blocked
                    </Text>
                  </View>
                )}
                {item.isMuted && (
                  <KISIcon
                    name="volume-mute"
                    size={14}
                    color={palette.subtext}
                  />
                )}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {(() => {
                  const typingUsers = typingByConversation?.[String(convId)] ?? {};
                  const otherTyping = Object.keys(typingUsers).filter((u) => u !== currentUserId);
                  const isTyping = otherTyping.length > 0;
                  const meta = conversationMeta?.[convId];
                  const statusSymbol =
                    meta?.lastMessageFromMe && meta?.lastStatus
                      ? getStatusSymbol(meta.lastStatus)
                      : '';
                  const statusColor =
                    meta?.lastStatus === 'read'
                      ? palette.readStatus ?? palette.primary
                      : meta?.lastStatus === 'delivered'
                      ? palette.primary ?? palette.subtext
                      : palette.subtext;

                  if (isTyping) {
                    return (
                      <>
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: palette.primary,
                          }}
                        />
                        <Text style={{ color: palette.primary }}>
                          typing...
                        </Text>
                      </>
                    );
                  }

                  return (
                    <>
                      {statusSymbol ? (
                        <Text
                          style={{
                            color: statusColor,
                            fontSize: 12,
                            marginRight: 4,
                          }}
                        >
                          {statusSymbol}
                        </Text>
                      ) : null}
                      <Text
                        style={{ color: palette.subtext }}
                        numberOfLines={1}
                      >
                        {displayLastMessage || ''}
                      </Text>
                    </>
                  );
                })()}
              </View>
            </View>

            {/* RIGHT SIDE INFO */}
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ color: palette.subtext }}>
                {(() => {
                  const raw = displayLastAt || '';
                  if (!raw) return '';
                  const dt = new Date(raw);
                  if (Number.isNaN(dt.getTime())) return String(raw);
                  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                })()}
              </Text>

              {displayUnread > 0 && !isSelected && (
                <View
                  style={{
                    minWidth: 22,
                    paddingHorizontal: 6,
                    height: 22,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: palette.primarySoft,
                  }}
                >
                  <Text
                    style={{
                      color: palette.primaryStrong,
                      fontWeight: '700',
                      fontSize: 12,
                    }}
                  >
                    {displayUnread}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        );
      }}
    />
  );
}
