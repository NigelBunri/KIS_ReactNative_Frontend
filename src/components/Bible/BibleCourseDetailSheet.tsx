import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import Pdf from 'react-native-pdf';
import RNFS from 'react-native-fs';
import { useNavigation } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES, {
  API_BASE_URL,
  buildMediaSource,
  useMediaHeaders,
} from '@/network';
import { getAccessToken } from '@/security/authStorage';

type Course = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  duration_minutes?: number;
  is_bible_course?: boolean;
  is_public?: boolean;
  is_free?: boolean;
  price_amount?: string | null;
  price_currency?: string;
  lessons?: any[];
  reaction_count?: number;
  comment_count?: number;
  share_count?: number;
  viewer_reaction?: string | null;
  is_enrolled?: boolean;
  enrollment_id?: string | null;
  enrollment_status?: string | null;
  enrollment_progress?: number | null;
  enrollment_paid?: boolean;
};

type Props = {
  visible: boolean;
  course: Course | null;
  onClose: () => void;
  onCourseUpdate?: (course: Course) => void;
  onRequireBilling?: (course: Course) => void;
};

export default function BibleCourseDetailSheet({
  visible,
  course,
  onClose,
  onCourseUpdate,
  onRequireBilling,
}: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [courseState, setCourseState] = useState<Course | null>(course);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [activeLesson, setActiveLesson] = useState<any | null>(null);
  const [lessonDetailVisible, setLessonDetailVisible] = useState(false);
  const [lessonReactions, setLessonReactions] = useState<Record<string, { count: number; reacted: boolean }>>({});
  const [lessonCommentCounts, setLessonCommentCounts] = useState<Record<string, number>>({});
  const [lessonComments, setLessonComments] = useState<any[]>([]);
  const [lessonCommentDraft, setLessonCommentDraft] = useState('');
  const [certificateVisible, setCertificateVisible] = useState(false);
  const [certificateAuth, setCertificateAuth] = useState<string | null>(null);
  const [certificateToken, setCertificateToken] = useState<string | null>(null);
  const [certificateLocalUri, setCertificateLocalUri] = useState<string | null>(null);
  const [certificateLoading, setCertificateLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [credential, setCredential] = useState<any | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [quizVisible, setQuizVisible] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, any>>({});
  const mediaHeaders = useMediaHeaders();
  const [quizResult, setQuizResult] = useState<any | null>(null);
  const [assignmentVisible, setAssignmentVisible] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState<any | null>(null);
  const [assignmentText, setAssignmentText] = useState('');
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const lastProgressRef = useRef<Record<string, number>>({});
  const mediaRef = useRef<any>(null);
  const [backgroundPlayback, setBackgroundPlayback] = useState(false);
  const [offlineAssets, setOfflineAssets] = useState<Record<string, string>>({});
  const [forums, setForums] = useState<any | null>(null);
  const [threads, setThreads] = useState<any[]>([]);
  const [threadPosts, setThreadPosts] = useState<any[]>([]);
  const [threadDraft, setThreadDraft] = useState('');
  const [postDraft, setPostDraft] = useState('');
  const [forumVisible, setForumVisible] = useState(false);
  const [threadVisible, setThreadVisible] = useState(false);
  const [activeThread, setActiveThread] = useState<any | null>(null);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, any>>({});
  const [autoAdvanceFor, setAutoAdvanceFor] = useState<string | null>(null);

  useEffect(() => {
    setCourseState(course);
    setLessons([]);
    setComments([]);
    setCommentDraft('');
    setCompletedLessons(new Set());
    setActiveLesson(null);
    setLessonDetailVisible(false);
    setLessonReactions({});
    setLessonCommentCounts({});
    setLessonComments([]);
    setLessonCommentDraft('');
    setCertificateVisible(false);
    setCertificateLocalUri(null);
    setCertificateLoading(false);
    setCouponCode('');
    setCredential(null);
    setRefundLoading(false);
    setQuizzes([]);
    setAssignments([]);
    setQuizVisible(false);
    setActiveQuiz(null);
    setQuizAnswers({});
    setQuizResult(null);
    setAssignmentVisible(false);
    setActiveAssignment(null);
    setAssignmentText('');
    setBackgroundPlayback(false);
    setOfflineAssets({});
    setForums(null);
    setThreads([]);
    setThreadPosts([]);
    setThreadDraft('');
    setPostDraft('');
    setForumVisible(false);
    setThreadVisible(false);
    setActiveThread(null);
    setLiveSessions([]);
    setAttendanceMap({});
    setAutoAdvanceFor(null);
  }, [course]);

  useEffect(() => {
    if (!certificateVisible) return;
    getAccessToken().then((token) => {
      setCertificateToken(token || null);
      setCertificateAuth(token ? `Bearer ${token}` : null);
    });
  }, [certificateVisible]);

  const courseId = courseState?.id;
  const certificateUrl = courseId ? ROUTES.bible.courseCertificate(courseId) : null;
  const certificateFetchUrl =
    certificateUrl && certificateToken ? `${certificateUrl}?token=${encodeURIComponent(certificateToken)}` : certificateUrl;

  useEffect(() => {
    const fetchCertificate = async () => {
      if (!certificateVisible || !certificateFetchUrl) return;
      setCertificateLoading(true);
      setCertificateLocalUri(null);
      try {
        const filePath = `${RNFS.DocumentDirectoryPath}/certificate-${courseId}.pdf`;
        await RNFS.downloadFile({
          fromUrl: certificateFetchUrl,
          toFile: filePath,
          headers: certificateAuth ? { Authorization: certificateAuth } : undefined,
        }).promise;
        setCertificateLocalUri(`file://${filePath}`);
      } catch (err: any) {
        Alert.alert('Certificate', err?.message || 'Unable to load certificate.');
      } finally {
        setCertificateLoading(false);
      }
    };
    fetchCertificate();
  }, [certificateVisible, certificateFetchUrl, certificateAuth, courseId]);

  const loadLessons = useCallback(async () => {
    if (!courseId) return;
    setLoadingLessons(true);
    const res = await getRequest(`${ROUTES.bible.lessons}?course=${courseId}`, {
      errorMessage: 'Unable to load lessons.',
    });
    const payload = res?.data?.results ?? res?.data ?? [];
    const list = Array.isArray(payload) ? payload : [];
    setLessons(list);
    setCompletedLessons(
      new Set(
        list
          .filter((lesson: any) => lesson.completed || lesson.is_completed)
          .map((lesson: any) => String(lesson.id)),
      ),
    );
    const reactionMap: Record<string, { count: number; reacted: boolean }> = {};
    const commentMap: Record<string, number> = {};
    list.forEach((lesson: any) => {
      const id = String(lesson.id);
      reactionMap[id] = {
        count: Number(lesson.reaction_count || lesson.like_count || 0),
        reacted: Boolean(lesson.viewer_reaction || lesson.liked),
      };
      commentMap[id] = Number(lesson.comment_count || 0);
    });
    setLessonReactions(reactionMap);
    setLessonCommentCounts(commentMap);
    setLoadingLessons(false);
  }, [courseId]);

  const loadComments = useCallback(async () => {
    if (!courseId || !courseState?.is_public) return;
    const res = await getRequest(`${ROUTES.bible.courseComments}?course=${courseId}`, {
      errorMessage: 'Unable to load comments.',
    });
    const payload = res?.data?.results ?? res?.data ?? [];
    setComments(Array.isArray(payload) ? payload : []);
  }, [courseId, courseState?.is_public]);

  const loadForum = useCallback(async () => {
    if (!courseId) return;
    const res = await getRequest(`${ROUTES.bible.courseForums}?course=${courseId}`, {
      errorMessage: 'Unable to load forum.',
    });
    const payload = res?.data?.results ?? res?.data ?? [];
    const forum = Array.isArray(payload) ? payload[0] : payload;
    setForums(forum || null);
  }, [courseId]);

  const loadThreads = async (forumId: string) => {
    const res = await getRequest(`${ROUTES.bible.forumThreads}?forum=${forumId}`, {
      errorMessage: 'Unable to load threads.',
    });
    const payload = res?.data?.results ?? res?.data ?? [];
    setThreads(Array.isArray(payload) ? payload : []);
  };

  const loadThreadPosts = async (threadId: string) => {
    const res = await getRequest(`${ROUTES.bible.forumPosts}?thread=${threadId}`, {
      errorMessage: 'Unable to load posts.',
    });
    const payload = res?.data?.results ?? res?.data ?? [];
    setThreadPosts(Array.isArray(payload) ? payload : []);
  };

  const openForum = () => {
    if (!forums) return;
    setForumVisible(true);
    loadThreads(forums.id);
  };

  const createThread = async () => {
    if (!forums || !threadDraft.trim()) return;
    const res = await postRequest(
      ROUTES.bible.forumThreads,
      { forum: forums.id, title: threadDraft.trim() },
      { errorMessage: 'Unable to create thread.' },
    );
    if (res?.success) {
      setThreadDraft('');
      loadThreads(forums.id);
    }
  };

  const openThread = (thread: any) => {
    setActiveThread(thread);
    setThreadVisible(true);
    loadThreadPosts(thread.id);
  };

  const postReply = async () => {
    if (!activeThread || !postDraft.trim()) return;
    const res = await postRequest(
      ROUTES.bible.forumPosts,
      { thread: activeThread.id, content: postDraft.trim() },
      { errorMessage: 'Unable to post reply.' },
    );
    if (res?.success) {
      setPostDraft('');
      loadThreadPosts(activeThread.id);
    }
  };

  const loadLiveSessions = useCallback(async () => {
    if (!courseId) return;
    const res = await getRequest(`${ROUTES.bible.liveSessions}?course=${courseId}`, {
      errorMessage: 'Unable to load live sessions.',
    });
    const payload = res?.data?.results ?? res?.data ?? [];
    setLiveSessions(Array.isArray(payload) ? payload : []);
  }, [courseId]);

  const registerLive = async (sessionId: string) => {
    const res = await postRequest(
      ROUTES.bible.liveAttendance,
      { session: sessionId },
      { errorMessage: 'Unable to register.' },
    );
    if (res?.success) {
      setAttendanceMap((prev) => ({ ...prev, [sessionId]: res.data }));
    }
  };

  const joinLive = async (sessionId: string) => {
    const attendance = attendanceMap[sessionId];
    if (!attendance) return;
    const res = await postRequest(
      ROUTES.bible.liveAttendanceJoin(attendance.id),
      {},
      { errorMessage: 'Unable to join session.' },
    );
    if (res?.success) {
      setAttendanceMap((prev) => ({ ...prev, [sessionId]: res.data }));
    }
  };

  const loadQuizzes = useCallback(async () => {
    if (!courseId) return;
    const res = await getRequest(`${ROUTES.bible.quizzes}?course=${courseId}`, {
      errorMessage: 'Unable to load quizzes.',
    });
    const payload = res?.data?.results ?? res?.data ?? [];
    setQuizzes(Array.isArray(payload) ? payload : []);
  }, [courseId]);

  const loadAssignments = useCallback(async () => {
    if (!courseId) return;
    const res = await getRequest(`${ROUTES.bible.assignments}?course=${courseId}`, {
      errorMessage: 'Unable to load assignments.',
    });
    const payload = res?.data?.results ?? res?.data ?? [];
    setAssignments(Array.isArray(payload) ? payload : []);
  }, [courseId]);

  const loadCredential = useCallback(async () => {
    if (!courseState?.enrollment_id) {
      setCredential(null);
      return;
    }
    const res = await getRequest(ROUTES.bible.credentials, {
      errorMessage: 'Unable to load credentials.',
    });
    const payload = res?.data?.results ?? res?.data ?? [];
    if (!Array.isArray(payload)) {
      setCredential(null);
      return;
    }
    const match = payload.find((item: any) => String(item.enrollment) === String(courseState.enrollment_id));
    setCredential(match ?? null);
  }, [courseState?.enrollment_id]);

  useEffect(() => {
    if (!visible || !courseId) return;
    loadLessons();
    loadComments();
    loadQuizzes();
    loadAssignments();
    loadCredential();
    loadForum();
    loadLiveSessions();
  }, [
    visible,
    courseId,
    loadLessons,
    loadComments,
    loadQuizzes,
    loadAssignments,
    loadCredential,
    loadForum,
    loadLiveSessions,
  ]);

  const updateCourseState = (next: Course) => {
    setCourseState(next);
    onCourseUpdate?.(next);
  };

  const ensureEnrollment = async () => {
    if (!courseState) return null;
    if (courseState.enrollment_id) return courseState.enrollment_id;
    const res = await postRequest(
      ROUTES.bible.enrollments,
      { course: courseState.id },
      { errorMessage: 'Unable to enroll.' },
    );
    if (!res?.success) return null;
    const enrollmentId = res?.data?.id ?? res?.data?.enrollment_id ?? res?.data?.enrollmentId;
    const next = {
      ...courseState,
      is_enrolled: true,
      enrollment_id: enrollmentId,
    };
    updateCourseState(next);
    return enrollmentId as string | null;
  };

  const handleEnrollFree = async () => {
    if (!courseState) return;
    const enrollmentId = await ensureEnrollment();
    if (!enrollmentId) return;
    Alert.alert('Enrolled', 'You can start this course now.');
  };

  const handlePurchase = async () => {
    if (!courseState) return;
    const enrollmentId = await ensureEnrollment();
    if (!enrollmentId) return;
    const res = await postRequest(
      ROUTES.bible.enrollmentPurchase(enrollmentId),
      {
        payment_method: 'credits',
        ...(couponCode.trim() ? { coupon_code: couponCode.trim() } : {}),
      },
      { errorMessage: 'Unable to complete purchase.' },
    );
    if (!res?.success) {
      Alert.alert('Course Payment', res?.message || 'Payment failed.');
      onRequireBilling?.(courseState);
      navigation.navigate('Profile' as never);
      return;
    }
    updateCourseState({
      ...courseState,
      enrollment_paid: true,
      is_enrolled: true,
    });
    setCouponCode('');
    Alert.alert('Payment complete', 'Course unlocked.');
  };

  const handleRequestRefund = async () => {
    if (!courseState?.enrollment_id || refundLoading) return;
    setRefundLoading(true);
    try {
      const res = await postRequest(
        ROUTES.bible.courseRefunds,
        { enrollment: courseState.enrollment_id },
        { errorMessage: 'Unable to request refund.' },
      );
      if (!res?.success) return;
      Alert.alert('Refund', 'Your refund request has been submitted.');
    } finally {
      setRefundLoading(false);
    }
  };

  const handleShareCredential = async () => {
    if (!credential?.id || !courseState) return;
    const res = await getRequest(ROUTES.bible.credentialShare(credential.id), {
      errorMessage: 'Unable to prepare share link.',
    });
    const sharePath = res?.data?.share_url ?? res?.share_url;
    if (!sharePath) {
      Alert.alert('Share', 'Share link not available yet.');
      return;
    }
    const absoluteUrl = sharePath.startsWith('http') ? sharePath : `${API_BASE_URL}${sharePath}`;
    Share.share({
      message: `${courseState.title} certificate: ${absoluteUrl}`,
    });
  };

  const handleCompleteCourse = async () => {
    if (!courseState?.enrollment_id) return;
    const res = await postRequest(
      ROUTES.bible.enrollmentComplete(courseState.enrollment_id),
      {},
      { errorMessage: 'Unable to mark course complete.' },
    );
    if (!res?.success) return;
    updateCourseState({
      ...courseState,
      enrollment_progress: 100,
    });
    loadCredential();
    Alert.alert('Congrats', 'Course marked as completed.');
  };

  const handleLessonComplete = async (lessonId: string) => {
    if (!lessonId) return;
    const res = await postRequest(
      ROUTES.bible.lessonProgress,
      { lesson: lessonId, completed: true },
      { errorMessage: 'Unable to update progress.' },
    );
    if (!res?.success) return;
    setCompletedLessons((prev) => new Set(prev).add(lessonId));
  };

  const handleLessonReact = (lessonId: string) => {
    postRequest(
      ROUTES.bible.lessonReact(lessonId),
      { emoji: '❤️' },
      { errorMessage: 'Unable to react.' },
    ).then((res) => {
      if (!res?.success) return;
      const reacted = res?.data?.reacted ?? res?.reacted;
      const count = res?.data?.count ?? res?.count ?? 0;
      setLessonReactions((prev) => ({
        ...prev,
        [lessonId]: { count, reacted: Boolean(reacted) },
      }));
    });
  };

  const openLessonDetail = (lesson: any) => {
    setActiveLesson(lesson);
    setLessonDetailVisible(true);
    setAutoAdvanceFor(null);
    setLessonComments([]);
    setLessonCommentDraft('');
    setPlaybackRate(1.0);
  };

  const loadLessonComments = async (lessonId: string) => {
    const res = await getRequest(`${ROUTES.bible.lessonComments}?lesson=${lessonId}`, {
      errorMessage: 'Unable to load comments.',
    });
    const payload = res?.data?.results ?? res?.data ?? [];
    setLessonComments(Array.isArray(payload) ? payload : []);
  };

  const submitLessonComment = async (lessonId: string) => {
    const text = lessonCommentDraft.trim();
    if (!text) return;
    const res = await postRequest(
      ROUTES.bible.lessonComments,
      { lesson: lessonId, content: text },
      { errorMessage: 'Unable to post comment.' },
    );
    if (!res?.success) return;
    setLessonCommentDraft('');
    loadLessonComments(lessonId);
    setLessonCommentCounts((prev) => ({
      ...prev,
      [lessonId]: (prev[lessonId] || 0) + 1,
    }));
  };

  const openNextLesson = (lessonId: string) => {
    const index = lessons.findIndex((item) => String(item.id) === lessonId);
    if (index < 0 || index + 1 >= lessons.length) {
      setLessonDetailVisible(false);
      Alert.alert('Lessons', 'You have reached the end of this course.');
      return;
    }
    setActiveLesson(lessons[index + 1]);
    setLessonDetailVisible(true);
    setAutoAdvanceFor(null);
  };

  const handleAutoAdvance = async (lessonId: string) => {
    if (autoAdvanceFor === lessonId) return;
    setAutoAdvanceFor(lessonId);
    if (!completedLessons.has(lessonId)) {
      await handleLessonComplete(lessonId);
    }
    openNextLesson(lessonId);
  };

  const openQuiz = (quiz: any) => {
    setActiveQuiz(quiz);
    setQuizAnswers({});
    setQuizResult(null);
    setQuizVisible(true);
  };

  const submitQuiz = async () => {
    if (!activeQuiz) return;
    const answers = Object.keys(quizAnswers).map((questionId) => ({
      question: questionId,
      choices: Array.isArray(quizAnswers[questionId]) ? quizAnswers[questionId] : [quizAnswers[questionId]],
    }));
    const res = await postRequest(
      ROUTES.bible.quizSubmit(activeQuiz.id),
      { answers },
      { errorMessage: 'Unable to submit quiz.' },
    );
    if (!res?.success) return;
    setQuizResult(res.data);
  };

  const openAssignment = (assignment: any) => {
    setActiveAssignment(assignment);
    setAssignmentText('');
    setAssignmentVisible(true);
  };

  const submitAssignment = async () => {
    if (!activeAssignment) return;
    const res = await postRequest(
      ROUTES.bible.assignmentSubmissions,
      { assignment: activeAssignment.id, content_text: assignmentText },
      { errorMessage: 'Unable to submit assignment.' },
    );
    if (!res?.success) return;
    Alert.alert('Assignment', 'Submission sent.');
    setAssignmentVisible(false);
  };

  const getContentAttachment = (lesson: any) => {
    const list = Array.isArray(lesson?.attachments) ? lesson.attachments : [];
    if (list.length === 0) return null;
    const match = list.find((att: any) => {
      const kind = String(att.kind || att.type || att.mimeType || '').toLowerCase();
      return (
        kind.includes('video') ||
        kind.includes('audio') ||
        kind.includes('pdf') ||
        kind.includes('doc')
      );
    });
    return match || list[0];
  };

  const updateLessonProgress = async (lessonId: string, positionMs: number) => {
    const last = lastProgressRef.current[lessonId] || 0;
    if (positionMs - last < 8000) return;
    lastProgressRef.current[lessonId] = positionMs;
    await postRequest(
      ROUTES.bible.lessonProgress,
      { lesson: lessonId, last_position_ms: positionMs },
      { errorMessage: 'Unable to save progress.' },
    );
  };

  const downloadOfflineAsset = async (kind: string, uri: string) => {
    try {
      const fileName = `kis-${kind}-${Date.now()}`;
      const ext = uri.split('.').pop() || 'bin';
      const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}.${ext}`;
      await RNFS.downloadFile({ fromUrl: uri, toFile: filePath }).promise;
      setOfflineAssets((prev) => ({ ...prev, [uri]: `file://${filePath}` }));
      Alert.alert('Offline ready', 'Saved for offline playback.');
    } catch (err: any) {
      Alert.alert('Offline', err?.message || 'Unable to download.');
    }
  };

  useEffect(() => {
    if (!lessonDetailVisible || !activeLesson?.id) return;
    loadLessonComments(String(activeLesson.id));
  }, [lessonDetailVisible, activeLesson?.id]);

  const handleReact = async () => {
    if (!courseState) return;
    const res = await postRequest(
      ROUTES.bible.courseReact(courseState.id),
      { emoji: '❤️' },
      { errorMessage: 'Unable to react.' },
    );
    if (!res?.success) return;
    const nextCount = res.data?.count ?? res?.count ?? courseState.reaction_count ?? 0;
    const reacted = res.data?.reacted ?? res?.reacted;
    updateCourseState({
      ...courseState,
      reaction_count: nextCount,
      viewer_reaction: reacted ? '❤️' : null,
    });
  };

  const handleShare = async () => {
    if (!courseState) return;
    await postRequest(ROUTES.bible.courseShare(courseState.id), {}, { errorMessage: 'Unable to share.' });
    await Share.share({
      message: `${courseState.title} - ${courseState.subtitle || courseState.description || 'Course on KIS'}`,
    });
    updateCourseState({
      ...courseState,
      share_count: (courseState.share_count ?? 0) + 1,
    });
  };

  const submitComment = async () => {
    if (!courseState || !commentDraft.trim()) return;
    const res = await postRequest(
      ROUTES.bible.courseComments,
      { course: courseState.id, content: commentDraft.trim() },
      { errorMessage: 'Unable to post comment.' },
    );
    if (!res?.success) return;
    setCommentDraft('');
    loadComments();
    updateCourseState({
      ...courseState,
      comment_count: (courseState.comment_count ?? 0) + 1,
    });
  };

  const progressLabel = useMemo(() => {
    if (!courseState) return '0%';
    if (typeof courseState.enrollment_progress === 'number') return `${courseState.enrollment_progress}%`;
    if (lessons.length === 0) return '0%';
    return `${Math.round((completedLessons.size / lessons.length) * 100)}%`;
  }, [courseState, lessons.length, completedLessons]);

  if (!courseState) return null;

  const isPaid = !courseState.is_free;
  const canAccessLessons = courseState.is_enrolled && (!isPaid || courseState.enrollment_paid);
  const isCourseCompleted =
    courseState.enrollment_status === 'completed' ||
    Number(courseState.enrollment_progress || 0) >= 100;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <SafeAreaView edges={['top']} style={[styles.sheet, { backgroundColor: palette.card, paddingTop: insets.top + 20 }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}>{courseState.title}</Text>
              <Text style={{ color: palette.subtext }}>{courseState.subtitle}</Text>
            </View>
            <Pressable onPress={onClose}>
              <Text style={{ color: palette.subtext }}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <Text style={{ color: palette.text }}>{courseState.description}</Text>
            <Text style={{ color: palette.subtext, marginTop: 6 }}>
              {courseState.duration_minutes ?? 0} mins · {lessons.length} lessons · Progress {progressLabel}
            </Text>

            <View style={styles.actionRow}>
              {courseState.is_free ? (
                <KISButton
                  title={courseState.is_enrolled ? 'Enrolled' : 'Enroll Free'}
                  onPress={handleEnrollFree}
                  disabled={courseState.is_enrolled}
                  size="sm"
                />
              ) : (
                <>
                  <KISButton
                    title={courseState.enrollment_paid ? 'Unlocked' : 'Pay with Credits'}
                    onPress={handlePurchase}
                    disabled={courseState.enrollment_paid}
                    size="sm"
                  />
                  <KISButton
                    title="Open Wallet"
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      onRequireBilling?.(courseState);
                      navigation.navigate('Profile' as never);
                    }}
                  />
                </>
              )}
              {isCourseCompleted && certificateUrl ? (
                <KISButton
                  title="Download certificate"
                  size="sm"
                  variant="outline"
                  onPress={() => setCertificateVisible(true)}
                />
              ) : null}
              {courseState.enrollment_id ? (
                <KISButton
                  title="Mark Course Complete"
                  variant="outline"
                  size="sm"
                  onPress={handleCompleteCourse}
                />
              ) : null}
            </View>

            {!courseState.is_free && !courseState.enrollment_paid ? (
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: palette.subtext, marginBottom: 6 }}>Have a coupon?</Text>
                <KISTextInput
                  value={couponCode}
                  placeholder="Enter coupon code"
                  onChangeText={setCouponCode}
                  style={{ backgroundColor: palette.surface }}
                />
              </View>
            ) : null}

            {courseState.enrollment_paid ? (
              <View style={[styles.actionRow, { marginTop: 12 }]}>
                <KISButton
                  title={refundLoading ? 'Requesting...' : 'Request refund'}
                  size="sm"
                  variant="outline"
                  onPress={handleRequestRefund}
                  disabled={refundLoading}
                />
                {isCourseCompleted && credential ? (
                  <KISButton
                    title="Share certificate"
                    size="sm"
                    variant="outline"
                    onPress={handleShareCredential}
                  />
                ) : null}
              </View>
            ) : null}

            {!canAccessLessons ? (
              <Text style={{ color: palette.subtext, marginTop: 12 }}>
                Enroll to unlock lessons. Paid courses require credits.
              </Text>
            ) : (
              <View style={{ marginTop: 12, gap: 10 }}>
                <Text style={{ color: palette.text, fontWeight: '700' }}>Lessons</Text>
                {loadingLessons ? (
                  <Text style={{ color: palette.subtext }}>Loading lessons...</Text>
                ) : (
                  lessons.map((lesson) => {
                    const lessonId = String(lesson.id);
                    const attachments = Array.isArray(lesson.attachments) ? lesson.attachments : [];
                    const completed = completedLessons.has(lessonId);
                    return (
                      <Pressable
                        key={lessonId}
                        onPress={() => openLessonDetail(lesson)}
                        style={[styles.lessonCard, { borderColor: palette.divider }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: palette.text, fontWeight: '600' }}>{lesson.title}</Text>
                          <Text style={{ color: palette.subtext }}>{lesson.summary || lesson.description}</Text>
                          {attachments.length > 0 ? (
                            <View style={styles.badgeRow}>
                              {attachments.slice(0, 4).map((att: any, index: number) => (
                                <Text
                                  key={`${lessonId}-${index}`}
                                  style={[styles.badge, { backgroundColor: palette.surface }]}
                                >
                                  {att.kind || att.type || 'File'}
                                </Text>
                              ))}
                            </View>
                          ) : null}
                        </View>
                        {completed ? (
                          <Text style={{ color: palette.subtext, fontSize: 12 }}>Completed</Text>
                        ) : (
                          <Text style={{ color: palette.subtext, fontSize: 12 }}>Tap to view</Text>
                        )}
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}

            {quizzes.length > 0 ? (
              <View style={{ marginTop: 16 }}>
                <Text style={{ color: palette.text, fontWeight: '700' }}>Quizzes & Exams</Text>
                <View style={{ marginTop: 8, gap: 8 }}>
                  {quizzes.map((quiz) => (
                    <View key={quiz.id} style={[styles.lessonCard, { borderColor: palette.divider }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: palette.text, fontWeight: '600' }}>{quiz.title}</Text>
                        <Text style={{ color: palette.subtext }}>{quiz.description}</Text>
                      </View>
                      <KISButton title="Take quiz" size="sm" onPress={() => openQuiz(quiz)} />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {assignments.length > 0 ? (
              <View style={{ marginTop: 16 }}>
                <Text style={{ color: palette.text, fontWeight: '700' }}>Assignments</Text>
                <View style={{ marginTop: 8, gap: 8 }}>
                  {assignments.map((assignment) => (
                    <View key={assignment.id} style={[styles.lessonCard, { borderColor: palette.divider }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: palette.text, fontWeight: '600' }}>{assignment.title}</Text>
                        <Text style={{ color: palette.subtext }}>{assignment.description}</Text>
                      </View>
                      <KISButton title="Submit" size="sm" variant="outline" onPress={() => openAssignment(assignment)} />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {forums ? (
              <View style={{ marginTop: 16 }}>
                <Text style={{ color: palette.text, fontWeight: '700' }}>Course forum</Text>
                <Text style={{ color: palette.subtext, marginTop: 4 }}>
                  Ask questions, share insights, and get mentor help.
                </Text>
                <View style={{ marginTop: 8 }}>
                  <KISButton title="Open forum" size="sm" onPress={openForum} />
                </View>
              </View>
            ) : null}

            {liveSessions.length > 0 ? (
              <View style={{ marginTop: 16 }}>
                <Text style={{ color: palette.text, fontWeight: '700' }}>Live sessions</Text>
                <View style={{ marginTop: 8, gap: 8 }}>
                  {liveSessions.map((session) => {
                    const attendance = attendanceMap[session.id];
                    return (
                      <View key={session.id} style={[styles.lessonCard, { borderColor: palette.divider }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: palette.text, fontWeight: '600' }}>{session.title}</Text>
                          <Text style={{ color: palette.subtext }}>{session.description}</Text>
                          <Text style={{ color: palette.subtext, marginTop: 4 }}>
                            Starts: {new Date(session.start_at).toLocaleString()}
                          </Text>
                        </View>
                        {!attendance ? (
                          <KISButton title="Register" size="sm" onPress={() => registerLive(session.id)} />
                        ) : (
                          <KISButton
                            title="Join"
                            size="sm"
                            variant="outline"
                            onPress={() => {
                              joinLive(session.id);
                              if (session.meeting_url) Linking.openURL(session.meeting_url);
                            }}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {courseState.is_public ? (
              <>
                <View style={styles.reactionRow}>
                  <Pressable onPress={handleReact} style={styles.reactionChip}>
                    <Text style={{ color: courseState.viewer_reaction ? palette.danger : palette.text }}>❤️</Text>
                    <Text style={{ color: palette.text }}>{courseState.reaction_count ?? 0}</Text>
                  </Pressable>
                  <Pressable onPress={handleShare} style={styles.reactionChip}>
                    <Text style={{ color: palette.text }}>↗</Text>
                    <Text style={{ color: palette.text }}>{courseState.share_count ?? 0}</Text>
                  </Pressable>
                </View>

                <View style={{ marginTop: 12 }}>
                  <Text style={{ color: palette.text, fontWeight: '700' }}>Comments</Text>
                  <View style={{ marginTop: 8 }}>
                    <KISTextInput
                      label="Add a comment"
                      value={commentDraft}
                      onChangeText={setCommentDraft}
                    />
                    <KISButton title="Post Comment" size="sm" onPress={submitComment} />
                  </View>
                  <View style={{ marginTop: 10, gap: 8 }}>
                    {comments.length === 0 ? (
                      <Text style={{ color: palette.subtext }}>No comments yet.</Text>
                    ) : (
                      comments.map((comment) => (
                        <View key={comment.id} style={[styles.commentCard, { borderColor: palette.divider }]}>
                          <Text style={{ color: palette.text, fontWeight: '600' }}>
                            {comment.author_name || comment.author?.display_name || 'Member'}
                          </Text>
                          <Text style={{ color: palette.subtext }}>{comment.content}</Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </>
            ) : (
              <Text style={{ color: palette.subtext, marginTop: 12 }}>
                Private course. Only members can interact.
              </Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>

      <Modal
        visible={lessonDetailVisible}
        animationType="slide"
        onRequestClose={() => setLessonDetailVisible(false)}
      >
        <SafeAreaView edges={['top']} style={[styles.lessonDetailWrap, { backgroundColor: palette.bg, paddingTop: insets.top + 20 }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}>
                {activeLesson?.title || 'Lesson'}
              </Text>
              <Text style={{ color: palette.subtext }}>{activeLesson?.summary || activeLesson?.description}</Text>
            </View>
            <Pressable onPress={() => setLessonDetailVisible(false)}>
              <Text style={{ color: palette.subtext }}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <Text style={{ color: palette.text, lineHeight: 20 }}>
              {activeLesson?.content || activeLesson?.body || activeLesson?.text || activeLesson?.description || ''}
            </Text>

            {(() => {
              const att = getContentAttachment(activeLesson);
              if (!att) return null;
              const kind = String(att.kind || att.type || att.mimeType || '').toLowerCase();
              const uri = att.url || att.uri;
              if (!uri) return null;
              const localUri = offlineAssets[uri] || uri;
              const resumeMs = Number(activeLesson?.last_position_ms || 0);
              if (kind.includes('video')) {
                const mediaSource = buildMediaSource(localUri, mediaHeaders);
                return (
                  <View style={{ marginTop: 16 }}>
                    <View style={styles.actionRow}>
                      <KISButton
                        title="Download video"
                        size="sm"
                        variant="outline"
                        onPress={() => downloadOfflineAsset('video', uri)}
                      />
                      <KISButton
                        title="Background play"
                        size="sm"
                        variant="outline"
                        onPress={() => setBackgroundPlayback((s) => !s)}
                      />
                    </View>
                    <Video
                      source={mediaSource ?? { uri: localUri }}
                      style={styles.videoPlayer}
                      controls
                      rate={playbackRate}
                      ref={(ref) => {
                        mediaRef.current = ref;
                      }}
                      onLoad={() => {
                        if (resumeMs > 0) {
                          mediaRef.current?.seek?.(resumeMs / 1000);
                        }
                      }}
                      onProgress={(progress) => {
                        if (activeLesson?.id) {
                          updateLessonProgress(String(activeLesson.id), Math.floor(progress.currentTime * 1000));
                        }
                      }}
                      onEnd={() => handleAutoAdvance(String(activeLesson?.id))}
                      playInBackground={backgroundPlayback}
                      ignoreSilentSwitch="ignore"
                    />
                  </View>
                );
              }
              if (kind.includes('audio')) {
                const audioSource = buildMediaSource(localUri, mediaHeaders);
                return (
                  <View style={{ marginTop: 16 }}>
                    <View style={styles.actionRow}>
                      <KISButton
                        title="Download audio"
                        size="sm"
                        variant="outline"
                        onPress={() => downloadOfflineAsset('audio', uri)}
                      />
                      <KISButton
                        title="Background play"
                        size="sm"
                        variant="outline"
                        onPress={() => setBackgroundPlayback((s) => !s)}
                      />
                    </View>
                    <Video
                      source={audioSource ?? { uri: localUri }}
                      style={styles.audioPlayer}
                      controls
                      audioOnly
                      rate={playbackRate}
                      ref={(ref) => {
                        mediaRef.current = ref;
                      }}
                      onLoad={() => {
                        if (resumeMs > 0) {
                          mediaRef.current?.seek?.(resumeMs / 1000);
                        }
                      }}
                      onProgress={(progress) => {
                        if (activeLesson?.id) {
                          updateLessonProgress(String(activeLesson.id), Math.floor(progress.currentTime * 1000));
                        }
                      }}
                      onEnd={() => handleAutoAdvance(String(activeLesson?.id))}
                      playInBackground={backgroundPlayback}
                      ignoreSilentSwitch="ignore"
                    />
                  </View>
                );
              }
              if (kind.includes('pdf')) {
                return (
                  <View style={{ marginTop: 16, height: 420 }}>
                    <Pdf source={{ uri }} style={styles.pdfViewer} />
                  </View>
                );
              }
              if (kind.includes('doc')) {
                return (
                  <Pressable
                    onPress={() => Linking.openURL(uri)}
                    style={[styles.attachmentRow, { borderColor: palette.divider, marginTop: 16 }]}
                  >
                    <Text style={{ color: palette.text }}>Open document</Text>
                    <Text style={{ color: palette.primary }}>View</Text>
                  </Pressable>
                );
              }
              return null;
            })()}

            {Array.isArray(activeLesson?.attachments) && activeLesson.attachments.length > 0 ? (
              <View style={{ marginTop: 16, gap: 10 }}>
                <Text style={{ color: palette.text, fontWeight: '700' }}>Lesson content</Text>
                {activeLesson.attachments.map((att: any, index: number) => (
                  <Pressable
                    key={`${activeLesson.id}-${index}`}
                    onPress={() => att.url && Linking.openURL(att.url)}
                    style={[styles.attachmentRow, { borderColor: palette.divider }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: palette.text, fontWeight: '600' }}>
                        {att.title || att.name || `${att.kind || 'File'} content`}
                      </Text>
                      <Text style={{ color: palette.subtext }}>{att.kind || att.type || 'File'}</Text>
                    </View>
                    <Text style={{ color: palette.primary }}>Open</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {activeLesson?.transcript ? (
              <View style={{ marginTop: 16 }}>
                <Text style={{ color: palette.text, fontWeight: '700' }}>Transcript</Text>
                <Text style={{ color: palette.subtext, marginTop: 6 }}>{activeLesson.transcript}</Text>
              </View>
            ) : null}

            {activeLesson?.captions_url ? (
              <Pressable
                onPress={() => Linking.openURL(activeLesson.captions_url)}
                style={[styles.attachmentRow, { borderColor: palette.divider, marginTop: 12 }]}
              >
                <Text style={{ color: palette.text }}>Download captions</Text>
                <Text style={{ color: palette.primary }}>Get file</Text>
              </Pressable>
            ) : null}

            {activeLesson?.language ? (
              <Text style={{ color: palette.subtext, marginTop: 8 }}>
                Language: {activeLesson.language.toUpperCase()}
              </Text>
            ) : null}

            <View style={styles.actionRow}>
              <Text style={{ color: palette.subtext }}>Speed</Text>
              {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                <Pressable
                  key={rate}
                  accessibilityRole="button"
                  accessibilityLabel={`Playback speed ${rate}x`}
                  onPress={() => setPlaybackRate(rate)}
                  style={[
                    styles.speedChip,
                    {
                      borderColor: playbackRate === rate ? palette.primary : palette.divider,
                      backgroundColor: playbackRate === rate ? palette.primarySoft : palette.surface,
                    },
                  ]}
                >
                  <Text style={{ color: palette.text }}>{rate}x</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.actionRow}>
              {!completedLessons.has(String(activeLesson?.id)) ? (
                <KISButton
                  title="Mark done"
                  size="sm"
                  variant="primary"
                  onPress={async () => {
                    if (activeLesson?.id) {
                      await handleLessonComplete(String(activeLesson.id));
                      openNextLesson(String(activeLesson.id));
                    }
                  }}
                />
              ) : (
                <Text style={{ color: palette.subtext, alignSelf: 'center' }}>Completed</Text>
              )}
              <KISButton
                title={lessonReactions[String(activeLesson?.id)]?.reacted ? 'Liked' : 'Like'}
                size="sm"
                variant="ghost"
                onPress={() => activeLesson?.id && handleLessonReact(String(activeLesson.id))}
              />
              <Text style={{ color: palette.subtext, alignSelf: 'center' }}>
                {lessonReactions[String(activeLesson?.id)]?.count ?? 0} likes
              </Text>
            </View>

            <View style={{ marginTop: 16 }}>
              <Text style={{ color: palette.text, fontWeight: '700' }}>
                Comments ({lessonCommentCounts[String(activeLesson?.id)] ?? 0})
              </Text>
              <View style={{ marginTop: 8 }}>
                <KISTextInput
                  label="Add a comment"
                  value={lessonCommentDraft}
                  onChangeText={setLessonCommentDraft}
                />
                <KISButton
                  title="Post Comment"
                  size="sm"
                  onPress={() => activeLesson?.id && submitLessonComment(String(activeLesson.id))}
                />
              </View>
              <View style={{ marginTop: 10, gap: 8 }}>
                {lessonComments.length === 0 ? (
                  <Text style={{ color: palette.subtext }}>No comments yet.</Text>
                ) : (
                  lessonComments.map((comment) => (
                    <View key={comment.id} style={[styles.commentCard, { borderColor: palette.divider }]}>
                      <Text style={{ color: palette.text, fontWeight: '600' }}>
                        {comment.user_name || comment.user?.display_name || 'Member'}
                      </Text>
                      <Text style={{ color: palette.subtext }}>{comment.content}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={certificateVisible}
        animationType="slide"
        onRequestClose={() => setCertificateVisible(false)}
      >
        <SafeAreaView edges={['top']} style={[styles.lessonDetailWrap, { backgroundColor: palette.bg, paddingTop: insets.top + 20 }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}>Course Certificate</Text>
              <Text style={{ color: palette.subtext }}>{courseState.title}</Text>
            </View>
            <Pressable onPress={() => setCertificateVisible(false)}>
              <Text style={{ color: palette.subtext }}>Close</Text>
            </Pressable>
          </View>

          {certificateUrl ? (
            <View style={{ flex: 1, marginTop: 12 }}>
              <View style={{ height: 420 }}>
                {certificateLocalUri ? (
                  <Pdf
                    source={{ uri: certificateLocalUri }}
                    style={styles.pdfViewer}
                    onError={(err) => {
                      Alert.alert('Certificate', 'Unable to render certificate preview.');
                      console.log('certificate pdf error', err);
                    }}
                  />
                ) : (
                  <Text style={{ color: palette.subtext }}>
                    {certificateLoading ? 'Loading certificate...' : 'Certificate not available yet.'}
                  </Text>
                )}
              </View>
              <View style={{ marginTop: 16 }}>
                <KISButton
                  title="Download PDF"
                  onPress={async () => {
                    if (!certificateFetchUrl) return;
                    try {
                      if (certificateLocalUri) {
                        await Linking.openURL(certificateLocalUri);
                        return;
                      }
                      const filePath = `${RNFS.DocumentDirectoryPath}/certificate-${courseId}.pdf`;
                      await RNFS.downloadFile({
                        fromUrl: certificateFetchUrl,
                        toFile: filePath,
                        headers: certificateAuth ? { Authorization: certificateAuth } : undefined,
                      }).promise;
                      await Linking.openURL(`file://${filePath}`);
                    } catch (err: any) {
                      Alert.alert('Certificate', err?.message || 'Unable to download certificate.');
                    }
                  }}
                />
              </View>
            </View>
          ) : (
            <Text style={{ color: palette.subtext }}>Certificate not available.</Text>
          )}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={quizVisible}
        animationType="slide"
        onRequestClose={() => setQuizVisible(false)}
      >
        <SafeAreaView edges={['top']} style={[styles.lessonDetailWrap, { backgroundColor: palette.bg, paddingTop: insets.top + 20 }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}>{activeQuiz?.title || 'Quiz'}</Text>
              <Text style={{ color: palette.subtext }}>{activeQuiz?.description}</Text>
            </View>
            <Pressable onPress={() => setQuizVisible(false)}>
              <Text style={{ color: palette.subtext }}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            {(activeQuiz?.questions || []).map((question: any) => (
              <View key={question.id} style={[styles.lessonCard, { borderColor: palette.divider }]}>
                <Text style={{ color: palette.text, fontWeight: '600' }}>{question.prompt}</Text>
                <View style={{ marginTop: 6, gap: 6 }}>
                  {(question.choices || []).map((choice: any) => {
                    const stored = quizAnswers[question.id];
                    const selected = Array.isArray(stored)
                      ? stored.includes(choice.id)
                      : stored === choice.id;
                    return (
                      <Pressable
                        key={choice.id}
                        onPress={() =>
                          setQuizAnswers((prev) => {
                            if (question.kind === 'multiple_choice') {
                              const current = Array.isArray(prev[question.id]) ? prev[question.id] : [];
                              const next = current.includes(choice.id)
                                ? current.filter((id: any) => id !== choice.id)
                                : [...current, choice.id];
                              return { ...prev, [question.id]: next };
                            }
                            return { ...prev, [question.id]: choice.id };
                          })
                        }
                        style={[
                          styles.quizChoice,
                          {
                            borderColor: selected ? palette.primary : palette.divider,
                            backgroundColor: selected ? palette.primarySoft : palette.surface,
                          },
                        ]}
                      >
                        <Text style={{ color: palette.text }}>{choice.text}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {quizResult ? (
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: palette.text }}>
                  Score: {quizResult.score}/{quizResult.max_score} · {quizResult.passed ? 'Passed' : 'Try again'}
                </Text>
              </View>
            ) : null}

            <View style={{ marginTop: 16 }}>
              <KISButton title="Submit quiz" onPress={submitQuiz} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={assignmentVisible}
        animationType="slide"
        onRequestClose={() => setAssignmentVisible(false)}
      >
        <SafeAreaView edges={['top']} style={[styles.lessonDetailWrap, { backgroundColor: palette.bg, paddingTop: insets.top + 20 }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}>{activeAssignment?.title || 'Assignment'}</Text>
              <Text style={{ color: palette.subtext }}>{activeAssignment?.description}</Text>
            </View>
            <Pressable onPress={() => setAssignmentVisible(false)}>
              <Text style={{ color: palette.subtext }}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <KISTextInput
              label="Your submission"
              value={assignmentText}
              onChangeText={setAssignmentText}
              multiline
              style={{ minHeight: 140 }}
            />
            <View style={{ marginTop: 12 }}>
              <KISButton title="Submit assignment" onPress={submitAssignment} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={forumVisible}
        animationType="slide"
        onRequestClose={() => setForumVisible(false)}
      >
        <SafeAreaView edges={['top']} style={[styles.lessonDetailWrap, { backgroundColor: palette.bg, paddingTop: insets.top + 20 }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}>Course Forum</Text>
              <Text style={{ color: palette.subtext }}>{courseState.title}</Text>
            </View>
            <Pressable onPress={() => setForumVisible(false)}>
              <Text style={{ color: palette.subtext }}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <KISTextInput
              label="Start a thread"
              value={threadDraft}
              onChangeText={setThreadDraft}
            />
            <KISButton title="Create thread" size="sm" onPress={createThread} />

            <View style={{ marginTop: 16, gap: 8 }}>
              {threads.length === 0 ? (
                <Text style={{ color: palette.subtext }}>No threads yet.</Text>
              ) : (
                threads.map((thread) => (
                  <Pressable
                    key={thread.id}
                    onPress={() => openThread(thread)}
                    style={[styles.lessonCard, { borderColor: palette.divider }]}
                  >
                    <Text style={{ color: palette.text, fontWeight: '600' }}>{thread.title}</Text>
                    <Text style={{ color: palette.subtext }}>
                      {thread.created_by_name || 'Member'} · {new Date(thread.created_at).toLocaleString()}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={threadVisible}
        animationType="slide"
        onRequestClose={() => setThreadVisible(false)}
      >
        <SafeAreaView edges={['top']} style={[styles.lessonDetailWrap, { backgroundColor: palette.bg, paddingTop: insets.top + 20 }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}>{activeThread?.title || 'Thread'}</Text>
              <Text style={{ color: palette.subtext }}>Replies</Text>
            </View>
            <Pressable onPress={() => setThreadVisible(false)}>
              <Text style={{ color: palette.subtext }}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <View style={{ gap: 8 }}>
              {threadPosts.length === 0 ? (
                <Text style={{ color: palette.subtext }}>No replies yet.</Text>
              ) : (
                threadPosts.map((post) => (
                  <View key={post.id} style={[styles.commentCard, { borderColor: palette.divider }]}>
                    <Text style={{ color: palette.text, fontWeight: '600' }}>{post.user_name || 'Member'}</Text>
                    <Text style={{ color: palette.subtext }}>{post.content}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={{ marginTop: 12 }}>
              <KISTextInput
                label="Reply"
                value={postDraft}
                onChangeText={setPostDraft}
              />
              <KISButton title="Post reply" size="sm" onPress={postReply} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' },
  lessonCard: { borderWidth: 2, borderRadius: 12, padding: 10, flexDirection: 'row', gap: 8 },
  lessonDetailWrap: { flex: 1, padding: 16 },
  attachmentRow: { borderWidth: 2, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  videoPlayer: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#000' },
  audioPlayer: { width: '100%', height: 60, borderRadius: 12, backgroundColor: '#000' },
  pdfViewer: { flex: 1, width: '100%' },
  speedChip: { borderWidth: 2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  quizChoice: { borderWidth: 2, borderRadius: 10, padding: 10 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, fontSize: 11 },
  reactionRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  reactionChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentCard: { borderWidth: 2, borderRadius: 10, padding: 10 },
});
