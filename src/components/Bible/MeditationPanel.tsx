import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import BibleSectionCard from './BibleSectionCard';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import type { MeditationEntry } from '@/screens/tabs/bible/useBibleData';

type Props = {
  meditations: MeditationEntry[];
  loading?: boolean;
};

const typeLabel = (type?: string) => (type === 'video' ? 'Video' : 'Message');

export default function MeditationPanel({ meditations, loading = false }: Props) {
  const { palette } = useKISTheme();
  const [filter, setFilter] = useState<'all' | 'message' | 'video'>('all');

  const filtered = useMemo(
    () =>
      meditations.filter((item) => {
        if (filter === 'all') return true;
        return (item.content_type || 'message') === filter;
      }),
    [filter, meditations],
  );

  if (loading) {
    return (
      <BibleSectionCard>
        <View style={styles.stateBox}>
          <ActivityIndicator color={palette.primaryStrong} />
          <Text style={{ color: palette.subtext }}>Loading KCAN meditations...</Text>
        </View>
      </BibleSectionCard>
    );
  }

  return (
    <View style={styles.stack}>
      <BibleSectionCard>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: palette.text }]}>Meditations</Text>
            <Text style={{ color: palette.subtext, marginTop: 4 }}>
              KCAN-only video and message feed. Manual content from official publishers.
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: palette.primarySoft }]}>
            <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>KCAN</Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {(['all', 'message', 'video'] as const).map((key) => {
            const active = filter === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setFilter(key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? palette.primarySoft : palette.surface,
                    borderColor: palette.divider,
                  },
                ]}
              >
                <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '800' }}>
                  {key === 'all' ? 'All' : typeLabel(key)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BibleSectionCard>

      {filtered.length ? (
        filtered.map((entry) => {
          const isVideo = entry.content_type === 'video';
          return (
            <BibleSectionCard key={entry.id}>
              <View style={styles.headerRow}>
                <View style={[styles.typeIcon, { backgroundColor: palette.primarySoft }]}>
                  <KISIcon name={isVideo ? 'play' : 'book'} size={18} color={palette.primaryStrong} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>{entry.title}</Text>
                  <Text style={{ color: palette.subtext, marginTop: 3 }}>
                    {typeLabel(entry.content_type)} {entry.date ? `· ${entry.date}` : ''}
                  </Text>
                </View>
              </View>

              {entry.thumbnail_url ? (
                <Image source={{ uri: entry.thumbnail_url }} style={styles.thumbnail} resizeMode="cover" />
              ) : isVideo ? (
                <View style={[styles.videoPlaceholder, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
                  <KISIcon name="play" size={26} color={palette.primaryStrong} />
                  <Text style={{ color: palette.subtext }}>KCAN video meditation</Text>
                </View>
              ) : null}

              {entry.content ? <Text style={[styles.body, { color: palette.text }]}>{entry.content}</Text> : null}

              {entry.scripture_refs?.length ? (
                <View style={styles.refWrap}>
                  {entry.scripture_refs.map((ref) => (
                    <View key={ref} style={[styles.refChip, { borderColor: palette.divider }]}>
                      <Text style={{ color: palette.primaryStrong, fontWeight: '700' }}>{ref}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {entry.tags?.length ? (
                <View style={styles.refWrap}>
                  {entry.tags.map((tag) => (
                    <Text key={tag} style={{ color: palette.subtext }}>
                      #{tag}
                    </Text>
                  ))}
                </View>
              ) : null}

              {entry.video_url ? (
                <KISButton
                  title="Open video"
                  size="sm"
                  variant="secondary"
                  onPress={() => Linking.openURL(entry.video_url as string)}
                />
              ) : null}
            </BibleSectionCard>
          );
        })
      ) : (
        <BibleSectionCard>
          <View style={styles.stateBox}>
            <KISIcon name="sparkles" size={24} color={palette.subtext} />
            <Text style={{ color: palette.text, fontWeight: '900' }}>No KCAN meditations published yet</Text>
            <Text style={{ color: palette.subtext, textAlign: 'center' }}>
              Published KCAN messages and videos will appear here.
            </Text>
          </View>
        </BibleSectionCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '900' },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  filterChip: { borderWidth: 2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  typeIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '900' },
  thumbnail: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12 },
  videoPlaceholder: { borderWidth: 2, borderRadius: 12, minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 8 },
  body: { lineHeight: 24 },
  refWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  refChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  stateBox: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 10 },
});
