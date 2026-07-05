import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BusinessHub'>;

type SectionCard = {
  label: string;
  icon: string;
  screen: keyof RootStackParamList;
  description: string;
};

const SECTIONS: SectionCard[] = [
  { label: 'Jobs Board', icon: 'briefcase-outline', screen: 'JobsBoard', description: 'Find & post kingdom jobs' },
  { label: 'Crowdfunding', icon: 'trending-up-outline', screen: 'Crowdfunding', description: 'Fund & back campaigns' },
  { label: 'Savings Groups', icon: 'people-outline', screen: 'SavingsGroups', description: 'Susu, ROSCA & investment' },
  { label: 'Mentorship', icon: 'school-outline', screen: 'BusinessMentorship', description: 'Connect with mentors' },
  { label: 'Co-Working', icon: 'business-outline', screen: 'CoWorkingSpaces', description: 'Spaces near you' },
  { label: 'Kingdom Certified', icon: 'ribbon-outline', screen: 'KingdomCertification', description: 'Certify your business' },
  { label: 'Impact Report', icon: 'bar-chart-outline', screen: 'BusinessImpactReport', description: 'Measure your impact' },
  { label: 'My Applications', icon: 'document-text-outline', screen: 'MyApplications', description: 'Track job applications' },
];

export default function BusinessHubScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getRequest(ROUTES.business.dashboard)
        .then(res => {
          if (res?.success || res?.data) setDashboard(res?.data ?? res);
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
          <KISIcon name="briefcase" size={36} color={palette.ivory} />
          <Text style={styles.headerTitle}>Business & Economy</Text>
          {loading ? (
            <ActivityIndicator color={palette.ivory} style={{ marginTop: 6 }} />
          ) : (
            <Text style={styles.headerSub}>
              {dashboard?.tagline ?? 'Kingdom-aligned commerce & opportunity'}
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
    safe: { flex: 1, backgroundColor: palette.bg, marginTop: 25 },
    scroll: { paddingBottom: 80 },
    header: {
      paddingTop: 32,
      paddingBottom: 28,
      paddingHorizontal: sp,
      alignItems: 'center',
    },
    headerTitle: {
      marginTop: 10,
      fontSize: 24,
      fontWeight: '700',
      color: palette.ivory,
      textAlign: 'center',
    },
    headerSub: {
      marginTop: 4,
      fontSize: 14,
      color: palette.ivory,
      opacity: 0.85,
      textAlign: 'center',
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
