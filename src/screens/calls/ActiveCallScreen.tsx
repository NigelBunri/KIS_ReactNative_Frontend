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
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
  StatusBar,
  Platform,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { KISIcon } from '@/constants/kisIcons';

const CONTROLS_HIDE_AFTER = 4000;

type CallActions = {
  onEnd: () => void;
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
};

type Props = {
  session: CallSession | null;
  actions: CallActions;
};

export default function ActiveCallScreen({ session, actions }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [showControls, setShowControls] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Self-preview drag state (video calls only)
  const selfPanX = useRef(new Animated.Value(screenW - 110)).current;
  const selfPanY = useRef(new Animated.Value(insets.top + 16)).current;
  const selfPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event(
        [null, { dx: selfPanX, dy: selfPanY }],
        { useNativeDriver: false },
      ),
      onPanResponderRelease: (_, g) => {
        selfPanX.setOffset((selfPanX as any)._value ?? 0);
        selfPanY.setOffset((selfPanY as any)._value ?? 0);
        selfPanX.flattenOffset();
        selfPanY.flattenOffset();
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
      case 'chat':
        setShowChat(v => !v);
        setShowParticipants(false);
        break;
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
        if (session?.isScreenSharing) {
          Alert.alert(
            'Screen Sharing',
            'Stop sharing your screen?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Stop', style: 'destructive', onPress: () => actions.onEnd() },
            ],
          );
        } else {
          Alert.alert(
            'Share Screen',
            'Screen sharing requires enabling the screen capture permission. This feature is available on devices with react-native-webrtc >= 106.',
            [{ text: 'OK' }],
          );
        }
        break;
    }
  }, [actions, session?.layout, revealControls]);

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
            <View style={[styles.endedIcon, session.state === 'missed' && { backgroundColor: '#F59E0B33' }]}>
              <KISIcon
                name={session.state === 'missed' ? 'phone-missed' : 'phone-off'}
                size={32}
                color={session.state === 'missed' ? '#F59E0B' : '#E52B2B'}
              />
            </View>
            <Text style={styles.endedTitle}>{session.state === 'missed' ? 'Missed call' : 'Call ended'}</Text>
            {session.reason && (
              <Text style={styles.endedReason}>{session.reason}</Text>
            )}
            <CallTimer
              startedAt={session.startedAt}
              running={false}
              color="rgba(255,255,255,0.5)"
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
      <StatusBar barStyle="light-content" backgroundColor="#0D0D1A" />
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
                availableHeight={screenH}
                onPinParticipant={actions.onPinParticipant}
              />
            )}

            {/* ── BROADCAST ── */}
            {isBroadcast && (
              <BroadcastLayout
                participants={session.participants}
                viewerCount={session.viewerCount ?? 0}
                isRecording={session.isRecording ?? false}
                availableHeight={screenH}
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
        <NetworkQualityBanner quality={session.networkQuality} />

        {/* ── TOP HUD ── */}
        <Animated.View
          style={[styles.topHud, { paddingTop: insets.top + 8, opacity: controlsOpacity }]}
          pointerEvents="box-none"
        >
          <View style={styles.topLeft}>
            <Text style={styles.callTitle} numberOfLines={1}>{session.title}</Text>
            {isActive && (
              <CallTimer
                startedAt={session.startedAt}
                running
                color="rgba(255,255,255,0.7)"
                size={13}
                showDot
              />
            )}
            {stateLabel && (
              <Text style={styles.stateLabel}>{stateLabel}</Text>
            )}
          </View>
          <View style={styles.topRight}>
            <NetworkQualityBars quality={session.networkQuality} size={16} />
            <Text style={styles.callTypeChip}>{callTypeLabel(session.callType)}</Text>
          </View>
        </Animated.View>

        {/* ── BOTTOM: Controls ── */}
        <Animated.View style={{ opacity: controlsOpacity }}>
          <CallControls
            session={session}
            onAction={handleControlAction}
            onSendReaction={actions.onSendReaction}
            showReactionPicker={showReactionPicker}
            onToggleReactionPicker={() => setShowReactionPicker(v => !v)}
            unreadChat={session.unreadChatCount}
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
        />

      </View>
    </Modal>
  );
}

// ── Voice 1:1 Layout ─────────────────────────────────────────────────────────

function VoiceOneOnOneLayout({ session, pulseAnim, isConnecting }: {
  session: CallSession;
  pulseAnim: Animated.Value;
  isConnecting: boolean;
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
          <SpeakingWave />
          <Text style={styles.speakingText}>Speaking</Text>
        </View>
      )}
      {other?.isMuted && (
        <View style={styles.mutedBadge}>
          <KISIcon name="mic-off" size={14} color="#E52B2B" />
          <Text style={styles.mutedText}>Muted</Text>
        </View>
      )}
    </View>
  );
}

function SpeakingWave() {
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
        <Animated.View key={i} style={{ width: 5, borderRadius: 3, backgroundColor: '#22C55E', height: 24, transform: [{ scaleY: b }] }} />
      ))}
    </View>
  );
}

// ── Video 1:1 Layout ─────────────────────────────────────────────────────────

function VideoOneOnOneLayout({ session, remoteParticipants, isConnecting, localStream, selfPanX, selfPanY, selfPan }: {
  session: CallSession;
  remoteParticipants: any[];
  isConnecting: boolean;
  localStream: any;
  selfPanX: Animated.Value;
  selfPanY: Animated.Value;
  selfPan: any;
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
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>
            {isConnecting ? 'Connecting…' : 'Camera off'}
          </Text>
        </View>
      )}

      {/* Self preview — draggable corner tile */}
      {localStream && RTCView && (
        <Animated.View
          style={[
            styles.selfPreview,
            { left: selfPanX, top: selfPanY },
          ]}
          {...selfPan.panHandlers}
        >
          <RTCView
            streamURL={localStream.toURL()}
            style={StyleSheet.absoluteFill}
            objectFit="cover"
            mirror
            zOrder={2}
          />
          {session.isMuted && (
            <View style={styles.selfMutedBadge}>
              <KISIcon name="mic-off" size={11} color="#E52B2B" />
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D0D1A',
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
  callTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  stateLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  callTypeChip: {
    color: '#C9A227',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(201,162,39,0.15)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.3)',
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
    backgroundColor: '#B8860B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#C9A227',
    shadowColor: '#C9A227',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 14,
  },
  voiceInitials: { color: '#fff', fontSize: 44, fontWeight: '800' },
  voiceName: { color: '#fff', fontSize: 26, fontWeight: '700' },
  speakingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  speakingText: { color: '#22C55E', fontSize: 14, fontWeight: '600' },
  mutedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(229,43,43,0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mutedText: { color: '#E52B2B', fontSize: 13, fontWeight: '600' },

  // Self preview
  selfPreview: {
    position: 'absolute',
    width: 92,
    height: 132,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(201,162,39,0.5)',
    zIndex: 5,
    shadowColor: '#C9A227',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  selfMutedBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    padding: 3,
  },

  // Ended card
  endedBg: {
    flex: 1,
    backgroundColor: 'rgba(13,13,26,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endedCard: {
    backgroundColor: '#0D0D22',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    width: 300,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.25)',
    shadowColor: '#C9A227',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  endedIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(229,43,43,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  endedTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  endedReason: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  endedCloseBtn: {
    marginTop: 12,
    backgroundColor: 'rgba(201,162,39,0.15)',
    borderRadius: 18,
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.35)',
  },
  endedCloseTxt: { color: '#C9A227', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
});
