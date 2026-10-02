// src/screens/education/learner/InstitutionProfileScreen.tsx
//
// Education UX v2 — learner-facing institution profile. Completes the
// creator -> consumer broadcast loop: a provider publishes an
// institution_notice or broadcasts a program/lesson/class session/event
// from BroadcastsScreen (see src/screens/education/provider/
// BroadcastsScreen.tsx); this is where a learner actually sees it.
// Previously an institution spotlight card on EducationHome only ran a
// text search for the institution's name — there was no real profile
// destination at all, and no way for a learner to see an institution's
// published broadcasts/announcements.
//
// Reuses the existing (provider-oriented) list endpoints read-only —
// no new backend routes. If an endpoint turns out to be staff-scoped on a
// given backend deployment, it simply renders as empty here rather than
// erroring, same as every other screen in this flow already does on a
// failed GET.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import ROUTES, { resolveBackendAssetUrl } from '@/network';
import { getRequest } from '@/network/get';
import type { RootStackParamList } from '@/navigation/types';
import {
  EducationScreenScaffold,
  EducationWorkspaceHeader,
  EducationListCard,
  EducationTimelineItem,
  EducationEmptyState,
} from '@/screens/education/shared/components';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Matches InstitutionPickerScreen's getInstitutionLogoUri — the backend
// nests logo/cover art under institution.branding, not a flat field.
const getInstitutionLogoUri = (institution: any): string => {
  const raw = String(institution?.branding?.logo_url || institution?.branding?.image_url || '').trim();
  return raw ? resolveBackendAssetUrl(raw) || raw : '';
};
type Route_ = RouteProp<RootStackParamList, 'EducationInstitutionProfile'>;

export default function InstitutionProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route_>();
  const { institutionId, institutionName } = route.params;
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();

  const [institution, setInstitution] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (forceNetwork = false) => {
    setLoading(true);
    try {
      const [instRes, coursesRes, broadcastsRes] = await Promise.all([
        getRequest(ROUTES.broadcasts.educationInstitution(institutionId), { forceNetwork }),
        getRequest(ROUTES.broadcasts.educationInstitutionCourses(institutionId), { forceNetwork }),
        getRequest(ROUTES.broadcasts.educationInstitutionBroadcasts(institutionId), { forceNetwork }),
      ]);
      if (instRes?.success) setInstitution(instRes.data?.institution ?? null);
      setCourses(
        coursesRes?.success
          ? (coursesRes.data?.courses ?? []).filter((c: any) => c.status === 'published')
          : [],
      );
      setUpdates(
        broadcastsRes?.success
          ? (broadcastsRes.data?.broadcasts ?? []).filter((b: any) => b.status === 'published')
          : [],
      );
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    load(true);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const name = institution?.name || institutionName || 'Institution';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <EducationScreenScaffold
        palette={palette}
        breadcrumb="Institution"
        title={name}
        onBack={() => navigation.goBack()}
        scrollable={false}
        contentContainerStyle={{ flex: 1, padding: 0 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: responsive.pageGutter, gap: 20, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(true)} tintColor={palette.primary} />}
        >
          <EducationWorkspaceHeader
            palette={palette}
            eyebrow={institution?.institution_type?.replace('_', ' ')}
            title={name}
            subtitle={institution?.description || 'Courses, live sessions, and updates from this institution.'}
            imageUrl={getInstitutionLogoUri(institution) || null}
            visibilityLabel={`${institution?.active_member_count ?? 0} members`}
          />

          {loading && !institution ? <ActivityIndicator color={palette.primary} style={{ marginTop: 10 }} /> : null}

          <View>
            <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text, marginBottom: 10 }}>Courses</Text>
            {courses.length === 0 && !loading ? (
              <EducationEmptyState palette={palette} title="No published courses yet" description="Check back soon." />
            ) : (
              <View style={{ gap: 10 }}>
                {courses.map(course => (
                  <EducationListCard
                    key={course.id}
                    palette={palette}
                    title={course.title}
                    subtitle={course.summary}
                    statusLabel={course.price_amount > 0 ? `${course.price_amount} ${course.price_currency ?? ''}` : 'Free'}
                    statusTone={course.price_amount > 0 ? 'accent' : 'success'}
                    onPress={() =>
                      navigation.navigate('EducationCourseDetail', { contentId: course.id, contentType: 'course' })
                    }
                  />
                ))}
              </View>
            )}
          </View>

          <View>
            <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text, marginBottom: 10 }}>Updates</Text>
            {updates.length === 0 && !loading ? (
              <EducationEmptyState palette={palette} title="No updates yet" description="Announcements and broadcasts from this institution will show up here." />
            ) : (
              <View style={{ gap: 4 }}>
                {updates.map(update => (
                  <EducationTimelineItem
                    key={update.id}
                    palette={palette}
                    title={update.title}
                    description={update.summary}
                    timestamp={update.starts_at ? new Date(update.starts_at).toLocaleDateString() : undefined}
                    tone="accent"
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </EducationScreenScaffold>
    </SafeAreaView>
  );
}
