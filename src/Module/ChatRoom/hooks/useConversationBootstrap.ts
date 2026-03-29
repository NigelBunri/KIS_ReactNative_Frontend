// src/screens/chat/hooks/useConversationBootstrap.ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import type { ChatRoomPageProps } from '../chatTypes';

type ChatType = ChatRoomPageProps['chat'];

export function useConversationBootstrap(
  chat: ChatType | undefined,
  authToken: string | null,
) {
  const isDirectChat = useMemo(
    () =>
      !!chat &&
      (chat.kind === 'direct' ||
        (chat as any).isContactChat ||
        (!chat.isGroup &&
          !(chat as any).isGroupChat &&
          !(chat as any).isCommunityChat)),
    [chat],
  );

  const getInitialConversationId = useCallback((): string | null => {
    if (!chat) return null;

    if ((chat as any).conversationId) {
      return String((chat as any).conversationId);
    }

    if (!isDirectChat && chat.id) {
      return String(chat.id);
    }

    if (isDirectChat && chat.id && !String(chat.id).startsWith('newContact-')) {
      return String(chat.id);
    }

    return null;
  }, [chat, isDirectChat]);

  const [conversationId, setConversationId] = useState<string | null>(
    getInitialConversationId,
  );

  useEffect(() => {
    if (!chat) {
      setConversationId(null);
      return;
    }
    if (conversationId) return;

    const initial = getInitialConversationId();
    if (initial) {
      console.log('[ChatRoomPage] Setting conversationId from chat:', initial);
      setConversationId(initial);
    }
  }, [chat, conversationId, getInitialConversationId]);

  const storageRoomId = conversationId ?? chat?.id ?? 'local-room';

  /**
   * Ensure we have a real conversationId.
   * - Non-direct: return existing id
   * - Direct:
   *    - If chat already has a real id, reuse it
   *    - Else call Django /direct to create/fetch the DM conversation (pending request flow)
   *
   * NOTE: We accept an optional reason/preview arg just for logging.
   */
  const ensureConversationId = useCallback(
    async (reason?: string): Promise<string | null> => {
      if (!chat) return null;

      let currentConversationId: string | null =
        conversationId != null ? String(conversationId) : null;

      console.log(
        '[ChatRoomPage] ensureConversationId called:',
        { reason, currentConversationId, isDirectChat },
      );

      // ---------------- NON-DIRECT ----------------
      if (!isDirectChat) {
        const existingId = (chat as any).conversationId ?? chat.id ?? null;
        if (!existingId) return null;

        const idStr = String(existingId);
        if (idStr !== currentConversationId) {
          setConversationId(idStr);
        }
        return idStr;
      }

      // ---------------- DIRECT ----------------
      if (currentConversationId) return currentConversationId;

      const chatIdStr = chat.id != null ? String(chat.id) : null;
      const isNewContact = chatIdStr?.startsWith('newContact-') ?? false;

      // If chat.id exists and isn't temp, treat it as conversationId.
      if (!isNewContact && chatIdStr) {
        setConversationId(chatIdStr);
        return chatIdStr;
      }

      if (!authToken) {
        Alert.alert('Not signed in', 'Please sign in again.');
        return null;
      }

      const participantsPhones: string[] = (chat.participants ?? [])
        .filter(Boolean)
        .map((p) => String(p).trim())
        .filter((p) => p.length > 0);

      if (!participantsPhones.length) {
        Alert.alert('Cannot start chat', 'No participant phone numbers found.');
        return null;
      }

      const payload = {
        participants: [participantsPhones[0]],
        client_context: {
          temp_chat_id: String(chat.id),
          source: 'mobile',
        },
      };

      console.log('[ChatRoomPage] /direct payload:', payload);

      try {
        const res = await postRequest(ROUTES.chat.directConversation, payload, {
          errorMessage: 'Could not start conversation.',
        });

        if (!res?.success) {
          Alert.alert('Error', res?.message || 'Could not start conversation.');
          return null;
        }

        const newId = res?.data?.id;
        if (!newId) {
          Alert.alert('Error', 'Conversation created but id is missing.');
          return null;
        }

        const idStr = String(newId);
        setConversationId(idStr);
        return idStr;
      } catch (e) {
        console.warn('[ChatRoomPage] ensureConversationId error', e);
        Alert.alert('Network error', 'Could not start this conversation.');
        return null;
      }
    },
    [authToken, chat, conversationId, isDirectChat],
  );

  return {
    isDirectChat,
    conversationId,
    storageRoomId,
    ensureConversationId,
    setConversationId,
  };
}
