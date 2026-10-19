import React, { useMemo, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatRoomStyles as styles } from './chatRoomStyles';
import { MessageList } from './componets/main/MessageList';
import type { CallHistoryEntry } from './componets/CallHistoryRow';
import { MessageComposer } from './componets/main/MessageComposer';
import type { ChatMessage, LocationMessage } from './chatTypes';
import type { Chat } from './messagesUtils';
import type { Sticker } from './componets/main/FroSticker/StickerEditor';
import type { AttachmentFilePayload } from './ChatRoomPage';
import type { SimpleContact } from './componets/main/ForAttachments/ContactsModal';
import type { PollDraft } from './componets/main/ForAttachments/PollModal';
import type { EventDraft } from './componets/main/ForAttachments/EventModal';
import TypingIndicator, { type TypingUser } from './componets/main/TypingIndicator';

type Props = {
  chat: Chat | null;
  messages: ChatMessage[];
  palette: any;
  isChannel: boolean;
  canPost: boolean;
  draft: string;
  selectionMode: boolean;
  selectedIds: string[];
  currentUserId: string;
  autoScrollEnabled: boolean;
  startAtBottom: boolean;
  stickerLibraryVersion: number;
  replyTo: ChatMessage | null;
  editing: ChatMessage | null;
  onReplyToMessage: (message: ChatMessage) => void;
  onEditMessage: (message: ChatMessage) => void;
  onForwardMessage?: (message: ChatMessage) => void;
  onDeleteMessage?: (message: ChatMessage) => void;
  onPinMessage?: (message: ChatMessage) => void;
  onStartSelection?: (message: ChatMessage) => void;
  onToggleSelect?: (message: ChatMessage) => void;
  onReactMessage: (message: ChatMessage, emoji: string) => void;
  onVotePoll?: (message: ChatMessage, optionId: string) => void;
  onClosePoll?: (message: ChatMessage) => void;
  onRetryMessage: (message: ChatMessage) => void;
  onMessageLocatorReady: (helpers: {
    scrollToMessage: (messageId: string) => void;
    highlightMessage: (messageId: string) => void;
  }) => void;
  onVisibleMessageIds: (ids: string[]) => void;
  onChangeDraft: (value: string) => void;
  onSend: () => void;
  onSendVoice: (payload: { uri: string; durationMs: number; viewOnce?: boolean }) => void;
  onOpenStickerEditor: () => void;
  onChooseTextBackground: (color: string) => void;
  onSendSticker: (sticker: Sticker) => void;
  onClearReply: () => void;
  onCancelEditing: () => void;
  onSendAttachment: (payload: AttachmentFilePayload) => void;
  onSendContacts: (contacts: SimpleContact[]) => void;
  onCreatePoll: (poll: PollDraft) => void;
  onCreateEvent: (event: EventDraft) => void;
  canSend: boolean;
  mentionParticipants?: { id: string; name: string }[];
  participantMap?: Record<string, string>;
  participantAvatarMap?: Record<string, string>;
  participantPhoneMap?: Record<string, string>;
  participantRoleMap?: Record<string, string>;
  isDirectChat?: boolean;
  senderName?: string;
  conversationIdForMentions?: string;
  onLoadOlder?: () => void;
  isLoadingOlder?: boolean;
  hasMoreOlder?: boolean;
  myJoinedAt?: string | null;

  // New features
  onSendGif?: (gif: { url: string; previewUrl: string; width: number; height: number }) => void;
  onSendLocation?: (loc: LocationMessage) => void;
  onScheduleSend?: (scheduledAt: string) => void;
  onStarMessage?: (message: ChatMessage) => void;
  onShowReadReceipts?: (message: ChatMessage) => void;
  onViewOnce?: (messageId: string) => void;
  onLocalDeleteMessage?: (message: ChatMessage) => void;
  onUpdateMessage?: (message: ChatMessage) => void;
  typingUsers?: TypingUser[];
  // Height of the header above this component so KeyboardAvoidingView can
  // calculate the correct offset. Defaults to 0; ChatRoomPage should pass
  // its measured header height.
  keyboardOffset?: number;
  // Call history to render inline in the message stream
  callHistory?: import('./componets/CallHistoryRow').CallHistoryEntry[];
  onCallHistoryCallback?: (entry: import('./componets/CallHistoryRow').CallHistoryEntry) => void;

  // GAP 12: announcement mode (admin-only posting)
  announcementMode?: boolean;
  isAdmin?: boolean;

  // GAP 13: extended activity sub-states
  activityUsers?: { userId: string; name?: string; activity: 'typing' | 'recording' | 'location' }[];

  // GAP 26: wallpaper preference sync
  conversationId?: string;

  onLinkPreviewChange?: (preview: { title?: string; description?: string; image?: string; site_name?: string; url: string } | null) => void;
  onViewOnceChange?: (enabled: boolean) => void;
};

export default function ChatRoomBody({
  chat,
  messages,
  palette,
  isChannel,
  canPost,
  draft,
  selectionMode,
  selectedIds,
  currentUserId,
  autoScrollEnabled,
  startAtBottom,
  stickerLibraryVersion,
  replyTo,
  editing,
  onReplyToMessage,
  onEditMessage,
  onForwardMessage,
  onDeleteMessage,
  onPinMessage,
  onStartSelection,
  onToggleSelect,
  onReactMessage,
  onVotePoll,
  onClosePoll,
  onRetryMessage,
  onMessageLocatorReady,
  onVisibleMessageIds,
  onChangeDraft,
  onSend,
  onSendVoice,
  onOpenStickerEditor,
  onChooseTextBackground,
  onSendSticker,
  onClearReply,
  onCancelEditing,
  onSendAttachment,
  onSendContacts,
  onCreatePoll,
  onCreateEvent,
  canSend,
  mentionParticipants,
  participantMap,
  participantAvatarMap,
  participantPhoneMap,
  participantRoleMap,
  isDirectChat,
  senderName,
  conversationIdForMentions,
  onLoadOlder,
  isLoadingOlder,
  hasMoreOlder,
  myJoinedAt,
  onSendGif,
  onSendLocation,
  onScheduleSend,
  onStarMessage,
  onShowReadReceipts,
  onViewOnce,
  onLocalDeleteMessage,
  onUpdateMessage,
  typingUsers = [],
  keyboardOffset = 0,
  announcementMode = false,
  isAdmin = false,
  activityUsers = [],
  onLinkPreviewChange,
  onViewOnceChange,
  callHistory = [],
  onCallHistoryCallback,
}: Props) {
  const insets = useSafeAreaInsets();

  const mentionMap = useMemo(() => {
    const map: Record<string, string> = {};
    (mentionParticipants ?? []).forEach(p => {
      if (p.name) map[p.name.toLowerCase()] = p.id;
    });
    return map;
  }, [mentionParticipants]);

  // GAP 14: scheduled message modal

  // GAP 13: activity sub-state display label
  const activityLabel = useMemo(() => {
    if (!activityUsers.length) return null;
    const first = activityUsers[0];
    const name = first.name ?? 'Someone';
    if (first.activity === 'recording') return `🎙 ${name} is recording a voice note`;
    if (first.activity === 'location') return `📍 ${name} is sharing location`;
    return null; // typing handled by TypingIndicator
  }, [activityUsers]);

  return (
    <KeyboardAvoidingView
      style={styles.keyboardWrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      // The header above this component eats into its own on-screen position,
      // but RN's onLayout only reports position relative to its parent — not
      // the true screen position — so the library under-counts how far to
      // move above the keyboard. automaticOffset asks the native side for the
      // real window position instead, which is accurate regardless of what
      // sits above this view in the layout tree.
      automaticOffset
    >
      <MessageList
        messages={messages}
        palette={palette}
        isEmpty={!chat}
        isE2EE
        currentUserId={currentUserId}
        selectionMode={selectionMode}
        selectedMessageIds={selectedIds}
        onReplyToMessage={onReplyToMessage}
        onEditMessage={onEditMessage}
        onForwardMessage={onForwardMessage}
        onDeleteMessage={onDeleteMessage}
        onPinMessage={onPinMessage}
        onStartSelection={onStartSelection}
        onToggleSelect={onToggleSelect}
        onReactMessage={onReactMessage}
        onVotePoll={onVotePoll}
        onClosePoll={onClosePoll}
        onRetryMessage={onRetryMessage}
        onMessageLocatorReady={onMessageLocatorReady}
        autoScrollEnabled={autoScrollEnabled}
        startAtBottom={startAtBottom}
        onVisibleMessageIds={onVisibleMessageIds}
        onLoadOlder={onLoadOlder}
        isLoadingOlder={isLoadingOlder}
        hasMoreOlder={hasMoreOlder}
        myJoinedAt={myJoinedAt}
        onStarMessage={onStarMessage}
        onShowReadReceipts={onShowReadReceipts}
        onViewOnce={onViewOnce}
        onLocalDeleteMessage={onLocalDeleteMessage}
        onUpdateMessage={onUpdateMessage}
        mentionMap={mentionMap}
        participantMap={participantMap}
        participantAvatarMap={participantAvatarMap}
        participantPhoneMap={participantPhoneMap}
        participantRoleMap={participantRoleMap}
        isDirectChat={isDirectChat}
        callHistory={callHistory}
        onCallHistoryCallback={onCallHistoryCallback}
      />

      {typingUsers.length > 0 ? (
        <TypingIndicator typingUsers={typingUsers} palette={palette} />
      ) : null}

      {/* Call records are merged chronologically into MessageList. */}

      {/* GAP 13: activity sub-state label */}
      {activityLabel ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          <Text style={{ fontSize: 12, fontStyle: 'italic', color: palette.subtext }}>{activityLabel}</Text>
        </View>
      ) : null}

      {/* GAP 12: Announcement mode banner */}
      {announcementMode && !isAdmin ? (
        <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: palette.inputBorder ?? palette.divider, backgroundColor: palette.card }}>
          <Text style={{ color: palette.subtext, textAlign: 'center' }}>
            📢 Announcement mode — only admins can post.
          </Text>
        </View>
      ) : isChannel && !canPost ? (
        <View
          style={{
            padding: 14,
            borderTopWidth: 1,
            borderTopColor: palette.inputBorder,
            backgroundColor: palette.card,
          }}
        >
          <Text style={{ color: palette.subtext, textAlign: 'center' }}>
            Only channel admins can post. Subscribe to receive updates.
          </Text>
        </View>
      ) : (
        <MessageComposer
          value={draft}
          onChangeText={onChangeDraft}
          onSend={onSend}
          onLinkPreviewChange={onLinkPreviewChange}
          onViewOnceChange={onViewOnceChange}
          canSend={canSend}
          palette={palette}
          disabled={!chat}
          onSendVoice={onSendVoice}
          onOpenStickerEditor={onOpenStickerEditor}
          onChooseTextBackground={onChooseTextBackground}
          onSendSticker={onSendSticker}
          stickerVersion={stickerLibraryVersion}
          replyTo={replyTo}
          onClearReply={onClearReply}
          editing={editing}
          onCancelEditing={onCancelEditing}
          onSendAttachment={onSendAttachment}
          onSendContacts={onSendContacts}
          onCreatePoll={onCreatePoll}
          onCreateEvent={onCreateEvent}
          mentionParticipants={mentionParticipants}
          senderName={senderName}
          conversationIdForMentions={conversationIdForMentions}
          onSendGif={onSendGif}
          onSendLocation={onSendLocation}
          onScheduleSend={onScheduleSend}
          bottomInset={insets.bottom}
        />
      )}

    </KeyboardAvoidingView>
  );
}
