import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

type SeriesPoint = {
  date?: string;
  posts?: number;
  comments?: number;
  reactions?: number;
  applications?: number;
  new_members?: number;
  audit_events?: number;
};

type Props = {
  summary?: Record<string, any> | null;
};

const metricDefs = [
  { key: 'posts', label: 'Posts', colorKey: 'primary' },
  { key: 'comments', label: 'Comments', colorKey: 'accent' },
  { key: 'reactions', label: 'Reactions', colorKey: 'success' },
  { key: 'applications', label: 'Applications', colorKey: 'warning' },
  { key: 'new_members', label: 'New members', colorKey: 'info' },
  { key: 'audit_events', label: 'Audit events', colorKey: 'danger' },
];

const getColor = (palette: any, key: string) => {
  if (key === 'accent') return palette.accent ?? palette.primarySoft;
  if (key === 'success') return palette.success ?? palette.primaryStrong;
  if (key === 'warning') return palette.warning ?? palette.primarySoft;
  if (key === 'info') return palette.info ?? palette.primarySoft;
  if (key === 'danger') return palette.danger ?? palette.primaryStrong;
  return palette.primary;
};

export default function PartnerAnalyticsCharts({ summary }: Props) {
  const { palette } = useKISTheme();
  const series = useMemo(() => {
    const raw = (summary?.activity_series ?? []) as SeriesPoint[];
    if (!Array.isArray(raw)) return [];
    return raw.slice(-18);
  }, [summary]);

  if (!series.length) return null;

  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>
        Activity trends (last 18)
      </Text>
      {metricDefs.map((metric) => {
        const values = series.map((point) => Number(point[metric.key as keyof SeriesPoint] ?? 0));
        const maxValue = Math.max(1, ...values);
        return (
          <View key={metric.key} style={{ marginTop: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: getColor(palette, metric.colorKey),
                  marginRight: 6,
                }}
              />
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                {metric.label}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                height: 64,
                marginTop: 6,
              }}
            >
              {values.map((value, index) => (
                <View
                  key={`${metric.key}-${index}`}
                  style={{
                    flex: 1,
                    marginHorizontal: 1,
                    height: `${Math.round((value / maxValue) * 100)}%`,
                    backgroundColor: getColor(palette, metric.colorKey),
                    borderRadius: 4,
                    opacity: value === 0 ? 0.2 : 0.85,
                  }}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ color: palette.subtext, fontSize: 10 }}>
                {series[0]?.date ?? 'Start'}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 10 }}>
                {series[series.length - 1]?.date ?? 'Today'}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
