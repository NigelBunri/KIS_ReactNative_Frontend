import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import InsightLayout from './components/InsightLayout';
import { useInsights } from './useInsightsHooks';

export type InsightScreenProps = {
  target: string;
  title: string;
  description?: string;
  footer?: React.ReactNode;
};

export default function InsightScreen({
  target,
  title,
  description,
  footer,
}: InsightScreenProps) {
  const { palette } = useKISTheme();
  const insights = useInsights(target);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <InsightLayout
        title={title}
        subtitle={description}
        data={insights.data}
        loading={insights.loading}
        error={insights.error}
        timeRange={insights.timeRange}
        onTimeRangeChange={insights.setTimeRange}
        onRefresh={insights.reload}
        footer={footer}
      />
    </View>
  );
}

export function InsightsFooterNote({ message }: { message: string }) {
  const { palette } = useKISTheme();
  return (
    <View
      style={[
        styles.footerNote,
        { borderColor: palette.divider, backgroundColor: palette.surface },
      ]}
    >
      <Text style={{ color: palette.subtext, fontSize: 13 }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  footerNote: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
});
