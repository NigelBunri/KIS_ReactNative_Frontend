import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Ebooks'>;

type Ebook = {
  id: string;
  title: string;
  author: string;
  price?: number;
  currency?: string;
  is_purchased?: boolean;
  file_url?: string;
  cover_url?: string;
};

const TABS = ['Browse', 'My Library'];

export default function EbooksScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Browse' | 'My Library'>('Browse');
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);

  const fetchEbooks = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await getRequest(ROUTES.mediaExtended.ebooks);
      setEbooks(res?.data ?? res ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    fetchEbooks().then(() => {}).catch(() => {});
    return () => { active = false; };
  }, [fetchEbooks]));

  const displayed = useMemo(() => {
    if (activeTab === 'My Library') return ebooks.filter((e) => e.is_purchased);
    return ebooks;
  }, [ebooks, activeTab]);

  const handlePurchase = async (ebook: Ebook) => {
    Alert.alert(
      'Purchase Ebook',
      `Buy "${ebook.title}" for ${ebook.currency ?? 'USD'} ${ebook.price ?? 0}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy',
          onPress: async () => {
            setPurchaseLoading(ebook.id);
            try {
              await postRequest(ROUTES.mediaExtended.ebookPurchase(ebook.id), {
                price_paid: ebook.price ?? 0,
              });
              await fetchEbooks();
              Alert.alert('Success', 'Ebook purchased! Find it in My Library.');
            } catch {
              Alert.alert('Error', 'Purchase failed. Please try again.');
            } finally {
              setPurchaseLoading(null);
            }
          },
        },
      ],
    );
  };

  const numCols = 2;
  const cardGap = 10;
  const cardWidth = (layout.width - sp * 2 - cardGap) / numCols;

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
    header: { padding: sp, paddingBottom: sp + 4 },
    backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, minHeight: 44 },
    backLabel: { fontSize: 16, color: palette.ivory, marginLeft: 4 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: palette.ivory },
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      minHeight: 44,
    },
    tabText: { fontSize: 15, fontWeight: '600' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: palette.primary },
    scroll: { flex: 1 },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: sp,
      gap: cardGap,
      paddingBottom: 80,
    },
    card: {
      width: cardWidth,
      backgroundColor: palette.card,
      borderRadius: 12,
      overflow: 'hidden',
    },
    coverPlaceholder: {
      height: 120,
      backgroundColor: palette.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardBody: { padding: 10 },
    bookTitle: { fontSize: 14, fontWeight: '600', color: palette.text, marginBottom: 2 },
    author: { fontSize: 12, color: palette.subtext, marginBottom: 6 },
    priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    price: { fontSize: 13, fontWeight: '700', color: palette.text },
    freeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      backgroundColor: palette.primary,
    },
    freeBadgeText: { fontSize: 11, fontWeight: '700', color: palette.ivory },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { textAlign: 'center', color: palette.subtext, padding: sp * 2 },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="chevron-back-outline" size={22} color={palette.ivory} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Ebooks</Text>
      </LinearGradient>

      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(tab as typeof activeTab)}
            >
              <Text style={[styles.tabText, { color: active ? palette.primary : palette.subtext }]}>
                {tab}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView style={styles.scroll}>
        {displayed.length === 0 ? (
          <Text style={styles.empty}>
            {activeTab === 'My Library' ? 'No purchased ebooks yet.' : 'No ebooks available.'}
          </Text>
        ) : (
          <View style={styles.grid}>
            {displayed.map((book) => {
              const isFree = !book.price || book.price === 0;
              return (
                <View key={book.id} style={styles.card}>
                  <View style={styles.coverPlaceholder}>
                    <KISIcon name="book-outline" size={40} color={palette.primary} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
                    <Text style={styles.author} numberOfLines={1}>{book.author}</Text>
                    <View style={styles.priceRow}>
                      {isFree ? (
                        <View style={styles.freeBadge}>
                          <Text style={styles.freeBadgeText}>FREE</Text>
                        </View>
                      ) : (
                        <Text style={styles.price}>
                          {book.currency ?? 'USD'} {book.price}
                        </Text>
                      )}
                    </View>
                    {book.is_purchased && book.file_url ? (
                      <KISButton
                        title="Read"
                        variant="primary"
                        size="sm"
                        onPress={() => Linking.openURL(book.file_url!)}
                        left={<KISIcon name="open-outline" size={14} color={palette.ivory} />}
                      />
                    ) : book.is_purchased ? (
                      <KISButton title="Read" variant="secondary" size="sm" disabled />
                    ) : (
                      <KISButton
                        title={isFree ? 'Get Free' : 'Purchase'}
                        variant={isFree ? 'secondary' : 'primary'}
                        size="sm"
                        loading={purchaseLoading === book.id}
                        onPress={() => handlePurchase(book)}
                      />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
