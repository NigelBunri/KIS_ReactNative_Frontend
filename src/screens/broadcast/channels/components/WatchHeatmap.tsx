// src/screens/broadcast/channels/components/WatchHeatmap.tsx
//
// "Most Replayed" heatmap overlay. A thin bar composed of segments whose
// color opacity reflects the relative view_count of each segment.

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';

// ── Types ──────────────────────────────────────────────────────────────────────

type Segment = {
  id?: string;
  start_time: number;   // seconds
  end_time: number;     // seconds
  view_count: number;
};

type Props = {
  contentId: string;
  durationSeconds: number;
  style?: object;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function WatchHeatmap({ contentId, durationSeconds, style }: Props) {
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
    ((peakSeg.start_time + peakSeg.end_time) / 2) / durationSeconds;
  const peakCenterX = peakCenterRatio * containerWidth;

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      {/* Segment bar */}
      <View style={styles.bar}>
        {segments.map((seg, idx) => {
          const segWidth =
            containerWidth > 0
              ? ((seg.end_time - seg.start_time) / durationSeconds) * containerWidth
              : 0;
          const opacity = Math.max(0.05, (seg.view_count / maxViewCount) * 0.9);
          return (
            <View
              key={seg.id ?? idx}
              style={{
                width: segWidth,
                height: 20,
                backgroundColor: `rgba(255,210,60,${opacity})`,
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

const styles = StyleSheet.create({
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
    backgroundColor: '#FFD23C',
    marginBottom: 2,
  },
  labelBubble: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  labelText: {
    color: '#FFD23C',
    fontSize: 10,
    fontWeight: '700',
  },
});
