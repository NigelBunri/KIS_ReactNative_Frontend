// src/screens/calls/components/TileFrame.tsx
//
// Luxurious, always-visible rectangular frame wrapped around a single call
// tile (video, avatar, or screen-share). Every participant's video/photo,
// name, mic/network/hand badges live inside this one bordered box — see
// ParticipantTile, the sole place this is used for grid/panel tiles.
//
// There is no manual drag-to-resize here on purpose: tile size is driven
// entirely by the caller's grid math (computeGridColumns/computeTileCell in
// callGridMath.ts), which already grows/shrinks every tile automatically as
// participants join/leave — the same "fewer people = bigger tiles, more
// people = smaller tiles" behavior Google Meet's grid uses. This component
// just renders whatever width/height it's given, beautifully.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';

const BORDER = 2;

type Props = {
  width: number;
  height: number;
  cornerRadius?: number;
  // Slightly intensifies the glow — used for an active-speaker tile.
  isAccent?: boolean;
  children: React.ReactNode;
};

export default function TileFrame({ width, height, cornerRadius = 16, isAccent = false, children }: Props) {
  const { palette, gradients } = useKISTheme();

  return (
    <View
      style={[
        styles.frame,
        {
          width,
          height,
          borderRadius: cornerRadius,
          padding: BORDER,
          shadowColor: palette.gold,
          shadowOpacity: isAccent ? 0.4 : 0.26,
        },
      ]}
    >
      {/* Metallic gold border — a gradient "picture frame" rather than a
          flat line, matching the rest of the app's royal-gold chrome
          (GoldHeaderShell etc). Only the BORDER-px ring around the edge is
          visible; the inner view below covers the center. */}
      <LinearGradient
        colors={gradients.tabSelected as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        style={[
          styles.inner,
          { borderRadius: Math.max(0, cornerRadius - BORDER), backgroundColor: palette.royalInk },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  inner: {
    flex: 1,
    overflow: 'hidden',
  },
});
