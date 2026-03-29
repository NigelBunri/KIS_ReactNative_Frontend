// src/screens/chat/components/ChatHeader.tsx

import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';

import type { Chat } from '../../messagesUtils';
import { directConversationAvatar } from '../../messagesUtils';
import { chatRoomStyles as styles } from '../../chatRoomStyles';
import { KISIcon } from '@/constants/kisIcons';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';

type ChatHeaderProps = {
  chat: Chat | null;
  onBack: () => void;
  palette: any;
  onOpenInfo?: () => void;
  currentUserId?: string;

  // Selection mode support
  selectionMode?: boolean;
  selectedCount?: number;
  onCancelSelection?: () => void;
  onPinSelected?: () => void;
  onDeleteSelected?: () => void;
  onForwardSelected?: () => void;
  onCopySelected?: () => void;
  onMoreSelected?: () => void;

  // NEW: pinned + sub-room header indicators
  pinnedCount?: number;
  subRoomCount?: number;
  onOpenPinned?: () => void;
  onOpenSubRooms?: () => void;

  // NEW: single-selection-only sub-room action
  isSingleSelection?: boolean;
  onContinueInSubRoom?: () => void;

  // NEW: DM request / lock status (for direct chats)
  dmStatusLabel?: string | null;
  dmStatusVariant?: 'pending' | 'locked' | 'rejected' | 'normal';

  // NEW: presence/typing status
  statusText?: string | null;

  // NEW: context label for feed comment rooms
  contextLabel?: string | null;
  onPressContext?: () => void;
};

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  chat,
  onBack,
  palette,
  onOpenInfo,
  currentUserId,

  selectionMode = false,
  selectedCount = 0,
  onCancelSelection,
  onPinSelected,
  onDeleteSelected,
  onForwardSelected,
  onCopySelected,
  onMoreSelected,

  pinnedCount = 0,
  subRoomCount = 0,
  onOpenPinned,
  onOpenSubRooms,

  isSingleSelection = false,
  onContinueInSubRoom,

  dmStatusLabel,
  dmStatusVariant = 'normal',
  statusText,
  contextLabel,
  onPressContext,
}) => {
  const title = chat?.name ?? 'Chat';
  const headerAvatar =
    chat?.avatarUrl ||
    (chat?.isDirect
      ? directConversationAvatar(chat?.participants ?? [], currentUserId)
      : null);

  const headerStatusText = statusText ?? 'online';

  /* ─────────────────────────────────────────
   * 1) Selection mode header
   * ──────────────────────────────────────── */
  if (selectionMode) {
    return (
      <View
        style={[
          styles.header,
          {
            borderBottomColor: palette.divider,
            backgroundColor: palette.chatHeaderBg ?? palette.card,
          },
        ]}
      >
        {/* Back / cancel selection */}
        <Pressable
          onPress={onCancelSelection ?? onBack}
          style={({ pressed }) => [
            styles.headerBackButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <KISIcon
            name="arrow-left"
            size={22}
            color={palette.onHeader ?? palette.primary}
          />
        </Pressable>

        {/* Selected count */}
        <View style={styles.headerCenter}>
          <Text
            style={[
              styles.headerTitle,
              {
                color: palette.onHeader ?? palette.text,
              },
            ]}
            numberOfLines={1}
          >
            {selectedCount} selected
          </Text>
        </View>

        {/* Actions: pin, delete, forward, copy, sub-room (single only), more */}
        <View style={styles.headerActions}>
          {/* Pin */}
          <Pressable
            style={styles.headerIconButton}
            onPress={() => onPinSelected?.()}
          >
            <KISIcon
              name="pin"
              size={20}
              color={palette.onHeader ?? palette.text}
            />
          </Pressable>

          {/* Delete */}
          <Pressable
            style={styles.headerIconButton}
            onPress={() => onDeleteSelected?.()}
          >
            <KISIcon
              name="trash"
              size={20}
              color={palette.onHeader ?? palette.text}
            />
          </Pressable>

          {/* Forward */}
          <Pressable
            style={styles.headerIconButton}
            onPress={() => onForwardSelected?.()}
          >
            <KISIcon
              name="forward"
              size={20}
              color={palette.onHeader ?? palette.text}
            />
          </Pressable>

          {/* Copy */}
          <Pressable
            style={styles.headerIconButton}
            onPress={() => onCopySelected?.()}
          >
            <KISIcon
              name="copy"
              size={18}
              color={palette.onHeader ?? palette.text}
            />
          </Pressable>

          {/* NEW: Continue in sub-room (only when exactly one message is selected) */}
          {isSingleSelection && (
            <Pressable
              style={styles.headerIconButton}
              onPress={() => onContinueInSubRoom?.()}
            >
              {/* NOTE: adjust icon name if needed to match your KISIcon set */}
              <KISIcon
                name="sub-channel"
                size={20}
                color={palette.onHeader ?? palette.text}
              />
            </Pressable>
          )}

          {/* More (dropdown menu: copy, pin, report – handled in parent) */}
          <Pressable
            style={styles.headerIconButton}
            onPress={() => onMoreSelected?.()}
          >
            <KISIcon
              name="more-vert"
              size={20}
              color={palette.onHeader ?? palette.text}
            />
          </Pressable>
        </View>
      </View>
    );
  }

  /* ─────────────────────────────────────────
   * 2) Normal chat header + info strip
   * ──────────────────────────────────────── */

  // Show info strip if we have pinned, sub-rooms, or a DM status
  const showInfoStrip =
    pinnedCount > 0 || subRoomCount > 0 || !!dmStatusLabel;

  const pillBaseStyle = {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  };

  // Choose background color for DM status pill
  const dmBgColor =
    dmStatusVariant === 'pending'
      ? palette.pillPendingBg ??
        palette.warningSoft ??
        palette.surface
      : dmStatusVariant === 'locked' || dmStatusVariant === 'rejected'
      ? palette.pillLockedBg ??
        palette.errorSoft ??
        palette.surface
      : palette.pillInfoBg ?? palette.surface;

  const dmTextColor =
    dmStatusVariant === 'locked' || dmStatusVariant === 'rejected'
      ? palette.errorText ?? palette.onHeader ?? palette.text
      : palette.onHeader ?? palette.text;

  return (
    <View
      style={[
        styles.header,
        {
          borderBottomColor: palette.divider,
          backgroundColor: 'transparent',
          // stack main row + info row vertically
          flexDirection: 'column',
        },
      ]}
    >
      {/* Top row: back + avatar + title + actions */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.headerBackButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <KISIcon
            name="arrow-left"
            size={22}
            color={palette.onHeader ?? palette.primary}
          />
        </Pressable>

        {/* Avatar + name + status */}
        <Pressable
          onPress={onOpenInfo}
          disabled={!onOpenInfo}
          style={({ pressed }) => [
            styles.headerCenter,
            { opacity: pressed && onOpenInfo ? 0.75 : 1 },
          ]}
        >
          {headerAvatar ? (
            <Image
              source={{ uri: headerAvatar }}
              style={styles.headerAvatar}
            />
          ) : (
            <ImagePlaceholder size={36} radius={18} style={styles.headerAvatar} />
          )}

          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text
              style={[
                styles.headerTitle,
                { color: palette.onHeader ?? palette.text },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {contextLabel ? (
              <Pressable
                onPress={onPressContext}
                disabled={!onPressContext}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <Text
                  style={[
                    styles.headerContext,
                    { color: palette.headerSubtext ?? palette.subtext },
                  ]}
                  numberOfLines={1}
                >
                  {contextLabel}
                </Text>
              </Pressable>
            ) : null}
            <Text
              style={[
                styles.headerSubtitle,
                { color: palette.headerSubtext ?? palette.subtext },
              ]}
              numberOfLines={1}
            >
              {headerStatusText}
            </Text>
          </View>
        </Pressable>

        {/* WhatsApp-like actions: camera, mic, menu */}
        <View style={styles.headerActions}>
          <Pressable style={styles.headerIconButton}>
            <KISIcon
              name="camera"
              size={20}
              color={palette.onHeader ?? palette.text}
            />
          </Pressable>
          <Pressable style={styles.headerIconButton}>
            <KISIcon
              name="mic"
              size={20}
              color={palette.onHeader ?? palette.text}
            />
          </Pressable>
          <Pressable
            style={styles.headerIconButton}
            onPress={() => onMoreSelected?.()}
          >
            <KISIcon
              name="menu"
              size={20}
              color={palette.onHeader ?? palette.text}
            />
          </Pressable>
        </View>
      </View>

      {/* NEW: info strip – DM status + pinned + sub-rooms pills under the header */}
      {showInfoStrip && (
        <View
          style={{
            width: '100%',
            paddingHorizontal: 16,
            paddingBottom: 6,
            paddingTop: 4,
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {/* DM REQUEST / LOCK PILL */}
          {dmStatusLabel && (
            <View
              style={[
                pillBaseStyle,
                {
                  backgroundColor: dmBgColor,
                },
              ]}
            >
              <KISIcon
                name="info"
                size={14}
                color={dmTextColor}
              />
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 12,
                  color: dmTextColor,
                }}
                numberOfLines={1}
              >
                {dmStatusLabel}
              </Text>
            </View>
          )}

          {/* PINNED PILL */}
          {pinnedCount > 0 && (
            <Pressable
              onPress={() => onOpenPinned?.()}
              style={({ pressed }) => [
                pillBaseStyle,
                {
                  backgroundColor:
                    palette.pillPinnedBg ??
                    palette.surfaceSoft ??
                    palette.surface,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <KISIcon
                name="pin"
                size={14}
                color={palette.onHeader ?? palette.text}
              />
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 12,
                  color: palette.onHeader ?? palette.text,
                }}
              >
                Pinned ({pinnedCount})
              </Text>
            </Pressable>
          )}

          {/* SUB-ROOMS PILL */}
          {subRoomCount > 0 && (
            <Pressable
              onPress={() => onOpenSubRooms?.()}
              style={({ pressed }) => [
                pillBaseStyle,
                {
                  backgroundColor:
                    palette.pillSubRoomBg ??
                    palette.surfaceSoft ??
                    palette.surface,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              {/* NOTE: adjust icon name if needed to match your KISIcon set */}
              <KISIcon
                name="layers"
                size={14}
                color={palette.onHeader ?? palette.text}
              />
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 12,
                  color: palette.onHeader ?? palette.text,
                }}
              >
                Sub-rooms ({subRoomCount})
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};
