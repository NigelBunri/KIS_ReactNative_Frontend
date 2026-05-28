// src/screens/broadcast/channels/components/StreamHealthBar.tsx
//
// Compact health indicator shown in LiveControlRoom during an active broadcast.
// Displays: status pill · bitrate · framerate · viewer count · duration.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import type { StreamHealthStats } from '@/services/liveStreamingService';

type Props = {
  stats:       StreamHealthStats;
  viewerCount: number;
  startedAt?:  string | null;
  palette:     any;
};

function useLiveDuration(startedAt?: string | null) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!startedAt) { setSecs(0); return; }
    const base = Date.now() - new Date(startedAt).getTime();
    setSecs(Math.max(0, Math.floor(base / 1000)));
    const id = setInterval(() => {
      setSecs(Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatBitrate(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000)     return `${Math.round(bps / 1_000)} kbps`;
  return `${bps} bps`;
}

function healthColor(stats: StreamHealthStats): string {
  if (!stats.isConnected)          return '#6B7280'; // grey
  if (stats.bitrateBps < 200_000)  return '#EF4444'; // red
  if (stats.roundTripTimeMs > 300) return '#F59E0B'; // amber
  if (stats.packetsLost > 50)      return '#F59E0B'; // amber
  return '#22C55E';                                   // green
}

export default function StreamHealthBar({ stats, viewerCount, startedAt, palette }: Props) {
  const duration = useLiveDuration(startedAt);
  const color    = healthColor(stats);

  // Pulse the status dot
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!stats.isConnected) { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [stats.isConnected]);

  return (
    <View style={[styles.bar, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      {/* Status */}
      <View style={styles.statusGroup}>
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: color, transform: [{ scale: pulse }] },
          ]}
        />
        <Text style={[styles.label, { color: palette.text }]}>
          {stats.isConnected ? 'LIVE' : 'CONNECTING'}
        </Text>
      </View>

      <View style={styles.divider} />

      {/* Bitrate */}
      <StatCell icon="wifi" label={formatBitrate(stats.bitrateBps)} palette={palette} />

      {/* FPS */}
      <StatCell icon="film" label={`${stats.frameRate} fps`} palette={palette} />

      {/* Resolution */}
      {stats.resolution.width > 0 && (
        <StatCell
          icon="monitor"
          label={`${stats.resolution.width}×${stats.resolution.height}`}
          palette={palette}
        />
      )}

      {/* RTT */}
      {stats.roundTripTimeMs > 0 && (
        <StatCell
          icon="clock"
          label={`${stats.roundTripTimeMs}ms`}
          palette={palette}
          warn={stats.roundTripTimeMs > 250}
        />
      )}

      <View style={styles.divider} />

      {/* Viewer count */}
      <View style={styles.statCell}>
        <KISIcon name="people" size={12} color={palette.primaryStrong} />
        <Text style={[styles.statText, { color: palette.text }]}>
          {viewerCount.toLocaleString()}
        </Text>
      </View>

      {/* Duration */}
      {startedAt && (
        <View style={styles.statCell}>
          <KISIcon name="call-history" size={12} color={palette.subtext} />
          <Text style={[styles.statText, { color: palette.subtext }]}>{duration}</Text>
        </View>
      )}
    </View>
  );
}

function StatCell({
  icon, label, palette, warn = false,
}: { icon: string; label: string; palette: any; warn?: boolean }) {
  return (
    <View style={styles.statCell}>
      <KISIcon name={icon} size={12} color={warn ? '#F59E0B' : palette.subtext} />
      <Text style={[styles.statText, { color: warn ? '#F59E0B' : palette.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  statusGroup: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  label:       { fontSize: 11, fontWeight: '900' },
  divider:     { width: StyleSheet.hairlineWidth, height: 16, backgroundColor: 'rgba(0,0,0,0.12)' },
  statCell:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText:    { fontSize: 11, fontWeight: '700' },
});
