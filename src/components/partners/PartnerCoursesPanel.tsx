import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import styles from '@/components/partners/partnersStyles';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

const emptyCourse = {
  title: '',
  subtitle: '',
  description: '',
  is_bible_course: false,
  is_free: true,
};

const emptyLesson = {
  course: '',
  title: '',
  summary: '',
  content: '',
  transcript: '',
  captions_url: '',
  language: 'en',
  duration_minutes: '10',
  attachments: '',
};

const emptyQuiz = {
  course: '',
  lesson: '',
  title: '',
  description: '',
  pass_score: '70',
  attempts_allowed: '3',
};

const emptyQuestion = {
  quiz: '',
  prompt: '',
  kind: 'single_choice',
  points: '1',
  choices: '',
  correct: '',
};

const emptyAssignment = {
  course: '',
  lesson: '',
  title: '',
  description: '',
  max_points: '100',
  rubric: '',
};

const emptyPrerequisite = {
  course: '',
  required_course: '',
  required_percent: '100',
};

const emptyTrack = {
  title: '',
  description: '',
};

const emptyLive = {
  course: '',
  title: '',
  description: '',
  start_at: '',
  meeting_url: '',
};

const emptyBundle = {
  title: '',
  description: '',
  price_amount: '0',
  price_currency: 'USD',
  is_active: true,
};

const emptyBundleItem = {
  bundle: '',
  course: '',
  order: '1',
};

const emptyCoupon = {
  code: '',
  course: '',
  bundle: '',
  percent_off: '0',
  amount_off: '0',
  max_redemptions: '0',
  valid_until: '',
  is_active: true,
};

const emptySeatPool = {
  course: '',
  seats_total: '0',
  expires_at: '',
};

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  partnerName?: string | null;
  onClose: () => void;
};

export default function PartnerCoursesPanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  partnerId,
  partnerName,
  onClose,
}: Props) {
  const { palette } = useKISTheme();
  const [courses, setCourses] = useState<any[]>([]);
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [lessonForm, setLessonForm] = useState(emptyLesson);
  const [quizForm, setQuizForm] = useState(emptyQuiz);
  const [questionForm, setQuestionForm] = useState(emptyQuestion);
  const [assignmentForm, setAssignmentForm] = useState(emptyAssignment);
  const [prerequisiteForm, setPrerequisiteForm] = useState(emptyPrerequisite);
  const [trackForm, setTrackForm] = useState(emptyTrack);
  const [liveForm, setLiveForm] = useState(emptyLive);
  const [bundleForm, setBundleForm] = useState(emptyBundle);
  const [bundleItemForm, setBundleItemForm] = useState(emptyBundleItem);
  const [couponForm, setCouponForm] = useState(emptyCoupon);
  const [seatPoolForm, setSeatPoolForm] = useState(emptySeatPool);
  const normalizedPartnerName = (partnerName ?? '').toLowerCase();
  const isKcniPartner =
    normalizedPartnerName.includes('kcni') || normalizedPartnerName.includes('christian community');

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const loadCourses = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(`${ROUTES.bible.courses}?partner=${partnerId}`, {
      errorMessage: 'Unable to load courses.',
    });
    const payload = res?.data?.results ?? res?.data ?? [];
    setCourses(Array.isArray(payload) ? payload : []);
  }, [partnerId]);

  useEffect(() => {
    if (isOpen) {
      loadCourses();
    }
  }, [isOpen, loadCourses]);

  useEffect(() => {
    if (!isKcniPartner && courseForm.is_bible_course) {
      setCourseForm((prev) => ({ ...prev, is_bible_course: false }));
    }
  }, [isKcniPartner, courseForm.is_bible_course]);

  const createCourse = async () => {
    if (!partnerId) return;
    if (!courseForm.title) {
      Alert.alert('Course', 'Title is required.');
      return;
    }
    const res = await postRequest(
      ROUTES.bible.courses,
      {
        partner: partnerId,
        title: courseForm.title,
        subtitle: courseForm.subtitle,
        description: courseForm.description,
        is_bible_course: isKcniPartner ? courseForm.is_bible_course : false,
        is_free: courseForm.is_free,
      },
      { errorMessage: 'Unable to create course.' },
    );
    if (res?.success) {
      setCourseForm(emptyCourse);
      loadCourses();
    }
  };

  const createLesson = async () => {
    if (!lessonForm.course || !lessonForm.title) {
      Alert.alert('Lesson', 'Course and title are required.');
      return;
    }
    const attachments = lessonForm.attachments
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((url) => ({ url }));
    const res = await postRequest(
      ROUTES.bible.lessons,
      {
        course: lessonForm.course,
        title: lessonForm.title,
        summary: lessonForm.summary,
        content: lessonForm.content,
        transcript: lessonForm.transcript,
        captions_url: lessonForm.captions_url,
        language: lessonForm.language,
        duration_minutes: Number(lessonForm.duration_minutes || 10),
        order: 1,
        is_free: true,
        attachments,
      },
      { errorMessage: 'Unable to create lesson.' },
    );
    if (res?.success) {
      setLessonForm(emptyLesson);
      loadCourses();
    }
  };

  const createQuiz = async () => {
    if (!quizForm.course || !quizForm.title) {
      Alert.alert('Quiz', 'Course and title are required.');
      return;
    }
    const res = await postRequest(
      ROUTES.bible.quizzes,
      {
        course: quizForm.course,
        lesson: quizForm.lesson || null,
        title: quizForm.title,
        description: quizForm.description,
        pass_score: Number(quizForm.pass_score || 70),
        attempts_allowed: Number(quizForm.attempts_allowed || 3),
      },
      { errorMessage: 'Unable to create quiz.' },
    );
    if (res?.success) {
      setQuizForm(emptyQuiz);
    }
  };

  const createQuestion = async () => {
    if (!questionForm.quiz || !questionForm.prompt) {
      Alert.alert('Question', 'Quiz and prompt are required.');
      return;
    }
    const res = await postRequest(
      ROUTES.bible.quizQuestions,
      {
        quiz: questionForm.quiz,
        prompt: questionForm.prompt,
        kind: questionForm.kind,
        points: Number(questionForm.points || 1),
        order: 1,
      },
      { errorMessage: 'Unable to create question.' },
    );
    if (!res?.success) return;
    const questionId = res?.data?.id;
    const choices = questionForm.choices
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const correct = questionForm.correct
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    for (let i = 0; i < choices.length; i += 1) {
      const text = choices[i];
      const isCorrect =
        correct.includes(String(i + 1)) ||
        correct.includes(text);
      await postRequest(
        ROUTES.bible.quizChoices,
        { question: questionId, text, is_correct: isCorrect },
        { errorMessage: 'Unable to create choice.' },
      );
    }
    setQuestionForm(emptyQuestion);
  };

  const createAssignment = async () => {
    if (!assignmentForm.course || !assignmentForm.title) {
      Alert.alert('Assignment', 'Course and title are required.');
      return;
    }
    const rubric = assignmentForm.rubric
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [label, points] = item.split(':');
        return {
          title: label?.trim() || item,
          points: Number(points || 10),
        };
      });
    const res = await postRequest(
      ROUTES.bible.assignments,
      {
        course: assignmentForm.course,
        lesson: assignmentForm.lesson || null,
        title: assignmentForm.title,
        description: assignmentForm.description,
        max_points: Number(assignmentForm.max_points || 100),
        rubric,
      },
      { errorMessage: 'Unable to create assignment.' },
    );
    if (res?.success) {
      setAssignmentForm(emptyAssignment);
    }
  };

  const createPrerequisite = async () => {
    if (!prerequisiteForm.course || !prerequisiteForm.required_course) {
      Alert.alert('Prerequisite', 'Course and required course are required.');
      return;
    }
    const res = await postRequest(
      ROUTES.bible.coursePrerequisites,
      {
        course: prerequisiteForm.course,
        required_course: prerequisiteForm.required_course,
        required_percent: Number(prerequisiteForm.required_percent || 100),
      },
      { errorMessage: 'Unable to add prerequisite.' },
    );
    if (res?.success) {
      setPrerequisiteForm(emptyPrerequisite);
    }
  };

  const createTrack = async () => {
    if (!partnerId || !trackForm.title) {
      Alert.alert('Track', 'Title is required.');
      return;
    }
    const res = await postRequest(
      ROUTES.bible.courseTracks,
      {
        partner: partnerId,
        title: trackForm.title,
        description: trackForm.description,
      },
      { errorMessage: 'Unable to create track.' },
    );
    if (res?.success) {
      setTrackForm(emptyTrack);
    }
  };

  const createLiveSession = async () => {
    if (!liveForm.course || !liveForm.title || !liveForm.start_at) {
      Alert.alert('Live session', 'Course, title, and start time are required.');
      return;
    }
    const res = await postRequest(
      ROUTES.bible.liveSessions,
      {
        course: liveForm.course,
        title: liveForm.title,
        description: liveForm.description,
        start_at: liveForm.start_at,
        meeting_url: liveForm.meeting_url,
      },
      { errorMessage: 'Unable to create live session.' },
    );
    if (res?.success) {
      setLiveForm(emptyLive);
    }
  };

  const createBundle = async () => {
    if (!partnerId || !bundleForm.title) {
      Alert.alert('Bundle', 'Partner and title are required.');
      return;
    }
    const res = await postRequest(
      ROUTES.bible.courseBundles,
      {
        partner: partnerId,
        title: bundleForm.title,
        description: bundleForm.description,
        price_amount: Number(bundleForm.price_amount || 0),
        price_currency: bundleForm.price_currency || 'USD',
        is_active: bundleForm.is_active,
      },
      { errorMessage: 'Unable to create bundle.' },
    );
    if (res?.success) {
      setBundleForm(emptyBundle);
    }
  };

  const createBundleItem = async () => {
    if (!bundleItemForm.bundle || !bundleItemForm.course) {
      Alert.alert('Bundle item', 'Bundle and course are required.');
      return;
    }
    const res = await postRequest(
      ROUTES.bible.courseBundleItems,
      {
        bundle: bundleItemForm.bundle,
        course: bundleItemForm.course,
        order: Number(bundleItemForm.order || 1),
      },
      { errorMessage: 'Unable to add bundle item.' },
    );
    if (res?.success) {
      setBundleItemForm(emptyBundleItem);
    }
  };

  const createCoupon = async () => {
    if (!couponForm.code || (!couponForm.course && !couponForm.bundle)) {
      Alert.alert('Coupon', 'Code and course or bundle are required.');
      return;
    }
    const res = await postRequest(
      ROUTES.bible.courseCoupons,
      {
        code: couponForm.code.trim(),
        course: couponForm.course || null,
        bundle: couponForm.bundle || null,
        percent_off: Number(couponForm.percent_off || 0),
        amount_off: Number(couponForm.amount_off || 0),
        max_redemptions: Number(couponForm.max_redemptions || 0),
        valid_until: couponForm.valid_until || null,
        is_active: couponForm.is_active,
      },
      { errorMessage: 'Unable to create coupon.' },
    );
    if (res?.success) {
      setCouponForm(emptyCoupon);
    }
  };

  const createSeatPool = async () => {
    if (!partnerId || !seatPoolForm.seats_total) {
      Alert.alert('Seat pool', 'Partner and seat count are required.');
      return;
    }
    const res = await postRequest(
      ROUTES.bible.courseSeatPools,
      {
        partner: partnerId,
        course: seatPoolForm.course || null,
        seats_total: Number(seatPoolForm.seats_total || 0),
        expires_at: seatPoolForm.expires_at || null,
      },
      { errorMessage: 'Unable to create seat pool.' },
    );
    if (res?.success) {
      setSeatPoolForm(emptySeatPool);
    }
  };

  const courseOptions = useMemo(
    () => courses.map((course) => ({ id: course.id, title: course.title })),
    [courses],
  );

  if (!isOpen) return null;

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.settingsPanelBackdrop,
          { backgroundColor: palette.backdrop, opacity: backdropOpacity },
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          {
            width: panelWidth,
            backgroundColor: palette.surfaceElevated,
            borderLeftColor: palette.divider,
            transform: [{ translateX: panelTranslateX }],
          },
        ]}
      >
        <View
          style={[
            styles.settingsPanelHeader,
            { borderBottomColor: palette.divider },
          ]}
        >
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Learning courses</Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>Build Bible courses and partner lessons for members.</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody}>
          <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}
          >
            <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>Create a course</Text>
            <TextInput
              value={courseForm.title}
              onChangeText={(value) => setCourseForm((prev) => ({ ...prev, title: value }))}
              placeholder="Course title"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={courseForm.subtitle}
              onChangeText={(value) => setCourseForm((prev) => ({ ...prev, subtitle: value }))}
              placeholder="Subtitle"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={courseForm.description}
              onChangeText={(value) => setCourseForm((prev) => ({ ...prev, description: value }))}
              placeholder="Description"
              placeholderTextColor={palette.subtext}
              multiline
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text, minHeight: 80 }]}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {isKcniPartner ? (
              <KISButton
                title={courseForm.is_bible_course ? 'Bible Course' : 'Partner Course'}
                size="sm"
                variant="outline"
                onPress={() => setCourseForm((prev) => ({ ...prev, is_bible_course: !prev.is_bible_course }))}
              />
            ) : (
              <View style={{ justifyContent: 'center' }}>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Bible courses are KCNI only.
                </Text>
              </View>
            )}
              <KISButton
                title={courseForm.is_free ? 'Free' : 'Paid'}
                size="sm"
                variant="outline"
                onPress={() => setCourseForm((prev) => ({ ...prev, is_free: !prev.is_free }))}
              />
            </View>
            <KISButton title="Create course" onPress={createCourse} />
          </View>

          <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}
          >
            <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>Add a lesson</Text>
            <Text style={{ color: palette.subtext, marginBottom: 6 }}>
              Choose a course and add a lesson outline.
            </Text>
            <TextInput
              value={lessonForm.course}
              onChangeText={(value) => setLessonForm((prev) => ({ ...prev, course: value }))}
              placeholder={courseOptions.length ? `Course ID (e.g., ${courseOptions[0].id})` : 'Course ID'}
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={lessonForm.title}
              onChangeText={(value) => setLessonForm((prev) => ({ ...prev, title: value }))}
              placeholder="Lesson title"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={lessonForm.summary}
              onChangeText={(value) => setLessonForm((prev) => ({ ...prev, summary: value }))}
              placeholder="Lesson summary"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={lessonForm.content}
              onChangeText={(value) => setLessonForm((prev) => ({ ...prev, content: value }))}
              placeholder="Lesson content"
              placeholderTextColor={palette.subtext}
              multiline
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text, minHeight: 80 }]}
            />
            <TextInput
              value={lessonForm.transcript}
              onChangeText={(value) => setLessonForm((prev) => ({ ...prev, transcript: value }))}
              placeholder="Transcript (optional)"
              placeholderTextColor={palette.subtext}
              multiline
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text, minHeight: 80 }]}
            />
            <TextInput
              value={lessonForm.captions_url}
              onChangeText={(value) => setLessonForm((prev) => ({ ...prev, captions_url: value }))}
              placeholder="Captions URL (optional)"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={lessonForm.language}
              onChangeText={(value) => setLessonForm((prev) => ({ ...prev, language: value }))}
              placeholder="Language (e.g., en, fr)"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={lessonForm.attachments}
              onChangeText={(value) => setLessonForm((prev) => ({ ...prev, attachments: value }))}
              placeholder="Attachment URLs (comma separated)"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <KISButton title="Add lesson" onPress={createLesson} />
          </View>

          <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}
          >
            <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>Create a quiz or exam</Text>
            <TextInput
              value={quizForm.course}
              onChangeText={(value) => setQuizForm((prev) => ({ ...prev, course: value }))}
              placeholder="Course ID"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={quizForm.lesson}
              onChangeText={(value) => setQuizForm((prev) => ({ ...prev, lesson: value }))}
              placeholder="Lesson ID (optional)"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={quizForm.title}
              onChangeText={(value) => setQuizForm((prev) => ({ ...prev, title: value }))}
              placeholder="Quiz title"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={quizForm.description}
              onChangeText={(value) => setQuizForm((prev) => ({ ...prev, description: value }))}
              placeholder="Quiz description"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={quizForm.pass_score}
                onChangeText={(value) => setQuizForm((prev) => ({ ...prev, pass_score: value }))}
                placeholder="Pass score"
                placeholderTextColor={palette.subtext}
                style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text, flex: 1 }]}
              />
              <TextInput
                value={quizForm.attempts_allowed}
                onChangeText={(value) => setQuizForm((prev) => ({ ...prev, attempts_allowed: value }))}
                placeholder="Attempts"
                placeholderTextColor={palette.subtext}
                style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text, flex: 1 }]}
              />
            </View>
            <KISButton title="Create quiz" onPress={createQuiz} />
          </View>

          <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}
          >
            <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>Add quiz question</Text>
            <TextInput
              value={questionForm.quiz}
              onChangeText={(value) => setQuestionForm((prev) => ({ ...prev, quiz: value }))}
              placeholder="Quiz ID"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={questionForm.prompt}
              onChangeText={(value) => setQuestionForm((prev) => ({ ...prev, prompt: value }))}
              placeholder="Question prompt"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={questionForm.kind}
              onChangeText={(value) => setQuestionForm((prev) => ({ ...prev, kind: value }))}
              placeholder="Kind (single_choice, multiple_choice, true_false, short_answer)"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={questionForm.points}
              onChangeText={(value) => setQuestionForm((prev) => ({ ...prev, points: value }))}
              placeholder="Points"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={questionForm.choices}
              onChangeText={(value) => setQuestionForm((prev) => ({ ...prev, choices: value }))}
              placeholder="Choices (comma separated)"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={questionForm.correct}
              onChangeText={(value) => setQuestionForm((prev) => ({ ...prev, correct: value }))}
              placeholder="Correct choices (comma separated, index or text)"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <KISButton title="Create question" onPress={createQuestion} />
          </View>

          <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}
          >
            <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>Create assignment</Text>
            <TextInput
              value={assignmentForm.course}
              onChangeText={(value) => setAssignmentForm((prev) => ({ ...prev, course: value }))}
              placeholder="Course ID"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={assignmentForm.lesson}
              onChangeText={(value) => setAssignmentForm((prev) => ({ ...prev, lesson: value }))}
              placeholder="Lesson ID (optional)"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={assignmentForm.title}
              onChangeText={(value) => setAssignmentForm((prev) => ({ ...prev, title: value }))}
              placeholder="Assignment title"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={assignmentForm.description}
              onChangeText={(value) => setAssignmentForm((prev) => ({ ...prev, description: value }))}
              placeholder="Assignment description"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text, minHeight: 60 }]}
            />
            <TextInput
              value={assignmentForm.max_points}
              onChangeText={(value) => setAssignmentForm((prev) => ({ ...prev, max_points: value }))}
              placeholder="Max points"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={assignmentForm.rubric}
              onChangeText={(value) => setAssignmentForm((prev) => ({ ...prev, rubric: value }))}
              placeholder="Rubric (criterion:points, comma separated)"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <KISButton title="Create assignment" onPress={createAssignment} />
          </View>

          <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}
          >
            <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>Add prerequisites</Text>
            <TextInput
              value={prerequisiteForm.course}
              onChangeText={(value) => setPrerequisiteForm((prev) => ({ ...prev, course: value }))}
              placeholder="Course ID"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={prerequisiteForm.required_course}
              onChangeText={(value) => setPrerequisiteForm((prev) => ({ ...prev, required_course: value }))}
              placeholder="Required course ID"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={prerequisiteForm.required_percent}
              onChangeText={(value) => setPrerequisiteForm((prev) => ({ ...prev, required_percent: value }))}
              placeholder="Required completion %"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <KISButton title="Add prerequisite" onPress={createPrerequisite} />
          </View>

          <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}
          >
            <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>Create course track</Text>
            <TextInput
              value={trackForm.title}
              onChangeText={(value) => setTrackForm((prev) => ({ ...prev, title: value }))}
              placeholder="Track title"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={trackForm.description}
              onChangeText={(value) => setTrackForm((prev) => ({ ...prev, description: value }))}
              placeholder="Track description"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <KISButton title="Create track" onPress={createTrack} />
          </View>

          <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}
          >
            <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>Schedule live session</Text>
            <TextInput
              value={liveForm.course}
              onChangeText={(value) => setLiveForm((prev) => ({ ...prev, course: value }))}
              placeholder="Course ID"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={liveForm.title}
              onChangeText={(value) => setLiveForm((prev) => ({ ...prev, title: value }))}
              placeholder="Session title"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={liveForm.description}
              onChangeText={(value) => setLiveForm((prev) => ({ ...prev, description: value }))}
              placeholder="Session description"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={liveForm.start_at}
              onChangeText={(value) => setLiveForm((prev) => ({ ...prev, start_at: value }))}
              placeholder="Start time (YYYY-MM-DD HH:MM)"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={liveForm.meeting_url}
              onChangeText={(value) => setLiveForm((prev) => ({ ...prev, meeting_url: value }))}
              placeholder="Meeting URL"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <KISButton title="Create live session" onPress={createLiveSession} />
          </View>

          <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}
          >
            <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>Create a bundle</Text>
            <TextInput
              value={bundleForm.title}
              onChangeText={(value) => setBundleForm((prev) => ({ ...prev, title: value }))}
              placeholder="Bundle title"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={bundleForm.description}
              onChangeText={(value) => setBundleForm((prev) => ({ ...prev, description: value }))}
              placeholder="Bundle description"
              placeholderTextColor={palette.subtext}
              multiline
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text, minHeight: 80 }]}
            />
            <TextInput
              value={bundleForm.price_amount}
              onChangeText={(value) => setBundleForm((prev) => ({ ...prev, price_amount: value }))}
              placeholder="Bundle price"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={bundleForm.price_currency}
              onChangeText={(value) => setBundleForm((prev) => ({ ...prev, price_currency: value }))}
              placeholder="Currency (USD)"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <KISButton
                title={bundleForm.is_active ? 'Active' : 'Paused'}
                size="sm"
                variant="outline"
                onPress={() => setBundleForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
              />
            </View>
            <KISButton title="Create bundle" onPress={createBundle} />
          </View>

          <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}
          >
            <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>Add course to bundle</Text>
            <TextInput
              value={bundleItemForm.bundle}
              onChangeText={(value) => setBundleItemForm((prev) => ({ ...prev, bundle: value }))}
              placeholder="Bundle ID"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={bundleItemForm.course}
              onChangeText={(value) => setBundleItemForm((prev) => ({ ...prev, course: value }))}
              placeholder={courseOptions.length ? `Course ID (e.g., ${courseOptions[0].id})` : 'Course ID'}
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={bundleItemForm.order}
              onChangeText={(value) => setBundleItemForm((prev) => ({ ...prev, order: value }))}
              placeholder="Order"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <KISButton title="Add bundle item" onPress={createBundleItem} />
          </View>

          <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}
          >
            <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>Create coupon</Text>
            <TextInput
              value={couponForm.code}
              onChangeText={(value) => setCouponForm((prev) => ({ ...prev, code: value }))}
              placeholder="Coupon code"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={couponForm.course}
              onChangeText={(value) => setCouponForm((prev) => ({ ...prev, course: value }))}
              placeholder="Course ID (optional)"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={couponForm.bundle}
              onChangeText={(value) => setCouponForm((prev) => ({ ...prev, bundle: value }))}
              placeholder="Bundle ID (optional)"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={couponForm.percent_off}
              onChangeText={(value) => setCouponForm((prev) => ({ ...prev, percent_off: value }))}
              placeholder="Percent off"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={couponForm.amount_off}
              onChangeText={(value) => setCouponForm((prev) => ({ ...prev, amount_off: value }))}
              placeholder="Amount off"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={couponForm.max_redemptions}
              onChangeText={(value) => setCouponForm((prev) => ({ ...prev, max_redemptions: value }))}
              placeholder="Max redemptions"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={couponForm.valid_until}
              onChangeText={(value) => setCouponForm((prev) => ({ ...prev, valid_until: value }))}
              placeholder="Valid until (YYYY-MM-DD)"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <KISButton
                title={couponForm.is_active ? 'Active' : 'Inactive'}
                size="sm"
                variant="outline"
                onPress={() => setCouponForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
              />
            </View>
            <KISButton title="Create coupon" onPress={createCoupon} />
          </View>

          <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}
          >
            <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>Create seat pool</Text>
            <TextInput
              value={seatPoolForm.course}
              onChangeText={(value) => setSeatPoolForm((prev) => ({ ...prev, course: value }))}
              placeholder="Course ID (optional)"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={seatPoolForm.seats_total}
              onChangeText={(value) => setSeatPoolForm((prev) => ({ ...prev, seats_total: value }))}
              placeholder="Seats total"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <TextInput
              value={seatPoolForm.expires_at}
              onChangeText={(value) => setSeatPoolForm((prev) => ({ ...prev, expires_at: value }))}
              placeholder="Expires at (YYYY-MM-DD)"
              placeholderTextColor={palette.subtext}
              style={[styles.settingsTextInput, { borderColor: palette.divider, color: palette.text }]}
            />
            <KISButton title="Create seat pool" onPress={createSeatPool} />
          </View>

          <Text style={[styles.settingsSectionTitle, { color: palette.text }]}>Existing courses</Text>
          <View style={{ gap: 10 }}>
            {courses.map((course) => (
              <View key={course.id} style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}
              >
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>{course.title}</Text>
                <Text style={[styles.settingsFeatureDescription, { color: palette.subtext }]}>
                  {course.subtitle || course.description}
                </Text>
                <Text style={[styles.settingsFeatureMeta, { color: palette.subtext }]}>
                  {course.is_bible_course ? 'Bible course' : 'Partner course'} · {course.is_free ? 'Free' : 'Paid'}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}
