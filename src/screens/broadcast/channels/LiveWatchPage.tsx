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
  AppState,
  Image,
  Modal,
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
}: {
  title: string;
  countdown: string;
  channelName?: string;
  thumb?: string;
  waitVideoUrl?: string | null;
  waitVideoPaused?: boolean;
  palette: any;
  styles: any;
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

export default function LiveWatchPage() {
  const route = useRoute<RouteProp<RootStackParamList, 'LiveWatch'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'LiveWatch'>>();
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  // Was a module-level Dimensions.get('window') snapshot, frozen at bundle
  // load and never updated on rotation - the floating-reaction spawn
  // x-position (sendReaction below) would keep using the portrait width's
  // left-35% even after rotating to landscape, clustering reactions in a
  // now-stale, too-narrow band instead of spreading across the actual
  // current width.
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
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
  // Replaces the old separate rightActions column (Share/QR/Super Chat)
  // and bottomPanelWrap (Chat/Polls/Q&A tabs + messages) - every
  // secondary feature now lives in one bottom-sheet modal behind a
  // single FAB (see styles.fab/styles.featuresModal below).
  const [featuresOpen,  setFeaturesOpen]  = useState(false);
  const [activePanel,   setActivePanel]   = useState<'chat' | 'polls' | 'qa'>('chat');
  const [superChatOpen, setSuperChatOpen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // playPauseCenter (the invisible full-screen tap-to-pause Pressable
  // rendered below) used to span the entire screen via top/left/right/
  // bottom: 0, which put it directly over topOverlay's back button and
  // the real Subscribe/reactions/FAB buttons in bottomOverlay and fab —
  // the exact "full-span invisible tap zone wins the touch over real
  // controls on real devices" bug confirmed in UpdatesTab.tsx's Status
  // viewer, even though those buttons paint on top (they're later
  // siblings, same as the already-fixed case). Measuring each real
  // overlay's actual on-screen position and clamping playPauseCenter's
  // span to the gap between them fixes it the same way. All views share
  // the same parent (styles.root), so each onLayout's `y` is directly
  // comparable. Defaults are conservative guesses used only until the
  // real onLayout measurements land.
  const [topOverlayBottom, setTopOverlayBottom] = useState(90);
  const [fabTop, setFabTop] = useState(SCREEN_H);
  const [bottomOverlayTop, setBottomOverlayTop] = useState(SCREEN_H);

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

      {/* ── Play/Pause center tap (live only) ── */}
      {playbackUrl && controlsVisible && (
        <Pressable
          style={[
            styles.playPauseCenter,
            {
              top: topOverlayBottom,
              height: Math.max(0, Math.min(fabTop, bottomOverlayTop) - topOverlayBottom),
            },
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

      {/* ── Features FAB: Chat/Polls/Q&A/Share/Super Chat, all behind one
          button instead of permanently reserving screen space ── */}
      {(isLive || isEnded) && (
        <Pressable
          style={[styles.fab, { bottom: insets.bottom + 100 }]}
          onPress={() => setFeaturesOpen(true)}
          onLayout={(e) => setFabTop(e.nativeEvent.layout.y)}
          accessibilityRole="button"
          accessibilityLabel="Chat, polls, Q&A and more"
        >
          <KISIcon name="grid" size={22} color={palette.ivory} />
          {chatMessages.length > 0 && (
            <View style={styles.fabBadge}>
              <Text style={styles.fabBadgeText}>
                {chatMessages.length > 99 ? '99+' : chatMessages.length}
              </Text>
            </View>
          )}
        </Pressable>
      )}

      {/* ── Bottom overlay: reactions + subscribe ── */}
      <View
        style={[
          styles.bottomOverlay,
          { paddingBottom: insets.bottom + 10 },
        ]}
        pointerEvents="box-none"
        onLayout={(e) => setBottomOverlayTop(e.nativeEvent.layout.y)}
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
                accessibilityRole="button"
                accessibilityLabel={`React with ${emoji}`}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

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

      <ScrollView style={styles.belowPlayer} contentContainerStyle={styles.belowPlayerContent}>
        <Text style={styles.pageTitle}>{stream?.title ?? ''}</Text>
        {stream?.channel ? (
          <View style={styles.pageChannelRow}>
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
        ) : null}
        {stream?.description ? (
          <Text style={styles.pageDescription}>
            {stream.description}
          </Text>
        ) : null}
      </ScrollView>

      {/* ── Features modal: Chat / Polls / Q&A + Share / QR / Super Chat,
          all consolidated behind the single FAB above. Plain Modal +
          animationType="slide", the same pattern SuperChatPanel/
          QrCodeShareModal already use elsewhere in this app - fixed 40%
          height per design, not maxHeight, so it's a predictable,
          consistent sheet rather than growing/shrinking with content. ── */}
      <Modal
        visible={featuresOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFeaturesOpen(false)}
      >
        <View style={styles.featuresOverlay}>
          <Pressable style={styles.featuresBackdrop} onPress={() => setFeaturesOpen(false)} />
          <View style={[styles.featuresPanel, { paddingBottom: insets.bottom || 12 }]}>
            {/* Tab selector - plain text/underline active state, no gold
                gradient fill (KISButton's variant="primary" renders one,
                which read as heavy/out of place floating over video). */}
            <View style={styles.featuresHeader}>
              <View style={styles.panelTabRow}>
                {([
                  { key: 'chat',  label: 'Chat',  icon: 'comment' },
                  { key: 'polls', label: 'Polls', icon: 'list'    },
                  { key: 'qa',    label: 'Q&A',   icon: 'audio'   },
                ] as const).map(tab => {
                  const active = activePanel === tab.key;
                  return (
                    <Pressable
                      key={tab.key}
                      onPress={() => setActivePanel(tab.key)}
                      style={[styles.panelTab, active && styles.panelTabActive]}
                      accessibilityRole="button"
                      accessibilityLabel={tab.label}
                    >
                      <KISIcon name={tab.icon} size={14} color={active ? palette.ivory : palette.subtext} />
                      <Text style={[styles.panelTabLabel, { color: active ? palette.ivory : palette.subtext }]}>
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={() => setFeaturesOpen(false)}
                style={styles.featuresCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <KISIcon name="close" size={18} color={palette.subtext} />
              </Pressable>
            </View>

            {/* Secondary one-shot actions - always available regardless of
                which content tab is active. */}
            <View style={styles.featuresActionsRow}>
              <Pressable style={styles.featuresActionBtn} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share stream">
                <KISIcon name="share" size={18} color={palette.ivory} />
                <Text style={styles.featuresActionLabel}>Share</Text>
              </Pressable>
              <Pressable style={styles.featuresActionBtn} onPress={() => setShowQr(true)} accessibilityRole="button" accessibilityLabel="QR code for stream">
                <KISIcon name="qr-code" size={18} color={palette.ivory} />
                <Text style={styles.featuresActionLabel}>QR Code</Text>
              </Pressable>
              {isLive && streamId ? (
                <Pressable style={styles.featuresActionBtn} onPress={() => setSuperChatOpen(true)} accessibilityRole="button" accessibilityLabel="Send Super Chat">
                  <KISIcon name="star" size={18} color={palette.ivory} />
                  <Text style={styles.featuresActionLabel}>Super Chat</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Active panel content */}
            <View style={styles.featuresContent}>
              {activePanel === 'chat' && (
                <LiveChatPanel
                  messages={chatMessages}
                  onSend={sendChatMessage}
                  palette={palette}
                  disabled={!isLive}
                  collapsed={false}
                  onToggleCollapse={() => setFeaturesOpen(false)}
                  canModerate={canModerateChat}
                  onDeleteMessage={deleteChatMessage}
                  onReportMessage={reportChatMessage}
                />
              )}
              {activePanel === 'polls' && streamId ? (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
                  <LivePollsPanel
                    streamId={streamId}
                    isManager={false}
                    palette={palette}
                  />
                </ScrollView>
              ) : null}
              {activePanel === 'qa' && streamId ? (
                <LiveQAPanel
                  streamId={streamId}
                  isManager={false}
                  palette={palette}
                />
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

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
  root: {
    flex: 1,
    backgroundColor: p.royalInk,
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
    color: p.ivory,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  pageChannelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageDescription: {
    color: p.divider ?? p.ivory,
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

  fab: {
    position: 'absolute',
    right: 14,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: p.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  fabBadgeText: { color: p.onPrimary, fontSize: 10, fontWeight: '800' },

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
  // ── Features modal (Chat/Polls/Q&A + Share/QR/Super Chat) ──────────────
  featuresOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  featuresBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  featuresPanel: {
    height: '40%',
    backgroundColor: p.royalInk,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  featuresHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 10,
    gap: 8,
  },
  panelTabRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  panelTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  // Deliberately a flat fill, not KISButton's variant="primary" gradient -
  // that read as heavy/branding-first floating over a live video, not a
  // simple content-tab affordance. Plain color change is enough here.
  panelTabActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  panelTabLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  featuresCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuresActionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  featuresActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  featuresActionLabel: { color: p.ivory, fontSize: 12, fontWeight: '700' },
  featuresContent: {
    flex: 1,
    marginTop: 8,
  },
  });
}
