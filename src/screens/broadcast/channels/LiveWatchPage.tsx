// src/screens/broadcast/channels/LiveWatchPage.tsx
//
// Full-screen live stream viewer and VOD replay page.
// Handles four stream states: scheduled (countdown), live (HLS player),
// ended (replay), and failed/cancelled (error card).
//
// Layout: Video fills the entire screen; all UI floats as overlays.
// Chat panel anchors to the bottom-right; reactions float upward on tap.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Video from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KISIcon } from '@/constants/kisIcons';
import { resolveBackendAssetUrl } from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useLiveStream } from './hooks/useLiveStream';
import LiveChatPanel from './components/LiveChatPanel';
import SuperChatPanel from './components/SuperChatPanel';
import LivePollsPanel from './LivePollsPanel';
import LiveQAPanel from './LiveQAPanel';
import SubscribeBellButton from './components/SubscribeBellButton';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

// ── Helpers ───────────────────────────────────────────────────────────────────

const REACTIONS = ['❤️', '😂', '😮', '👏', '🙏'];

function formatCountdown(targetIso: string): string {
  const diff = Math.max(0, new Date(targetIso).getTime() - Date.now());
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function useCountdown(targetIso?: string | null) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!targetIso) return;
    const tick = () => setLabel(formatCountdown(targetIso));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return label;
}

// ── Floating reaction ─────────────────────────────────────────────────────────

type FloatingEmoji = { id: number; emoji: string; x: number; anim: Animated.Value };

function FloatingReactions({ reactions }: { reactions: FloatingEmoji[] }) {
  return (
    <>
      {reactions.map(r => (
        <Animated.Text
          key={r.id}
          style={[
            { position: 'absolute', bottom: 0, fontSize: 28 },
            {
              left: r.x,
              transform: [
                {
                  translateY: r.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -180],
                  }),
                },
              ],
              opacity: r.anim.interpolate({
                inputRange: [0, 0.7, 1],
                outputRange: [1, 1, 0],
              }),
            },
          ]}
        >
          {r.emoji}
        </Animated.Text>
      ))}
    </>
  );
}

// ── Status overlays ───────────────────────────────────────────────────────────

function ScheduledOverlay({
  title,
  countdown,
  channelName,
  thumb,
  palette,
  styles,
}: {
  title: string;
  countdown: string;
  channelName?: string;
  thumb?: string;
  palette: any;
  styles: any;
}) {
  return (
    <View style={StyleSheet.absoluteFillObject}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={[palette.royalInk, palette.royalInk, palette.surfaceElevated ?? palette.royalInk]}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
      <View style={styles.scheduledContent}>
        {channelName ? (
          <Text style={styles.scheduledChannel}>{channelName}</Text>
        ) : null}
        <Text style={styles.scheduledTitle}>{title}</Text>
        <View style={styles.countdownBox}>
          <KISIcon name="call-history" size={16} color={palette.ivory} />
          <Text style={styles.countdownLabel}>Starting in</Text>
          <Text style={styles.countdownTime}>{countdown || '--:--'}</Text>
        </View>
      </View>
    </View>
  );
}

function EndedOverlay({
  title,
  palette,
  styles,
  onPlayReplay,
}: {
  title: string;
  palette: any;
  styles: any;
  onPlayReplay: () => void;
}) {
  return (
    <View style={[styles.endedOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
      <KISIcon name="video" size={40} color={palette.ivory} />
      <Text style={styles.endedTitle}>{title}</Text>
      <Text style={styles.endedSub}>This stream has ended</Text>
      <Pressable
        onPress={onPlayReplay}
        style={[styles.replayBtn, { backgroundColor: palette.primary }]}
      >
        <KISIcon name="play" size={16} color={palette.onPrimary} />
        <Text style={styles.replayBtnText}>Watch Replay</Text>
      </Pressable>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function LiveWatchPage() {
  const route = useRoute<RouteProp<RootStackParamList, 'LiveWatch'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'LiveWatch'>>();
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const streamId: string = route.params?.streamId ?? route.params?.stream?.id ?? '';

  const { stream, loading, viewerCount, chatMessages, sendChatMessage } =
    useLiveStream(streamId);

  const pinnedMessage = chatMessages.find(m => m.is_pinned) ?? null;
  const slowModeSecs: number = (stream?.metadata?.slow_mode_seconds as number) ?? 0;
  const membersOnly: boolean = Boolean(stream?.metadata?.members_only);

  const countdown = useCountdown(stream?.scheduled_start_at);

  const thumb = useMemo(
    () => resolveBackendAssetUrl(stream?.thumbnail_url ?? ''),
    [stream?.thumbnail_url],
  );

  // ── Player state ────────────────────────────────────────────────────────────
  const [paused,        setPaused]        = useState(false);
  const [buffering,     setBuffering]     = useState(false);
  const [videoError,    setVideoError]    = useState<string | null>(null);
  const [showReplay,    setShowReplay]    = useState(false);
  const [chatOpen,      setChatOpen]      = useState(true);
  const [activePanel,   setActivePanel]   = useState<'chat' | 'polls' | 'qa'>('chat');
  const [superChatOpen, setSuperChatOpen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playbackUrl = useMemo(() => {
    if (stream?.status === 'live') return stream.playback_url ?? null;
    if (stream?.status === 'ended' && showReplay) return stream.replay_url ?? null;
    return null;
  }, [stream?.status, stream?.playback_url, stream?.replay_url, showReplay]);

  // ── Controls auto-hide ──────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 4000);
  }, []);

  useEffect(() => {
    showControls();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  // ── Reactions ───────────────────────────────────────────────────────────────
  const [floaters, setFloaters] = useState<FloatingEmoji[]>([]);
  const nextId = useRef(0);

  const sendReaction = useCallback((emoji: string) => {
    const id = nextId.current++;
    const x = 20 + Math.random() * (SCREEN_W * 0.35);
    const anim = new Animated.Value(0);
    setFloaters(prev => [...prev.slice(-8), { id, emoji, x, anim }]);
    Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: true }).start(() => {
      setFloaters(prev => prev.filter(r => r.id !== id));
    });
  }, []);

  // ── Share ───────────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!stream) return;
    await Share.share({
      title: stream.title,
      message: `Watch "${stream.title}" live on KIS`,
    });
  }, [stream]);

  // ── Loading / initial state ─────────────────────────────────────────────────
  if (loading && !stream) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.royalInk }]}>
        <StatusBar barStyle="light-content" backgroundColor={palette.royalInk} />
        <ActivityIndicator color={palette.ivory} size="large" />
      </View>
    );
  }

  const status = stream?.status ?? 'scheduled';
  const isLive = status === 'live';
  const isEnded = status === 'ended';
  const isFailed = status === 'failed' || status === 'cancelled';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={palette.royalInk} translucent />

      {/* ── Video / background layer ── */}
      <Pressable style={StyleSheet.absoluteFillObject} onPress={showControls}>
        {playbackUrl ? (
          <Video
            source={{ uri: playbackUrl }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            paused={paused}
            controls={false}
            repeat={false}
            bufferConfig={{
              minBufferMs: 1500,
              maxBufferMs: 10000,
              bufferForPlaybackMs: 1000,
              bufferForPlaybackAfterRebufferMs: 2000,
            }}
            onBuffer={({ isBuffering }) => setBuffering(isBuffering)}
            onError={(e) => setVideoError(e?.error?.localizedDescription ?? 'Playback error')}
            onLoad={() => { setBuffering(false); setVideoError(null); }}
          />
        ) : status === 'scheduled' ? (
          <ScheduledOverlay
            title={stream?.title ?? 'Upcoming stream'}
            countdown={countdown}
            channelName={stream?.channel?.display_name}
            thumb={thumb || undefined}
            palette={palette}
            styles={styles}
          />
        ) : (
          /* Fallback / failed / ended-not-playing thumbnail */
          <>
            {thumb ? (
              <Image source={{ uri: thumb }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            ) : (
              <LinearGradient
                colors={[palette.royalInk, palette.royalInk]}
                style={StyleSheet.absoluteFillObject}
              />
            )}
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
          </>
        )}

        {/* Buffering spinner */}
        {buffering && !videoError && (
          <View style={styles.bufferWrap} pointerEvents="none">
            <ActivityIndicator color={palette.ivory} size="large" />
          </View>
        )}

        {/* Video error */}
        {videoError && (
          <View style={styles.bufferWrap} pointerEvents="none">
            <KISIcon name="warning" size={32} color={palette.ivory} />
            <Text style={styles.errorText}>{videoError}</Text>
          </View>
        )}

        {/* Ended state (no replay yet) */}
        {isEnded && !showReplay && (
          <EndedOverlay
            title={stream?.title ?? 'Stream ended'}
            palette={palette}
            styles={styles}
            onPlayReplay={() => setShowReplay(true)}
          />
        )}

        {/* Failed / cancelled */}
        {isFailed && (
          <View style={styles.bufferWrap} pointerEvents="none">
            <KISIcon name="warning" size={36} color={palette.danger} />
            <Text style={styles.errorText}>Stream unavailable</Text>
          </View>
        )}
      </Pressable>

      {/* ── Floating reactions layer ── */}
      <View style={styles.floatLayer} pointerEvents="none">
        <FloatingReactions reactions={floaters} />
      </View>

      {/* ── Top controls overlay ── */}
      <Animated.View
        style={[
          styles.topOverlay,
          { paddingTop: topInset + (Platform.OS === 'android' ? 28 : 8) },
          { opacity: controlsVisible ? 1 : 0 },
        ]}
        pointerEvents={controlsVisible ? 'box-none' : 'none'}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.65)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={styles.topRow}>
          {/* Back */}
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={12}>
            <KISIcon name="arrow-left" size={20} color={palette.ivory} />
          </Pressable>

          {/* Title + status */}
          <View style={styles.topCenter}>
            {isLive && (
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            )}
            {isEnded && showReplay && (
              <View style={[styles.liveBadge, { backgroundColor: palette.surface }]}>
                <Text style={styles.liveBadgeText}>REPLAY</Text>
              </View>
            )}
            <Text style={styles.topTitle} numberOfLines={1}>
              {stream?.title ?? ''}
            </Text>
          </View>

          {/* Viewer count */}
          {(isLive || isEnded) && (
            <View style={styles.viewerPill}>
              <KISIcon name="people" size={12} color={palette.ivory} />
              <Text style={styles.viewerText}>
                {viewerCount.toLocaleString()}
              </Text>
            </View>
          )}

          {/* Slow mode badge */}
          {isLive && slowModeSecs > 0 && (
            <View style={styles.slowModePill}>
              <KISIcon name="call-history" size={11} color={palette.gold} />
              <Text style={styles.slowModeText}>Slow {slowModeSecs}s</Text>
            </View>
          )}

          {/* Members-only badge */}
          {isLive && membersOnly && (
            <View style={styles.membersOnlyPill}>
              <KISIcon name="people" size={11} color={palette.primaryStrong} />
              <Text style={styles.membersOnlyText}>Members</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* ── Play/Pause center tap (live only) ── */}
      {playbackUrl && controlsVisible && (
        <Pressable
          style={styles.playPauseCenter}
          onPress={() => { setPaused(p => !p); showControls(); }}
          hitSlop={20}
        >
          {paused ? (
            <View style={styles.playPauseCircle}>
              <KISIcon name="play" size={32} color={palette.ivory} />
            </View>
          ) : null}
        </Pressable>
      )}

      {/* ── Right-side action column ── */}
      <View
        style={[
          styles.rightActions,
          { bottom: insets.bottom + 90 },
        ]}
        pointerEvents="box-none"
      >
        <Pressable style={styles.actionBtn} onPress={handleShare}>
          <KISIcon name="share" size={22} color={palette.ivory} />
          <Text style={styles.actionLabel}>Share</Text>
        </Pressable>
        {isLive && streamId ? (
          <Pressable style={styles.actionBtn} onPress={() => setSuperChatOpen(true)}>
            <KISIcon name="star" size={22} color={palette.gold} />
            <Text style={[styles.actionLabel, { color: palette.gold }]}>Super Chat</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ── Bottom overlay: reactions + subscribe ── */}
      <View
        style={[
          styles.bottomOverlay,
          { paddingBottom: insets.bottom + 10 },
        ]}
        pointerEvents="box-none"
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.72)']}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Subscribe row */}
        {stream?.channel && (
          <View style={styles.subscribeRow} pointerEvents="box-none">
            <View style={styles.channelInfo}>
              {stream.channel.avatar_url ? (
                <Image
                  source={{ uri: resolveBackendAssetUrl(stream.channel.avatar_url) }}
                  style={styles.channelAvatar}
                />
              ) : (
                <View style={[styles.channelAvatar, { backgroundColor: palette.primary }]}>
                  <KISIcon name="broadcast" size={14} color={palette.onPrimary} />
                </View>
              )}
              <Text style={styles.channelName} numberOfLines={1}>
                {stream.channel.display_name}
              </Text>
            </View>
            <SubscribeBellButton
              channelId={stream.channel.id}
              initialSubscribed={stream.channel.is_subscribed}
              compact
            />
          </View>
        )}

        {/* Stream title (bottom) */}
        <Text style={styles.bottomTitle} numberOfLines={2}>
          {stream?.title ?? ''}
        </Text>

        {/* Reactions strip */}
        {(isLive || isEnded) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.reactionsRow}
            style={styles.reactionsScroll}
          >
            {REACTIONS.map(emoji => (
              <Pressable
                key={emoji}
                style={styles.reactionPill}
                onPress={() => sendReaction(emoji)}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Pinned message banner ── */}
      {pinnedMessage && (
        <View
          style={[
            styles.pinnedBanner,
            { bottom: insets.bottom + (chatOpen ? 280 : 110) },
          ]}
          pointerEvents="none"
        >
          <KISIcon name="pin" size={13} color={palette.gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pinnedLabel}>Pinned message</Text>
            <Text style={styles.pinnedText} numberOfLines={2}>{pinnedMessage.text}</Text>
          </View>
        </View>
      )}

      {/* ── Bottom panel (chat / polls / Q&A tabs) ── */}
      {(isLive || isEnded) && (
        <View style={styles.bottomPanelWrap}>
          {/* Tab selector */}
          <View style={styles.panelTabRow}>
            {([
              { key: 'chat',  label: 'Chat',  icon: 'comment'  },
              { key: 'polls', label: 'Polls', icon: 'list'     },
              { key: 'qa',    label: 'Q&A',   icon: 'audio'    },
            ] as const).map(tab => (
              <Pressable
                key={tab.key}
                onPress={() => { setActivePanel(tab.key); setChatOpen(true); }}
                style={[
                  styles.panelTab,
                  activePanel === tab.key && styles.panelTabActive,
                ]}
              >
                <KISIcon
                  name={tab.icon}
                  size={13}
                  color={activePanel === tab.key ? palette.primaryStrong : palette.divider}
                />
                <Text
                  style={[
                    styles.panelTabLabel,
                    { color: activePanel === tab.key ? palette.primaryStrong : palette.divider },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Active panel content */}
          {activePanel === 'chat' && (
            <LiveChatPanel
              messages={chatMessages}
              onSend={sendChatMessage}
              palette={palette}
              disabled={!isLive}
              collapsed={!chatOpen}
              onToggleCollapse={() => setChatOpen(o => !o)}
            />
          )}
          {activePanel === 'polls' && streamId ? (
            <View style={[styles.sidePanelWrap, { backgroundColor: 'rgba(0,0,0,0.75)' }]}>
              <LivePollsPanel
                streamId={streamId}
                isManager={false}
                palette={palette}
              />
            </View>
          ) : null}
          {activePanel === 'qa' && streamId ? (
            <View style={[styles.sidePanelWrap, { backgroundColor: 'rgba(0,0,0,0.75)' }]}>
              <LiveQAPanel
                streamId={streamId}
                isManager={false}
                palette={palette}
              />
            </View>
          ) : null}
        </View>
      )}

      {/* ── Super Chat modal ── */}
      {streamId ? (
        <SuperChatPanel
          streamId={streamId}
          visible={superChatOpen}
          onClose={() => setSuperChatOpen(false)}
        />
      ) : null}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(p: any) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: p.royalInk,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // overlays
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 28,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topTitle: {
    color: p.ivory,
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    backgroundColor: p.danger,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  liveBadgeText: { color: p.onPrimary, fontSize: 10, fontWeight: '900' },
  viewerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewerText: { color: p.ivory, fontSize: 11, fontWeight: '700' },

  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 230, // leave room for chat panel
    paddingHorizontal: 14,
    paddingTop: 36,
  },
  subscribeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  channelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  channelAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  channelName: {
    color: p.ivory,
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  bottomTitle: {
    color: p.divider ?? p.ivory,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginBottom: 10,
  },
  reactionsScroll: { flexGrow: 0 },
  reactionsRow: { gap: 8, paddingBottom: 4 },
  reactionPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: { fontSize: 20 },

  rightActions: {
    position: 'absolute',
    right: 10,
    alignItems: 'center',
    gap: 18,
  },
  actionBtn: { alignItems: 'center', gap: 4 },
  actionLabel: { color: p.ivory, fontSize: 10, fontWeight: '700' },

  // play/pause center
  playPauseCenter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // buffering/error
  bufferWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    color: p.ivory,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  // float layer
  floatLayer: {
    ...StyleSheet.absoluteFillObject,
    bottom: 100,
  },
  floatingEmoji: {
    position: 'absolute',
    bottom: 0,
    fontSize: 28,
  },

  // scheduled
  scheduledContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  scheduledChannel: {
    color: p.divider ?? p.ivory,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  scheduledTitle: {
    color: p.ivory,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 28,
  },
  countdownBox: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: p.primarySoft ?? p.surface,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 18,
  },
  countdownLabel: {
    color: p.divider ?? p.ivory,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  countdownTime: {
    color: p.ivory,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 2,
  },

  // ended
  endedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  endedTitle: {
    color: p.ivory,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  endedSub: {
    color: p.divider ?? p.ivory,
    fontSize: 13,
    fontWeight: '600',
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginTop: 8,
  },
  replayBtnText: { color: p.onPrimary, fontSize: 14, fontWeight: '900' },

  slowModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: p.primaryWeak ?? p.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: p.gold,
  },
  slowModeText: { color: p.gold, fontSize: 10, fontWeight: '800' },

  membersOnlyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: p.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: p.primaryStrong,
  },
  membersOnlyText: { color: p.primaryStrong, fontSize: 10, fontWeight: '800' },

  pinnedBanner: {
    position: 'absolute',
    left: 10,
    right: 240,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: p.gold,
  },
  pinnedLabel: { color: p.gold, fontSize: 10, fontWeight: '900', marginBottom: 2 },
  pinnedText: { color: p.ivory, fontSize: 12, fontWeight: '600', lineHeight: 17 },

  // bottom panel tabs
  bottomPanelWrap: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 230,
  },
  panelTabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 0,
    overflow: 'hidden',
  },
  panelTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 4,
  },
  panelTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: p.gold,
  },
  panelTabLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  sidePanelWrap: {
    borderBottomLeftRadius: 10,
    overflow: 'hidden',
    maxHeight: 340,
  },
  });
}
