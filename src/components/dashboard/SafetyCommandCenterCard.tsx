import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import {
  fetchSafetyCommandCenterSummary,
  type SafetyCommandCenterSection,
  type SafetyCommandCenterSummary,
} from '@/services/safetyCommandCenterService';
import { useKISTheme } from '@/theme/useTheme';

const STATUS_COPY: Record<string, string> = {
  healthy: 'Healthy',
  warning: 'Needs review',
  critical: 'Critical',
};

const SECTION_ORDER = [
  'system_health',
  'abuse_signals',
  'media_quarantine',
  'verification_queue',
  'payment_incidents',
  'messaging_delivery',
  'notification_health',
  'provider_readiness',
];

function sectionTone(status: string, palette: any) {
  if (status === 'critical') {
    return { bg: 'rgba(185, 28, 28, 0.1)', border: 'rgba(185, 28, 28, 0.35)', text: '#B91C1C' };
  }
  if (status === 'warning') {
    return { bg: palette.primarySoft, border: palette.goldBorder || palette.primaryStrong, text: palette.primaryStrong };
  }
  return { bg: palette.surface, border: palette.divider, text: palette.subtext };
}

function CommandSection({ item }: { item: SafetyCommandCenterSection }) {
  const { palette } = useKISTheme();
  const tone = sectionTone(item.status, palette);
  return (
    <View style={[styles.sectionCard, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionCount, { color: tone.text }]}>{item.count}</Text>
        <Text style={[styles.sectionStatus, { color: tone.text }]}>
          {STATUS_COPY[item.status] || item.status}
        </Text>
      </View>
      <Text numberOfLines={1} style={[styles.sectionTitle, { color: palette.text }]}>
        {item.label}
      </Text>
      <Text numberOfLines={3} style={[styles.sectionDetail, { color: palette.subtext }]}>
        {item.detail}
      </Text>
    </View>
  );
}

export default function SafetyCommandCenterCard() {
  const { isDark, palette } = useKISTheme();
  const [summary, setSummary] = useState<SafetyCommandCenterSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchSafetyCommandCenterSummary();
      setSummary(payload);
    } catch (err: any) {
      setError(err?.message || 'Safety command center is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(() => {
    const raw = summary?.sections || {};
    return SECTION_ORDER.map(key => raw[key]).filter(Boolean);
  }, [summary?.sections]);

  const overallTone = sectionTone(summary?.overall_status || 'healthy', palette);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? 'rgba(20, 16, 27, 0.97)' : 'rgba(255,255,255,0.98)',
          borderColor: palette.goldBorder || palette.divider,
          shadowColor: palette.shadow,
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: overallTone.bg, borderColor: overallTone.border },
          ]}
        >
          <KISIcon name="shield" size={20} color={overallTone.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>Safety command center</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Staff-only observability for safety, trust, payments, messages, notifications, and launch evidence.
          </Text>
        </View>
        {loading ? <ActivityIndicator color={palette.primaryStrong} /> : null}
      </View>

      {error ? (
        <View style={[styles.errorBox, { borderColor: palette.divider }]}>
          <Text style={[styles.errorText, { color: palette.subtext }]}>{error}</Text>
          <KISButton title="Retry" size="sm" variant="outline" onPress={load} />
        </View>
      ) : null}

      {summary ? (
        <View style={styles.countRow}>
          <View style={[styles.countPill, { borderColor: overallTone.border, backgroundColor: overallTone.bg }]}>
            <Text style={[styles.countValue, { color: overallTone.text }]}>{summary.counts.critical_signals}</Text>
            <Text style={[styles.countLabel, { color: overallTone.text }]}>Critical</Text>
          </View>
          <View style={[styles.countPill, { borderColor: palette.goldBorder || palette.divider }]}>
            <Text style={[styles.countValue, { color: palette.text }]}>{summary.counts.warning_signals}</Text>
            <Text style={[styles.countLabel, { color: palette.subtext }]}>Warnings</Text>
          </View>
          <View style={[styles.countPill, { borderColor: palette.goldBorder || palette.divider }]}>
            <Text style={[styles.countValue, { color: palette.text }]}>{summary.launch_blockers.length}</Text>
            <Text style={[styles.countLabel, { color: palette.subtext }]}>Evidence</Text>
          </View>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionRow}>
        {sections.map(section => (
          <CommandSection key={section.label} item={section} />
        ))}
      </ScrollView>

      <Text style={[styles.privacyText, { color: palette.subtext }]}>
        Staff summary only: no secrets, raw provider payloads, raw documents, storage paths, private health records, or payment instruments.
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
  countRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countPill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  countValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  countLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '800',
  },
  sectionRow: {
    gap: 10,
    paddingRight: 4,
  },
  sectionCard: {
    width: 210,
    minHeight: 132,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionCount: {
    fontSize: 18,
    fontWeight: '900',
  },
  sectionStatus: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '900',
  },
  sectionDetail: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 17,
  },
  privacyText: {
    fontSize: 11,
    lineHeight: 16,
  },
});
