import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatRoomStyles as styles } from './chatRoomStyles';
import { MessageList } from './componets/main/MessageList';
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
  onRetryMessage: (message: ChatMessage) => void;
  onMessageLocatorReady: (helpers: {
    scrollToMessage: (messageId: string) => void;
    highlightMessage: (messageId: string) => void;
  }) => void;
  onVisibleMessageIds: (ids: string[]) => void;
  onChangeDraft: (value: string) => void;
  onSend: () => void;
  onSendVoice: (payload: { uri: string; durationMs: number }) => void;
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
  senderName?: string;
  conversationIdForMentions?: string;
  onLoadOlder?: () => void;

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

  // GAP 12: announcement mode (admin-only posting)
  announcementMode?: boolean;
  isAdmin?: boolean;

  // GAP 13: extended activity sub-states
  activityUsers?: { userId: string; name?: string; activity: 'typing' | 'recording' | 'location' }[];

  // GAP 14: scheduled messages queue
  scheduledMessages?: { id: string; text: string; scheduledAt: string }[];
  onSendScheduledNow?: (id: string) => void;
  onCancelScheduled?: (id: string) => void;

  // GAP 26: wallpaper preference sync
  conversationId?: string;

  onLinkPreviewChange?: (preview: { title?: string; description?: string; image?: string; site_name?: string; url: string } | null) => void;
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
  senderName,
  conversationIdForMentions,
  onLoadOlder,
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
  scheduledMessages = [],
  onSendScheduledNow,
  onCancelScheduled,
  conversationId,
  onLinkPreviewChange,
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
  const [scheduledModalVisible, setScheduledModalVisible] = useState(false);

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
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + keyboardOffset : 0}
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
        onRetryMessage={onRetryMessage}
        onMessageLocatorReady={onMessageLocatorReady}
        autoScrollEnabled={autoScrollEnabled}
        startAtBottom={startAtBottom}
        onVisibleMessageIds={onVisibleMessageIds}
        onLoadOlder={onLoadOlder}
        onStarMessage={onStarMessage}
        onShowReadReceipts={onShowReadReceipts}
        onViewOnce={onViewOnce}
        onLocalDeleteMessage={onLocalDeleteMessage}
        onUpdateMessage={onUpdateMessage}
        mentionMap={mentionMap}
        participantMap={participantMap}
        participantAvatarMap={participantAvatarMap}
      />

      <TypingIndicator typingUsers={typingUsers} palette={palette} />

      {/* GAP 13: activity sub-state label */}
      {activityLabel ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          <Text style={{ fontSize: 12, fontStyle: 'italic', color: palette.subtext ?? '#888' }}>{activityLabel}</Text>
        </View>
      ) : null}

      {/* GAP 14: Scheduled message clock button */}
      {scheduledMessages.length > 0 && (
        <Pressable
          onPress={() => setScheduledModalVisible(true)}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, borderTopWidth: 1, borderTopColor: palette.divider ?? '#e0e0e0' }}
        >
          <Text style={{ fontSize: 12, color: palette.primary ?? '#4F46E5', fontWeight: '600' }}>
            🕐 {scheduledMessages.length} scheduled message{scheduledMessages.length > 1 ? 's' : ''}
          </Text>
        </Pressable>
      )}

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

      {/* GAP 14: Scheduled messages modal */}
      <Modal
        visible={scheduledModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setScheduledModalVisible(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }} onPress={() => setScheduledModalVisible(false)}>
          <View style={{ maxHeight: '55%', backgroundColor: palette.surface ?? '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24 }} onStartShouldSetResponder={() => true}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: palette.divider ?? '#00000011' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text ?? '#000' }}>Scheduled messages</Text>
            </View>
            <ScrollView>
              {scheduledMessages.map((msg) => (
                <View key={msg.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: palette.divider ?? '#00000011' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: palette.text ?? '#000' }} numberOfLines={2}>{msg.text}</Text>
                    <Text style={{ fontSize: 11, color: palette.subtext ?? '#888', marginTop: 3 }}>
                      {new Date(msg.scheduledAt).toLocaleString()}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => { onSendScheduledNow?.(msg.id); }}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: palette.primary ?? '#4F46E5', marginLeft: 8 }}
                  >
                    <Text style={{ fontSize: 12, color: palette.onPrimary ?? '#fff', fontWeight: '600' }}>Send now</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { onCancelScheduled?.(msg.id); }}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#DC262611', marginLeft: 6 }}
                  >
                    <Text style={{ fontSize: 12, color: '#DC2626', fontWeight: '600' }}>Cancel</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
