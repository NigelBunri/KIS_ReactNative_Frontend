import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import { useProfileController } from '@/screens/tabs/profile/useProfileController';
import { useAuth } from '../../../App';

const CATEGORY_LABELS: Record<string, string> = {
  health: 'Health & Medical',
  finances: 'Financial Hardship',
  relationships: 'Relationships & Marriage',
  faith: 'Faith & Spirituality',
  business: 'Business & Career',
  grief: 'Loss & Grief',
  addiction: 'Addiction & Recovery',
  family: 'Family & Parenting',
  mental_health: 'Mental Health',
  other: 'Other',
};
const CATEGORIES = Object.keys(CATEGORY_LABELS);
const CATEGORY_EMOJI: Record<string, string> = {
  health: '🏥',
  finances: '💰',
  relationships: '💑',
  faith: '🙏',
  business: '💼',
  grief: '🕊️',
  addiction: '🌱',
  family: '👨‍👩‍👧',
  mental_health: '🧠',
  other: '💙',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function TestimonyHubScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { setAuth, setPhone, callingCode } = useAuth();
  const c = useProfileController({ setAuth, setPhone, locationCallingCode: callingCode });
  const currentUserId = useMemo(() => {
    const uid = c.profile?.user?.id;
    return uid ? String(uid) : null;
  }, [c.profile?.user?.id]);

  const [refreshing, setRefreshing] = useState(false);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [testimonies, setTestimonies] = useState<any[]>([]);
  const [reachOuts, setReachOuts] = useState<any[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(palette), [palette]);

  const loadAll = useCallback(async () => {
    const [seasonsRes, testimoniesRes, reachRes] = await Promise.allSettled([
      getRequest(ROUTES.testimony.seasonsMine),
      currentUserId
        ? getRequest(ROUTES.testimony.testimonies, { params: { user_id: currentUserId } })
        : Promise.resolve(null),
      getRequest(ROUTES.testimony.reach),
    ]);

    if (seasonsRes.status === 'fulfilled' && seasonsRes.value?.success) {
      const data = seasonsRes.value.data;
      const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
      setSeasons(list);
    }
    if (testimoniesRes.status === 'fulfilled' && testimoniesRes.value?.success) {
      const data = testimoniesRes.value?.data;
      const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
      setTestimonies(list);
    }
    if (reachRes.status === 'fulfilled' && reachRes.value?.success) {
      const data = reachRes.value.data;
      const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
      setReachOuts(list);
    }
  }, [currentUserId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const pendingInbox = useMemo(
    () =>
      reachOuts.filter(
        r => String(r?.to_user?.id) === currentUserId && r?.status === 'pending',
      ).length,
    [reachOuts, currentUserId],
  );

  const handleResolveSeason = useCallback(
    (seasonId: string, seasonTitle: string) => {
      Alert.alert(
        'Mark as Resolved',
        `Mark "${seasonTitle}" as resolved?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Resolve',
            onPress: async () => {
              setResolvingId(seasonId);
              await patchRequest(ROUTES.testimony.seasonDetail(seasonId), { is_active: false });
              setResolvingId(null);
              void loadAll();
            },
          },
        ],
      );
    },
    [loadAll],
  );

  const activeSeasons = useMemo(() => seasons.filter(s => s?.is_active !== false), [seasons]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg, marginTop: 25 }]} edges={['top']}>
      <ScrollView
        style={{ backgroundColor: palette.bg, marginTop: 25 }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} colors={[palette.primary]} />
        }
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <KISIcon name="arrow-left" size={22} color={palette.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: palette.text }]}>Testimony Network</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>Real people. Real stories. Real help.</Text>
          </View>
        </View>

        <View style={[styles.section]}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>I'm Going Through...</Text>
            <Pressable
              onPress={() => navigation.navigate('DeclareSeasonSheet', {})}
              style={[styles.outlineBtn, { borderColor: palette.primary }]}
            >
              <Text style={[styles.outlineBtnText, { color: palette.primary }]}>Declare a season</Text>
            </Pressable>
          </View>

          {activeSeasons.length === 0 ? (
            <View style={[styles.promptCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.promptText, { color: palette.subtext }]}>
                Sharing what you're going through opens the door to people who've been there.
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {activeSeasons.map(season => (
                <View key={season.id} style={[styles.hCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={styles.cardEmoji}>{CATEGORY_EMOJI[season.category] ?? '💙'}</Text>
                  <Text style={[styles.cardCategoryLabel, { color: palette.subtext }]}>{CATEGORY_LABELS[season.category] ?? season.category}</Text>
                  <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={2}>{season.title}</Text>
                  <Pressable
                    disabled={resolvingId === String(season.id)}
                    onPress={() => handleResolveSeason(String(season.id), season.title)}
                    style={[styles.resolveBtn, { borderColor: palette.primary }]}
                  >
                    <Text style={[styles.resolveBtnText, { color: palette.primary }]}>Resolve ✓</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>What I've Overcome</Text>
            <Pressable
              onPress={() => navigation.navigate('DeclareTestimonySheet', {})}
              style={[styles.outlineBtn, { borderColor: palette.primary }]}
            >
              <Text style={[styles.outlineBtnText, { color: palette.primary }]}>Share a testimony</Text>
            </Pressable>
          </View>

          {testimonies.length === 0 ? (
            <View style={[styles.promptCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.promptText, { color: palette.subtext }]}>
                Your story could change someone's life.
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {testimonies.map(t => (
                <View key={t.id} style={[styles.hCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <Text style={styles.cardEmoji}>{CATEGORY_EMOJI[t.category] ?? '💙'}</Text>
                  <Text style={[styles.cardCategoryLabel, { color: palette.subtext }]}>{CATEGORY_LABELS[t.category] ?? t.category}</Text>
                  <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={2}>{t.title}</Text>
                  <View style={styles.endorseRow}>
                    <KISIcon name="heart" size={14} color={palette.primary} />
                    <Text style={[styles.endorseCount, { color: palette.subtext }]}>{t.endorsement_count ?? 0}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Help Someone Today</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            <Pressable
              onPress={() => navigation.navigate('SeasonsBrowser', {})}
              style={[styles.chip, { backgroundColor: palette.primary }]}
            >
              <Text style={[styles.chipText, { color: palette.onPrimary }]}>All</Text>
            </Pressable>
            {CATEGORIES.map(cat => (
              <Pressable
                key={cat}
                onPress={() => navigation.navigate('SeasonsBrowser', { category: cat })}
                style={[styles.chip, { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1 }]}
              >
                <Text style={[styles.chipText, { color: palette.text }]}>{CATEGORY_EMOJI[cat]} {CATEGORY_LABELS[cat]}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      <View style={[styles.stickyBar, { backgroundColor: palette.bg, marginTop: 25, borderTopColor: palette.divider, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={() => navigation.navigate('TestimonyReachInbox')}
          style={[styles.inboxBtn, { backgroundColor: palette.primaryStrong }]}
        >
          <KISIcon name="bell" size={18} color={palette.onPrimary} />
          <Text style={styles.inboxBtnText}>Reach-out Inbox</Text>
          {pendingInbox > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingInbox}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(palette: any) {
  return StyleSheet.create({
    safe: { flex: 1 },
    content: { paddingBottom: 100 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    backBtn: { padding: 4, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '800' },
    subtitle: { fontSize: 13, marginTop: 2 },
    section: { marginTop: 24, paddingHorizontal: 16 },
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '700' },
    outlineBtn: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    outlineBtnText: { fontSize: 13, fontWeight: '600' },
    promptCard: { borderRadius: 12, borderWidth: 1, padding: 16 },
    promptText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
    hScroll: { paddingRight: 16, gap: 12 },
    hCard: { width: 200, borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
    cardEmoji: { fontSize: 24 },
    cardCategoryLabel: { fontSize: 12 },
    cardTitle: { fontSize: 14, fontWeight: '700' },
    resolveBtn: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', marginTop: 4, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    resolveBtnText: { fontSize: 12, fontWeight: '600' },
    endorseRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    endorseCount: { fontSize: 13 },
    chipScroll: { gap: 8, paddingRight: 16 },
    chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
    chipText: { fontSize: 13, fontWeight: '600' },
    stickyBar: { borderTopWidth: 1, paddingTop: 16, paddingHorizontal: 16 },
    inboxBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14 },
    inboxBtnText: { color: palette.onPrimary, fontWeight: '700', fontSize: 15 },
    badge: { backgroundColor: palette.danger, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
    badgeText: { color: palette.onPrimary, fontSize: 11, fontWeight: '800' },
  });
}
