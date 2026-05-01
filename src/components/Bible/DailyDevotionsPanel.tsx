import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import type { DailyDevotional } from '@/screens/tabs/bible/useBibleData';
import BibleSectionCard from './BibleSectionCard';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';

type Props = {
  devotionals: DailyDevotional[];
  loading?: boolean;
};

const refsFor = (item?: DailyDevotional | null) => item?.scripture_refs ?? item?.scripture_references ?? [];

export default function DailyDevotionsPanel({ devotionals, loading = false }: Props) {
  const { palette } = useKISTheme();
  const [showAll, setShowAll] = useState(false);
  const today = devotionals[0] ?? null;
  const recent = showAll ? devotionals.slice(1) : devotionals.slice(1, 5);
  const scriptureRefs = refsFor(today);

  if (loading) {
    return (
      <BibleSectionCard>
        <View style={styles.stateBox}>
          <ActivityIndicator color={palette.primaryStrong} />
          <Text style={{ color: palette.subtext }}>Loading today KCAN passage...</Text>
        </View>
      </BibleSectionCard>
    );
  }

  return (
    <View style={styles.stack}>
      <BibleSectionCard>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: palette.text }]}>Daily</Text>
            <Text style={{ color: palette.subtext, marginTop: 4 }}>
              Today&apos;s official KCAN passage, exhortation, and prayer.
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: palette.primarySoft }]}>
            <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>KCAN</Text>
          </View>
        </View>
      </BibleSectionCard>

      {today ? (
        <BibleSectionCard>
          <Text style={[styles.eyebrow, { color: palette.primaryStrong }]}>
            {today.date || 'Today'} {today.partner_name ? `· ${today.partner_name}` : ''}
          </Text>
          <Text style={[styles.heroTitle, { color: palette.text }]}>{today.title}</Text>
          <View style={[styles.referenceBox, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
            <KISIcon name="book" size={18} color={palette.primaryStrong} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.text, fontWeight: '800' }}>{today.passage_ref}</Text>
              {today.translation_detail ? (
                <Text style={{ color: palette.subtext, marginTop: 2 }}>
                  {today.translation_detail.name} ({today.translation_detail.code})
                </Text>
              ) : null}
            </View>
          </View>

          {scriptureRefs.length ? (
            <View style={styles.refWrap}>
              {scriptureRefs.map((ref) => (
                <View key={ref} style={[styles.refChip, { borderColor: palette.divider }]}>
                  <Text style={{ color: palette.primaryStrong, fontWeight: '700' }}>{ref}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.copyBlock}>
            <Text style={[styles.blockLabel, { color: palette.subtext }]}>Exhortation</Text>
            <Text style={[styles.copy, { color: palette.text }]}>{today.content}</Text>
          </View>

          <View style={[styles.prayerBox, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
            <Text style={[styles.blockLabel, { color: palette.subtext }]}>Prayer</Text>
            <Text style={[styles.copy, { color: palette.text }]}>{today.prayer_text}</Text>
          </View>
        </BibleSectionCard>
      ) : (
        <BibleSectionCard>
          <View style={styles.stateBox}>
            <KISIcon name="calendar" size={24} color={palette.subtext} />
            <Text style={{ color: palette.text, fontWeight: '900' }}>No daily passage published yet</Text>
            <Text style={{ color: palette.subtext, textAlign: 'center' }}>
              KCAN has not published today&apos;s passage for this language.
            </Text>
          </View>
        </BibleSectionCard>
      )}

      <BibleSectionCard>
        <View style={styles.headerRow}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Recent daily passages</Text>
          {devotionals.length > 5 ? (
            <KISButton
              title={showAll ? 'Less' : 'More'}
              size="xs"
              variant="ghost"
              onPress={() => setShowAll((prev) => !prev)}
            />
          ) : null}
        </View>
        {recent.length ? (
          <View style={styles.stack}>
            {recent.map((item) => (
              <View key={item.id} style={[styles.recentCard, { borderColor: palette.divider }]}>
                <Text style={{ color: palette.text, fontWeight: '800' }}>{item.title}</Text>
                <Text style={{ color: palette.primaryStrong, marginTop: 4 }}>{item.passage_ref}</Text>
                <Text style={{ color: palette.subtext, marginTop: 4 }} numberOfLines={2}>
                  {item.content}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: palette.subtext }}>Recent KCAN daily history will appear here after publishing.</Text>
        )}
      </BibleSectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '900' },
  sectionTitle: { fontSize: 18, fontWeight: '900', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  eyebrow: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  heroTitle: { fontSize: 24, fontWeight: '900', lineHeight: 30 },
  referenceBox: { borderWidth: 2, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 10 },
  refWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  refChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  copyBlock: { gap: 6 },
  prayerBox: { borderWidth: 2, borderRadius: 12, padding: 12, gap: 6 },
  blockLabel: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  copy: { lineHeight: 24 },
  recentCard: { borderWidth: 2, borderRadius: 12, padding: 12 },
  stateBox: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 10 },
});
