// src/screens/education/provider/InstitutionDashboardScreen.tsx
//
// Education UX v2 — real "Institution Dashboard" destination, replacing
// the `screen === 'dashboard'` internal state inside
// EducationManagementModal.tsx (left in place; its create/edit forms for
// the deepest per-record CRUD are still reached from here rather than
// reimplemented — see CourseBuilderScreen and the v2 architecture note).
// Organized around attention/action per the v2 brief, not a flat list of
// every backend entity.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon, type KISIconName } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route_ = RouteProp<RootStackParamList, 'EducationInstitutionDashboard'>;

function StatTile({ label, value }: { label: string; value: number | string }) {
  const { palette } = useKISTheme();
  return (
    <View style={{ flex: 1, minWidth: 100, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: 12, gap: 4 }}>
      <Text style={{ fontSize: 20, fontWeight: '900', color: palette.text }}>{value}</Text>
      <Text style={{ fontSize: 12, color: palette.subtext, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, title, onPress }: { icon: KISIconName; title: string; onPress: () => void }) {
  const { palette } = useKISTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, minWidth: 140, alignItems: 'center', gap: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <KISIcon name={icon} size={18} color={palette.primaryStrong} />
      </View>
      <Text style={{ fontWeight: '700', color: palette.text, textAlign: 'center', fontSize: 13 }}>{title}</Text>
    </Pressable>
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
  const needsAttention = (metrics.pending_application_count || 0) + (metrics.pending_course_access_request_count || 0);
  const name = payload?.institution?.name || institutionName || 'Institution';

  if (loading && !payload) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: responsive.pageGutter, gap: 22, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(true)} tintColor={palette.primary} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 4, marginLeft: -4 }}>
            <KISIcon name="back" size={20} color={palette.text} />
          </Pressable>
          <Text style={{ fontSize: 22, fontWeight: '900', color: palette.text }} numberOfLines={1}>
            {name}
          </Text>
        </View>

        {needsAttention > 0 ? (
          <Pressable
            onPress={() => navigation.navigate('EducationLearners', { institutionId, institutionName: name })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, backgroundColor: palette.primarySoft, borderWidth: 1, borderColor: palette.primary }}
          >
            <KISIcon name="warning" size={18} color={palette.primaryStrong} />
            <Text style={{ color: palette.primaryStrong, fontWeight: '800', flex: 1 }}>
              {needsAttention} item{needsAttention === 1 ? '' : 's'} need your attention
            </Text>
            <KISIcon name="chevron-right" size={16} color={palette.primaryStrong} />
          </Pressable>
        ) : null}

        <View>
          <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text, marginBottom: 10 }}>Overview</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <StatTile label="Courses" value={metrics.course_count ?? 0} />
            <StatTile label="Students" value={metrics.active_student_count ?? 0} />
            <StatTile label="Enrollments" value={metrics.enrollment_count ?? 0} />
            <StatTile label="Bookings" value={metrics.booking_count ?? 0} />
          </View>
        </View>

        <View>
          <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text, marginBottom: 10 }}>Quick actions</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <QuickAction icon="add" title="Create course" onPress={() => navigation.navigate('EducationCourseBuilder', { institutionId, institutionName: name })} />
            <QuickAction icon="list" title="Courses" onPress={() => navigation.navigate('EducationCourses', { institutionId, institutionName: name })} />
            <QuickAction icon="people" title="Learners" onPress={() => navigation.navigate('EducationLearners', { institutionId, institutionName: name })} />
            <QuickAction icon="calendar" title="Events & Live" onPress={() => navigation.navigate('EducationEventsLive', { institutionId, institutionName: name })} />
            <QuickAction icon="settings" title="Settings" onPress={() => navigation.navigate('EducationInstitutionSettings', { institutionId, institutionName: name })} />
          </View>
        </View>

        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>Recent courses</Text>
            <KISButton title="See all" size="sm" variant="ghost" onPress={() => navigation.navigate('EducationCourses', { institutionId, institutionName: name })} />
          </View>
          {recentCourses.length === 0 ? (
            <View style={{ padding: 18, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, alignItems: 'center', gap: 8 }}>
              <Text style={{ color: palette.subtext, fontWeight: '600', textAlign: 'center' }}>
                You haven't created any courses yet.
              </Text>
              <KISButton title="Create course" size="sm" onPress={() => navigation.navigate('EducationCourseBuilder', { institutionId, institutionName: name })} />
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {recentCourses.map((course: any) => (
                <Pressable
                  key={course.id}
                  onPress={() => navigation.navigate('EducationCourseBuilder', { institutionId, institutionName: name, courseId: course.id })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: palette.text }} numberOfLines={1}>{course.title}</Text>
                    <Text style={{ fontSize: 12, color: palette.subtext, textTransform: 'capitalize' }}>{course.status}</Text>
                  </View>
                  <KISIcon name="chevron-right" size={16} color={palette.subtext} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
