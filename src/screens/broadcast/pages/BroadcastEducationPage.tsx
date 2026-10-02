// src/screens/broadcast/pages/BroadcastEducationPage.tsx
//
// Inline "Education" sub-tab for the Broadcast tab — same contract as its
// siblings here (BroadcastFeedsPage, ChannelsDiscoverPage,
// BroadcastMarketPage, etc.): a plain View embedded inside BroadcastScreen's
// own ScrollView, receiving searchTerm/searchContext from the shared
// Broadcast search row, no SafeAreaView or header of its own. This is what
// makes a published course/broadcast visible "to the whole world under the
// Education tab" — it reads from the same backend discovery feed
// (useEducationDiscovery -> ROUTES.education.discovery) that a course's
// auto-synced Broadcast record (see CourseBuilderScreen.saveDetails) and a
// manually-created Broadcast (see BroadcastsScreen.tsx) both feed into.
//
// A prior pass replaced this inline sub-tab with a push-navigation redirect
// to a separate EducationHome stack screen — that made Education behave
// like a distinct modal destination instead of a tab like the others, and
// broke discoverability of anything published while browsing here. This
// restores the inline rendering; EducationHome itself still exists as a
// deep-link/Profile destination, this page just doesn't redirect to it
// anymore.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon, type KISIconName } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import useEducationDiscovery, { EDUCATION_SORT_OPTIONS } from '@/screens/broadcast/education/hooks/useEducationDiscovery';
import EducationContentCard from '@/screens/broadcast/education/components/EducationContentCard';
import EducationContinueLearning from '@/screens/broadcast/education/components/EducationContinueLearning';
import type { RootStackParamList } from '@/navigation/types';
import type {
  EducationContentItem,
  EducationInstitutionSpotlightItem,
  EducationProgress,
  EducationInstitutionSpotlight,
} from '@/screens/broadcast/education/api/education.models';

// Both the "featured" spotlights (discovery payload) and the full
// institutions/directory/ response share this same shape
// (_build_public_institution_summary on the backend) — mapped into the
// EducationContentItem shape the rest of this page already renders, so
// EducationContentCard needs no institution-directory-specific branch.
function institutionToItem(row: EducationInstitutionSpotlight): EducationInstitutionSpotlightItem {
  return {
    id: row.id,
    type: 'institution',
    title: row.name,
    summary: row.description || '',
    coverUrl: row.logoUrl || row.imageUrl || '',
    institutionId: row.id,
    courseCount: row.courseCount,
    memberCount: row.memberCount,
    trustSummary: row.trustSummary,
  };
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  searchTerm?: string;
  searchContext?: string;
  // Called synchronously right before navigating into any Education modal
  // screen (course detail, my learning, institution picker, etc.) — lets
  // BroadcastScreen keep its gold header frozen in place instead of
  // collapsing while that modal is open. See educationModalOpenRef in
  // BroadcastScreen.tsx and keepFrozenOnBlurRef in GoldenSectionContext.tsx.
  onBeforeOpenEducationModal?: () => void;
};

const EXPLORE_TABS: Array<{ key: string; title: string; sort?: string; type?: string; icon: KISIconName }> = [
  { key: 'all', title: 'All', type: 'all', icon: 'grid' },
  { key: 'popular', title: 'Popular', sort: 'popular', icon: 'flame' },
  { key: 'new', title: 'New', sort: 'newest', icon: 'flash-on' },
  { key: 'programs', title: 'Programs', type: 'program', icon: 'school' },
  { key: 'classes', title: 'Classes', type: 'class', icon: 'layers' },
  { key: 'courses', title: 'Courses', type: 'course', icon: 'book' },
  { key: 'events', title: 'Events', type: 'workshop', icon: 'calendar' },
];

function SectionHeader({ title, onSeeAll, palette }: { title: string; onSeeAll?: () => void; palette: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <Text style={{ fontSize: 17, fontWeight: '800', color: palette.text }}>{title}</Text>
      {onSeeAll ? <KISButton title="See all" size="sm" variant="ghost" onPress={onSeeAll} /> : null}
    </View>
  );
}

type ViewMode = 'home' | 'institutions' | 'catalog';

export default function BroadcastEducationPage({ searchTerm = '', searchContext = 'all', onBeforeOpenEducationModal }: Props) {
  const navigation = useNavigation<Nav>();
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const { data, loading, error, filters, updateFilter, sort, setSort, setSearch } = useEducationDiscovery();

  const [viewMode, setViewMode] = useState<ViewMode>('home');
  // Which section's "See all" was tapped (course/program/class/lesson/
  // workshop) - drives both the type filter below and the grid header.
  const [catalogType, setCatalogType] = useState<{ type: string; title: string } | null>(null);
  const [allInstitutions, setAllInstitutions] = useState<EducationInstitutionSpotlight[]>([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(false);

  const openCatalog = useCallback((type: string, title: string) => {
    setCatalogType({ type, title });
    setViewMode('catalog');
  }, []);

  useEffect(() => {
    setSearch(searchTerm);
  }, [searchTerm, setSearch]);

  useEffect(() => {
    const tab = EXPLORE_TABS.find(t => t.key === String(searchContext || '').trim().toLowerCase());
    if (!tab) return;
    if (tab.sort) setSort(tab.sort);
    updateFilter('type', tab.type ?? 'all');
  }, [searchContext, setSort, updateFilter]);

  // The real, complete directory — every active institution, regardless
  // of whether it has recent (non-expired) broadcast activity. Loaded
  // eagerly on mount (not just for the "View all" grid) because the home
  // view's "Featured institutions" row below also reads from this now,
  // not from the discovery payload's institutionSpotlights - spotlights
  // is derived only from institutions with a currently-live, non-expired
  // broadcast (last 10 days), so an institution whose demo/seed content
  // had simply aged past its expiry disappeared from the home row
  // entirely even though it's still a real, active institution - "See
  // all" (this same directory call) was the only place it still showed.
  useEffect(() => {
    let cancelled = false;
    setInstitutionsLoading(true);
    getRequest(ROUTES.education.institutionDirectory, { forceNetwork: true })
      .then(response => {
        if (!cancelled && response?.success) setAllInstitutions(response.data?.institutions ?? []);
      })
      .finally(() => {
        if (!cancelled) setInstitutionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // "See all" on any section (Programs/Classes/Courses/Lessons/Events)
  // reuses the existing discovery `type` filter — just rendered as one flat
  // grid on this same page instead of that section's small horizontal
  // teaser row.
  useEffect(() => {
    if (viewMode === 'catalog' && catalogType) updateFilter('type', catalogType.type);
    else if (viewMode === 'home') updateFilter('type', 'all');
  }, [viewMode, catalogType, updateFilter]);

  const continueLearning: EducationProgress[] = data?.continueLearning ?? [];
  const sections = data?.sections ?? [];
  const allCatalogItems: EducationContentItem[] = useMemo(
    () => sections.flatMap(section => section.items),
    [sections],
  );

  const openCourse = useCallback(
    (item: EducationContentItem) => {
      onBeforeOpenEducationModal?.();
      // Institution-spotlight items promote the institution itself, not a
      // specific course — there's no course detail to open, so route to
      // the same institution profile the existing spotlight cards use.
      if (item.type === 'institution') {
        const institutionId = (item as unknown as Record<string, any>).institutionId || item.id;
        navigation.navigate('EducationInstitutionProfile', { institutionId, institutionName: item.title });
        return;
      }
      navigation.navigate('EducationCourseDetail', {
        contentId: item.id,
        contentType: item.type,
        seed: item as unknown as Record<string, any>,
      });
    },
    [navigation, onBeforeOpenEducationModal],
  );

  const resumeProgress = useCallback(
    (progress: EducationProgress) => {
      onBeforeOpenEducationModal?.();
      navigation.navigate('EducationCourseDetail', {
        contentId: progress.contentId,
        contentType: progress.contentType,
      });
    },
    [navigation, onBeforeOpenEducationModal],
  );

  const handleExploreTab = useCallback(
    (tab: (typeof EXPLORE_TABS)[number]) => {
      // Each tap is a full, deterministic reset to exactly that tab's view
      // rather than layering onto whatever filter/sort was left active
      // from a previous tap (e.g. tapping "Courses" after "Popular" used
      // to leave the popularity sort silently applied underneath it).
      setSort(tab.sort ?? EDUCATION_SORT_OPTIONS[0]);
      updateFilter('type', tab.type ?? 'all');
    },
    [setSort, updateFilter],
  );

  const isExploreTabActive = (tab: (typeof EXPLORE_TABS)[number]) =>
    (filters.type ?? 'all') === (tab.type ?? 'all') && sort === (tab.sort ?? EDUCATION_SORT_OPTIONS[0]);

  // Grid layout shared by both "View all" modes — fixed-width cards that
  // wrap naturally, same card component/order as everywhere else on this
  // page (title, image, description, buttons).
  const renderGrid = (items: EducationContentItem[], emptyLabel: string, isLoading: boolean) => (
    <View style={{ alignItems: 'center' }}>
      {isLoading && items.length === 0 ? <ActivityIndicator color={palette.primary} style={{ marginTop: 20 }} /> : null}
      {!isLoading && items.length === 0 ? (
        <Text style={{ color: palette.subtext, textAlign: 'center', paddingVertical: 30 }}>{emptyLabel}</Text>
      ) : null}
      {/* "View all" is a browse list, not the horizontal teaser rows -
          each card fills the available width (fillWidth, same prop the
          card already supports for this) instead of staying pinned at
          the small fixed teaser-card size, and the whole column is
          capped/centered at contentMaxWidth so it reads as one
          comfortable list on a phone and a centered column (not an
          edge-to-edge stretch) on a tablet. */}
      <View style={{ width: '100%', maxWidth: responsive.contentMaxWidth, gap: 16 }}>
        {items.map(item => (
          <EducationContentCard key={item.id} item={item} onSelect={openCourse} onPrimaryAction={openCourse} fillWidth />
        ))}
      </View>
    </View>
  );

  const headerTitle =
    viewMode === 'institutions' ? 'All Institutions' : viewMode === 'catalog' ? `All ${catalogType?.title ?? ''}` : 'Education';

  return (
    <View style={{ gap: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {viewMode !== 'home' ? (
            <KISButton title="← Back" size="sm" variant="ghost" onPress={() => setViewMode('home')} />
          ) : null}
          <Text style={{ fontSize: 20, fontWeight: '900', color: palette.text }}>{headerTitle}</Text>
        </View>
        {viewMode === 'home' ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <KISButton
              title="My Learning"
              size="sm"
              variant="secondary"
              left={<KISIcon name="book" size={14} color={palette.text} />}
              onPress={() => { onBeforeOpenEducationModal?.(); navigation.navigate('EducationMyLearning'); }}
            />
            <KISButton
              title="Manage"
              size="sm"
              variant="secondary"
              left={<KISIcon name="settings" size={14} color={palette.text} />}
              onPress={() => { onBeforeOpenEducationModal?.(); navigation.navigate('EducationInstitutionPicker'); }}
            />
          </View>
        ) : null}
      </View>

      {error ? (
        <View style={{ padding: 14, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }}>
          <Text style={{ color: palette.danger, fontWeight: '700' }}>{error}</Text>
        </View>
      ) : null}

      {viewMode === 'institutions'
        ? renderGrid(allInstitutions.map(institutionToItem), 'No institutions to show yet.', institutionsLoading)
        : null}

      {viewMode === 'catalog' ? renderGrid(allCatalogItems, `No ${(catalogType?.title ?? 'items').toLowerCase()} to show yet.`, loading) : null}

      {viewMode === 'home' ? (
        <>
          {continueLearning.length > 0 ? (
            <View>
              <SectionHeader title="Continue learning" palette={palette} onSeeAll={() => { onBeforeOpenEducationModal?.(); navigation.navigate('EducationMyLearning'); }} />
              <EducationContinueLearning items={continueLearning} onResume={resumeProgress} />
            </View>
          ) : null}

          <View>
            <SectionHeader title="Explore" palette={palette} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {EXPLORE_TABS.map(tab => {
                const active = isExploreTabActive(tab);
                return (
                  <KISButton
                    key={tab.key}
                    title={tab.title}
                    size="sm"
                    variant={active ? 'primary' : 'outline'}
                    left={<KISIcon name={tab.icon} size={14} color={active ? palette.onPrimary : palette.text} />}
                    onPress={() => handleExploreTab(tab)}
                  />
                );
              })}
            </ScrollView>
          </View>

          <View>
            <SectionHeader title="Featured institutions" palette={palette} onSeeAll={() => setViewMode('institutions')} />
            {allInstitutions.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {allInstitutions.slice(0, 12).map(institution => (
                  <EducationContentCard key={institution.id} item={institutionToItem(institution)} onSelect={openCourse} onPrimaryAction={openCourse} />
                ))}
              </ScrollView>
            ) : institutionsLoading ? (
              <ActivityIndicator color={palette.primary} />
            ) : (
              <Text style={{ color: palette.subtext }}>No featured institutions yet.</Text>
            )}
          </View>

          {sections.map(section => (
            <View key={section.id}>
              <SectionHeader
                title={section.title}
                palette={palette}
                onSeeAll={() => openCatalog(section.type, section.title)}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {section.items.map(item => (
                  <EducationContentCard key={`${section.id}-${item.id}`} item={item} onSelect={openCourse} onPrimaryAction={openCourse} />
                ))}
              </ScrollView>
            </View>
          ))}

          {loading && sections.length === 0 ? <ActivityIndicator color={palette.primary} style={{ marginTop: 20 }} /> : null}

          {!loading && sections.length === 0 && continueLearning.length === 0 ? (
            <View style={{ alignItems: 'center', gap: 10, paddingVertical: 40 }}>
              <KISIcon name="book" size={40} color={palette.subtext} />
              <Text style={{ color: palette.subtext, fontWeight: '700', textAlign: 'center' }}>
                No courses to show yet. Check back soon, or create your own institution.
              </Text>
              <KISButton title="Create an institution" onPress={() => { onBeforeOpenEducationModal?.(); navigation.navigate('EducationInstitutionPicker'); }} />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
