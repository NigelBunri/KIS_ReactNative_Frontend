// src/screens/chat/hooks/useChatAuth.ts
import { useEffect, useState } from 'react';
import { getCache } from '@/network/cache';
import { getAccessToken } from '@/security/authStorage';
import type { ChatRoomPageProps } from '../chatTypes';

type ChatType = ChatRoomPageProps['chat'];

export function useChatAuth(chat: ChatType | undefined) {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('local-user');
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const storedToken = await getAccessToken();
        if (storedToken) {
          setAuthToken(storedToken);
        }

        const loggedIn = await getCache('AUTH_CACHE', 'USER_KEY');
        console.log('[ChatRoomPage] Loaded AUTH_CACHE / USER_KEY:', loggedIn);

        const extract = (data: any | null | undefined) => {
          if (!data) return;
          const user = data.user ?? data.profile ?? data;
          const token = data.access ?? data.access_token ?? data.token;
          const userId = user?.id ?? data.user_id ?? data.userId;
          const firstName = user?.first_name ?? user?.firstName;
          const lastName = user?.last_name ?? user?.lastName;

          if (token) setAuthToken(token);
          if (userId) setCurrentUserId(String(userId));
          if (firstName || lastName) {
            setCurrentUserName(
              [firstName, lastName].filter(Boolean).join(' ') || null,
            );
          }
        };

        if (Array.isArray(loggedIn) && loggedIn.length > 0) {
          extract(loggedIn[0]);
        } else {
          extract(loggedIn);
        }
      } catch (err) {
        console.warn('[ChatRoomPage] Failed to load auth cache', err);
      }
    };

    bootstrapAuth();
  }, [chat]);

  return {
    authToken,
    currentUserId,
    currentUserName,
  };
}
