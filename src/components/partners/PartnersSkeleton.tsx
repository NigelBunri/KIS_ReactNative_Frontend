import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { LEFT_RAIL_WIDTH, RIGHT_PEEK_WIDTH } from './partnersTypes';

// ─── Shared shimmer hook ───────────────────────────────────────────────────────

function useShimmer() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  return opacity;
}

// ─── Bone: a single shimmering block ─────────────────────────────────────────

function Bone({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}) {
  const { palette } = useKISTheme();
  const opacity = useShimmer();
  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: palette.divider },
        { opacity },
        style,
      ]}
    />
  );
}

// ─── Left rail skeleton ────────────────────────────────────────────────────────
// Matches the shape of PartnersLeftRail: stacked avatar bubbles.

export function PartnerLeftRailSkeleton() {
  const { palette, isDark } = useKISTheme();
  const responsive = useResponsiveLayout();
  const railWidth = responsive.isWatch ? 52 : responsive.isCompactPhone ? 60 : LEFT_RAIL_WIDTH;
  const avatarSize = responsive.isWatch ? 38 : responsive.isCompactPhone ? 42 : 48;

  return (
    <View
      style={[
        styles.leftRail,
        {
          width: railWidth,
          backgroundColor: isDark ? 'rgba(10,9,14,0.92)' : '#FFFFFF',
          borderRightColor: palette.divider,
        },
      ]}
    >
      {/* Add button placeholder */}
      <Bone width={avatarSize} height={avatarSize} borderRadius={avatarSize / 2} style={{ marginBottom: 12, alignSelf: 'center' }} />

      {/* Partner avatar placeholders */}
      {[0, 1, 2, 3].map(i => (
        <Bone
          key={i}
          width={avatarSize}
          height={avatarSize}
          borderRadius={avatarSize / 2}
          style={{ marginBottom: 10, alignSelf: 'center' }}
        />
      ))}
    </View>
  );
}

// ─── Center pane skeleton ──────────────────────────────────────────────────────
// Mirrors the PartnersCenterPane layout: header → stats strip → section rows.

export function PartnerCenterPaneSkeleton() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const rightPeek = responsive.isWatch ? 48 : responsive.isCompactPhone ? 56 : RIGHT_PEEK_WIDTH;

  return (
    <View
      style={[
        styles.centerPane,
        {
          marginRight: rightPeek,
          paddingHorizontal: responsive.pageGutter ?? 16,
        },
      ]}
    >
      <ScrollView
        scrollEnabled={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: compact ? 28 : 42 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Kicker "Partner workspace" label */}
        <Bone width={120} height={11} borderRadius={6} style={{ marginBottom: 14 }} />

        {/* Header row: avatar + name/tagline + settings button */}
        <View style={styles.headerRow}>
          <Bone width={56} height={56} borderRadius={28} />
          <View style={{ flex: 1, gap: 8, marginLeft: 12 }}>
            <Bone width="70%" height={16} borderRadius={8} />
            <Bone width="45%" height={11} borderRadius={6} />
          </View>
          <Bone width={72} height={32} borderRadius={14} />
        </View>

        {/* Role pills */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20, marginTop: 12 }}>
          <Bone width={90} height={26} borderRadius={13} />
          <Bone width={100} height={26} borderRadius={13} />
        </View>

        {/* Stats strip (4 tiles) */}
        <View style={styles.statsRow}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[styles.statTile, { backgroundColor: palette.surface, borderColor: palette.divider }]}
            >
              <Bone width={28} height={20} borderRadius={6} style={{ alignSelf: 'center' }} />
              <Bone width={44} height={10} borderRadius={5} style={{ alignSelf: 'center', marginTop: 6 }} />
            </View>
          ))}
        </View>

        {/* Admin strip (3 avatar cards) */}
        <View style={{ marginBottom: 20 }}>
          <Bone width={100} height={11} borderRadius={6} style={{ marginBottom: 10 }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[0, 1, 2].map(i => (
              <View
                key={i}
                style={[styles.adminCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}
              >
                <Bone width={40} height={40} borderRadius={20} style={{ alignSelf: 'center' }} />
                <Bone width={44} height={10} borderRadius={5} style={{ alignSelf: 'center', marginTop: 6 }} />
                <Bone width={36} height={9} borderRadius={4} style={{ alignSelf: 'center', marginTop: 4 }} />
              </View>
            ))}
          </View>
        </View>

        {/* Section rows × 4 */}
        {[0, 1, 2, 3].map(i => (
          <View
            key={i}
            style={[styles.sectionRow, { borderColor: palette.divider, backgroundColor: palette.surface }]}
          >
            <View style={{ flex: 1, gap: 8 }}>
              <Bone width="55%" height={13} borderRadius={7} />
              <Bone width="35%" height={10} borderRadius={5} />
            </View>
            <Bone width={24} height={24} borderRadius={12} />
          </View>
        ))}

        {/* Channel list skeletons */}
        <View style={{ gap: 8, marginTop: 8 }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
              <Bone width={22} height={22} borderRadius={11} />
              <Bone width={`${55 + i * 10}%`} height={12} borderRadius={6} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  leftRail: {
    paddingTop: 56,
    paddingHorizontal: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  centerPane: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statTile: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  adminCard: {
    width: 72,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
});
