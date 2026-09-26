// src/screens/education/provider/LearnersScreen.tsx
//
// Education UX v2 — consolidated "Learners" destination, replacing four
// separate module-list modes inside EducationManagementModal.tsx
// (students, staff, memberships, course-access-requests) with one screen
// grouped by task: Requests (needs a decision), Students, Staff.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import type { RootStackParamList } from '@/navigation/types';

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
        <View key={m.id} style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, gap: 8 }}>
          <Text style={{ fontWeight: '800', color: palette.text }}>{m.display_name || m.phone || 'Applicant'}</Text>
          <Text style={{ fontSize: 12, color: palette.subtext }}>Wants to join as {m.role}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <KISButton title="Approve" size="sm" disabled={busyId === m.id} onPress={() => void decideMembership(m.id, 'approve')} />
            <KISButton title="Reject" size="sm" variant="outline" disabled={busyId === m.id} onPress={() => void decideMembership(m.id, 'reject')} />
          </View>
        </View>
      ))}
      {accessRequests.map((r: any) => (
        <View key={r.id} style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, gap: 8 }}>
          <Text style={{ fontWeight: '800', color: palette.text }}>{r.display_name || 'Learner'}</Text>
          <Text style={{ fontSize: 12, color: palette.subtext }}>Requesting access to {r.course_title}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <KISButton title="Approve" size="sm" disabled={busyId === r.id} onPress={() => void decideAccessRequest(r.course_id, r.id, 'approve')} />
            <KISButton title="Reject" size="sm" variant="outline" disabled={busyId === r.id} onPress={() => void decideAccessRequest(r.course_id, r.id, 'reject')} />
          </View>
        </View>
      ))}
      {requestCount === 0 && !loading ? (
        <View style={{ padding: 18, alignItems: 'center' }}>
          <Text style={{ color: palette.subtext, textAlign: 'center' }}>Nothing needs your attention right now.</Text>
        </View>
      ) : null}
    </View>
  );

  const renderPeople = (rows: any[], emptyLabel: string) => (
    <View style={{ gap: 8 }}>
      {rows.map(m => (
        <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <KISIcon name="person" size={16} color={palette.primaryStrong} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: palette.text }} numberOfLines={1}>{m.display_name || m.phone}</Text>
            <Text style={{ fontSize: 12, color: palette.subtext, textTransform: 'capitalize' }}>{m.role}{m.title ? ` · ${m.title}` : ''}</Text>
          </View>
        </View>
      ))}
      {rows.length === 0 && !loading ? (
        <View style={{ padding: 18, alignItems: 'center' }}>
          <Text style={{ color: palette.subtext, textAlign: 'center' }}>{emptyLabel}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: responsive.pageGutter, gap: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={palette.primary} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 4, marginLeft: -4 }}>
            <KISIcon name="back" size={20} color={palette.text} />
          </Pressable>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: palette.text }}>Learners</Text>
            {institutionName ? <Text style={{ fontSize: 12, color: palette.subtext }}>{institutionName}</Text> : null}
          </View>
        </View>

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
    </SafeAreaView>
  );
}
