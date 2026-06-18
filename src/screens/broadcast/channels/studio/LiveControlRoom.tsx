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
import { KISIcon } from '@/constants/kisIcons';
import KISTextInput from '@/constants/KISTextInput';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { deleteRequest } from '@/network/delete';
import { patchRequest } from '@/network/patch';
import {
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
          <Pressable onPress={() => setRevealed(r => !r)} style={styles.credBtn} hitSlop={8}>
            <KISIcon name={revealed ? 'eye-off' : 'eye'} size={15} color={palette.subtext} />
          </Pressable>
        )}
        <Pressable
          onPress={() => { Clipboard.setString(value); Alert.alert('Copied to clipboard'); }}
          style={styles.credBtn}
          hitSlop={8}
        >
          <KISIcon name="copy" size={15} color={palette.subtext} />
        </Pressable>
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
      const endpoint =
        (ROUTES.broadcasting?.recordings as string | undefined) ??
        `${(ROUTES as any).liveStreamings?.recordings ?? ''}/api/v1/broadcasts/recordings/`;
      const res = await getRequest(
        `${endpoint}?stream=${streamId}`,
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
              const endpoint =
                (ROUTES.broadcasting?.recordings as string | undefined) ??
                '/api/v1/broadcasts/recordings/';
              await deleteRequest(`${endpoint}${recording.id}/`);
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
          : <Pressable onPress={load} hitSlop={8}>
              <KISIcon name="refresh" size={14} color={palette.subtext} />
            </Pressable>
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
            <Pressable
              onPress={() => handleShare(rec)}
              style={[recStyles.actionBtn, { borderColor: palette.border }]}
              hitSlop={6}
            >
              <KISIcon name="share" size={14} color={palette.primaryStrong} />
              <Text style={[recStyles.actionText, { color: palette.primaryStrong }]}>Share</Text>
            </Pressable>
            <Pressable
              onPress={() => handleDelete(rec)}
              disabled={deletingId === rec.id}
              style={[recStyles.actionBtn, { borderColor: `${palette.danger}66` }]}
              hitSlop={6}
            >
              {deletingId === rec.id
                ? <ActivityIndicator size="small" color={palette.danger} />
                : <KISIcon name="trash" size={14} color={palette.danger} />
              }
              <Text style={[recStyles.actionText, { color: palette.danger }]}>Delete</Text>
            </Pressable>
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
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionText: { fontSize: 11, fontWeight: '900' },
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
  const [switching,   setSwitching]     = useState(false);

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

  // Subscribe to service state + stats
  useEffect(() => {
    const unsub1 = liveStreamingService.onStateChange(setServiceState);
    const unsub2 = liveStreamingService.onStats(setHealthStats);
    setServiceState(liveStreamingService.state);
    setHealthStats(liveStreamingService.stats);
    return () => { unsub1(); unsub2(); };
  }, []);

  // Fetch stream key for RTMP/OBS section
  const fetchStreamKey = useCallback(async () => {
    if (keyLoading || streamKey) return;
    setKeyLoading(true);
    try {
      const res = await getRequest(
        ROUTES.broadcasts.liveStreamStreamKey(stream.id),
        { errorMessage: '' },
      );
      if (res?.success) {
        setStreamKey(String(res.data?.stream_key ?? res.data?.key ?? ''));
      }
    } finally {
      setKeyLoading(false);
    }
  }, [stream.id, keyLoading, streamKey]);

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
            try {
              await liveStreamingService.startBroadcast({
                streamId: stream.id,
                whipEndpoint: ROUTES.broadcasts.liveStreamWhip(stream.id),
              });
            } catch (e: any) {
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
            await liveStreamingService.stopBroadcast();
            await endLiveStream(stream.id);
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
  const ingestUrl       = stream.ingest_url ?? '';

  return (
    <View>
      {/* Health bar (when device is broadcasting) */}
      {(isDeviceLive || isConnecting) && (
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
          {!isDeviceLive && !isConnecting ? (
            <Pressable
              onPress={handleGoLive}
              style={[styles.goLiveBtn, { backgroundColor: palette.danger }]}
            >
              <KISIcon name="broadcast" size={16} color={palette.onPrimary} />
              <Text style={[styles.goLiveBtnText, { color: palette.onPrimary }]}>Go Live from Device</Text>
            </Pressable>
          ) : (
            <>
              <View style={[styles.liveIndicator, { backgroundColor: `${palette.danger}22` }]}>
                {isConnecting ? (
                  <ActivityIndicator size="small" color={palette.danger} />
                ) : (
                  <View style={[styles.liveDot, { backgroundColor: palette.danger }]} />
                )}
                <Text style={[styles.liveIndicatorText, { color: palette.danger }]}>
                  {isConnecting ? 'Connecting…' : 'LIVE from device'}
                </Text>
              </View>
              {isDeviceLive && (
                <Pressable onPress={handleFlipCamera} style={[styles.iconActionBtn, { borderColor: palette.border }]}>
                  <KISIcon name="refresh" size={16} color={palette.primaryStrong} />
                </Pressable>
              )}
              <Pressable onPress={handleStop} style={[styles.stopBtn, { borderColor: palette.danger }]}>
                <KISIcon name="square" size={14} color={palette.danger} />
                <Text style={[styles.stopBtnText, { color: palette.danger }]}>Stop</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* Credentials / OBS section */}
      <Pressable
        onPress={fetchStreamKey}
        style={[styles.credRevealBtn, { borderColor: palette.border }]}
      >
        <KISIcon name="key" size={14} color={palette.primaryStrong} />
        <Text style={[styles.credRevealText, { color: palette.primaryStrong }]}>
          {keyLoading ? 'Loading…' : streamKey ? 'Stream key loaded' : 'Load stream key for OBS'}
        </Text>
        {keyLoading && <ActivityIndicator size="small" color={palette.primaryStrong} />}
      </Pressable>

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
              <Pressable
                key={opt.value}
                onPress={() => void handleLatencyChange(opt.value)}
                style={[
                  styles.settingsPill,
                  {
                    backgroundColor: active ? palette.primaryStrong : (palette.card ?? palette.surface),
                    borderColor: active ? palette.primaryStrong : palette.border,
                  },
                ]}
              >
                <Text style={[styles.settingsPillText, { color: active ? palette.onPrimary : palette.text }]}>
                  {opt.label}
                </Text>
              </Pressable>
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
                <Pressable
                  key={opt.value}
                  onPress={() => void handleDvrWindowChange(opt.value)}
                  style={[
                    styles.settingsPill,
                    {
                      backgroundColor: active ? palette.primaryStrong : (palette.card ?? palette.surface),
                      borderColor: active ? palette.primaryStrong : palette.border,
                    },
                  ]}
                >
                  <Text style={[styles.settingsPillText, { color: active ? palette.onPrimary : palette.text }]}>
                    {opt.label}
                  </Text>
                </Pressable>
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
  const [title,      setTitle]      = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [description, setDescription] = useState('');
  const [activeId,   setActiveId]   = useState<string | null>(null);

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

  const handleSchedule = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const next = await scheduleChannelLiveStream(channel.id, {
        title:        title.trim(),
        description:  description.trim(),
        scheduled_start_at: scheduledAt.trim() || undefined,
      });
      if (next) {
        setStreams(prev => [next, ...prev]);
        setTitle('');
        setDescription('');
        setScheduledAt('');
      }
    } finally {
      setSaving(false);
    }
  }, [channel.id, description, scheduledAt, title]);

  const updateStream = useCallback((next: BroadcastChannelLiveStream | null) => {
    if (!next) return;
    setStreams(prev => prev.map(s => s.id === next.id ? next : s));
  }, []);

  const handleStart = useCallback((stream: BroadcastChannelLiveStream) => {
    if (stream.status === 'live') {
      Alert.alert('Already live');
      return;
    }
    Alert.alert(
      'Start live stream?',
      `"${stream.title}" will be visible to subscribers immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: () => startLiveStream(stream.id).then(updateStream),
        },
      ],
    );
  }, [updateStream]);

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
          : <Pressable onPress={load} hitSlop={8}>
              <KISIcon name="refresh" size={20} color={palette.primaryStrong} />
            </Pressable>
        }
      </View>

      {/* Schedule form */}
      <View style={[styles.form, { borderColor: palette.border }]}>
        <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Schedule a new stream</Text>
        <KISTextInput label="Title" value={title} onChangeText={setTitle} />
        <KISTextInput
          label="Scheduled start (ISO 8601, optional)"
          value={scheduledAt}
          onChangeText={setScheduledAt}
          placeholder="e.g. 2026-06-01T18:00:00Z"
        />
        <KISTextInput
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          multiline
          style={{ minHeight: 64 }}
        />
        <Pressable
          disabled={saving || !title.trim()}
          onPress={handleSchedule}
          style={[
            styles.primaryButton,
            { backgroundColor: title.trim() ? palette.text : palette.border },
          ]}
        >
          <KISIcon name="calendar" size={15} color={palette.surface} />
          <Text style={[styles.primaryButtonText, { color: palette.surface }]}>
            {saving ? 'Scheduling…' : 'Schedule stream'}
          </Text>
        </Pressable>
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
                <Pressable
                  onPress={() => setActiveId(isActive ? null : stream.id)}
                  style={[styles.actionChip, { borderColor: isActive ? palette.primary : palette.border }]}
                >
                  <KISIcon
                    name={isActive ? 'chevron-up' : 'settings'}
                    size={13}
                    color={isActive ? palette.primary : palette.subtext}
                  />
                  <Text style={[styles.actionChipText, { color: isActive ? palette.primary : palette.subtext }]}>
                    {isActive ? 'Collapse' : 'Manage'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => onOpenWatch?.(stream)}
                  style={[styles.actionChip, { borderColor: palette.border }]}
                >
                  <KISIcon name="people" size={13} color={palette.subtext} />
                  <Text style={[styles.actionChipText, { color: palette.subtext }]}>Preview</Text>
                </Pressable>

                {stream.status !== 'live' && (
                  <Pressable
                    onPress={() => handleStart(stream)}
                    style={[styles.actionChip, { borderColor: palette.success, backgroundColor: `${palette.success}18` }]}
                  >
                    <KISIcon name="play" size={13} color={palette.success} />
                    <Text style={[styles.actionChipText, { color: palette.success }]}>Start</Text>
                  </Pressable>
                )}

                {stream.status === 'live' && (
                  <Pressable
                    onPress={() =>
                      Alert.alert('End stream?', `"${stream.title}" will end for all viewers.`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'End', style: 'destructive', onPress: () => endLiveStream(stream.id).then(updateStream) },
                      ])
                    }
                    style={[styles.actionChip, { borderColor: palette.danger, backgroundColor: `${palette.danger}18` }]}
                  >
                    <KISIcon name="square" size={13} color={palette.danger} />
                    <Text style={[styles.actionChipText, { color: palette.danger }]}>End</Text>
                  </Pressable>
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

  form: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    marginTop: 4,
  },
  primaryButtonText: { fontSize: 12, fontWeight: '900' },

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
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minHeight: 44,
  },
  actionChipText: { fontSize: 11, fontWeight: '900' },

  // Broadcaster panel
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  goLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  goLiveBtnText: { fontSize: 13, fontWeight: '900' },
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
  iconActionBtn: {
    width: 44, height: 44, borderRadius: 8, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stopBtnText: { fontSize: 12, fontWeight: '900' },

  credRevealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  credRevealText: { flex: 1, fontSize: 12, fontWeight: '900' },

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
  settingsPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  settingsPillText: { fontSize: 12, fontWeight: '700' },
  dvrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
