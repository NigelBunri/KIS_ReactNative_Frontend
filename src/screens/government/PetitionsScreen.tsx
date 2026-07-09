import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
          setPetitions(Array.isArray(res) ? res : res?.results ?? []);
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
      await postRequest(ROUTES.government.petitionSign(id), { is_anonymous: false });
      setPetitions((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, signature_count: p.signature_count + 1, user_signed: true } : p,
        ),
      );
    } catch {
      Alert.alert('Error', 'Could not sign petition. Please try again.');
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
          <TouchableOpacity
            key={cat}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={[
              styles.chip,
              {
                backgroundColor:
                  activeCategory === cat ? palette.primary : palette.surface,
                borderColor:
                  activeCategory === cat ? palette.primary : palette.divider,
              },
            ]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color:
                    activeCategory === cat ? palette.ivory : palette.subtext,
                },
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
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
                  <TouchableOpacity
                    activeOpacity={0.75}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    style={[
                      styles.inlineBtn,
                      {
                        backgroundColor: palette.primarySoft,
                        borderColor: palette.primary,
                      },
                    ]}
                    onPress={() => handleSign(petition.id)}
                    disabled={signing === petition.id || petition.user_signed}
                  >
                    <Text
                      style={[styles.inlineBtnText, { color: petition.user_signed ? palette.success : palette.primary }]}
                    >
                      {signing === petition.id ? 'Signing…' : petition.user_signed ? '✓ Signed' : 'Sign'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    style={[
                      styles.inlineBtn,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.divider,
                      },
                    ]}
                    onPress={() =>
                      navigation.navigate('PetitionDetail', {
                        petitionId: petition.id,
                      })
                    }
                  >
                    <Text
                      style={[styles.inlineBtnText, { color: palette.subtext }]}
                    >
                      View
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.fab, { backgroundColor: palette.primary }]}
        onPress={() => navigation.navigate('CreatePetition')}
      >
        <KISIcon name="add" size={28} color={palette.ivory} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filterRow: {
    borderBottomWidth: 1,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
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
  inlineBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineBtnText: {
    fontSize: 13,
    fontWeight: '600',
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
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
});
