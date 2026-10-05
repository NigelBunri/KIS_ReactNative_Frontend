import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';

type Props = NativeStackScreenProps<RootStackParamList, 'MemorialPage'>;

type MemorialPage = {
  id: string;
  name: string;
  birth_date?: string | null;
  death_date?: string | null;
  tribute?: string;
  photo_url?: string;
  is_public: boolean;
};

export default function MemorialPageScreen({ route }: Props) {
  const { memorialId } = route.params;
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [page, setPage] = useState<MemorialPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setNotFound(false);
      getRequest(ROUTES.family.memorial(memorialId))
        .then((res: any) => {
          if (!active) return;
          const data = res?.data ?? res;
          if (data && data.id) {
            setPage(data as MemorialPage);
          } else {
            setNotFound(true);
          }
        })
        .catch(() => { if (active) setNotFound(true); })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [memorialId]),
  );

  const gutter = layout.pageGutter;

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  if (notFound || !page) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
        <View style={styles.emptyState}>
          <KISIcon name="flower-outline" size={48} color={palette.subtext} />
          <Text style={[styles.emptyText, { color: palette.subtext }]}>
            This memorial page could not be found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 20, paddingBottom: 80 }}>
        <View style={styles.header}>
          {page.photo_url ? (
            <Image source={{ uri: page.photo_url }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder, { backgroundColor: palette.surface }]}>
              <KISIcon name="flower-outline" size={36} color={palette.subtext} />
            </View>
          )}
          <Text style={[styles.name, { color: palette.text }]}>{page.name}</Text>
          {(page.birth_date || page.death_date) && (
            <Text style={[styles.dates, { color: palette.subtext }]}>
              {page.birth_date ?? '—'} – {page.death_date ?? '—'}
            </Text>
          )}
        </View>

        {page.tribute ? (
          <View style={[styles.tributeCard, { backgroundColor: palette.card, borderColor: palette.divider }]}>
            <Text style={[styles.tributeLabel, { color: palette.subtext }]}>In loving memory</Text>
            <Text style={[styles.tributeText, { color: palette.text }]}>{page.tribute}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  photo: { width: 96, height: 96, borderRadius: 48 },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 22, fontWeight: '700', marginTop: 8 },
  dates: { fontSize: 14 },
  tributeCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  tributeLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  tributeText: { fontSize: 15, lineHeight: 22 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15 },
});
