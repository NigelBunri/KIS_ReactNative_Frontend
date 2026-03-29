// src/screens/chat/hooks/useSelectionState.ts
import { useCallback, useMemo, useState } from 'react';
import type { ChatMessage, SubRoom } from '../chatTypes';

export function useSelectionState(
  messages: ChatMessage[],
  subRooms: SubRoom[],
) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const enterSelectionMode = useCallback((message: ChatMessage) => {
    setSelectionMode(true);
    setSelectedIds([message.id]);
  }, []);

  const toggleSelectMessage = useCallback((message: ChatMessage) => {
    setSelectedIds((prev) => {
      const exists = prev.includes(message.id);
      const next = exists
        ? prev.filter((id) => id !== message.id)
        : [...prev, message.id];

      if (next.length === 0) {
        setSelectionMode(false);
      }

      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds([]);
  }, []);

  const selectedMessages = useMemo(
    () => messages.filter((m) => selectedIds.includes(m.id)),
    [messages, selectedIds],
  );

  const isSingleSelection = selectedIds.length === 1;

  const pinnedMessages = useMemo(
    () => messages.filter((m) => m.isPinned && !m.isDeleted),
    [messages],
  );
  const pinnedCount = pinnedMessages.length;
  const subRoomCount = subRooms.length;

  return {
    selectionMode,
    selectedIds,
    enterSelectionMode,
    toggleSelectMessage,
    exitSelectionMode,
    selectedMessages,
    isSingleSelection,
    pinnedMessages,
    pinnedCount,
    subRoomCount,
  };
}
