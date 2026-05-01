// SocketProvider.tsx

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from 'react';
import { Alert, DeviceEventEmitter, Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { check, PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import { useAuth } from './App';
import ROUTES, { CHAT_WS_URL, CHAT_WS_PATH } from '@/network';
import { getCache } from '@/network/cache';
import { getAccessToken } from '@/security/authStorage';
import { getRequest } from '@/network/get';
import { ensureDeviceId, initE2EE } from '@/security/e2ee';
import CallOverlay, {
  type CallOverlaySession,
} from '@/components/calls/CallOverlay';

/* ============================================================================
 * TYPES
 * ============================================================================
 */

type SocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
  currentUserId?: string | null;
  typingByConversation?: Record<string, Record<string, number>>;
  presenceByUser?: Record<string, { isOnline: boolean; at: number }>;
  activeCall?: CallOverlaySession | null;
  startCall?: (args: {
    conversationId: string;
    title: string;
    media: 'voice' | 'video';
    inviteeUserIds?: string[];
  }) => Promise<boolean>;
  answerCall?: () => Promise<void>;
  rejectCall?: (reason?: string) => Promise<void>;
  endCall?: (reason?: string) => Promise<void>;
  dismissCallUi?: () => void;
};

/* ============================================================================
 * CONTEXT
 * ============================================================================
 */

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  currentUserId: null,
  typingByConversation: {},
  presenceByUser: {},
  activeCall: null,
});

export const useSocket = () => useContext(SocketContext);

/* ============================================================================
 * PROVIDER
 * ============================================================================
 */

export const SocketProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { isAuth } = useAuth();

  /**
   * --------------------------------------------------------------------------
   * STATE (THIS IS THE IMPORTANT PART)
   * --------------------------------------------------------------------------
   */

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [typingByConversation, setTypingByConversation] = useState<
    Record<string, Record<string, number>>
  >({});
  const [presenceByUser, setPresenceByUser] = useState<
    Record<string, { isOnline: boolean; at: number }>
  >({});
  const [activeCall, setActiveCall] = useState<CallOverlaySession | null>(null);

  /**
   * --------------------------------------------------------------------------
   * REFS (INTERNAL ONLY)
   * --------------------------------------------------------------------------
   */

  const socketRef = useRef<Socket | null>(null);
  const mountedRef = useRef<boolean>(true);
  const typingTimeoutsRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const activeCallRef = useRef<CallOverlaySession | null>(null);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  const requestCallPermissions = useCallback(
    async (media: 'voice' | 'video') => {
      const micPermission =
        Platform.OS === 'ios'
          ? PERMISSIONS.IOS.MICROPHONE
          : PERMISSIONS.ANDROID.RECORD_AUDIO;
      const cameraPermission =
        Platform.OS === 'ios'
          ? PERMISSIONS.IOS.CAMERA
          : PERMISSIONS.ANDROID.CAMERA;

      let micStatus = await check(micPermission);
      if (micStatus === RESULTS.DENIED)
        micStatus = await request(micPermission);
      const micGranted =
        micStatus === RESULTS.GRANTED || micStatus === RESULTS.LIMITED;
      if (!micGranted) {
        Alert.alert(
          'Permission needed',
          'Microphone access is required for calls.',
        );
        return false;
      }

      if (media === 'video') {
        let cameraStatus = await check(cameraPermission);
        if (cameraStatus === RESULTS.DENIED)
          cameraStatus = await request(cameraPermission);
        const cameraGranted =
          cameraStatus === RESULTS.GRANTED || cameraStatus === RESULTS.LIMITED;
        if (!cameraGranted) {
          Alert.alert(
            'Permission needed',
            'Camera access is required for video calls.',
          );
          return false;
        }
      }

      return true;
    },
    [],
  );

  const dismissCallUi = useCallback(() => {
    setActiveCall(prev =>
      prev && (prev.state === 'ended' || prev.state === 'missed') ? null : prev,
    );
  }, []);

  const endCall = useCallback(async (reason = 'ended') => {
    const current = activeCallRef.current;
    const s = socketRef.current;
    if (!current || !s) {
      setActiveCall(null);
      return;
    }

    s.emit('call.end', {
      conversationId: current.conversationId,
      callId: current.callId,
      reason,
    });

    setActiveCall(prev =>
      prev
        ? {
            ...prev,
            state: reason === 'missed' ? 'missed' : 'ended',
            reason,
            endedAt: new Date().toISOString(),
          }
        : prev,
    );
    DeviceEventEmitter.emit('calls.refresh');
  }, []);

  const rejectCall = useCallback(
    async (reason = 'rejected') => {
      await endCall(reason);
    },
    [endCall],
  );

  const answerCall = useCallback(async () => {
    const current = activeCallRef.current;
    const s = socketRef.current;
    if (!current || !s) return;
    const granted = await requestCallPermissions(current.media);
    if (!granted) return;

    setActiveCall(prev =>
      prev
        ? {
            ...prev,
            state: 'connecting',
          }
        : prev,
    );

    s.emit('call.answer', {
      conversationId: current.conversationId,
      callId: current.callId,
      media: current.media,
    });
    DeviceEventEmitter.emit('calls.refresh');
  }, [requestCallPermissions]);

  const startCall = useCallback(
    async (args: {
      conversationId: string;
      title: string;
      media: 'voice' | 'video';
      inviteeUserIds?: string[];
    }) => {
      const s = socketRef.current;
      if (!s || !currentUserId) {
        Alert.alert(
          'Call unavailable',
          'The call connection is not ready yet.',
        );
        return false;
      }
      const granted = await requestCallPermissions(args.media);
      if (!granted) return false;

      const callId = `call_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 10)}`;
      const inviteeUserIds = Array.isArray(args.inviteeUserIds)
        ? args.inviteeUserIds.filter(id => id && id !== currentUserId)
        : [];

      setActiveCall({
        callId,
        conversationId: args.conversationId,
        media: args.media,
        title: args.title,
        state: 'dialing',
        initiatedBy: currentUserId,
        startedAt: new Date().toISOString(),
        muted: false,
        speakerOn: args.media === 'video',
        videoEnabled: args.media === 'video',
        reason: null,
      });

      s.emit(
        'call.offer',
        {
          conversationId: args.conversationId,
          callId,
          media: args.media,
          title: args.title,
          inviteeUserIds,
          createdBy: currentUserId,
          startedAt: new Date().toISOString(),
        },
        (ack?: any) => {
          if (!ack?.ok) {
            setActiveCall(null);
            Alert.alert(
              'Call failed',
              ack?.error ?? 'Unable to start the call.',
            );
          }
        },
      );
      DeviceEventEmitter.emit('calls.refresh');
      return true;
    },
    [currentUserId, requestCallPermissions],
  );

  /**
   * --------------------------------------------------------------------------
   * CONNECT / DISCONNECT
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    mountedRef.current = true;

    const connect = async () => {
      let token = await getAccessToken();
      const cached = await getCache('AUTH_CACHE', 'USER_KEY');
      if (!token) {
        token = cached?.access || cached?.access_token || null;
      }
      const extractUid = (data: any) => {
        if (!data) return null;
        return data?.user?.id || data?.user?.pk || null;
      };
      const uid = Array.isArray(cached)
        ? extractUid(cached[0])
        : extractUid(cached);
      let resolvedUserId = uid ? String(uid) : null;
      if (!resolvedUserId && token) {
        try {
          const storedPhone = await AsyncStorage.getItem('user_phone');
          const qs = storedPhone
            ? `?phone=${encodeURIComponent(storedPhone)}`
            : '';
          const res = await getRequest(`${ROUTES.auth.checkLogin}${qs}`, {
            errorMessage: 'Status check failed.',
            cacheType: 'AUTH_CACHE',
          });
          const u = res?.data?.user ?? res?.data ?? {};
          const fetchedId = u?.id || u?.pk || null;
          if (fetchedId) resolvedUserId = String(fetchedId);
        } catch (err: any) {
          console.warn('[E2EE] unable to fetch user id', err?.message ?? err);
        }
      }

      if (resolvedUserId) setCurrentUserId(resolvedUserId);
      if (resolvedUserId) {
        initE2EE(resolvedUserId).catch(err => {
          console.warn('[E2EE] init failed', err?.message ?? err);
        });
      }
      const deviceId = await ensureDeviceId();

      if (!mountedRef.current) return;
      if (!isAuth || !token) return;

      // Prevent duplicate connections
      if (socketRef.current) return;

      const s = io(CHAT_WS_URL, {
        path: CHAT_WS_PATH,
        transports: ['websocket'],
        auth: { token, deviceId },
        extraHeaders: {
          Authorization: `Bearer ${token}`,
          'x-device-id': deviceId,
        },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socketRef.current = s;
      setSocket(s); // 🔥 THIS IS THE KEY FIX

      s.on('connect', () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        console.log('[WS] connected', s.id);
      });

      s.on('disconnect', reason => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        console.log('[WS] disconnected', reason);
      });

      s.on('connect_error', err => {
        console.warn('[WS] connect_error', err?.message);
      });

      s.on('chat.typing', (payload: any) => {
        const convId = payload?.conversationId;
        const userId = payload?.userId;
        const isTyping = payload?.isTyping;
        if (!convId || !userId) return;

        setTypingByConversation(prev => {
          const next = { ...prev };
          const conv = { ...(next[convId] ?? {}) };
          if (isTyping) {
            conv[userId] = Date.now();
            next[convId] = conv;
          } else {
            delete conv[userId];
            if (Object.keys(conv).length) next[convId] = conv;
            else delete next[convId];
          }
          return next;
        });

        const key = `${convId}:${userId}`;
        if (isTyping) {
          if (typingTimeoutsRef.current[key]) {
            clearTimeout(typingTimeoutsRef.current[key]);
          }
          typingTimeoutsRef.current[key] = setTimeout(() => {
            setTypingByConversation(prev => {
              const next = { ...prev };
              const conv = { ...(next[convId] ?? {}) };
              delete conv[userId];
              if (Object.keys(conv).length) next[convId] = conv;
              else delete next[convId];
              return next;
            });
            delete typingTimeoutsRef.current[key];
          }, 5000);
        }
      });

      s.on('chat.presence', (payload: any) => {
        const userId = payload?.userId;
        if (!userId) return;
        const isOnline = !!payload?.isOnline;
        const at = payload?.at ? Date.parse(payload.at) : Date.now();
        setPresenceByUser(prev => ({
          ...prev,
          [userId]: { isOnline, at },
        }));
      });

      s.on('broadcast.created', (payload: any) => {
        DeviceEventEmitter.emit('broadcast.created', payload);
      });

      s.on('call.offer', (payload: any) => {
        const conversationId = String(payload?.conversationId ?? '');
        const callId = String(payload?.callId ?? '');
        const fromUserId = payload?.fromUserId
          ? String(payload.fromUserId)
          : null;
        if (!conversationId || !callId) return;

        if (
          fromUserId &&
          resolvedUserId &&
          fromUserId === String(resolvedUserId)
        ) {
          return;
        }

        const existing = activeCallRef.current;
        if (
          existing &&
          existing.callId !== callId &&
          existing.state !== 'ended' &&
          existing.state !== 'missed'
        ) {
          s.emit('call.end', {
            conversationId,
            callId,
            reason: 'busy',
          });
          return;
        }

        setActiveCall({
          callId,
          conversationId,
          media: payload?.media === 'video' ? 'video' : 'voice',
          title: String(payload?.title ?? 'Incoming call'),
          state: 'incoming',
          initiatedBy: fromUserId,
          startedAt: payload?.startedAt ?? new Date().toISOString(),
          muted: false,
          speakerOn: false,
          videoEnabled: payload?.media === 'video',
          reason: null,
        });
        DeviceEventEmitter.emit('calls.refresh');
      });

      s.on('call.answer', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        if (!callId) return;
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          return {
            ...prev,
            state: 'active',
            startedAt: prev.startedAt ?? new Date().toISOString(),
          };
        });
        DeviceEventEmitter.emit('calls.refresh');
      });

      s.on('call.ice', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const state = payload?.payload?.state ?? payload?.state;
        if (!callId || !state) return;
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          if (state === 'reconnecting') {
            return { ...prev, state: 'reconnecting' };
          }
          if (
            state === 'connected' &&
            prev.state !== 'ended' &&
            prev.state !== 'missed'
          ) {
            return { ...prev, state: 'active' };
          }
          return prev;
        });
      });

      s.on('call.end', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const reason =
          typeof payload?.reason === 'string' ? payload.reason : 'ended';
        if (!callId) return;
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          return {
            ...prev,
            state:
              reason === 'missed' || reason === 'busy' || reason === 'rejected'
                ? 'missed'
                : 'ended',
            reason,
            endedAt: payload?.endedAt ?? new Date().toISOString(),
          };
        });
        DeviceEventEmitter.emit('calls.refresh');
      });
    };

    connect();

    return () => {
      mountedRef.current = false;

      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      Object.values(typingTimeoutsRef.current).forEach(t => clearTimeout(t));
      typingTimeoutsRef.current = {};

      setSocket(null);
      setIsConnected(false);
      setActiveCall(null);
    };
  }, [isAuth]);

  /**
   * --------------------------------------------------------------------------
   * CONTEXT VALUE (MEMOIZED)
   * --------------------------------------------------------------------------
   */

  const value = useMemo<SocketContextValue>(
    () => ({
      socket,
      isConnected,
      currentUserId,
      typingByConversation,
      presenceByUser,
      activeCall,
      startCall,
      answerCall,
      rejectCall,
      endCall,
      dismissCallUi,
    }),
    [
      socket,
      isConnected,
      currentUserId,
      typingByConversation,
      presenceByUser,
      activeCall,
      startCall,
      answerCall,
      rejectCall,
      endCall,
      dismissCallUi,
    ],
  );

  return (
    <SocketContext.Provider value={value}>
      {children}
      <CallOverlay
        session={activeCall}
        visible={!!activeCall}
        onAnswer={() => {
          void answerCall();
        }}
        onReject={() => {
          void rejectCall();
        }}
        onEnd={() => {
          void endCall();
        }}
        onDismissEnded={dismissCallUi}
        onToggleMute={() => {
          setActiveCall(prev =>
            prev ? { ...prev, muted: !prev.muted } : prev,
          );
        }}
        onToggleSpeaker={() => {
          setActiveCall(prev =>
            prev ? { ...prev, speakerOn: !prev.speakerOn } : prev,
          );
        }}
        onToggleVideo={() => {
          setActiveCall(prev =>
            prev ? { ...prev, videoEnabled: !prev.videoEnabled } : prev,
          );
        }}
      />
    </SocketContext.Provider>
  );
};
