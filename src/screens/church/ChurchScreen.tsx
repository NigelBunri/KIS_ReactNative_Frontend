import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChurchHome'>;

type ChurchOverview = {
  church_name?: string;
  member_count?: number;
};

type SectionCard = {
  label: string;
  icon: string;
  screen: keyof RootStackParamList;
  description: string;
};

const SECTIONS: SectionCard[] = [
  { label: 'Giving & Stewardship', icon: 'wallet-outline', screen: 'ChurchGiving', description: 'Tithes, offerings & campaigns' },
  { label: 'Membership', icon: 'people-outline', screen: 'MemberDirectory', description: 'Directory & attendance' },
  { label: 'Small Groups', icon: 'grid-outline', screen: 'SmallGroups', description: 'Cell groups & community' },
  { label: 'Discipleship', icon: 'trending-up-outline', screen: 'DiscipleshipJourney', description: 'Journey & spiritual gifts' },
  { label: 'Prayer Wall', icon: 'heart-outline', screen: 'PrayerWall', description: 'Requests & fasting' },
  { label: 'Worship & Songs', icon: 'musical-notes-outline', screen: 'SongLibrary', description: 'Songs & set lists' },
  { label: 'Ministry & Outreach', icon: 'earth-outline', screen: 'MinistryDepartments', description: 'Departments & evangelism' },
];

export default function ChurchScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [overview, setOverview] = useState<ChurchOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getRequest(ROUTES.church.memberships + '?summary=true')
        .then(res => {
          if (res?.success) setOverview(res.data ?? {});
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <LinearGradient
          colors={[palette.gradientStart, palette.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <KISIcon name="people" size={36} color={palette.ivory} />
          <Text style={styles.churchName}>
            {overview?.church_name ?? 'Church & Faith'}
          </Text>
          {loading ? (
            <ActivityIndicator color={palette.ivory} style={{ marginTop: 4 }} />
          ) : (
            <Text style={styles.memberCount}>
              {overview?.member_count != null
                ? `${overview.member_count.toLocaleString()} members`
                : 'Your faith community'}
            </Text>
          )}
        </LinearGradient>

        <View style={styles.grid}>
          {SECTIONS.map(section => (
            <TouchableOpacity
              key={section.screen}
              style={styles.card}
              onPress={() => navigation.navigate(section.screen as any)}
              activeOpacity={0.75}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <View style={styles.iconWrap}>
                <KISIcon name={section.icon as any} size={28} tone="primary" />
              </View>
              <Text style={styles.cardLabel}>{section.label}</Text>
              <Text style={styles.cardDesc}>{section.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
    scroll: { paddingBottom: 80 },
    header: {
      paddingTop: 32,
      paddingBottom: 28,
      paddingHorizontal: sp,
      alignItems: 'center',
    },
    churchName: {
      marginTop: 10,
      fontSize: 24,
      fontWeight: '700',
      color: palette.ivory,
      textAlign: 'center',
    },
    memberCount: {
      marginTop: 4,
      fontSize: 14,
      color: palette.ivory,
      opacity: 0.85,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: sp,
      gap: 12,
    },
    card: {
      width: '47%',
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 16,
      minHeight: 120,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: palette.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    cardLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: palette.text,
      marginBottom: 4,
    },
    cardDesc: {
      fontSize: 12,
      color: palette.subtext,
      lineHeight: 16,
    },
  });
}
