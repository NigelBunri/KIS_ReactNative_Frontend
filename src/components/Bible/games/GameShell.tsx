// src/components/Bible/games/GameShell.tsx
//
// Shared chrome for all 6 games: back button, title, an optional right-side
// stat (score/streak/progress), and a consistent dark-safe surface. Every
// game screen wraps its own content in this instead of re-implementing the
// same header — keeps the 6 engines visually and structurally consistent,
// which is half of what makes a set of mini-games feel like one polished
// product instead of 6 unrelated prototypes bolted together.

import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';

type Props = {
  title: string;
  subtitle?: string;
  onBack: () => void;
  rightStat?: { label: string; value: string | number };
  children: React.ReactNode;
};

export default function GameShell({ title, subtitle, onBack, rightStat, children }: Props) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { paddingHorizontal: responsive.pageGutter }]}>
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back to games"
          style={[styles.backBtn, { backgroundColor: palette.selectedBg }]}
        >
          <KISIcon name="back" size={18} color={palette.text} />
        </Pressable>

        <View style={styles.titleGroup}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: palette.subtext }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {rightStat ? (
          <View style={[styles.statPill, { backgroundColor: palette.selectedBg }]}>
            <Text style={[styles.statValue, { color: palette.goldReadable }]}>{rightStat.value}</Text>
            <Text style={[styles.statLabel, { color: palette.subtext }]}>{rightStat.label}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.content, { paddingHorizontal: responsive.pageGutter }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleGroup: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: '900' },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  statPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    minWidth: 56,
  },
  statValue: { fontSize: 15, fontWeight: '900' },
  statLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  content: { flex: 1, minHeight: 0 },
});
