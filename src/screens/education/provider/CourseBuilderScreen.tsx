// src/screens/education/provider/CourseBuilderScreen.tsx
//
// Education UX v2 — real "Course Builder" destination replacing the
// module-list -> detail -> curriculum-workspace path inside
// EducationManagementModal.tsx for the course entity (see the v2
// architecture note for the full capability migration matrix). Internal
// tabs (Details/Curriculum/Content/Assessments/Live/Settings) rather than
// six separate stack screens, since they all operate on the same course
// and a tabbed single destination is the right shape here, not six
// navigations for one editing session. Content/Assessments/Live are real
// editors (course-builder/ContentEditor.tsx, AssessmentsEditor.tsx,
// LiveEditor.tsx), not pointers back to Curriculum.
//
// Curriculum tab creates content AND links it into a module in one step
// ("+ Add content"); the Content/Assessments/Live tabs are for editing an
// item's own fields (lesson body text, quiz questions, session schedule)
// after it exists.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import { uploadEducationMedia } from '@/services/uploadEducationMedia';
import ContentEditor from '@/screens/education/provider/course-builder/ContentEditor';
import AssessmentsEditor from '@/screens/education/provider/course-builder/AssessmentsEditor';
import LiveEditor from '@/screens/education/provider/course-builder/LiveEditor';
import type { RootStackParamList } from '@/navigation/types';
import { EducationSectionCard } from '@/screens/education/shared/components';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route_ = RouteProp<RootStackParamList, 'EducationCourseBuilder'>;

type TabKey = 'details' | 'curriculum' | 'content' | 'assessments' | 'live' | 'settings';

const TABS: Array<{ key: TabKey; title: string; needsCourse?: boolean }> = [
  { key: 'details', title: 'Details' },
  { key: 'curriculum', title: 'Curriculum', needsCourse: true },
  { key: 'content', title: 'Content', needsCourse: true },
  { key: 'assessments', title: 'Assessments', needsCourse: true },
  { key: 'live', title: 'Live', needsCourse: true },
  { key: 'settings', title: 'Settings', needsCourse: true },
];

const ITEM_TYPES: Array<{ key: string; title: string; icon: string }> = [
  { key: 'lesson', title: 'Lesson', icon: 'book' },
  { key: 'material', title: 'Material', icon: 'file' },
  { key: 'class_session', title: 'Live class', icon: 'video' },
  { key: 'assessment', title: 'Quiz', icon: 'check' },
  { key: 'event', title: 'Event', icon: 'calendar' },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  const { palette } = useKISTheme();
  return <Text style={{ fontSize: 12, fontWeight: '700', color: palette.subtext, marginBottom: 4 }}>{children}</Text>;
}

export default function CourseBuilderScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route_>();
  const { institutionId, institutionName } = route.params;
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();

  const [courseId, setCourseId] = useState<string | undefined>(route.params.courseId);
  const [tab, setTab] = useState<TabKey>('details');
  const [loading, setLoading] = useState(!!courseId);
  const [saving, setSaving] = useState(false);

  // Details form state
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [priceAmount, setPriceAmount] = useState('0');
  const [durationMinutes, setDurationMinutes] = useState('0');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [programId, setProgramId] = useState<string | null>(route.params.presetProgramId ?? null);
  const [programs, setPrograms] = useState<any[]>([]);
  const [newProgramTitle, setNewProgramTitle] = useState('');
  const [creatingProgram, setCreatingProgram] = useState(false);
  const [classId, setClassId] = useState<string | null>(route.params.presetInstitutionClassId ?? null);
  const [classes, setClasses] = useState<any[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [creatingClass, setCreatingClass] = useState(false);
  const [seatLimit, setSeatLimit] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImageAsset, setCoverImageAsset] = useState<{ uri: string; name: string; type: string; size?: number } | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Curriculum state
  const [modules, setModules] = useState<any[]>([]);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);
  const [addContentModuleId, setAddContentModuleId] = useState<string | null>(null);
  const [addContentType, setAddContentType] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');
  // A course's own `status: published` field controls what the *provider*
  // sees as published in this UI, but it is NOT what makes a course
  // discoverable/enrollable by learners - that's a separate
  // EducationInstitutionBroadcast record pointing at the course (see
  // apps.broadcasts.views._sync_course_pricing_to_broadcasts's docstring:
  // "the entity that actually makes it discoverable/enrollable"). The old
  // modal exposed this as its own "Broadcasts" tab and left creating one
  // as a manual, separate step - easy to forget, and a course could sit
  // at status=published while still being completely invisible to
  // learners. saveDetails below creates/syncs the broadcast automatically
  // so "Published" in this UI means what a non-technical provider expects
  // it to mean.
  const [courseBroadcastId, setCourseBroadcastId] = useState<string | null>(null);
  // Tracked separately from courseBroadcastId because a broadcast record can
  // exist but sit in 'draft' (previously live, then removed) — "is this
  // course actually live right now" needs the status, not just presence.
  const [courseBroadcastStatus, setCourseBroadcastStatus] = useState<string | null>(null);
  const [togglingLive, setTogglingLive] = useState(false);
  const isLive = courseBroadcastStatus === 'published';

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    getRequest(ROUTES.broadcasts.educationInstitutionCourseDetail(institutionId, courseId), { forceNetwork: true })
      .then(response => {
        const course = response?.data?.course;
        if (course) {
          setTitle(course.title ?? '');
          setSummary(course.summary ?? '');
          setDescription(course.description ?? '');
          setPriceAmount(String(course.price_amount ?? 0));
          setDurationMinutes(String(course.duration_minutes ?? 0));
          setStatus(course.status ?? 'draft');
          setProgramId(course.program?.id ?? course.program_id ?? null);
          setClassId(course.institution_class?.id ?? course.institution_class_id ?? null);
          setSeatLimit(course.seat_limit != null ? String(course.seat_limit) : '');
          setVisibility(course.visibility === 'private' ? 'private' : 'public');
          setCoverImageUrl(course.cover_image_url ?? course.coverUrl ?? '');
        }
        const existingBroadcast = (response?.data?.broadcasts ?? []).find((b: any) => b.broadcast_kind === 'course');
        setCourseBroadcastId(existingBroadcast?.id ?? null);
        setCourseBroadcastStatus(existingBroadcast?.status ?? null);
      })
      .finally(() => setLoading(false));
  }, [institutionId, courseId]);

  // The backend now guarantees status=published <-> a published course-kind
  // broadcast exists (see _ensure_course_broadcast_matches_status on the
  // course create/patch endpoints) — this just re-reads whatever the
  // backend decided after a save, instead of this screen managing the
  // broadcast itself.
  const refreshCourseBroadcastStatus = useCallback(
    async (id: string) => {
      const response = await getRequest(ROUTES.broadcasts.educationInstitutionCourseDetail(institutionId, id), { forceNetwork: true });
      const existingBroadcast = (response?.data?.broadcasts ?? []).find((b: any) => b.broadcast_kind === 'course');
      setCourseBroadcastId(existingBroadcast?.id ?? null);
      setCourseBroadcastStatus(existingBroadcast?.status ?? null);
    },
    [institutionId],
  );

  // Explicit "Broadcast" action — independent of Save, so going live/removing
  // from live doesn't require touching (or accidentally changing) any other
  // field. Same broadcast record and payload shape saveDetails already
  // manages automatically on status changes; this just exposes it directly.
  const toggleBroadcastLive = useCallback(async () => {
    if (!courseId) {
      Alert.alert('Broadcast', 'Save this course first, then you can broadcast it.');
      return;
    }
    setTogglingLive(true);
    try {
      if (isLive) {
        const response = await patchRequest(
          ROUTES.broadcasts.educationInstitutionBroadcast(institutionId, courseBroadcastId!),
          { status: 'draft' },
          { errorMessage: 'Unable to remove this course from live.' },
        );
        if (!response?.success) {
          Alert.alert('Broadcast', response?.message || 'Unable to remove this course from live.');
          return;
        }
        setCourseBroadcastStatus('draft');
      } else if (courseBroadcastId) {
        const response = await patchRequest(
          ROUTES.broadcasts.educationInstitutionBroadcast(institutionId, courseBroadcastId),
          { status: 'published' },
          { errorMessage: 'Unable to make this course live.' },
        );
        if (!response?.success) {
          Alert.alert('Broadcast', response?.message || 'Unable to make this course live.');
          return;
        }
        setCourseBroadcastStatus('published');
      } else {
        const response = await postRequest(
          ROUTES.broadcasts.educationInstitutionBroadcasts(institutionId),
          { course_id: courseId, status: 'published' },
          { errorMessage: 'Unable to make this course live.' },
        );
        if (!response?.success) {
          Alert.alert('Broadcast', response?.message || 'Unable to make this course live.');
          return;
        }
        setCourseBroadcastId(response.data?.broadcast?.id ?? null);
        setCourseBroadcastStatus('published');
      }
    } finally {
      setTogglingLive(false);
    }
  }, [courseId, institutionId, isLive, courseBroadcastId]);

  useEffect(() => {
    getRequest(ROUTES.broadcasts.educationInstitutionPrograms(institutionId), { forceNetwork: true }).then(response => {
      setPrograms(response?.data?.programs ?? []);
    });
    getRequest(ROUTES.broadcasts.educationInstitutionClasses(institutionId), { forceNetwork: true }).then(response => {
      setClasses(response?.data?.classes ?? []);
    });
  }, [institutionId]);

  const createClass = useCallback(async () => {
    if (!newClassName.trim()) return;
    setCreatingClass(true);
    try {
      // A class does not need a program - it can be created standalone
      // from right here, same "create inline while picking" pattern as
      // createProgram below. If a program is already selected, the new
      // class is created under it; otherwise it's a standalone class.
      const response = await postRequest(
        ROUTES.broadcasts.educationInstitutionClasses(institutionId),
        { name: newClassName.trim(), status: 'published', program_id: programId || undefined },
        { errorMessage: 'Unable to create class.' },
      );
      const created = response?.data?.class;
      if (created) {
        setClasses(prev => [...prev, created]);
        setClassId(created.id);
        setNewClassName('');
      }
    } finally {
      setCreatingClass(false);
    }
  }, [newClassName, institutionId, programId]);

  const createProgram = useCallback(async () => {
    if (!newProgramTitle.trim()) return;
    setCreatingProgram(true);
    try {
      const response = await postRequest(
        ROUTES.broadcasts.educationInstitutionPrograms(institutionId),
        { title: newProgramTitle.trim(), status: 'published' },
        { errorMessage: 'Unable to create program.' },
      );
      const created = response?.data?.program;
      if (created?.id) {
        setPrograms(prev => [...prev, created]);
        setProgramId(created.id);
        setNewProgramTitle('');
      }
    } finally {
      setCreatingProgram(false);
    }
  }, [newProgramTitle, institutionId]);

  const pickCoverImage = useCallback(async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, selectionLimit: 1 });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert('Cover image', 'Please pick a valid image.');
        return;
      }
      setCoverImageAsset({
        uri: asset.uri,
        name: asset.fileName || `course-cover-${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
        size: asset.fileSize ?? undefined,
      });
      setCoverImageUrl(asset.uri);
    } catch (error: any) {
      Alert.alert('Cover image', error?.message || 'Unable to pick image.');
    }
  }, []);

  const loadCurriculum = useCallback(async () => {
    if (!courseId) return;
    setLoadingCurriculum(true);
    try {
      const response = await getRequest(ROUTES.broadcasts.educationInstitutionCourseModules(institutionId, courseId), { forceNetwork: true });
      setModules(response?.data?.modules ?? []);
    } finally {
      setLoadingCurriculum(false);
    }
  }, [institutionId, courseId]);

  useEffect(() => {
    if (tab === 'curriculum') void loadCurriculum();
  }, [tab, loadCurriculum]);

  const saveDetails = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Course', 'Give this course a title first.');
      return;
    }
    setSaving(true);
    try {
      let coverImageAttachment: { media_id: string } | undefined;
      if (coverImageAsset) {
        setUploadingCover(true);
        try {
          const uploaded = await uploadEducationMedia({
            context: 'education_module_cover_image',
            file: coverImageAsset,
            institutionId,
          });
          coverImageAttachment = { media_id: uploaded.mediaId };
        } catch (uploadErr: any) {
          Alert.alert('Cover image', uploadErr?.message || 'Unable to upload cover image — the rest of the course was still saved.');
        } finally {
          setUploadingCover(false);
        }
      }
      const body = {
        title: title.trim(),
        summary: summary.trim(),
        description: description.trim(),
        price_amount: Number(priceAmount) || 0,
        duration_minutes: Number(durationMinutes) || 0,
        status,
        program_id: programId || null,
        institution_class_id: classId || null,
        seat_limit: seatLimit.trim() ? Number(seatLimit) : null,
        visibility,
        cover_image_attachment: coverImageAttachment,
      };
      const response = courseId
        ? await patchRequest(ROUTES.broadcasts.educationInstitutionCourse(institutionId, courseId), body, { errorMessage: 'Unable to save course.' })
        : await postRequest(ROUTES.broadcasts.educationInstitutionCourses(institutionId), body, { errorMessage: 'Unable to create course.' });
      if (!response?.success) {
        Alert.alert('Course', response?.message || 'Unable to save course.');
        return;
      }
      const saved = response.data?.course;
      const savedCourseId = saved?.id || courseId;
      if (saved?.id && !courseId) {
        setCourseId(saved.id);
        setTab('curriculum');
      }

      // Publishing = the course exists AND a broadcast points at it (see
      // the field comment above courseBroadcastId for why). Draft = no
      // learner-visible broadcast at all, rather than leaving a stale
      // published one around pointing at an unpublished course. The
      // course create/patch endpoint itself now enforces this (see
      // _ensure_course_broadcast_matches_status on the backend) — this
      // screen just re-reads the result instead of managing it separately,
      // so the invariant holds even when a course is published from
      // somewhere other than this screen.
      if (savedCourseId) {
        await refreshCourseBroadcastStatus(savedCourseId);
      }

      Alert.alert('Course', 'Saved.');
    } finally {
      setSaving(false);
    }
  }, [title, summary, description, priceAmount, durationMinutes, status, programId, classId, courseId, institutionId, refreshCourseBroadcastStatus, seatLimit, visibility, coverImageAsset]);

  const createModule = useCallback(async () => {
    if (!courseId) return;
    const response = await postRequest(
      ROUTES.broadcasts.educationInstitutionCourseModules(institutionId, courseId),
      { title: `Module ${modules.length + 1}`, module_order: modules.length + 1, status: 'published' },
      { errorMessage: 'Unable to create module.' },
    );
    if (response?.success) await loadCurriculum();
  }, [institutionId, courseId, modules.length, loadCurriculum]);

  // Deletes the underlying content record itself (not just its link into
  // this module) — same routes/behavior as the old modal's
  // handleDeleteModuleRecord, one detail route per item_type.
  const deleteModuleItem = useCallback(
    (item: any) => {
      const routeByType: Record<string, ((instId: string, id: string) => string) | undefined> = {
        lesson: ROUTES.broadcasts.educationInstitutionLesson,
        material: ROUTES.broadcasts.educationInstitutionMaterial,
        class_session: ROUTES.broadcasts.educationInstitutionClassSession,
        assessment: ROUTES.broadcasts.educationInstitutionAssessment,
        event: ROUTES.broadcasts.educationInstitutionEvent,
      };
      const idField = `${item.item_type}_id`;
      const targetId = item[idField];
      const routeFn = routeByType[item.item_type];
      if (!routeFn || !targetId) return;
      const label = String(item.item_type || 'item').replace('_', ' ');
      Alert.alert(
        `Delete ${label}`,
        `This will permanently delete this ${label}, not just remove it from the module. Are you sure?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const response = await deleteRequest(routeFn(institutionId, targetId), {
                errorMessage: `Unable to delete this ${label}.`,
              });
              if (response?.success || response === undefined) {
                await loadCurriculum();
              } else {
                Alert.alert('Delete', response?.message || `Unable to delete this ${label}.`);
              }
            },
          },
        ],
      );
    },
    [institutionId, loadCurriculum],
  );

  const createAndLinkItem = useCallback(async () => {
    if (!courseId || !addContentModuleId || !addContentType) return;
    if (!newItemTitle.trim()) {
      Alert.alert('Add content', 'Give it a title first.');
      return;
    }
    setSaving(true);
    try {
      let createdId: string | null = null;
      const title_ = newItemTitle.trim();
      if (addContentType === 'lesson') {
        const res = await postRequest(
          ROUTES.broadcasts.educationInstitutionLessons(institutionId),
          { title: title_, course_id: courseId, status: 'published' },
          { errorMessage: 'Unable to create lesson.' },
        );
        createdId = res?.data?.lesson?.id ?? null;
      } else if (addContentType === 'material') {
        const res = await postRequest(
          ROUTES.broadcasts.educationInstitutionMaterials(institutionId),
          { title: title_, course_ids: [courseId], kind: 'reference', status: 'published' },
          { errorMessage: 'Unable to create material.' },
        );
        createdId = res?.data?.material?.id ?? null;
      } else if (addContentType === 'class_session') {
        const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        const res = await postRequest(
          ROUTES.broadcasts.educationInstitutionClassSessions(institutionId),
          { title: title_, course_id: courseId, starts_at: start.toISOString(), ends_at: end.toISOString(), status: 'scheduled' },
          { errorMessage: 'Unable to create live class.' },
        );
        createdId = res?.data?.class_session?.id ?? null;
      } else if (addContentType === 'assessment') {
        const res = await postRequest(
          ROUTES.broadcasts.educationInstitutionAssessments(institutionId),
          { title: title_, course_id: courseId, assessment_type: 'mcq', status: 'published' },
          { errorMessage: 'Unable to create quiz.' },
        );
        createdId = res?.data?.assessment?.id ?? null;
      } else if (addContentType === 'event') {
        const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
        const res = await postRequest(
          ROUTES.broadcasts.educationInstitutionEvents(institutionId),
          { title: title_, course_id: courseId, event_type: 'event', starts_at: start.toISOString(), ends_at: end.toISOString(), status: 'published' },
          { errorMessage: 'Unable to create event.' },
        );
        createdId = res?.data?.event?.id ?? null;
      }
      if (!createdId) return;
      const idField = `${addContentType}_id`;
      await postRequest(
        ROUTES.broadcasts.educationInstitutionCourseModuleItems(institutionId, courseId, addContentModuleId),
        { item_type: addContentType, [idField]: createdId, item_order: 1 },
        { errorMessage: 'Unable to add this to the module.' },
      );
      setAddContentModuleId(null);
      setAddContentType(null);
      setNewItemTitle('');
      await loadCurriculum();
    } finally {
      setSaving(false);
    }
  }, [courseId, addContentModuleId, addContentType, newItemTitle, institutionId, loadCurriculum]);

  const isNew = !courseId;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: responsive.pageGutter, paddingTop: 10 }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4, marginLeft: -4 }}>
          <KISIcon name="back" size={20} color={palette.text} />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '900', color: palette.text }} numberOfLines={1}>
          {isNew ? 'New course' : title || 'Course'}
        </Text>
      </View>

      {/* flexGrow/flexShrink pinned to 0 — a bare <ScrollView> defaults its
          outer container to flexGrow:1/flexShrink:1, which made this row
          compete for vertical space with the content ScrollView below it:
          squished (text clipped) when that content was tall, stretched
          (oddly tall) when it was short. This row's height should only ever
          come from its own pill content. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: responsive.pageGutter, paddingVertical: 12 }}
      >
        {TABS.map(t => {
          const disabled = t.needsCourse && isNew;
          return (
            <Pressable
              key={t.key}
              disabled={disabled}
              onPress={() => setTab(t.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 999,
                borderWidth: 1,
                opacity: disabled ? 0.4 : 1,
                borderColor: tab === t.key ? palette.primary : palette.border,
                backgroundColor: tab === t.key ? palette.primarySoft : 'transparent',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 13, color: tab === t.key ? palette.primaryStrong : palette.subtext }}>{t.title}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={palette.primary} style={{ marginTop: 30 }} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: responsive.pageGutter, gap: 14, paddingBottom: 60 }}>
          {tab === 'details' ? (
            <EducationSectionCard palette={palette} eyebrow={isNew ? 'New course' : 'Course details'} title={isNew ? 'Create a course' : 'Edit course details'}>
            <View style={{ gap: 12, marginTop: 4 }}>
              <View>
                <FieldLabel>Cover image</FieldLabel>
                <Pressable
                  onPress={() => void pickCoverImage()}
                  style={{ height: 140, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
                >
                  {coverImageUrl ? (
                    <Image source={{ uri: coverImageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={{ alignItems: 'center', gap: 6 }}>
                      <KISIcon name="camera" size={20} color={palette.subtext} />
                      <Text style={{ color: palette.subtext, fontSize: 12 }}>{uploadingCover ? 'Uploading…' : 'Tap to add a cover image'}</Text>
                    </View>
                  )}
                </Pressable>
              </View>
              <View>
                <FieldLabel>Title</FieldLabel>
                <KISTextInput placeholder="Course title" value={title} onChangeText={setTitle} />
              </View>
              <View>
                <FieldLabel>Summary</FieldLabel>
                <KISTextInput placeholder="One-line summary" value={summary} onChangeText={setSummary} />
              </View>
              <View>
                <FieldLabel>Description</FieldLabel>
                <KISTextInput placeholder="Full description" value={description} onChangeText={setDescription} multiline style={{ minHeight: 90 }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Price (0 = free)</FieldLabel>
                  <KISTextInput placeholder="0" value={priceAmount} onChangeText={setPriceAmount} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Duration (minutes)</FieldLabel>
                  <KISTextInput placeholder="0" value={durationMinutes} onChangeText={setDurationMinutes} keyboardType="numeric" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Seat limit (blank = unlimited)</FieldLabel>
                  <KISTextInput placeholder="Unlimited" value={seatLimit} onChangeText={setSeatLimit} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Visibility</FieldLabel>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(['public', 'private'] as const).map(v => (
                      <Pressable
                        key={v}
                        onPress={() => setVisibility(v)}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center', borderColor: visibility === v ? palette.primary : palette.border, backgroundColor: visibility === v ? palette.primarySoft : 'transparent' }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'capitalize', color: visibility === v ? palette.primaryStrong : palette.subtext }}>{v}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
              {visibility === 'private' ? (
                <Text style={{ fontSize: 12, color: palette.subtext }}>
                  Private courses require the institution to approve each learner's access request.
                </Text>
              ) : null}
              <View>
                <FieldLabel>Program (optional)</FieldLabel>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  <Pressable
                    onPress={() => setProgramId(null)}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: !programId ? palette.primary : palette.border, backgroundColor: !programId ? palette.primarySoft : 'transparent' }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: !programId ? palette.primaryStrong : palette.subtext }}>None</Text>
                  </Pressable>
                  {programs.map(program => (
                    <Pressable
                      key={program.id}
                      onPress={() => setProgramId(program.id)}
                      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: programId === program.id ? palette.primary : palette.border, backgroundColor: programId === program.id ? palette.primarySoft : 'transparent' }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: programId === program.id ? palette.primaryStrong : palette.subtext }} numberOfLines={1}>{program.title}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <View style={{ flex: 1 }}>
                    <KISTextInput placeholder="New program name" value={newProgramTitle} onChangeText={setNewProgramTitle} />
                  </View>
                  <KISButton title={creatingProgram ? '…' : 'Add'} size="sm" disabled={creatingProgram} onPress={() => void createProgram()} />
                </View>
              </View>
              <View>
                <FieldLabel>Class (optional)</FieldLabel>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  <Pressable
                    onPress={() => setClassId(null)}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: !classId ? palette.primary : palette.border, backgroundColor: !classId ? palette.primarySoft : 'transparent' }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: !classId ? palette.primaryStrong : palette.subtext }}>None</Text>
                  </Pressable>
                  {classes.map(cls => (
                    <Pressable
                      key={cls.id}
                      onPress={() => setClassId(cls.id)}
                      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: classId === cls.id ? palette.primary : palette.border, backgroundColor: classId === cls.id ? palette.primarySoft : 'transparent' }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: classId === cls.id ? palette.primaryStrong : palette.subtext }} numberOfLines={1}>{cls.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <View style={{ flex: 1 }}>
                    <KISTextInput placeholder="New class name" value={newClassName} onChangeText={setNewClassName} />
                  </View>
                  <KISButton title={creatingClass ? '…' : 'Add'} size="sm" disabled={creatingClass} onPress={() => void createClass()} />
                </View>
              </View>
              <View>
                <FieldLabel>Status</FieldLabel>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['draft', 'published'] as const).map(s => (
                    <Pressable
                      key={s}
                      onPress={() => setStatus(s)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: status === s ? palette.primary : palette.border,
                        backgroundColor: status === s ? palette.primarySoft : 'transparent',
                      }}
                    >
                      <Text style={{ fontWeight: '700', fontSize: 13, textTransform: 'capitalize', color: status === s ? palette.primaryStrong : palette.subtext }}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={{ fontSize: 12, color: palette.subtext, marginTop: 6 }}>
                  {status === 'published' ? 'Visible and enrollable for learners once saved.' : 'Hidden from learners until Published.'}
                </Text>
              </View>
              <View style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: isLive ? palette.primary : palette.border, backgroundColor: isLive ? palette.primarySoft : palette.surface, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isLive ? palette.primaryStrong : palette.subtext }} />
                  <Text style={{ fontWeight: '800', color: palette.text, flex: 1 }}>
                    {isLive ? 'Live in Broadcast → Education' : 'Not live'}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: palette.subtext }}>
                  {isNew
                    ? 'Save this course first, then broadcast it to make it visible under the Education tab.'
                    : isLive
                      ? 'Learners can find and enroll in this course from the Education tab right now.'
                      : 'Broadcast this course to make it visible under the Education tab.'}
                </Text>
                <KISButton
                  title={togglingLive ? 'Working…' : isLive ? 'Remove from live' : 'Broadcast'}
                  variant={isLive ? 'outline' : 'primary'}
                  disabled={isNew || togglingLive}
                  loading={togglingLive}
                  onPress={() => void toggleBroadcastLive()}
                />
              </View>
              <KISButton title={saving ? 'Saving…' : isNew ? 'Create course' : 'Save changes'} disabled={saving} loading={saving} onPress={() => void saveDetails()} />
              {status === 'published' && Number(priceAmount) > 0 ? (
                <Text style={{ fontSize: 12, color: palette.subtext }}>
                  Publishing a priced course requires your institution's payout account to be connected — see Settings on the dashboard.
                </Text>
              ) : null}
            </View>
            </EducationSectionCard>
          ) : null}

          {tab === 'curriculum' ? (
            <View style={{ gap: 16 }}>
              {loadingCurriculum ? <ActivityIndicator color={palette.primary} /> : null}
              {modules.map((module, moduleIndex) => (
                <View key={module.id} style={{ gap: 8 }}>
                  <Text style={{ fontWeight: '800', color: palette.text }}>
                    Module {moduleIndex + 1}: {module.title}
                  </Text>
                  {(module.items ?? []).map((item: any, itemIndex: number) => (
                    <View
                      key={item.id}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: palette.border }}
                    >
                      <KISIcon name="check" size={14} color={palette.subtext} />
                      <Text style={{ color: palette.text, flex: 1 }} numberOfLines={1}>
                        {itemIndex + 1}. {item.title_override || item.item_type}
                      </Text>
                      <Text style={{ fontSize: 11, color: palette.subtext, textTransform: 'capitalize' }}>{item.item_type?.replace('_', ' ')}</Text>
                      <Pressable onPress={() => deleteModuleItem(item)} hitSlop={8} style={{ padding: 2 }}>
                        <KISIcon name="trash" size={15} color={palette.danger} />
                      </Pressable>
                    </View>
                  ))}

                  {addContentModuleId === module.id ? (
                    <View style={{ gap: 8, padding: 12, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }}>
                      <FieldLabel>What are you adding?</FieldLabel>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {ITEM_TYPES.map(type => (
                          <Pressable
                            key={type.key}
                            onPress={() => setAddContentType(type.key)}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: addContentType === type.key ? palette.primary : palette.border,
                              backgroundColor: addContentType === type.key ? palette.primarySoft : 'transparent',
                            }}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: addContentType === type.key ? palette.primaryStrong : palette.subtext }}>{type.title}</Text>
                          </Pressable>
                        ))}
                      </View>
                      {addContentType ? (
                        <>
                          <KISTextInput placeholder={`${addContentType.replace('_', ' ')} title`} value={newItemTitle} onChangeText={setNewItemTitle} />
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <KISButton title={saving ? 'Adding…' : 'Add to module'} disabled={saving} onPress={() => void createAndLinkItem()} />
                            <KISButton
                              title="Cancel"
                              variant="secondary"
                              onPress={() => {
                                setAddContentModuleId(null);
                                setAddContentType(null);
                                setNewItemTitle('');
                              }}
                            />
                          </View>
                        </>
                      ) : null}
                    </View>
                  ) : (
                    <KISButton title="+ Add content" size="sm" variant="outline" onPress={() => setAddContentModuleId(module.id)} />
                  )}
                </View>
              ))}
              <KISButton title="+ Add module" variant="outline" onPress={() => void createModule()} />
            </View>
          ) : null}

          {tab === 'content' && courseId ? <ContentEditor institutionId={institutionId} courseId={courseId} /> : null}
          {tab === 'assessments' && courseId ? <AssessmentsEditor institutionId={institutionId} courseId={courseId} /> : null}
          {tab === 'live' && courseId ? <LiveEditor institutionId={institutionId} courseId={courseId} courseTitle={title || 'Course'} /> : null}

          {tab === 'settings' ? (
            <View style={{ gap: 12 }}>
              <Text style={{ color: palette.subtext }}>
                Institution-level settings (payout, branding, membership policy) live on the Institution Settings screen, reached from the dashboard.
              </Text>
              <KISButton
                title="Open institution settings"
                variant="outline"
                onPress={() => navigation.navigate('EducationInstitutionSettings', { institutionId, institutionName })}
              />
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
