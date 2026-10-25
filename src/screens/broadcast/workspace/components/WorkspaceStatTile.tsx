// src/screens/broadcast/workspace/components/WorkspaceStatTile.tsx
//
// Shared metric-tile primitive for the Broadcast Workspace / Channel Studio
// redesign - previously duplicated inline (slightly differently styled each
// time) across FeedManagementModal.tsx's heroStatTile, ChannelStudioScreen's
// metricTile, and would have been duplicated a third time here without this.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KISIcon, type KISIconName } from '@/constants/kisIcons';
import { WORKSPACE_PALETTE as palette } from '../workspaceTheme';

export default function WorkspaceStatTile({
  icon,
  value,
  label,
  onPress,
}: {
  icon: KISIconName;
  value: string | number;
  label: string;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={[styles.tile, { borderColor: palette.border, backgroundColor: palette.card }]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${value} ${label}` : undefined}
    >
      <KISIcon name={icon} size={15} color={palette.primaryStrong} />
      <Text style={[styles.value, { color: palette.text }]}>{value}</Text>
      <Text style={[styles.label, { color: palette.subtext }]} numberOfLines={1}>{label}</Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 96,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 2,
  },
  value: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600' },
});
