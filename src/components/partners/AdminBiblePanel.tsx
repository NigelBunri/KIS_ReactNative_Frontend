/**
 * AdminBiblePanel — KCAN admin full management of the Bible app.
 * Covers: daily passages, meditations, prayer calendar, courses, books,
 * ministers, messages, translation registry, monetisation, analytics.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';

type BibleSection =
  | 'daily_passages'
  | 'meditations'
  | 'devotionals'
  | 'books'
  | 'reading_plans'
  | 'prayer_calendar'
  | 'courses'
  | 'ministers'
  | 'push_notifications'
  | 'community'
  | 'notes_highlights'
  | 'translations'
  | 'languages'
  | 'monetisation'
  | 'analytics';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  onClose: () => void;
};

const SECTIONS: { key: BibleSection; label: string; icon: string; description: string }[] = [
  { key: 'daily_passages', label: 'Daily Passages', icon: '📖', description: 'Verse of the day, daily devotional passages, scheduling' },
  { key: 'meditations', label: 'Meditations', icon: '🧘', description: 'Audio and text meditation sessions' },
  { key: 'devotionals', label: 'Devotionals', icon: '✝️', description: 'Short-form spiritual reading series and authors' },
  { key: 'books', label: 'Books & Publishers', icon: '📚', description: 'Full Bible books, commentaries, study guides, publishers' },
  { key: 'reading_plans', label: 'Reading Plans', icon: '🗺', description: 'Curated reading plans: chronological, topical, yearly' },
  { key: 'prayer_calendar', label: 'Prayer Calendar', icon: '🗓', description: 'Monthly prayer schedules and intercession topics' },
  { key: 'courses', label: 'Bible Courses', icon: '🎓', description: 'Structured learning paths, lessons, and quizzes' },
  { key: 'ministers', label: 'Ministers & Authors', icon: '👤', description: 'Verified minister and author profiles' },
  { key: 'push_notifications', label: 'Push Notifications', icon: '🔔', description: 'Daily verse push, scheduled campaigns, delivery stats' },
  { key: 'community', label: 'Community', icon: '💬', description: 'Passage discussions, comments, prayer requests, moderation' },
  { key: 'notes_highlights', label: 'Notes & Highlights', icon: '🖊', description: 'User-generated notes, highlights, and bookmarks management' },
  { key: 'translations', label: 'Bible Translations', icon: '🌍', description: 'Translation registry — KJV, NIV, NLT, local translations' },
  { key: 'languages', label: 'Languages & L10n', icon: '🗣', description: 'UI localisation, audio language tracks, subtitle settings' },
  { key: 'monetisation', label: 'Monetisation', icon: '💰', description: 'Paid content, premium tiers, revenue, payout settings' },
  { key: 'analytics', label: 'Analytics', icon: '📊', description: 'Reading stats, engagement, retention, course completion' },
];

export default function AdminBiblePanel({ isOpen, panelWidth, panelTranslateX, onClose }: Props) {
  const { palette } = useKISTheme();
  const [activeSection, setActiveSection] = useState<BibleSection | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, any> | null>(null);

  const SECTION_URLS: Record<BibleSection, string> = {
    daily_passages:    '/api/v1/bible/admin/passages/',
    meditations:       '/api/v1/bible/meditations/',
    devotionals:       '/api/v1/bible/admin/devotionals/',
    books:             '/api/v1/bible/admin/books/',
    reading_plans:     '/api/v1/bible/admin/reading-plans/',
    prayer_calendar:   '/api/v1/bible/prayer/',
    courses:           '/api/v1/bible/admin/courses/',
    ministers:         '/api/v1/bible/admin/ministers/',
    push_notifications:'/api/v1/bible/admin/push-campaigns/',
    community:         '/api/v1/bible/admin/community/',
    notes_highlights:  '/api/v1/bible/admin/notes/',
    translations:      '/api/v1/bible/translations/',
    languages:         '/api/v1/bible/admin/languages/',
    monetisation:      '/api/v1/bible/admin/monetisation/',
    analytics:         '/api/v1/bible/admin/analytics/',
  };

  const KPI_SECTIONS: BibleSection[] = ['analytics', 'monetisation'];

  const loadSection = useCallback(async (section: BibleSection) => {
    setActiveSection(section);
    setData([]);
    setAnalytics(null);
    setError(null);
    setLoading(true);
    try {
      const url = (ROUTES as any).bible?.[section] || SECTION_URLS[section];
      const res: any = await getRequest(url);
      const d = res?.data ?? res;
      if (KPI_SECTIONS.includes(section)) {
        setAnalytics(typeof d === 'object' && !Array.isArray(d) ? d : null);
      } else {
        setData(Array.isArray(d) ? d : d?.results ?? []);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isOpen) return null;

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: palette.backdrop, opacity: backdropOpacity },
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            width: panelWidth,
            backgroundColor: palette.surfaceElevated,
            borderLeftColor: palette.divider,
            transform: [{ translateX: panelTranslateX }],
          },
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: palette.divider }]}>
          <Pressable onPress={activeSection ? () => setActiveSection(null) : onClose} style={styles.backBtn}>
            <Text style={{ color: palette.primary, fontSize: 28, lineHeight: 32, fontWeight: '300' }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: palette.text }]}>
              📖 Bible App Admin
            </Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              {activeSection
                ? (SECTIONS.find(s => s.key === activeSection)?.label ?? '')
                : '15 management areas · content, plans, push, community'}
            </Text>
          </View>
        </View>

        {!activeSection ? (
          // Section grid
          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {SECTIONS.map(section => (
                <Pressable
                  key={section.key}
                  onPress={() => void loadSection(section.key)}
                  style={({ pressed }) => [
                    styles.sectionCard,
                    { backgroundColor: palette.surface, borderColor: palette.divider, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Text style={{ fontSize: 28, marginBottom: 6 }}>{section.icon}</Text>
                  <Text style={[styles.sectionLabel, { color: palette.text }]}>{section.label}</Text>
                  <Text style={[styles.sectionDesc, { color: palette.subtext }]}>{section.description}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : (
          // Section detail
          <View style={{ flex: 1 }}>
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={palette.primary} />
                <Text style={[styles.loadingText, { color: palette.subtext }]}>Loading...</Text>
              </View>
            ) : error ? (
              <View style={styles.center}>
                <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
                <Pressable onPress={() => void loadSection(activeSection)} style={[styles.retryBtn, { backgroundColor: palette.primary }]}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
                </Pressable>
              </View>
            ) : activeSection === 'analytics' || activeSection === 'monetisation' ? (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                {analytics ? Object.entries(analytics).map(([k, v]) => (
                  <View key={k} style={[styles.kpiRow, { borderBottomColor: palette.divider }]}>
                    <Text style={[styles.kpiKey, { color: palette.subtext }]}>{k.replace(/_/g, ' ')}</Text>
                    <Text style={[styles.kpiVal, { color: palette.text }]}>{String(v)}</Text>
                  </View>
                )) : (
                  <Text style={{ color: palette.subtext }}>No data available.</Text>
                )}
              </ScrollView>
            ) : (
              <FlatList
                data={data}
                keyExtractor={(item, i) => String(item?.id ?? i)}
                contentContainerStyle={{ padding: 12, gap: 8 }}
                ListEmptyComponent={
                  <Text style={[styles.emptyText, { color: palette.subtext }]}>No items found.</Text>
                }
                renderItem={({ item }) => (
                  <View style={[styles.listRow, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>
                        {item?.title || item?.name || item?.label || String(item?.id)}
                      </Text>
                      {(item?.status || item?.language || item?.is_active !== undefined) ? (
                        <Text style={[styles.rowMeta, { color: palette.subtext }]}>
                          {[
                            item?.status,
                            item?.language,
                            item?.is_active !== undefined ? (item.is_active ? 'Active' : 'Inactive') : null,
                          ].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => Alert.alert('Manage', JSON.stringify(item, null, 2))}
                      style={[styles.manageBtn, { borderColor: palette.primary }]}
                    >
                      <Text style={{ color: palette.primary, fontSize: 11, fontWeight: '700' }}>Manage</Text>
                    </Pressable>
                  </View>
                )}
              />
            )}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    borderLeftWidth: 1,
    zIndex: 200,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  backBtn: {
    paddingVertical: 8,
    paddingRight: 10,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 1 },
  grid: { padding: 12 },
  sectionCard: {
    width: '47.5%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 2,
  },
  sectionLabel: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  sectionDesc: { fontSize: 11, lineHeight: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, marginTop: 8 },
  errorText: { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  kpiKey: { fontSize: 13, textTransform: 'capitalize' },
  kpiVal: { fontSize: 13, fontWeight: '700' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowMeta: { fontSize: 11, marginTop: 2 },
  manageBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});
