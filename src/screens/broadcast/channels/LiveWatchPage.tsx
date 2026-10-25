// src/screens/broadcast/channels/LiveWatchPage.tsx
//
// Live stream viewer and VOD replay page.
// Handles four stream states: scheduled (countdown), live (HLS player),
// ended (replay), and failed/cancelled (error card).
//
// Layout (player-first, YouTube-style information hierarchy, not an
// immersive full-bleed overlay screen):
//   1. Player, bounded to its own aspect ratio - only playback controls
//      (back/live-badge/viewer-count/fullscreen, play-pause-on-tap) and
//      reaction-tap animations float over it. No title/creator/subscribe
//      duplication lives here.
//   2. Below the player, in a single scrollable page: title + live status,
//      one creator row (avatar/name/subscribe - the only instance of it),
//      an engagement action row (reactions/share/QR/Super Chat), an
//      integrated Chat/Polls/Q&A tab row with a bounded-height panel (not
//      a screen-dimming modal), and the related-content feed.
// Reactions still animate upward over the player regardless of where the
// reaction button lives below it - see floatLayer/FloatingReactions.

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
  AppState,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Video from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KISIcon } from '@/constants/kisIcons';
import QrCodeShareModal from '@/components/common/QrCodeShareModal';
import ROUTES, { resolveBackendAssetUrl } from '@/network';
import { postRequest } from '@/network/post';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useLiveStream } from './hooks/useLiveStream';
import LiveChatPanel from './components/LiveChatPanel';
import SuperChatPanel from './components/SuperChatPanel';
import LivePollsPanel from './LivePollsPanel';
import LiveQAPanel from './LiveQAPanel';
import SubscribeBellButton from './components/SubscribeBellButton';
import RelatedContentFeed from './components/RelatedContentFeed';
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
  waitVideoUrl,
  waitVideoPaused,
  palette,
  styles,
  topInset,
}: {
  title: string;
  countdown: string;
  channelName?: string;
  thumb?: string;
  waitVideoUrl?: string | null;
  waitVideoPaused?: boolean;
  palette: any;
  styles: any;
  // Guarantees the title/countdown block never renders above the status
  // bar / Dynamic Island - confirmed as a real bug via an actual simulator
  // screenshot (not hypothetical): on a bounded 16:9 player box, pure
  // vertical centering put this content's top edge right under the clock,
  // since the box itself is short enough that centered content starts
  // near y=0 on devices with a tall inset (Dynamic Island).
  topInset: number;
}) {
  return (
    <View style={StyleSheet.absoluteFillObject}>
      {waitVideoUrl ? (
        // Broadcaster-set "wait" video: always playing/looping, never
        // gated behind a tap-to-play control, right up until the stream
        // flips to live (this overlay only renders while status is
        // 'scheduled' - see the render-branch above). Muted since there's
        // no audio mix with anything else on this screen yet.
        <Video
          source={{ uri: waitVideoUrl }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          muted
          repeat
          controls={false}
          paused={Boolean(waitVideoPaused)}
        />
      ) : thumb ? (
        <Image source={{ uri: thumb }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={[palette.royalInk, palette.royalInk, palette.surfaceElevated ?? palette.royalInk]}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
      <View style={[styles.scheduledContent, { paddingTop: Math.max(24, topInset) }]}>
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

export default function LiveWatchPage() {
  const route = useRoute<RouteProp<RootStackParamList, 'LiveWatch'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'LiveWatch'>>();
  const { palette, isDark } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  // Was a module-level Dimensions.get('window') snapshot, frozen at bundle
  // load and never updated on rotation - the floating-reaction spawn
  // x-position (sendReaction below) would keep using the portrait width's
  // left-35% even after rotating to landscape, clustering reactions in a
  // now-stale, too-narrow band instead of spreading across the actual
  // current width.
  const { width: SCREEN_W } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const streamId: string = route.params?.streamId ?? route.params?.stream?.id ?? '';

  const { stream, loading, viewerCount, chatMessages, lastReaction, sendChatMessage, deleteChatMessage, reportChatMessage, sendReaction: emitReaction } =
    useLiveStream(streamId);

  // Reuses BroadcastChannelSummarySerializer.viewer_role (already computed
  // server-side off the authenticated request, same field the channel
  // detail screen's admin UI keys off of) rather than inventing a second,
  // client-side ownership check - the backend endpoints this gates
  // (ChannelLiveChatMessageModerationView, ChannelLiveChatBansView) are the
  // real authorization boundary regardless; this only controls whether the
  // Delete affordance appears in the long-press sheet.
  const canModerateChat = ['owner', 'manager', 'moderator', 'staff'].includes(
    stream?.channel?.viewer_role ?? '',
  );

  const pinnedMessage = chatMessages.find(m => m.is_pinned) ?? null;
  const slowModeSecs: number = (stream?.metadata?.slow_mode_seconds as number) ?? 0;
  const membersOnly: boolean = Boolean(stream?.metadata?.members_only);

  const countdown = useCountdown(stream?.scheduled_start_at);

  const isWaitVideo = stream?.thumbnail_media_type === 'video';

  // A static image: used both as the scheduled-screen background and the
  // fallback/failed/ended-not-playing thumbnail elsewhere on this screen.
  const thumb = useMemo(
    () => (isWaitVideo ? '' : resolveBackendAssetUrl(stream?.thumbnail_url ?? '')),
    [stream?.thumbnail_url, isWaitVideo],
  );

  // A looping "wait" video: scheduled-screen only (see ScheduledOverlay) -
  // never used as the generic fallback thumbnail elsewhere on this screen,
  // since those surfaces only ever render a static <Image>.
  const waitVideoUrl = useMemo(
    () => (isWaitVideo ? resolveBackendAssetUrl(stream?.thumbnail_url ?? '') : null),
    [stream?.thumbnail_url, isWaitVideo],
  );

  // ── Player state ────────────────────────────────────────────────────────────
  const [paused,        setPaused]        = useState(false);
  const [buffering,     setBuffering]     = useState(false);
  const [videoError,    setVideoError]    = useState<string | null>(null);
  const [showReplay,    setShowReplay]    = useState(false);
  // The player used to be a single StyleSheet.absoluteFillObject layer
  // filling the entire device screen, with every control floating over
  // it - the "immersive by default" pattern this whole redesign moves
  // away from (see styles.playerBox below). resizeMode was "cover" too,
  // which crops whatever doesn't fit a 9:16-ish frame - fine for a
  // full-bleed layout, wrong once the player is a bounded, aspect-ratio-
  // respecting box (cropping a broadcaster's actual content to fill an
  // arbitrary box is exactly what "never crop to fill the container"
  // rules out). videoAspectRatio defaults to 16:9 (the common case) and
  // is corrected once the real source dimensions are known via onLoad's
  // naturalSize - a portrait or square broadcast gets a correctly
  // proportioned box instead of being squeezed into a landscape one.
  const videoRef = useRef<any>(null);
  const [videoAspectRatio, setVideoAspectRatio] = useState(16 / 9);
  const handleEnterFullscreen = useCallback(() => {
    // react-native-video's own native presentFullscreenPlayer - the same
    // proven approach ChannelContentDetailPage's VideoPlayerControls
    // already uses for recorded videos (see its own comment there). This
    // hands off to the OS's native fullscreen video presentation, which
    // handles landscape rotation and safe-area chrome itself - the app's
    // own navigation/orientation policy is never touched, so there's no
    // risk of this leaking into a global landscape mode the rest of the
    // app isn't built for.
    videoRef.current?.presentFullscreenPlayer?.();
  }, []);
  // Chat/Polls/Q&A now live in an integrated tab row below the player (see
  // styles.interactionCard) rather than behind a FAB opening a screen-
  // dimming Modal - interactionPanelOpen lets a viewer collapse it back to
  // just the tab row without losing their place in the player/engagement
  // row above it.
  const [interactionPanelOpen, setInteractionPanelOpen] = useState(true);
  const [activePanel,   setActivePanel]   = useState<'chat' | 'polls' | 'qa'>('chat');
  const [superChatOpen, setSuperChatOpen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // playPauseCenter (the invisible tap-to-pause Pressable rendered below,
  // scoped to the player box) used to also need clamping against a FAB and
  // a bottom overlay that both floated inside the player box - neither
  // exists any more (every control that isn't playback chrome now lives
  // below the player, in the normal page flow), so this only needs to
  // avoid topOverlay's back/live-badge/viewer-count/fullscreen row.
  const [topOverlayBottom, setTopOverlayBottom] = useState(90);

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

  // Pure local animation - used both for this viewer's own tap (instant,
  // no network round-trip needed to see your own reaction) and for an
  // incoming reaction from someone else (lastReaction effect below).
  const animateReaction = useCallback((emoji: string) => {
    const id = nextId.current++;
    const x = 20 + Math.random() * (SCREEN_W * 0.35);
    const anim = new Animated.Value(0);
    setFloaters(prev => [...prev.slice(-8), { id, emoji, x, anim }]);
    Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: true }).start(() => {
      setFloaters(prev => prev.filter(r => r.id !== id));
    });
  }, [SCREEN_W]);

  // Tap handler (D6 of the YouTube-parity batch): animates immediately,
  // and separately notifies the server so every other viewer in the
  // stream room sees the same burst (see channel.live.reaction in
  // backend/Nestjs/src/realtime/handlers/live.ts) - previously this only
  // ever animated on the tapping viewer's own screen.
  const sendReaction = useCallback((emoji: string) => {
    animateReaction(emoji);
    emitReaction(emoji);
  }, [animateReaction, emitReaction]);

  useEffect(() => {
    if (lastReaction) animateReaction(lastReaction.emoji);
  }, [lastReaction, animateReaction]);

  // ── Share ───────────────────────────────────────────────────────────────────
  // No public URL was ever actually passed to Share.share here — previously
  // message-only, so the share sheet (and anything downstream of it, like a
  // QR code) had nothing real to point at. `kis.app` was also never a real
  // deep-link domain - it isn't in NavigationContainer's `linking.prefixes`
  // (App.tsx), so even with a route mapping this URL could never have
  // opened the app at all. kingdomimpactventures.org is the real registered
  // domain (same pattern BroadcastDetailScreen.tsx already uses for its own
  // share URL), matched here by the new `LiveWatch: 'live/:streamId'` entry
  // added to that same linking config.
  const streamShareUrl = streamId ? `https://kingdomimpactventures.org/live/${streamId}` : '';

  const handleShare = useCallback(async () => {
    if (!stream) return;
    await Share.share({
      title: stream.title,
      message: `Watch "${stream.title}" live on KIS${streamShareUrl ? `: ${streamShareUrl}` : ''}`,
      url: streamShareUrl || undefined,
    });
  }, [stream, streamShareUrl]);

  const [showQr, setShowQr] = useState(false);

  // Pauses playback (audio included) when this screen loses focus or the
  // app backgrounds — same caller-owned useIsFocused()/AppState convention
  // VideoPlayer.tsx's `externalPause` doc comment already establishes for
  // BroadcastFeedVideoPreview.tsx/BroadcastDetailScreen.tsx. This screen
  // uses react-native-video's <Video> directly rather than that wrapper,
  // but was the one caller of player UI in this app with no focus/
  // background gate at all — previously the HLS stream (audio included)
  // kept playing after navigating away or backgrounding, exactly the bug
  // that convention exists to prevent elsewhere.
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    return () => sub.remove();
  }, []);
  const effectivePaused = paused || !isFocused || !appActive;

  // Forces a clean <Video> remount to re-establish the HLS connection.
  // Previously onError just set videoError and stopped — nothing ever
  // retried, so a transient manifest/network blip left the viewer stuck on
  // a permanent error card for the rest of the broadcast with no way back
  // in short of leaving and re-entering the screen.
  const [reloadKey, setReloadKey] = useState(0);
  const handleRetryPlayback = useCallback(() => {
    setVideoError(null);
    setBuffering(true);
    setReloadKey(k => k + 1);
  }, []);

  // A changed playback_url deserves a fresh attempt regardless of
  // whatever error is currently showing - without this, a viewer who
  // opened the screen before the broadcaster's stream got reprovisioned
  // (e.g. a stream-key rotation, or kisvideo-live's ingest-proxy
  // assigning a new path) stayed stuck on the OLD error card forever,
  // even once the new URL was confirmed working server-side, because
  // nothing except a manual "Tap to retry" tap ever cleared videoError -
  // polling updates `stream.playback_url` in state just fine, but the
  // <Video> below only reloads cleanly on a `reloadKey` bump.
  useEffect(() => {
    setVideoError(null);
    // Only an actual playbackUrl mounts a <Video> that will ever fire
    // onLoad/onBuffer to clear this - confirmed via a real device test
    // (not assumed): setting this unconditionally left the buffering
    // spinner stuck permanently visible over the scheduled/ended-without-
    // replay/failed states, which render NO <Video> at all, so nothing
    // was ever there to turn it back off.
    setBuffering(Boolean(playbackUrl));
    setReloadKey(k => k + 1);
  }, [playbackUrl]);

  // E4 of the analytics batch: reports playback failures back to Django so
  // they show up somewhere instead of only ever existing as this client-
  // local retry. Fire-and-forget - never blocks the retry UX on it.
  // "startup_failure" vs "playback_error" distinguishes a stream that never
  // played at all from one that dropped mid-watch, mirroring this app's
  // honesty bar elsewhere (don't conflate different failure shapes).
  const hasLoadedOnceRef = useRef(false);
  const reportPlaybackEvent = useCallback((reason: string) => {
    if (!streamId) return;
    const event = hasLoadedOnceRef.current ? 'playback_error' : 'startup_failure';
    void postRequest(
      ROUTES.broadcasts.liveStreamPlaybackEvent(streamId),
      { event, reason: reason.slice(0, 300) },
      { errorMessage: '' },
    );
  }, [streamId]);

  // A real HLS manifest/segment either loads within a few seconds or it
  // isn't going to - without this, a genuinely stuck connection (DNS,
  // a captive portal, a manifest that 404s in a way the player's own
  // error handler never fires for) just spun the buffering indicator
  // forever with no way out except leaving the screen. 15s is generous
  // for a live HLS start (segments here are 2s each, see kisvideo-live's
  // mediamtx.yml) while still bounding the worst case to something a
  // viewer won't give up and leave over.
  useEffect(() => {
    if (!buffering || videoError) return;
    const timer = setTimeout(() => {
      setVideoError('Taking too long to load. Check your connection and try again.');
      setBuffering(false);
      reportPlaybackEvent('buffering_timeout');
    }, 15_000);
    return () => clearTimeout(timer);
  }, [buffering, videoError, reportPlaybackEvent]);

  // ── Loading / initial state ─────────────────────────────────────────────────
  if (loading && !stream) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={palette.bg} />
        <ActivityIndicator color={palette.text} size="large" />
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

      {/* ── Player box: bounded to the video's own aspect ratio, not the
          whole device screen - fullscreen is now the explicit button
          below, never the default presentation. ── */}
      <View style={[styles.playerBox, { aspectRatio: videoAspectRatio }]}>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={showControls}>
        {playbackUrl ? (
          <Video
            ref={videoRef}
            key={reloadKey}
            source={{ uri: playbackUrl }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="contain"
            paused={effectivePaused}
            controls={false}
            repeat={false}
            bufferConfig={{
              minBufferMs: 1500,
              maxBufferMs: 10000,
              bufferForPlaybackMs: 1000,
              bufferForPlaybackAfterRebufferMs: 2000,
            }}
            onBuffer={({ isBuffering }) => setBuffering(isBuffering)}
            onLoad={(e: any) => {
              setBuffering(false);
              setVideoError(null);
              hasLoadedOnceRef.current = true;
              const w = e?.naturalSize?.width;
              const h = e?.naturalSize?.height;
              if (w && h && w > 0 && h > 0) setVideoAspectRatio(w / h);
            }}
            onError={(e) => {
              const reason = e?.error?.localizedDescription ?? 'Playback error';
              setVideoError(reason);
              reportPlaybackEvent(reason);
            }}
          />
        ) : status === 'scheduled' ? (
          <ScheduledOverlay
            title={stream?.title ?? 'Upcoming stream'}
            countdown={countdown}
            channelName={stream?.channel?.display_name}
            thumb={thumb || undefined}
            waitVideoUrl={waitVideoUrl}
            waitVideoPaused={effectivePaused}
            palette={palette}
            styles={styles}
            topInset={topInset}
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
          <View style={styles.bufferWrap} pointerEvents="box-none">
            <KISIcon name="warning" size={32} color={palette.ivory} />
            <Text style={styles.errorText}>{videoError}</Text>
            <Pressable onPress={handleRetryPlayback} hitSlop={12}>
              <Text style={[styles.errorText, { textDecorationLine: 'underline', marginTop: 8 }]}>
                Tap to retry
              </Text>
            </Pressable>
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
        onLayout={(e) => setTopOverlayBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.65)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={styles.topRow}>
          {/* Back */}
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
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

          {/* Explicit fullscreen control - the only way the video ever
              goes fullscreen now; see handleEnterFullscreen's own
              comment for why this hands off to the native player API
              rather than anything that touches app-wide orientation. */}
          {playbackUrl ? (
            <Pressable
              onPress={handleEnterFullscreen}
              style={styles.iconBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Enter fullscreen"
            >
              <KISIcon name="fullscreen" size={18} color={palette.ivory} />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>

      {/* ── Play/Pause center tap (live only) - only needs to avoid
          topOverlay now; nothing else floats inside the player box. ── */}
      {playbackUrl && controlsVisible && (
        <Pressable
          style={[
            styles.playPauseCenter,
            { top: topOverlayBottom },
          ]}
          onPress={() => { setPaused(p => !p); showControls(); }}
          hitSlop={20}
          accessibilityRole="button"
          accessibilityLabel={paused ? 'Resume playback' : 'Pause playback'}
        >
          {paused ? (
            <View style={styles.playPauseCircle}>
              <KISIcon name="play" size={32} color={palette.ivory} />
            </View>
          ) : null}
        </Pressable>
      )}

      {/* ── Pinned message banner - scoped to the player box now, same as
          the other floating controls, instead of a full-screen-relative
          offset that no longer means anything once the player is
          bounded. ── */}
      {pinnedMessage && (
        <View
          style={[styles.pinnedBanner, { top: 56, right: 10, left: 10 }]}
          pointerEvents="none"
        >
          <KISIcon name="pin" size={13} color={palette.gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pinnedLabel}>Pinned message</Text>
            <Text style={styles.pinnedText} numberOfLines={2}>{pinnedMessage.text}</Text>
          </View>
        </View>
      )}
      </View>
      {/* ── playerBox ends here - everything above is bounded to the
          video's own aspect ratio; everything below is a normal
          scrollable page, not floating overlay chrome. ── */}

      <ScrollView
        style={styles.belowPlayer}
        contentContainerStyle={[styles.belowPlayerContent, { paddingBottom: insets.bottom + 24 }]}
      >
        {/* ── Title + live status/metadata line ── */}
        <Text style={styles.pageTitle}>{stream?.title ?? ''}</Text>
        <View style={styles.statusLine}>
          {isLive && <View style={[styles.liveDot, { backgroundColor: palette.danger }]} />}
          <Text style={styles.statusLineText} numberOfLines={1}>
            {isLive
              ? `Live · ${viewerCount.toLocaleString()} watching`
              : isEnded
                ? (showReplay ? `Replay · ${viewerCount.toLocaleString()} views` : 'Stream ended')
                : isFailed
                  ? 'Unavailable'
                  : `Starts in ${countdown || '--:--'}`}
          </Text>
        </View>

        {/* ── Creator row - the only instance of channel identity/subscribe
            on this screen (previously duplicated over the video too). ── */}
        {stream?.channel ? (
          <View style={styles.creatorRow}>
            <Pressable
              style={styles.channelInfo}
              onPress={() => navigation.navigate('ChannelHome', { channelId: stream.channel!.id, channel: stream.channel })}
              accessibilityRole="button"
              accessibilityLabel={`Open ${stream.channel.display_name}'s channel`}
            >
              {stream.channel.avatar_url ? (
                <Image
                  source={{ uri: resolveBackendAssetUrl(stream.channel.avatar_url) }}
                  style={styles.channelAvatarLarge}
                />
              ) : (
                <View style={[styles.channelAvatarLarge, { backgroundColor: palette.primary }]}>
                  <KISIcon name="broadcast" size={16} color={palette.onPrimary} />
                </View>
              )}
              <Text style={styles.channelName} numberOfLines={1}>
                {stream.channel.display_name}
              </Text>
            </Pressable>
            <SubscribeBellButton
              channelId={stream.channel.id}
              initialSubscribed={stream.channel.is_subscribed}
              compact
            />
          </View>
        ) : null}

        {/* ── Description ── */}
        {stream?.description ? (
          <Text style={styles.pageDescription}>
            {stream.description}
          </Text>
        ) : null}

        {/* ── Engagement action row: reactions, share, QR, Super Chat -
            every supported action in one deliberate row, no duplicate
            subscribe/floating buttons elsewhere on the screen. ── */}
        {(isLive || isEnded) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.engagementRow}
          >
            {REACTIONS.map(emoji => (
              <Pressable
                key={emoji}
                style={styles.engagementReactionBtn}
                onPress={() => sendReaction(emoji)}
                accessibilityRole="button"
                accessibilityLabel={`React with ${emoji}`}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.engagementBtn}
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel="Share stream"
            >
              <KISIcon name="share" size={16} color={palette.text} />
              <Text style={styles.engagementBtnLabel}>Share</Text>
            </Pressable>
            <Pressable
              style={styles.engagementBtn}
              onPress={() => setShowQr(true)}
              accessibilityRole="button"
              accessibilityLabel="QR code for stream"
            >
              <KISIcon name="qr-code" size={16} color={palette.text} />
              <Text style={styles.engagementBtnLabel}>QR Code</Text>
            </Pressable>
            {isLive && streamId ? (
              <Pressable
                style={styles.engagementBtn}
                onPress={() => setSuperChatOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Send Super Chat"
              >
                <KISIcon name="star" size={16} color={palette.gold} />
                <Text style={styles.engagementBtnLabel}>Super Chat</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        )}

        {/* ── Integrated Chat/Polls/Q&A: a tab row + bounded-height panel
            in the normal page flow, not a FAB opening a screen-dimming
            Modal. Collapsible so a viewer can shrink it back to just the
            tab row without losing player/engagement-row context above. ── */}
        {(isLive || isEnded) && streamId ? (
          <View style={styles.interactionCard}>
            <View style={styles.interactionTabRow}>
              {([
                { key: 'chat',  label: 'Chat',  icon: 'comment' },
                { key: 'polls', label: 'Polls', icon: 'list'    },
                { key: 'qa',    label: 'Q&A',   icon: 'audio'   },
              ] as const).map(tab => {
                const active = activePanel === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => { setActivePanel(tab.key); setInteractionPanelOpen(true); }}
                    style={[
                      styles.interactionTab,
                      active && interactionPanelOpen && { borderBottomColor: palette.primaryStrong },
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active && interactionPanelOpen }}
                    accessibilityLabel={tab.label}
                  >
                    <KISIcon
                      name={tab.icon}
                      size={14}
                      color={active && interactionPanelOpen ? palette.primaryStrong : palette.subtext}
                    />
                    <Text
                      style={[
                        styles.interactionTabLabel,
                        { color: active && interactionPanelOpen ? palette.primaryStrong : palette.subtext },
                      ]}
                    >
                      {tab.label}
                    </Text>
                    {tab.key === 'chat' && chatMessages.length > 0 && (
                      <View style={[styles.interactionTabBadge, { backgroundColor: palette.danger }]}>
                        <Text style={styles.interactionTabBadgeText}>
                          {chatMessages.length > 99 ? '99+' : chatMessages.length}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setInteractionPanelOpen(o => !o)}
                style={styles.interactionCollapseBtn}
                accessibilityRole="button"
                accessibilityLabel={interactionPanelOpen ? 'Collapse panel' : 'Expand panel'}
              >
                <KISIcon name={interactionPanelOpen ? 'chevron-up' : 'chevron-down'} size={16} color={palette.subtext} />
              </Pressable>
            </View>

            {interactionPanelOpen && (
              <View style={styles.interactionPanelBody}>
                {activePanel === 'chat' && (
                  <LiveChatPanel
                    messages={chatMessages}
                    onSend={sendChatMessage}
                    palette={palette}
                    disabled={!isLive}
                    collapsed={false}
                    onToggleCollapse={() => setInteractionPanelOpen(false)}
                    canModerate={canModerateChat}
                    onDeleteMessage={deleteChatMessage}
                    onReportMessage={reportChatMessage}
                  />
                )}
                {activePanel === 'polls' ? (
                  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
                    <LivePollsPanel
                      streamId={streamId}
                      isManager={canModerateChat}
                      palette={palette}
                    />
                  </ScrollView>
                ) : null}
                {activePanel === 'qa' ? (
                  <LiveQAPanel
                    streamId={streamId}
                    isManager={canModerateChat}
                    palette={palette}
                  />
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        {/* ── Related content: YouTube-style recommendation feed, ranked
            primarily by topic relevance - see RelatedContentFeed.tsx. ── */}
        {streamId ? <RelatedContentFeed streamId={streamId} palette={palette} /> : null}
      </ScrollView>

      {/* ── Super Chat modal ── */}
      {streamId ? (
        <SuperChatPanel
          streamId={streamId}
          visible={superChatOpen}
          onClose={() => setSuperChatOpen(false)}
        />
      ) : null}

      <QrCodeShareModal
        visible={showQr}
        onClose={() => setShowQr(false)}
        link={streamShareUrl}
        title="Stream QR code"
        subtitle={`Anyone who scans this can watch "${stream?.title || 'this stream'}".`}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(p: any) {
  return StyleSheet.create({
  // The page itself (everything below the player) follows the app's real
  // light/dark theme via `p.bg`/`p.text`/etc, same as any other screen -
  // only the player box and its own overlays (which sit on top of actual
  // video/thumbnail content, not the page background) stay fixed-dark
  // below, the same way a video player's chrome does in most apps
  // regardless of the host app's theme.
  root: {
    flex: 1,
    backgroundColor: p.bg,
  },
  // Bounded to the video's own aspect ratio (set inline via
  // `aspectRatio`, not here) instead of filling the screen - every
  // floating control (top bar, reactions, FAB, pinned banner) nests
  // inside this box now, so their existing position:'absolute' styles
  // scope to it automatically rather than the whole device.
  playerBox: {
    width: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  belowPlayer: {
    flex: 1,
  },
  belowPlayerContent: {
    padding: 16,
    gap: 10,
  },
  pageTitle: {
    color: p.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  pageDescription: {
    color: p.subtext,
    fontSize: 13,
    lineHeight: 19,
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

  // ── Status line (live/ended/scheduled metadata, below title) ──────────
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusLineText: {
    color: p.subtext,
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Creator row (single instance - avatar/name/subscribe) ─────────────
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  channelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  channelAvatarLarge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  channelName: {
    color: p.text,
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },

  // ── Engagement action row (reactions/share/QR/Super Chat) - uses the
  // real theme surface/border/text tokens (not a dark-video-overlay
  // translucent-white hack) since this now sits below the player, in the
  // normal page flow that flips with the app's light/dark theme. ────────
  engagementRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  engagementReactionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: { fontSize: 18 },
  engagementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: 20,
    paddingHorizontal: 14,
  },
  engagementBtnLabel: { color: p.text, fontSize: 12, fontWeight: '700' },

  // ── Integrated Chat/Polls/Q&A card (tab row + bounded-height panel,
  // replaces the old FAB + screen-dimming Modal). Theme-aware surface/
  // border, same as the engagement row above. ────────────────────────────
  interactionCard: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  interactionTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: p.border,
  },
  interactionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  interactionTabLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  interactionTabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  interactionTabBadgeText: { color: p.onPrimary ?? '#fff', fontSize: 9, fontWeight: '800' },
  interactionCollapseBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  interactionPanelBody: {
    height: 440,
  },

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

  });
}
