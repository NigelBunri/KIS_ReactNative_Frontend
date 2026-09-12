// src/components/Bible/games/journey/JourneyMap.tsx
//
// The visual heart of every game's journey screen: a curved path (see
// journeyGeometry.ts) with 10 stage nodes on it, colored by
// journeyThemes.ts's per-game accent. One shared renderer, not 30 bespoke
// ones — visual identity comes from the theme it's given, not from
// reimplementing this component per game (see journeyThemes.ts's docblock).
//
// Meant to sit inside a parent ScrollView (GameJourneyScreen.tsx) rather
// than scroll itself — it just renders at its natural aspect-ratio height
// for whatever width it's given.

import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon, type KISIconName } from '@/constants/kisIcons';
import type { StageDescriptor } from '../../../../screens/tabs/bible/games/gameStorage';
import type { JourneyTheme } from './journeyThemes';
import { JOURNEY_VIEWBOX_HEIGHT, JOURNEY_VIEWBOX_WIDTH, buildJourneyPoints, buildSmoothPathD } from './journeyGeometry';

type Props = {
  theme: JourneyTheme;
  stages: StageDescriptor[];
  icon: KISIconName;
  onSelectStage: (index: number) => void;
};

const NODE_SIZE = 15; // in viewBox units, roughly - visual node diameter is derived in pixels below

export default function JourneyMap({ theme, stages, icon, onSelectStage }: Props) {
  const { palette } = useKISTheme();
  const points = buildJourneyPoints(theme.path, stages.length);
  const currentIndex = stages.findIndex((s) => s.status === 'current');
  const splitAt = currentIndex === -1 ? stages.length - 1 : currentIndex;

  const walkedD = buildSmoothPathD(points.slice(0, splitAt + 1));
  const aheadD = buildSmoothPathD(points.slice(splitAt));

  const aspectRatio = JOURNEY_VIEWBOX_WIDTH / JOURNEY_VIEWBOX_HEIGHT;

  return (
    <View style={[styles.wrap, { aspectRatio }]}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${JOURNEY_VIEWBOX_WIDTH} ${JOURNEY_VIEWBOX_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        style={StyleSheet.absoluteFill}
      >
        <Path d={aheadD} stroke={palette.divider} strokeWidth={1.6} strokeDasharray="3,3" fill="none" />
        <Path d={walkedD} stroke={theme.accent} strokeWidth={2} fill="none" strokeLinecap="round" />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={0.6} fill="none" />
        ))}
      </Svg>

      {points.map((p, i) => {
        const stage = stages[i];
        return (
          <JourneyNode
            key={i}
            leftPct={p.x}
            topPct={(p.y / JOURNEY_VIEWBOX_HEIGHT) * 100}
            stage={stage}
            theme={theme}
            icon={icon}
            onPress={() => onSelectStage(i)}
          />
        );
      })}
    </View>
  );
}

function JourneyNode({
  leftPct,
  topPct,
  stage,
  theme,
  icon,
  onPress,
}: {
  leftPct: number;
  topPct: number;
  stage: StageDescriptor;
  theme: JourneyTheme;
  icon: KISIconName;
  onPress: () => void;
}) {
  const { palette } = useKISTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (stage.status !== 'current') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [stage.status, pulse]);

  const locked = stage.status === 'locked';
  const completed = stage.status === 'completed';
  const current = stage.status === 'current';

  const bgColor = completed ? theme.accent : current ? palette.card : palette.selectedBg;
  const borderColor = completed || current ? theme.accent : palette.divider;
  const iconColor = completed ? palette.ivory : current ? theme.accent : palette.subtext;

  return (
    <View style={[styles.nodeSlot, { left: `${leftPct}%`, top: `${topPct}%` }]}>
      {current ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseRing,
            {
              borderColor: theme.glow,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
            },
          ]}
        />
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={locked}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          locked ? `Stage ${stage.index + 1}, locked` : `Stage ${stage.index + 1}${completed ? ', completed' : ', current'}`
        }
        style={[styles.node, { backgroundColor: bgColor, borderColor, opacity: locked ? 0.55 : 1 }]}
      >
        {locked ? (
          <KISIcon name="lock" size={16} color={palette.subtext} />
        ) : (
          <KISIcon name={icon} size={16} color={iconColor} />
        )}
        <Text style={[styles.nodeIndex, { color: iconColor }]}>{stage.index + 1}</Text>
      </Pressable>
      {stage.bestScore != null ? (
        <View style={[styles.scoreBadge, { backgroundColor: palette.selectedBg }]}>
          <Text style={[styles.scoreBadgeText, { color: theme.accent }]}>{stage.bestScore}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  nodeSlot: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -22 }, { translateY: -22 }],
    width: 44,
  },
  pulseRing: {
    position: 'absolute',
    top: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
  },
  node: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  nodeIndex: { fontSize: 9, fontWeight: '900' },
  scoreBadge: {
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  scoreBadgeText: { fontSize: 9, fontWeight: '800' },
});
