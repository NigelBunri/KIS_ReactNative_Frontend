import React from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
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
  onLoadOlder?: () => void;

  // New features
  onSendGif?: (gif: { url: string; previewUrl: string; width: number; height: number }) => void;
  onSendLocation?: (loc: LocationMessage) => void;
  onScheduleSend?: (scheduledAt: string) => void;
  onStarMessage?: (message: ChatMessage) => void;
  onShowReadReceipts?: (message: ChatMessage) => void;
  onViewOnce?: (messageId: string) => void;
  onLocalDeleteMessage?: (message: ChatMessage) => void;
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
  onLoadOlder,
  onSendGif,
  onSendLocation,
  onScheduleSend,
  onStarMessage,
  onShowReadReceipts,
  onViewOnce,
  onLocalDeleteMessage,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={styles.keyboardWrapper}
      behavior="padding"
      keyboardVerticalOffset={insets.top}
    >
      <MessageList
        messages={messages}
        palette={palette}
        isEmpty={!chat}
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
      />

      {isChannel && !canPost ? (
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
          onSendGif={onSendGif}
          onSendLocation={onSendLocation}
          onScheduleSend={onScheduleSend}
          bottomInset={insets.bottom}
        />
      )}
    </KeyboardAvoidingView>
  );
}
