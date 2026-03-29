import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

type Props = {
  hasAnalyticsAccess?: boolean;
  isMarketPro?: boolean;
  onUpgrade?: () => void;
};

const INSIGHTS = [
  'Real-time revenue dashboards by shop and tier',
  'Geo + timezone heatmaps for engagement spikes',
  'Inventory velocity forecasting + alerts',
  'Live conversion rates per drop/broadcast',
  'Creator leaderboards by credits generated',
  'Fraud + authenticity signals overview',
];

export default function MarketInsightsPage({
  hasAnalyticsAccess = false,
  isMarketPro = false,
  onUpgrade,
}: Props) {
  const { palette } = useKISTheme();

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={{ paddingHorizontal: 12, gap: 12 }}>
        <View
          style={{
            borderWidth: 2,
            borderColor: palette.divider,
            backgroundColor: palette.card,
            borderRadius: 22,
            padding: 12,
            gap: 10,
          }}
        >
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Market intelligence</Text>

          <Text style={{ color: palette.subtext, fontWeight: '700' }}>
            {hasAnalyticsAccess
              ? 'Analytics are active; insights reflect your tier.'
              : 'Upgrade to unlock Market Pro intelligence.'}
          </Text>

          <View style={{ gap: 6 }}>
            {INSIGHTS.map((t) => (
              <Text key={t} style={{ color: palette.subtext, fontWeight: '700' }}>
                • {t}
              </Text>
            ))}
          </View>

          {!isMarketPro ? (
            <Text
              onPress={onUpgrade}
              style={{ color: palette.primaryStrong, fontWeight: '900', marginTop: 6 }}
              suppressHighlighting
            >
              Unlock Market Pro ›
            </Text>
          ) : null}
        </View>

        <View
          style={{
            borderWidth: 2,
            borderColor: palette.divider,
            backgroundColor: palette.card,
            borderRadius: 22,
            padding: 12,
            gap: 10,
          }}
        >
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Power features</Text>
          {[
            'Subscribe to alerts (credits notifications)',
            'Join shops for exclusive drops',
            'Broadcast-integrated carts',
            'Verified badges + moderation cues',
          ].map((t) => (
            <Text key={t} style={{ color: palette.subtext, fontWeight: '700' }}>
              • {t}
            </Text>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
