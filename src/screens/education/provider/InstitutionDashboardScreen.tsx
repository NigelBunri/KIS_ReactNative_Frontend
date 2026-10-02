// src/screens/education/provider/InstitutionDashboardScreen.tsx
//
// Education UX v2 — real "Institution Dashboard" destination, replacing
// the `screen === 'dashboard'` internal state inside
// EducationManagementModal.tsx (left in place; its create/edit forms for
// the deepest per-record CRUD are still reached from here rather than
// reimplemented — see CourseBuilderScreen and the v2 architecture note).
// Organized around attention/action per the v2 brief, not a flat list of
// every backend entity.
//
// Visual pass: rebuilt on the premium education component kit (see
// src/screens/education/shared/components.tsx — the Phase 1 primitives
// from the old EducationManagementModal redesign, orphaned when that file
// was deleted and never wired into any of the new v2 screens) instead of
// ad hoc inline card styles. Also restores a "Broadcasts" quick action and
// a "Recent broadcasts" timeline — both were dropped entirely when the old
// modal's Broadcasts module was cut (see BroadcastsScreen.tsx).
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon, type KISIconName } from '@/constants/kisIcons';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import type { RootStackParamList } from '@/navigation/types';
import {
  EducationScreenScaffold,
  EducationMetricTile,
  EducationSectionCard,
  EducationActionButton,
  EducationListCard,
  EducationEmptyState,
  EducationTimelineItem,
} from '@/screens/education/shared/components';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route_ = RouteProp<RootStackParamList, 'EducationInstitutionDashboard'>;

function QuickAction({ icon, title, onPress }: { icon: KISIconName; title: string; onPress: () => void }) {
  const { palette } = useKISTheme();
  return (
    <View style={{ minWidth: 140, flex: 1 }}>
      <EducationActionButton
        palette={palette}
        label={title}
        variant="secondary"
        onPress={onPress}
        icon={<KISIcon name={icon} size={16} color={palette.primaryStrong} />}
      />
    </View>
  );
}

export default function InstitutionDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route_>();
  const { institutionId, institutionName } = route.params;
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (forceNetwork = false) => {
    setLoading(true);
    try {
      const response = await getRequest(ROUTES.broadcasts.educationInstitutionDashboard(institutionId), {
        errorMessage: 'Unable to load institution dashboard.',
        forceNetwork,
      });
      if (response?.success) setPayload(response.data ?? {});
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    load(true);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load]),
  );

  const metrics = payload?.metrics ?? {};
  const recentCourses = payload?.recent_courses ?? [];
  const recentBroadcasts = payload?.recent_broadcasts ?? [];
  const needsAttention = (metrics.pending_application_count || 0) + (metrics.pending_course_access_request_count || 0);
  const name = payload?.institution?.name || institutionName || 'Institution';

  if (loading && !payload) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.primary} />
      </SafeAreaView>
    );
  }

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
          contentContainerStyle={{ padding: responsive.pageGutter, gap: 22, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(true)} tintColor={palette.primary} />}
        >
          {needsAttention > 0 ? (
            <EducationSectionCard
              palette={palette}
              eyebrow="Needs your attention"
              title={`${needsAttention} item${needsAttention === 1 ? '' : 's'} waiting on you`}
              description="Pending applications and course access requests."
              onPress={() => navigation.navigate('EducationLearners', { institutionId, institutionName: name })}
              icon={<KISIcon name="warning" size={20} color={palette.primaryStrong} />}
            />
          ) : null}

          <View>
            <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text, marginBottom: 10 }}>Overview</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <EducationMetricTile palette={palette} label="Courses" value={metrics.course_count ?? 0} />
              <EducationMetricTile
                palette={palette}
                label="Programs"
                value={metrics.program_count ?? 0}
                hint={metrics.class_count ? `${metrics.class_count} classes` : undefined}
              />
              <EducationMetricTile palette={palette} label="Students" value={metrics.active_student_count ?? 0} />
              <EducationMetricTile palette={palette} label="Enrollments" value={metrics.enrollment_count ?? 0} />
              <EducationMetricTile
                palette={palette}
                label="Bookings"
                value={metrics.booking_count ?? 0}
                tone={metrics.pending_booking_count ? 'warning' : 'default'}
                hint={metrics.pending_booking_count ? `${metrics.pending_booking_count} pending` : undefined}
              />
              <EducationMetricTile
                palette={palette}
                label="Broadcasts"
                value={metrics.broadcast_count ?? 0}
                tone="accent"
              />
            </View>
          </View>

          <View>
            <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text, marginBottom: 10 }}>Quick actions</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <QuickAction icon="add" title="Create course" onPress={() => navigation.navigate('EducationCourseBuilder', { institutionId, institutionName: name })} />
              <QuickAction icon="list" title="Courses" onPress={() => navigation.navigate('EducationCourses', { institutionId, institutionName: name })} />
              <QuickAction icon="list" title="Programs & Classes" onPress={() => navigation.navigate('EducationPrograms', { institutionId, institutionName: name })} />
              <QuickAction icon="people" title="Learners" onPress={() => navigation.navigate('EducationLearners', { institutionId, institutionName: name })} />
              <QuickAction icon="calendar" title="Events & Live" onPress={() => navigation.navigate('EducationEventsLive', { institutionId, institutionName: name })} />
              <QuickAction icon="broadcast" title="Broadcasts" onPress={() => navigation.navigate('EducationBroadcasts', { institutionId, institutionName: name })} />
              <QuickAction icon="settings" title="Settings" onPress={() => navigation.navigate('EducationInstitutionSettings', { institutionId, institutionName: name })} />
            </View>
          </View>

          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>Recent courses</Text>
              <EducationActionButton palette={palette} label="See all" variant="ghost" onPress={() => navigation.navigate('EducationCourses', { institutionId, institutionName: name })} />
            </View>
            {recentCourses.length === 0 ? (
              <EducationEmptyState
                palette={palette}
                title="No courses yet"
                description="You haven't created any courses yet."
                action={<EducationActionButton palette={palette} label="Create course" onPress={() => navigation.navigate('EducationCourseBuilder', { institutionId, institutionName: name })} />}
              />
            ) : (
              <View style={{ gap: 10 }}>
                {recentCourses.map((course: any) => (
                  <EducationListCard
                    key={course.id}
                    palette={palette}
                    title={course.title}
                    statusLabel={course.status}
                    statusTone={course.status === 'published' ? 'success' : 'muted'}
                    onPress={() => navigation.push('EducationCourseBuilder', { institutionId, institutionName: name, courseId: course.id })}
                  />
                ))}
              </View>
            )}
          </View>

          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>Recent broadcasts</Text>
              <EducationActionButton palette={palette} label="Manage" variant="ghost" onPress={() => navigation.navigate('EducationBroadcasts', { institutionId, institutionName: name })} />
            </View>
            {recentBroadcasts.length === 0 ? (
              <EducationEmptyState
                palette={palette}
                title="No broadcasts yet"
                description="Publish an announcement or broadcast a course, lesson, live session, or event."
                action={<EducationActionButton palette={palette} label="+ New broadcast" onPress={() => navigation.navigate('EducationBroadcasts', { institutionId, institutionName: name })} />}
              />
            ) : (
              <View style={{ gap: 2 }}>
                {recentBroadcasts.slice(0, 6).map((broadcast: any) => (
                  <EducationTimelineItem
                    key={broadcast.id}
                    palette={palette}
                    title={broadcast.title || 'Broadcast updated'}
                    description={broadcast.summary || (broadcast.broadcast_kind || 'broadcast').replace('_', ' ')}
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
