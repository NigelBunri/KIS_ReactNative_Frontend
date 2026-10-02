// src/screens/education/provider/LearnersScreen.tsx
//
// Education UX v2 — consolidated "Learners" destination, replacing four
// separate module-list modes inside EducationManagementModal.tsx
// (students, staff, memberships, course-access-requests) with one screen
// grouped by task: Requests (needs a decision), Students, Staff.
//
// Visual pass: rebuilt on the shared premium education component kit.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import type { RootStackParamList } from '@/navigation/types';
import {
  EducationScreenScaffold,
  EducationListCard,
  EducationEmptyState,
  EducationActionButton,
} from '@/screens/education/shared/components';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route_ = RouteProp<RootStackParamList, 'EducationLearners'>;

const STAFF_ROLES = new Set(['lecturer', 'academic_staff', 'administrator', 'manager', 'owner']);

type SubTab = 'requests' | 'students' | 'staff';

export default function LearnersScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route_>();
  const { institutionId, institutionName } = route.params;
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [memberships, setMemberships] = useState<any[]>([]);
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<SubTab>('requests');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [membershipsRes, requestsRes] = await Promise.all([
        getRequest(ROUTES.broadcasts.educationInstitutionMemberships(institutionId), { forceNetwork: true }),
        getRequest(`${ROUTES.broadcasts.educationInstitutionCourseAccessRequests(institutionId)}?status=pending`, { forceNetwork: true }),
      ]);
      setMemberships(membershipsRes?.data?.memberships ?? []);
      setAccessRequests(requestsRes?.data?.access_requests ?? []);
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pendingMemberships = useMemo(() => memberships.filter(m => m.status === 'pending'), [memberships]);
  const students = useMemo(() => memberships.filter(m => m.role === 'student' && m.status === 'active'), [memberships]);
  const staff = useMemo(() => memberships.filter(m => STAFF_ROLES.has(m.role) && m.role !== 'owner' && m.status === 'active'), [memberships]);
  const requestCount = pendingMemberships.length + accessRequests.length;

  const decideMembership = useCallback(
    async (membershipId: string, action: 'approve' | 'reject') => {
      setBusyId(membershipId);
      try {
        const response = await postRequest(
          ROUTES.broadcasts.educationInstitutionMembershipAction(institutionId, membershipId),
          { action },
          { errorMessage: 'Unable to update this request.' },
        );
        if (response?.success) await load();
      } finally {
        setBusyId(null);
      }
    },
    [institutionId, load],
  );

  const decideAccessRequest = useCallback(
    async (courseId: string, requestId: string, action: 'approve' | 'reject') => {
      setBusyId(requestId);
      try {
        const response = await postRequest(
          ROUTES.broadcasts.educationCourseAccessRequestAction(courseId, requestId),
          { action },
          { errorMessage: 'Unable to update this request.' },
        );
        if (response?.success) await load();
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const renderRequests = () => (
    <View style={{ gap: 10 }}>
      {pendingMemberships.map(m => (
        <EducationListCard
          key={m.id}
          palette={palette}
          avatarLabel={m.display_name || m.phone || 'Applicant'}
          avatarUrl={m.avatar_url}
          title={m.display_name || m.phone || 'Applicant'}
          subtitle={`Wants to join as ${m.role}`}
          primaryAction={<EducationActionButton palette={palette} label="Approve" disabled={busyId === m.id} onPress={() => void decideMembership(m.id, 'approve')} />}
          secondaryAction={<EducationActionButton palette={palette} label="Reject" variant="secondary" disabled={busyId === m.id} onPress={() => void decideMembership(m.id, 'reject')} />}
        />
      ))}
      {accessRequests.map((r: any) => (
        <EducationListCard
          key={r.id}
          palette={palette}
          avatarLabel={r.display_name || 'Learner'}
          avatarUrl={r.avatar_url}
          title={r.display_name || 'Learner'}
          subtitle={`Requesting access to ${r.course_title}`}
          primaryAction={<EducationActionButton palette={palette} label="Approve" disabled={busyId === r.id} onPress={() => void decideAccessRequest(r.course_id, r.id, 'approve')} />}
          secondaryAction={<EducationActionButton palette={palette} label="Reject" variant="secondary" disabled={busyId === r.id} onPress={() => void decideAccessRequest(r.course_id, r.id, 'reject')} />}
        />
      ))}
      {requestCount === 0 && !loading ? (
        <EducationEmptyState palette={palette} title="All caught up" description="Nothing needs your attention right now." />
      ) : null}
    </View>
  );

  const renderPeople = (rows: any[], emptyLabel: string) => (
    <View style={{ gap: 10 }}>
      {rows.map(m => (
        <EducationListCard
          key={m.id}
          palette={palette}
          avatarLabel={m.display_name || m.phone}
          avatarUrl={m.avatar_url}
          title={m.display_name || m.phone}
          subtitle={`${m.role}${m.title ? ` · ${m.title}` : ''}`}
        />
      ))}
      {rows.length === 0 && !loading ? (
        <EducationEmptyState palette={palette} title="Nobody here yet" description={emptyLabel} />
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <EducationScreenScaffold
        palette={palette}
        breadcrumb={institutionName}
        title="Learners"
        onBack={() => navigation.goBack()}
        scrollable={false}
        contentContainerStyle={{ flex: 1, padding: 0 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: responsive.pageGutter, gap: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={palette.primary} />}
        >
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([
              { key: 'requests' as const, title: `Requests${requestCount ? ` (${requestCount})` : ''}` },
              { key: 'students' as const, title: `Students (${students.length})` },
              { key: 'staff' as const, title: `Staff (${staff.length})` },
            ]).map(t => (
              <Pressable
                key={t.key}
                onPress={() => setSubTab(t.key)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: subTab === t.key ? palette.primary : palette.border,
                  backgroundColor: subTab === t.key ? palette.primarySoft : 'transparent',
                }}
              >
                <Text style={{ fontWeight: '700', fontSize: 12, color: subTab === t.key ? palette.primaryStrong : palette.subtext }}>{t.title}</Text>
              </Pressable>
            ))}
          </View>

          {loading && memberships.length === 0 ? <ActivityIndicator color={palette.primary} /> : null}

          {subTab === 'requests' ? renderRequests() : null}
          {subTab === 'students' ? renderPeople(students, "Your institution doesn't have learners yet.") : null}
          {subTab === 'staff' ? renderPeople(staff, 'No staff members yet.') : null}
        </ScrollView>
      </EducationScreenScaffold>
    </SafeAreaView>
  );
}
