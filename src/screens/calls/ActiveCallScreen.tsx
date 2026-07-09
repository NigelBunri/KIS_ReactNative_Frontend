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
  DeviceEventEmitter,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
  StatusBar,
  Platform,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '@/theme/responsive';

import type { CallSession, CallLayout } from '@/services/calls/callTypes';
import { hasVideo, isGroupCall, REACTION_EMOJIS, callTypeLabel } from '@/services/calls/callTypes';
import { RTCView } from '@/services/calls/webRTCService';
import { audioRouteManager } from '@/services/calls/audioRouteManager';

import CallControls from './components/CallControls';
import VideoGrid from './components/VideoGrid';
import BroadcastLayout from './components/BroadcastLayout';
import ReactionsLayer from './components/ReactionsLayer';
import InCallChatSheet from './components/InCallChatSheet';
import ParticipantsSheet from './components/ParticipantsSheet';
import CallTimer from './components/CallTimer';
import NetworkQualityBars from './components/NetworkQualityBars';
import NetworkQualityBanner from './components/NetworkQualityBanner';
import WaitingRoomPanel from './components/WaitingRoomPanel';
import InviteLinkCard from './components/InviteLinkCard';
import CaptionOverlay from './components/CaptionOverlay';
import InCallPollSheet from './components/InCallPollSheet';
import InCallQASheet from './components/InCallQASheet';
import BreakoutRoomsSheet from './components/BreakoutRoomsSheet';
import VirtualBackgroundSheet, { type VirtualBgOption, VirtualBgPreview } from './components/VirtualBackgroundSheet';
import { useVirtualBg } from '@/services/calls/virtualBgService';
import RtmpSheet from './components/RtmpSheet';
import InCallWhiteboardSheet from './components/InCallWhiteboardSheet';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

const CONTROLS_HIDE_AFTER = 4000;

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
  onToggleScreenShare?: () => void;
  onAddParticipant?: () => void;
  onToggleNoiseCancellation?: () => void;
  onChatOpenChange?: (open: boolean) => void;
  onAdmitKnocker?: (userId: string) => void;
  onDenyKnocker?: (userId: string) => void;
  onPromoteParticipant?: (userId: string, role: string) => void;
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
  const [showBreakout, setShowBreakout] = useState(false);
  const [showVirtualBg, setShowVirtualBg] = useState(false);
  const [showRtmp, setShowRtmp] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [captionSending, setCaptionSending] = useState(false);
  // Keep captionSending in sync with captionsEnabled — if captions get toggled off externally, stop sending
  useEffect(() => {
    if (!session?.captionsEnabled) setCaptionSending(false);
  }, [session?.captionsEnabled]);
  const [virtualBg, setVirtualBg] = useState<VirtualBgOption>({ id: 'none', mode: 'none', label: 'None' });
  // Self-preview ref for virtual background capture
  const selfPreviewRef = useRef<any>(null);
  const { frameUri, setConfig: setVbConfig } = useVirtualBg(selfPreviewRef);
  const [addParticipantInput, setAddParticipantInput] = useState('');
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const addParticipantCb = useRef<((userIds: string[]) => void) | null>(null);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Self-preview drag state (video calls only).
  // We keep the animated values at 0 (delta) and bake the initial position into
  // setOffset so that Animated.event(dx/dy) accumulates correctly without
  // causing a position jump on the first touch.
  const selfPanX = useRef(new Animated.Value(0)).current;
  const selfPanY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // Default to bottom-right, like WhatsApp/FaceTime/Meet, clear of the
    // bottom control bar and respecting the bottom safe-area inset.
    selfPanX.setOffset(screenW - PIP_W - 16);
    selfPanY.setOffset(screenH - insets.bottom - CONTROLS_CLEARANCE - PIP_H);
    selfPanX.flattenOffset();
    selfPanY.flattenOffset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount

  // Android: listen for add-participant request emitted from SocketProvider
  useEffect(() => {
    if (Platform.OS === 'ios') return;
    const sub = DeviceEventEmitter.addListener('call.add_participant.request', ({ inviteToCall }: { inviteToCall: (ids: string[]) => void }) => {
      addParticipantCb.current = inviteToCall;
      setAddParticipantInput('');
      setShowAddParticipant(true);
    });
    return () => sub.remove();
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
        const clampedY = Math.max(topInset + 8, Math.min(rawY, screenH - insets.bottom - PIP_H - 8));
        if (clampedX !== rawX) Animated.spring(selfPanX, { toValue: clampedX, useNativeDriver: false, bounciness: 6 }).start();
        if (clampedY !== rawY) Animated.spring(selfPanY, { toValue: clampedY, useNativeDriver: false, bounciness: 6 }).start();
      },
    }),
  ).current;

  // Pulsing animation for 'dialing' state
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (session?.state === 'dialing' || session?.state === 'connecting') {
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

  // Ringback tone: plays on the caller's side while waiting for remote to answer
  useEffect(() => {
    if (session?.state === 'dialing') {
      audioRouteManager.startRingback();
      return () => audioRouteManager.stopRingback();
    }
    audioRouteManager.stopRingback();
  }, [session?.state]);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(controlsOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      setShowControls(false);
    }, CONTROLS_HIDE_AFTER);
  }, []);

  const revealControls = useCallback(() => {
    Animated.timing(controlsOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    if (session?.state === 'active') scheduleHide();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [session?.state]);

  const localParticipant = useMemo(
    () => session?.participants.find(p => p.isLocal) ?? null,
    [session?.participants],
  );
  const remoteParticipants = useMemo(
    () => session?.participants.filter(p => !p.isLocal) ?? [],
    [session?.participants],
  );
  const isHostOrCoHost = localParticipant?.role === 'host' || localParticipant?.role === 'co-host';
  const withVideo = session ? hasVideo(session.callType) : false;
  const isGroup = session ? isGroupCall(session.callType) : false;
  const isBroadcast = session?.callType === 'broadcast';
  const isActive = session?.state === 'active';
  const isConnecting = session?.state === 'connecting' || session?.state === 'dialing' || session?.state === 'reconnecting';

  const handleControlAction = useCallback((action: string) => {
    revealControls();
    switch (action) {
      case 'mute': actions.onToggleMute(); break;
      case 'video': actions.onToggleVideo(); break;
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
  }, [actions, session?.layout, revealControls]);

  const styles = useMemo(() => StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: palette.royalInk,
    },
    content: {
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

    // Self preview
    selfPreview: {
      position: 'absolute',
      width: PIP_W,
      height: PIP_H,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: `${palette.gold}80`,
      zIndex: 5,
      shadowColor: palette.gold,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 10,
    },
    selfMutedBadge: {
      position: 'absolute',
      bottom: 6,
      right: 6,
      backgroundColor: palette.overlay,
      borderRadius: 10,
      padding: 3,
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
  }), [palette, PIP_W, PIP_H]);

  if (!session) return null;

  const stateLabel = (() => {
    switch (session.state) {
      case 'dialing': return 'Calling…';
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

        {/* ── CONTENT AREA ── */}
        <TouchableWithoutFeedback onPress={revealControls}>
          <View style={styles.content}>

            {/* ── VOICE 1:1 Layout ── */}
            {!isGroup && !withVideo && (
              <VoiceOneOnOneLayout
                session={session}
                pulseAnim={pulseAnim}
                isConnecting={isConnecting}
                styles={styles}
                palette={palette}
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
              />
            )}

            {/* ── GROUP / VIDEO GROUP ── */}
            {isGroup && !isBroadcast && (
              <VideoGrid
                participants={session.participants}
                layout={session.layout}
                pinnedUserId={session.pinnedUserId}
                activeSpeakerId={session.activeSpeakerId}
                isAudioOnly={!withVideo}
                onPinParticipant={actions.onPinParticipant}
              />
            )}

            {/* ── BROADCAST ── */}
            {isBroadcast && (
              <BroadcastLayout
                participants={session.participants}
                viewerCount={session.viewerCount ?? 0}
                isRecording={session.isRecording ?? false}
                activeSpeakerId={session.activeSpeakerId}
                liveStartedAt={session.liveStartedAt}
                onPressParticipant={uid => actions.onPinParticipant(uid)}
              />
            )}

            {/* ── Reactions floating layer ── */}
            <ReactionsLayer reactions={session.reactions} width={screenW} height={screenH} />

          </View>
        </TouchableWithoutFeedback>

        {/* ── Network Quality Banner ── */}
        <NetworkQualityBanner quality={session.networkQuality} isAudioOnly={session.isAudioOnly} />

        {/* ── TOP HUD ── */}
        <Animated.View
          style={[styles.topHud, { paddingTop: topInset + 8, opacity: controlsOpacity }]}
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
            <NetworkQualityBars quality={session.networkQuality} size={16} />
            <Text style={styles.callTypeChip}>{callTypeLabel(session.callType)}</Text>
          </View>
        </Animated.View>

        {/* ── Waiting room (host sees knocking users) ── */}
        {isHostOrCoHost && (session.knockingUsers?.length ?? 0) > 0 && (
          <WaitingRoomPanel
            knockingUsers={session.knockingUsers ?? []}
            onAdmit={uid => actions.onAdmitKnocker?.(uid)}
            onDeny={uid => actions.onDenyKnocker?.(uid)}
          />
        )}

        {/* ── BOTTOM: Controls ── */}
        <Animated.View style={{ opacity: controlsOpacity }}>
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
          isHost={isHostOrCoHost}
          onMute={isHostOrCoHost ? actions.onMuteParticipant : undefined}
          onRemove={isHostOrCoHost ? actions.onRemoveParticipant : undefined}
          onAddParticipant={isHostOrCoHost ? actions.onAddParticipant : undefined}
          onPromote={isHostOrCoHost ? actions.onPromoteParticipant : undefined}
        />

      </View>

      {/* Invite link sheet */}
      <InviteLinkCard
        visible={showInviteLink}
        inviteLink={resolvedInviteLink ?? session.inviteLink ?? `kis://call/join/${session.inviteToken ?? ''}`}
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
        nativeProcessorAvailable={false}
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

      {/* Android: Add-participant input modal */}
      <Modal visible={showAddParticipant} transparent animationType="fade" onRequestClose={() => setShowAddParticipant(false)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 24 }}>
          <View style={{ backgroundColor: '#1B1428', borderRadius: 16, padding: 20, width: '100%' }}>
            <Text style={{ color: '#FFF4B8', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Add to Call</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#D9A875', borderRadius: 10, padding: 12, color: '#F7F1E3', fontSize: 15, marginBottom: 16 }}
              placeholder="Enter username or user ID"
              placeholderTextColor="#8A6557"
              value={addParticipantInput}
              onChangeText={setAddParticipantInput}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setShowAddParticipant(false)} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#D9A875' }}>
                <Text style={{ color: '#D9A875', fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const uid = addParticipantInput.trim();
                  if (uid && addParticipantCb.current) addParticipantCb.current([uid]);
                  setShowAddParticipant(false);
                }}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#9A6A14' }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Invite</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </Modal>
  );
}

// ── Voice 1:1 Layout ─────────────────────────────────────────────────────────

function VoiceOneOnOneLayout({ session, pulseAnim, isConnecting, styles, palette }: {
  session: CallSession;
  pulseAnim: Animated.Value;
  isConnecting: boolean;
  styles: any;
  palette: any;
}) {
  const other = session.participants.find(p => !p.isLocal);
  const initials = (other?.displayName ?? session.title)
    .trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <View style={styles.voiceLayout}>
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
          <KISIcon name="mic-off" size={14} color={palette.danger} />
          <Text style={styles.mutedText}>Muted</Text>
        </View>
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

function VideoOneOnOneLayout({ session, remoteParticipants, isConnecting, localStream, selfPanX, selfPanY, selfPan, selfPreviewRef, virtualBgFrameUri, virtualBgOption, styles, palette }: {
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
}) {
  const remote = remoteParticipants[0] ?? null;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Remote video — full screen */}
      {remote?.stream && RTCView ? (
        <RTCView
          streamURL={remote.stream.toURL()}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
          zOrder={1}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: palette.subtext, fontSize: 16 }}>
            {isConnecting ? 'Connecting…' : 'Camera off'}
          </Text>
        </View>
      )}

      {/* GAP 1: "Sharing screen" label overlay on remote participant tile */}
      {remote?.isScreenSharing && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: `${palette.success}D9`,
            paddingVertical: 6,
            alignItems: 'center',
            zIndex: 3,
          }}
        >
          <Text style={{ color: palette.ivory, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 }}>
            Sharing screen
          </Text>
        </View>
      )}

      {/* Self preview — draggable corner tile */}
      {localStream && RTCView && (
        <Animated.View
          ref={selfPreviewRef}
          style={[
            styles.selfPreview,
            { left: selfPanX, top: selfPanY },
          ]}
          {...selfPan.panHandlers}
        >
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
        </Animated.View>
      )}
    </View>
  );
}
