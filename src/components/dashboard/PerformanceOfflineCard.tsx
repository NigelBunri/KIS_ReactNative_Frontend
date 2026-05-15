import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import {
  readPerformanceOfflineSettings,
  savePerformanceOfflineSettings,
  syncPerformanceOfflinePolicy,
  type PerformanceOfflineSettings,
} from '@/services/performanceOfflineService';
import { isOnline } from '@/services/networkMonitor';
import { useKISTheme } from '@/theme/useTheme';

export default function PerformanceOfflineCard() {
  const { isDark, palette } = useKISTheme();
  const [settings, setSettings] = useState<PerformanceOfflineSettings | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextSettings, nextOnline] = await Promise.all([
        syncPerformanceOfflinePolicy().catch(() => readPerformanceOfflineSettings()),
        isOnline(),
      ]);
      setSettings(nextSettings);
      setOnline(nextOnline);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleLowBandwidth = useCallback(async () => {
    const next = await savePerformanceOfflineSettings({
      lowBandwidthMode: !settings?.lowBandwidthMode,
    });
    setSettings(next);
  }, [settings?.lowBandwidthMode]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? 'rgba(18, 16, 28, 0.96)' : 'rgba(255,255,255,0.98)',
          borderColor: palette.goldBorder || palette.divider,
          shadowColor: palette.shadow,
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: palette.primarySoft, borderColor: palette.goldBorder || palette.divider },
          ]}
        >
          <KISIcon name="download" size={20} color={palette.primaryStrong} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>Offline and low-bandwidth</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Faster startup, saved data fallback, thumbnail-first media, and silent retry foundations.
          </Text>
        </View>
        {loading ? <ActivityIndicator color={palette.primaryStrong} /> : null}
      </View>

      <View style={styles.row}>
        <View style={[styles.pill, { borderColor: palette.goldBorder || palette.divider }]}>
          <Text style={[styles.pillValue, { color: palette.text }]}>
            {online === false ? 'Offline' : 'Online'}
          </Text>
          <Text style={[styles.pillLabel, { color: palette.subtext }]}>Network</Text>
        </View>
        <View style={[styles.pill, { borderColor: palette.goldBorder || palette.divider }]}>
          <Text style={[styles.pillValue, { color: palette.text }]}>
            {settings?.lowBandwidthMode ? 'On' : 'Auto'}
          </Text>
          <Text style={[styles.pillLabel, { color: palette.subtext }]}>Low data</Text>
        </View>
        <View style={[styles.pill, { borderColor: palette.goldBorder || palette.divider }]}>
          <Text style={[styles.pillValue, { color: palette.text }]}>
            {settings?.staleWhileRevalidate ? 'Ready' : 'Basic'}
          </Text>
          <Text style={[styles.pillLabel, { color: palette.subtext }]}>Cache</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <KISButton
          title={settings?.lowBandwidthMode ? 'Use auto mode' : 'Use low data'}
          size="sm"
          variant={settings?.lowBandwidthMode ? 'secondary' : 'outline'}
          onPress={toggleLowBandwidth}
        />
        <KISButton title="Refresh policy" size="sm" variant="outline" onPress={load} />
      </View>

      <Text style={[styles.privacyText, { color: palette.subtext }]}>
        Performance telemetry is local and redacted by default: no secrets, private health records, payment data, documents, or storage paths.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  pillValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  pillLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  privacyText: {
    fontSize: 11,
    lineHeight: 16,
  },
});
