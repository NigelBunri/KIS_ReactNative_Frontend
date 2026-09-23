// src/components/Bible/discipleship/DayRoadmap.tsx
//
// The Discipleship tab's per-doctrine "Day 1..Day 6" roadmap. Deliberately
// NOT the Bible Games journey map (see games/journey/JourneyMap.tsx) reused
// verbatim — the user asked for "a road map with stages... just a different
// style system, not the same". What's shared with the games map is only the
// underlying idea (a curved path connecting sequential stage nodes); the
// node shape (a rounded plaque/tablet, not a circle), the path silhouette
// (a gentle ascending stair, not a wave/zigzag/spiral), the icon set
// (flame/shield-checkmark, not per-game icons), and the accent (the app's
// own gold, not a per-item hue) are all unique to this screen, so it reads
// as its own place — fitting a "doctrine" journey rather than a game.

import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

export type DayStatus = 'locked' | 'current' | 'completed';
export type DayNode = {
  index: number; // 0-5
  label: string; // "Day 1"
  status: DayStatus;
  scorePercent: number | null;
};

type Props = {
  days: DayNode[];
  onSelectDay: (index: number) => void;
};

const VIEWBOX_WIDTH = 100;
const TOP_MARGIN = 14;
const ROW_HEIGHT = 26;
const STEP_OFFSET = 16; // gentle stair-step, not a wide zigzag

function buildStairPoints(count: number) {
  const height = TOP_MARGIN * 2 + ROW_HEIGHT * Math.max(0, count - 1);
  const centerX = VIEWBOX_WIDTH / 2;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    const y = height - TOP_MARGIN - t * ROW_HEIGHT * (count - 1);
    const x = centerX + (i % 2 === 0 ? -STEP_OFFSET : STEP_OFFSET);
    points.push({ x, y });
  }
  return { points, height };
}

function buildStraightPathD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midY = (prev.y + curr.y) / 2;
    d += ` C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`;
  }
  return d;
}

export default function DayRoadmap({ days, onSelectDay }: Props) {
  const { palette } = useKISTheme();
  const { points, height } = buildStairPoints(days.length);
  const currentIndex = days.findIndex(d => d.status === 'current');
  const splitAt = currentIndex === -1 ? days.length - 1 : currentIndex;

  const walkedD = buildStraightPathD(points.slice(0, splitAt + 1));
  const aheadD = buildStraightPathD(points.slice(splitAt));
  const aspectRatio = VIEWBOX_WIDTH / height;

  return (
    <View style={[styles.wrap, { aspectRatio }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`} preserveAspectRatio="xMidYMid meet" style={StyleSheet.absoluteFill}>
        <Path d={aheadD} stroke={palette.divider} strokeWidth={1.6} strokeDasharray="2,4" fill="none" />
        <Path d={walkedD} stroke={palette.gold} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      </Svg>

      {points.map((p, i) => (
        <DayPlaque
          key={i}
          leftPct={p.x}
          topPct={(p.y / height) * 100}
          day={days[i]}
          onPress={() => onSelectDay(i)}
        />
      ))}
    </View>
  );
}

function DayPlaque({
  leftPct,
  topPct,
  day,
  onPress,
}: {
  leftPct: number;
  topPct: number;
  day: DayNode;
  onPress: () => void;
}) {
  const { palette } = useKISTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (day.status !== 'current') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1300, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1300, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [day.status, pulse]);

  const locked = day.status === 'locked';
  const completed = day.status === 'completed';
  const current = day.status === 'current';

  const bgColor = completed ? palette.gold : current ? palette.card : palette.selectedBg;
  const borderColor = completed || current ? palette.gold : palette.divider;
  const iconColor = completed ? palette.royalInk : current ? palette.gold : palette.subtext;

  return (
    <View style={[styles.plaqueSlot, { left: `${leftPct}%`, top: `${topPct}%` }]}>
      {current ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            {
              borderColor: palette.gold,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
            },
          ]}
        />
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={locked}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={locked ? `${day.label}, locked` : `${day.label}${completed ? ', completed' : ', current'}`}
        style={[styles.plaque, { backgroundColor: bgColor, borderColor, opacity: locked ? 0.55 : 1 }]}
      >
        <View style={[styles.plaqueTopBar, { backgroundColor: iconColor }]} />
        {locked ? (
          <KISIcon name="lock" size={15} color={palette.subtext} />
        ) : completed ? (
          <KISIcon name="shield-checkmark" size={15} color={iconColor} />
        ) : (
          <KISIcon name="flame" size={15} color={iconColor} />
        )}
        <Text style={[styles.plaqueLabel, { color: iconColor }]}>{day.label}</Text>
      </Pressable>
      {day.scorePercent != null ? (
        <View style={[styles.scoreBadge, { backgroundColor: palette.selectedBg }]}>
          <Text style={[styles.scoreBadgeText, { color: palette.gold }]}>{day.scorePercent}%</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  plaqueSlot: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -30 }, { translateY: -24 }],
    width: 60,
  },
  glow: {
    position: 'absolute',
    top: -4,
    width: 68,
    height: 56,
    borderRadius: 14,
    borderWidth: 2,
  },
  plaque: {
    width: 60,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 4,
    overflow: 'hidden',
  },
  plaqueTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    opacity: 0.9,
  },
  plaqueLabel: { fontSize: 9, fontWeight: '900' },
  scoreBadge: {
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  scoreBadgeText: { fontSize: 9, fontWeight: '800' },
});
