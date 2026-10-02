// src/screens/education/provider/CoursesListScreen.tsx
//
// Education UX v2 — real "Courses" destination (All / Published / Drafts),
// replacing the generic module-list's "courses" mode inside
// EducationManagementModal.tsx.
//
// Visual pass: rebuilt on the shared premium education component kit.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import type { RootStackParamList } from '@/navigation/types';
import {
  EducationScreenScaffold,
  EducationListCard,
  EducationEmptyState,
  EducationActionButton,
} from '@/screens/education/shared/components';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route_ = RouteProp<RootStackParamList, 'EducationCourses'>;

const TABS = [
  { key: 'all', title: 'All' },
  { key: 'published', title: 'Published' },
  { key: 'draft', title: 'Drafts' },
];

export default function CoursesListScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route_>();
  const { institutionId, institutionName } = route.params;
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [institutionLogoUrl, setInstitutionLogoUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getRequest(ROUTES.broadcasts.educationInstitutionCourses(institutionId), {
        errorMessage: 'Unable to load courses.',
        forceNetwork: true,
      });
      if (response?.success) setCourses(response.data?.courses ?? []);
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    load();
  }, [load]);

  // For the card's "posted by" header — same branding logo shown
  // everywhere else this institution appears (spotlights, discovery feed).
  useEffect(() => {
    let cancelled = false;
    getRequest(ROUTES.broadcasts.educationInstitution(institutionId)).then(response => {
      if (!cancelled && response?.success) setInstitutionLogoUrl(response.data?.institution?.logoUrl || null);
    });
    return () => {
      cancelled = true;
    };
  }, [institutionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    if (tab === 'all') return courses;
    return courses.filter(course => course.status === tab);
  }, [courses, tab]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <EducationScreenScaffold
        palette={palette}
        breadcrumb={institutionName}
        title="Courses"
        onBack={() => navigation.goBack()}
        actions={<EducationActionButton palette={palette} label="+ Create" onPress={() => navigation.navigate('EducationCourseBuilder', { institutionId, institutionName })} />}
        scrollable={false}
        contentContainerStyle={{ flex: 1, padding: 0 }}
      >
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={row => row.id}
          contentContainerStyle={{ padding: responsive.pageGutter, gap: 10, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={palette.primary} />}
          ListHeaderComponent={
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
              {TABS.map(row => (
                <Pressable
                  key={row.key}
                  onPress={() => setTab(row.key)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: tab === row.key ? palette.primary : palette.border,
                    backgroundColor: tab === row.key ? palette.primarySoft : 'transparent',
                  }}
                >
                  <Text style={{ fontWeight: '700', fontSize: 13, color: tab === row.key ? palette.primaryStrong : palette.subtext }}>
                    {row.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          }
          ListEmptyComponent={
            !loading ? (
              <EducationEmptyState
                palette={palette}
                title={`No ${tab === 'all' ? '' : tab} courses yet`}
                description="Create your first course to get started."
                action={<EducationActionButton palette={palette} label="Create course" onPress={() => navigation.navigate('EducationCourseBuilder', { institutionId, institutionName })} />}
              />
            ) : (
              <ActivityIndicator color={palette.primary} style={{ marginTop: 30 }} />
            )
          }
          renderItem={({ item }) => (
            <EducationListCard
              palette={palette}
              title={item.title}
              subtitle={item.summary || item.description || 'No description yet.'}
              imageUrl={item.coverUrl || item.cover_url || item.cover_image_url || null}
              institutionName={institutionName}
              institutionLogoUrl={institutionLogoUrl}
              metaItems={[
                item.price_amount > 0 ? `${item.price_amount} ${item.price_currency ?? ''}` : 'Free',
                `${item.seat_limit ?? '∞'} seats`,
              ]}
              statusLabel={item.status}
              statusTone={item.status === 'published' ? 'success' : 'muted'}
              onPress={() => navigation.push('EducationCourseBuilder', { institutionId, institutionName, courseId: item.id })}
              primaryAction={
                <EducationActionButton
                  palette={palette}
                  label="Edit"
                  onPress={() => navigation.push('EducationCourseBuilder', { institutionId, institutionName, courseId: item.id })}
                />
              }
            />
          )}
        />
      </EducationScreenScaffold>
    </SafeAreaView>
  );
}
