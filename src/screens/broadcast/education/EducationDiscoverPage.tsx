import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import useEducationData from '@/screens/broadcast/education/hooks/useEducationData';
import FeaturedLessonHero from '@/screens/broadcast/education/sections/FeaturedLessonHero';
import PopularCoursesSection from '@/screens/broadcast/education/sections/PopularCoursesSection';
import EducationCategoryPills from '@/screens/broadcast/education/components/EducationCategoryPills';
import EducationWorkshopsSection from '@/screens/broadcast/education/sections/EducationWorkshopsSection';
import BibleCourseDetailSheet from '@/components/Bible/BibleCourseDetailSheet';
import Skeleton from '@/components/common/Skeleton';
import { EducationCourse, EducationLesson, EducationModule } from '@/screens/broadcast/education/api/education.types';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import useEducationTier from '@/screens/broadcast/education/hooks/useEducationTier';

type Props = {
  searchTerm?: string;
  searchContext?: string;
};

const formatCurrency = (amount?: number | null, currency?: string) => {
  if (!amount || amount <= 0) {
    return 'Free';
  }
  const formatted = Number(amount).toFixed(2);
  return `${currency ?? 'USD'} ${formatted}`;
};

const formatStartsAt = (value?: string | null) => {
  if (!value) return 'Starts soon';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Starts soon';
  return date.toLocaleString();
};

const LessonCard = ({
  lesson,
  onEnroll,
  enrolling,
  onOpen,
}: {
  lesson: EducationLesson;
  onEnroll: () => Promise<void>;
  enrolling: boolean;
  onOpen: () => void;
}) => {
  const { palette } = useKISTheme();
  return (
    <View
      style={{
        borderWidth: 2,
        borderColor: palette.divider,
        borderRadius: 18,
        padding: 12,
        backgroundColor: palette.surface,
        gap: 10,
      }}
    >
      <View>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>{lesson.title}</Text>
        {lesson.summary ? (
          <Text style={{ color: palette.subtext, fontWeight: '700', marginTop: 4 }} numberOfLines={2}>
            {lesson.summary}
          </Text>
        ) : null}
        {lesson.partner_name ? (
          <Text style={{ color: palette.primaryStrong, fontWeight: '600', marginTop: 4 }}>
            {lesson.partner_name}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: palette.subtext, fontWeight: '900' }}>{formatStartsAt(lesson.starts_at)}</Text>
        <Text style={{ color: palette.subtext, fontWeight: '900' }}>
          {formatCurrency(lesson.price_cents, lesson.currency ?? undefined)}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <KISButton
          title={enrolling ? 'Enrolling…' : 'Enroll'}
          onPress={onEnroll}
          disabled={enrolling}
          variant="primary"
          size="xs"
        />
        <KISButton title="Open" onPress={onOpen} variant="outline" size="xs" />
      </View>
    </View>
  );
};

const toPrettyCategory = (raw: string | undefined) => {
  if (!raw) return 'General';
  const cleaned = raw.trim().replace(/[_-]+/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

export default function EducationDiscoverPage({ searchTerm = '', searchContext = 'Courses' }: Props) {
  const { palette } = useKISTheme();
  const { home, loading, reload, enrollLesson, updateCourse, broadcastProfiles } = useEducationData({ q: searchTerm });
  const { tierLabel } = useEducationTier();
  const navigation = useNavigation<any>();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<EducationCourse | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [broadcastingCourseId, setBroadcastingCourseId] = useState<string | null>(null);
  const [enrollingLessonId, setEnrollingLessonId] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
  const [partnerFilter, setPartnerFilter] = useState('');
  const modules = home.modules ?? [];
  const showWorkshops = modules.length > 0;
  const partnerOptions = useMemo(() => {
    const list: string[] = [];
    (home.popular_courses ?? []).forEach((course) => {
      if (course.partner_name) list.push(course.partner_name);
    });
    return Array.from(new Set(list));
  }, [home.popular_courses]);
  const levelOptions: Array<'all' | 'beginner' | 'intermediate' | 'advanced'> = ['all', 'beginner', 'intermediate', 'advanced'];

  const contextKey = (searchContext ?? 'Courses').toLowerCase();
  const heroCourse = home.popular_courses?.[0] ?? null;
  const heroLesson = home.live_lessons?.[0] ?? null;
  const heroIsLesson = contextKey === 'lessons';
  const heroCover = heroIsLesson
    ? heroLesson?.public_info?.cover_url ?? null
    : heroCourse?.cover_image ?? heroCourse?.cover_url ?? null;

  const filteredCourses = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const partnerNeedle = partnerFilter.trim().toLowerCase();
    return (home.popular_courses ?? []).filter((course) => {
      if (activeCategoryId && (!course.level || course.level.toLowerCase() !== activeCategoryId)) {
        return false;
      }
      if (levelFilter !== 'all' && (!course.level || course.level.toLowerCase() !== levelFilter)) {
        return false;
      }
      if (partnerNeedle) {
        const partnerName = (course.partner_name ?? course.partner ?? '').toLowerCase();
        if (!partnerName.includes(partnerNeedle)) return false;
      }
      if (!needle) return true;
      return (
        (course.title ?? '').toLowerCase().includes(needle) ||
        (course.subtitle ?? '').toLowerCase().includes(needle) ||
        (course.description ?? '').toLowerCase().includes(needle)
      );
    });
  }, [activeCategoryId, home.popular_courses, searchTerm, levelFilter, partnerFilter]);

  const filteredLessons = useMemo(() => {
    const base = (home.live_lessons ?? []).filter((lesson) => {
      const needle = searchTerm.trim().toLowerCase();
      if (!needle) return true;
      return (
        (lesson.title ?? '').toLowerCase().includes(needle) ||
        (lesson.summary ?? '').toLowerCase().includes(needle) ||
        (lesson.partner_name ?? '').toLowerCase().includes(needle)
      );
    });
    return base;
  }, [home.live_lessons, searchTerm]);

  const showLessons = contextKey === 'lessons' || contextKey === 'workshops' || !contextKey;
  const showCourses = contextKey !== 'lessons';

  const educationProfilesList = useMemo(
    () => broadcastProfiles?.education_profiles ?? [],
    [broadcastProfiles?.education_profiles],
  );
  const hasEducationProfile = Boolean(broadcastProfiles?.education);
  const openEducationProfile = useCallback(() => {
    navigation.navigate('Profile', {
      broadcastProfileKey: 'education',
      educationProfileId: educationProfilesList?.[0]?.id,
    });
  }, [navigation, educationProfilesList]);

  const handleCourseSelect = useCallback((course: EducationCourse) => {
    setSelectedCourse(course);
    setDetailVisible(true);
  }, []);

  const handleBroadcastCourse = useCallback(async (course: EducationCourse) => {
    if (!course?.id) return;
    setBroadcastingCourseId(course.id);
    const payload = {
      course_id: course.id,
      metadata: {
        id: course.id,
        title: course.title,
        summary: course.subtitle ?? course.description,
        cover_image: course.cover_image ?? course.cover_url,
        price_amount: course.price_amount,
        price_currency: course.price_currency,
        partner_id: course.partner,
        partner_name: course.partner_name,
        source: course.source ?? (course.is_custom ? 'education_profile' : 'bible_course'),
      },
    };

    try {
      const res = await postRequest(ROUTES.broadcasts.educationCourseBroadcast, payload, {
        errorMessage: 'Unable to broadcast course.',
      });
      if (res?.success) {
        Alert.alert('Broadcast', 'Course added to broadcasts.');
        DeviceEventEmitter.emit('broadcast.refresh');
      } else {
        Alert.alert('Broadcast', res?.message || 'Unable to broadcast course.');
      }
    } catch (error: any) {
      Alert.alert('Broadcast', error?.message || 'Unable to broadcast course.');
    } finally {
      setBroadcastingCourseId(null);
    }
  }, []);

  const handleEnrollLesson = useCallback(
    async (lessonId: string) => {
      setEnrollingLessonId(lessonId);
      const result = await enrollLesson(lessonId);
      setEnrollingLessonId(null);
      if (result.ok) {
        Alert.alert('Lesson', 'Enrolled successfully.');
      } else {
        Alert.alert('Lesson', 'Unable to enroll at this time.');
      }
    },
    [enrollLesson],
  );

  const openLessonUrl = useCallback(async (lesson?: EducationLesson | null) => {
    if (!lesson?.lesson_url) {
      Alert.alert('Lesson', 'No lesson URL available.');
      return;
    }
    const canOpen = await Linking.canOpenURL(lesson.lesson_url);
    if (!canOpen) {
      Alert.alert('Lesson', 'Unable to open lesson URL.');
      return;
    }
    Linking.openURL(lesson.lesson_url);
  }, []);

  const handleOpenModuleResource = useCallback(async (module?: EducationModule | null) => {
    if (!module?.resource_url) {
      Alert.alert('Workshop', 'No resource link is available for this module yet.');
      return;
    }
    const canOpen = await Linking.canOpenURL(module.resource_url);
    if (!canOpen) {
      Alert.alert('Workshop', 'Unable to open the provided resource link.');
      return;
    }
    Linking.openURL(module.resource_url);
  }, []);

  const heroTitle = heroIsLesson ? heroLesson?.title ?? 'Upcoming Lesson' : heroCourse?.title ?? 'Education';
  const heroSubtitle = heroIsLesson
    ? heroLesson?.summary ?? heroLesson?.public_info?.tagline
    : heroCourse?.subtitle ?? heroCourse?.description;
  const heroBadgeLeft = heroIsLesson
    ? formatStartsAt(heroLesson?.starts_at)
    : heroCourse?.level
      ? `${toPrettyCategory(heroCourse.level)} course`
      : 'Featured course';
  const heroBadgeRight = heroIsLesson ? 'Join lesson' : 'View course';

  const heroOnPress = heroIsLesson
    ? () => openLessonUrl(heroLesson)
    : () => heroCourse && handleCourseSelect(heroCourse);


  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 160 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={palette.primary} />}
    >
      <View style={{ paddingHorizontal: 12, gap: 12 }}>
        {heroCourse || heroLesson ? (
          <FeaturedLessonHero
            title={heroTitle}
            subtitle={heroSubtitle}
            coverUrl={heroCover}
            badgeLeft={heroBadgeLeft}
            badgeRight={heroBadgeRight}
            onPress={heroOnPress}
          />
        ) : loading ? (
          <View style={{ borderWidth: 2, borderColor: palette.divider, borderRadius: 18 }}>
            <Skeleton height={22} radius={10} />
            <Skeleton height={140} radius={16} style={{ marginTop: 10 }} />
          </View>
        ) : null}

        <View
          style={{
            borderWidth: 2,
            borderColor: palette.divider,
            borderRadius: 22,
            backgroundColor: palette.card,
            padding: 12,
            gap: 10,
          }}
        >
          <Text style={{ color: palette.text, fontWeight: '900' }}>Filters</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {levelOptions.map((level) => (
                <Pressable
                  key={level}
                  onPress={() => setLevelFilter(level)}
                  style={{
                    borderWidth: 2,
                    borderColor: levelFilter === level ? palette.primary : palette.divider,
                    borderRadius: 18,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    backgroundColor: levelFilter === level ? palette.primarySoft : palette.surface,
                  }}
                >
                  <Text
                    style={{
                      color: levelFilter === level ? palette.primaryStrong : palette.text,
                      fontWeight: '700',
                    }}
                  >
                    {level === 'all' ? 'All levels' : level.charAt(0).toUpperCase() + level.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <KISTextInput
            label="Partner filter"
            value={partnerFilter}
            onChangeText={setPartnerFilter}
            placeholder="Partner or school name..."
          />
          {partnerOptions.length ? (
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              Partners: {partnerOptions.slice(0, 3).join(', ')}
              {partnerOptions.length > 3 ? '...' : ''}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            borderWidth: 2,
            borderColor: palette.divider,
            backgroundColor: palette.card,
            borderRadius: 22,
            padding: 12,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Education</Text>
            <Text
              onPress={reload}
              style={{ color: palette.subtext, fontWeight: '900' }}
              suppressHighlighting
            >
              {loading ? 'Loading…' : 'Refresh'}
            </Text>
          </View>

          <EducationCategoryPills
            items={home.categories ?? []}
            activeId={activeCategoryId}
            onSelect={setActiveCategoryId}
          />
          {hasEducationProfile ? (
            <KISButton
              title="Manage education profile"
              size="sm"
              variant="outline"
              onPress={openEducationProfile}
            />
          ) : null}
        </View>

        {showCourses && (
          <>
            <View
              style={{
                borderWidth: 2,
                borderColor: palette.divider,
                backgroundColor: palette.card,
                borderRadius: 22,
                padding: 12,
                gap: 12,
              }}
            >
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Paid courses require {tierLabel ?? 'Business Pro'} tier or higher.
              </Text>
              <PopularCoursesSection
                title="Featured courses"
                items={filteredCourses}
                onSeeAll={() => {}}
                onEnroll={(courseId) => {
                  const course = home.popular_courses?.find((c) => c.id === courseId);
                  if (course) {
                    handleCourseSelect(course);
                  }
                }}
                onBroadcast={(course) => handleBroadcastCourse(course)}
                broadcastingCourseId={broadcastingCourseId}
              />
            </View>
            {showWorkshops ? (
              <View
                style={{
                  borderWidth: 2,
                  borderColor: palette.divider,
                  backgroundColor: palette.card,
                  borderRadius: 22,
                  padding: 12,
                  gap: 12,
                }}
              >
                <EducationWorkshopsSection
                  items={modules}
                  onOpenResource={handleOpenModuleResource}
                />
              </View>
            ) : (
              <View
                style={{
                  borderWidth: 2,
                  borderColor: palette.divider,
                  backgroundColor: palette.card,
                  borderRadius: 22,
                  padding: 12,
                  gap: 8,
                }}
              >
                <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>
                  No workshops yet
                </Text>
                <Text style={{ color: palette.subtext }}>
                  Create your education profile under Broadcast profiles to share modules and workshops.
                </Text>
                <KISButton title="Open Broadcast profiles" onPress={openEducationProfile} />
              </View>
            )}
          </>
        )}

        {showLessons && (
          <View
            style={{
              borderWidth: 2,
              borderColor: palette.divider,
              backgroundColor: palette.card,
              borderRadius: 22,
              padding: 12,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Live lessons</Text>
              {loading ? <ActivityIndicator color={palette.primary} /> : null}
            </View>
            {filteredLessons.length === 0 ? (
              <Text style={{ color: palette.subtext }}>No lessons yet.</Text>
            ) : (
              filteredLessons.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  onEnroll={() => handleEnrollLesson(lesson.id)}
                  enrolling={enrollingLessonId === lesson.id}
                  onOpen={() => openLessonUrl(lesson)}
                />
              ))
            )}
          </View>
        )}
      </View>

      <BibleCourseDetailSheet
        visible={detailVisible}
        course={selectedCourse as any}
        onClose={() => {
          setDetailVisible(false);
          setSelectedCourse(null);
        }}
        onCourseUpdate={(updated) => {
          updateCourse(updated as any);
          setSelectedCourse(updated as any);
        }}
      />
    </ScrollView>
  );
}
