import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import KISFab from '@/components/KISFab';

type Props = NativeStackScreenProps<RootStackParamList, 'Petitions'>;

type Petition = {
  id: string;
  title: string;
  target: string;
  category: string;
  signature_count: number;
  target_count: number;
  deadline: string;
  status: string;
  user_signed?: boolean;
};

const CATEGORIES = ['All', 'Civic', 'Faith', 'Business', 'Education', 'Health'];

export default function PetitionsScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const gutter = layout.pageGutter;

  const [petitions, setPetitions] = useState<Petition[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [signing, setSigning] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.government.petitions)
        .then((res: any) => {
          if (!active) return;
          // Same fix as CivicPollsScreen — the wrapper (`res`), not the
          // payload (`res.data`), was being inspected here.
          setPetitions(Array.isArray(res?.data) ? res.data : res?.data?.results ?? []);
        })
        .catch(() => setPetitions([]))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  const filtered =
    activeCategory === 'All'
      ? petitions
      : petitions.filter(
          (p) => p.category?.toLowerCase() === activeCategory.toLowerCase(),
        );

  async function handleSign(id: string) {
    const petition = petitions.find(p => p.id === id);
    if (petition?.user_signed) {
      Alert.alert('Already Signed', 'You have already signed this petition.');
      return;
    }
    setSigning(id);
    try {
      // postRequest resolves (never throws) on a failed request too, with
      // `success: false` — the previous code ignored that flag and always
      // marked the petition as signed locally, even when the backend
      // rejected the signature. Checking `success` routes a genuine
      // failure to the error alert below instead.
      const res = await postRequest(ROUTES.government.petitionSign(id), { is_anonymous: false });
      if (!res?.success) {
        throw new Error(res?.message || 'Could not sign petition. Please try again.');
      }
      setPetitions((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, signature_count: p.signature_count + 1, user_signed: true } : p,
        ),
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not sign petition. Please try again.');
    } finally {
      setSigning(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterRow, { borderBottomColor: palette.divider }]}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: 10 }}
      >
        {CATEGORIES.map((cat) => (
          <KISButton
            key={cat}
            title={cat}
            size="xs"
            variant={activeCategory === cat ? 'primary' : 'outline'}
            onPress={() => setActiveCategory(cat)}
          />
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: 12,
          paddingBottom: 100,
        }}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <KISIcon
              name="document-text-outline"
              size={52}
              color={palette.subtext}
            />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              No petitions found
            </Text>
          </View>
        ) : (
          filtered.map((petition) => {
            const progress =
              petition.target_count > 0
                ? Math.min(
                    petition.signature_count / petition.target_count,
                    1,
                  )
                : 0;
            const deadline = petition.deadline
              ? new Date(petition.deadline).toLocaleDateString()
              : null;

            return (
              <View
                key={petition.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.divider,
                    marginBottom: layout.cardGap,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text
                    style={[styles.cardTitle, { color: palette.text }]}
                    numberOfLines={2}
                  >
                    {petition.title}
                  </Text>
                  {deadline && (
                    <View
                      style={[
                        styles.deadlineBadge,
                        { backgroundColor: palette.primarySoft },
                      ]}
                    >
                      <Text
                        style={[
                          styles.deadlineBadgeText,
                          { color: palette.primary },
                        ]}
                      >
                        {deadline}
                      </Text>
                    </View>
                  )}
                </View>

                <Text
                  style={[styles.targetText, { color: palette.subtext }]}
                  numberOfLines={1}
                >
                  Target: {petition.target}
                </Text>

                {/* Progress Bar */}
                <View
                  style={[
                    styles.progressBg,
                    { backgroundColor: palette.surface },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: palette.primary,
                        width: `${Math.round(progress * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[styles.signatureCount, { color: palette.subtext }]}
                >
                  {petition.signature_count.toLocaleString()} /{' '}
                  {petition.target_count.toLocaleString()} signatures
                </Text>

                <View style={styles.cardActions}>
                  <KISButton
                    size="sm"
                    variant={petition.user_signed ? 'secondary' : 'primary'}
                    title={signing === petition.id ? 'Signing…' : petition.user_signed ? '✓ Signed' : 'Sign'}
                    onPress={() => handleSign(petition.id)}
                    disabled={signing === petition.id || petition.user_signed}
                    loading={signing === petition.id}
                  />
                  <KISButton
                    size="sm"
                    variant="outline"
                    title="View"
                    onPress={() =>
                      navigation.navigate('PetitionDetail', {
                        petitionId: petition.id,
                      })
                    }
                  />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <KISFab
        icon="add"
        onPress={() => navigation.navigate('CreatePetition')}
        style={styles.fab}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filterRow: {
    borderBottomWidth: 1,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    lineHeight: 20,
  },
  deadlineBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  deadlineBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  targetText: {
    fontSize: 13,
    marginBottom: 10,
  },
  progressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  signatureCount: {
    fontSize: 12,
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
  },
});
