import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';

type Props = NativeStackScreenProps<RootStackParamList, 'GovernmentHub'>;

type SectionCard = {
  label: string;
  subtitle: string;
  icon: string;
  route: keyof RootStackParamList;
  routeParams?: object;
};

const SECTION_CARDS: SectionCard[] = [
  {
    label: 'Petitions',
    subtitle: 'Sign & create civic petitions',
    icon: 'document-text-outline',
    route: 'Petitions',
  },
  {
    label: 'Civic Polls',
    subtitle: 'Vote on community issues',
    icon: 'stats-chart-outline',
    route: 'CivicPolls',
  },
  {
    label: 'Legal Aid',
    subtitle: 'Find pro bono legal support',
    icon: 'briefcase-outline',
    route: 'LegalAid',
  },
  {
    label: 'Legal Templates',
    subtitle: 'Download legal document templates',
    icon: 'clipboard-outline',
    route: 'LegalTemplates',
  },
  {
    label: 'Diaspora Communities',
    subtitle: 'Connect with your diaspora',
    icon: 'globe-outline',
    route: 'DiasporaCommunities',
  },
  {
    label: 'NGO Tools',
    subtitle: 'Manage your NGO & grant applications',
    icon: 'people-outline',
    route: 'NGOTools',
  },
  {
    label: 'Compliance Tracker',
    subtitle: 'Track regulatory deadlines',
    icon: 'checkmark-circle-outline',
    route: 'ComplianceTracker',
  },
  {
    label: 'Board Governance',
    subtitle: 'Elections & board resolutions',
    icon: 'business-outline',
    route: 'BoardGovernance',
  },
  {
    label: 'Whistleblower',
    subtitle: 'Submit anonymous reports securely',
    icon: 'shield-outline',
    route: 'WhistleblowerReport',
  },
];

export default function GovernmentHubScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const gutter = layout.pageGutter;
  const cardSize = (layout.width - gutter * 2 - layout.cardGap) / 2;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, marginTop: 25 }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Header */}
        <LinearGradient
          colors={[palette.gradientStart, palette.gradientEnd]}
          style={[styles.header, { paddingHorizontal: gutter }]}
        >
          <Text style={[styles.headerTitle, { color: palette.ivory }]}>
            Civic & Governance
          </Text>
          <Text style={[styles.headerSubtitle, { color: palette.ivory }]}>
            Participate. Advocate. Govern.
          </Text>
        </LinearGradient>

        {/* Section Cards Grid */}
        <View
          style={[
            styles.grid,
            { paddingHorizontal: gutter, paddingTop: gutter, gap: layout.cardGap },
          ]}
        >
          {SECTION_CARDS.map((card) => (
            <TouchableOpacity
              key={card.route}
              activeOpacity={0.75}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              style={[
                styles.card,
                {
                  width: cardSize,
                  backgroundColor: palette.card,
                  borderColor: palette.divider,
                },
              ]}
              onPress={() =>
                navigation.navigate(card.route as any, card.routeParams as any)
              }
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: palette.primarySoft },
                ]}
              >
                <KISIcon name={card.icon} size={26} color={palette.primary} />
              </View>
              <Text
                style={[styles.cardLabel, { color: palette.text }]}
                numberOfLines={1}
              >
                {card.label}
              </Text>
              <Text
                style={[styles.cardSubtitle, { color: palette.subtext }]}
                numberOfLines={2}
              >
                {card.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingTop: 28,
    paddingBottom: 28,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
    opacity: 0.85,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    minHeight: 110,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
});
