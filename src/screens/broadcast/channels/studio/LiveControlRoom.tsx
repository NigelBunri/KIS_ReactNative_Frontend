// src/screens/broadcast/channels/studio/LiveControlRoom.tsx
//
// Broadcaster control room — manages the full lifecycle of a live stream.
//
// Panels (shown when a stream is selected for management):
//   • StreamHealthBar   — live health metrics from the WebRTC service
//   • CameraSourceSelector — multi-camera switching (device + RTMP sources)
//   • Broadcaster controls — Go Live (WebRTC/WHIP), Stop, switching
//   • Stream credentials — ingest URL + stream key (for OBS/hardware)
//   • OBS setup guide   — step-by-step RTMP ingest instructions
//
// Stream list panel:
//   • Schedule new stream (title, description, time)
//   • Start / Stop / Preview per-stream

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import Video from 'react-native-video';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import KISDateTimeInput from '@/constants/KISDateTimeInput';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES, { CHAT_BASE_URL } from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import { patchRequest } from '@/network/patch';
import { uploadFileToBackend } from '@/Module/ChatRoom/uploadFileToBackend';
import { getAccessToken } from '@/security/authStorage';
import {
  cancelLiveStream,
  editLiveStream,
  endLiveStream,
  fetchChannelLiveStreams,
  scheduleChannelLiveStream,
  startLiveStream,
} from '@/screens/broadcast/channels/hooks/useChannelsData';
import type {
  BroadcastChannelLiveStream,
  BroadcastChannelSummary,
} from '@/screens/broadcast/channels/api/channels.types';
import {
  liveStreamingService,
  webRTCStreamingAvailable,
} from '@/services/liveStreamingService';
import type { StreamHealthStats } from '@/services/liveStreamingService';
import { useLiveStream } from '../hooks/useLiveStream';
import StreamHealthBar from '../components/StreamHealthBar';
import CameraSourceSelector from '../components/CameraSourceSelector';

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  channel: BroadcastChannelSummary;
  onOpenWatch?: (stream: BroadcastChannelLiveStream) => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const statusColor = (status: string, palette: any) => {
  if (status === 'live')    return palette.danger;
  if (status === 'ended')   return palette.subtext;
  return palette.primaryStrong;
};

const emptyStats: StreamHealthStats = {
  bitrateBps: 0, frameRate: 0, packetsLost: 0,
  roundTripTimeMs: 0, audioLevelDb: 0,
  resolution: { width: 0, height: 0 }, isConnected: false,
};

// ── OBS guide card ────────────────────────────────────────────────────────────

function OBSGuide({
  ingestUrl,
  streamKey,
  palette,
}: {
  ingestUrl: string;
  streamKey: string;
  palette: any;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={[styles.guideCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={styles.guideHeader}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Collapse OBS setup guide' : 'Expand OBS setup guide'}
      >
        <KISIcon name="monitor" size={16} color={palette.primaryStrong} />
        <Text style={[styles.guideTitle, { color: palette.text }]}>
          OBS / External encoder setup
        </Text>
        <KISIcon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={palette.subtext} />
      </Pressable>

      {open && (
        <View style={styles.guideBody}>
          <StepRow n={1} text="Open OBS → Settings → Stream" palette={palette} />
          <StepRow n={2} text={'Set Service to "Custom"\nSet Server to the RTMP ingest URL below'} palette={palette} />
          <CredRow label="RTMP URL" value={ingestUrl || 'Not available'} palette={palette} />
          <StepRow n={3} text="Paste the stream key shown below into the Stream Key field" palette={palette} />
          <CredRow label="Stream Key" value={streamKey || '—'} mask palette={palette} />
          <StepRow n={4} text="Click Start Streaming in OBS to go live" palette={palette} />
          <View style={[styles.guideNote, { backgroundColor: `${palette.primaryStrong}18` }]}>
            <KISIcon name="info" size={13} color={palette.primaryStrong} />
            <Text style={[styles.guideNoteText, { color: palette.primaryStrong }]}>
              For lowest latency, choose x264 codec with Keyframe Interval = 2 and preset = veryfast.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function StepRow({ n, text, palette }: { n: number; text: string; palette: any }) {
  return (
    <View style={styles.stepRow}>
      <View style={[styles.stepCircle, { backgroundColor: palette.primaryStrong }]}>
        <Text style={[styles.stepNum, { color: palette.onPrimary }]}>{n}</Text>
      </View>
      <Text style={[styles.stepText, { color: palette.subtext }]}>{text}</Text>
    </View>
  );
}

function CredRow({
  label,
  value,
  mask = false,
  palette,
}: {
  label: string;
  value: string;
  mask?: boolean;
  palette: any;
}) {
  const [revealed, setRevealed] = useState(false);
  const display = mask && !revealed ? '••••••••••••••••••••' : value;

  return (
    <View style={[styles.credRow, { borderColor: palette.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.credLabel, { color: palette.subtext }]}>{label}</Text>
        <Text
          style={[styles.credValue, { color: palette.text }]}
          numberOfLines={1}
          selectable
        >
          {display}
        </Text>
      </View>
      <View style={styles.credActions}>
        {mask && (
          <KISButton
            variant="ghost"
            onPress={() => setRevealed(r => !r)}
            style={styles.credBtn}
            accessibilityLabel={revealed ? `Hide ${label}` : `Reveal ${label}`}
          >
            <KISIcon name={revealed ? 'eye-off' : 'eye'} size={15} color={palette.subtext} />
          </KISButton>
        )}
        <KISButton
          variant="ghost"
          onPress={() => { Clipboard.setString(value); Alert.alert('Copied to clipboard'); }}
          style={styles.credBtn}
          accessibilityLabel={`Copy ${label}`}
        >
          <KISIcon name="copy" size={15} color={palette.subtext} />
        </KISButton>
      </View>
    </View>
  );
}

// ── Recordings panel (shown when stream status === 'ended') ──────────────────

type Recording = {
  id: string;
  title?: string;
  thumbnail_url?: string;
  playback_url?: string;
  duration?: number;
  created_at?: string;
};

function RecordingsPanel({
  streamId,
  palette,
}: {
  streamId: string;
  palette: any;
}) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading]       = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(
        ROUTES.broadcasts.recordings(streamId),
        { errorMessage: '' },
      );
      const list: Recording[] = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? (res as any)
        : [];
      setRecordings(list);
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  useEffect(() => { void load(); }, [load]);

  const handleShare = useCallback((recording: Recording) => {
    const url = recording.playback_url ?? '';
    if (!url) {
      Alert.alert('Share', 'Playback URL not available for this recording.');
      return;
    }
    void Share.share({ message: url });
  }, []);

  const handleDelete = useCallback((recording: Recording) => {
    Alert.alert(
      'Delete recording?',
      `"${recording.title ?? 'This recording'}" will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(recording.id);
            try {
              await deleteRequest(ROUTES.broadcasts.recordingDetail(recording.id));
              setRecordings(prev => prev.filter(r => r.id !== recording.id));
            } catch {
              Alert.alert('Delete failed', 'Unable to delete recording. Please try again.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  }, []);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <View style={[recStyles.panel, { borderColor: palette.border, backgroundColor: palette.card }]}>
      <View style={recStyles.header}>
        <KISIcon name="video" size={15} color={palette.primaryStrong} />
        <Text style={[recStyles.title, { color: palette.text }]}>Recordings</Text>
        {loading
          ? <ActivityIndicator size="small" color={palette.primaryStrong} />
          : <KISButton variant="ghost" onPress={load} accessibilityLabel="Refresh recordings">
              <KISIcon name="refresh" size={14} color={palette.subtext} />
            </KISButton>
        }
      </View>

      {!loading && recordings.length === 0 && (
        <Text style={[recStyles.empty, { color: palette.subtext }]}>
          No recordings found for this stream.
        </Text>
      )}

      {recordings.map(rec => (
        <View key={rec.id} style={[recStyles.row, { borderColor: palette.border }]}>
          <View style={recStyles.info}>
            <Text style={[recStyles.recTitle, { color: palette.text }]} numberOfLines={1}>
              {rec.title ?? 'Recording'}
            </Text>
            <Text style={[recStyles.recMeta, { color: palette.subtext }]}>
              {rec.created_at ? new Date(rec.created_at).toLocaleDateString() : ''}
              {rec.duration ? `  ·  ${formatDuration(rec.duration)}` : ''}
            </Text>
          </View>
          <View style={recStyles.actions}>
            <KISButton
              size="xs"
              variant="outline"
              title="Share"
              left={<KISIcon name="share" size={14} color={palette.primaryStrong} />}
              onPress={() => handleShare(rec)}
            />
            <KISButton
              size="xs"
              variant="danger"
              title="Delete"
              loading={deletingId === rec.id}
              disabled={deletingId === rec.id}
              left={deletingId === rec.id ? undefined : <KISIcon name="trash" size={14} color={palette.onPrimary} />}
              onPress={() => handleDelete(rec)}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const recStyles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  title: { flex: 1, fontSize: 13, fontWeight: '900' },
  empty: { fontSize: 12, fontWeight: '600', lineHeight: 18 },
  row: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  info: { flex: 1 },
  recTitle: { fontSize: 12, fontWeight: '800' },
  recMeta: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 6 },
});

// ── Broadcaster control panel ─────────────────────────────────────────────────

type LatencyMode = 'normal' | 'low' | 'ultra_low';
const LATENCY_OPTIONS: Array<{ value: LatencyMode; label: string }> = [
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low Latency' },
  { value: 'ultra_low', label: 'Ultra Low' },
];
const DVR_WINDOW_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1800, label: '30 min' },
  { value: 3600, label: '1 hr' },
  { value: 7200, label: '2 hr' },
  { value: 14400, label: '4 hr' },
];

function BroadcasterPanel({
  stream,
  palette,
}: {
  stream: BroadcastChannelLiveStream;
  palette: any;
}) {
  const [serviceState, setServiceState] = useState(liveStreamingService.state);
  const [healthStats, setHealthStats]   = useState<StreamHealthStats>(emptyStats);
  const [streamKey,   setStreamKey]     = useState('');
  const [keyLoading,  setKeyLoading]    = useState(false);
  const [rotating,    setRotating]      = useState(false);
  const [switching,   setSwitching]     = useState(false);
  // liveStreamingService previously swallowed ICE-trickle/teardown/stats
  // failures with `.catch(() => {})` — a broadcaster could sit stuck on
  // "CONNECTING" with zero diagnostics. This surfaces whatever the service
  // now reports via onError as a small dismissible banner, non-blocking.
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | null>(null);

  // Stream settings state
  const [latencyMode, setLatencyMode] = useState<LatencyMode>(stream.latency_mode ?? 'normal');
  const [dvrEnabled, setDvrEnabled]   = useState<boolean>(stream.dvr_enabled ?? false);
  const [dvrWindow, setDvrWindow]     = useState<number>(stream.dvr_window_seconds ?? 3600);
  const [patchingSettings, setPatchingSettings] = useState(false);

  const patchSettings = useCallback(async (patch: Record<string, unknown>) => {
    setPatchingSettings(true);
    try {
      await patchRequest(
        ROUTES.broadcasts.liveStreamSettings(stream.id),
        patch,
        { errorMessage: '' },
      );
    } catch {
      Alert.alert('Error', 'Could not update stream settings.');
    } finally {
      setPatchingSettings(false);
    }
  }, [stream.id]);

  const handleLatencyChange = useCallback(async (mode: LatencyMode) => {
    setLatencyMode(mode);
    await patchSettings({ latency_mode: mode });
  }, [patchSettings]);

  const handleDvrToggle = useCallback(async (val: boolean) => {
    setDvrEnabled(val);
    const patch: Record<string, unknown> = { dvr_enabled: val };
    if (val) patch.dvr_window_seconds = dvrWindow;
    await patchSettings(patch);
  }, [dvrWindow, patchSettings]);

  const handleDvrWindowChange = useCallback(async (secs: number) => {
    setDvrWindow(secs);
    await patchSettings({ dvr_window_seconds: secs });
  }, [patchSettings]);

  const {
    viewerCount,
    cameraSources,
    activeCameraId,
    switchCamera,
  } = useLiveStream(stream.id);

  // Reports publisher-side connection health back to Django (E3 of the
  // analytics batch) - "good" is debounced to at most once per 15s since
  // onStats ticks frequently, "error" always reports immediately since
  // it's a discrete, notable event, not a steady-state tick.
  const lastHealthReportAtRef = useRef(0);
  const reportHealth = useCallback((healthStatus: 'good' | 'degraded' | 'error', detail?: string) => {
    const now = Date.now();
    if (healthStatus === 'good' && now - lastHealthReportAtRef.current < 15_000) return;
    lastHealthReportAtRef.current = now;
    void postRequest(
      ROUTES.broadcasts.liveStreamHealth(stream.id),
      { status: healthStatus, detail: detail || '' },
      { errorMessage: '' },
    );
  }, [stream.id]);

  // Subscribe to service state + stats + errors
  useEffect(() => {
    const unsub1 = liveStreamingService.onStateChange(state => {
      console.log('[LiveControlRoom] liveStreamingService state ->', state);
      setServiceState(state);
      // A fresh connection attempt shouldn't show a stale error banner.
      if (state === 'connecting' || state === 'live') setConnectionErrorMessage(null);
    });
    const unsub2 = liveStreamingService.onStats(stats => {
      setHealthStats(stats);
      reportHealth('good');
    });
    const unsub3 = liveStreamingService.onError(err => {
      console.error('[LiveControlRoom] liveStreamingService onError ->', err?.message ?? err);
      setConnectionErrorMessage(err?.message || 'A connection problem occurred.');
      reportHealth('error', err?.message);
    });
    setServiceState(liveStreamingService.state);
    setHealthStats(liveStreamingService.stats);
    return () => {
      unsub1(); unsub2(); unsub3();
      // Leaving this screen (back navigation, tab switch) while still
      // live/connecting previously left the device camera/mic captured
      // and the WebRTC peer connection open with no UI left to stop it —
      // only the explicit "End Stream" button called stopBroadcast().
      // liveStreamingService.state reads the singleton's current state
      // directly, not stale closure state, so this is accurate at the
      // actual moment of unmount.
      if (['live', 'connecting', 'reconnecting'].includes(liveStreamingService.state)) {
        void liveStreamingService.stopBroadcast();
      }
    };
  }, [reportHealth]);

  // Fetch stream key for RTMP/OBS section. Previously guarded on `streamKey`
  // too, which meant that once a key was loaded, the button's onPress was a
  // permanent no-op — tapping "Stream key loaded" again looked actionable
  // (not disabled) but silently did nothing, with no way to re-fetch from
  // this screen at all.
  const fetchStreamKey = useCallback(async () => {
    if (keyLoading) return;
    console.log('[LiveControlRoom] fetchStreamKey -> GET', ROUTES.broadcasts.liveStreamStreamKey(stream.id));
    setKeyLoading(true);
    try {
      const res = await getRequest(
        ROUTES.broadcasts.liveStreamStreamKey(stream.id),
        { errorMessage: 'Unable to load stream key.' },
      );
      console.log('[LiveControlRoom] fetchStreamKey response', {
        success: res?.success,
        provider: res?.data?.provider,
        hasStreamKey: !!(res?.data?.stream_key ?? res?.data?.key),
        ingestUrl: res?.data?.ingest_url,
      });
      if (res?.success) {
        setStreamKey(String(res.data?.stream_key ?? res.data?.key ?? ''));
      } else {
        console.error('[LiveControlRoom] fetchStreamKey failed', res);
      }
    } catch (e: any) {
      console.error('[LiveControlRoom] fetchStreamKey threw', e?.message ?? e);
    } finally {
      setKeyLoading(false);
    }
  }, [stream.id, keyLoading]);

  // The "RTMP URL" row above reads straight from the `stream` prop and
  // shows immediately; "Stream Key" sat empty ("—") until a broadcaster
  // found and tapped the separate "Load stream key for OBS" button
  // further down this screen - from a first-time user's perspective that
  // looked like a bug ("the URL shows but the key doesn't"), not a
  // deliberate two-step flow. Auto-loading once per stream removes that
  // step for the common case; the button stays for an explicit re-fetch.
  useEffect(() => { void fetchStreamKey(); }, [stream.id]);

  // Rotate the stream key: invalidates whatever's currently pasted into
  // OBS, so this is a destructive confirm, not a plain button press.
  // Server-side blocks this while status === 'live' (no supported
  // encoder client can swap keys mid-broadcast) - this check is a UX
  // short-circuit for that same rule, not the actual enforcement.
  const rotateStreamKey = useCallback(() => {
    if (rotating || stream.status === 'live') return;
    Alert.alert(
      'Rotate stream key?',
      'The current key will stop working immediately. Anything already set up in OBS will need the new key pasted in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rotate',
          style: 'destructive',
          onPress: async () => {
            console.log('[LiveControlRoom] rotateStreamKey -> POST', ROUTES.broadcasts.liveStreamStreamKeyRotate(stream.id));
            setRotating(true);
            try {
              const res = await postRequest(
                ROUTES.broadcasts.liveStreamStreamKeyRotate(stream.id),
                {},
                { errorMessage: 'Unable to rotate stream key.' },
              );
              console.log('[LiveControlRoom] rotateStreamKey response', {
                success: res?.success, provider: res?.data?.provider,
                hasStreamKey: !!res?.data?.stream_key,
              });
              if (res?.success) {
                setStreamKey(String(res.data?.stream_key ?? ''));
              } else {
                console.error('[LiveControlRoom] rotateStreamKey failed', res);
              }
            } catch (e: any) {
              console.error('[LiveControlRoom] rotateStreamKey threw', e?.message ?? e);
            } finally {
              setRotating(false);
            }
          },
        },
      ],
    );
  }, [stream.id, stream.status, rotating]);

  // Go live (WebRTC/WHIP from device camera)
  const handleGoLive = useCallback(() => {
    if (!webRTCStreamingAvailable) {
      Alert.alert(
        'WebRTC unavailable',
        'React Native WebRTC is not installed. Use OBS or another RTMP encoder instead.',
      );
      return;
    }
    Alert.alert(
      'Go live from device?',
      'This will start streaming your device camera to the audience immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Go Live',
          style: 'destructive',
          onPress: async () => {
            console.log('[LiveControlRoom] handleGoLive -> startBroadcast', {
              streamId: stream.id,
              whipEndpoint: ROUTES.broadcasts.liveStreamWhip(stream.id),
            });
            try {
              await liveStreamingService.startBroadcast({
                streamId: stream.id,
                whipEndpoint: ROUTES.broadcasts.liveStreamWhip(stream.id),
              });
              console.log('[LiveControlRoom] startBroadcast resolved — connect() setup finished');
            } catch (e: any) {
              console.error('[LiveControlRoom] startBroadcast threw', e?.message ?? e);
              Alert.alert('Start failed', e?.message ?? 'Unable to start broadcast.');
            }
          },
        },
      ],
    );
  }, [stream.id]);

  // Stop broadcast
  const handleStop = useCallback(() => {
    Alert.alert(
      'End this stream?',
      'The broadcast will end for all viewers.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Stream',
          style: 'destructive',
          onPress: async () => {
            console.log('[LiveControlRoom] handleStop -> stopBroadcast + endLiveStream', stream.id);
            try {
              await liveStreamingService.stopBroadcast();
              await endLiveStream(stream.id);
              console.log('[LiveControlRoom] handleStop complete');
            } catch (e: any) {
              console.error('[LiveControlRoom] handleStop threw', e?.message ?? e);
            }
          },
        },
      ],
    );
  }, [stream.id]);

  // Switch camera source
  const handleSwitchSource = useCallback(async (sourceId: string) => {
    setSwitching(true);
    try {
      await switchCamera(sourceId);
    } finally {
      setSwitching(false);
    }
  }, [switchCamera]);

  // Switch device-facing camera (front ↔ back)
  const handleFlipCamera = useCallback(async () => {
    if (!webRTCStreamingAvailable || serviceState !== 'live') return;
    try {
      await liveStreamingService.switchDeviceCamera();
    } catch {
      Alert.alert('Camera', 'Unable to switch camera. Please try again.');
    }
  }, [serviceState]);

  const isDeviceLive    = serviceState === 'live';
  const isConnecting    = serviceState === 'connecting';
  const isReconnecting  = serviceState === 'reconnecting';
  const ingestUrl       = stream.ingest_url ?? '';

  return (
    <View>
      {/* Non-blocking connection diagnostics banner — previously these
          failures were swallowed silently and the broadcaster had no way
          to know why they were stuck on "CONNECTING". */}
      {connectionErrorMessage && (isDeviceLive || isConnecting || isReconnecting) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginBottom: 8,
            borderRadius: 10,
            backgroundColor: palette?.warningSoft ?? '#3a2a12',
          }}
        >
          <Text
            style={{ flex: 1, color: palette?.warningStrong ?? '#f5a623', fontSize: 12, fontWeight: '600' }}
            numberOfLines={2}
          >
            {connectionErrorMessage}
          </Text>
          <KISButton
            variant="ghost"
            onPress={() => setConnectionErrorMessage(null)}
            accessibilityLabel="Dismiss connection error"
          >
            <Text style={{ color: palette?.warningStrong ?? '#f5a623', fontWeight: '900' }}>×</Text>
          </KISButton>
        </View>
      )}

      {/* Health bar (when device is broadcasting) */}
      {(isDeviceLive || isConnecting || isReconnecting) && (
        <StreamHealthBar
          stats={healthStats}
          viewerCount={viewerCount}
          startedAt={stream.started_at}
          palette={palette}
        />
      )}

      {/* Camera source grid (server-side sources) */}
      {cameraSources.length > 0 && (
        <CameraSourceSelector
          sources={cameraSources}
          activeCamId={activeCameraId}
          onSwitch={handleSwitchSource}
          switching={switching}
          palette={palette}
        />
      )}

      {/* Device broadcast controls */}
      {webRTCStreamingAvailable && (
        <View style={styles.deviceRow}>
          {!isDeviceLive && !isConnecting && !isReconnecting ? (
            <KISButton
              variant="danger"
              title="Go Live from Device"
              left={<KISIcon name="broadcast" size={16} color={palette.onPrimary} />}
              onPress={handleGoLive}
            />
          ) : (
            <>
              <View style={[styles.liveIndicator, { backgroundColor: `${palette.danger}22` }]}>
                {isConnecting || isReconnecting ? (
                  <ActivityIndicator size="small" color={palette.danger} />
                ) : (
                  <View style={[styles.liveDot, { backgroundColor: palette.danger }]} />
                )}
                <Text style={[styles.liveIndicatorText, { color: palette.danger }]}>
                  {isReconnecting ? 'Reconnecting…' : isConnecting ? 'Connecting…' : 'LIVE from device'}
                </Text>
              </View>
              {isDeviceLive && (
                <KISButton variant="outline" onPress={handleFlipCamera} accessibilityLabel="Flip camera">
                  <KISIcon name="refresh" size={16} color={palette.primaryStrong} />
                </KISButton>
              )}
              <KISButton
                variant="danger"
                title="Stop"
                left={<KISIcon name="square" size={14} color={palette.onPrimary} />}
                onPress={handleStop}
              />
            </>
          )}
        </View>
      )}

      {/* Credentials / OBS section */}
      <KISButton
        variant="outline"
        onPress={fetchStreamKey}
        disabled={keyLoading}
        title={keyLoading ? 'Loading…' : streamKey ? 'Reload stream key for OBS' : 'Load stream key for OBS'}
        left={<KISIcon name="key" size={14} color={palette.primaryStrong} />}
        right={keyLoading ? <ActivityIndicator size="small" color={palette.primaryStrong} /> : undefined}
      />

      {streamKey && stream.status !== 'live' && (
        <KISButton
          variant="ghost"
          onPress={rotateStreamKey}
          disabled={rotating}
          title={rotating ? 'Rotating…' : 'Rotate stream key'}
          left={<KISIcon name="refresh" size={14} color={palette.subtext} />}
          right={rotating ? <ActivityIndicator size="small" color={palette.subtext} /> : undefined}
        />
      )}

      {(ingestUrl || streamKey) && (
        <OBSGuide
          ingestUrl={ingestUrl}
          streamKey={streamKey}
          palette={palette}
        />
      )}

      {/* Stream Settings — Latency + DVR */}
      <View style={[styles.settingsCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
        <View style={styles.settingsHeader}>
          <KISIcon name="settings" size={14} color={palette.primaryStrong} />
          <Text style={[styles.settingsTitle, { color: palette.text }]}>Stream Settings</Text>
          {patchingSettings && <ActivityIndicator size="small" color={palette.primaryStrong} />}
        </View>

        {/* Latency mode */}
        <Text style={[styles.settingsLabel, { color: palette.subtext }]}>Latency Mode</Text>
        <View style={styles.pillRow}>
          {LATENCY_OPTIONS.map(opt => {
            const active = latencyMode === opt.value;
            return (
              <KISButton
                key={opt.value}
                title={opt.label}
                size="xs"
                variant={active ? 'primary' : 'outline'}
                onPress={() => void handleLatencyChange(opt.value)}
              />
            );
          })}
        </View>

        {/* DVR */}
        <View style={styles.dvrRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsLabel, { color: palette.subtext }]}>DVR (rewind)</Text>
          </View>
          <Switch
            value={dvrEnabled}
            onValueChange={val => void handleDvrToggle(val)}
            trackColor={{ true: palette.primaryStrong }}
            thumbColor={palette.ivory}
          />
        </View>
        {dvrEnabled && (
          <View style={styles.pillRow}>
            {DVR_WINDOW_OPTIONS.map(opt => {
              const active = dvrWindow === opt.value;
              return (
                <KISButton
                  key={opt.value}
                  title={opt.label}
                  size="xs"
                  variant={active ? 'primary' : 'outline'}
                  onPress={() => void handleDvrWindowChange(opt.value)}
                />
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LiveControlRoom({ channel, onOpenWatch }: Props) {
  const { palette } = useKISTheme();
  const [streams,    setStreams]    = useState<BroadcastChannelLiveStream[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [editingStreamId, setEditingStreamId] = useState<string | null>(null);
  const [title,      setTitle]      = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [description, setDescription] = useState('');
  // The "wait" asset shown to viewers on the pre-live screen before this
  // scheduled stream goes live — either a static image or an always-playing
  // looping video. Leaving both blank falls back to the viewer's default
  // loading screen (LiveWatchPage.tsx), unchanged from today.
  const [waitMediaUrl, setWaitMediaUrl] = useState('');
  const [waitMediaType, setWaitMediaType] = useState<'image' | 'video' | ''>('');
  const [waitMediaUploading, setWaitMediaUploading] = useState(false);
  const [activeId,   setActiveId]   = useState<string | null>(null);
  // Guards Start/End against duplicate requests for the same stream — e.g.
  // a slow network leaving the button tappable long enough for a second
  // tap (new Alert → confirm) to fire a second startLiveStream/endLiveStream
  // call before the first one resolves. Keyed by stream id since several
  // stream cards can be mid-action independently.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const withPending = useCallback(async (streamId: string, action: () => Promise<void>) => {
    setPendingIds(prev => new Set(prev).add(streamId));
    try {
      await action();
    } finally {
      setPendingIds(prev => {
        const next = new Set(prev);
        next.delete(streamId);
        return next;
      });
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStreams(await fetchChannelLiveStreams(channel.id));
    } finally {
      setLoading(false);
    }
  }, [channel.id]);

  useEffect(() => { void load(); }, [load]);

  const upcoming = useMemo(
    () => streams.filter(s => s.status !== 'ended' && s.status !== 'cancelled'),
    [streams],
  );

  const ended = useMemo(
    () => streams.filter(s => s.status === 'ended'),
    [streams],
  );

  const handlePickWaitMedia = useCallback(async () => {
    if (waitMediaUploading) return;
    const picked = await launchImageLibrary({ mediaType: 'mixed', selectionLimit: 1, quality: 0.9 });
    if (picked.didCancel) return;
    const asset = picked.assets?.[0];
    if (!asset?.uri) return;
    const mediaType: 'image' | 'video' = String(asset.type || '').startsWith('video/') ? 'video' : 'image';
    const token = await getAccessToken();
    if (!token) { Alert.alert('Not signed in', 'Please log in again.'); return; }
    try {
      setWaitMediaUploading(true);
      const uploaded = await uploadFileToBackend({
        file: {
          uri: asset.uri,
          name: asset.fileName ?? (mediaType === 'video' ? 'live-wait.mp4' : 'live-wait.jpg'),
          type: asset.type ?? (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
          size: asset.fileSize,
          durationMs: asset.duration ? asset.duration * 1000 : undefined,
        },
        authToken: token,
        baseUrl: CHAT_BASE_URL,
        context: 'broadcast_live_wait_media',
      });
      setWaitMediaUrl(uploaded.url);
      setWaitMediaType(mediaType);
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message || 'Unable to upload wait image/video.');
    } finally {
      setWaitMediaUploading(false);
    }
  }, [waitMediaUploading]);

  const handleClearWaitMedia = useCallback(() => {
    setWaitMediaUrl('');
    setWaitMediaType('');
  }, []);

  const updateStream = useCallback((next: BroadcastChannelLiveStream | null) => {
    if (!next) return;
    setStreams(prev => prev.map(s => s.id === next.id ? next : s));
  }, []);

  const resetForm = useCallback(() => {
    setEditingStreamId(null);
    setTitle('');
    setDescription('');
    setScheduledAt('');
    setWaitMediaUrl('');
    setWaitMediaType('');
  }, []);

  const handleEditPress = useCallback((stream: BroadcastChannelLiveStream) => {
    setEditingStreamId(stream.id);
    setTitle(stream.title || '');
    setDescription(stream.description || '');
    setScheduledAt(stream.scheduled_start_at || '');
    setWaitMediaUrl(stream.thumbnail_url || '');
    setWaitMediaType((stream.thumbnail_media_type as 'image' | 'video' | '') || '');
  }, []);

  const handleSchedule = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (editingStreamId) {
        // editLiveStream resolves null (never throws) on failure — same
        // silent-no-op risk the create path below already guards against.
        const next = await editLiveStream(editingStreamId, {
          title:        title.trim(),
          description:  description.trim(),
          scheduled_start_at: scheduledAt.trim() || undefined,
          thumbnail_url: waitMediaUrl || undefined,
          thumbnail_media_type: waitMediaUrl ? waitMediaType : undefined,
        });
        if (next) {
          setStreams(prev => prev.map(s => s.id === next.id ? next : s));
          resetForm();
        } else {
          Alert.alert('Could not save changes', 'Please check the details and try again.');
        }
        return;
      }
      // scheduleChannelLiveStream resolves null (never throws) on failure —
      // without an else branch here, a failed schedule attempt just left
      // the form filled in with zero feedback that nothing was saved.
      const next = await scheduleChannelLiveStream(channel.id, {
        title:        title.trim(),
        description:  description.trim(),
        scheduled_start_at: scheduledAt.trim() || undefined,
        thumbnail_url: waitMediaUrl || undefined,
        thumbnail_media_type: waitMediaUrl ? waitMediaType : undefined,
      });
      if (next) {
        setStreams(prev => [next, ...prev]);
        resetForm();
      } else {
        Alert.alert('Could not schedule stream', 'Please check the details and try again.');
      }
    } finally {
      setSaving(false);
    }
  }, [channel.id, description, editingStreamId, resetForm, scheduledAt, title, waitMediaUrl, waitMediaType]);

  const handleCancelStream = useCallback((stream: BroadcastChannelLiveStream) => {
    if (pendingIds.has(stream.id)) return;
    Alert.alert('Cancel this stream?', `"${stream.title}" will be removed from the schedule. This cannot be undone.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel stream',
        style: 'destructive',
        onPress: () => {
          void withPending(stream.id, async () => {
            const next = await cancelLiveStream(stream.id);
            if (next) {
              updateStream(next);
              if (editingStreamId === stream.id) resetForm();
            } else {
              Alert.alert('Could not cancel stream', 'Please try again.');
            }
          });
        },
      },
    ]);
  }, [editingStreamId, pendingIds, resetForm, updateStream, withPending]);

  const handleStart = useCallback((stream: BroadcastChannelLiveStream) => {
    if (stream.status === 'live' || pendingIds.has(stream.id)) {
      if (stream.status === 'live') Alert.alert('Already live');
      return;
    }
    Alert.alert(
      'Start live stream?',
      `"${stream.title}" will be visible to subscribers immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: () => {
            void withPending(stream.id, async () => {
              // startLiveStream resolves null (never throws) on failure —
              // piping straight into updateStream (a no-op on null) meant a
              // failed "Start" tap did nothing with zero feedback that the
              // stream never actually went live.
              const next = await startLiveStream(stream.id);
              if (next) {
                updateStream(next);
              } else {
                Alert.alert('Could not start stream', 'Please try again.');
              }
            });
          },
        },
      ],
    );
  }, [updateStream, withPending, pendingIds]);

  const handleEnd = useCallback((stream: BroadcastChannelLiveStream) => {
    if (pendingIds.has(stream.id)) return;
    Alert.alert('End stream?', `"${stream.title}" will end for all viewers.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End',
        style: 'destructive',
        onPress: () => {
          void withPending(stream.id, async () => {
            // endLiveStream resolves null (never throws) on failure — same
            // silent-no-op risk as handleStart above.
            const next = await endLiveStream(stream.id);
            if (next) {
              updateStream(next);
            } else {
              Alert.alert('Could not end stream', 'Please try again.');
            }
          });
        },
      },
    ]);
  }, [updateStream, withPending, pendingIds]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.panelTitle, { color: palette.text }]}>Live control room</Text>
          <Text style={[styles.panelSubtitle, { color: palette.subtext }]}>
            Schedule, start, manage, and monitor channel broadcasts.
          </Text>
        </View>
        {loading
          ? <ActivityIndicator color={palette.primaryStrong} />
          : <KISButton variant="ghost" onPress={load} accessibilityLabel="Refresh live streams">
              <KISIcon name="refresh" size={20} color={palette.primaryStrong} />
            </KISButton>
        }
      </View>

      {/* Schedule form */}
      <View style={[styles.form, { borderColor: palette.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[styles.sectionLabel, { color: palette.subtext }]}>
            {editingStreamId ? 'Edit scheduled stream' : 'Schedule a new stream'}
          </Text>
          {editingStreamId ? (
            <KISButton variant="ghost" size="xs" title="Cancel edit" onPress={resetForm} />
          ) : null}
        </View>
        <KISTextInput label="Title" value={title} onChangeText={setTitle} />
        <KISDateTimeInput
          label="Scheduled start (optional)"
          mode="datetime"
          value={scheduledAt || null}
          onChange={setScheduledAt}
          placeholder="Select a start time"
        />
        <KISTextInput
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          multiline
          style={{ minHeight: 64 }}
        />
        <Text style={[styles.sectionLabel, { color: palette.subtext, marginTop: 4 }]}>
          Wait screen (optional)
        </Text>
        <Text style={[styles.panelSubtitle, { color: palette.subtext, marginBottom: 6 }]}>
          Shown to viewers before you go live. Pick an image, or a video that will
          play on a continuous loop until start time — if you don't set one, the
          default loading screen is shown instead.
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <KISButton
            variant="secondary"
            disabled={waitMediaUploading}
            loading={waitMediaUploading}
            onPress={handlePickWaitMedia}
            title={waitMediaUrl ? 'Replace wait image/video' : 'Pick wait image/video'}
            left={<KISIcon name="image" size={15} color={palette.primaryStrong} />}
          />
        </View>
        {waitMediaUrl ? (
          <View style={styles.waitMediaPreviewWrap}>
            <View style={[styles.waitMediaPreviewFrame, { borderColor: palette.border }]}>
              {waitMediaType === 'video' ? (
                <Video
                  source={{ uri: waitMediaUrl }}
                  style={styles.waitMediaPreviewMedia}
                  resizeMode="cover"
                  controls
                  paused
                  repeat
                />
              ) : (
                <Image
                  source={{ uri: waitMediaUrl }}
                  style={styles.waitMediaPreviewMedia}
                  resizeMode="cover"
                />
              )}
              <Pressable
                onPress={handleClearWaitMedia}
                accessibilityLabel="Remove wait image/video"
                style={styles.waitMediaRemoveBadge}
              >
                <KISIcon name="close" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
            <Text style={[styles.panelSubtitle, { color: palette.subtext, marginTop: 0 }]}>
              {waitMediaType === 'video'
                ? 'This is exactly what viewers will see, looping, before you go live.'
                : 'This is exactly what viewers will see before you go live.'}
            </Text>
          </View>
        ) : null}
        <KISButton
          disabled={saving || !title.trim() || waitMediaUploading}
          loading={saving}
          onPress={handleSchedule}
          title={editingStreamId ? 'Save changes' : 'Schedule stream'}
          left={<KISIcon name="calendar" size={15} color={palette.onPrimary} />}
        />
      </View>

      {/* Stream list */}
      {upcoming.length === 0 && !loading ? (
        <Text style={[styles.emptyText, { color: palette.subtext }]}>
          No scheduled or active streams.
        </Text>
      ) : (
        upcoming.map(stream => {
          const isActive = activeId === stream.id;
          return (
            <View
              key={stream.id}
              style={[
                styles.streamCard,
                { borderColor: isActive ? palette.primary : palette.border, backgroundColor: palette.card },
                isActive && { borderWidth: 2 },
              ]}
            >
              {/* Card header */}
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                    {stream.title}
                  </Text>
                  <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                    {stream.scheduled_start_at
                      ? new Date(stream.scheduled_start_at).toLocaleString()
                      : 'No schedule'
                    }
                    {stream.provider ? ` · ${stream.provider}` : ''}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: `${statusColor(stream.status, palette)}22` }]}>
                  <Text style={[styles.statusText, { color: statusColor(stream.status, palette) }]}>
                    {stream.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Broadcaster panel (expanded) */}
              {isActive && <BroadcasterPanel stream={stream} palette={palette} />}

              {/* Card actions */}
              <View style={styles.cardActions}>
                <KISButton
                  size="xs"
                  variant={isActive ? 'primary' : 'outline'}
                  title={isActive ? 'Collapse' : 'Manage'}
                  left={<KISIcon name={isActive ? 'chevron-up' : 'settings'} size={13} color={isActive ? palette.onPrimary : palette.subtext} />}
                  onPress={() => setActiveId(isActive ? null : stream.id)}
                />

                <KISButton
                  size="xs"
                  variant="outline"
                  title="Preview"
                  left={<KISIcon name="people" size={13} color={palette.subtext} />}
                  onPress={() => onOpenWatch?.(stream)}
                />

                {stream.status === 'scheduled' && (
                  <KISButton
                    size="xs"
                    variant="outline"
                    title="Edit"
                    disabled={pendingIds.has(stream.id)}
                    left={<KISIcon name="edit" size={13} color={palette.subtext} />}
                    onPress={() => handleEditPress(stream)}
                  />
                )}

                {stream.status === 'scheduled' && (
                  <KISButton
                    size="xs"
                    variant="outline"
                    title="Cancel"
                    loading={pendingIds.has(stream.id)}
                    disabled={pendingIds.has(stream.id)}
                    left={<KISIcon name="close" size={13} color={palette.subtext} />}
                    onPress={() => handleCancelStream(stream)}
                  />
                )}

                {stream.status !== 'live' && (
                  <KISButton
                    size="xs"
                    title="Start"
                    loading={pendingIds.has(stream.id)}
                    disabled={pendingIds.has(stream.id)}
                    left={<KISIcon name="play" size={13} color={palette.onPrimary} />}
                    onPress={() => handleStart(stream)}
                  />
                )}

                {stream.status === 'live' && (
                  <KISButton
                    size="xs"
                    variant="danger"
                    title="End"
                    loading={pendingIds.has(stream.id)}
                    disabled={pendingIds.has(stream.id)}
                    left={<KISIcon name="square" size={13} color={palette.onPrimary} />}
                    onPress={() => handleEnd(stream)}
                  />
                )}
              </View>
            </View>
          );
        })
      )}

      {/* Ended streams — show with Recordings panel */}
      {ended.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: palette.subtext, marginTop: 14 }]}>
            Past streams
          </Text>
          {ended.map(stream => (
            <View
              key={stream.id}
              style={[styles.streamCard, { borderColor: palette.border, backgroundColor: palette.card }]}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                    {stream.title}
                  </Text>
                  <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                    {stream.started_at
                      ? new Date(stream.started_at).toLocaleString()
                      : stream.scheduled_start_at
                      ? new Date(stream.scheduled_start_at).toLocaleString()
                      : 'No date'}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: `${statusColor(stream.status, palette)}22` }]}>
                  <Text style={[styles.statusText, { color: statusColor(stream.status, palette) }]}>
                    ENDED
                  </Text>
                </View>
              </View>
              <RecordingsPanel streamId={stream.id} palette={palette} />
            </View>
          ))}
        </>
      )}
    </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  panelTitle:    { fontSize: 16, fontWeight: '900' },
  panelSubtitle: { marginTop: 3, fontSize: 11, lineHeight: 16, fontWeight: '700' },

  sectionLabel: { fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },

  waitMediaPreviewWrap: { gap: 6 },
  waitMediaPreviewFrame: {
    width: 180,
    height: 180,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  waitMediaPreviewMedia: { width: '100%', height: '100%' },
  waitMediaRemoveBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  form: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  emptyText: { fontSize: 12, fontWeight: '700', lineHeight: 18 },

  streamCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: '900' },
  cardMeta:  { marginTop: 3, fontSize: 11, fontWeight: '700' },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: { fontSize: 10, fontWeight: '900' },

  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  // Broadcaster panel
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
  },
  liveDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  liveIndicatorText: { fontSize: 12, fontWeight: '900' },

  // Cred row
  credRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  credLabel: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  credValue: { fontSize: 12, fontWeight: '700', fontFamily: 'monospace' },
  credActions: { flexDirection: 'row', gap: 8, marginLeft: 8 },
  credBtn: { padding: 4 },

  // OBS guide
  guideCard: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  guideTitle: { flex: 1, fontSize: 13, fontWeight: '800' },
  guideBody:  { padding: 12, paddingTop: 0 },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  stepCircle: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  stepNum:  { fontSize: 11, fontWeight: '900' },
  stepText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 18 },

  guideNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  guideNoteText: { flex: 1, fontSize: 11, fontWeight: '700', lineHeight: 17 },

  // Stream settings
  settingsCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    gap: 8,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },
  settingsTitle: { flex: 1, fontSize: 13, fontWeight: '900' },
  settingsLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dvrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
