// src/screens/chat/hooks/useConversationBootstrap.ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import { getAccessToken } from '@/security/authStorage';
import type { ChatRoomPageProps } from '../chatTypes';

type ChatType = ChatRoomPageProps['chat'];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isBackendConversationId = (value?: unknown): boolean =>
  UUID_PATTERN.test(String(value ?? '').trim());

const cleanPhone = (value?: unknown): string | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const cleaned = raw.startsWith('+')
    ? `+${raw.slice(1).replace(/\D/g, '')}`
    : raw.replace(/\D/g, '');
  return cleaned.length >= 6 ? cleaned : null;
};

const pickPeerUserId = (chat: ChatType): string | null => {
  const candidates = [
    (chat as any)?.peer_user_id,
    (chat as any)?.peerUserId,
    (chat as any)?.contactUserId,
    (chat as any)?.contact_user_id,
  ];

  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value) return value;
  }

  for (const participant of ((chat as any)?.participants ?? []) as any[]) {
    const user = participant?.user;
    const value =
      user && typeof user === 'object'
        ? user.id
        : participant?.user_id ?? participant?.userId;
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }

  return null;
};

const collectParticipantPhones = (chat: ChatType): string[] => {
  const phones: string[] = [];
  const addPhone = (value?: unknown) => {
    const phone = cleanPhone(value);
    if (phone && !phones.includes(phone)) phones.push(phone);
  };

  addPhone((chat as any)?.contactPhone ?? (chat as any)?.contact_phone);

  const id = String((chat as any)?.id ?? '');
  if (id.startsWith('newContact-')) {
    addPhone(id.replace(/^newContact-/, ''));
  }

  for (const participant of ((chat as any)?.participants ?? []) as any[]) {
    if (typeof participant === 'string' || typeof participant === 'number') {
      addPhone(participant);
      continue;
    }
    addPhone(participant?.phone ?? participant?.contactPhone);
    if (participant?.user && typeof participant.user === 'object') {
      addPhone(participant.user.phone);
    }
  }

  return phones;
};

const getRequestErrorMessage = (res: any): string => {
  const data = res?.data;
  const firstValue = (value: any): string | null => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && value.length) return firstValue(value[0]);
    if (value && typeof value === 'object') {
      for (const key of Object.keys(value)) {
        const nested = firstValue(value[key]);
        if (nested) return nested;
      }
    }
    return null;
  };

  return (
    firstValue(data?.detail) ||
    firstValue(data?.participants) ||
    firstValue(data?.peer_user_id) ||
    firstValue(data) ||
    res?.message ||
    'Could not start conversation.'
  );
};

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

    if (isDirectChat && isBackendConversationId(chat.id)) {
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

      console.log('[ChatRoomPage] ensureConversationId called:', {
        reason,
        currentConversationId,
        isDirectChat,
      });

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

      // If chat.id is already a backend UUID, treat it as conversationId.
      if (!isNewContact && isBackendConversationId(chatIdStr)) {
        setConversationId(chatIdStr);
        return chatIdStr;
      }

      const storedToken = authToken || (await getAccessToken());
      if (!storedToken) {
        Alert.alert('Not signed in', 'Please sign in again.');
        return null;
      }

      const peerUserId = pickPeerUserId(chat);
      const participantPhones = collectParticipantPhones(chat);

      if (!peerUserId && !participantPhones.length) {
        Alert.alert(
          'Cannot start chat',
          'No registered participant found for this contact.',
        );
        return null;
      }

      const payload = {
        ...(peerUserId ? { peer_user_id: peerUserId } : {}),
        ...(participantPhones.length
          ? { participants: [participantPhones[0]] }
          : {}),
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
          Alert.alert('Error', getRequestErrorMessage(res));
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
