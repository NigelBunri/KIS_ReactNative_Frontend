// src/screens/broadcast/channels/components/WatchHeatmap.tsx
//
// "Most Replayed" heatmap overlay. A thin bar composed of segments whose
// color opacity reflects the relative view_count of each segment.

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';

// ── Helpers ────────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  // Support shorthand 3-char hex (#ABC → AABBCC)
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const r = parseInt(full.substring(0, 2), 16) || 0;
  const g = parseInt(full.substring(2, 4), 16) || 0;
  const b = parseInt(full.substring(4, 6), 16) || 0;
  return { r, g, b };
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Segment = {
  segment_start_seconds: number;   // seconds
  segment_end_seconds: number;     // seconds
  view_count: number;
};

type Props = {
  contentId: string;
  durationSeconds: number;
  style?: object;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function WatchHeatmap({ contentId, durationSeconds, style }: Props) {
  const { palette } = useKISTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!contentId) return;
    getRequest(ROUTES.broadcasts.contentWatchSegments(contentId))
      .then(res => {
        if (res?.data) {
          const raw: Segment[] = Array.isArray(res.data)
            ? res.data
            : res.data.results ?? [];
          setSegments(raw);
        }
      })
      .catch(() => {/* silent */});
  }, [contentId]);

  const handleLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  if (!segments.length || durationSeconds <= 0) {
    return <View style={[styles.container, style]} onLayout={handleLayout} />;
  }

  const maxViewCount = Math.max(...segments.map(s => s.view_count), 1);

  // Find peak segment for "Most Replayed" label position
  const peakIdx = segments.reduce(
    (best, seg, idx) => (seg.view_count > segments[best].view_count ? idx : best),
    0,
  );

  const peakSeg = segments[peakIdx];
  const peakCenterRatio =
    ((peakSeg.segment_start_seconds + peakSeg.segment_end_seconds) / 2) / durationSeconds;
  const peakCenterX = peakCenterRatio * containerWidth;
  const { r: goldR, g: goldG, b: goldB } = hexToRgb(palette.gold);

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      {/* Segment bar */}
      <View style={styles.bar}>
        {segments.map((seg, idx) => {
          const segWidth =
            containerWidth > 0
              ? ((seg.segment_end_seconds - seg.segment_start_seconds) / durationSeconds) * containerWidth
              : 0;
          const opacity = Math.max(0.05, (seg.view_count / maxViewCount) * 0.9);
          return (
            <View
              key={idx}
              style={{
                width: segWidth,
                height: 20,
                backgroundColor: `rgba(${goldR},${goldG},${goldB},${opacity})`,
              }}
            />
          );
        })}
      </View>

      {/* "Most Replayed" label */}
      {containerWidth > 0 && (
        <View
          style={[
            styles.label,
            {
              left: Math.min(
                Math.max(0, peakCenterX - 50),
                containerWidth - 110,
              ),
            },
          ]}
          pointerEvents="none"
        >
          <View style={styles.tick} />
          <View style={styles.labelBubble}>
            <Text style={styles.labelText}>Most Replayed</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(p: any) {
  return StyleSheet.create({
    container: {
      height: 20,
      overflow: 'visible',
    },
    bar: {
      flexDirection: 'row',
      height: 20,
      overflow: 'hidden',
      borderRadius: 2,
    },
    label: {
      position: 'absolute',
      bottom: 22,
      alignItems: 'center',
    },
    tick: {
      width: 1,
      height: 6,
      backgroundColor: p.gold,
      marginBottom: 2,
    },
    labelBubble: {
      backgroundColor: p.royalInk,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    labelText: {
      color: p.gold,
      fontSize: 10,
      fontWeight: '700',
    },
  });
}
