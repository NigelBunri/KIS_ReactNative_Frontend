import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useKISTheme } from '@/theme/useTheme';
import type { OfflineCacheMeta } from '@/storage/offlineStructuredCache';

type Props = {
  meta?: OfflineCacheMeta | null;
  label?: string;
  style?: object;
};

const formatCachedAt = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function OfflineDataBadge({ meta, label = 'Offline copy', style }: Props) {
  const { palette } = useKISTheme();
  if (!meta?.fromCache) return null;
  const cachedAt = formatCachedAt(meta.cachedAt);
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: palette.primarySoft,
          borderColor: palette.warning,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: palette.warning }]}>
        {meta.stale ? 'Stale offline copy' : label}
        {cachedAt ? ` - ${cachedAt}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
