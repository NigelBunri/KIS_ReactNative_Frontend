import React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import useMarketData from '@/screens/broadcast/market/hooks/useMarketData';
import FeaturedLessonHero from '@/screens/broadcast/education/sections/FeaturedLessonHero';

type Props = {
  ownerId?: string | null;
  searchTerm?: string;
};

export default function MarketDropsPage({ ownerId = null, searchTerm = '' }: Props) {
  const { palette } = useKISTheme();
  const { home, loadingHome, reloadAll } = useMarketData({ ownerId, q: searchTerm });

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={{ paddingHorizontal: 12, gap: 12 }}>
        <FeaturedLessonHero
          title="Drops (Live + Scheduled)"
          subtitle="Launch limited-time drops, schedule countdowns, and broadcast them live."
          coverUrl={home.featured_drop?.cover_url ?? null}
          badgeLeft="LIVE + SCHEDULE"
          badgeRight={loadingHome ? 'Loading…' : 'Refresh'}
          onPress={reloadAll}
        />

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
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>
            Drop checklist
          </Text>

          {[
            'LIVE badge + viewers',
            'Countdown timer',
            'Limited stock bar',
            'Replay + broadcast link',
            'Buy while watching cart',
          ].map((t) => (
            <Text key={t} style={{ color: palette.subtext, fontWeight: '700' }}>
              • {t}
            </Text>
          ))}
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
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>
            Upcoming drops
          </Text>

          {home.drops?.length ? (
            <View style={{ gap: 10 }}>
              {home.drops.slice(0, 6).map((d) => (
                <View
                  key={d.id}
                  style={{
                    borderWidth: 2,
                    borderColor: palette.divider,
                    backgroundColor: palette.surface,
                    borderRadius: 18,
                    padding: 12,
                    gap: 6,
                  }}
                >
                  <Text style={{ color: palette.text, fontWeight: '900' }}>
                    {d.title ?? 'Drop'}
                  </Text>
                  <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>
                    {d.shop_name ? `Shop: ${d.shop_name}` : 'Verified shop'} · {d.is_live ? 'LIVE' : 'Scheduled'}
                  </Text>
                  <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>
                    {d.starts_at ? `Starts: ${d.starts_at}` : 'Start time TBA'}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: palette.subtext, fontWeight: '700' }}>
              No drops available yet.
            </Text>
          )}
        </View>

        <View
          style={{
            borderWidth: 2,
            borderColor: palette.primary,
            backgroundColor: palette.primarySoft,
            borderRadius: 22,
            padding: 12,
            gap: 10,
          }}
        >
          <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 16 }}>
            Go Live Drop
          </Text>
          <Text style={{ color: palette.primaryStrong, fontWeight: '800' }}>
            Live studio entry hook is ready.
          </Text>
          <Text
            onPress={() => Alert.alert('Live drop', 'Live product drops studio coming next.')}
            style={{ color: palette.primaryStrong, fontWeight: '900' }}
            suppressHighlighting
          >
            Open studio ›
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
