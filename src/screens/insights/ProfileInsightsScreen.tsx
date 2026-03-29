import React from 'react';
import { Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import InsightLayout from './components/InsightLayout';
import { useNotificationsSummary, useProfileInsights } from './useInsightsHooks';
import type { InsightTopItem } from '@/api/insights/types';
import type { NotificationSummaryItem } from '@/api/insights/insights.api';

export default function ProfileInsightsScreen() {
  const insights = useProfileInsights();
  const notifications = useNotificationsSummary();
  const { palette } = useKISTheme();

  const footer = (
    <View style={{ marginTop: 18, gap: 16 }}>
      <TopContentList items={insights.data?.topItems ?? []} />
      <NotificationSection
        loading={notifications.loading}
        items={notifications.items}
        palette={palette}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <InsightLayout
        title="Profile insights"
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

type TopContentListProps = {
  items: InsightTopItem[];
};

function TopContentList({ items }: TopContentListProps) {
  const { palette } = useKISTheme();
  const list = items.slice(0, 4);
  return (
    <View>
      <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text, marginBottom: 8 }}>
        Top content
      </Text>
      {list.length ? (
        list.map((item) => (
          <View
            key={item.id}
            style={{
              borderWidth: 1,
              borderColor: palette.border,
              borderRadius: 12,
              padding: 12,
              marginBottom: 10,
              backgroundColor: palette.surface,
            }}
          >
            <Text style={{ color: palette.text, fontWeight: '700' }}>{item.title}</Text>
            {item.subtitle ? (
              <Text style={{ color: palette.subtext, marginTop: 2 }}>{item.subtitle}</Text>
            ) : null}
            {item.metric ? (
              <Text style={{ color: palette.primaryStrong, fontWeight: '700', marginTop: 6 }}>
                {item.metric}
              </Text>
            ) : null}
          </View>
        ))
      ) : (
        <Text style={{ color: palette.subtext }}>No highlights yet.</Text>
      )}
    </View>
  );
}

type NotificationSectionProps = {
  loading: boolean;
  items: NotificationSummaryItem[];
  palette: ReturnType<typeof useKISTheme>['palette'];
};

function NotificationSection({ loading, items, palette }: NotificationSectionProps) {
  return (
    <View>
      <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text, marginBottom: 8 }}>
        Recent notifications
      </Text>
      {loading ? (
        <Text style={{ color: palette.subtext }}>Loading notifications...</Text>
      ) : items.length ? (
        items.map((item) => (
          <View
            key={item.id}
            style={{
              borderWidth: 1,
              borderColor: palette.border,
              borderRadius: 12,
              padding: 10,
              marginBottom: 8,
              backgroundColor: palette.surface,
            }}
          >
            <Text style={{ color: palette.text, fontWeight: '700' }}>{item.title}</Text>
            <Text style={{ color: palette.subtext }}>{item.status}</Text>
            {item.deliveredAt ? (
              <Text style={{ color: palette.subtext, fontSize: 11 }}>
                {new Date(item.deliveredAt).toLocaleString()}
              </Text>
            ) : null}
          </View>
        ))
      ) : (
        <Text style={{ color: palette.subtext }}>No notifications yet.</Text>
      )}
    </View>
  );
}
