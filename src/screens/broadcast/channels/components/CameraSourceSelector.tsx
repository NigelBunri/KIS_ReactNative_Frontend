// src/screens/broadcast/channels/components/CameraSourceSelector.tsx
//
// Grid of camera sources (device front/back cameras + external RTMP feeds).
// Used in LiveControlRoom for multi-camera switching during a live broadcast.

import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { useResponsiveLayout } from '@/theme/responsive';
import type { CameraSource } from '@/services/liveStreamingService';

type Props = {
  sources:      CameraSource[];
  activeCamId:  string | null;
  onSwitch:     (sourceId: string) => void;
  switching?:   boolean;
  palette:      any;
};

const FACING_ICON: Record<string, string> = {
  front:    'video',
  back:     'camera',
  external: 'monitor',
};

// Tile width adapts: small for compact phones, standard otherwise
const TILE_WIDTH_COMPACT = 72;
const TILE_WIDTH_STANDARD = 88;

export default function CameraSourceSelector({
  sources,
  activeCamId,
  onSwitch,
  switching = false,
  palette,
}: Props) {
  const { isCompactPhone } = useResponsiveLayout();
  const tileWidth = isCompactPhone ? TILE_WIDTH_COMPACT : TILE_WIDTH_STANDARD;
  if (sources.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <KISIcon name="video" size={14} color={palette.primaryStrong} />
        <Text style={[styles.headerText, { color: palette.text }]}>
          Camera sources
        </Text>
        {switching && (
          <ActivityIndicator size="small" color={palette.primaryStrong} style={{ marginLeft: 8 }} />
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {sources.map(src => {
          const isActive = src.id === activeCamId;
          return (
            <Pressable
              key={src.id}
              onPress={() => !isActive && !switching && onSwitch(src.id)}
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${src.label} camera`}
              accessibilityState={{ selected: isActive }}
              style={[
                styles.tile,
                {
                  width: tileWidth,
                  borderColor: isActive ? palette.primary : palette.border,
                  backgroundColor: palette.card,
                },
                isActive && styles.tileActive,
              ]}
            >
              {/* Thumbnail or icon placeholder */}
              <View style={[styles.thumb, { backgroundColor: palette.surface }]}>
                {src.thumbnailUrl ? (
                  <Image source={{ uri: src.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <KISIcon
                    name={src.isExternal ? 'monitor' : FACING_ICON[src.facing ?? 'front'] ?? 'video'}
                    size={22}
                    color={isActive ? palette.primary : palette.subtext}
                  />
                )}
                {isActive && (
                  <View style={[styles.activeDot, { backgroundColor: palette.ivory }]}>
                    <View style={[styles.activeDotInner, { backgroundColor: palette.success }]} />
                  </View>
                )}
              </View>

              <Text
                style={[
                  styles.label,
                  { color: isActive ? palette.primary : palette.subtext },
                ]}
                numberOfLines={1}
              >
                {src.label}
              </Text>

              {src.isExternal && (
                <View style={[styles.externalBadge, { backgroundColor: palette.primarySoft ?? palette.primaryWeak }]}>
                  <Text style={[styles.externalText, { color: palette.primaryStrong }]}>RTMP</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  headerText: { fontSize: 13, fontWeight: '800' },
  scroll: { gap: 8, paddingBottom: 4 },
  tile: {
    borderWidth: 2,
    borderRadius: 10,
    overflow: 'hidden',
    paddingBottom: 8,
    minHeight: 44,
  },
  tileActive: { borderWidth: 2.5 },
  thumb: {
    width: '100%',
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  activeDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDotInner: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 4,
    marginTop: 5,
  },
  externalBadge: {
    alignSelf: 'center',
    marginTop: 3,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  externalText: { fontSize: 9, fontWeight: '900' },
});
