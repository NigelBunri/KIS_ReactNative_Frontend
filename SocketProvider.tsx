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
import { getAccessTokenForRequest } from '@/security/tokenRefresh';
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
import {
  callKeepAvailable,
  setupCallKit,
  teardownCallKit,
  displayIncomingCall,
  startOutgoingCall,
  reportCallAnswered,
  reportCallEnded,
  setMuted as callKitSetMuted,
} from '@/services/calls/callKitService';
import { sfuService, sfuAvailable } from '@/services/calls/sfuService';
import { toggleScreenShare as callServiceToggleScreenShare } from '@/services/calls/callService';
import { saveConversationCallHistory, loadConversationCallHistory } from '@/services/calls/callHistoryStorage';

// Use SFU when a group call grows beyond this threshold.
// Below it, P2P is used (lower latency, no server media).
const SFU_THRESHOLD = 4;

import ActiveCallScreen from '@/screens/calls/ActiveCallScreen';
import IncomingCallScreen from '@/screens/calls/IncomingCallScreen';
import LobbyScreen from '@/screens/calls/LobbyScreen';
import WaitingForHostScreen from '@/screens/calls/WaitingForHostScreen';
import CallMiniBadge from '@/components/calls/CallMiniBadge';
import type { VirtualBgOption } from '@/screens/calls/components/VirtualBackgroundSheet';

/* ============================================================================
 * CONTEXT TYPE
 * ============================================================================ */

type SocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
  isNetworkOnline: boolean;
  currentUserId?: string | null;
  typingByConversation?: Record<string, Record<string, number>>;
  /** userId → display name, populated from typing events when the backend includes senderName */
  typingDisplayNames?: Record<string, string>;
  presenceByUser?: Record<string, { isOnline: boolean; at: number }>;
  activeCall?: CallSession | null;
  startCall?: (args: StartCallArgs) => Promise<boolean>;
  answerCall?: () => Promise<void>;
  rejectCall?: (reason?: string) => Promise<void>;
  /** Leave without ending the call for other participants. */
  leaveCall?: () => Promise<void>;
  /** Join an already-active call started by someone else. */
  joinExistingCall?: (info: { callId: string; conversationId: string; callType: CallType; title: string }) => Promise<boolean>;
  /** End the call for ALL participants (host action). */
  endCallForAll?: () => Promise<void>;
  /** @deprecated use leaveCall or endCallForAll */
  endCall?: (reason?: string) => Promise<void>;
  dismissCallUi?: () => void;
  knockOnCall?: () => void;
  admitKnocker?: (userId: string) => void;
  denyKnocker?: (userId: string) => void;
  promoteParticipant?: (userId: string, role: string) => void;
  toggleNoiseCancellation?: () => void;
  toggleCaptions?: () => void;
  sendCaption?: (text: string) => void;
  selectVirtualBg?: (opt: VirtualBgOption) => void;
  toggleRecording?: () => void;
  createPoll?: (question: string, options: string[]) => void;
  votePoll?: (pollId: string, option: string) => void;
  closePoll?: (pollId: string) => void;
  submitQuestion?: (text: string, anonymous: boolean) => void;
  dismissQuestion?: (questionId: string) => void;
  markAnswered?: (questionId: string) => void;
  createBreakoutRooms?: (rooms: { name: string; userIds: string[] }[]) => void;
  returnToMainRoom?: () => void;
  closeBreakoutRooms?: () => void;
  startRtmp?: (url: string) => void;
  stopRtmp?: () => void;
  wbStroke?: (stroke: any) => void;
  wbUndo?: (strokeId: string) => void;
  wbClear?: () => void;
  /** Fetch or generate an invite link for the current call (all call types). */
  getCallInviteLink?: () => Promise<string | null>;
};

type StartCallArgs = {
  conversationId: string;
  title: string;
  callType?: CallType;
  media?: 'voice' | 'video';
  inviteeUserIds?: string[];
  inviteToken?: string;
};

/* ============================================================================
 * CONTEXT
 * ============================================================================ */

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  isNetworkOnline: true,
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
  const [isNetworkOnline, setIsNetworkOnline] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [typingByConversation, setTypingByConversation] = useState<Record<string, Record<string, number>>>({});
  const [typingDisplayNames, setTypingDisplayNames] = useState<Record<string, string>>({});
  const [presenceByUser, setPresenceByUser] = useState<Record<string, { isOnline: boolean; at: number }>>({});
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [callMinimised, setCallMinimised] = useState(false);

  // Listen for 'call.restore' from anywhere in the app (e.g. chat room banner)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('call.restore', () => {
      setCallMinimised(false);
    });
    return () => sub.remove();
  }, []);
  const [socketIdentityVersion, setSocketIdentityVersion] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const mountedRef = useRef(true);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const activeCallRef = useRef<CallSession | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const persistCallEndRef = useRef<((session: CallSession | null, state: 'ended' | 'missed') => void) | null>(null);
  const lastSocketRecoveryKickRef = useRef(0);
  const lastSocketConnectErrorLogRef = useRef(0);
  // Concurrency guards
  const _startingCallRef = useRef(false);
  const _answeringRef    = useRef(false);
  const _leavingRef      = useRef(false);
  const _sfuJoiningRef   = useRef(false);
  // Tracks peers we've already sent a WebRTC offer to for the current call.
  // The backend may deliver call.answer twice (conv-room broadcast + targeted
  // user-room emit to the creator), and creating a second offer on a peer that
  // is already in have-local-offer state causes WebRTC glare. Deduplicate here.
  const _offeredPeersRef = useRef<Set<string>>(new Set());
  // Active reaction timeout IDs — cancelled when the call ends to prevent stale setState
  const reactionTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Tracks whether the in-call chat sheet is open so unread count isn't incremented unnecessarily
  const callChatOpenRef = useRef(false);
  // SFU: accumulate audio+video tracks per remote peer into one MediaStream so a
  // late-arriving track doesn't overwrite (and drop) the earlier one.
  const sfuPeerStreamsRef = useRef<Map<string, any>>(new Map());

  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);

  const requestSocketRecovery = useCallback((reason: string) => {
    if (!mountedRef.current || !isAuth) return;
    const now = Date.now();
    if (now - lastSocketRecoveryKickRef.current < 5000) return;
    lastSocketRecoveryKickRef.current = now;
    if (__DEV__) console.log('[SocketProvider] socket recovery requested', reason);
    setSocketIdentityVersion((v) => v + 1);
  }, [isAuth]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('auth.device.changed', () => {
      const existing = socketRef.current;
      if (existing) {
        existing.removeAllListeners();
        existing.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setIsConnected(false);
      requestSocketRecovery('auth.device.changed');
    });
    return () => sub.remove();
  }, []);

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
        // offer is an RTCSessionDescription object — extract the SDP string
        const sdpString = typeof offer === 'string' ? offer : (offer?.sdp ?? offer);
        socketRef.current.emit('call.sdp.offer', {
          callId: session.callId,
          conversationId: session.conversationId,
          targetUserId: peerId,
          sdp: sdpString,
          iceRestart: true,
        });
      },
      onAudioOnlyChanged: (on: boolean) => {
        setActiveCall(prev => prev ? { ...prev, isAudioOnly: on } : prev);
      },
    });
  }, []);

  const startWebRTCOffer = useCallback(async (peerId: string) => {
    if (!webRTCAvailable) return;
    // Guard against duplicate call.answer deliveries creating a second offer on
    // a peer already mid-negotiation (WebRTC glare).
    if (_offeredPeersRef.current.has(peerId)) return;
    _offeredPeersRef.current.add(peerId);
    const offer = await webRTCService.createOffer(peerId);
    const session = activeCallRef.current;
    if (!offer || !session || !socketRef.current) return;
    // Backend CallSdpDto validates sdp as @IsString() — send only the SDP string,
    // not the full RTCSessionDescription object.
    const sdpString = typeof offer === 'string' ? offer : (offer?.sdp ?? offer);
    socketRef.current.emit('call.sdp.offer', {
      callId: session.callId,
      conversationId: session.conversationId,
      targetUserId: peerId,
      sdp: sdpString,
      sdpType: 'offer',
    });
  }, []);

  /* ─── startCall ─────────────────────────────────────────────────────────── */

  /**
   * joinExistingCall — enter a call that was started by someone else and is
   * already active. Unlike startCall (which emits call.offer and creates a new
   * session), this emits call.answer against the existing callId so the backend
   * routes us into the current session.
   */
  const joinExistingCall = useCallback(async (info: {
    callId: string;
    conversationId: string;
    callType: CallType;
    title: string;
  }): Promise<boolean> => {
    const s = socketRef.current;
    const myUserId = currentUserIdRef.current;
    if (!s || !myUserId) {
      Alert.alert('Join unavailable', 'Connection not ready yet.');
      return false;
    }
    if (_answeringRef.current) return false;
    _answeringRef.current = true;

    const granted = await requestCallPermissions(info.callType);
    if (!granted) { _answeringRef.current = false; return false; }

    const needsVideo = hasVideo(info.callType);
    await fetchAndApplyIceServers();
    audioRouteManager.start(needsVideo ? 'video' : 'voice');
    await webRTCService.startLocalStream(needsVideo);
    _offeredPeersRef.current.clear();
    setupWebRTC(info.callType);

    const localParticipant = makeParticipant({
      userId: myUserId,
      displayName: 'You',
      isLocal: true,
      isMuted: false,
      isVideoOff: !needsVideo,
      stream: webRTCService.getLocalStream(),
      role: 'audience',
    });

    const session: CallSession = {
      callId: info.callId,
      conversationId: info.conversationId,
      callType: info.callType,
      title: safeDisplayName(info.title, 'Call'),
      state: 'connecting',
      participants: [localParticipant],
      localUserId: myUserId,
      initiatedBy: null,      // we don't know the initiator here; not needed
      startedAt: new Date().toISOString(),
      isMuted: false,
      isVideoEnabled: needsVideo,
      isSpeakerOn: needsVideo,
      isFrontCamera: true,
      isScreenSharing: false,
      layout: isGroupCall(info.callType) ? 'speaker' : 'gallery',
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
      knockingUsers: [],
      isAudioOnly: false,
      isNoiseCancellationOn: true,
    };

    setCallMinimised(false);
    setActiveCall(session);
    reportCallAnswered(info.callId);

    s.emit('call.answer', {
      conversationId: info.conversationId,
      callId: info.callId,
      callType: info.callType,
      media: needsVideo ? 'video' : 'voice',
    });

    _answeringRef.current = false;
    DeviceEventEmitter.emit('calls.refresh');
    return true;
  }, [requestCallPermissions, setupWebRTC, fetchAndApplyIceServers]);

  const clearReactionTimeouts = useCallback(() => {
    reactionTimeoutsRef.current.forEach(t => clearTimeout(t));
    reactionTimeoutsRef.current = [];
  }, []);

  const startCall = useCallback(async (args: StartCallArgs): Promise<boolean> => {
    const s = socketRef.current;
    if (!s || !currentUserIdRef.current) {
      Alert.alert('Call unavailable', 'Connection not ready yet.');
      return false;
    }
    // Guard: prevent double-tap or programmatic double-start
    if (_startingCallRef.current) return false;
    if (activeCallRef.current && activeCallRef.current.state !== 'ended' && activeCallRef.current.state !== 'missed') {
      Alert.alert('Already in a call', 'End the current call before starting a new one.');
      return false;
    }
    _startingCallRef.current = true;

    const callType = resolveCallType(args);
    const granted = await requestCallPermissions(callType);
    if (!granted) { _startingCallRef.current = false; return false; }

    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const localUserId = currentUserIdRef.current;
    const invitees = (args.inviteeUserIds ?? []).filter(id => id !== localUserId);

    // Fetch TURN credentials then start media (audio session first)
    const needsVideo = hasVideo(callType);
    await fetchAndApplyIceServers();
    audioRouteManager.start(needsVideo ? 'video' : 'voice');
    await webRTCService.startLocalStream(needsVideo);
    _offeredPeersRef.current.clear();
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
      isStandalone: args.conversationId.startsWith('standalone:'),
      inviteToken: args.inviteToken ?? null,
      inviteLink: args.inviteToken
        ? `kisapp://call/join/${args.inviteToken}`
        : null,
      knockingUsers: [],
      isAudioOnly: false,
      isNoiseCancellationOn: true,
    };

    setCallMinimised(false);
    setActiveCall(session);

    // Register outgoing call with the OS call system
    startOutgoingCall({ callUUID: callId, callerName: safeDisplayName(args.title, 'Call'), callType });

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
      _startingCallRef.current = false;
      if (!ack?.ok) {
        setActiveCall(null);
        webRTCService.closeAll();
        audioRouteManager.stop();
        Alert.alert('Call failed', ack?.error ?? 'Unable to start the call.');
      }
    });

    // Release lock after a safety timeout in case the server never ACKs
    setTimeout(() => { _startingCallRef.current = false; }, 8000);

    DeviceEventEmitter.emit('calls.refresh');
    return true;
  }, [requestCallPermissions, setupWebRTC, fetchAndApplyIceServers]);

  /* ─── answerCall ────────────────────────────────────────────────────────── */

  const answerCall = useCallback(async () => {
    const session = activeCallRef.current;
    const s = socketRef.current;
    if (!session || !s) return;
    if (_answeringRef.current) return; // CallKit + in-app both fired
    _answeringRef.current = true;

    const granted = await requestCallPermissions(session.callType);
    if (!granted) { _answeringRef.current = false; return; }

    const needsVideo = hasVideo(session.callType);
    // Fetch TURN credentials + configure audio session BEFORE getUserMedia.
    // iOS AVAudioSession must be in PlayAndRecord mode before mic is acquired.
    await fetchAndApplyIceServers();
    audioRouteManager.start(needsVideo ? 'video' : 'voice');
    await webRTCService.startLocalStream(needsVideo);
    _offeredPeersRef.current.clear();
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

    reportCallAnswered(session.callId);

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

    _answeringRef.current = false;
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
    // Write to the unified callHistoryStorage (correct key: KIS_CALL_HISTORY_BY_USER_V1:{uid}).
    // This is what CallsTab and ChatRoomPage both read from, so a single write keeps
    // both in sync and survives app reload without a server round-trip.
    if (endedSession.localUserId) {
      const uid = endedSession.localUserId;
      const cid = endedSession.conversationId ?? '';
      const convItem = {
        callId: endedSession.callId,
        conversationId: cid,
        callType: endedSession.callType,
        status: resolvedState === 'missed' ? 'missed' : 'completed',
        startedAt: entry.startedAt,
        endedAt,
        duration: Math.round(entry.durationMs / 1000),
        createdBy: endedSession.initiatedBy ?? uid,
        title: endedSession.title,
        participantCount: endedSession.participants.length,
      };
      if (cid) {
        // Merges into both the per-conversation key AND the global key atomically.
        loadConversationCallHistory(uid, cid)
          .then((existing) => saveConversationCallHistory(uid, cid, [convItem as any, ...existing]))
          .catch(() => {});
      } else {
        // Standalone call — no conversationId, write to global key only.
        import('@/services/calls/callHistoryStorage').then(({ loadCallHistory: load, saveCallHistory: save }) =>
          load(uid).then((existing) => save(uid, [convItem as any, ...existing]))
        ).catch(() => {});
      }
    }
    // Also keep kis.call_history (legacy key) for CallHistoryScreen backward compat.
    AsyncStorage.getItem('kis.call_history').then(raw => {
      let history: any[] = [];
      if (raw) { try { history = JSON.parse(raw); } catch { history = []; } }
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
    // Tear down SFU resources too — if the call had escalated to the SFU, leaving
    // them open leaks mediasoup transports/producers/consumers on the client.
    if (sfuService.isJoined) sfuService.close();
    sfuPeerStreamsRef.current.clear();
    audioRouteManager.stop();

    const resolvedState = reason === 'missed' || reason === 'rejected' || reason === 'busy' ? 'missed' : 'ended';
    persistCallEnd(session, resolvedState);
    reportCallEnded(session?.callId ?? '', resolvedState === 'missed' ? 'rejected' : 'ended');

    setActiveCall(prev => prev ? {
      ...prev,
      state: resolvedState,
      reason,
      endedAt: new Date().toISOString(),
    } : prev);

    DeviceEventEmitter.emit('calls.refresh');
  }, [persistCallEnd]);

  const rejectCall = useCallback(async (reason = 'rejected') => endCall(reason), [endCall]);

  /**
   * leaveCall — this participant exits without ending the session for others.
   * Emits call.leave (new event) so the server only removes this user.
   * The call continues for remaining participants.
   */
  const leaveCall = useCallback(async () => {
    if (_leavingRef.current) return; // prevent double-leave
    const session = activeCallRef.current;
    if (!session || session.state === 'ended' || session.state === 'missed') return;
    _leavingRef.current = true;

    const s = socketRef.current;
    if (session && s) {
      s.emit('call.leave', {
        conversationId: session.conversationId,
        callId: session.callId,
      });
    }

    clearReactionTimeouts();
    webRTCService.closeAll();
    if (sfuService.isJoined) sfuService.close();
    sfuPeerStreamsRef.current.clear();
    audioRouteManager.stop();
    persistCallEnd(session, 'ended');
    reportCallEnded(session?.callId ?? '', 'ended');

    setActiveCall(prev => prev ? {
      ...prev,
      state: 'ended',
      reason: 'left',
      endedAt: new Date().toISOString(),
    } : prev);

    _leavingRef.current = false;
    _startingCallRef.current = false;
    _answeringRef.current = false;
    _sfuJoiningRef.current = false;
    DeviceEventEmitter.emit('calls.refresh');
  }, [persistCallEnd, clearReactionTimeouts]);

  /**
   * endCallForAll — host ends the session for every participant.
   * Emits call.end so the backend broadcasts call.end to the entire conv room.
   */
  const endCallForAll = useCallback(async () => {
    if (_leavingRef.current) return;
    const session = activeCallRef.current;
    if (!session || session.state === 'ended' || session.state === 'missed') return;
    _leavingRef.current = true;

    const s = socketRef.current;
    if (session && s) {
      s.emit('call.end', {
        conversationId: session.conversationId,
        callId: session.callId,
        reason: 'ended_by_host',
      });
    }

    clearReactionTimeouts();
    webRTCService.closeAll();
    if (sfuService.isJoined) sfuService.close();
    sfuPeerStreamsRef.current.clear();
    audioRouteManager.stop();
    persistCallEnd(session, 'ended');
    reportCallEnded(session?.callId ?? '', 'ended');

    setActiveCall(prev => prev ? {
      ...prev,
      state: 'ended',
      reason: 'ended_by_host',
      endedAt: new Date().toISOString(),
    } : prev);

    _leavingRef.current = false;
    _startingCallRef.current = false;
    _answeringRef.current = false;
    _sfuJoiningRef.current = false;
    DeviceEventEmitter.emit('calls.refresh');
  }, [persistCallEnd, clearReactionTimeouts]);

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
      if (sfuService.isJoined) sfuService.setTrackEnabled('audio', !next);
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
      if (sfuService.isJoined) sfuService.setTrackEnabled('video', next);
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
    const t = setTimeout(() => {
      reactionTimeoutsRef.current = reactionTimeoutsRef.current.filter(x => x !== t);
      setActiveCall(prev =>
        prev ? { ...prev, reactions: prev.reactions.filter(r => r.id !== reaction.id) } : prev,
      );
    }, 3000);
    reactionTimeoutsRef.current.push(t);
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
      conversationId: session.conversationId,
      targetUserId: userId,
    });
  }, []);

  const removeParticipant = useCallback((userId: string) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.participant.remove', {
      callId: session.callId,
      conversationId: session.conversationId,
      targetUserId: userId,
    });
  }, []);

  const inviteToCall = useCallback((userIds: string[]) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.invite', {
      callId: session.callId,
      conversationId: session.conversationId,
      inviteeUserIds: userIds,
    });
  }, []);

  /**
   * Generate (or fetch cached) an invite link for the current call.
   * Works for all call types — not just standalone calls.
   * Stores the result on the active session so subsequent taps are instant.
   */
  const getCallInviteLink = useCallback(async (): Promise<string | null> => {
    const session = activeCallRef.current;
    if (!session) return null;
    // Already have one — return immediately.
    if (session.inviteLink) return session.inviteLink;
    if (session.inviteToken) {
      const link = `kis://call/join/${session.inviteToken}`;
      setActiveCall(prev => prev ? { ...prev, inviteLink: link } : prev);
      return link;
    }
    try {
      const res = await postRequest(ROUTES.calls.inviteLink, {
        conversation_id: session.conversationId,
        call_id: session.callId,
      }, { errorMessage: '' });
      if (res?.success && res.data?.inviteLink) {
        const { inviteLink, inviteToken } = res.data;
        setActiveCall(prev => prev ? { ...prev, inviteLink, inviteToken } : prev);
        return inviteLink as string;
      }
    } catch {}
    return null;
  }, []);

  const knockOnCall = useCallback(() => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    const myUserId = currentUserIdRef.current;
    socketRef.current.emit('call.knock', {
      callId: session.callId,
      conversationId: session.conversationId,
      displayName: myUserId ?? 'Guest',
    });
    setActiveCall(prev => prev ? { ...prev, state: 'knocking' } : prev);
  }, []);

  const admitKnocker = useCallback((userId: string) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.knock.admit', {
      callId: session.callId,
      conversationId: session.conversationId,
      targetUserId: userId,
    });
    setActiveCall(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        knockingUsers: (prev.knockingUsers ?? []).filter(u => u.userId !== userId),
      };
    });
  }, []);

  const denyKnocker = useCallback((userId: string) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.knock.deny', {
      callId: session.callId,
      conversationId: session.conversationId,
      targetUserId: userId,
    });
    setActiveCall(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        knockingUsers: (prev.knockingUsers ?? []).filter(u => u.userId !== userId),
      };
    });
  }, []);

  const promoteParticipant = useCallback((userId: string, role: string) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.promote', {
      callId: session.callId,
      conversationId: session.conversationId,
      targetUserId: userId,
      role,
    });
  }, []);

  const toggleNoiseCancellation = useCallback(() => {
    setActiveCall(prev => {
      if (!prev) return prev;
      const next = !(prev.isNoiseCancellationOn !== false);
      webRTCService.setNoiseCancellation(next);
      return { ...prev, isNoiseCancellationOn: next };
    });
  }, []);

  const toggleCaptions = useCallback(() => {
    setActiveCall(prev => prev ? { ...prev, captionsEnabled: !prev.captionsEnabled, captions: prev.captions ?? [] } : prev);
  }, []);

  const sendCaption = useCallback((text: string) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.caption', {
      callId: session.callId,
      conversationId: session.conversationId,
      text,
    });
  }, []);

  const selectVirtualBg = useCallback((_opt: VirtualBgOption) => {
    setActiveCall(prev => prev ? { ...prev, virtualBgEnabled: _opt.mode !== 'none', virtualBgUri: _opt.uri ?? null } : prev);
  }, []);

  const toggleRecording = useCallback(() => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    const isRecording = session.recordingState === 'recording';
    socketRef.current.emit(isRecording ? 'call.recording.stop' : 'call.recording.start', {
      callId: session.callId, conversationId: session.conversationId,
    });
  }, []);

  const createPoll = useCallback((question: string, options: string[]) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.poll.create', {
      callId: session.callId, conversationId: session.conversationId, question, options,
    });
  }, []);

  const votePoll = useCallback((pollId: string, option: string) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.poll.vote', {
      callId: session.callId, conversationId: session.conversationId, pollId, option,
    });
    setActiveCall(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        polls: (prev.polls ?? []).map(p =>
          p.pollId === pollId ? { ...p, votes: { ...p.votes, [prev.localUserId]: option }, myVote: option } : p,
        ),
      };
    });
  }, []);

  const closePoll = useCallback((pollId: string) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.poll.close', {
      callId: session.callId, conversationId: session.conversationId, pollId,
    });
  }, []);

  const submitQuestion = useCallback((text: string, anonymous: boolean) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.question.submit', {
      callId: session.callId, conversationId: session.conversationId, text, anonymous,
    });
  }, []);

  const dismissQuestion = useCallback((questionId: string) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.question.dismiss', {
      callId: session.callId, conversationId: session.conversationId, questionId,
    });
  }, []);

  const markAnswered = useCallback((questionId: string) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.question.answered', {
      callId: session.callId, conversationId: session.conversationId, questionId,
    });
  }, []);

  const createBreakoutRooms = useCallback((rooms: { name: string; userIds: string[] }[]) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.breakout.create', {
      callId: session.callId, conversationId: session.conversationId, rooms,
    });
  }, []);

  const returnToMainRoom = useCallback(() => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.breakout.return', {
      callId: session.callId, conversationId: session.conversationId,
    });
    setActiveCall(prev => prev ? { ...prev, myBreakoutRoomId: null } : prev);
  }, []);

  const closeBreakoutRooms = useCallback(() => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.breakout.close', {
      callId: session.callId, conversationId: session.conversationId,
    });
    setActiveCall(prev => prev ? { ...prev, breakoutRooms: [], myBreakoutRoomId: null } : prev);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const session = activeCallRef.current;
    const s = socketRef.current;
    if (!session || !s) return;
    // Actually capture the screen (or fall back to camera) and replace the video
    // sender track in every peer connection. callServiceToggleScreenShare also
    // emits call.screen_share with the correct { conversationId, enabled } shape,
    // so we must NOT emit it again here (that would double-signal and could leave
    // the remote state inconsistent with the actual track that was swapped).
    const peerIds = session.participants.filter(p => !p.isLocal).map(p => p.userId);
    let next: boolean;
    try {
      next = await callServiceToggleScreenShare(session.conversationId, s, peerIds);
    } catch (e) {
      console.warn('[SocketProvider] toggleScreenShare failed', e);
      return;
    }
    setActiveCall(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        isScreenSharing: next,
        participants: prev.participants.map(p =>
          p.isLocal ? { ...p, isScreenSharing: next } : p,
        ),
      };
    });
  }, []);

  const startRtmp = useCallback((rtmpUrl: string) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.rtmp.start', {
      callId: session.callId, conversationId: session.conversationId, rtmpUrl,
    });
  }, []);

  const stopRtmp = useCallback(() => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.rtmp.stop', {
      callId: session.callId, conversationId: session.conversationId,
    });
  }, []);

  const wbStroke = useCallback((stroke: any) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.wb.stroke', {
      callId: session.callId, conversationId: session.conversationId, stroke,
    });
    setActiveCall(prev => prev ? {
      ...prev,
      whiteboardStrokes: [...(prev.whiteboardStrokes ?? []), stroke],
    } : prev);
  }, []);

  const wbUndo = useCallback((strokeId: string) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.wb.undo', {
      callId: session.callId, conversationId: session.conversationId, strokeId,
    });
    setActiveCall(prev => prev ? {
      ...prev,
      whiteboardStrokes: (prev.whiteboardStrokes ?? []).filter(s => s.id !== strokeId),
    } : prev);
  }, []);

  const wbClear = useCallback(() => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.wb.clear', {
      callId: session.callId, conversationId: session.conversationId,
    });
    setActiveCall(prev => prev ? { ...prev, whiteboardStrokes: [] } : prev);
  }, []);

  const wbCursor = useCallback((x: number, y: number) => {
    const session = activeCallRef.current;
    if (!session || !socketRef.current) return;
    socketRef.current.emit('call.wb.cursor', {
      callId: session.callId, conversationId: session.conversationId, x, y,
    });
  }, []);

  /* ─── CallKit setup ─────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!callKeepAvailable) return;
    setupCallKit({
      onAnswerCall: (callUUID) => {
        // User answered from lock screen — trigger the in-app answer flow
        const session = activeCallRef.current;
        if (session && session.callId === callUUID) void answerCall();
      },
      onEndCall: (callUUID) => {
        const session = activeCallRef.current;
        if (session && session.callId === callUUID) void leaveCall();
      },
      onToggleMute: (muted) => {
        webRTCService.setMuted(muted);
        setActiveCall(prev => prev ? { ...prev, isMuted: muted } : prev);
        callKitSetMuted(activeCallRef.current?.callId ?? '', muted);
      },
      onToggleHold: () => { /* hold not implemented */ },
    });
    return () => teardownCallKit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Socket connection ──────────────────────────────────────────────────── */

  useEffect(() => {
    mountedRef.current = true;

    let joinLiveSub: { remove: () => void } | null = null;
    let leaveLiveSub: { remove: () => void } | null = null;

    const connect = async () => {
      const netState = await NetInfo.fetch().catch(() => null);
      const online = !!(netState?.isConnected && netState.isInternetReachable !== false);
      setIsNetworkOnline(online);
      if (!online) {
        setIsConnected(false);
        return;
      }

      let token = await getAccessTokenForRequest();
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
          let freshToken = await getAccessTokenForRequest().catch(() => null);
          if (!freshToken) freshToken = token;
          cb({ token: freshToken ?? '', deviceId });
        },
        extraHeaders: { 'x-device-id': deviceId },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 8000,
        // Fail fast when there is no route. Slow real networks still reconnect
        // via backoff and queued messages flush when NetInfo reports recovery.
        timeout: 8000,
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
        const now = Date.now();
        if (now - lastSocketConnectErrorLogRef.current > 30000) {
          lastSocketConnectErrorLogRef.current = now;
          console.warn('[WS] connect_error', err?.message, {
            url: CHAT_WS_URL,
            path: CHAT_WS_PATH,
          });
        }
        if (!mountedRef.current) return;
        setIsConnected(false);
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

      /* ── Global chat message forwarder (for feed comment count updates) ── */
      const onGlobalChatMessage = (payload: any) => DeviceEventEmitter.emit('chat.message.global', payload);
      s.on('chat.message', onGlobalChatMessage);

      /* ── Post reaction/engagement updates ── */
      const onPostReactionUpdated = (payload: any) => DeviceEventEmitter.emit('post.reaction_updated', payload);
      const onPostCommentCount = (payload: any) => DeviceEventEmitter.emit('post.comment_count', payload);
      s.on('post.reaction_updated', onPostReactionUpdated);
      s.on('post.comment_count', onPostCommentCount);

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

        // Group and broadcast calls go through the lobby first for camera/mic preview.
        // 1:1 voice/video go straight to the incoming ring screen.
        const useLobby = isGroupCall(callType);

        const session: CallSession = {
          callId,
          conversationId,
          callType,
          title: safeDisplayName(payload?.title ?? payload?.callerName, 'Incoming call'),
          state: useLobby ? 'lobby' : 'incoming',
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
          knockingUsers: [],
          isAudioOnly: false,
          isNoiseCancellationOn: true,
        };

        // Capture waiting-for-host state BEFORE overwriting it with setActiveCall.
        // activeCallRef.current is still the previous session here since the ref
        // is only synced via a useEffect (asynchronous). After setActiveCall the
        // ref would point to the new session, making the check always false.
        const wasWaiting = activeCallRef.current?.state === 'waiting-for-host' &&
          activeCallRef.current?.conversationId === conversationId;

        // IncomingCallScreen's useEffect handles ringtone — do NOT start it here
        // to avoid a double-start that crashes InCallManager on Android.
        setActiveCall(session);
        DeviceEventEmitter.emit('calls.refresh');

        // If local user was waiting for this host, auto-answer immediately.
        if (wasWaiting) {
          void answerCall();
          return;
        }

        // Show OS lock-screen call UI (CallKit on iOS, ConnectionService on Android)
        displayIncomingCall({
          callUUID: callId,
          callerName: safeDisplayName(payload?.title ?? payload?.callerName, 'Incoming call'),
          callType: callType,
        });
      });

      // Remote answered — broadcast by backend to the entire conv room.
      //
      // IMPORTANT: Only the call INITIATOR should react with a state transition
      // and WebRTC setup. All other participants (still on LobbyScreen /
      // IncomingCallScreen) must individually choose to join. They receive
      // call.answer only to update their participant count, not to auto-join.
      s.on('call.answer', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        if (!callId) return;

        const myUserId = currentUserIdRef.current ?? resolvedUserId;
        // The backend broadcasts call.answer with the responder identified by
        // `fromUserId` (and `acceptedBy`). Older payloads used `userId`. Read all
        // three so the caller can reliably create the WebRTC offer to the joiner.
        const responderId = payload?.fromUserId
          ? String(payload.fromUserId)
          : payload?.acceptedBy
            ? String(payload.acceptedBy)
            : payload?.userId
              ? String(payload.userId)
              : null;

        // Don't process our own answer echo
        if (responderId && responderId === myUserId) return;

        const session = activeCallRef.current;
        if (!session || session.callId !== callId) return;

        const isInitiator = session.initiatedBy === myUserId;

        if (isInitiator) {
          // ── Caller side ──────────────────────────────────────────────────────
          // Someone answered. Stop the ringback, transition to active, and
          // create the WebRTC peer offer to the person who just joined.
          audioRouteManager.stopRingback();
          setActiveCall(prev => {
            if (!prev || prev.callId !== callId) return prev;
            return {
              ...prev,
              state: 'active',
              startedAt: prev.startedAt ?? new Date().toISOString(),
            };
          });
          if (responderId && webRTCAvailable) {
            startWebRTCOffer(responderId);
            setActiveCall(prev => {
              if (!prev || prev.callId !== callId) return prev;
              const exists = prev.participants.some(p => p.userId === responderId);
              if (exists) return prev;
              return {
                ...prev,
                participants: [
                  ...prev.participants,
                  makeParticipant({
                    userId: responderId,
                    displayName: safeDisplayName(payload?.displayName, 'Participant'),
                    role: 'audience',
                  }),
                ],
              };
            });
          }
        } else if (
          session.state === 'active' ||
          session.state === 'connecting' ||
          session.state === 'reconnecting'
        ) {
          // ── Already-active participant side ───────────────────────────────────
          // We are already in the call. We MUST create a WebRTC peer offer to the
          // new joiner just like the initiator does — this is required for the
          // P2P mesh. Without this, the new participant can only reach the
          // initiator but not anyone else already in the call.
          if (responderId) {
            if (webRTCAvailable) {
              startWebRTCOffer(responderId);
            }
            setActiveCall(prev => {
              if (!prev || prev.callId !== callId) return prev;
              const exists = prev.participants.some(p => p.userId === responderId);
              if (exists) return prev;
              return {
                ...prev,
                participants: [
                  ...prev.participants,
                  makeParticipant({
                    userId: responderId,
                    displayName: safeDisplayName(payload?.displayName, 'Participant'),
                    role: 'audience',
                  }),
                ],
              };
            });
          }
        }
        // else: still on LobbyScreen / IncomingCallScreen — do nothing.
        // The participant list will be updated via call.participant.joined which
        // arrives separately, and the lobby count refreshes from that.

        DeviceEventEmitter.emit('calls.refresh');
      });

      // WebRTC SDP offer from remote
      s.on('call.sdp.offer', async (payload: any) => {
        const fromUserId = String(payload?.fromUserId ?? '');
        const sdp = payload?.sdp;
        if (!fromUserId || !sdp) return;

        // Group-mesh fix: when we JOIN a call that already has participants, the
        // existing members each send us an SDP offer. They are NOT announced to us
        // via call.participant.joined (that only fires for members who join AFTER us),
        // and the backend sends no participant snapshot on initial join. If we don't
        // register them here, onRemoteTrack() drops their media stream (it only
        // updates participants already in the list), so their audio/video never
        // renders. Ensure every peer that offers to us has a participant tile.
        const myUserId = currentUserIdRef.current ?? resolvedUserId;
        if (fromUserId !== myUserId) {
          setActiveCall(prev => {
            if (!prev) return prev;
            if (prev.participants.some(p => p.userId === fromUserId)) return prev;
            return {
              ...prev,
              participants: [
                ...prev.participants,
                makeParticipant({
                  userId: fromUserId,
                  displayName: safeDisplayName(payload?.displayName, 'Participant'),
                  role: 'audience',
                }),
              ],
            };
          });
        }

        const answer = await webRTCService.handleOffer(fromUserId, sdp);
        if (answer && socketRef.current) {
          const session = activeCallRef.current;
          // Backend CallSdpDto validates sdp as @IsString() — extract SDP string
          const answerSdpString = typeof answer === 'string' ? answer : (answer?.sdp ?? answer);
          socketRef.current.emit('call.sdp.answer', {
            callId: session?.callId,
            conversationId: session?.conversationId,
            targetUserId: fromUserId,
            sdp: answerSdpString,
            sdpType: 'answer',
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
        const payloadCallId = payload?.callId ? String(payload.callId) : null;
        if (!fromUserId || !candidate) return;
        // Drop candidates that arrived after we already ended this call
        const cur = activeCallRef.current;
        if (!cur || cur.state === 'ended' || cur.state === 'missed') return;
        if (payloadCallId && cur.callId !== payloadCallId) return;
        await webRTCService.addIceCandidate(fromUserId, candidate);
      });

      // ICE restart request from remote peer
      s.on('call.ice.restart', async (payload: any) => {
        const fromUserId = String(payload?.fromUserId ?? '');
        if (!fromUserId || !webRTCAvailable) return;
        // Create a new offer with iceRestart:true to re-negotiate ICE with this peer
        const offer = await webRTCService.createOffer(fromUserId);
        const session = activeCallRef.current;
        if (!offer || !session || !socketRef.current) return;
        const sdpString = typeof offer === 'string' ? offer : (offer?.sdp ?? offer);
        socketRef.current.emit('call.sdp.offer', {
          callId: session.callId,
          conversationId: session.conversationId,
          targetUserId: fromUserId,
          sdp: sdpString,
          sdpType: 'offer',
          iceRestart: true,
        });
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
        // 'cancelled' / 'ended_by_host' arriving while we never answered = missed call for us.
        const weNeverAnswered = activeCallRef.current?.state === 'incoming' ||
          activeCallRef.current?.state === 'lobby' ||
          activeCallRef.current?.state === 'dialing' ||
          activeCallRef.current?.state === 'connecting';
        const resolvedState =
          reason === 'missed' || reason === 'busy' || reason === 'rejected' ||
          reason === 'cancelled' || (reason === 'ended_by_host' && weNeverAnswered)
            ? 'missed'
            : 'ended';
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
      s.on('call.participant.joined', async (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const userId = String(payload?.userId ?? '');
        if (!callId || !userId) return;

        // Add the new participant to the list for everyone (including lobby
        // participants who haven't joined yet — this updates their count display).
        // Do NOT change the local call state here; each user must click to join.
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

        // SFU threshold check — only upgrade to SFU if WE are already active in the call.
        // If we're still in lobby/incoming/knocking state we don't have a local stream yet.
        const session = activeCallRef.current;
        const weAreActive = session?.state === 'active' ||
                            session?.state === 'connecting' ||
                            session?.state === 'reconnecting';
        if (
          weAreActive &&
          sfuAvailable &&
          session &&
          session.callId === callId &&
          !sfuService.isJoined &&
          !_sfuJoiningRef.current &&
          session.participants.length >= SFU_THRESHOLD &&
          isGroupCall(session.callType)
        ) {
          _sfuJoiningRef.current = true;
          try {
            const localStream = webRTCService.getLocalStream();
            // Close existing P2P connections before joining SFU — but KEEP the
            // local stream alive (closeAll() would stop its tracks, leaving the
            // SFU to produce dead tracks and silence/blank the local participant).
            webRTCService.closePeersOnly();
            await sfuService.join(
              s,
              session.callId,
              session.conversationId,
              localStream,
              (peerId, track, _kind) => {
                // A peer produces audio AND video as SEPARATE producers, so this
                // callback fires once per kind. Accumulate tracks per peer into a
                // single MediaStream — otherwise the second track to arrive
                // overwrites the first and the participant loses either audio or
                // video. Prefer a real RNW MediaStream (so RTCView.streamURL works);
                // fall back to a lightweight multi-track stub when unavailable.
                const existing = sfuPeerStreamsRef.current.get(peerId);
                let stream: any = existing;
                if (stream && typeof stream.addTrack === 'function') {
                  try { stream.addTrack(track); } catch {}
                } else if (stream && Array.isArray(stream._tracks)) {
                  stream._tracks.push(track);
                } else {
                  // Build a fresh stream for this peer
                  let RNW: any = null;
                  try { RNW = require('react-native-webrtc'); } catch {}
                  if (RNW?.MediaStream) {
                    stream = new RNW.MediaStream();
                    try { stream.addTrack(track); } catch {}
                  } else {
                    const tracks: any[] = [track];
                    stream = { _tracks: tracks, getTracks: () => tracks, toURL: () => peerId };
                  }
                  sfuPeerStreamsRef.current.set(peerId, stream);
                }
                setActiveCall(prev2 => {
                  if (!prev2) return prev2;
                  return {
                    ...prev2,
                    participants: prev2.participants.map(p =>
                      p.userId === peerId ? { ...p, stream } : p,
                    ),
                  };
                });
              },
              session.localUserId,
            );
          } catch (e) {
            console.warn('[SFU] join failed, staying on P2P', e);
          } finally {
            _sfuJoiningRef.current = false;
          }
        }
      });

      // Participant left group call
      s.on('call.participant.left', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const userId = String(payload?.userId ?? '');
        if (!callId || !userId) return;
        webRTCService.closePeer(userId);
        // Allow re-offering to this peer if they rejoin the same call.
        _offeredPeersRef.current.delete(userId);
        // Drop any accumulated SFU MediaStream for the departing peer.
        sfuPeerStreamsRef.current.delete(userId);
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          // If the leaving user was the active speaker, promote the next speaking participant
          const nextSpeaker =
            prev.activeSpeakerId === userId
              ? (prev.participants.find(p => p.userId !== userId && !p.isLocal && p.isSpeaking)?.userId ?? null)
              : prev.activeSpeakerId;
          return {
            ...prev,
            participants: prev.participants.filter(p => p.userId !== userId),
            activeSpeakerId: nextSpeaker,
          };
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
        const rt = setTimeout(() => {
          reactionTimeoutsRef.current = reactionTimeoutsRef.current.filter(x => x !== rt);
          setActiveCall(prev =>
            prev ? { ...prev, reactions: prev.reactions.filter(r => r.id !== reaction.id) } : prev,
          );
        }, 3000);
        reactionTimeoutsRef.current.push(rt);
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
          // Only increment unread count when the chat sheet is NOT already open
          const delta = callChatOpenRef.current ? 0 : 1;
          return {
            ...prev,
            chatMessages: [...prev.chatMessages, msg],
            unreadChatCount: prev.unreadChatCount + delta,
          };
        });
      });

      // Participant muted by host
      s.on('call.participant.muted', (payload: any) => {
        // Backend emits userId (not targetUserId) in the broadcast payload
        const userId = String(payload?.userId ?? payload?.targetUserId ?? '');
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
        // Backend broadcasts the muted user's id as `userId`. When that's us,
        // actually disable the local mic track — not just the UI flag — so the
        // host's mute genuinely stops our audio from transmitting.
        if (userId === currentUserIdRef.current) {
          webRTCService.setMuted(true);
        }
      });

      // Viewer count (broadcast)
      s.on('call.viewer.count', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        // Backend emits viewerCount (not count)
        const count = Number(payload?.viewerCount ?? payload?.count ?? 0);
        setActiveCall(prev =>
          prev && prev.callId === callId ? { ...prev, viewerCount: count } : prev,
        );
      });

      // Knock request received (host sees this)
      s.on('call.knock.request', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const userId = String(payload?.userId ?? '');
        const displayName = safeDisplayName(payload?.displayName, 'Guest');
        const knockedAt = payload?.knockedAt ?? new Date().toISOString();
        if (!callId || !userId) return;
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          const existing = (prev.knockingUsers ?? []).some(u => u.userId === userId);
          if (existing) return prev;
          return {
            ...prev,
            knockingUsers: [...(prev.knockingUsers ?? []), { userId, displayName, knockedAt }],
          };
        });
      });

      // Host admitted us — transition from knocking → connecting
      s.on('call.knock.admitted', async (payload: any) => {
        const callId = String(payload?.callId ?? '');
        if (!callId) return;
        // Re-trigger the answer flow now that we are admitted
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          return { ...prev, state: 'connecting' };
        });
        // Kick off the answer
        const session = activeCallRef.current;
        if (session) {
          const granted = await requestCallPermissions(session.callType);
          if (!granted) return;
          const needsVideo = hasVideo(session.callType);
          await fetchAndApplyIceServers();
          audioRouteManager.start(needsVideo ? 'video' : 'voice');
          await webRTCService.startLocalStream(needsVideo);
          _offeredPeersRef.current.clear();
          setupWebRTC(session.callType);
          s.emit('call.answer', {
            conversationId: session.conversationId,
            callId: session.callId,
            callType: session.callType,
            media: needsVideo ? 'video' : 'voice',
          });
        }
      });

      // Host started a scheduled call — waiting participants auto-answer
      s.on('call.host.joined', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        if (!callId) return;
        const session = activeCallRef.current;
        if (!session || session.callId !== callId) return;
        if (session.state === 'waiting-for-host') {
          // The call.offer event already arrived (backend emits both together).
          // If answerCall hasn't been triggered yet by the call.offer handler,
          // trigger it now as a fallback.
          void answerCall();
        }
      });

      // Host denied us
      s.on('call.knock.denied', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        if (!callId) return;
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          return { ...prev, state: 'ended', reason: 'denied' };
        });
      });

      // Role promotion (co-host, speaker, audience)
      s.on('call.role.changed', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const userId = String(payload?.userId ?? '');
        const role = payload?.role as string;
        if (!callId || !userId || !role) return;
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          return {
            ...prev,
            participants: prev.participants.map(p =>
              p.userId === userId ? { ...p, role: role as any } : p,
            ),
          };
        });
      });

      // Screen share state broadcast from remote participant
      s.on('call.screen_share', (payload: any) => {
        const userId = String(payload?.userId ?? '');
        const enabled = !!payload?.enabled;
        if (!userId) return;
        setActiveCall(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            participants: prev.participants.map(p =>
              p.userId === userId ? { ...p, isScreenSharing: enabled } : p,
            ),
          };
        });
      });

      // Recording state changed
      s.on('call.recording.changed', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const recordingState = payload?.recordingState;
        if (!callId || !recordingState) return;
        setActiveCall(prev => prev && prev.callId === callId ? { ...prev, recordingState, isRecording: recordingState === 'recording' } : prev);
      });

      // Live caption received from another participant
      s.on('call.caption', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        if (!callId) return;
        const caption = {
          id: `cap_${Date.now()}`,
          userId: String(payload?.userId ?? ''),
          displayName: safeDisplayName(payload?.displayName, 'Participant'),
          text: String(payload?.text ?? ''),
          sentAt: payload?.sentAt ?? new Date().toISOString(),
        };
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          const captions = [...(prev.captions ?? []).slice(-9), caption]; // keep last 10
          return { ...prev, captions };
        });
      });

      // In-call poll events
      s.on('call.poll.create', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        if (!callId) return;
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          const existing = (prev.polls ?? []).some(p => p.pollId === payload.pollId);
          if (existing) return prev;
          return { ...prev, polls: [...(prev.polls ?? []), { ...payload, votes: {}, myVote: undefined }] };
        });
      });
      s.on('call.poll.vote', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        if (!callId) return;
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          return {
            ...prev,
            polls: (prev.polls ?? []).map(p =>
              p.pollId === payload.pollId ? { ...p, votes: { ...p.votes, [payload.userId]: payload.option } } : p,
            ),
          };
        });
      });
      s.on('call.poll.close', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        if (!callId) return;
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          return { ...prev, polls: (prev.polls ?? []).map(p => p.pollId === payload.pollId ? { ...p, closed: true } : p) };
        });
      });

      // Q&A events
      s.on('call.qa.updated', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const action = payload?.action;
        const q = payload?.question;
        if (!callId || !q) return;
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          const queue = prev.qaQueue ?? [];
          if (action === 'add') return { ...prev, qaQueue: [...queue, q] };
          if (action === 'answered') return { ...prev, qaQueue: queue.map(item => item.questionId === q.questionId ? { ...item, answered: true } : item) };
          if (action === 'dismiss') return { ...prev, qaQueue: queue.filter(item => item.questionId !== q.questionId) };
          return prev;
        });
      });

      // Breakout room events
      s.on('call.breakout.updated', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        if (!callId) return;
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          if (payload.action === 'created') return { ...prev, breakoutRooms: payload.breakoutRooms ?? [] };
          if (payload.action === 'closed') return { ...prev, breakoutRooms: [], myBreakoutRoomId: null };
          return prev;
        });
      });
      s.on('call.breakout.assign', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        if (!callId) return;
        setActiveCall(prev => prev && prev.callId === callId ? { ...prev, myBreakoutRoomId: payload.roomId } : prev);
      });
      s.on('call.breakout.return', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        if (!callId) return;
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          return {
            ...prev,
            breakoutRooms: (prev.breakoutRooms ?? []).map(r => ({
              ...r,
              userIds: r.userIds.filter(id => id !== payload.userId),
            })),
          };
        });
      });

      // RTMP streaming state
      s.on('call.rtmp.changed', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        if (!callId) return;
        setActiveCall(prev =>
          prev && prev.callId === callId
            ? { ...prev, rtmpActive: !!payload.rtmpActive, rtmpUrl: payload.rtmpUrl ?? prev.rtmpUrl }
            : prev,
        );
      });

      // Whiteboard cursor relay
      s.on('call.wb.cursor', (payload: any) => {
        const userId = String(payload?.userId ?? '');
        if (!userId || userId === currentUserIdRef.current) return;
        // Forward as a lightweight DeviceEventEmitter so InCallWhiteboardSheet can listen
        // without needing cursor positions in the main CallSession state tree.
        DeviceEventEmitter.emit('call.wb.cursor', {
          userId,
          x: payload?.x ?? 0,
          y: payload?.y ?? 0,
        });
      });

      // Whiteboard events
      s.on('call.wb.stroke', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const stroke = payload?.stroke;
        if (!callId || !stroke) return;
        // Ignore strokes we drew ourselves (we optimistically applied them)
        const myUserId = currentUserIdRef.current;
        if (stroke.userId === myUserId) return;
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          const already = (prev.whiteboardStrokes ?? []).some(s => s.id === stroke.id);
          if (already) return prev;
          return { ...prev, whiteboardStrokes: [...(prev.whiteboardStrokes ?? []), stroke] };
        });
      });
      s.on('call.wb.undo', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const strokeId = payload?.strokeId;
        if (!callId || !strokeId) return;
        setActiveCall(prev =>
          prev && prev.callId === callId
            ? { ...prev, whiteboardStrokes: (prev.whiteboardStrokes ?? []).filter(s => s.id !== strokeId) }
            : prev,
        );
      });
      s.on('call.wb.clear', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        if (!callId) return;
        setActiveCall(prev =>
          prev && prev.callId === callId ? { ...prev, whiteboardStrokes: [] } : prev,
        );
      });

      // call.sync response
      s.on('call.participants.snapshot', (payload: any) => {
        const callId = String(payload?.callId ?? '');
        const participants = Array.isArray(payload?.participants) ? payload.participants : [];
        if (!callId) return;
        setActiveCall(prev => {
          if (!prev || prev.callId !== callId) return prev;
          const remoteParticipants = participants
            .filter((p: any) => p.userId !== prev.localUserId)
            .map((p: any) => makeParticipant({
              userId: String(p.userId),
              displayName: safeDisplayName(p.displayName, 'Participant'),
              role: p.role ?? 'audience',
            }));
          const local = prev.participants.find(p => p.isLocal);
          return {
            ...prev,
            participants: local ? [local, ...remoteParticipants] : remoteParticipants,
          };
        });
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
  }, [isAuth, startWebRTCOffer, socketIdentityVersion]);

  /* ─── NetInfo-driven reconnect ───────────────────────────────────────────── */
  // When the device regains network, immediately prompt the socket to reconnect
  // instead of waiting for the next exponential-backoff timer tick.

  const socketRef2 = socketRef; // alias — socketRef already holds the socket instance
  useEffect(() => {
    let wasOnline = true;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      setIsNetworkOnline(online);
      if (!online) {
        setIsConnected(false);
        const s = socketRef2.current;
        if (s) {
          s.removeAllListeners();
          s.disconnect();
          socketRef2.current = null;
          setSocket(null);
        }
      }
      if (online && !wasOnline) {
        // Network just came back. Recreate the socket instead of trusting a
        // stale Manager instance; this avoids needing an app restart.
        requestSocketRecovery('netinfo.online');
      }
      wasOnline = online;
    });
    return () => unsubscribe();
  }, [requestSocketRecovery]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isAuth) return;
    let cancelled = false;
    const check = async (reason: string) => {
      const state = await NetInfo.fetch().catch(() => null);
      if (cancelled) return;
      const online = !!(state?.isConnected && state.isInternetReachable !== false);
      setIsNetworkOnline(online);
      if (!online) return;
      const s = socketRef.current;
      if (!s) requestSocketRecovery(reason);
    };
    void check('watchdog.initial');
    const interval = setInterval(() => {
      void check('watchdog.interval');
    }, 7000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check('watchdog.app_active');
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
  }, [isAuth, requestSocketRecovery]);

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
    isNetworkOnline,
    currentUserId,
    typingByConversation,
    typingDisplayNames,
    presenceByUser,
    activeCall,
    startCall,
    answerCall,
    rejectCall,
    leaveCall,
    endCallForAll,
    endCall,
    dismissCallUi,
    knockOnCall,
    admitKnocker,
    denyKnocker,
    promoteParticipant,
    toggleNoiseCancellation,
    toggleCaptions,
    sendCaption,
    selectVirtualBg,
    toggleRecording,
    createPoll,
    votePoll,
    closePoll,
    submitQuestion,
    dismissQuestion,
    markAnswered,
    createBreakoutRooms,
    returnToMainRoom,
    closeBreakoutRooms,
    startRtmp,
    stopRtmp,
    wbStroke,
    wbUndo,
    wbClear,
    joinExistingCall,
    getCallInviteLink,
  }), [socket, isConnected, isNetworkOnline, currentUserId, typingByConversation, typingDisplayNames, presenceByUser, activeCall, startCall, answerCall, rejectCall, leaveCall, endCallForAll, endCall, dismissCallUi, knockOnCall, admitKnocker, denyKnocker, promoteParticipant, toggleNoiseCancellation, toggleCaptions, sendCaption, selectVirtualBg, toggleRecording, createPoll, votePoll, closePoll, submitQuestion, dismissQuestion, markAnswered, createBreakoutRooms, returnToMainRoom, closeBreakoutRooms, startRtmp, stopRtmp, wbStroke, wbUndo, wbClear, joinExistingCall, getCallInviteLink]);

  /* ─── Render call screens ───────────────────────────────────────────────── */

  const isIncoming = activeCall?.state === 'incoming';
  const isLobby = activeCall?.state === 'lobby';
  const isWaitingForHost = activeCall?.state === 'waiting-for-host';
  const isActiveOrConnecting =
    activeCall &&
    activeCall.state !== 'incoming' &&
    activeCall.state !== 'lobby' &&
    activeCall.state !== 'waiting-for-host' &&
    activeCall.state !== null;
  const isEnded = activeCall?.state === 'ended' || activeCall?.state === 'missed';

  return (
    <SocketContext.Provider value={value}>
      {children}

      {/* Incoming call — full-screen ringing UI */}
      {isIncoming && activeCall && (
        <IncomingCallScreen
          session={activeCall}
          onAnswer={(opts) => {
            audioRouteManager.stopRingtone();
            if (opts?.videoOff) webRTCService.setVideoEnabled(false);
            void answerCall();
          }}
          onDecline={() => { audioRouteManager.stopRingtone(); void rejectCall('rejected'); }}
        />
      )}

      {/* Waiting for host — joined scheduled call before host arrived */}
      {isWaitingForHost && activeCall && (
        <WaitingForHostScreen
          visible
          callTitle={activeCall.title}
          onLeave={() => void leaveCall()}
        />
      )}

      {/* Pre-join lobby — shown for group/broadcast calls before entering */}
      {isLobby && activeCall && (
        <LobbyScreen
          visible
          callType={activeCall.callType}
          title={activeCall.title}
          participantCount={activeCall.participants.filter(p => !p.isLocal).length}
          onJoin={async (opts) => {
            // Apply camera/mic preferences then answer
            if (!opts.withMic) webRTCService.setMuted(true);
            if (!opts.withVideo) webRTCService.setVideoEnabled(false);
            void answerCall();
          }}
          onDecline={() => void rejectCall('declined')}
        />
      )}

      {/* Mini badge — shown when call is minimised */}
      {isActiveOrConnecting && callMinimised && !isEnded && (
        <CallMiniBadge onRestore={() => setCallMinimised(false)} />
      )}

      {/* Active / dialing / ended call — full-screen call UI */}
      {isActiveOrConnecting && activeCall && !isIncoming && (!callMinimised || isEnded) && (
        <ActiveCallScreen
          session={activeCall}
          actions={{
            onEnd: () => {
              const session = activeCallRef.current;
              const localP = session?.participants.find(p => p.isLocal);
              const isHost = localP?.role === 'host';
              const otherJoined = session?.participants.filter(p => !p.isLocal).length ?? 0;
              const callIsLive = session?.state === 'active' || session?.state === 'reconnecting';

              if (isHost && otherJoined > 0 && callIsLive) {
                // Host with others already in the call — give the choice to leave vs end for all.
                Alert.alert(
                  'Leave or end call?',
                  '',
                  [
                    { text: 'Leave call', onPress: () => void leaveCall() },
                    { text: 'End for everyone', style: 'destructive', onPress: () => void endCallForAll() },
                    { text: 'Cancel', style: 'cancel' },
                  ],
                );
              } else {
                // Nobody has joined yet (still dialing/connecting) OR we are not the host.
                // Use endCallForAll so call.end is broadcast to every callee and their
                // IncomingCallScreen / ring-tone is dismissed immediately.
                void endCallForAll();
              }
            },
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
            onToggleScreenShare: () => void toggleScreenShare(),
            onAddParticipant: () => {
              if (Platform.OS === 'ios') {
                Alert.prompt(
                  'Add to Call',
                  'Enter the username or user ID to invite:',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Invite',
                      onPress: (value?: string) => {
                        const uid = (value ?? '').trim();
                        if (uid) inviteToCall([uid]);
                      },
                    },
                  ],
                  'plain-text',
                );
              } else {
                DeviceEventEmitter.emit('call.add_participant.request', { inviteToCall });
              }
            },
            onMinimize: () => setCallMinimised(true),
            onChatOpenChange: (open: boolean) => {
              callChatOpenRef.current = open;
              if (open) {
                // Reset unread count when the user opens the chat sheet
                setActiveCall(prev => prev ? { ...prev, unreadChatCount: 0 } : prev);
              }
            },
            onToggleNoiseCancellation: toggleNoiseCancellation,
            onAdmitKnocker: (uid: string) => admitKnocker(uid),
            onDenyKnocker: (uid: string) => denyKnocker(uid),
            onPromoteParticipant: (uid: string, role: string) => promoteParticipant(uid, role),
            onToggleCaptions: toggleCaptions,
            onSendCaption: sendCaption,
            onSelectVirtualBg: selectVirtualBg,
            onToggleRecording: toggleRecording,
            onCreatePoll: createPoll,
            onVotePoll: votePoll,
            onClosePoll: closePoll,
            onSubmitQuestion: submitQuestion,
            onDismissQuestion: dismissQuestion,
            onMarkAnswered: markAnswered,
            onCreateBreakoutRooms: createBreakoutRooms,
            onReturnToMainRoom: returnToMainRoom,
            onCloseBreakoutRooms: closeBreakoutRooms,
            onStartRtmp: startRtmp,
            onStopRtmp: stopRtmp,
            onWbStroke: wbStroke,
            onWbUndo: wbUndo,
            onWbClear: wbClear,
            onWbCursor: wbCursor,
            onGetInviteLink: getCallInviteLink,
          }}
        />
      )}
    </SocketContext.Provider>
  );
};
