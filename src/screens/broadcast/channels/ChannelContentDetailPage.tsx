import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Video from 'react-native-video';
import RNFS from 'react-native-fs';
import Slider from '@react-native-community/slider';
import LinearGradient from 'react-native-linear-gradient';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { KISIcon } from '@/constants/kisIcons';
import ROUTES, { resolveBackendAssetUrl } from '@/network';
import { postRequest } from '@/network/post';
import { getRequest } from '@/network/get';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import RichTextRenderer from '@/components/feeds/RichTextRenderer';
import type { ComponentProps } from 'react';
import type { BroadcastChannelContent, BroadcastChannelContentAsset, BroadcastChannelSummary } from '@/screens/broadcast/channels/api/channels.types';
import {
  fetchChannelContentDetail,
  fetchWatchHistory,
  reactToChannelContent,
  recordChannelContentView,
  removeSavedChannelContent,
  saveChannelContent,
  shareChannelContent,
  reportChannelContent,
  fetchRelatedContent,
  fetchUserPlaylistsSimple,
  addContentToUserPlaylist,
  ensureSystemPlaylist,
  createChannelContentClip,
  fetchContentSubtitles,
  fetchChannelContentChapters,
} from '@/screens/broadcast/channels/hooks/useChannelsData';
import ChannelCommentsPanel from '@/screens/broadcast/channels/components/ChannelCommentsPanel';
import SubscribeBellButton from '@/screens/broadcast/channels/components/SubscribeBellButton';
import AgeGateScreen from '@/screens/broadcast/channels/components/AgeGateScreen';
import GeoBlockedScreen from '@/screens/broadcast/channels/components/GeoBlockedScreen';
import { fetchPublicContentLanding } from '@/services/publicGrowthService';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

const compactNumber = (value?: number) => {
  const num = Number(value || 0);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
};

const resolveAssetUrl = (asset?: BroadcastChannelContentAsset | null) => resolveBackendAssetUrl(asset?.url || asset?.thumbnail_url || '');
const resolveThumbUrl = (content?: BroadcastChannelContent | null) => resolveBackendAssetUrl(content?.thumbnail_url || content?.first_asset?.thumbnail_url || content?.first_asset?.url || content?.assets?.[0]?.thumbnail_url || content?.assets?.[0]?.url || '');

function TypeBadge({ type }: { type?: string }) {
  const { palette } = useKISTheme();
  const label = String(type || 'post').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
  return (
    <View style={[styles.typeBadge, { backgroundColor: palette.primarySoft }]}> 
      <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 11 }}>{label}</Text>
    </View>
  );
}

const SPEED_OPTIONS = [0.5, 1, 1.25, 1.5, 2] as const;
type SpeedOption = typeof SPEED_OPTIONS[number];

type Chapter = { id: string; title: string; start_seconds: number };
type Subtitle = { id: string; language: string; url: string; label?: string };

type VideoTrack = { bitrate?: number; width?: number; height?: number; trackId: string };

function VideoPlayerControls({
  content,
  videoUrl,
  stageHeight,
  palette,
  relatedContent,
}: {
  content: BroadcastChannelContent;
  videoUrl: string;
  stageHeight: number;
  palette: any;
  relatedContent?: { id: string; title: string; thumbnail_url?: string; channel?: { name: string } }[];
}) {
  const controlsNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const videoRef = useRef<any>(null);
  const [paused, setPaused]           = useState(false);
  const [buffering, setBuffering]     = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(content.duration_seconds ?? 0);
  const [seeking, setSeeking]         = useState(false);
  const [seekValue, setSeekValue]     = useState(0);
  const [speed, setSpeed]             = useState<SpeedOption>(1);
  const [captionsOn, setCaptionsOn]   = useState(false);
  const [speedModal, setSpeedModal]   = useState(false);
  const [chapters, setChapters]       = useState<Chapter[]>([]);
  const [subtitles, setSubtitles]     = useState<Subtitle[]>([]);
  const controlsAnim = useRef(new Animated.Value(1)).current;
  const hideTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [controlsVis, setControlsVis] = useState(true);
  const [videoTracks, setVideoTracks] = useState<VideoTrack[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<string>('auto');
  const [qualityModal, setQualityModal] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    fetchChannelContentChapters(content.id)
      .then(rows => setChapters((rows as unknown as Chapter[]).sort((a, b) => a.start_seconds - b.start_seconds)))
      .catch(() => {});
    fetchContentSubtitles(content.id)
      .then((rows: any) => {
        const arr = Array.isArray(rows) ? rows : Array.isArray(rows?.results) ? rows.results : [];
        setSubtitles(arr);
      })
      .catch(() => {});
  }, [content.id]);

  useEffect(() => {
    if (!showEndScreen) return;
    if (countdown <= 0) {
      setShowEndScreen(false);
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showEndScreen, countdown]);

  const showControls = useCallback(() => {
    setControlsVis(true);
    Animated.timing(controlsAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!paused) {
        Animated.timing(controlsAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
        setControlsVis(false);
      }
    }, 3500);
  }, [paused, controlsAnim]);

  useEffect(() => {
    showControls();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const activeSubtrack = captionsOn && subtitles.length > 0
    ? [{ title: subtitles[0].label ?? subtitles[0].language, uri: subtitles[0].url, type: 'srt' as const, language: subtitles[0].language }]
    : [];

  const currentChapter = [...chapters].reverse().find((ch: Chapter) => ch.start_seconds <= currentTime) ?? chapters[0];

  return (
    <Pressable
      style={[vstyles.wrap, { height: stageHeight, backgroundColor: palette.royalInk }]}
      onPress={showControls}
    >
      <Video
        ref={videoRef}
        source={{ uri: videoUrl }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="contain"
        paused={paused}
        rate={speed}
        onLoad={({ duration: d }) => { setDuration(d); setBuffering(false); }}
        onProgress={({ currentTime: t }) => { if (!seeking) setCurrentTime(t); }}
        onBuffer={({ isBuffering }) => setBuffering(isBuffering)}
        onEnd={() => {
          setPaused(true);
          if (chapters.length > 0) return;
          setShowEndScreen(true);
          setCountdown(5);
        }}
        textTracks={activeSubtrack as any}
        onVideoTracks={(data: any) => {
          const tracks: VideoTrack[] = (data?.videoTracks ?? []).map((t: any) => ({
            trackId: String(t.trackId ?? t.index ?? ''),
            width: t.width,
            height: t.height,
            bitrate: t.bitrate,
          }));
          setVideoTracks(tracks);
        }}
        selectedVideoTrack={
          selectedQuality === 'auto'
            ? ({ type: 'auto' } as any)
            : ({ type: 'trackId', value: selectedQuality } as any)
        }
      />

      {buffering && (
        <View style={vstyles.bufferWrap} pointerEvents="none">
          <ActivityIndicator color={palette.ivory} size="large" />
        </View>
      )}

      <Animated.View style={[vstyles.controlsOverlay, { opacity: controlsAnim }]} pointerEvents={controlsVis ? 'box-none' : 'none'}>
        <LinearGradient colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.75)']} style={vstyles.gradientBottom} />

        {/* Chapter label */}
        {currentChapter && (
          <View style={vstyles.chapterLabel} pointerEvents="none">
            <Text style={[vstyles.chapterText, { color: palette.ivory }]} numberOfLines={1}>{currentChapter.title}</Text>
          </View>
        )}

        {/* Center play/pause */}
        <Pressable
          style={vstyles.centerBtn}
          onPress={() => { setPaused(p => !p); showControls(); }}
        >
          <View style={vstyles.centerCircle}>
            <KISIcon name={paused ? 'play' : 'pause'} size={28} color={palette.ivory} />
          </View>
        </Pressable>

        {/* Bottom controls */}
        <View style={vstyles.bottomRow}>
          {/* Time */}
          <Text style={[vstyles.timeText, { color: palette.ivory }]}>{formatTime(seeking ? seekValue : currentTime)}</Text>

          {/* Scrubber */}
          <View style={vstyles.sliderWrap}>
            {/* Chapter markers */}
            {chapters.map(ch => (
              <View
                key={ch.id}
                pointerEvents="none"
                style={[
                  vstyles.chapterMarker,
                  { left: `${Math.min(99, (ch.start_seconds / Math.max(1, duration)) * 100)}%` as any },
                ]}
              />
            ))}
            <Slider
              style={{ flex: 1 }}
              minimumValue={0}
              maximumValue={Math.max(1, duration)}
              value={seeking ? seekValue : currentTime}
              minimumTrackTintColor={palette.primaryStrong}
              maximumTrackTintColor={palette.divider}
              thumbTintColor={palette.primaryStrong}
              onSlidingStart={() => { setSeeking(true); setSeekValue(currentTime); }}
              onValueChange={v => setSeekValue(v)}
              onSlidingComplete={v => {
                setSeeking(false);
                videoRef.current?.seek(v);
                setCurrentTime(v);
              }}
            />
          </View>

          {/* Duration */}
          <Text style={[vstyles.timeText, { color: palette.ivory }]}>{formatTime(duration)}</Text>

          {/* Captions */}
          {subtitles.length > 0 && (
            <Pressable onPress={() => setCaptionsOn(c => !c)} style={vstyles.iconBtn} hitSlop={8}>
              <KISIcon name="audio" size={16} color={captionsOn ? palette.primaryStrong : palette.ivory} />
            </Pressable>
          )}

          {/* Speed */}
          <Pressable onPress={() => setSpeedModal(true)} style={vstyles.speedBtn} hitSlop={8}>
            <Text style={[vstyles.speedText, { color: palette.ivory }]}>{speed === 1 ? '1×' : `${speed}×`}</Text>
          </Pressable>

          {/* Quality */}
          <Pressable onPress={() => setQualityModal(true)} style={vstyles.speedBtn} hitSlop={8}>
            <KISIcon name="video" size={16} color={palette.ivory} />
          </Pressable>
        </View>
      </Animated.View>

      {/* Speed modal */}
      <Modal transparent visible={speedModal} animationType="fade" onRequestClose={() => setSpeedModal(false)}>
        <Pressable style={vstyles.modalBackdrop} onPress={() => setSpeedModal(false)}>
          <View style={[vstyles.speedPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[vstyles.speedPanelTitle, { color: palette.text }]}>Playback Speed</Text>
            {SPEED_OPTIONS.map(s => (
              <Pressable
                key={s}
                onPress={() => { setSpeed(s); setSpeedModal(false); }}
                style={[vstyles.speedOption, speed === s && { backgroundColor: palette.primarySoft }]}
              >
                <Text style={[vstyles.speedOptionText, { color: speed === s ? palette.primaryStrong : palette.text }]}>
                  {s === 1 ? 'Normal (1×)' : `${s}×`}
                </Text>
                {speed === s && <KISIcon name="check" size={14} color={palette.primaryStrong} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Quality modal */}
      {qualityModal && (
        <Pressable style={vstyles.modalBackdrop} onPress={() => setQualityModal(false)}>
          <View style={[vstyles.speedModal, { backgroundColor: palette.card }]}>
            <Text style={{ color: palette.text, fontWeight: '900', marginBottom: 8 }}>Quality</Text>
            {[{ label: 'Auto', trackId: 'auto' }, ...videoTracks.map(t => ({
              label: t.height ? `${t.height}p` : `Track ${t.trackId}`,
              trackId: t.trackId,
            }))].map(opt => (
              <Pressable
                key={opt.trackId}
                onPress={() => { setSelectedQuality(opt.trackId); setQualityModal(false); }}
                style={vstyles.speedOption}
              >
                <Text style={{
                  color: selectedQuality === opt.trackId ? palette.primaryStrong : palette.text,
                  fontWeight: selectedQuality === opt.trackId ? '900' : '600',
                }}>
                  {opt.label}{selectedQuality === opt.trackId ? ' ✓' : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      )}

      {/* End screen overlay */}
      {showEndScreen && (
        <View style={[vstyles.endScreen, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
          <Text style={{ color: palette.ivory, fontWeight: '900', fontSize: 16, marginBottom: 16 }}>
            Up Next in {countdown}s
          </Text>
          {(relatedContent ?? [])[0] ? (
            <View style={{ alignItems: 'center', gap: 12 }}>
              {(relatedContent![0].thumbnail_url) ? (
                <Image
                  source={{ uri: relatedContent![0].thumbnail_url }}
                  style={{ width: 200, height: 112, borderRadius: 10 }}
                  resizeMode="cover"
                />
              ) : null}
              <Text style={{ color: palette.ivory, fontWeight: '800', fontSize: 14, textAlign: 'center' }} numberOfLines={2}>
                {relatedContent![0].title}
              </Text>
              <Text style={{ color: palette.divider, fontSize: 12 }}>{relatedContent![0].channel?.name}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
            <Pressable
              onPress={() => setShowEndScreen(false)}
              style={{ borderWidth: 1, borderColor: palette.ivory, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 }}
            >
              <Text style={{ color: palette.ivory, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
            {(relatedContent ?? [])[0] ? (
              <Pressable
                onPress={() => {
                  const next = (relatedContent ?? [])[0];
                  if (next) controlsNavigation.navigate('ChannelContentDetail', { contentId: next.id, item: next });
                  setShowEndScreen(false);
                }}
                style={{ backgroundColor: palette.primary, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 }}
              >
                <Text style={{ color: palette.ivory, fontWeight: '900' }}>Watch Now</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

function MediaStage({ content, relatedContent }: { content: BroadcastChannelContent; relatedContent?: { id: string; title: string; thumbnail_url?: string; channel?: { name: string } }[] }) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const stageHeight = compact ? 240 : responsive.isTablet && responsive.isLandscape ? 420 : 340;
  const assets = content.assets?.length ? content.assets : content.first_asset ? [content.first_asset] : [];
  const primary = assets[0];
  const imageUrl = resolveThumbUrl(content) || resolveAssetUrl(primary);
  const type = content.content_type;

  if (type === 'text' || type === 'rich_text' || (!imageUrl && !primary && content.text_plain)) {
    return (
      <View style={[styles.textStage, { backgroundColor: palette.surface, minHeight: stageHeight, paddingHorizontal: responsive.pageGutter }]}>
        <RichTextRenderer
          value={(content.text_doc || null) as ComponentProps<typeof RichTextRenderer>['value']}
          fallback={content.text_plain || content.title || ''}
          style={[styles.richTextStage, { color: palette.text }]}
        />
      </View>
    );
  }

  if (type === 'audio') {
    return (
      <View style={[styles.mediaStage, { backgroundColor: palette.surfaceElevated, height: stageHeight }]}>
        <LinearGradient colors={[palette.primarySoft, palette.surfaceElevated, palette.surface]} style={StyleSheet.absoluteFillObject} />
        <View style={[styles.largeIconBubble, { backgroundColor: palette.surface }]}>
          <KISIcon name="audio" size={42} color={palette.primaryStrong} />
        </View>
        <Text style={[styles.mediaStageTitle, { color: palette.text }]}>{primary?.caption || content.title || 'Audio broadcast'}</Text>
      </View>
    );
  }

  if (type === 'document') {
    return (
      <View style={[styles.mediaStage, { backgroundColor: palette.surfaceElevated, height: stageHeight }]}>
        <LinearGradient colors={[palette.primarySoft, palette.surfaceElevated, palette.surface]} style={StyleSheet.absoluteFillObject} />
        <View style={[styles.largeIconBubble, { backgroundColor: palette.surface }]}>
          <KISIcon name="file" size={42} color={palette.primaryStrong} />
        </View>
        <Text style={[styles.mediaStageTitle, { color: palette.text }]}>{primary?.caption || content.title || 'Document'}</Text>
        {primary?.url ? <Pressable onPress={() => Linking.openURL(resolveAssetUrl(primary) || primary.url || '')} style={[styles.openFileButton, { backgroundColor: palette.text }]}><Text style={{ color: palette.surface, fontWeight: '900' }}>Open file</Text></Pressable> : null}
      </View>
    );
  }

  if (type === 'live_stream') {
    return (
      <View style={[styles.mediaStage, { backgroundColor: palette.surfaceElevated, height: stageHeight }]}>
        {imageUrl ? <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <LinearGradient colors={[palette.primarySoft, palette.surfaceElevated, palette.surface]} style={StyleSheet.absoluteFillObject} />}
        <View style={styles.mediaOverlay} />
        <View style={[styles.liveBadge, { backgroundColor: palette.danger }]}><Text style={[styles.liveBadgeText, { color: palette.ivory }]}>{content.status === 'scheduled' ? 'Scheduled' : 'Live'}</Text></View>
        <KISIcon name="broadcast" size={46} color={palette.ivory} />
      </View>
    );
  }

  if ((type === 'video' || type === 'short_video') && primary?.url) {
    const videoUrl = resolveAssetUrl(primary) || primary.url || '';
    if (videoUrl) {
      return (
        <VideoPlayerControls
          content={content}
          videoUrl={videoUrl}
          stageHeight={stageHeight}
          palette={palette}
          relatedContent={relatedContent}
        />
      );
    }
  }

  return (
    <View style={[styles.mediaStage, { backgroundColor: palette.surfaceElevated, height: stageHeight }]}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <LinearGradient colors={[palette.primarySoft, palette.surfaceElevated, palette.surface]} style={StyleSheet.absoluteFillObject} />}
      <View style={styles.mediaOverlay} />
      {['video', 'short_video'].includes(type) ? <View style={styles.playBubble}><KISIcon name="play" size={30} color={palette.ivory} /></View> : null}
      {assets.length > 1 ? <View style={styles.galleryCount}><Text style={[styles.galleryCountText, { color: palette.ivory }]}>{assets.length} files</Text></View> : null}
    </View>
  );
}

const vstyles = StyleSheet.create({
  wrap: { position: 'relative', overflow: 'hidden' },
  bufferWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  controlsOverlay: { ...StyleSheet.absoluteFillObject },
  gradientBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
  chapterLabel: {
    position: 'absolute', top: 12, left: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start',
  },
  chapterText: { fontSize: 11, fontWeight: '700' },
  centerBtn: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  centerCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  bottomRow: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 10, gap: 6,
  },
  timeText: { fontSize: 11, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  sliderWrap: { flex: 1, position: 'relative', justifyContent: 'center' },
  chapterMarker: {
    position: 'absolute', width: 2, height: 8, backgroundColor: 'rgba(255,255,255,0.7)',
    top: '50%', marginTop: -4, zIndex: 1,
  },
  iconBtn: { padding: 4 },
  speedBtn: {
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  speedText: { fontSize: 11, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  speedPanel: {
    width: 240, borderRadius: 14, borderWidth: 1, overflow: 'hidden', paddingVertical: 8,
  },
  speedPanelTitle: { fontSize: 13, fontWeight: '900', paddingHorizontal: 16, paddingVertical: 10, letterSpacing: 0.2 },
  speedOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  speedOptionText: { fontSize: 14, fontWeight: '700' },
  speedModal: {
    width: 220, borderRadius: 14, overflow: 'hidden', paddingVertical: 12, paddingHorizontal: 16,
  },
  endScreen: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
});

export default function ChannelContentDetailPage() {
  const route = useRoute<RouteProp<RootStackParamList, 'ChannelContentDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'ChannelContentDetail'>>();
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const themed = useMemo(() => makeStyles(palette), [palette]);
  const [content, setContent] = useState<BroadcastChannelContent | null>(route.params?.item || null);
  const [loading, setLoading] = useState(!route.params?.item);
  const [counts, setCounts] = useState<Record<string, number>>((route.params?.item?.engagement_counts || {}) as Record<string, number>);
  const [saved, setSaved] = useState(false);
  const [resumeSeconds, setResumeSeconds] = useState<number | null>(null);
  const [relatedContent, setRelatedContent] = useState<BroadcastChannelContent[]>([]);
  const [descExpanded, setDescExpanded] = useState(false);
  const [autoplayCountdown, setAutoplayCountdown] = useState<number | null>(null);
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<Array<{ id: string; name: string; item_count: number }>>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [clipModalOpen, setClipModalOpen] = useState(false);
  const [clipTitle, setClipTitle] = useState('');
  const [clipStart, setClipStart] = useState('0');
  const [clipEnd, setClipEnd] = useState('30');
  const [clipping, setClipping] = useState(false);
  const [tipModal, setTipModal] = useState(false);
  const [tipping, setTipping] = useState(false);
  const [selectedTipAmount, setSelectedTipAmount] = useState<number | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const channel = (content?.channel || route.params?.channel || null) as BroadcastChannelSummary | null;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchChannelContentDetail(route.params.contentId)
      .then(next => {
        if (mounted && next) {
          setContent(next);
          setCounts((next.engagement_counts || {}) as Record<string, number>);
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [route.params.contentId]);

  useEffect(() => {
    if (content?.id) void recordChannelContentView(content.id);
  }, [content?.id]);

  useEffect(() => {
    if (!content?.id) return;
    fetchWatchHistory().then(history => {
      const entry = history.find(e => e.content_id === content.id);
      if (entry && !entry.completed && entry.progress_seconds > 30) {
        setResumeSeconds(entry.progress_seconds);
      }
    });
  }, [content?.id]);

  useEffect(() => {
    if (!content?.id) return;
    fetchRelatedContent(content.id).then(rows => {
      setRelatedContent(rows.slice(0, 5));
    }).catch(() => {});
  }, [content?.id]);

  const applyCounts = useCallback((payload: any) => {
    if (payload?.engagement_counts) setCounts(payload.engagement_counts);
  }, []);

  const handleReact = useCallback(async () => {
    if (!content?.id) return;
    setCounts(prev => ({ ...prev, reactions: Number(prev.reactions || 0) + 1 }));
    applyCounts(await reactToChannelContent(content.id));
  }, [applyCounts, content?.id]);

  const handleDislike = useCallback(async () => {
    if (!content?.id) return;
    setCounts(prev => ({ ...prev, dislikes: Number(prev.dislikes || 0) + 1 }));
    applyCounts(await reactToChannelContent(content.id, 'dislike'));
  }, [applyCounts, content?.id]);

  const handleSave = useCallback(async () => {
    if (!content?.id) return;
    const next = !saved;
    setSaved(next);
    applyCounts(next ? await saveChannelContent(content.id) : await removeSavedChannelContent(content.id));
  }, [applyCounts, content?.id, saved]);

  const handleShare = useCallback(async () => {
    if (!content?.id) return;
    const title = content?.title || 'KIS channel content';
    let url = '';
    try {
      const publicMeta = await fetchPublicContentLanding(content.id);
      url = publicMeta?.share_card?.url || publicMeta?.url || '';
    } catch {
      url = '';
    }
    const byline = channel?.display_name ? `By ${channel.display_name}` : '';
    const message = [title, byline, url].filter(Boolean).join('\n');
    const result = await Share.share({ message, url: url || undefined, title });
    const completed = result.action === Share.sharedAction;
    if (completed) applyCounts(await shareChannelContent(content.id, true));
  }, [applyCounts, channel?.display_name, content?.id, content?.title]);

  const handleVideoEnd = useCallback(() => {
    if (relatedContent.length > 0) {
      setAutoplayCountdown(5);
    }
  }, [relatedContent]);

  useEffect(() => {
    if (autoplayCountdown === null) return;
    if (autoplayCountdown <= 0) {
      const next = relatedContent[0];
      setAutoplayCountdown(null);
      if (next) {
        navigation.navigate('ChannelContentDetail', { contentId: next.id, item: next });
      }
      return;
    }
    const t = setTimeout(() => setAutoplayCountdown(prev => (prev !== null ? prev - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [autoplayCountdown, navigation, relatedContent]);

  const processTip = useCallback(async (amountCents: number, provider: 'flutterwave' | 'stripe') => {
    const contentId = content?.id ?? route.params.contentId;
    if (!contentId) return;
    setTipping(true);
    try {
      const res = await postRequest(
        ROUTES.broadcasts.tipCreator(contentId),
        { amount_cents: amountCents, currency: 'USD', payment_provider: provider },
        { errorMessage: 'Could not process tip.' },
      );
      setTipModal(false);
      setSelectedTipAmount(null);
      if (res?.payment_required) {
        const url = res.payment_url || res.checkout_url;
        if (url) {
          await Linking.openURL(url);
        }
      }
    } catch {
      Alert.alert('Error', 'Could not process tip. Please try again.');
    } finally {
      setTipping(false);
    }
  }, [content?.id, route.params.contentId]);

  const handleSuperThanks = useCallback(() => {
    setSelectedTipAmount(null);
    setTipModal(true);
  }, []);

  const handleReport = useCallback(() => {
    if (!content?.id) return;
    Alert.alert('Report content', 'Send this content to moderation review?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', style: 'destructive', onPress: () => { void reportChannelContent(content.id, 'Reported from channel detail'); } },
    ]);
  }, [content?.id]);

  const handleDownload = useCallback(async () => {
    if (!content?.id) return;
    try {
      const res = await getRequest(ROUTES.broadcasts.channelContentDownload(content.id), { errorMessage: 'Download failed.' });
      const downloadUrl = res?.data?.download_url || res?.download_url;
      const filename = res?.data?.filename || res?.filename || `${content?.title || 'video'}.mp4`;
      if (!downloadUrl) { Alert.alert('Unavailable', 'No downloadable video is available for this content.'); return; }

      const dir = `${RNFS.DocumentDirectoryPath}/kis-downloads`;
      await RNFS.mkdir(dir).catch(() => {});
      const destPath = `${dir}/${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      Alert.alert('Downloading', `"${content?.title || 'Video'}" is downloading…`);
      await RNFS.downloadFile({ fromUrl: downloadUrl, toFile: destPath }).promise;
      Alert.alert('Downloaded', `Saved to Downloads.`);
    } catch (e: any) {
      Alert.alert('Download failed', e?.message || 'Please try again.');
    }
  }, [content?.id, content?.title]);

  const handleEmbed = useCallback(async () => {
    if (!content?.id) return;
    try {
      const res = await postRequest(ROUTES.broadcasts.channelContentEmbedToken(content.id), {}, {
        errorMessage: 'Unable to generate embed token.',
      });
      const token: string = res.data?.token || res.data?.embed_token || '';
      const embedUrl: string = res.data?.embed_url || '';
      if (token || embedUrl) {
        Alert.alert('Embed ready', embedUrl || `Use this token to embed the content:\n\n${token}`, [{ text: 'OK' }]);
      } else {
        Alert.alert('Embed', 'Embedding is not available for this content.');
      }
    } catch {
      Alert.alert('Embed', 'Unable to generate embed token. Please try again.');
    }
  }, [content?.id]);

  const handleAddToPlaylist = useCallback(async () => {
    setPlaylistsLoading(true);
    setPlaylistModalOpen(true);
    try {
      const lists = await fetchUserPlaylistsSimple();
      setUserPlaylists(lists);
    } finally {
      setPlaylistsLoading(false);
    }
  }, []);

  const handleWatchLater = useCallback(async () => {
    if (!content?.id) return;
    try {
      const playlistId = await ensureSystemPlaylist('watch_later', 'Watch Later');
      if (playlistId) {
        await addContentToUserPlaylist(playlistId, content.id);
        Alert.alert('Saved', 'Added to Watch Later.');
      } else {
        Alert.alert('Watch Later', 'Unable to add — please try again.');
      }
    } catch {
      Alert.alert('Watch Later', 'Unable to add — please try again.');
    }
  }, [content?.id]);

  const handleAddToSpecificPlaylist = useCallback(async (playlistId: string) => {
    if (!content?.id) return;
    setPlaylistModalOpen(false);
    await addContentToUserPlaylist(playlistId, content.id);
    Alert.alert('Added', 'Content added to playlist.');
  }, [content?.id]);

  const handleCreateClip = useCallback(async () => {
    if (!content?.id || clipping) return;
    const start = Number(clipStart);
    const end = Number(clipEnd);
    if (isNaN(start) || isNaN(end) || end <= start) {
      Alert.alert('Invalid clip', 'End time must be after start time.');
      return;
    }
    if (end - start > 60) {
      Alert.alert('Clip too long', 'Clips must be 60 seconds or less.');
      return;
    }
    setClipping(true);
    try {
      const result = await createChannelContentClip(content.id, { start_seconds: start, end_seconds: end, title: clipTitle || undefined });
      if (result) {
        setClipModalOpen(false);
        setClipTitle('');
        setClipStart('0');
        setClipEnd('30');
        Alert.alert('Clip created', 'Your clip is being processed. View it in Clips.');
      } else {
        Alert.alert('Clip failed', 'Unable to create clip. Please try again.');
      }
    } finally {
      setClipping(false);
    }
  }, [clipEnd, clipStart, clipTitle, clipping, content?.id]);

  const handleShareAtTimestamp = useCallback(async () => {
    if (!content?.id) return;
    Alert.prompt(
      'Share at timestamp',
      'Enter the time (in seconds) to share from:',
      async (secondsStr) => {
        const seconds = parseInt(secondsStr || '0', 10);
        const t = isNaN(seconds) ? 0 : seconds;
        const url = `https://kis.app/content/${content.id}?t=${t}`;
        await Share.share({ message: `${content.title || 'KIS content'}\n${url}`, url });
      },
      'plain-text',
      '0',
      'number-pad',
    );
  }, [content?.id, content?.title]);

  if (loading && !content) {
    return <SafeAreaView style={[styles.centered, { backgroundColor: palette.bg, }]}><ActivityIndicator color={palette.primaryStrong} /></SafeAreaView>;
  }

  if (!content) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: palette.bg, }]}>
        <Text style={{ color: palette.text, fontWeight: '900' }}>Content unavailable</Text>
        <Pressable onPress={() => navigation.goBack()} style={[styles.retryButton, { borderColor: palette.border }]}><Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>Go back</Text></Pressable>
      </SafeAreaView>
    );
  }

  if (content.geo_restricted) {
    return <GeoBlockedScreen onBack={() => navigation.goBack()} />;
  }

  const ageRestriction = content.age_restriction;
  if ((ageRestriction === '13+' || ageRestriction === '18+') && !ageConfirmed) {
    return (
      <AgeGateScreen
        ageRestriction={ageRestriction}
        onConfirm={() => setAgeConfirmed(true)}
        onBack={() => navigation.goBack()}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.bg, }]} edges={['top']}>
      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + (compact ? 18 : 28) }}>
        <View style={[styles.stageWrap, { minHeight: compact ? 240 : 320 }]}>
          <MediaStage content={content} relatedContent={relatedContent as any} />
          <Pressable onPress={() => navigation.goBack()} style={[styles.backButton, { top: topInset + 8 }]}><KISIcon name="arrow-left" size={20} color={palette.ivory} /></Pressable>

          {/* Autoplay Up Next countdown */}
          {autoplayCountdown !== null && relatedContent[0] && (
            <View style={styles.autoplayBanner}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.autoplayLabel, { color: palette.divider }]}>Up next in {autoplayCountdown}s</Text>
                <Text style={[styles.autoplayTitle, { color: palette.ivory }]} numberOfLines={1}>{relatedContent[0].title || 'Next video'}</Text>
              </View>
              <Pressable onPress={() => setAutoplayCountdown(null)} style={{ padding: 6 }}>
                <KISIcon name="close" size={16} color={palette.ivory} />
              </Pressable>
              <View style={[styles.autoplayBar, { backgroundColor: palette.divider }]}>
                <View style={[styles.autoplayProgress, { width: `${((5 - autoplayCountdown) / 5) * 100}%` as any, backgroundColor: palette.gold }]} />
              </View>
            </View>
          )}
        </View>

        <View style={[themed.contentCard, { marginHorizontal: responsive.pageGutter, padding: compact ? 12 : 16 }]}>
          <View style={styles.titleTopRow}>
            <TypeBadge type={content.content_type} />
            <Text style={[styles.dateText, { color: palette.subtext }]}>{content.published_at ? new Date(content.published_at).toLocaleDateString() : content.status || 'Draft'}</Text>
          </View>
          <Text style={[styles.title, { color: palette.text, fontSize: compact ? 19 : 24, lineHeight: compact ? 25 : 31 }]}>{content.title || content.text_plain_preview || 'Untitled content'}</Text>
          {content.content_type !== 'text' && content.content_type !== 'rich_text' && (content.description || content.text_plain) ? (
            <Pressable onPress={() => setDescExpanded(prev => !prev)}>
              <Text
                style={[styles.description, { color: palette.subtext }]}
                numberOfLines={descExpanded ? undefined : 3}
              >
                {content.description || content.text_plain}
              </Text>
              <Text style={{ color: palette.primaryStrong, fontWeight: '800', fontSize: 12, marginTop: 4 }}>
                {descExpanded ? 'Show less' : 'Show more'}
              </Text>
            </Pressable>
          ) : null}

          {channel ? (
            <Pressable onPress={() => navigation.navigate('ChannelHome', { channelId: channel.id, channel })} style={[styles.channelRow, { borderColor: palette.border }]}> 
              <View style={[styles.channelAvatar, { backgroundColor: palette.primarySoft }]}><Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>{String(channel.display_name || channel.handle || 'KC').slice(0, 2).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.channelName, { color: palette.text }]}>{channel.display_name || 'KIS Channel'}</Text>
                <Text style={[styles.channelHandle, { color: palette.subtext }]}>@{channel.handle || 'channel'} · {compactNumber(channel.subscriber_count)} subscribers</Text>
              </View>
              <SubscribeBellButton channelId={channel.id} initialSubscribed={Boolean(channel.is_subscribed)} compact />
            </Pressable>
          ) : null}

          {resumeSeconds !== null && (
            <Pressable
              style={[styles.resumeBanner, { backgroundColor: palette.primarySoft, borderColor: palette.primaryStrong }]}
              onPress={() => setResumeSeconds(null)}
            >
              <KISIcon name="play" size={14} color={palette.primaryStrong} />
              <Text style={[styles.resumeText, { color: palette.primaryStrong }]}>
                Resume from {Math.floor(resumeSeconds / 60)}:{String(Math.floor(resumeSeconds % 60)).padStart(2, '0')}
              </Text>
              <KISIcon name="close" size={12} color={palette.primaryStrong} />
            </Pressable>
          )}

          <View style={[styles.actionGrid, { gap: compact ? 8 : 10 }]}>
            <ActionButton icon="heart" label="Like" value={compactNumber(counts.reactions)} onPress={handleReact} />
            <ActionButton icon="warning" label="Dislike" value={compactNumber(counts.dislikes)} onPress={handleDislike} />
            <ActionButton icon="comment" label="Comment" value={compactNumber(counts.comments)} onPress={() => setCommentsModalVisible(true)} />
            <ActionButton icon="share" label="Share" value={compactNumber(counts.shares)} onPress={handleShare} />
            <ActionButton icon="call-history" label="Share at time" value="Timestamp" onPress={handleShareAtTimestamp} />
            <ActionButton icon="bookmark" label="Save" value={saved ? 'Saved' : compactNumber(counts.saves)} onPress={handleSave} />
            <ActionButton icon="call-history" label="Watch Later" value="Queue" onPress={handleWatchLater} />
            <ActionButton icon="list" label="Add to playlist" value="Playlists" onPress={handleAddToPlaylist} />
            <ActionButton icon="edit" label="Create Clip" value="Clip it" onPress={() => setClipModalOpen(true)} />
            <ActionButton icon="play" label="Clips" value="My clips" onPress={() => navigation.navigate('ClipsListScreen', { contentId: content.id })} />
            <ActionButton icon="download" label="Download" value="Offline" onPress={handleDownload} />
            <ActionButton icon="link" label="Embed" value="Token" onPress={handleEmbed} />
            <ActionButton icon="heart" label="Super Thanks" value="Tip" onPress={handleSuperThanks} />
            <ActionButton icon="report" label="Report" value="Report" onPress={handleReport} />
          </View>
        </View>

        <Modal
          visible={commentsModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setCommentsModalVisible(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.divider }}>
              <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: palette.text }}>Comments</Text>
              <Pressable onPress={() => setCommentsModalVisible(false)} hitSlop={10}>
                <KISIcon name="close" size={20} color={palette.subtext} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
              <ChannelCommentsPanel
                contentId={content.id}
                onCountChange={count => setCounts(prev => ({ ...prev, comments: count }))}
              />
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {relatedContent.length > 0 && (
          <View style={[styles.assetsBlock, { paddingHorizontal: responsive.pageGutter }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Up Next</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {relatedContent.map(related => {
                const thumbUrl = resolveThumbUrl(related);
                return (
                  <Pressable
                    key={related.id}
                    onPress={() => navigation.navigate('ChannelContentDetail', { contentId: related.id, item: related })}
                    style={[styles.relatedCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
                  >
                    <View style={[styles.relatedThumb, { backgroundColor: palette.royalInk }]}>
                      {thumbUrl ? (
                        <Image source={{ uri: thumbUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                      ) : null}
                      <View style={styles.relatedOverlay} />
                      <KISIcon name="play" size={16} color={palette.ivory} />
                    </View>
                    <View style={styles.relatedBody}>
                      <Text style={[styles.relatedTitle, { color: palette.text }]} numberOfLines={2}>
                        {related.title || related.text_plain_preview || 'Untitled'}
                      </Text>
                      <Text style={[styles.relatedChannel, { color: palette.subtext }]} numberOfLines={1}>
                        {related.channel?.display_name || 'KIS Channel'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {content.assets?.length ? (
          <View style={[styles.assetsBlock, { paddingHorizontal: responsive.pageGutter }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Files</Text>
            {content.assets.map(asset => (
              <View key={asset.id || asset.url} style={[styles.assetRow, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
                <KISIcon name={asset.asset_type === 'audio' ? 'audio' : asset.asset_type === 'document' ? 'file' : 'image'} size={18} color={palette.primaryStrong} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text numberOfLines={1} style={[styles.assetTitle, { color: palette.text }]}>{asset.caption || asset.mime_type || asset.asset_type || 'Attachment'}</Text>
                  <Text style={[styles.assetMeta, { color: palette.subtext }]}>{asset.processing_status || 'ready'}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      {/* Add to Playlist Modal */}
      <Modal visible={playlistModalOpen} transparent animationType="slide" onRequestClose={() => setPlaylistModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPlaylistModalOpen(false)} />
        <View style={[styles.modalSheet, { backgroundColor: palette.surface }]}>
          <View style={[styles.modalHeader, { borderBottomColor: palette.border }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Add to playlist</Text>
            <Pressable onPress={() => setPlaylistModalOpen(false)} hitSlop={12}>
              <KISIcon name="close" size={20} color={palette.subtext} />
            </Pressable>
          </View>
          {playlistsLoading ? (
            <ActivityIndicator color={palette.primaryStrong} style={{ marginTop: 24 }} />
          ) : userPlaylists.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center', gap: 10 }}>
              <Text style={{ color: palette.subtext, fontWeight: '700' }}>No playlists yet.</Text>
              <Pressable onPress={() => { setPlaylistModalOpen(false); navigation.navigate('PlaylistList'); }} style={[styles.modalBtn, { backgroundColor: palette.primaryStrong }]}>
                <Text style={{ color: palette.onPrimary, fontWeight: '900' }}>Create a playlist</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
              {userPlaylists.map(pl => (
                <Pressable key={pl.id} onPress={() => handleAddToSpecificPlaylist(pl.id)} style={[styles.playlistRow, { borderColor: palette.border }]}>
                  <KISIcon name="list" size={18} color={palette.primaryStrong} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.text, fontWeight: '900', fontSize: 14 }}>{pl.name}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '600' }}>{pl.item_count} items</Text>
                  </View>
                  <KISIcon name="chevron-right" size={16} color={palette.border} />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Super Thanks / Tip Modal */}
      <Modal visible={tipModal} transparent animationType="slide" onRequestClose={() => { setTipModal(false); setSelectedTipAmount(null); }}>
        <Pressable style={styles.modalBackdrop} onPress={() => { setTipModal(false); setSelectedTipAmount(null); }} />
        <View style={[styles.modalSheet, { backgroundColor: palette.surface }]}>
          <View style={[styles.modalHeader, { borderBottomColor: palette.border }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Support this creator</Text>
            <Pressable onPress={() => { setTipModal(false); setSelectedTipAmount(null); }} hitSlop={12}>
              <KISIcon name="close" size={20} color={palette.subtext} />
            </Pressable>
          </View>
          <View style={{ padding: 16, gap: 14 }}>
            <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 13 }}>Choose an amount</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[{ label: '💛 $1', cents: 100 }, { label: '🧡 $2', cents: 200 }, { label: '❤️ $5', cents: 500 }, { label: '💎 $10', cents: 1000 }].map(opt => (
                <Pressable
                  key={opt.cents}
                  onPress={() => setSelectedTipAmount(opt.cents)}
                  style={[
                    { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
                    {
                      backgroundColor: selectedTipAmount === opt.cents ? palette.primarySoft : palette.bg,
                      borderColor: selectedTipAmount === opt.cents ? palette.primaryStrong : palette.border,
                    },
                  ]}
                >
                  <Text style={{ fontWeight: '800', fontSize: 13, color: selectedTipAmount === opt.cents ? palette.primaryStrong : palette.text }}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {selectedTipAmount !== null && (
              <View style={{ gap: 10 }}>
                <Pressable
                  onPress={() => !tipping && processTip(selectedTipAmount, 'flutterwave')}
                  style={[styles.modalBtn, { backgroundColor: tipping ? palette.border : palette.gold }]}
                  disabled={tipping}
                >
                  <Text style={{ color: palette.onPrimary, fontWeight: '900' }}>{tipping ? 'Processing…' : 'Pay with Flutterwave'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => !tipping && processTip(selectedTipAmount, 'stripe')}
                  style={[styles.modalBtn, { backgroundColor: tipping ? palette.border : palette.primaryStrong }]}
                  disabled={tipping}
                >
                  <Text style={{ color: palette.onPrimary, fontWeight: '900' }}>{tipping ? 'Processing…' : 'Pay with Stripe (card)'}</Text>
                </Pressable>
              </View>
            )}
            <Pressable
              onPress={() => { setTipModal(false); setSelectedTipAmount(null); }}
              style={[styles.modalBtn, { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }]}
            >
              <Text style={{ color: palette.subtext, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Create Clip Modal */}
      <Modal visible={clipModalOpen} transparent animationType="slide" onRequestClose={() => setClipModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setClipModalOpen(false)} />
        <View style={[styles.modalSheet, { backgroundColor: palette.surface }]}>
          <View style={[styles.modalHeader, { borderBottomColor: palette.border }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Create a Clip</Text>
            <Pressable onPress={() => setClipModalOpen(false)} hitSlop={12}>
              <KISIcon name="close" size={20} color={palette.subtext} />
            </Pressable>
          </View>
          <View style={{ padding: 16, gap: 14 }}>
            <View>
              <Text style={[styles.clipLabel, { color: palette.subtext }]}>Clip title (optional)</Text>
              <TextInput
                value={clipTitle}
                onChangeText={setClipTitle}
                placeholder="Give your clip a name…"
                placeholderTextColor={palette.subtext}
                style={[styles.clipInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.bg, }]}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.clipLabel, { color: palette.subtext }]}>Start (seconds)</Text>
                <TextInput
                  value={clipStart}
                  onChangeText={setClipStart}
                  keyboardType="number-pad"
                  style={[styles.clipInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.bg, }]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.clipLabel, { color: palette.subtext }]}>End (seconds)</Text>
                <TextInput
                  value={clipEnd}
                  onChangeText={setClipEnd}
                  keyboardType="number-pad"
                  style={[styles.clipInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.bg, }]}
                />
              </View>
            </View>
            <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '600' }}>Max 60 seconds per clip.</Text>
            <Pressable onPress={handleCreateClip} style={[styles.modalBtn, { backgroundColor: clipping ? palette.border : palette.primaryStrong }]}>
              <Text style={{ color: palette.onPrimary, fontWeight: '900' }}>{clipping ? 'Creating…' : 'Create clip'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ActionButton({ icon, label, value, onPress }: { icon: string; label: string; value: string; onPress: () => void }) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  return (
    <Pressable onPress={onPress} style={[styles.actionButton, { backgroundColor: palette.surfaceElevated, borderColor: palette.border, width: compact ? '47%' : '30.5%', minHeight: compact ? 68 : 76 }]}> 
      <KISIcon name={icon} size={18} color={palette.primaryStrong} />
      <Text style={[styles.actionLabel, { color: palette.text }]}>{label}</Text>
      <Text style={[styles.actionValue, { color: palette.subtext }]}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stageWrap: { minHeight: 320 },
  autoplayBanner: { position: 'absolute', bottom: 12, left: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.82)', borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 20 },
  autoplayLabel: { fontSize: 11, fontWeight: '700' },
  autoplayTitle: { fontWeight: '900', fontSize: 13 },
  autoplayBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  autoplayProgress: { height: 3, borderBottomLeftRadius: 10 },
  mediaStage: { height: 340, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  textStage: { minHeight: 340, paddingHorizontal: 24, paddingTop: 70, justifyContent: 'center' },
  richTextStage: { fontSize: 25, lineHeight: 34, fontWeight: '800' },
  mediaOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.16)' },
  backButton: { position: 'absolute', left: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  playBubble: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' },
  largeIconBubble: { width: 94, height: 94, borderRadius: 47, alignItems: 'center', justifyContent: 'center' },
  mediaStageTitle: { marginTop: 18, fontSize: 18, fontWeight: '900' },
  openFileButton: { marginTop: 14, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  liveBadge: { position: 'absolute', top: 78, left: 20, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  liveBadgeText: { fontWeight: '900', fontSize: 11, textTransform: 'uppercase' },
  galleryCount: { position: 'absolute', right: 14, bottom: 14, backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  galleryCountText: { fontWeight: '900', fontSize: 11 },
  titleTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  dateText: { fontSize: 11, fontWeight: '800' },
  title: { marginTop: 12, fontSize: 24, lineHeight: 31, fontWeight: '900', letterSpacing: 0 },
  description: { marginTop: 10, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  channelRow: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  channelAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  channelName: { fontSize: 14, fontWeight: '900' },
  channelHandle: { marginTop: 2, fontSize: 11, fontWeight: '700' },
  resumeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  resumeText: { flex: 1, fontSize: 13, fontWeight: '800' },
  actionGrid: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionButton: { width: '30.5%', minHeight: 76, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', padding: 8 },
  actionLabel: { marginTop: 5, fontSize: 11, fontWeight: '900' },
  actionValue: { marginTop: 2, fontSize: 10, fontWeight: '700' },
  assetsBlock: { paddingHorizontal: 16, marginTop: 18 },
  sectionTitle: { fontSize: 17, fontWeight: '900', marginBottom: 10 },
  assetRow: { borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  assetTitle: { fontSize: 13, fontWeight: '900' },
  assetMeta: { marginTop: 2, fontSize: 11, fontWeight: '700' },
  retryButton: { marginTop: 14, borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  relatedCard: { width: 160, borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  relatedThumb: { height: 90, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  relatedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
  relatedBody: { padding: 8 },
  relatedTitle: { fontSize: 12, fontWeight: '800', lineHeight: 17 },
  relatedChannel: { marginTop: 3, fontSize: 11, fontWeight: '600' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: '900' },
  modalBtn: { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center' },
  playlistRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  clipLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  clipInput: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
});

const makeStyles = (palette: ReturnType<typeof useKISTheme>['palette']) => StyleSheet.create({
  contentCard: {
    marginHorizontal: 16,
    marginTop: -24,
    borderRadius: 8,
    padding: 16,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.shadow ?? palette.royalInk,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
});
