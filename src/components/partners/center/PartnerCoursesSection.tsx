import React, { useCallback, useEffect, useState } from 'react';
import { Alert, DeviceEventEmitter, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import styles from '@/components/partners/partnersStyles';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { Partner } from '@/components/partners/partnersTypes';
import KISButton from '@/constants/KISButton';
import BibleCourseDetailSheet from '@/components/Bible/BibleCourseDetailSheet';

const emptyMessage = 'Courses will appear here once your partner publishes lessons.';

export default function PartnerCoursesSection({ partner }: { partner: Partner }) {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const [bibleCourses, setBibleCourses] = useState<any[]>([]);
  const [partnerCourses, setPartnerCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const isCcPartner = (partner?.name ?? '').toLowerCase().includes('christian community');

  const normalizeCourse = useCallback((course: any) => ({
    ...course,
    is_free:
      typeof course.is_free === 'boolean'
        ? course.is_free
        : course.price_amount === null ||
          course.price_amount === undefined ||
          String(course.price_amount) === '0',
  }), []);

  const loadCourses = useCallback(async () => {
    if (!partner?.id) return;
    const partnerRes = await getRequest(`${ROUTES.bible.courses}?partner=${partner.id}&scope=partner`, {
      errorMessage: 'Unable to load partner courses.',
    });
    const partnerPayload = partnerRes?.data?.results ?? partnerRes?.data ?? [];
    const partnerList = Array.isArray(partnerPayload) ? partnerPayload : [];
    setPartnerCourses(partnerList.map(normalizeCourse));

    if (isCcPartner) {
      const bibleRes = await getRequest(`${ROUTES.bible.courses}?scope=bible`, {
        errorMessage: 'Unable to load Bible courses.',
      });
      const biblePayload = bibleRes?.data?.results ?? bibleRes?.data ?? [];
      const bibleList = Array.isArray(biblePayload) ? biblePayload : [];
      setBibleCourses(bibleList.map(normalizeCourse));
    } else {
      setBibleCourses([]);
    }
  }, [isCcPartner, normalizeCourse, partner?.id]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const openCourse = (course: any) => {
    setSelectedCourse(course);
    setDetailVisible(true);
  };

  const handleEnroll = async (course: any) => {
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

  const handleRequireBilling = (course: any) => {
    DeviceEventEmitter.emit('wallet.open', {
      mode: 'add_kisc',
      amount: course.price_amount ?? '',
    });
    navigation.navigate('Profile' as never);
  };

  const renderCourse = (course: any) => {
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
          styles.groupRow,
          courseStyles.card,
          { borderColor: palette.borderMuted, backgroundColor: palette.surface },
        ]}
      >
        <View style={{ flex: 1 }}>
          <View style={courseStyles.titleRow}>
            <Text style={{ color: palette.text, fontWeight: '700' }} numberOfLines={1}>
              {course.title}
            </Text>
            <View style={[courseStyles.pricePill, { backgroundColor: palette.surfaceElevated }]}>
              <Text style={{ color: priceTone, fontSize: 11, fontWeight: '700' }}>{priceLabel}</Text>
            </View>
          </View>
          <Text style={{ color: palette.subtext, fontSize: 12 }} numberOfLines={2}>
            {course.subtitle || course.description}
          </Text>
          {course.is_enrolled ? (
            <View style={courseStyles.progressRow}>
              <View style={[courseStyles.progressTrack, { backgroundColor: palette.borderMuted }]}>
                <View
                  style={[
                    courseStyles.progressFill,
                    { width: `${progressValue}%`, backgroundColor: palette.subtext },
                  ]}
                />
              </View>
              <Text style={{ color: palette.subtext, fontSize: 11 }}>{progressValue}%</Text>
            </View>
          ) : null}
        </View>
        {!completed ? (
        <KISButton
          title={course.is_enrolled ? 'Continue' : course.is_free ? 'Enroll' : 'View'}
          size="xs"
          textStyle={{ fontSize: 12 }}
          variant={course.is_enrolled ? 'outline' : course.is_free ? 'primary' : 'outline'}
          onPress={() => (course.is_enrolled ? openCourse(course) : handleEnroll(course))}
        />
        ) : (
          <View style={[courseStyles.statusPill, { backgroundColor: palette.surfaceElevated }]}>
            <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700' }}>Completed</Text>
          </View>
        )}
      </Pressable>
    );
  };

  const hasCourses = bibleCourses.length > 0 || partnerCourses.length > 0;

  return (
    <View style={{ marginTop: 6, gap: 10 }}>
      {isCcPartner && bibleCourses.length > 0 ? (
        <>
          <View style={courseStyles.sectionHeader}>
            <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>Bible courses</Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>{bibleCourses.length} courses</Text>
          </View>
          {bibleCourses.map(renderCourse)}
        </>
      ) : null}

      {partnerCourses.length > 0 ? (
        <>
          <View style={courseStyles.sectionHeader}>
            <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>Partner lessons</Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>{partnerCourses.length} courses</Text>
          </View>
          {partnerCourses.map(renderCourse)}
        </>
      ) : null}

      {!hasCourses ? (
        <Pressable style={[styles.groupRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}
        >
          <Text style={{ color: palette.subtext, fontSize: 12 }}>{emptyMessage}</Text>
        </Pressable>
      ) : null}

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
    </View>
  );
}

const courseStyles = StyleSheet.create({
  card: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pricePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
});
