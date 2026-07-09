import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PrayerWall'>;

type PrayerRequest = {
  id: string;
  text: string;
  category?: string;
  pray_count: number;
  is_answered?: boolean;
  is_mine?: boolean;
  author_name?: string;
  created_at?: string;
};

const FILTER_TABS = ['All', 'Answered', 'Mine'];

export default function PrayerWallScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [prayingId, setPrayingId] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter === 'Answered') params.set('is_answered', 'true');
      if (filter === 'Mine') params.set('mine', 'true');
      getRequest(`${ROUTES.church.prayerWall}?${params.toString()}`)
        .then(res => {
          if (res?.success) {
            const raw = res.data;
            setPrayers(Array.isArray(raw) ? raw : raw?.results ?? []);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [filter]),
  );

  const handlePray = useCallback(async (prayer: PrayerRequest) => {
    setPrayingId(prayer.id);
    try {
      const res = await postRequest(ROUTES.church.prayerPray(prayer.id), {});
      if (res?.success) {
        setPrayers(prev =>
          prev.map(p => p.id === prayer.id ? { ...p, pray_count: p.pray_count + 1 } : p),
        );
      }
    } catch {
      Alert.alert('Error', 'Could not record prayer.');
    } finally {
      setPrayingId(null);
    }
  }, []);

  const formatDate = (d?: string) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const renderPrayer = ({ item }: { item: PrayerRequest }) => (
    <View style={styles.prayerCard}>
      <View style={styles.prayerHeader}>
        {item.category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        )}
        {item.is_answered && (
          <View style={styles.answeredBadge}>
            <KISIcon name="check" size={12} color={palette.ivory} />
            <Text style={styles.answeredText}>Answered</Text>
          </View>
        )}
        {item.created_at && (
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        )}
      </View>

      <Text style={styles.prayerText}>{item.text}</Text>

      {item.author_name && (
        <Text style={styles.authorText}>— {item.author_name}</Text>
      )}

      <TouchableOpacity
        style={styles.prayBtn}
        onPress={() => handlePray(item)}
        disabled={prayingId === item.id}
        hitSlop={{ top: 4, bottom: 4 }}
      >
        <KISIcon name="heart-outline" size={18} tone={prayingId === item.id ? 'muted' : 'primary'} />
        <Text style={styles.prayCount}>{item.pray_count}</Text>
        <Text style={styles.prayLabel}>Praying</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Prayer Wall</Text>
      </View>

      <View style={styles.tabRow}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, filter === tab && styles.tabActive]}
            onPress={() => setFilter(tab)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={[styles.tabText, filter === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={prayers}
          keyExtractor={p => p.id}
          renderItem={renderPrayer}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No prayer requests found.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewPrayerRequest')}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <KISIcon name="add" size={28} color={palette.ivory} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
    headerRow: { paddingHorizontal: sp, paddingTop: 16, paddingBottom: 8 },
    screenTitle: { fontSize: 26, fontWeight: '700', color: palette.text },
    tabRow: {
      flexDirection: 'row',
      paddingHorizontal: sp,
      gap: 8,
      marginBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
      paddingBottom: 10,
    },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: palette.surface,
      minHeight: 36,
      justifyContent: 'center',
    },
    tabActive: { backgroundColor: palette.primary },
    tabText: { fontSize: 14, color: palette.subtext, fontWeight: '500' },
    tabTextActive: { color: palette.ivory, fontWeight: '600' },
    list: { padding: sp, gap: 12, paddingBottom: 100 },
    prayerCard: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
    },
    prayerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    categoryBadge: {
      backgroundColor: palette.primarySoft,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    categoryText: { fontSize: 11, color: palette.primary, fontWeight: '600', textTransform: 'capitalize' },
    answeredBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: palette.primary,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    answeredText: { fontSize: 11, color: palette.ivory, fontWeight: '600' },
    dateText: { fontSize: 12, color: palette.subtext, marginLeft: 'auto' as any },
    prayerText: { fontSize: 15, color: palette.text, lineHeight: 22, marginBottom: 8 },
    authorText: { fontSize: 13, color: palette.subtext, marginBottom: 12, fontStyle: 'italic' },
    prayBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      minHeight: 44,
    },
    prayCount: { fontSize: 14, fontWeight: '700', color: palette.primary },
    prayLabel: { fontSize: 13, color: palette.subtext },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 14, color: palette.subtext },
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: palette.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: palette.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 8,
    },
  });
}
