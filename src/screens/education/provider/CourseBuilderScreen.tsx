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
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
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
import ContentEditor from '@/screens/education/provider/course-builder/ContentEditor';
import AssessmentsEditor from '@/screens/education/provider/course-builder/AssessmentsEditor';
import LiveEditor from '@/screens/education/provider/course-builder/LiveEditor';
import type { RootStackParamList } from '@/navigation/types';

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
  const [programId, setProgramId] = useState<string | null>(null);
  const [programs, setPrograms] = useState<any[]>([]);
  const [newProgramTitle, setNewProgramTitle] = useState('');
  const [creatingProgram, setCreatingProgram] = useState(false);

  // Curriculum state
  const [modules, setModules] = useState<any[]>([]);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);
  const [addContentModuleId, setAddContentModuleId] = useState<string | null>(null);
  const [addContentType, setAddContentType] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');

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
        }
      })
      .finally(() => setLoading(false));
  }, [institutionId, courseId]);

  useEffect(() => {
    getRequest(ROUTES.broadcasts.educationInstitutionPrograms(institutionId), { forceNetwork: true }).then(response => {
      setPrograms(response?.data?.programs ?? []);
    });
  }, [institutionId]);

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
      const body = {
        title: title.trim(),
        summary: summary.trim(),
        description: description.trim(),
        price_amount: Number(priceAmount) || 0,
        duration_minutes: Number(durationMinutes) || 0,
        status,
        program_id: programId || null,
      };
      const response = courseId
        ? await patchRequest(ROUTES.broadcasts.educationInstitutionCourse(institutionId, courseId), body, { errorMessage: 'Unable to save course.' })
        : await postRequest(ROUTES.broadcasts.educationInstitutionCourses(institutionId), body, { errorMessage: 'Unable to create course.' });
      if (!response?.success) {
        Alert.alert('Course', response?.message || 'Unable to save course.');
        return;
      }
      const saved = response.data?.course;
      if (saved?.id && !courseId) {
        setCourseId(saved.id);
        setTab('curriculum');
      }
      Alert.alert('Course', 'Saved.');
    } finally {
      setSaving(false);
    }
  }, [title, summary, description, priceAmount, durationMinutes, status, programId, courseId, institutionId]);

  const createModule = useCallback(async () => {
    if (!courseId) return;
    const response = await postRequest(
      ROUTES.broadcasts.educationInstitutionCourseModules(institutionId, courseId),
      { title: `Module ${modules.length + 1}`, module_order: modules.length + 1, status: 'published' },
      { errorMessage: 'Unable to create module.' },
    );
    if (response?.success) await loadCurriculum();
  }, [institutionId, courseId, modules.length, loadCurriculum]);

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
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: responsive.pageGutter, paddingTop: 10 }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4, marginLeft: -4 }}>
          <KISIcon name="back" size={20} color={palette.text} />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '900', color: palette.text }} numberOfLines={1}>
          {isNew ? 'New course' : title || 'Course'}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: responsive.pageGutter, paddingVertical: 12 }}>
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
        <ScrollView contentContainerStyle={{ padding: responsive.pageGutter, gap: 14, paddingBottom: 60 }}>
          {tab === 'details' ? (
            <View style={{ gap: 12 }}>
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
              </View>
              <KISButton title={saving ? 'Saving…' : isNew ? 'Create course' : 'Save changes'} disabled={saving} loading={saving} onPress={() => void saveDetails()} />
              {status === 'published' && Number(priceAmount) > 0 ? (
                <Text style={{ fontSize: 12, color: palette.subtext }}>
                  Publishing a priced course requires your institution's payout account to be connected — see Settings on the dashboard.
                </Text>
              ) : null}
            </View>
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
          {tab === 'live' && courseId ? <LiveEditor institutionId={institutionId} courseId={courseId} /> : null}

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
