// SocketProvider.tsx

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, AppState, DeviceEventEmitter, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { check, PERMISSIONS, request, RESULTS, openSettings } from 'react-native-permissions';
import { useAuth } from './App';
import ROUTES, { CHAT_WS_URL, CHAT_WS_PATH } from '@/network';
import { getCache } from '@/network/cache';
import { getAccessToken } from '@/security/authStorage';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { ensureDeviceId, initE2EE } from '@/security/e2ee';
import {
  loadMessages,
  bulkUpdateMessages,
  getAllRoomsWithPendingMessages,
  unmarkRoomHasPending,
} from '@/Module/ChatRoom/Storage/chatStorage';

import type {
  CallSession,
  CallParticipant,
  CallType,
  CallLayout,
  InCallMessage,
  ActiveReaction,
} from '@/services/calls/callTypes';
import { isGroupCall, hasVideo } from '@/services/calls/callTypes';
import { webRTCService, webRTCAvailable } from '@/services/calls/webRTCService';
import { audioRouteManager } from '@/services/calls/audioRouteManager';

import ActiveCallScreen from '@/screens/calls/ActiveCallScreen';
import IncomingCallScreen from '@/screens/calls/IncomingCallScreen';

/* ============================================================================
 * CONTEXT TYPE
 * ============================================================================ */

type SocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
  currentUserId?: string | null;
  typingByConversation?: Record<string, Record<string, number>>;
  /** userId → display name, populated from typing events when the backend includes senderName */
  typingDisplayNames?: Record<string, string>;
  presenceByUser?: Record<string, { isOnline: boolean; at: number }>;
  activeCall?: CallSession | null;
  startCall?: (args: StartCallArgs) => Promise<boolean>;
  answerCall?: () => Promise<void>;
  rejectCall?: (reason?: string) => Promise<void>;
  endCall?: (reason?: string) => Promise<void>;
  dismissCallUi?: () => void;
};

type StartCallArgs = {
  conversationId: string;
  title: string;
  callType?: CallType;
  media?: 'voice' | 'video';
  inviteeUserIds?: string[];
};

/* ============================================================================
 * CONTEXT
 * ============================================================================ */

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  currentUserId: null,
  typingByConversation: {},
  typingDisplayNames: {},
  presenceByUser: {},
  activeCall: null,
});

export const useSocket = () => useContext(SocketContext);

/* ============================================================================
 * HELPERS
 * ============================================================================ */

function resolveCallType(args: StartCallArgs): CallType {
  if (args.callType) return args.callType;
  const invitees = args.inviteeUserIds ?? [];
  if (invitees.length > 1) return args.media === 'video' ? 'video-group' : 'voice-group';
  return args.media === 'video' ? 'video' : 'voice';
}

function looksLikeTechnicalId(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) return true;
  if (/^(call|client|dev|msg|rxn)_[a-z0-9_-]+$/i.test(trimmed)) return true;
  if (/^[0-9a-f]{24,}$/i.test(trimmed)) return true;
  if (/^[a-z0-9]+(?:[-_.][a-z0-9]+){2,}$/i.test(trimmed) && /\d/.test(trimmed)) return true;
  return false;
}

function safeDisplayName(value: unknown, fallback: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const text = String(value).trim();
  if (!text || looksLikeTechnicalId(text)) return fallback;
  return text;
}

function makeParticipant(overrides: Partial<CallParticipant> & { userId: string }): CallParticipant {
  const displayName = safeDisplayName(overrides.displayName, overrides.isLocal ? 'You' : 'Participant');
  return {
    isLocal: false,
    isMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
    isSpeaking: false,
    networkQuality: 4,
    role: 'audience',
    handRaised: false,
    joinedAt: new Date().toISOString(),
    stream: null,
    avatarUrl: null,
    ...overrides,
    displayName,
  };
}

function makeReactionId() {
  return `rxn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/* ============================================================================
 * PROVIDER
 * ============================================================================ */

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuth } = useAuth();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [typingByConversation, setTypingByConversation] = useState<Record<string, Record<string, number>>>({});
  const [typingDisplayNames, setTypingDisplayNames] = useState<Record<string, string>>({});
  const [presenceByUser, setPresenceByUser] = useState<Record<string, { isOnline: boolean; at: number }>>({});
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const mountedRef = useRef(true);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const activeCallRef = useRef<CallSession | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const persistCallEndRef = useRef<((session: CallSession | null, state: 'ended' | 'missed') => void) | null>(null);

  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);

  /* ─── Permissions ───────────────────────────────────────────────────────── */

  const requestCallPermissions = useCallback(async (media: 'voice' | 'video' | 'voice-group' | 'video-group' | 'broadcast'): Promise<boolean> => {
    const needsVideo = media === 'video' || media === 'video-group';
    const mic = Platform.OS === 'ios' ? PERMISSIONS.IOS.MICROPHONE : PERMISSIONS.ANDROID.RECORD_AUDIO;
    const cam = Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA;

    let micStatus = await check(mic);
    if (micStatus === RESULTS.DENIED) micStatus = await request(mic);
    if (micStatus !== RESULTS.GRANTED && micStatus !== RESULTS.LIMITED) {
      Alert.alert(
        'Permission Required',
        'Microphone access is needed to make calls. Please enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => openSettings() },
        ],
      );
      return false;
    }
    if (needsVideo) {
      let camStatus = await check(cam);
      if (camStatus === RESULTS.DENIED) camStatus = await request(cam);
      if (camStatus !== RESULTS.GRANTED && camStatus !== RESULTS.LIMITED) {
        Alert.alert(
          'Permission Required',
          'Camera access is needed for video calls. Please enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openSettings() },
          ],
        );
        return false;
      }
    }
    return true;
  }, []);

  /* ─── WebRTC helpers ────────────────────────────────────────────────────── */

  const fetchAndApplyIceServers = useCallback(async () => {
    if (!webRTCAvailable) return;
    try {
      // Cap at 3 s — a slow TURN fetch must not noticeably delay call setup.
      const timeout = new Promise<null>(r => setTimeout(() => r(null), 3000));
      const fetchPromise = getRequest(ROUTES.calls.iceServers, { errorMessage: '' });
      const res = await Promise.race([fetchPromise, timeout]);
      if (!res) return; // timed out — fall back to public STUN
      const servers = (res as any)?.data?.ice_servers ?? (res as any)?.data;
      if (Array.isArray(servers) && servers.length > 0) {
        webRTCService.setIceServers(servers);
      }
    } catch {
      // Non-fatal: falls back to public STUN servers already set in webRTCService
    }
  }, []);

  const setupWebRTC = useCallback((_callType: CallType) => {
    if (!webRTCAvailable) return;
    webRTCService.setCallbacks({
      onIceCandidate: (peerId, candidate) => {
        const session = activeCallRef.current;
        if (!session || !socketRef.current) return;
        socketRef.current.emit('call.ice.candidate', {
          callId: session.callId,
          conversationId: session.conversationId,
          targetUserId: peerId,
          candidate,
        });
      },
      onRemoteTrack: (peerId, stream) => {
        setActiveCall(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            participants: prev.participants.map(p =>
              p.userId === peerId ? { ...p, stream } : p,
            ),
          };
        });
      },
      onConnectionState: (peerId, state) => {
        setActiveCall(prev => {
          if (!prev) return prev;
          if (state === 'connected') return { ...prev, state: 'active' as const };
          if (state === 'disconnected' || state === 'failed') return { ...prev, state: 'reconnecting' as const };
          return prev;
        });
      },
      onSpeaking: (peerId, speaking) => {
        setActiveCall(prev => {
          if (!prev) return prev;
          const updated = prev.participants.map(p =>
            p.userId === peerId ? { ...p, isSpeaking: speaking } : p,
          );
          const speakerId = speaking ? peerId : prev.activeSpeakerId;
          return { ...prev, participants: updated, activeSpeakerId: speakerId };
        });
      },
      onStats: (peerId, stats) => {
        setActiveCall(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            participants: prev.participants.map(p =>
              p.userId === peerId ? { ...p, networkQuality: stats.networkQuality } : p,
            ),
            networkQuality: stats.networkQuality,
          };
        });
      },
      onIceRestartNeeded: (peerId, offer) => {
        const session = activeCallRef.current;
        if (!session || !socketRef.current) return;
        socketRef.current.emit('call.sdp.offer', {
          callId: session.callId,
          conversationId: session.conversationId,
          targetUserId: peerId,
          sdp: offer,
          iceRestart: true,
        });
      },
    });
  }, []);

  const startWebRTCOffer = useCallback(async (peerId: string) => {
    if (!webRTCAvailable) return;
    const offer = await webRTCService.createOffer(peerId);
    const session = activeCallRef.current;
    if (!offer || !session || !socketRef.current) return;
    socketRef.current.emit('call.sdp.offer', {
      callId: session.callId,
      conversationId: session.conversationId,
      targetUserId: peerId,
      sdp: offer,
    });
  }, []);

  /* ─── startCall ─────────────────────────────────────────────────────────── */

  const startCall = useCallback(async (args: StartCallArgs): Promise<boolean> => {
    const s = socketRef.current;
    if (!s || !currentUserIdRef.current) {
      Alert.alert('Call unavailable', 'Connection not ready yet.');
      return false;
    }

    const callType = resolveCallType(args);
    const granted = await requestCallPermissions(callType);
    if (!granted) return false;

    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const localUserId = currentUserIdRef.current;
    const invitees = (args.inviteeUserIds ?? []).filter(id => id !== localUserId);

    // Fetch TURN credentials then start media (audio session first)
    const needsVideo = hasVideo(callType);
    await fetchAndApplyIceServers();
    audioRouteManager.start(needsVideo ? 'video' : 'voice');
    await webRTCService.startLocalStream(needsVideo);
    setupWebRTC(callType);

    const localParticipant = makeParticipant({
      userId: localUserId,
      displayName: 'You',
      isLocal: true,
      isMuted: false,
      isVideoOff: !needsVideo,
      stream: webRTCService.getLocalStream(),
      role: 'host',
    });

    const session: CallSession = {
      callId,
      conversationId: args.conversationId,
      callType,
      title: safeDisplayName(args.title, 'Call'),
      state: 'dialing',
      participants: [localParticipant],
      localUserId,
      initiatedBy: localUserId,
      startedAt: new Date().toISOString(),
      isMuted: false,
      isVideoEnabled: needsVideo,
      isSpeakerOn: needsVideo,
      isFrontCamera: true,
      isScreenSharing: false,
      layout: isGroupCall(callType) ? 'speaker' : 'gallery',
      pinnedUserId: null,
      activeSpeakerId: null,
      isControlsVisible: true,
      chatMessages: [],
      raisedHands: [],
      reactions: [],
      networkQuality: 4,
      unreadChatCount: 0,
      viewerCount: 0,
      isRecording: false,
    };

    setActiveCall(session);

    s.emit('call.offer', {
      callId,
      conversationId: args.conversationId,
      callType,
      media: needsVideo ? 'video' : 'voice',
      title: safeDisplayName(args.title, 'Call'),
      inviteeUserIds: invitees,
      createdBy: localUserId,
      startedAt: session.startedAt,
    }, (ack?: any) => {
      if (!ack?.ok) {
        setActiveCall(null);
        webRTCService.closeAll();
        audioRouteManager.stop();
        Alert.alert('Call failed', ack?.error ?? 'Unable to start the call.');
      }
    });

    DeviceEventEmitter.emit('calls.refresh');
    return true;
  }, [requestCallPermissions, setupWebRTC, fetchAndApplyIceServers]);

  /* ─── answerCall ────────────────────────────────────────────────────────── */

  const answerCall = useCallback(async () => {
    const session = activeCallRef.current;
    const s = socketRef.current;
    if (!session || !s) return;

    const granted = await requestCallPermissions(session.callType);
    if (!granted) return;

    const needsVideo = hasVideo(session.callType);
    // Fetch TURN credentials + configure audio session BEFORE getUserMedia.
    // iOS AVAudioSession must be in PlayAndRecord mode before mic is acquired.
    await fetchAndApplyIceServers();
    audioRouteManager.start(needsVideo ? 'video' : 'voice');
    await webRTCService.startLocalStream(needsVideo);
    setupWebRTC(session.callType);

    const localParticipant = makeParticipant({
      userId: session.localUserId,
      displayName: 'You',
      isLocal: true,
      isMuted: false,
      isVideoOff: !needsVideo,
      stream: webRTCService.getLocalStream(),
      role: 'audience',
    });

    setActiveCall(prev => prev ? {
      ...prev,
      state: 'connecting',
      participants: [...prev.participants.filter(p => !p.isLocal), localParticipant],
    } : prev);

    s.emit('call.answer', {
      conversationId: session.conversationId,
      callId: session.callId,
      callType: session.callType,
      media: needsVideo ? 'video' : 'voice',
    });

    // The caller creates the SDP offer when it receives call.answer.
    // The receiver must NOT proactively create offers here — doing so causes
    // WebRTC signaling glare (both peers in "have-local-offer" state simultaneously)
    // which crashes the native WebRTC layer, especially on Android.

    DeviceEventEmitter.emit('calls.refresh');
  }, [requestCallPermissions, setupWebRTC, fetchAndApplyIceServers]);

  /* ─── endCall / rejectCall ───────────────────────────────────────────────── */

  const persistCallEnd = useCallback((endedSession: CallSession | null, resolvedState: 'ended' | 'missed') => {
    if (!endedSession) return;
    const endedAt = new Date().toISOString();
    const entry = {
      id: endedSession.callId,
      callType: endedSession.callType,
      participants: endedSession.participants.map(p => ({ userId: p.userId, displayName: p.displayName })),
      startedAt: endedSession.startedAt ?? new Date().toISOString(),
      endedAt,
      durationMs: endedSession.startedAt ? Date.now() - new Date(endedSession.startedAt).getTime() : 0,
      state: resolvedState,
      title: endedSession.title,
      localUserId: endedSession.localUserId,
    };
    // Save locally
    AsyncStorage.getItem('kis.call_history').then(raw => {
      const history: any[] = raw ? JSON.parse(raw) : [];
      history.unshift(entry);
      AsyncStorage.setItem('kis.call_history', JSON.stringify(history.slice(0, 100)));
    }).catch(() => {});
    // Save to backend (fire and forget, skip missed calls)
    if (resolvedState !== 'missed') {
      postRequest(ROUTES.calls.history, {
        call_id: entry.id,
        call_type: entry.callType,
        duration_ms: entry.durationMs,
        started_at: entry.startedAt,
        ended_at: entry.endedAt,
      }, { errorMessage: '' }).catch(() => {});
    }
    // Persist in-call chat if there are messages
    const chatMessages = endedSession.chatMessages ?? [];
    if (chatMessages.length > 0) {
      const key = `kis.incall_chat.${endedSession.callId}`;
      AsyncStorage.setItem(key, JSON.stringify({
        callId: endedSession.callId,
        callType: endedSession.callType,
        title: endedSession.title,
        savedAt: new Date().toISOString(),
        messages: chatMessages,
      })).catch(() => {});
    }
  }, []);

  // Keep persistCallEndRef current so socket handlers (registered once on mount)
  // can call the stable function without stale-closure issues.
  useEffect(() => { persistCallEndRef.current = persistCallEnd; }, [persistCallEnd]);

  const endCall = useCallback(async (reason = 'ended') => {
    const session = activeCallRef.current;
    const s = socketRef.current;

    if (session && s) {
      s.emit('call.end', {
        conversationId: session.conversationId,
        callId: session.callId,
        reason,
      });
    }

    webRTCService.closeAll();
    audioRouteManager.stop();

    const resolvedState = reason === 'missed' || reason === 'rejected' || reason === 'busy' ? 'missed' : 'ended';
    persistCallEnd(session, resolvedState);

    setActiveCall(prev => prev ? {
      ...prev,
      state: resolvedState,
      reason,
      endedAt: new Date().toISOString(),
    } : prev);

    DeviceEventEmitter.emit('calls.refresh');
  }, [persistCallEnd]);

  const rejectCall = useCallback(async (reason = 'rejected') => endCall(reason), [endCall]);

  const dismissCallUi = useCallback(() => {
    setActiveCall(prev =>
      prev && (prev.state === 'ended' || prev.state === 'missed') ? null : prev,
    );
  }, []);

  /* ─── In-call actions (mute, video, speaker, flip, reactions, chat) ──────── */

  const toggleMute = useCallback(() => {
    setActiveCall(prev => {
      if (!prev) return prev;
      const next = !prev.isMuted;
      webRTCService.setMuted(next);
      return {
        ...prev,
        isMuted: next,
        participants: prev.participants.map(p =>
          p.isLocal ? { ...p, isMuted: next } : p,
        ),
      };
    });
  }, []);

  const toggleVideo = useCallback(() => {
    setActiveCall(prev => {
      if (!prev) return prev;
      const next = !prev.isVideoEnabled;
      webRTCService.setVideoEnabled(next);
      return {
        ...prev,
        isVideoEnabled: next,
        participants: prev.participants.map(p =>
          p.isLocal ? { ...p, isVideoOff: !next } : p,
        ),
      };
    });
  }, []);

  const toggleSpeaker = useCallback(() => {
    setActiveCall(prev => {
      if (!prev) return prev;
      const next = audioRouteManager.toggleSpeaker();
      return { ...prev, isSpeakerOn: next };
    });
  }, []);

  const flipCamera = useCallback(() => {
    webRTCService.switchCamera();
    setActiveCall(prev => prev ? { ...prev, isFrontCamera: !prev.isFrontCamera } : prev);
  }, []);

  const raiseHand = useCallback(() => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    const isRaised = session.raisedHands.includes(session.localUserId);
    socketRef.current.emit(isRaised ? 'call.hand.lower' : 'call.hand.raise', {
      callId: session.callId,
      conversationId: session.conversationId,
    });
    setActiveCall(prev => {
      if (!prev) return prev;
      const hands = isRaised
        ? prev.raisedHands.filter(id => id !== prev.localUserId)
        : [...prev.raisedHands, prev.localUserId];
      return { ...prev, raisedHands: hands };
    });
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.reaction', {
      callId: session.callId,
      conversationId: session.conversationId,
      emoji,
    });
    const reaction: ActiveReaction = {
      id: makeReactionId(),
      userId: session.localUserId,
      displayName: 'You',
      emoji,
      xNorm: Math.random() * 0.8 + 0.1,
      startedAt: Date.now(),
    };
    setActiveCall(prev => {
      if (!prev) return prev;
      const reactions = [...prev.reactions, reaction];
      return { ...prev, reactions };
    });
    setTimeout(() => {
      setActiveCall(prev =>
        prev ? { ...prev, reactions: prev.reactions.filter(r => r.id !== reaction.id) } : prev,
      );
    }, 3000);
  }, []);

  const sendChat = useCallback((text: string) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    const msg: InCallMessage = {
      id: `msg_${Date.now()}`,
      userId: session.localUserId,
      displayName: 'You',
      text,
      sentAt: new Date().toISOString(),
    };
    socketRef.current.emit('call.chat.message', {
      callId: session.callId,
      conversationId: session.conversationId,
      text,
    });
    setActiveCall(prev =>
      prev ? { ...prev, chatMessages: [...prev.chatMessages, msg], unreadChatCount: 0 } : prev,
    );
  }, []);

  const pinParticipant = useCallback((userId: string | null) => {
    setActiveCall(prev => prev ? { ...prev, pinnedUserId: userId } : prev);
  }, []);

  const setLayout = useCallback((layout: CallLayout) => {
    setActiveCall(prev => prev ? { ...prev, layout } : prev);
  }, []);

  const muteParticipant = useCallback((userId: string) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.participant.mute', {
      callId: session.callId,
      targetUserId: userId,
    });
  }, []);

  const removeParticipant = useCallback((userId: string) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.participant.remove', {
      callId: session.callId,
      targetUserId: userId,
    });
  }, []);

  /* ─── Socket connection ──────────────────────────────────────────────────── */

  useEffect(() => {
    mountedRef.current = true;

    let joinLiveSub: { remove: () => void } | null = null;
    let leaveLiveSub: { remove: () => void } | null = null;

    const connect = async () => {
      let token = await getAccessToken();
      const cached = await getCache('AUTH_CACHE', 'USER_KEY');
      if (!token) token = cached?.access || cached?.access_token || null;

      const extractUid = (data: any) => data?.user?.id || data?.user?.pk || null;
      const uid = Array.isArray(cached) ? extractUid(cached[0]) : extractUid(cached);
      let resolvedUserId = uid ? String(uid) : null;

      if (!resolvedUserId && token) {
        try {
          const storedPhone = await AsyncStorage.getItem('user_phone');
          const qs = storedPhone ? `?phone=${encodeURIComponent(storedPhone)}` : '';
          const res = await getRequest(`${ROUTES.auth.checkLogin}${qs}`, { errorMessage: 'Status check failed.', cacheType: 'AUTH_CACHE' });
          const u = res?.data?.user ?? res?.data ?? {};
          if (u?.id || u?.pk) resolvedUserId = String(u.id || u.pk);
        } catch {}
      }

      if (resolvedUserId) {
        setCurrentUserId(resolvedUserId);
        initE2EE(resolvedUserId).catch(() => {});
      }

      const deviceId = await ensureDeviceId();
      if (!mountedRef.current || !isAuth || !token) return;
      if (socketRef.current) return;

      const s = io(CHAT_WS_URL, {
        path: CHAT_WS_PATH,
        transports: ['websocket'],
        // Use a callback so each reconnect attempt fetches a fresh token,
        // preventing silent auth failures when the token expires mid-session.
        auth: async (cb: (data: Record<string, string>) => void) => {
          let freshToken = await getAccessToken().catch(() => null);
          if (!freshToken) freshToken = token;
          cb({ token: freshToken ?? '', deviceId });
        },
        extraHeaders: { 'x-device-id': deviceId },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 8000,
        // Low-network resilience: extend connection timeout so slow networks
        // don't fail the initial handshake. Default is 20 s.
        timeout: 30000,
      });

      socketRef.current = s;
      setSocket(s);

      s.on('connect', () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        // If we had an active call when the socket dropped, request a state sync
        // so participant list is up-to-date after reconnect.
        const session = activeCallRef.current;
        if (session && session.state !== 'ended' && session.state !== 'missed') {
          s.emit('call.sync', {
            conversationId: session.conversationId,
            callId: session.callId,
          });
        }
        // Check for a pending call notification stored while app was in background/killed.
        // The socket will receive the call.offer event naturally once connected — just
        // clear the stale notification so it isn't re-processed on the next connect.
        AsyncStorage.getItem('kis.pending_call_notification').then(raw => {
          if (!raw) return;
          AsyncStorage.removeItem('kis.pending_call_notification');
        }).catch(() => {});
      });
      s.on('disconnect', (reason) => {
        if (mountedRef.current) setIsConnected(false);
        if (__DEV__) console.log('[WS] disconnect', reason);
      });
      s.on('connect_error', (err: any) => {
        console.warn('[WS] connect_error', err?.message);
      });

      /* ── Typing ── */
      s.on('chat.typing', (payload: any) => {
        const convId = payload?.conversationId;
        const userId = payload?.userId;
        const isTyping = payload?.isTyping;
        const senderName: string | undefined = payload?.senderName ?? payload?.display_name ?? payload?.name;
        if (!convId || !userId) return;
        // Cache the display name whenever the server provides it
        if (senderName && senderName !== userId) {
          setTypingDisplayNames(prev =>
            prev[userId] === senderName ? prev : { ...prev, [userId]: senderName },
          );
        }
        setTypingByConversation(prev => {
          const next = { ...prev };
          const conv = { ...(next[convId] ?? {}) };
          if (isTyping) { conv[userId] = Date.now(); next[convId] = conv; }
          else { delete conv[userId]; if (Object.keys(conv).length) next[convId] = conv; else delete next[convId]; }
          return next;
        });
        const key = `${convId}:${userId}`;
        if (isTyping) {
          if (typingTimeoutsRef.current[key]) clearTimeout(typingTimeoutsRef.current[key]);
          typingTimeoutsRef.current[key] = setTimeout(() => {
            setTypingByConversation(prev => {
              const next = { ...prev };
              const conv = { ...(next[convId] ?? {}) };
              delete conv[userId];
              if (Object.keys(conv).length) next[convId] = conv; else delete next[convId];
              return next;
            });
            delete typingTimeoutsRef.current[key];
          }, 5000);
        }
      });

      /* ── Presence ── */
      s.on('chat.presence', (payload: any) => {
        const userId = payload?.userId;
        if (!userId) return;
        setPresenceByUser(prev => ({ ...prev, [userId]: { isOnline: !!payload?.isOnline, at: payload?.at ? Date.parse(payload.at) : Date.now() } }));
      });

      /* ── Broadcast created ── */
      s.on('broadcast.created', (payload: any) => { DeviceEventEmitter.emit('broadcast.created', payload); });

      /* ── Channel live / content events ── */
      const onChannelLiveStarted = (payload: any) => DeviceEventEmitter.emit('channel.live.started', payload);
      const onChannelLiveEnded   = (payload: any) => DeviceEventEmitter.emit('channel.live.ended', payload);
      const onChannelViewerCount = (payload: any) => DeviceEventEmitter.emit('channel.viewer.count', payload);
      const onChannelChatMessage = (payload: any) => DeviceEventEmitter.emit('channel.chat.message', payload);
      const onChannelContentPublished = (payload: any) => DeviceEventEmitter.emit('channel.content.published', payload);
      const onChannelSubscribed  = (payload: any) => DeviceEventEmitter.emit('channel.subscribed', payload);

      s.on('channel.live.started',      onChannelLiveStarted);
      s.on('channel.live.ended',        onChannelLiveEnded);
      s.on('channel.viewer.count',      onChannelViewerCount);
      s.on('channel.chat.message',      onChannelChatMessage);
      s.on('channel.content.published', onChannelContentPublished);
      s.on('channel.subscribed',        onChannelSubscribed);

      // Forward outbound live events from components to the socket server
      joinLiveSub = DeviceEventEmitter.addListener('channel.live.join', (p: any) => {
        if (s.connected) s.emit('channel.live.join', p);
      });
      leaveLiveSub = DeviceEventEmitter.addListener('channel.live.leave', (p: any) => {
        if (s.connected) s.emit('channel.live.leave', p);
      });

      /* ── CALL EVENTS ── */

      // Incoming call
      s.on('call.offer', (payload: any) => {
        const conversationId = String(payload?.conversationId ?? '');
        const callId = String(payload?.callId ?? '');
        const fromUserId = payload?.fromUserId ? String(payload.fromUserId) : null;
        if (!conversationId || !callId) return;

        // Use live ref — resolvedUserId is captured at connect time and may be stale
        const myUserId = currentUserIdRef.current ?? resolvedUserId;
        if (fromUserId && myUserId && fromUserId === myUserId) return;

        const existing = activeCallRef.current;
        if (existing && existing.callId !== callId && existing.state !== 'ended' && existing.state !== 'missed') {
          s.emit('call.end', { conversationId, callId, reason: 'busy' });
          return;
        }

        const rawType = payload?.callType ?? (payload?.media === 'video' ? 'video' : 'voice');
        const callType: CallType = rawType as CallType;

        const callerParticipant = makeParticipant({
          userId: fromUserId ?? 'caller',
          displayName: safeDisplayName(payload?.callerName ?? payload?.title, 'Caller'),
          role: 'host',
        });

        const session: CallSession = {
          callId,
          conversationId,
          callType,
          title: safeDisplayName(payload?.title ?? payload?.callerName, 'Incoming call'),
          state: 'incoming',
          participants: [callerParticipant],
          localUserId: myUserId ?? '',
          initiatedBy: fromUserId,
          startedAt: payload?.startedAt ?? new Date().toISOString(),
          isMuted: false,
          isVideoEnabled: hasVideo(callType),
          isSpeakerOn: false,
          isFrontCamera: true,
          isScreenSharing: false,
          layout: isGroupCall(callType) ? 'speaker' : 'gallery',
          pinnedUserId: null,
          activeSpeakerId: null,
          isControlsVisible: true,
          chatMessages: [],
          raisedHands: [],
          reactions: [],
          networkQuality: 4,
          unreadChatCount: 0,
          viewerCount: payload?.viewerCount ?? 0,
          isRecording: false,
        };

        // IncomingCallScreen's useEffect handles ringtone — do NOT start it here
        // to avoid a double-start that crashes InCallManager on Android.
        setActiveCall(session);
        DeviceEventEmitter.emit('calls.refresh');
      });

      // Remote answered
      s.on('call.answer', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        if (!callId) return;
        audioRouteManager.stopRingtone();
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          return { ...prev, state: 'active', startedAt: prev.startedAt ?? new Date().toISOString() };
        });
        // Initiate WebRTC offer to the answering user
        const responderId = payload?.userId ? String(payload.userId) : null;
        if (responderId && webRTCAvailable) {
          startWebRTCOffer(responderId);
          // Add participant entry
          setActiveCall(prev => {
            if (!prev || prev.callId !== callId) return prev;
            const exists = prev.participants.some(p => p.userId === responderId);
            if (exists) return prev;
            return {
              ...prev,
              participants: [...prev.participants, makeParticipant({ userId: responderId, displayName: safeDisplayName(payload?.displayName, 'Participant'), role: 'audience' })],
            };
          });
        }
        DeviceEventEmitter.emit('calls.refresh');
      });

      // WebRTC SDP offer from remote
      s.on('call.sdp.offer', async (payload: any) => {
        const fromUserId = String(payload?.fromUserId ?? '');
        const sdp = payload?.sdp;
        if (!fromUserId || !sdp) return;
        const answer = await webRTCService.handleOffer(fromUserId, sdp);
        if (answer && socketRef.current) {
          const session = activeCallRef.current;
          socketRef.current.emit('call.sdp.answer', {
            callId: session?.callId,
            conversationId: session?.conversationId,
            targetUserId: fromUserId,
            sdp: answer,
          });
        }
      });

      // WebRTC SDP answer from remote
      s.on('call.sdp.answer', async (payload: any) => {
        const fromUserId = String(payload?.fromUserId ?? '');
        const sdp = payload?.sdp;
        if (!fromUserId || !sdp) return;
        await webRTCService.handleAnswer(fromUserId, sdp);
      });

      // ICE candidate from remote
      s.on('call.ice.candidate', async (payload: any) => {
        const fromUserId = String(payload?.fromUserId ?? '');
        const candidate = payload?.candidate;
        if (!fromUserId || !candidate) return;
        await webRTCService.addIceCandidate(fromUserId, candidate);
      });

      // Legacy ICE state (backwards compat)
      s.on('call.ice', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const state = payload?.payload?.state ?? payload?.state;
        if (!callId || !state) return;
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          if (state === 'reconnecting') return { ...prev, state: 'reconnecting' };
          if (state === 'connected' && prev.state !== 'ended' && prev.state !== 'missed') return { ...prev, state: 'active' };
          return prev;
        });
      });

      // Remote ended call
      s.on('call.end', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const reason = typeof payload?.reason === 'string' ? payload.reason : 'ended';
        if (!callId) return;
        webRTCService.closePeer(String(payload?.fromUserId ?? ''));
        audioRouteManager.stopRingtone();
        const resolvedState = reason === 'missed' || reason === 'busy' || reason === 'rejected' ? 'missed' : 'ended';
        const sessionSnapshot = activeCallRef.current;
        if (sessionSnapshot && sessionSnapshot.callId === callId) {
          persistCallEndRef.current?.(sessionSnapshot, resolvedState);
        }
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          return {
            ...prev,
            state: resolvedState,
            reason,
            endedAt: payload?.endedAt ?? new Date().toISOString(),
          };
        });
        DeviceEventEmitter.emit('calls.refresh');
      });

      // Participant joined group call
      s.on('call.participant.joined', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const userId = String(payload?.userId ?? '');
        if (!callId || !userId) return;
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          if (prev.participants.some(p => p.userId === userId)) return prev;
          return {
            ...prev,
            participants: [...prev.participants, makeParticipant({
              userId,
              displayName: safeDisplayName(payload?.displayName, 'Participant'),
              role: payload?.role ?? 'audience',
            })],
          };
        });
      });

      // Participant left group call
      s.on('call.participant.left', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const userId = String(payload?.userId ?? '');
        if (!callId || !userId) return;
        webRTCService.closePeer(userId);
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          return { ...prev, participants: prev.participants.filter(p => p.userId !== userId) };
        });
      });

      // Raise hand
      s.on('call.hand.raise', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const userId = String(payload?.userId ?? '');
        if (!callId || !userId) return;
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          const hands = prev.raisedHands.includes(userId) ? prev.raisedHands : [...prev.raisedHands, userId];
          return { ...prev, raisedHands: hands };
        });
      });

      s.on('call.hand.lower', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const userId = String(payload?.userId ?? '');
        if (!callId || !userId) return;
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          return { ...prev, raisedHands: prev.raisedHands.filter(id => id !== userId) };
        });
      });

      // Remote reaction
      s.on('call.reaction', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const emoji = payload?.emoji ?? '👍';
        const userId = String(payload?.userId ?? '');
        if (!callId) return;
        const reaction: ActiveReaction = {
          id: makeReactionId(),
          userId,
          displayName: safeDisplayName(payload?.displayName, 'Participant'),
          emoji,
          xNorm: Math.random() * 0.8 + 0.1,
          startedAt: Date.now(),
        };
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          return { ...prev, reactions: [...prev.reactions, reaction] };
        });
        setTimeout(() => {
          setActiveCall(prev =>
            prev ? { ...prev, reactions: prev.reactions.filter(r => r.id !== reaction.id) } : prev,
          );
        }, 3000);
      });

      // In-call chat
      s.on('call.chat.message', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        if (!callId) return;
        const msg: InCallMessage = {
          id: `msg_${payload?.id ?? Date.now()}`,
          userId: String(payload?.userId ?? ''),
          displayName: safeDisplayName(payload?.displayName, 'Participant'),
          text: String(payload?.text ?? ''),
          sentAt: payload?.sentAt ?? new Date().toISOString(),
        };
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          return {
            ...prev,
            chatMessages: [...prev.chatMessages, msg],
            unreadChatCount: prev.unreadChatCount + 1,
          };
        });
      });

      // Participant muted by host
      s.on('call.participant.muted', (payload: any) => {
        const userId = String(payload?.targetUserId ?? '');
        if (!userId) return;
        setActiveCall(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            ...(userId === prev.localUserId ? { isMuted: true } : {}),
            participants: prev.participants.map(p =>
              p.userId === userId ? { ...p, isMuted: true } : p,
            ),
          };
        });
        if (payload?.targetUserId === currentUserIdRef.current) {
          webRTCService.setMuted(true);
        }
      });

      // Viewer count (broadcast)
      s.on('call.viewer.count', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const count = Number(payload?.count ?? 0);
        setActiveCall(prev =>
          prev && prev.callId === callId ? { ...prev, viewerCount: count } : prev,
        );
      });
    };

    connect().catch(err => console.warn('[SocketProvider] connect error:', err));

    return () => {
      mountedRef.current = false;
      webRTCService.closeAll();
      audioRouteManager.stop();
      joinLiveSub?.remove();
      leaveLiveSub?.remove();
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
  }, [isAuth, startWebRTCOffer]);

  /* ─── NetInfo-driven reconnect ───────────────────────────────────────────── */
  // When the device regains network, immediately prompt the socket to reconnect
  // instead of waiting for the next exponential-backoff timer tick.

  const socketRef2 = socketRef; // alias — socketRef already holds the socket instance
  useEffect(() => {
    let wasOnline = true;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      if (online && !wasOnline) {
        // Network just came back — kick the socket reconnect immediately
        const s = socketRef2.current;
        if (s && !s.connected) {
          s.connect();
        }
      }
      wasOnline = online;
    });
    return () => unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Global message queue flush ─────────────────────────────────────────
   * Retries pending/failed messages from ALL rooms whenever the socket
   * connects or the app comes back to the foreground — ensuring queued
   * messages are delivered even if the ChatRoom component is not mounted.
   * ─────────────────────────────────────────────────────────────────────── */

  const globalFlushRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!socket || !isConnected || !currentUserId) {
      globalFlushRef.current = null;
      return;
    }

    const flushRoom = async (roomId: string) => {
      const messages = await loadMessages(roomId);
      const pending = messages.filter(
        m => m.status === 'pending' || m.status === 'failed',
      );
      if (pending.length === 0) { await unmarkRoomHasPending(roomId); return; }
      await Promise.all(pending.map(msg =>
        new Promise<void>((resolve) => {
          socket.timeout(20000).emit(
            'chat.send',
            {
              conversationId: msg.conversationId ?? roomId,
              kind: msg.kind ?? 'text',
              clientId: msg.clientId,
              text: msg.text,
              replyToId: msg.replyToId ?? null,
              attachments: msg.attachments?.length ? msg.attachments : undefined,
              styledText: msg.styledText ?? null,
              voice: msg.voice ?? null,
              sticker: msg.sticker ?? null,
              contacts: msg.contacts,
              poll: msg.poll,
              event: msg.event,
              encrypted: false,
            },
            async (err: any, ack: any) => {
              if (!err && ack?.ok && ack?.serverId) {
                await bulkUpdateMessages(roomId, m =>
                  m.clientId === msg.clientId
                    ? { ...m, status: 'sent' as any, serverId: ack.serverId, isLocalOnly: false }
                    : m,
                );
              }
              resolve();
            },
          );
        }),
      ));
      const remaining = await loadMessages(roomId);
      if (!remaining.some(m => m.status === 'pending' || m.status === 'failed')) {
        await unmarkRoomHasPending(roomId);
      }
    };

    const flush = async () => {
      try {
        const rooms = await getAllRoomsWithPendingMessages();
        // Process rooms in parallel batches of 5 — avoids blocking the socket
        // event loop with a long sequential chain on accounts with many rooms.
        const BATCH = 5;
        for (let i = 0; i < rooms.length; i += BATCH) {
          await Promise.all(rooms.slice(i, i + BATCH).map(flushRoom));
        }
      } catch (err) {
        if (__DEV__) console.warn('[SocketProvider] global flush error', err);
      }
    };

    globalFlushRef.current = flush;
    flush(); // Run immediately on connect
  }, [socket, isConnected, currentUserId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        globalFlushRef.current?.().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  /* ─── Context value ─────────────────────────────────────────────────────── */

  const value = useMemo<SocketContextValue>(() => ({
    socket,
    isConnected,
    currentUserId,
    typingByConversation,
    typingDisplayNames,
    presenceByUser,
    activeCall,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    dismissCallUi,
  }), [socket, isConnected, currentUserId, typingByConversation, typingDisplayNames, presenceByUser, activeCall, startCall, answerCall, rejectCall, endCall, dismissCallUi]);

  /* ─── Render call screens ───────────────────────────────────────────────── */

  const isIncoming = activeCall?.state === 'incoming';
  const isActiveOrConnecting =
    activeCall && activeCall.state !== 'incoming' && activeCall.state !== null;

  return (
    <SocketContext.Provider value={value}>
      {children}

      {/* Incoming call — full-screen ringing UI */}
      {isIncoming && activeCall && (
        <IncomingCallScreen
          session={activeCall}
          onAnswer={() => { audioRouteManager.stopRingtone(); void answerCall(); }}
          onDecline={() => { audioRouteManager.stopRingtone(); void rejectCall('rejected'); }}
        />
      )}

      {/* Active / dialing / ended call — full-screen call UI */}
      {isActiveOrConnecting && activeCall && !isIncoming && (
        <ActiveCallScreen
          session={activeCall}
          actions={{
            onEnd: () => void endCall(),
            onDismiss: () => void dismissCallUi(),
            onToggleMute: toggleMute,
            onToggleVideo: toggleVideo,
            onToggleSpeaker: toggleSpeaker,
            onFlipCamera: flipCamera,
            onRaiseHand: raiseHand,
            onSendReaction: sendReaction,
            onSendChat: sendChat,
            onPinParticipant: pinParticipant,
            onSetLayout: setLayout,
            onMuteParticipant: muteParticipant,
            onRemoveParticipant: removeParticipant,
          }}
        />
      )}
    </SocketContext.Provider>
  );
};
