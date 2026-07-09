import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

type Props = {
  hasAnalyticsAccess?: boolean;
  isMarketPro?: boolean;
  onUpgrade?: () => void;
};

export default function MarketInsightsPage({ hasAnalyticsAccess, isMarketPro, onUpgrade }: Props) {
  const { palette } = useKISTheme();
  const showUpgrade = !hasAnalyticsAccess && !isMarketPro;

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, }]}>
      <View style={[styles.iconWrap, { backgroundColor: palette.card }]}>
        <KISIcon name="bar-chart-outline" size={48} color={palette.primaryStrong} />
      </View>
      <Text style={[styles.title, { color: palette.text }]}>Market Insights</Text>
      <Text style={[styles.subtitle, { color: palette.subtext }]}>
        Revenue dashboards, heatmaps and campaign analytics — launching soon.
      </Text>
      {showUpgrade && onUpgrade ? (
        <Pressable
          onPress={onUpgrade}
          style={[styles.upgradeBtn, { borderColor: palette.primary, backgroundColor: palette.primarySoft }]}
        >
          <Text style={[styles.upgradeBtnText, { color: palette.primaryStrong }]}>Upgrade for early access</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  upgradeBtn: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  upgradeBtnText: {
    fontSize: 15,
    fontWeight: '900',
  },
});
