import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import KISButton from '@/constants/KISButton';
import { useKISTheme } from '@/theme/useTheme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

type DashboardScreenKey =
  | 'AnalyticsDashboard'
  | 'EventsDashboard'
  | 'ContentDashboard'
  | 'SurveysDashboard'
  | 'MediaDashboard'
  | 'BridgeDashboard'
  | 'TiersDashboard'
  | 'NotificationsDashboard';

const DASHBOARDS: { title: string; screen: DashboardScreenKey; description: string }[] = [
  {
    title: 'Analytics',
    screen: 'AnalyticsDashboard',
    description: 'System-wide dashboard trends and KPI control planes.',
  },
  {
    title: 'Events',
    screen: 'EventsDashboard',
    description: 'Event engagement, tickets, and attendances.',
  },
  {
    title: 'Content',
    screen: 'ContentDashboard',
    description: 'Stories, tags, comments, and posting velocity.',
  },
  {
    title: 'Surveys',
    screen: 'SurveysDashboard',
    description: 'Responses, questions, and satisfaction heatmaps.',
  },
  {
    title: 'Media',
    screen: 'MediaDashboard',
    description: 'Asset uploads, encoding jobs, and delivery health.',
  },
  {
    title: 'Bridge',
    screen: 'BridgeDashboard',
    description: 'Automation, threads, and cross-system handoffs.',
  },
  {
    title: 'Tiers',
    screen: 'TiersDashboard',
    description: 'Plans, campaigns, and subscription usage signals.',
  },
  {
    title: 'Notifications',
    screen: 'NotificationsDashboard',
    description: 'Deliveries, rules, and template health.',
  },
];

export default function AdminToolsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { palette } = useKISTheme();

  const openDashboard = (screen: DashboardScreenKey) => {
    navigation.navigate(screen);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} style={{ backgroundColor: palette.bg }}>
      <Text style={{ fontSize: 28, fontWeight: '900', color: palette.text }}>Developer tools</Text>
      <Text style={{ color: palette.subtext, marginBottom: 16 }}>
        Jump into backend-specific dashboards. Each view pulls from the corresponding app’s analytics
        endpoint.
      </Text>
      {DASHBOARDS.map((board) => (
        <View
          key={board.screen}
          style={{
            borderWidth: 1,
            borderColor: palette.divider,
            borderRadius: 18,
            padding: 14,
            backgroundColor: palette.surface,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>{board.title}</Text>
          <Text style={{ color: palette.subtext, marginVertical: 4 }}>{board.description}</Text>
          <KISButton title="Open dashboard" onPress={() => openDashboard(board.screen)} />
        </View>
      ))}
    </ScrollView>
  );
}
