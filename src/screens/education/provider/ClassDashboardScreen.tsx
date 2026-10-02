// src/screens/education/provider/ClassDashboardScreen.tsx
//
// CLASS DASHBOARD. Same philosophy as ProgramDashboardScreen: one screen,
// internal tabs, single _build_class_detail_payload fetch driving every
// tab except Broadcast's own toggle action.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import type { RootStackParamList } from '@/navigation/types';
import { EducationScreenScaffold, EducationListCard, EducationEmptyState, EducationActionButton } from '@/screens/education/shared/components';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route_ = RouteProp<RootStackParamList, 'EducationClassDashboard'>;

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'courses', label: 'Courses' },
  { key: 'learners', label: 'Learners' },
  { key: 'staff', label: 'Staff' },
  { key: 'events', label: 'Events/Live' },
  { key: 'broadcast', label: 'Broadcast' },
  { key: 'settings', label: 'Settings' },
] as const;
type TabKey = typeof TABS[number]['key'];

export default function ClassDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route_>();
  const { institutionId, institutionName, classId, className } = route.params;
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [tab, setTab] = useState<TabKey>('details');
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [togglingBroadcast, setTogglingBroadcast] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getRequest(ROUTES.broadcasts.educationInstitutionClassDetail(institutionId, classId), {
        errorMessage: 'Unable to load class.',
        forceNetwork: true,
      });
      if (response?.success) setPayload(response.data ?? {});
    } finally {
      setLoading(false);
    }
  }, [institutionId, classId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const cls = payload?.class ?? {};
  const name = cls.name || className || 'Class';
  const metrics = payload?.metrics ?? {};
  const activeBroadcast = (payload?.broadcasts ?? []).find((b: any) => b.broadcast_kind === 'institution_class' && b.status === 'published');

  const toggleBroadcast = useCallback(async () => {
    setTogglingBroadcast(true);
    try {
      if (activeBroadcast) {
        const response = await patchRequest(
          ROUTES.broadcasts.educationInstitutionBroadcast(institutionId, activeBroadcast.id),
          { status: 'draft' },
          { errorMessage: 'Unable to remove this class from broadcast.' },
        );
        if (!response?.success) {
          Alert.alert('Broadcast', response?.message || 'Unable to remove this class from broadcast.');
          return;
        }
      } else {
        const response = await postRequest(
          ROUTES.broadcasts.educationInstitutionBroadcasts(institutionId),
          { institution_class_id: classId, broadcast_kind: 'institution_class', status: 'published' },
          { errorMessage: 'Unable to broadcast this class.' },
        );
        if (!response?.success) {
          Alert.alert('Broadcast', response?.message || 'Unable to broadcast this class.');
          return;
        }
      }
      await load();
    } finally {
      setTogglingBroadcast(false);
    }
  }, [activeBroadcast, institutionId, classId, load]);

  const deleteClass = useCallback(() => {
    Alert.alert(
      'Delete class?',
      `"${name}" will be removed. Its courses are kept — they just won't belong to a class anymore.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const response = await deleteRequest(
              ROUTES.broadcasts.educationInstitutionClassDetail(institutionId, classId),
              { errorMessage: 'Unable to delete class.' },
            );
            if (response?.success) navigation.goBack();
          },
        },
      ],
    );
  }, [institutionId, classId, name, navigation]);

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
        breadcrumb={institutionName}
        title={name}
        subtitle={cls.program_title ? `Program: ${cls.program_title}` : 'Standalone Class'}
        onBack={() => navigation.goBack()}
        scrollable={false}
        contentContainerStyle={{ flex: 1, padding: 0 }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: responsive.pageGutter, paddingVertical: 12 }}>
          {TABS.map(t => (
            <Text
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
                borderColor: tab === t.key ? palette.primary : palette.border,
                backgroundColor: tab === t.key ? palette.primarySoft : 'transparent',
                color: tab === t.key ? palette.primaryStrong : palette.subtext, fontWeight: '700', fontSize: 13,
              }}
            >
              {t.label}
            </Text>
          ))}
        </ScrollView>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: responsive.pageGutter, gap: 14, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={palette.primary} />}
        >
          {tab === 'details' ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <MetricChip label="Courses" value={metrics.course_count ?? 0} palette={palette} />
                <MetricChip label="Enrollments" value={metrics.enrollment_count ?? 0} palette={palette} />
                <MetricChip label="Staff" value={metrics.staff_assignment_count ?? 0} palette={palette} />
              </View>
              {cls.description ? <Text style={{ color: palette.text }}>{cls.description}</Text> : null}
              <DetailRow label="Program" value={cls.program_title || 'Standalone'} palette={palette} />
              <DetailRow label="Type" value={cls.class_type} palette={palette} />
              <DetailRow label="Level" value={cls.level} palette={palette} />
              <DetailRow label="Academic year" value={cls.academic_year} palette={palette} />
              <DetailRow label="Term" value={cls.term} palette={palette} />
              <DetailRow label="Start date" value={cls.start_date} palette={palette} />
              <DetailRow label="End date" value={cls.end_date} palette={palette} />
              <DetailRow label="Capacity" value={cls.seat_limit} palette={palette} />
              <DetailRow label="Visibility" value={cls.visibility} palette={palette} />
              <KISButton
                title="Edit Details"
                variant="secondary"
                onPress={() => navigation.navigate('EducationClassForm', { institutionId, institutionName, classId })}
              />
            </View>
          ) : null}

          {tab === 'courses' ? (
            <View style={{ gap: 10 }}>
              <EducationActionButton
                palette={palette}
                label="+ Add Course"
                onPress={() => navigation.navigate('EducationCourseBuilder', { institutionId, institutionName, presetInstitutionClassId: classId })}
              />
              {(payload?.courses ?? []).length === 0 ? (
                <EducationEmptyState palette={palette} title="No courses yet" description="Add a course under this class." />
              ) : (
                (payload.courses ?? []).map((course: any) => (
                  <EducationListCard
                    key={course.id}
                    palette={palette}
                    title={course.title}
                    subtitle={course.summary || course.description || 'No description yet.'}
                    statusLabel={course.status}
                    statusTone={course.status === 'published' ? 'success' : 'muted'}
                    onPress={() => navigation.push('EducationCourseBuilder', { institutionId, institutionName, courseId: course.id })}
                  />
                ))
              )}
            </View>
          ) : null}

          {tab === 'learners' ? (
            <View style={{ gap: 10 }}>
              {(payload?.enrollments ?? []).length === 0 ? (
                <EducationEmptyState palette={palette} title="No learners yet" description="Enrollments for this class will appear here." />
              ) : (
                (payload.enrollments ?? []).map((enrollment: any) => (
                  <EducationListCard
                    key={enrollment.id}
                    palette={palette}
                    avatarLabel={enrollment.display_name || enrollment.phone || 'Learner'}
                    avatarUrl={enrollment.avatar_url}
                    title={enrollment.display_name || enrollment.phone || 'Learner'}
                    subtitle={enrollment.phone || undefined}
                    statusLabel={enrollment.status}
                    statusTone={enrollment.status === 'enrolled' ? 'success' : 'muted'}
                  />
                ))
              )}
              <EducationActionButton
                palette={palette}
                label="Manage all learners"
                variant="ghost"
                onPress={() => navigation.navigate('EducationLearners', { institutionId, institutionName })}
              />
            </View>
          ) : null}

          {tab === 'staff' ? (
            <View style={{ gap: 10 }}>
              {(payload?.staff_assignments ?? []).length === 0 ? (
                <EducationEmptyState palette={palette} title="No staff assigned" description="Assign instructors to this class from Learners." />
              ) : (
                (payload.staff_assignments ?? []).map((assignment: any) => (
                  <EducationListCard
                    key={assignment.id}
                    palette={palette}
                    title={assignment.display_name || assignment.user_id}
                    subtitle={assignment.role}
                    statusLabel={assignment.status}
                    statusTone={assignment.status === 'active' ? 'success' : 'muted'}
                  />
                ))
              )}
              <EducationActionButton
                palette={palette}
                label="Manage all staff"
                variant="ghost"
                onPress={() => navigation.navigate('EducationLearners', { institutionId, institutionName })}
              />
            </View>
          ) : null}

          {tab === 'events' ? (
            <View style={{ gap: 10 }}>
              {(payload?.events ?? []).length === 0 ? (
                <EducationEmptyState palette={palette} title="No events yet" description="Events from this class's courses will appear here." />
              ) : (
                (payload.events ?? []).map((event: any) => (
                  <EducationListCard key={event.id} palette={palette} title={event.title} subtitle={event.summary} />
                ))
              )}
              <EducationActionButton
                palette={palette}
                label="Manage all events"
                variant="ghost"
                onPress={() => navigation.navigate('EducationEventsLive', { institutionId, institutionName })}
              />
            </View>
          ) : null}

          {tab === 'broadcast' ? (
            <View style={{ gap: 12 }}>
              <Text style={{ color: palette.subtext, fontSize: 13 }}>
                Broadcasting publishes this Class through Education discovery. Removing it from broadcast does not
                delete the Class — it only stops it from being surfaced.
              </Text>
              <View style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.border, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: activeBroadcast ? palette.primary : palette.border }} />
                  <Text style={{ fontWeight: '800', color: palette.text, flex: 1 }}>
                    {activeBroadcast ? 'Currently broadcasting' : 'Not currently broadcasting'}
                  </Text>
                </View>
                <KISButton
                  title={togglingBroadcast ? '…' : activeBroadcast ? 'Remove from Broadcast' : 'Broadcast'}
                  variant={activeBroadcast ? 'secondary' : 'primary'}
                  disabled={togglingBroadcast}
                  onPress={() => void toggleBroadcast()}
                />
              </View>
            </View>
          ) : null}

          {tab === 'settings' ? (
            <View style={{ gap: 12 }}>
              <DetailRow label="Status" value={cls.status} palette={palette} />
              <DetailRow label="Visibility" value={cls.visibility} palette={palette} />
              <KISButton title="Edit Details" variant="secondary" onPress={() => navigation.navigate('EducationClassForm', { institutionId, institutionName, classId })} />
              <Text style={{ fontSize: 13, fontWeight: '800', color: palette.text, marginTop: 10 }}>Danger zone</Text>
              <KISButton title="Delete Class" variant="secondary" onPress={deleteClass} />
            </View>
          ) : null}
        </ScrollView>
      </EducationScreenScaffold>
    </SafeAreaView>
  );
}

function MetricChip({ label, value, palette }: { label: string; value: number | string; palette: any }) {
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: palette.border, minWidth: 90 }}>
      <Text style={{ fontSize: 11, color: palette.subtext, fontWeight: '700' }}>{label}</Text>
      <Text style={{ fontSize: 18, color: palette.text, fontWeight: '900' }}>{value}</Text>
    </View>
  );
}

function DetailRow({ label, value, palette }: { label: string; value: any; palette: any }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: palette.subtext, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right' }}>{String(value)}</Text>
    </View>
  );
}
