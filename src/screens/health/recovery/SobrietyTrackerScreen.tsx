import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SobrietyTracker'>;

type StreakData = {
  days_sober: number;
  start_date: string;
  sponsor?: {
    name: string;
    phone: string;
    email: string;
  };
  accountability_partner?: {
    name: string;
    phone: string;
  };
};

const MILESTONES = [
  { days: 1, label: 'Day 1', icon: 'star' as const },
  { days: 7, label: '1 Week', icon: 'star' as const },
  { days: 30, label: '30 Days', icon: 'crown' as const },
  { days: 90, label: '90 Days', icon: 'crown' as const },
  { days: 365, label: '1 Year', icon: 'crown' as const },
];

export default function SobrietyTrackerScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingPartner, setRequestingPartner] = useState(false);

  const fetchStreak = useCallback(async () => {
    setLoading(true);
    const res = await getRequest(ROUTES.healthExtended.recoveryStreaks);
    if (res.success && res.data) setStreakData(res.data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchStreak(); }, [fetchStreak]));

  const handleRequestPartner = async () => {
    setRequestingPartner(true);
    const res = await postRequest(ROUTES.healthExtended.recoveryAccountabilityRequest, {
      action: 'request_accountability_partner',
    });
    setRequestingPartner(false);
    if (res.success) {
      Alert.alert('Request Sent', 'Your accountability partner request has been submitted.');
    } else {
      Alert.alert('Error', res.message || 'Failed to send request.');
    }
  };

  const styles = makeStyles(palette, sp);
  const days = streakData?.days_sober ?? 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={[palette.gradientStart, palette.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <KISIcon name="arrow-left" size={22} color={palette.ivory} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sobriety Tracker</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Counter */}
        <LinearGradient
          colors={[palette.primarySoft, palette.card]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.counterCard}
        >
          <Text style={styles.daysLabel}>Days Sober</Text>
          <Text style={styles.daysCount}>{days}</Text>
          {streakData?.start_date && (
            <Text style={styles.startDate}>
              Since {new Date(streakData.start_date).toLocaleDateString()}
            </Text>
          )}
        </LinearGradient>

        {/* Milestone Badges */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Milestones</Text>
          <View style={styles.milestonesGrid}>
            {MILESTONES.map((m) => {
              const unlocked = days >= m.days;
              return (
                <View key={m.days} style={[styles.milestoneBadge, !unlocked && styles.milestoneLocked]}>
                  <KISIcon
                    name={m.icon}
                    size={24}
                    color={unlocked ? palette.gold : palette.divider}
                    focused={unlocked}
                  />
                  <Text style={[styles.milestoneLabel, !unlocked && styles.milestoneLabelLocked]}>
                    {m.label}
                  </Text>
                  {!unlocked && (
                    <KISIcon name="lock" size={10} color={palette.subtext} />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Sponsor Card */}
        {streakData?.sponsor ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Sponsor</Text>
            <View style={styles.personRow}>
              <View style={styles.avatarCircle}>
                <KISIcon name="person" size={20} color={palette.primary} />
              </View>
              <View style={styles.personInfo}>
                <Text style={styles.personName}>{streakData.sponsor.name}</Text>
                {streakData.sponsor.phone && (
                  <Text style={styles.personContact}>{streakData.sponsor.phone}</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.contactBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => {
                  const phone = streakData?.sponsor?.phone;
                  if (phone) Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Error', 'Could not open phone dialler.'));
                }}
                accessibilityLabel={`Call ${streakData?.sponsor?.name ?? 'sponsor'}`}
              >
                <KISIcon name="phone" size={18} color={palette.primary} />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Accountability Partner */}
        {streakData?.accountability_partner ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Accountability Partner</Text>
            <View style={styles.personRow}>
              <View style={styles.avatarCircle}>
                <KISIcon name="users" size={20} color={palette.primary} />
              </View>
              <View style={styles.personInfo}>
                <Text style={styles.personName}>{streakData.accountability_partner.name}</Text>
                {streakData.accountability_partner.phone && (
                  <Text style={styles.personContact}>{streakData.accountability_partner.phone}</Text>
                )}
              </View>
            </View>
          </View>
        ) : (
          <KISButton
            title="Request Accountability Partner"
            variant="outline"
            size="md"
            loading={requestingPartner}
            left={<KISIcon name="user-plus" size={16} color={palette.primary} />}
            onPress={handleRequestPartner}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, sp: number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingTop: 12,
      paddingBottom: 16,
      gap: 12,
    },
    backBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
    headerTitle: { fontSize: 22, fontWeight: '700', color: palette.ivory },
    content: { padding: sp, gap: 16 },
    counterCard: {
      borderRadius: 20,
      padding: 32,
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    daysLabel: { fontSize: 14, color: palette.subtext, fontWeight: '500', letterSpacing: 1 },
    daysCount: {
      fontSize: 80,
      fontWeight: '800',
      color: palette.primary,
      lineHeight: 90,
    },
    startDate: { fontSize: 13, color: palette.subtext },
    card: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.divider,
      gap: 12,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: palette.text },
    milestonesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    milestoneBadge: {
      width: '18%',
      aspectRatio: 1,
      borderRadius: 12,
      backgroundColor: palette.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
      padding: 6,
      borderWidth: 1,
      borderColor: palette.primary + '44',
      minWidth: 60,
    },
    milestoneLocked: {
      backgroundColor: palette.surface,
      borderColor: palette.divider,
    },
    milestoneLabel: {
      fontSize: 9,
      color: palette.primary,
      fontWeight: '600',
      textAlign: 'center',
    },
    milestoneLabelLocked: { color: palette.subtext },
    personRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatarCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: palette.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    personInfo: { flex: 1 },
    personName: { fontSize: 15, fontWeight: '600', color: palette.text },
    personContact: { fontSize: 13, color: palette.subtext, marginTop: 2 },
    contactBtn: {
      minWidth: 44,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
}
