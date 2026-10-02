// src/screens/education/learner/EducationHomeScreen.tsx
//
// Education UX v2 — real navigator destination for learner discovery.
// Reuses the existing data layer (useEducationDiscovery,
// EducationContentCard, EducationContinueLearning) built for the old
// Broadcast-tab discovery page; this screen only changes the IA (a real
// "Education" destination instead of a sub-tab) and adds the "My
// Learning" / "Certificates" entry points that previously didn't exist.
//
// Visual pass: institution spotlight cards now open a real
// InstitutionProfileScreen (courses + published broadcasts/announcements)
// instead of just running a text search for the institution's name — that
// search-only behavior was the only way to "see" an institution at all,
// and it dead-ended before ever reaching any broadcast the institution had
// published. Layout also moved onto the shared premium education
// component kit for visual parity with the provider side.
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import PermanentRemoteImage from '@/components/media/PermanentRemoteImage';
import useEducationDiscovery from '@/screens/broadcast/education/hooks/useEducationDiscovery';
import EducationContentCard from '@/screens/broadcast/education/components/EducationContentCard';
import EducationContinueLearning from '@/screens/broadcast/education/components/EducationContinueLearning';
import type { RootStackParamList } from '@/navigation/types';
import type {
  EducationContentItem,
  EducationProgress,
  EducationInstitutionSpotlight,
} from '@/screens/broadcast/education/api/education.models';
import {
  EducationActionButton,
  EducationEmptyState,
} from '@/screens/education/shared/components';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const EXPLORE_TABS: Array<{ key: string; title: string; sort?: string; type?: string }> = [
  { key: 'popular', title: 'Popular', sort: 'popular' },
  { key: 'new', title: 'New', sort: 'newest' },
  { key: 'courses', title: 'Courses', type: 'course' },
  { key: 'workshops', title: 'Workshops', type: 'workshop' },
  { key: 'programs', title: 'Programs', type: 'program' },
];

function HeaderIconButton({
  icon,
  onPress,
  label,
}: {
  icon: Parameters<typeof KISIcon>[0]['name'];
  onPress: () => void;
  label: string;
}) {
  const { palette } = useKISTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${palette.surfaceElevated ?? palette.surface}F0`,
        borderWidth: 1,
        borderColor: `${palette.divider ?? palette.border}AA`,
        shadowColor: palette.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      <KISIcon name={icon} size={18} color={palette.text} />
    </Pressable>
  );
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  const { palette } = useKISTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '800', color: palette.text, letterSpacing: -0.3 }}>{title}</Text>
      {onSeeAll ? <EducationActionButton palette={palette} label="See all" variant="ghost" onPress={onSeeAll} /> : null}
    </View>
  );
}

export default function EducationHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const { data, loading, error, updateFilter, setSort, refresh, setSearch } = useEducationDiscovery();

  const continueLearning: EducationProgress[] = data?.continueLearning ?? [];
  const spotlights: EducationInstitutionSpotlight[] = data?.institutionSpotlights ?? [];
  const sections = data?.sections ?? [];

  const openCourse = useCallback(
    (item: EducationContentItem) => {
      navigation.navigate('EducationCourseDetail', {
        contentId: item.id,
        contentType: item.type,
        seed: item as unknown as Record<string, any>,
      });
    },
    [navigation],
  );

  const resumeProgress = useCallback(
    (progress: EducationProgress) => {
      navigation.navigate('EducationCourseDetail', {
        contentId: progress.contentId,
        contentType: progress.contentType,
      });
    },
    [navigation],
  );

  const handleExploreTab = useCallback(
    (tab: (typeof EXPLORE_TABS)[number]) => {
      if (tab.sort) setSort(tab.sort);
      updateFilter('type', tab.type ?? 'all');
    },
    [setSort, updateFilter],
  );

  const openInstitution = useCallback(
    (spotlight: EducationInstitutionSpotlight) => {
      if (!spotlight?.id) {
        setSearch(spotlight.name);
        return;
      }
      navigation.navigate('EducationInstitutionProfile', { institutionId: spotlight.id, institutionName: spotlight.name });
    },
    [navigation, setSearch],
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: responsive.pageGutter, paddingBottom: 40, gap: 28 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={palette.primary} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 13, color: palette.subtext, fontWeight: '700' }}>{greeting} 👋</Text>
            <Text style={{ fontSize: 28, fontWeight: '900', color: palette.text, marginTop: 2, letterSpacing: -0.8 }}>Education</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <HeaderIconButton icon="star" label="Certificates" onPress={() => navigation.navigate('EducationCertificates')} />
            <HeaderIconButton icon="book" label="My Learning" onPress={() => navigation.navigate('EducationMyLearning')} />
            <HeaderIconButton icon="school" label="Manage institution" onPress={() => navigation.navigate('EducationInstitutionPicker')} />
          </View>
        </View>

        {error ? (
          <View style={{ padding: 14, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }}>
            <Text style={{ color: palette.danger, fontWeight: '700' }}>{error}</Text>
          </View>
        ) : null}

        {/* Continue learning */}
        {continueLearning.length > 0 ? (
          <View>
            <SectionHeader title="Continue learning" onSeeAll={() => navigation.navigate('EducationMyLearning')} />
            <EducationContinueLearning items={continueLearning} onResume={resumeProgress} />
          </View>
        ) : null}

        {/* Explore */}
        <View>
          <SectionHeader title="Explore" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {EXPLORE_TABS.map(tab => (
              <EducationActionButton key={tab.key} palette={palette} label={tab.title} variant="secondary" onPress={() => handleExploreTab(tab)} />
            ))}
          </ScrollView>
        </View>

        {/* Featured institutions */}
        {spotlights.length > 0 ? (
          <View>
            <SectionHeader title="Featured institutions" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {spotlights.map(spotlight => (
                <Pressable
                  key={spotlight.id}
                  onPress={() => openInstitution(spotlight)}
                  style={{
                    width: 170,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: `${palette.divider ?? palette.border}AA`,
                    backgroundColor: `${palette.surfaceElevated ?? palette.surface}F0`,
                    padding: 14,
                    gap: 8,
                    shadowColor: palette.shadow,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.16,
                    shadowRadius: 14,
                    elevation: 4,
                  }}
                >
                  <PermanentRemoteImage
                    uri={spotlight.logoUrl || spotlight.imageUrl || ''}
                    domain="Education"
                    style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: palette.border }}
                  />
                  <Text numberOfLines={2} style={{ fontWeight: '800', color: palette.text }}>
                    {spotlight.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: palette.subtext, fontWeight: '600' }}>
                    {spotlight.courseCount ?? 0} courses · {spotlight.memberCount ?? 0} members
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Content sections */}
        {sections.map(section => (
          <View key={section.id}>
            <SectionHeader title={section.title} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {section.items.map(item => (
                <View key={`${section.id}-${item.id}`} style={{ width: 260 }}>
                  <EducationContentCard item={item} onSelect={openCourse} onPrimaryAction={openCourse} />
                </View>
              ))}
            </ScrollView>
          </View>
        ))}

        {loading && sections.length === 0 ? <ActivityIndicator color={palette.primary} style={{ marginTop: 20 }} /> : null}

        {!loading && sections.length === 0 && continueLearning.length === 0 ? (
          <EducationEmptyState
            palette={palette}
            title="No courses to show yet"
            description="Check back soon, or create your own institution."
            action={<EducationActionButton palette={palette} label="Create an institution" onPress={() => navigation.navigate('EducationInstitutionPicker')} />}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
