import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
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
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DigitalBadges'>;

type Badge = {
  id: string;
  title: string;
  issued_at: string;
  verif_hash: string;
  image_url?: string;
};

export default function BadgesScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.education.studentBadges)
        .then((res: any) => {
          if (active) setBadges(res?.data ?? res ?? []);
        })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  const handleShare = async (badge: Badge) => {
    try {
      await Share.share({
        title: badge.title,
        message: `I earned the "${badge.title}" badge! Verify at hash: ${badge.verif_hash}`,
      });
    } catch {
      Alert.alert('Error', 'Could not share badge.');
    }
  };

  const numCols = layout.columns.dense;
  const cardWidth = (layout.width - sp * 2 - (numCols - 1) * 10) / numCols;

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
    header: { padding: sp, paddingBottom: sp + 4 },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      minHeight: 44,
    },
    backLabel: { fontSize: 16, color: palette.ivory, marginLeft: 4 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: palette.ivory },
    headerSubtitle: { fontSize: 14, color: palette.ivory, opacity: 0.8, marginTop: 4 },
    scroll: { flex: 1 },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: sp,
      gap: 10,
      paddingBottom: 80,
    },
    card: {
      width: cardWidth,
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
    },
    badgePlaceholder: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: palette.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
    },
    badgeTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: palette.text,
      textAlign: 'center',
      marginBottom: 4,
    },
    issuedAt: { fontSize: 11, color: palette.subtext, marginBottom: 6 },
    hashChip: {
      backgroundColor: palette.surface,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 3,
      marginBottom: 10,
      maxWidth: cardWidth - 24,
    },
    hashText: {
      fontSize: 10,
      color: palette.subtext,
      fontFamily: 'Courier',
    },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 36,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: palette.primarySoft,
    },
    shareBtnText: { fontSize: 13, color: palette.primary, fontWeight: '600' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { textAlign: 'center', color: palette.subtext, marginTop: 40, padding: sp },
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
        <Text style={styles.headerTitle}>Digital Badges</Text>
        <Text style={styles.headerSubtitle}>{badges.length} badge{badges.length !== 1 ? 's' : ''} earned</Text>
      </LinearGradient>

      <ScrollView style={styles.scroll}>
        {badges.length === 0 ? (
          <Text style={styles.empty}>No badges earned yet. Complete courses to earn badges.</Text>
        ) : (
          <View style={styles.grid}>
            {badges.map((badge) => (
              <View key={badge.id} style={styles.card}>
                <View style={styles.badgePlaceholder}>
                  <KISIcon name="ribbon-outline" size={32} color={palette.primary} />
                </View>
                <Text style={styles.badgeTitle} numberOfLines={2}>{badge.title}</Text>
                <Text style={styles.issuedAt}>
                  {badge.issued_at ? new Date(badge.issued_at).toLocaleDateString() : ''}
                </Text>
                <View style={styles.hashChip}>
                  <Text style={styles.hashText} numberOfLines={1}>
                    {badge.verif_hash?.substring(0, 16)}...
                  </Text>
                </View>
                <Pressable
                  style={styles.shareBtn}
                  onPress={() => handleShare(badge)}
                  hitSlop={4}
                >
                  <KISIcon name="share-social-outline" size={14} color={palette.primary} />
                  <Text style={styles.shareBtnText}>Share</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
