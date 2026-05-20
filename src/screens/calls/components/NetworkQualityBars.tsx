// src/screens/calls/components/NetworkQualityBars.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { NetworkQuality } from '@/services/calls/callTypes';

const QUALITY_COLORS: Record<NetworkQuality, string> = {
  1: '#E52B2B',
  2: '#F59E0B',
  3: '#22C55E',
  4: '#22C55E',
};
const BAR_HEIGHTS = [4, 7, 10, 13];

type Props = {
  quality: NetworkQuality;
  size?: number;
};

export default function NetworkQualityBars({ quality, size = 16 }: Props) {
  const color = QUALITY_COLORS[quality];
  const unit = size / 16;
  return (
    <View style={[styles.row, { gap: Math.round(unit * 2) }]}>
      {BAR_HEIGHTS.map((h, i) => {
        const active = i < quality;
        return (
          <View
            key={i}
            style={{
              width: Math.round(unit * 3),
              height: Math.round(h * unit),
              borderRadius: Math.round(unit),
              backgroundColor: active ? color : 'rgba(255,255,255,0.25)',
              alignSelf: 'flex-end',
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
});
