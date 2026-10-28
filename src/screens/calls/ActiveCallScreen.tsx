// src/screens/calls/ActiveCallScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  AppState,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
  StatusBar,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '@/theme/responsive';

import type { CallSession, CallLayout } from '@/services/calls/callTypes';
import { hasVideo, isGroupCall, REACTION_EMOJIS, callTypeLabel } from '@/services/calls/callTypes';
import { RTCView } from '@/services/calls/webRTCService';
import { audioRouteManager } from '@/services/calls/audioRouteManager';
import { addCallPiPModeChangeListener } from '@/services/calls/callPiPService';
import { useIOSCallPiP } from './hooks/useIOSCallPiP';

import CallControls from './components/CallControls';
import VideoGrid from './components/VideoGrid';
import BroadcastLayout from './components/BroadcastLayout';
import VoiceCallGrid from './components/VoiceCallGrid';
import TileFrame from './components/TileFrame';
import ParticipantTile from './components/ParticipantTile';
import ParticipantMenu from './components/ParticipantMenu';
import { buildModerationProps, buildViewerPrefs, type ParticipantControls } from './components/participantControls';
import ReactionsLayer from './components/ReactionsLayer';
import InCallChatSheet from './components/InCallChatSheet';
import ParticipantsSheet from './components/ParticipantsSheet';
import CallTimer from './components/CallTimer';
import NetworkQualityBars from './components/NetworkQualityBars';
import CallStatsPanel from './CallStatsPanel';
import NetworkQualityBanner from './components/NetworkQualityBanner';
import AdmissionRequestSheet from './components/AdmissionRequestSheet';
import InviteLinkCard from './components/InviteLinkCard';
import CaptionOverlay from './components/CaptionOverlay';
import InCallPollSheet from './components/InCallPollSheet';
import InCallQASheet from './components/InCallQASheet';
import BreakoutRoomsSheet from './components/BreakoutRoomsSheet';
import VirtualBackgroundSheet, { type VirtualBgOption, VirtualBgPreview } from './components/VirtualBackgroundSheet';
import { useVirtualBg, virtualBackgroundNativeAvailable } from '@/services/calls/virtualBgService';
import RtmpSheet from './components/RtmpSheet';
import InCallWhiteboardSheet from './components/InCallWhiteboardSheet';
import IOSScreenSharePicker from './components/IOSScreenSharePicker';
import AddParticipantSheet from './components/AddParticipantSheet';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';
import { fetchConversationsForCurrentUser } from '@/Module/ChatRoom/normalizeConversation';
import { otherDirectParticipantUserId } from '@/Module/ChatRoom/messagesUtils';
import { getCurrentAuthUserId } from '@/storage/userScopedProfileCache';

type CallActions = {
  onEnd: () => void;
  onMinimize?: () => void;
  onDismiss?: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleSpeaker: () => void;
  onFlipCamera: () => void;
  onRaiseHand: () => void;
  onSendReaction: (emoji: string) => void;
  onSendChat: (text: string) => void;
  onPinParticipant: (userId: string | null) => void;
  onSetLayout: (layout: CallLayout) => void;
  onMuteParticipant?: (userId: string) => void;
  onRemoveParticipant?: (userId: string) => void;
  /** Forcibly ends that participant's own call, distinct from removing them from the roster above. */
  onEndParticipantCall?: (userId: string) => void;
  /** Locked mute: the participant can no longer unmute themselves until a moderator clears this. */
  onSetParticipantMuteLock?: (userId: string, locked: boolean) => void;
  /** Locked video: the participant's camera is disabled for everyone until a moderator clears this. */
  onSetParticipantVideoLock?: (userId: string, locked: boolean) => void;
  onToggleScreenShare?: () => void;
  /** Invites users (by id) directly into the already-active call — pushes CALL_OFFER + a real incoming-call push notification to each. */
  onInviteToCall?: (userIds: string[]) => Promise<{ ok: boolean; error?: string }>;
  onToggleNoiseCancellation?: () => void;
  onChatOpenChange?: (open: boolean) => void;
  onAdmitKnocker?: (userId: string) => Promise<boolean>;
  onDenyKnocker?: (userId: string) => Promise<boolean>;
  onPromoteParticipant?: (userId: string, role: string) => void;
  /** Broadcast only: move a participant between the panelist grid and participant strip. */
  onSetParticipantPanelist?: (userId: string, isPanelist: boolean) => void;
  onToggleCaptions?: () => void;
  onSendCaption?: (text: string) => void;
  onSelectVirtualBg?: (opt: VirtualBgOption) => void;
  onToggleRecording?: () => void;
  onCreatePoll?: (question: string, options: string[]) => void;
  onVotePoll?: (pollId: string, option: string) => void;
  onClosePoll?: (pollId: string) => void;
  onSubmitQuestion?: (text: string, anonymous: boolean) => void;
  onDismissQuestion?: (questionId: string) => void;
  onMarkAnswered?: (questionId: string) => void;
  onCreateBreakoutRooms?: (rooms: { name: string; userIds: string[] }[]) => void;
  onReturnToMainRoom?: () => void;
  onCloseBreakoutRooms?: () => void;
  onStartRtmp?: (url: string) => void;
  onStopRtmp?: () => void;
  onWbStroke?: (stroke: any) => void;
  onWbUndo?: (strokeId: string) => void;
  onWbClear?: () => void;
  onWbCursor?: (x: number, y: number) => void;
  /** Fetch/generate invite link for the current call — works for all call types. */
  onGetInviteLink?: () => Promise<string | null>;
};

type Props = {
  session: CallSession | null;
  actions: CallActions;
};

export default function ActiveCallScreen({ session, actions }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();

  // Local self-preview tile size — scaled up for tablets, matching the
  // modern-video-app scale (WhatsApp/FaceTime/Meet) rather than a tiny thumbnail.
  const PIP_W = responsive.isTablet ? 140 : 120;
  const PIP_H = responsive.isTablet ? 200 : 170;
  // Approximate rendered height of the bottom CallControls bar + its bottom
  // safe-area padding, so the default position never covers the buttons.
  const CONTROLS_CLEARANCE = 170;

  const [showControls, setShowControls] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [fetchingInviteLink, setFetchingInviteLink] = useState(false);
  const [resolvedInviteLink, setResolvedInviteLink] = useState<string | null>(null);
  const [showPolls, setShowPolls] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const [showAdmissionRequests, setShowAdmissionRequests] = useState(false);
  const [showBreakout, setShowBreakout] = useState(false);
  const [showVirtualBg, setShowVirtualBg] = useState(false);
  const [showRtmp, setShowRtmp] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [captionSending, setCaptionSending] = useState(false);
  // Keep captionSending in sync with captionsEnabled — if captions get toggled off externally, stop sending
  useEffect(() => {
    if (!session?.captionsEnabled) setCaptionSending(false);
  }, [session?.captionsEnabled]);
  const [virtualBg, setVirtualBg] = useState<VirtualBgOption>({ id: 'none', mode: 'none', label: 'None' });
  // Self-preview ref for virtual background capture
  const selfPreviewRef = useRef<any>(null);
  const { frameUri, setConfig: setVbConfig } = useVirtualBg(selfPreviewRef);
  const [showAddParticipantSheet, setShowAddParticipantSheet] = useState(false);
  const [addParticipantChats, setAddParticipantChats] = useState<import('@/Module/ChatRoom/messagesUtils').Chat[]>([]);
  const [addParticipantLoading, setAddParticipantLoading] = useState(false);
  const [addParticipantCurrentUserId, setAddParticipantCurrentUserId] = useState<string | null>(null);
  const [invitingParticipants, setInvitingParticipants] = useState(false);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  // Measured heights of the top HUD / bottom controls bar, so the content
  // area's reserved padding below can match them exactly rather than a
  // guessed constant — see the chrome-space-reclaim effect further down.
  const [topChromeH, setTopChromeH] = useState(0);
  const [bottomChromeH, setBottomChromeH] = useState(0);

  // Per-viewer, local-only preferences — never touch session/actions, so
  // they can never be mistaken for something that syncs to anyone else on
  // the call (see ParticipantMenu's "For you" section).
  const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(new Set());
  const [audioFocusUserId, setAudioFocusUserId] = useState<string | null>(null);
  const toggleHidden = useCallback((userId: string) => {
    setHiddenUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }, []);
  const toggleAudioFocus = useCallback((userId: string) => {
    setAudioFocusUserId(prev => (prev === userId ? null : userId));
  }, []);

  // Self-preview drag state (video calls only).
  // We keep the animated values at 0 (delta) and bake the initial position into
  // setOffset so that Animated.event(dx/dy) accumulates correctly without
  // causing a position jump on the first touch.
  const selfPanX = useRef(new Animated.Value(0)).current;
  const selfPanY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // Default to bottom-right, like WhatsApp/FaceTime/Meet, clear of the
    // bottom control bar and respecting the bottom safe-area inset.
    // selfPreview's coordinate space is relative to `content`, which
    // styles.root now insets by topInset from the top of the device (see
    // styles.root's paddingTop) — so its own usable height is
    // screenH - topInset, not the full screenH.
    selfPanX.setOffset(screenW - PIP_W - 16);
    selfPanY.setOffset((screenH - topInset) - insets.bottom - CONTROLS_CLEARANCE - PIP_H);
    selfPanX.flattenOffset();
    selfPanY.flattenOffset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount

  const openAddParticipantSheet = useCallback(() => {
    setShowAddParticipantSheet(true);
    setAddParticipantLoading(true);
    Promise.all([fetchConversationsForCurrentUser(), getCurrentAuthUserId()])
      .then(([chats, uid]) => {
        setAddParticipantChats(chats);
        setAddParticipantCurrentUserId(uid);
      })
      .catch(() => {
        setAddParticipantChats([]);
      })
      .finally(() => setAddParticipantLoading(false));
  }, []);

  const selfPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Capture current absolute position into offset so delta starts at 0
        selfPanX.setOffset((selfPanX as any)._value ?? 0);
        selfPanX.setValue(0);
        selfPanY.setOffset((selfPanY as any)._value ?? 0);
        selfPanY.setValue(0);
      },
      onPanResponderMove: Animated.event(
        [null, { dx: selfPanX, dy: selfPanY }],
        { useNativeDriver: false },
      ),
      onPanResponderRelease: () => {
        selfPanX.flattenOffset();
        selfPanY.flattenOffset();
        // Clamp tile within safe screen bounds
        const rawX = (selfPanX as any)._value ?? 0;
        const rawY = (selfPanY as any)._value ?? 0;
        const clampedX = Math.max(0, Math.min(rawX, screenW - PIP_W));
        // Lower bound is just a small gap now (not topInset + 8) — this
        // coordinate space already starts topInset below the real device
        // top, same reasoning as the initial-offset effect above.
        const clampedY = Math.max(8, Math.min(rawY, (screenH - topInset) - insets.bottom - PIP_H - 8));
        if (clampedX !== rawX) Animated.spring(selfPanX, { toValue: clampedX, useNativeDriver: false, bounciness: 6 }).start();
        if (clampedY !== rawY) Animated.spring(selfPanY, { toValue: clampedY, useNativeDriver: false, bounciness: 6 }).start();
      },
    }),
  ).current;

  // Pulsing animation for 'dialing'/'ringing' state
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (session?.state === 'dialing' || session?.state === 'ringing' || session?.state === 'connecting') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [session?.state]);

  // Ringback tone: plays on the caller's side while waiting for remote to
  // answer — continues through 'ringing' (the callee's device confirmed
  // it's alerting them), not just 'dialing', since the caller is still
  // waiting for an answer either way. Stopping it the instant state moved
  // from 'dialing' to 'ringing' would leave the caller in dead silence right
  // as the other phone actually starts ringing.
  useEffect(() => {
    if (session?.state === 'dialing' || session?.state === 'ringing') {
      audioRouteManager.startRingback();
      return () => audioRouteManager.stopRingback();
    }
    audioRouteManager.stopRingback();
  }, [session?.state]);

  // Controls/chrome visibility is purely tap-driven — no auto-hide timer.
  // Tapping the video/content area toggles it; pressing an actual control
  // (mute, video, etc.) always brings it back rather than toggling, so a
  // button press can never flip it off mid-interaction.
  // useNativeDriver: false on both — this same Animated.Value also drives
  // paddingTop/paddingBottom/translateY below (so hiding the chrome
  // actually reclaims its screen space, not just fades it out), and
  // padding isn't a native-animatable style property.
  const showControlsNow = useCallback(() => {
    setShowControls(true);
    Animated.timing(controlsOpacity, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  }, []);

  const toggleControls = useCallback(() => {
    setShowControls(prev => {
      const next = !prev;
      Animated.timing(controlsOpacity, { toValue: next ? 1 : 0, duration: next ? 200 : 250, useNativeDriver: false }).start();
      return next;
    });
  }, []);

  // Hiding the chrome doesn't just fade it out — it actually releases the
  // screen space it was reserving (padding animates to 0 right alongside
  // the opacity/slide), so the video grid underneath measures a taller
  // container and its tiles grow into that space, same as the top/bottom
  // bars sliding fully off-screen.
  const contentPadTop = controlsOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, topChromeH] });
  const contentPadBottom = controlsOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, bottomChromeH] });
  const topHudTranslateY = controlsOpacity.interpolate({ inputRange: [0, 1], outputRange: [-topChromeH, 0] });
  const bottomBarTranslateY = controlsOpacity.interpolate({ inputRange: [0, 1], outputRange: [bottomChromeH, 0] });

  const onTopHudLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setTopChromeH(h);
  }, []);
  const onBottomChromeLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setBottomChromeH(h);
  }, []);

  // Native PiP mode (Android auto-enter on background, iOS's automatic
  // video-call PiP, or the user tapping the PiP window to return to full
  // screen) fires this same event on entry AND exit - both directions need
  // handling here since there's no separate "returned to foreground" signal
  // to rely on instead. While in PiP the normal modal chrome (header,
  // controls, sheets) has no room to render legibly, so the minimal
  // full-bleed video branch below takes over instead of trying to scale the
  // full UI down.
  const [isInPictureInPicture, setIsInPictureInPicture] = useState(false);
  useEffect(() => addCallPiPModeChangeListener(setIsInPictureInPicture), []);

  const localParticipant = useMemo(
    () => session?.participants.find(p => p.isLocal) ?? null,
    [session?.participants],
  );
  const remoteParticipants = useMemo(
    () => session?.participants.filter(p => !p.isLocal) ?? [],
    [session?.participants],
  );
  const invitableAddParticipantChats = useMemo(() => {
    const onCallIds = new Set((session?.participants ?? []).map(p => p.userId));
    const seen = new Set<string>();
    const out: { chat: typeof addParticipantChats[number]; userId: string }[] = [];
    for (const chat of addParticipantChats) {
      if (chat.isGroup || chat.isGroupChat || chat.isCommunityChat || chat.kind === 'group' || chat.kind === 'community') continue;
      const uid = otherDirectParticipantUserId(chat.participants, addParticipantCurrentUserId ?? undefined);
      if (!uid || onCallIds.has(uid) || seen.has(uid)) continue;
      seen.add(uid);
      out.push({ chat, userId: uid });
    }
    return out;
  }, [addParticipantChats, addParticipantCurrentUserId, session?.participants]);
  const isHostOrCoHost = localParticipant?.role === 'host' || localParticipant?.role === 'co-host';
  // Moderation rights belong to the group's host/co-host AND, separately,
  // to whoever actually placed this call — a plain member who started a
  // 1:1/ad-hoc call has no special `role` but should still be able to
  // remove/mute/lock participants on the call they started.
  const canModerate = isHostOrCoHost
    || (!!session?.initiatedBy && session.initiatedBy === localParticipant?.userId);
  const visibleParticipants = useMemo(
    () => (session?.participants ?? []).filter(p => p.isLocal || !hiddenUserIds.has(p.userId)),
    [session?.participants, hiddenUserIds],
  );
  const participantControls: ParticipantControls = useMemo(() => ({
    canModerate,
    onMuteParticipant: actions.onMuteParticipant,
    onRemoveParticipant: actions.onRemoveParticipant,
    onEndParticipantCall: actions.onEndParticipantCall,
    onSetParticipantMuteLock: actions.onSetParticipantMuteLock,
    onSetParticipantVideoLock: actions.onSetParticipantVideoLock,
    onSetParticipantPanelist: actions.onSetParticipantPanelist,
    onPromoteParticipant: actions.onPromoteParticipant,
    audioFocusUserId,
    onToggleAudioFocus: toggleAudioFocus,
    onToggleHidden: toggleHidden,
    onToggleChrome: toggleControls,
  }), [canModerate, actions, audioFocusUserId, toggleAudioFocus, toggleHidden, toggleControls]);
  const withVideo = session ? hasVideo(session.callType) : false;
  // A 1:1 call that picks up a 3rd participant via the add-participant
  // sheet is genuinely a group call now even though callType (set once at
  // call creation) still says 'voice'/'video' — same reasoning as
  // CallControls' own isGroup, kept in sync so the layout switch below and
  // the controls row agree on when a call is "a group call" for UI
  // purposes.
  const isGroup = session ? (isGroupCall(session.callType) || session.participants.length > 2) : false;
  const isBroadcast = session?.callType === 'broadcast';
  const isActive = session?.state === 'active';
  const isConnecting = session?.state === 'connecting' || session?.state === 'dialing' || session?.state === 'ringing' || session?.state === 'reconnecting';

  const handleControlAction = useCallback((action: string) => {
    showControlsNow();
    switch (action) {
      case 'mute':
        if (localParticipant?.isMuteLocked) {
          Alert.alert('Muted by host', 'The host or caller has muted you — only they can unmute you.');
          break;
        }
        actions.onToggleMute();
        break;
      case 'video':
        if (localParticipant?.isVideoLocked) {
          Alert.alert('Video turned off', 'The host or caller has turned off your video for everyone — only they can turn it back on.');
          break;
        }
        actions.onToggleVideo();
        break;
      case 'speaker': actions.onToggleSpeaker(); break;
      case 'flip': actions.onFlipCamera(); break;
      case 'end': actions.onEnd(); break;
      case 'raise-hand': actions.onRaiseHand(); break;
      case 'chat': {
        const next = !showChat;
        setShowChat(next);
        setShowParticipants(false);
        actions.onChatOpenChange?.(next);
        break;
      }
      case 'participants':
        setShowParticipants(v => !v);
        setShowChat(false);
        break;
      case 'add-participant':
        openAddParticipantSheet();
        break;
      case 'layout':
        actions.onSetLayout(
          session?.layout === 'speaker' ? 'gallery' : 'speaker',
        );
        break;
      case 'screen-share':
        if (actions.onToggleScreenShare) {
          actions.onToggleScreenShare();
        } else {
          Alert.alert(
            'Share Screen',
            'Screen sharing is not available in this context.',
            [{ text: 'OK' }],
          );
        }
        break;
      case 'noise-cancel':
        actions.onToggleNoiseCancellation?.();
        break;
      case 'invite-link':
        if (resolvedInviteLink || session?.inviteLink) {
          setShowInviteLink(true);
        } else if (actions.onGetInviteLink && !fetchingInviteLink) {
          setFetchingInviteLink(true);
          actions.onGetInviteLink().then((link) => {
            setFetchingInviteLink(false);
            if (link) { setResolvedInviteLink(link); setShowInviteLink(true); }
            else Alert.alert('Invite link', 'Could not generate an invite link. Please try again.');
          }).catch(() => {
            setFetchingInviteLink(false);
            Alert.alert('Invite link', 'Could not generate an invite link. Please try again.');
          });
        }
        break;
      case 'captions': {
        const turningOn = !session?.captionsEnabled;
        actions.onToggleCaptions?.();
        // Only keep captionSending on when captions are being turned on
        setCaptionSending(turningOn);
        break;
      }
      case 'virtual-bg':
        setShowVirtualBg(true);
        break;
      case 'record':
        actions.onToggleRecording?.();
        break;
      case 'polls':
        setShowPolls(v => !v);
        break;
      case 'qa':
        setShowQA(v => !v);
        break;
      case 'admission-requests':
        setShowAdmissionRequests(v => !v);
        break;
      case 'breakout':
        setShowBreakout(v => !v);
        break;
      case 'rtmp':
        setShowRtmp(true);
        break;
      case 'whiteboard':
        setShowWhiteboard(true);
        break;
    }
  }, [actions, session?.layout, showControlsNow, openAddParticipantSheet, localParticipant]);

  const styles = useMemo(() => StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: palette.royalInk,
      // The call room used to bleed all the way up under the status bar/
      // notch (statusBarTranslucent + full-bleed content) — inset it below
      // that instead, so the room's actual height is screen height minus
      // the safe-area top rather than the full device height.
      paddingTop: Math.max(topInset, 12),
    },
    // Native OS Picture-in-Picture window content — deliberately plain
    // (no palette-driven chrome, no safe-area padding) since the PiP window
    // itself is sized and positioned entirely by the OS, not this app.
    pipRoot: {
      flex: 1,
      backgroundColor: '#000',
    },
    pipVideo: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    fill1to1: {
      flex: 1,
    },
    topHud: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingBottom: 20,
      zIndex: 10,
    },
    topLeft: { flex: 1, gap: 4 },
    topRight: { alignItems: 'flex-end', gap: 6 },
    callTitle: { color: palette.ivory, fontSize: 16, fontWeight: '700' },
    stateLabel: { color: palette.subtext, fontSize: 13 },
    callTypeChip: {
      color: palette.gold,
      fontSize: 11,
      fontWeight: '700',
      backgroundColor: `${palette.gold}26`,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: `${palette.gold}4D`,
      letterSpacing: 0.3,
    },

    // Voice layout
    voiceLayout: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      paddingBottom: 40,
    },
    voiceDotsBtn: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: palette.overlay,
      borderRadius: 16,
      padding: 7,
      zIndex: 5,
    },
    voiceAvatar: {
      width: 126,
      height: 126,
      borderRadius: 63,
      backgroundColor: palette.goldDeep,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: palette.gold,
      shadowColor: palette.gold,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.45,
      shadowRadius: 22,
      elevation: 14,
    },
    voiceInitials: { color: palette.ivory, fontSize: 44, fontWeight: '800' },
    voiceName: { color: palette.ivory, fontSize: 26, fontWeight: '700' },
    speakingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    speakingText: { color: palette.success, fontSize: 14, fontWeight: '600' },
    mutedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: `${palette.danger}26`,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    mutedText: { color: palette.danger, fontSize: 13, fontWeight: '600' },

    // Self preview — sizing/border/shadow now live in TileFrame; this
    // positions the draggable PiP, nothing else.
    selfPreview: {
      position: 'absolute',
      zIndex: 5,
    },
    selfMutedBadge: {
      position: 'absolute',
      bottom: 6,
      right: 6,
      backgroundColor: palette.overlay,
      borderRadius: 10,
      padding: 3,
    },
    selfVbgBadge: {
      position: 'absolute',
      top: 6,
      left: 6,
      backgroundColor: palette.overlay,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    screenShareBadge: {
      position: 'absolute',
      top: 10,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: '82%',
      backgroundColor: palette.overlay,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      zIndex: 3,
    },
    screenShareBadgeText: {
      color: palette.ivory,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    selfVbgBadgeText: {
      color: palette.ivory,
      fontSize: 9,
      fontWeight: '800',
    },

    // Ended card
    endedBg: {
      flex: 1,
      backgroundColor: `${palette.royalInk}F5`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    endedCard: {
      backgroundColor: palette.royalInk,
      borderRadius: 28,
      padding: 32,
      alignItems: 'center',
      gap: 12,
      width: '85%',
      maxWidth: 400,
      borderWidth: 1,
      borderColor: `${palette.gold}40`,
      shadowColor: palette.gold,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
    endedIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: `${palette.danger}26`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    endedTitle: { color: palette.ivory, fontSize: 22, fontWeight: '800' },
    endedReason: { color: palette.subtext, fontSize: 14 },
    endedCloseBtn: {
      marginTop: 12,
      backgroundColor: `${palette.gold}26`,
      borderRadius: 18,
      paddingHorizontal: 36,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: `${palette.gold}59`,
    },
    endedCloseTxt: { color: palette.gold, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  }), [palette, topInset]);

  if (!session) return null;

  // ─── NATIVE PICTURE-IN-PICTURE ───────────────────────────────────────────
  // The OS has shrunk this screen into its floating PiP window (Android's
  // auto-enter-on-background, or iOS's automatic video-call PiP) - the
  // normal modal chrome (header, CallControls, sheets) has no room to
  // render legibly at that size, and none of it is interactive from inside
  // a PiP window on either platform anyway. Show just the remote video,
  // full-bleed, exactly like every other PiP-supporting video app. Not
  // gated on withVideo/isGroup - isInPictureInPicture can only ever be true
  // when the native side already decided this was eligible (SocketProvider
  // only calls setCallPiPActive(true, ...) for a connected video call), so
  // by the time this branch can render, there's guaranteed to be a real
  // video call to show.
  if (isInPictureInPicture) {
    const pipStream = remoteParticipants[0]?.stream ?? localParticipant?.stream ?? null;
    const pipIsScreenShare = !!remoteParticipants[0]?.isScreenSharing && remoteParticipants[0]?.stream === pipStream;
    return (
      <View style={styles.pipRoot}>
        {pipStream && RTCView ? (
          <RTCView
            streamURL={pipStream.toURL()}
            style={styles.pipVideo}
            objectFit={pipIsScreenShare ? 'contain' : 'cover'}
            zOrder={1}
          />
        ) : null}
      </View>
    );
  }

  const stateLabel = (() => {
    switch (session.state) {
      case 'dialing': return 'Calling…';
      case 'ringing': return 'Ringing…';
      case 'connecting': return 'Connecting…';
      case 'reconnecting': return 'Reconnecting…';
      case 'ended': return session.reason ? `Call ended · ${session.reason}` : 'Call ended';
      case 'missed': return 'Missed';
      default: return null;
    }
  })();

  // ─── ENDED / MISSED STATE ──────────────────────────────────────────────────
  if (session.state === 'ended' || session.state === 'missed') {
    return (
      <Modal visible animationType="fade" transparent statusBarTranslucent>
        <View style={styles.endedBg}>
          <View style={styles.endedCard}>
            <View style={[styles.endedIcon, session.state === 'missed' && { backgroundColor: `${palette.gold}33` }]}>
              <KISIcon
                name={session.state === 'missed' ? 'phone-missed' : 'phone-off'}
                size={32}
                color={session.state === 'missed' ? palette.gold : palette.danger}
              />
            </View>
            <Text style={styles.endedTitle}>{session.state === 'missed' ? 'Missed call' : 'Call ended'}</Text>
            {session.reason && (
              <Text style={styles.endedReason}>{session.reason}</Text>
            )}
            <CallTimer
              startedAt={session.startedAt}
              running={false}
              endedAt={session.endedAt}
              color={palette.subtext}
              size={15}
              showDot={false}
            />
            <Pressable onPress={actions.onDismiss ?? actions.onEnd} style={styles.endedCloseBtn}>
              <Text style={styles.endedCloseTxt}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  // ─── ACTIVE / DIALING / CONNECTING SCREEN ─────────────────────────────────
  return (
    <Modal visible animationType="slide" transparent={false} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor={palette.royalInk} />
      <View style={styles.root}>
        {/* Invisible — exists only so an iOS screen-share toggle has
            ReplayKit's system broadcast picker to trigger. See AND-098. */}
        <IOSScreenSharePicker />

        {/* ── CONTENT AREA ── */}
        <TouchableWithoutFeedback onPress={toggleControls}>
          <Animated.View style={[styles.content, { paddingTop: contentPadTop, paddingBottom: contentPadBottom }]}>

            {/* ── VOICE 1:1 Layout ── */}
            {!isGroup && !withVideo && (
              <VoiceOneOnOneLayout
                session={session}
                pulseAnim={pulseAnim}
                isConnecting={isConnecting}
                styles={styles}
                palette={palette}
                controls={participantControls}
              />
            )}

            {/* ── VIDEO 1:1 Layout ── */}
            {!isGroup && withVideo && (
              <VideoOneOnOneLayout
                session={session}
                remoteParticipants={remoteParticipants}
                isConnecting={isConnecting}
                localStream={localParticipant?.stream}
                selfPanX={selfPanX}
                selfPanY={selfPanY}
                selfPan={selfPan}
                selfPreviewRef={selfPreviewRef}
                virtualBgFrameUri={frameUri}
                virtualBgOption={virtualBg}
                styles={styles}
                palette={palette}
                pipW={PIP_W}
                pipH={PIP_H}
                controls={participantControls}
              />
            )}

            {/* ── VOICE GROUP ── a call with no video capability at all gets
                its own always-multi-participant avatar-tile grid rather than
                VideoGrid's single-big-avatar network-degraded fallback. Keyed
                on withVideo rather than session.callType === 'voice-group' so
                a plain 1:1 voice call that just picked up a 3rd participant
                via add-participant (callType stays 'voice' — it's set once at
                call creation and never changes) lands here too, not in
                VideoGrid's isAudioOnly branch. */}
            {isGroup && !isBroadcast && !withVideo && (
              <VoiceCallGrid
                participants={visibleParticipants}
                activeSpeakerId={session.activeSpeakerId}
                controls={participantControls}
              />
            )}

            {/* ── VIDEO GROUP ── also reached by a 1:1 video call once a 3rd
                participant joins (same callType-never-changes reasoning as
                above) — VideoGrid already renders the local participant's
                own tile as part of the grid, so no extra wiring is needed
                for the newly-multi-party case. */}
            {isGroup && !isBroadcast && withVideo && (
              <VideoGrid
                participants={visibleParticipants}
                layout={session.layout}
                pinnedUserId={session.pinnedUserId}
                activeSpeakerId={session.activeSpeakerId}
                isAudioOnly={!withVideo}
                onPinParticipant={actions.onPinParticipant}
                callActive={session.state === 'active'}
                controls={participantControls}
              />
            )}

            {/* ── BROADCAST ── */}
            {isBroadcast && (
              <BroadcastLayout
                participants={visibleParticipants}
                viewerCount={session.viewerCount ?? 0}
                isRecording={session.isRecording ?? false}
                activeSpeakerId={session.activeSpeakerId}
                liveStartedAt={session.liveStartedAt}
                onPressParticipant={uid => actions.onPinParticipant(uid)}
                callActive={session.state === 'active'}
                controls={participantControls}
              />
            )}

            {/* ── Reactions floating layer ── */}
            <ReactionsLayer reactions={session.reactions} width={screenW} height={screenH} />

          </Animated.View>
        </TouchableWithoutFeedback>

        {/* ── Network Quality Banner ── */}
        <NetworkQualityBanner quality={session.networkQuality} isAudioOnly={session.isAudioOnly} />

        {/* ── TOP HUD ── */}
        <Animated.View
          onLayout={onTopHudLayout}
          style={[
            styles.topHud,
            // topHud is positioned absolutely against `root`'s outer edge —
            // React Native does NOT reliably shift an absolutely-positioned
            // child by its parent's padding, so root's own paddingTop (see
            // styles.root) does nothing for topHud. It needs its own
            // explicit topInset offset, same pattern NetworkQualityBanner
            // already uses. (A previous pass here assumed the padding would
            // cascade and dropped this to a bare `8`, which pushed the
            // minimize/PiP button up under the status bar/notch where it
            // couldn't be tapped — this restores the real offset.)
            { paddingTop: topInset + 8, opacity: controlsOpacity, transform: [{ translateY: topHudTranslateY }] },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.topLeft}>
            {actions.onMinimize && (
              <Pressable
                onPress={actions.onMinimize}
                hitSlop={14}
                accessibilityLabel="Minimise call"
                accessibilityRole="button"
                style={{ marginBottom: 2 }}
              >
                <KISIcon name="chevron-down" size={22} color={palette.ivory} />
              </Pressable>
            )}
            <Text style={styles.callTitle} numberOfLines={1}>{session.title}</Text>
            {isActive && (
              <CallTimer
                startedAt={session.startedAt}
                running
                color={palette.ivory}
                size={13}
                showDot
              />
            )}
            {stateLabel && (
              <Text style={styles.stateLabel}>{stateLabel}</Text>
            )}
          </View>
          <View style={styles.topRight}>
            {/* GAP 2: DTLS encryption padlock — tappable to show fingerprint */}
            {isActive && (
              <Pressable
                onPress={() => {
                  Alert.alert(
                    'Call encrypted',
                    `This call is protected with DTLS-SRTP encryption.\n\nFingerprint: ${session.dtlsFingerprint ?? 'verified'}`,
                    [{ text: 'OK' }],
                  );
                }}
                hitSlop={14}
                accessibilityLabel="Call encryption details"
                accessibilityRole="button"
                style={{ paddingHorizontal: 4, minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 18 }}>🔒</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => setShowStatsPanel(true)}
              hitSlop={10}
              accessibilityLabel="Call diagnostics"
              accessibilityRole="button"
            >
              <NetworkQualityBars quality={session.networkQuality} size={16} />
            </Pressable>
            <Text style={styles.callTypeChip}>{callTypeLabel(session.callType)}</Text>
          </View>
        </Animated.View>

        {/* ── BOTTOM: Controls ── */}
        <Animated.View
          onLayout={onBottomChromeLayout}
          style={{ opacity: controlsOpacity, transform: [{ translateY: bottomBarTranslateY }] }}
        >
          <CallControls
            session={session}
            onAction={handleControlAction}
            onSendReaction={actions.onSendReaction}
            showReactionPicker={showReactionPicker}
            onToggleReactionPicker={() => setShowReactionPicker(v => !v)}
            unreadChat={session.unreadChatCount}
            hasInviteLink={true}
          />
        </Animated.View>

        {/* ── Sheets ── */}
        <InCallChatSheet
          messages={session.chatMessages}
          visible={showChat}
          onClose={() => setShowChat(false)}
          onSend={actions.onSendChat}
          localUserId={session.localUserId}
        />
        <ParticipantsSheet
          participants={session.participants}
          visible={showParticipants}
          onClose={() => setShowParticipants(false)}
          localUserId={session.localUserId}
          isHost={canModerate}
          onMute={canModerate ? actions.onMuteParticipant : undefined}
          onRemove={canModerate ? actions.onRemoveParticipant : undefined}
          onAddParticipant={isGroup ? openAddParticipantSheet : undefined}
          onPromote={canModerate ? actions.onPromoteParticipant : undefined}
          hiddenUserIds={hiddenUserIds}
          onToggleHidden={toggleHidden}
        />

      </View>

      {/* Real WebRTC call-quality diagnostics (feature K) */}
      <CallStatsPanel
        visible={showStatsPanel}
        onClose={() => setShowStatsPanel(false)}
        participants={session.participants}
      />

      {/* Invite link sheet */}
      <InviteLinkCard
        visible={showInviteLink}
        inviteLink={resolvedInviteLink ?? session.inviteLink ?? `https://kingdomimpactventures.org/join/call/${session.inviteToken ?? ''}`}
        callTitle={session.title}
        onClose={() => setShowInviteLink(false)}
      />

      {/* Caption overlay */}
      {session.captionsEnabled && (
        <CaptionOverlay
          captions={session.captions ?? []}
          isSending={captionSending}
          onCaption={text => actions.onSendCaption?.(text)}
          onToggleSend={() => setCaptionSending(v => !v)}
        />
      )}

      {/* Polls sheet */}
      <InCallPollSheet
        visible={showPolls}
        onClose={() => setShowPolls(false)}
        polls={session.polls ?? []}
        isHost={isHostOrCoHost}
        localUserId={session.localUserId}
        onCreatePoll={(q, opts) => actions.onCreatePoll?.(q, opts)}
        onVote={(pollId, opt) => actions.onVotePoll?.(pollId, opt)}
        onClosePoll={pollId => actions.onClosePoll?.(pollId)}
      />

      {/* Q&A sheet */}
      <InCallQASheet
        visible={showQA}
        onClose={() => setShowQA(false)}
        qaQueue={session.qaQueue ?? []}
        isHost={isHostOrCoHost}
        onSubmitQuestion={(text, anon) => actions.onSubmitQuestion?.(text, anon)}
        onDismiss={id => actions.onDismissQuestion?.(id)}
        onMarkAnswered={id => actions.onMarkAnswered?.(id)}
      />

      {/* Admission requests sheet (host/co-host only — link-based joiners
          waiting for approval). Opened via the "Requests" control; see
          CallControls' badge = knockingUsers.length. */}
      {isHostOrCoHost && (
        <AdmissionRequestSheet
          visible={showAdmissionRequests}
          onClose={() => setShowAdmissionRequests(false)}
          knockingUsers={session.knockingUsers ?? []}
          onAdmit={uid => actions.onAdmitKnocker?.(uid) ?? Promise.resolve(false)}
          onDeny={uid => actions.onDenyKnocker?.(uid) ?? Promise.resolve(false)}
        />
      )}

      {/* Breakout rooms sheet */}
      <BreakoutRoomsSheet
        visible={showBreakout}
        onClose={() => setShowBreakout(false)}
        isHost={isHostOrCoHost}
        participants={session.participants}
        breakoutRooms={session.breakoutRooms ?? []}
        myBreakoutRoomId={session.myBreakoutRoomId ?? null}
        onCreateRooms={rooms => actions.onCreateBreakoutRooms?.(rooms)}
        onReturnToMain={() => actions.onReturnToMainRoom?.()}
        onCloseRooms={() => actions.onCloseBreakoutRooms?.()}
      />

      {/* Virtual background sheet */}
      <VirtualBackgroundSheet
        visible={showVirtualBg}
        onClose={() => setShowVirtualBg(false)}
        current={virtualBg}
        nativeProcessorAvailable={virtualBackgroundNativeAvailable}
        onSelect={opt => {
          setVirtualBg(opt);
          setVbConfig({ mode: opt.mode, blurRadius: opt.blurRadius, imageUri: opt.uri });
          actions.onSelectVirtualBg?.(opt);
        }}
      />

      {/* RTMP sheet (broadcast hosts only) */}
      <RtmpSheet
        visible={showRtmp}
        onClose={() => setShowRtmp(false)}
        rtmpActive={!!session.rtmpActive}
        rtmpUrl={session.rtmpUrl ?? null}
        onStart={url => actions.onStartRtmp?.(url)}
        onStop={() => actions.onStopRtmp?.()}
      />

      {/* Whiteboard */}
      <InCallWhiteboardSheet
        visible={showWhiteboard}
        onClose={() => setShowWhiteboard(false)}
        strokes={session.whiteboardStrokes ?? []}
        localUserId={session.localUserId}
        isHost={isHostOrCoHost}
        onStroke={stroke => actions.onWbStroke?.(stroke)}
        onUndo={id => actions.onWbUndo?.(id)}
        onClear={() => actions.onWbClear?.()}
        onCursor={(x, y) => actions.onWbCursor?.(x, y)}
      />

      {/* Add participant — bottom sheet listing the user's direct chats */}
      <AddParticipantSheet
        visible={showAddParticipantSheet}
        palette={palette}
        loading={addParticipantLoading}
        inviting={invitingParticipants}
        invitable={invitableAddParticipantChats}
        onClose={() => setShowAddParticipantSheet(false)}
        onInvite={(userIds) => {
          if (userIds.length === 0 || !actions.onInviteToCall) return;
          setInvitingParticipants(true);
          actions.onInviteToCall(userIds)
            .then(result => {
              if (!result.ok) {
                Alert.alert('Could not add participant', result.error ?? 'Please try again.');
              } else {
                setShowAddParticipantSheet(false);
              }
            })
            .finally(() => setInvitingParticipants(false));
        }}
      />

    </Modal>
  );
}

// ── Voice 1:1 Layout ─────────────────────────────────────────────────────────

function VoiceOneOnOneLayout({ session, pulseAnim, isConnecting, styles, palette, controls }: {
  session: CallSession;
  pulseAnim: Animated.Value;
  isConnecting: boolean;
  styles: any;
  palette: any;
  controls: ParticipantControls;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const other = session.participants.find(p => !p.isLocal);
  const initials = (other?.displayName ?? session.title)
    .trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const viewerPrefs = other ? buildViewerPrefs(controls, other) : undefined;
  const moderation = other ? buildModerationProps(controls, other) : undefined;
  const hasMenu = !!other && !!(viewerPrefs?.onToggleAudioFocus || viewerPrefs?.onToggleHide || moderation?.canModerate);

  return (
    <View style={styles.voiceLayout}>
      {hasMenu && (
        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={8}
          accessibilityLabel={`Options for ${other!.displayName}`}
          accessibilityRole="button"
          style={styles.voiceDotsBtn}
        >
          <KISIcon name="more-vert" size={18} color={palette.subtext} />
        </Pressable>
      )}
      <Animated.View style={[styles.voiceAvatar, isConnecting && { transform: [{ scale: pulseAnim }] }]}>
        <Text style={styles.voiceInitials}>{initials}</Text>
      </Animated.View>
      <Text style={styles.voiceName}>{other?.displayName ?? session.title}</Text>
      {other?.isSpeaking && !other?.isMuted && (
        <View style={styles.speakingIndicator}>
          <SpeakingWave palette={palette} />
          <Text style={styles.speakingText}>Speaking</Text>
        </View>
      )}
      {other?.isMuted && (
        <View style={styles.mutedBadge}>
          <KISIcon name={other.isMuteLocked ? 'lock' : 'mic-off'} size={14} color={palette.danger} />
          <Text style={styles.mutedText}>{other.isMuteLocked ? 'Muted by host' : 'Muted'}</Text>
        </View>
      )}
      {other && hasMenu && (
        <ParticipantMenu
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          displayName={other.displayName}
          viewerPrefs={viewerPrefs}
          moderation={moderation}
        />
      )}
    </View>
  );
}

function SpeakingWave({ palette }: { palette: any }) {
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.7)).current;
  const bar3 = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const anim = (v: Animated.Value, dur: number) =>
      Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: dur, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.2, duration: dur, useNativeDriver: true }),
      ]));
    anim(bar1, 400).start();
    anim(bar2, 550).start();
    anim(bar3, 470).start();
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 24, gap: 4 }}>
      {[bar1, bar2, bar3].map((b, i) => (
        <Animated.View key={i} style={{ width: 5, borderRadius: 3, backgroundColor: palette.success, height: 24, transform: [{ scaleY: b }] }} />
      ))}
    </View>
  );
}

// ── Video 1:1 Layout ─────────────────────────────────────────────────────────

function VideoOneOnOneLayout({ session, remoteParticipants, isConnecting, localStream, selfPanX, selfPanY, selfPan, selfPreviewRef, virtualBgFrameUri, virtualBgOption, styles, palette, pipW, pipH, controls }: {
  session: CallSession;
  remoteParticipants: any[];
  isConnecting: boolean;
  localStream: any;
  selfPanX: Animated.Value;
  selfPanY: Animated.Value;
  selfPan: any;
  selfPreviewRef?: React.RefObject<any>;
  virtualBgFrameUri?: string | null;
  virtualBgOption?: VirtualBgOption;
  styles: any;
  palette: any;
  pipW: number;
  pipH: number;
  controls: ParticipantControls;
}) {
  const remote = remoteParticipants[0] ?? null;

  // Self-measures its own box (rather than assuming full window dimensions)
  // so it correctly tracks both the root-level top-inset fix and the
  // chrome-hide space-reclaim padding on `content` — same pattern every
  // other call layout (VideoGrid etc.) already uses.
  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0) setContainerW(Math.floor(width));
    if (height > 0) setContainerH(Math.floor(height));
  }, []);
  const ready = containerW > 0 && containerH > 0;

  // iOS Picture-in-Picture: react-native-webrtc ships this fully built
  // (RTCPIPView + startIOSPIP/stopIOSPIP, backed by its own PIPController +
  // AVPictureInPictureController natively) - there is no equivalent to
  // Android's "minimal render swap" needed here, because iOS PiP is a
  // genuinely separate floating system window showing whatever the video
  // view's sample buffer layer publishes, not a transformation of this
  // app's own window the way Android's enterPictureInPictureMode() is. This
  // screen keeps rendering completely normally underneath/behind it.
  // Shared with VideoGrid/BroadcastLayout via useIOSCallPiP so every video
  // call type gets the same background/foreground behavior, not just 1:1.
  const pipRef = useIOSCallPiP(session.state === 'active');

  return (
    // flex:1, not absoluteFill — this is `content`'s normal-flow child, so
    // its onLayout measurement correctly tracks content's animated
    // chrome-reclaim padding (see toggleControls). An absolutely-positioned
    // child here would always measure content's full border-box size and
    // ignore that padding entirely, same root cause as the topHud fix
    // above — so the remote tile would never actually grow when the
    // controls hide.
    <View style={[styles.fill1to1, { backgroundColor: palette.royalInk }]} onLayout={onLayout}>
      {/* Remote video — fills the screen. ParticipantTile already handles
          the "contain" vs "cover" objectFit split, the camera-off avatar
          fallback, name/mic/network badges, and the RTCPIPView swap for iOS
          PiP (isPipSource/pipRef) — same single tile component every other
          call layout uses, so the 1:1 remote view gets the same luxurious
          frame AND the same 3-dot menu (view large is skipped here — there's
          only one tile to view — but hide/audio-focus/moderation all work).
          Falls back to plain "Connecting…" text only while the call hasn't
          connected yet (no participant to render a tile for in that case
          reads better than a camera-off-looking tile). */}
      {ready && (
        !isConnecting && remote ? (
          <ParticipantTile
            participant={remote}
            width={containerW}
            height={containerH}
            cornerRadius={0}
            showName
            isPipSource
            pipRef={pipRef}
            onToggleChrome={controls.onToggleChrome}
            viewerPrefs={buildViewerPrefs(controls, remote)}
            moderation={buildModerationProps(controls, remote)}
          />
        ) : (
          <TileFrame width={containerW} height={containerH} cornerRadius={0}>
            <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: palette.subtext, fontSize: 16 }}>
                {isConnecting ? 'Connecting…' : 'Camera off'}
              </Text>
            </View>
          </TileFrame>
        )
      )}

      {/* "Sharing screen" indicator — a small top-centered pill matching this
          screen's existing badge conventions (palette.overlay translucent
          background, same as selfMutedBadge/selfVbgBadge) rather than a
          full-width banner, so it reads as a status chip instead of
          covering a stripe of the shared content underneath it. */}
      {remote?.isScreenSharing && (
        <View pointerEvents="none" style={styles.screenShareBadge}>
          <KISIcon name="screen-share" size={13} color={palette.ivory} />
          <Text style={styles.screenShareBadgeText}>
            {remote.displayName} is sharing their screen
          </Text>
        </View>
      )}

      {/* Self preview — draggable corner tile, in the same luxurious frame
          every other tile uses. */}
      {localStream && RTCView && (
        <Animated.View
          ref={selfPreviewRef}
          style={[
            styles.selfPreview,
            { left: selfPanX, top: selfPanY },
          ]}
          {...selfPan.panHandlers}
        >
          <TileFrame width={pipW} height={pipH} cornerRadius={16}>
            {/* Show processed virtual-bg frame, or raw stream */}
            {virtualBgOption && virtualBgOption.mode !== 'none' && virtualBgFrameUri ? (
              <VirtualBgPreview
                frameUri={virtualBgFrameUri}
                option={virtualBgOption}
                width={92}
                height={132}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <RTCView
                streamURL={localStream.toURL()}
                style={StyleSheet.absoluteFill}
                objectFit="cover"
                mirror
                zOrder={2}
              />
            )}
            {session.isMuted && (
              <View style={styles.selfMutedBadge}>
                <KISIcon name="mic-off" size={11} color={palette.danger} />
              </View>
            )}
            {virtualBgOption && virtualBgOption.mode !== 'none' && (
              <View style={styles.selfVbgBadge}>
                <Text style={styles.selfVbgBadgeText}>You only</Text>
              </View>
            )}
          </TileFrame>
        </Animated.View>
      )}
    </View>
  );
}
