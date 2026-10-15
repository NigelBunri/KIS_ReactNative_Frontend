// src/screens/chat/hooks/useBulkMessageActions.ts
import { useCallback } from 'react';
import { Alert } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

import type { ChatMessage } from '../chatTypes';

type UseBulkMessageActionsParams = {
  selectedIds: string[];
  selectedMessages: ChatMessage[];
  messages: ChatMessage[];
  editMessage: (id: string, patch: Partial<ChatMessage>) => Promise<void>;
  softDeleteMessage: (id: string) => Promise<void>;
  exitSelectionMode: () => void;
  isSingleSelection: boolean;
  canBroadcast?: boolean;
  onBroadcastMessages?: (messages: ChatMessage[]) => Promise<void> | void;
  onReportMessage?: (message: ChatMessage) => Promise<boolean> | boolean;
  onPinMessage?: (message: ChatMessage, pinned: boolean) => void;
  onContinueInSubRoom?: (message: ChatMessage) => void;
  onEditMessage?: (message: ChatMessage) => void;
  onDeleteForEveryone?: (message: ChatMessage) => Promise<void> | void;
};

export function useBulkMessageActions({
  selectedIds,
  selectedMessages,
  messages,
  editMessage,
  softDeleteMessage,
  exitSelectionMode,
  isSingleSelection,
  canBroadcast,
  onBroadcastMessages,
  onReportMessage,
  onPinMessage,
  onContinueInSubRoom,
  onEditMessage,
  onDeleteForEveryone,
}: UseBulkMessageActionsParams) {
  const handlePinSelected = useCallback(async () => {
    if (!selectedIds.length) return;

    // Previously this also called editMessage(msg.id, { isPinned }) to flip
    // the pin flag LOCALLY before onPinMessage ever reached the server. That
    // local write is why pinning via this header button only ever showed up
    // for the pinning device: editMessage (useChatPersistence.ts) is a purely
    // local persist — it doesn't call the backend — so it gave the pinner an
    // instant "pinned" badge regardless of whether the real network request
    // (onPinMessage -> Handlers.handleSetPinned -> POST pins.set) actually
    // succeeded. Other participants only ever learn about a pin through the
    // server's chat.pin/chat.message_pinned socket echo, so if that POST
    // silently failed (handleSetPinned didn't check its response), the
    // pinner would see a pinned message that no one else ever did. It also
    // incorrectly stamped isEdited:true/status:QUEUED on the message as a
    // side effect of reusing the text-edit path for a pin toggle.
    // handlePinSingleMessage (ChatRoomPage.tsx) never had this local write —
    // it relies solely on the server round-trip — so align this bulk path
    // with that single-message path instead of carrying its own local state.
    for (const msg of selectedMessages) {
      const nextPinned = !msg.isPinned;
      onPinMessage?.(msg, nextPinned);
    }
    exitSelectionMode();
  }, [exitSelectionMode, onPinMessage, selectedIds, selectedMessages]);

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedIds.length) return;

    const confirm = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Delete messages',
        `Delete ${selectedIds.length} message(s)?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => resolve(true),
          },
        ],
      );
    });

    if (!confirm) return;

    for (const id of selectedIds) {
      await softDeleteMessage(id);
    }
    exitSelectionMode();
  }, [exitSelectionMode, selectedIds, softDeleteMessage]);

  const handleCopySelected = useCallback(() => {
    if (!selectedMessages.length) return;

    const sorted = [...selectedMessages].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );

    const text = sorted
      .map((m) => m.text || m.styledText?.text || '')
      .filter((s) => s.trim().length > 0)
      .join('\n');

    if (!text.trim()) return;

    Clipboard.setString(text);
    exitSelectionMode();
  }, [exitSelectionMode, selectedMessages]);

  const handleContinueInSubRoom = useCallback(() => {
    if (!isSingleSelection) return;

    const msgId = selectedIds[0];
    const message = messages.find((m) => m.id === msgId);
    if (!message) return;

    if (onContinueInSubRoom) {
      onContinueInSubRoom(message);
      return;
    }
    Alert.alert(
      'Sub-room',
      'This will create or open a dedicated sub-room for this message once backend + navigation are wired.',
    );
  }, [isSingleSelection, messages, onContinueInSubRoom, selectedIds]);

  const handleEditSelected = useCallback(() => {
    if (!isSingleSelection) return;
    const msgId = selectedIds[0];
    const message = messages.find((m) => m.id === msgId);
    if (!message) return;
    if (onEditMessage) {
      onEditMessage(message);
    } else {
      Alert.alert(
        'Edit not yet wired',
        'Editing requires a dedicated UI—please hook `onEditMessage` to open it.',
      );
    }
    exitSelectionMode();
  }, [isSingleSelection, messages, onEditMessage, exitSelectionMode, selectedIds]);

  const handleDeleteForEveryone = useCallback(async () => {
    if (!isSingleSelection) return;
    const msgId = selectedIds[0];
    const message = messages.find((m) => m.id === msgId);
    if (!message) return;
    const confirm = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Delete for everyone',
        'Remove this message for everyone in the conversation?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => resolve(true),
          },
        ],
      );
    });
    if (!confirm) return;
    if (onDeleteForEveryone) {
      await onDeleteForEveryone(message);
    } else {
      await softDeleteMessage(msgId);
    }
    exitSelectionMode();
  }, [isSingleSelection, messages, onDeleteForEveryone, exitSelectionMode, selectedIds, softDeleteMessage]);

  const handleMoreSelected = useCallback(() => {
    if (!selectedMessages.length) return;

    const actions: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [
      {
        text: 'Copy',
        onPress: () => handleCopySelected(),
      },
      {
        text: 'Pin',
        onPress: () => handlePinSelected(),
      },
      ...(isSingleSelection
        ? [
            {
              text: 'Edit message',
              onPress: () => handleEditSelected(),
            },
            {
              text: 'Delete for everyone',
              style: 'destructive' as const,
              onPress: () => handleDeleteForEveryone(),
            },
          ]
        : []),
      ...(canBroadcast && onBroadcastMessages
        ? [
            {
              text: 'Broadcast',
              onPress: async () => {
                await onBroadcastMessages(selectedMessages);
                exitSelectionMode();
              },
            },
          ]
        : []),
      {
        text: 'Report',
        onPress: async () => {
          const target = selectedMessages[0];
          if (onReportMessage) {
            const ok = await onReportMessage(target);
            Alert.alert(
              ok ? 'Reported' : 'Report failed',
              ok ? 'Thanks, this message has been reported.' : 'Unable to report this message right now.',
            );
            exitSelectionMode();
            return;
          }
          Alert.alert(
            'Report unavailable',
            'Reporting is not available from this screen right now. Please try again from the chat.',
          );
          exitSelectionMode();
        },
      },
      { text: 'Cancel', style: 'cancel' as const },
    ];

    Alert.alert('More', 'Choose an action for selected messages', actions);
  }, [
    exitSelectionMode,
    handleCopySelected,
    handleDeleteForEveryone,
    handleEditSelected,
    handlePinSelected,
    isSingleSelection,
    canBroadcast,
    onBroadcastMessages,
    onReportMessage,
    selectedMessages,
  ]);

  return {
    handlePinSelected,
    handleDeleteSelected,
    handleCopySelected,
    handleMoreSelected,
    handleContinueInSubRoom,
    handleEditSelected,
    handleDeleteForEveryone,
  };
}
