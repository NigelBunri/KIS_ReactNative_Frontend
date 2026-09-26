// src/screens/education/provider/CoursesListScreen.tsx
//
// Education UX v2 — real "Courses" destination (All / Published / Drafts),
// replacing the generic module-list's "courses" mode inside
// EducationManagementModal.tsx.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import type { RootStackParamList } from '@/navigation/types';

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
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg }}>
      <FlatList
        data={filtered}
        keyExtractor={row => row.id}
        contentContainerStyle={{ padding: responsive.pageGutter, gap: 10, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={palette.primary} />}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable onPress={() => navigation.goBack()} style={{ padding: 4, marginLeft: -4 }}>
                <KISIcon name="back" size={20} color={palette.text} />
              </Pressable>
              <Text style={{ fontSize: 22, fontWeight: '900', color: palette.text }} numberOfLines={1}>
                Courses
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
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
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={{ padding: 24, alignItems: 'center', gap: 10 }}>
              <Text style={{ color: palette.subtext, textAlign: 'center', fontWeight: '600' }}>
                No {tab === 'all' ? '' : tab} courses yet.
              </Text>
              <KISButton title="Create course" size="sm" onPress={() => navigation.navigate('EducationCourseBuilder', { institutionId, institutionName })} />
            </View>
          ) : (
            <ActivityIndicator color={palette.primary} style={{ marginTop: 30 }} />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('EducationCourseBuilder', { institutionId, institutionName, courseId: item.id })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: palette.text }} numberOfLines={1}>{item.title}</Text>
              <Text style={{ fontSize: 12, color: palette.subtext }}>
                {item.price_amount > 0 ? `${item.price_amount} ${item.price_currency ?? ''}` : 'Free'} · {item.seat_limit ?? '∞'} seats
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: item.status === 'published' ? palette.primarySoft : palette.border,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: item.status === 'published' ? palette.primaryStrong : palette.subtext, textTransform: 'capitalize' }}>
                {item.status}
              </Text>
            </View>
          </Pressable>
        )}
      />
      <View style={{ position: 'absolute', right: responsive.pageGutter, bottom: 24 }}>
        <KISButton title="+ Create course" onPress={() => navigation.navigate('EducationCourseBuilder', { institutionId, institutionName })} />
      </View>
    </SafeAreaView>
  );
}
