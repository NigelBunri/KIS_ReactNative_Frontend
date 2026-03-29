import React, { useCallback, useEffect, useState } from 'react';
import { Alert, DeviceEventEmitter, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import BibleSectionCard from './BibleSectionCard';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import BibleCourseDetailSheet from './BibleCourseDetailSheet';

type Course = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  duration_minutes?: number;
  is_bible_course?: boolean;
  is_free?: boolean;
  price_amount?: string | null;
  price_currency?: string;
  lessons?: any[];
  is_enrolled?: boolean;
  enrollment_id?: string | null;
  enrollment_status?: string | null;
  enrollment_progress?: number | null;
};

export default function BibleLessonsPanel() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const [bibleCourses, setBibleCourses] = useState<Course[]>([]);
  const [partnerCourses, setPartnerCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const hasKcniPartnerLessons = partnerCourses.length > 0;

  const normalizeCourse = useCallback((course: Course) => ({
    ...course,
    is_free:
      typeof course.is_free === 'boolean'
        ? course.is_free
        : course.price_amount === null ||
          course.price_amount === undefined ||
          String(course.price_amount) === '0',
  }), []);

  const loadCourses = useCallback(async () => {
    const [bibleRes, partnerRes] = await Promise.all([
      getRequest(`${ROUTES.bible.courses}?scope=bible`, { errorMessage: 'Unable to load Bible courses.' }),
      getRequest(`${ROUTES.bible.courses}?scope=partner`, { errorMessage: 'Unable to load partner courses.' }),
    ]);
    const biblePayload = bibleRes?.data?.results ?? bibleRes?.data ?? [];
    const partnerPayload = partnerRes?.data?.results ?? partnerRes?.data ?? [];
    const bibleList = Array.isArray(biblePayload) ? biblePayload : [];
    const partnerList = Array.isArray(partnerPayload) ? partnerPayload : [];
    setBibleCourses(bibleList.map(normalizeCourse));
    setPartnerCourses(partnerList.map(normalizeCourse));
  }, [normalizeCourse]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const openCourse = (course: Course) => {
    setSelectedCourse(course);
    setDetailVisible(true);
  };

  const handleEnroll = async (course: Course) => {
    const normalized = normalizeCourse(course);
    if (!normalized.is_free) {
      openCourse(normalized);
      return;
    }
    const res = await postRequest(
      ROUTES.bible.enrollments,
      { course: normalized.id },
      { errorMessage: 'Unable to enroll.' },
    );
    if (!res?.success) {
      Alert.alert('Courses', res?.message || 'Unable to enroll.');
      return;
    }
    const enrollmentId = res?.data?.id ?? res?.data?.enrollment_id ?? res?.data?.enrollmentId;
    const nextCourse = {
      ...normalized,
      is_enrolled: true,
      enrollment_id: enrollmentId,
    };
    setBibleCourses((prev) => prev.map((c) => (c.id === normalized.id ? nextCourse : c)));
    setPartnerCourses((prev) => prev.map((c) => (c.id === normalized.id ? nextCourse : c)));
    Alert.alert('Courses', 'You are now enrolled.');
    openCourse(nextCourse);
  };

  const handleRequireBilling = (course: Course) => {
    DeviceEventEmitter.emit('wallet.open', {
      mode: 'cash_to_credits',
      amount: course.price_amount ?? '',
    });
    navigation.navigate('Profile' as never);
  };

  const renderCourse = (course: Course) => {
    const completed =
      course.enrollment_status === 'completed' ||
      Number(course.enrollment_progress || 0) >= 100;
    const progressValue = Math.max(0, Math.min(100, Number(course.enrollment_progress || 0)));
    const priceLabel = course.is_free ? 'Free' : `${course.price_amount ?? ''} ${course.price_currency ?? ''}`.trim();
    const priceTone = palette.subtext;
    return (
      <Pressable
        key={course.id}
        onPress={() => openCourse(course)}
        style={[
          styles.courseCard,
          { borderColor: palette.divider, backgroundColor: palette.surface },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.text, fontWeight: '800', fontSize: 16 }}>{course.title}</Text>
            <Text style={{ color: palette.subtext, marginTop: 4 }} numberOfLines={2}>
              {course.subtitle || course.description}
            </Text>
          </View>
          <View style={[styles.pricePill, { backgroundColor: palette.surfaceElevated }]}>
            <Text style={{ color: priceTone, fontWeight: '700', fontSize: 11 }}>{priceLabel}</Text>
          </View>
        </View>

        <Text style={{ color: palette.text, marginTop: 6 }} numberOfLines={3}>
          {course.description}
        </Text>
        <View style={styles.metaRow}>
          <Text style={{ color: palette.subtext }}>
            {course.duration_minutes ?? 0} mins
          </Text>
          <Text style={{ color: palette.subtext }}>•</Text>
          <Text style={{ color: palette.subtext }}>{course.lessons?.length ?? 0} lessons</Text>
        </View>

        <View style={styles.badgeRow}>
          <Text style={[styles.badge, { backgroundColor: palette.surfaceElevated }]}>Video</Text>
          <Text style={[styles.badge, { backgroundColor: palette.surfaceElevated }]}>Audio</Text>
          <Text style={[styles.badge, { backgroundColor: palette.surfaceElevated }]}>Text</Text>
          <Text style={[styles.badge, { backgroundColor: palette.surfaceElevated }]}>Images</Text>
          <Text style={[styles.badge, { backgroundColor: palette.surfaceElevated }]}>PDF/DOC</Text>
        </View>

        {course.is_enrolled ? (
          <View style={styles.progressRow}>
            <View style={[styles.progressTrack, { backgroundColor: palette.borderMuted }]}>
              <View style={[styles.progressFill, { width: `${progressValue}%`, backgroundColor: palette.subtext }]} />
            </View>
            <Text style={{ color: palette.subtext, fontSize: 11 }}>{progressValue}%</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
          {!completed ? (
            <KISButton
              title={course.is_enrolled ? 'Continue' : course.is_free ? 'Enroll' : 'View'}
              size="xs"
              textStyle={{ fontSize: 12 }}
              onPress={() => (course.is_enrolled ? openCourse(course) : handleEnroll(course))}
              variant={course.is_enrolled ? 'outline' : course.is_free ? 'primary' : 'outline'}
            />
          ) : (
            <View style={[styles.statusPill, { backgroundColor: palette.surfaceElevated }]}>
              <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700' }}>Completed</Text>
            </View>
          )}
          <KISButton
            title="Details"
            size="xs"
            textStyle={{ fontSize: 12 }}
            variant="ghost"
            onPress={() => openCourse(course)}
          />
        </View>
      </Pressable>
    );
  };

  return (
    <BibleSectionCard>
      <Text style={[styles.title, { color: palette.text }]}>Bible lessons & courses</Text>
      <Text style={{ color: palette.subtext, marginBottom: 8 }}>
        Bible courses are available only from the KCNI partner. Other partners can publish general lessons.
      </Text>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Bible courses</Text>
        <Text style={{ color: palette.subtext, fontSize: 12 }}>{bibleCourses.length} courses</Text>
      </View>
      <View style={{ gap: 12 }}>
        {bibleCourses.map(renderCourse)}
      </View>

      {hasKcniPartnerLessons ? (
        <>
          <View style={[styles.sectionHeader, { marginTop: 16 }]}> 
            <Text style={[styles.sectionTitle, { color: palette.text }]}>KCNI partner lessons</Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>{partnerCourses.length} courses</Text>
          </View>
          <Text style={{ color: palette.subtext }}>
            Member-only lessons for KCNI partners. Paid lessons show pricing.
          </Text>
          <View style={{ gap: 12 }}>
            {partnerCourses.map(renderCourse)}
          </View>
        </>
      ) : (
        <Text style={{ color: palette.subtext, marginTop: 12 }}>
          Join the KCNI partner to access KCNI lessons.
        </Text>
      )}

      <BibleCourseDetailSheet
        visible={detailVisible}
        course={selectedCourse}
        onClose={() => setDetailVisible(false)}
        onCourseUpdate={(updated) => {
          setBibleCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          setPartnerCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          setSelectedCourse(updated);
        }}
        onRequireBilling={handleRequireBilling}
      />
    </BibleSectionCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  courseCard: { borderWidth: 2, borderRadius: 16, padding: 14, gap: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, fontSize: 11 },
  pricePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  progressTrack: { flex: 1, height: 6, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 999 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
});
