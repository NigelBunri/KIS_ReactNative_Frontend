import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import BibleSectionCard from './BibleSectionCard';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

type Course = {
  id: string;
  partner_name?: string;
  partner_display_name?: string;
  title: string;
  subtitle?: string;
  description?: string;
  cover_image?: string | null;
  level?: string;
  duration_minutes?: number;
  is_bible_course?: boolean;
  is_free?: boolean;
  is_public?: boolean;
  modules?: Module[];
  lessons?: Lesson[];
  enrollment_progress?: number | null;
  enrollment_status?: string | null;
};

type Module = {
  id: string;
  course: string;
  title: string;
  summary?: string;
  order: number;
};

type Lesson = {
  id: string;
  course: string;
  module?: string | null;
  module_detail?: Module | null;
  title: string;
  summary?: string;
  content?: string;
  transcript?: string;
  captions_url?: string;
  language?: string;
  order?: number;
  duration_minutes?: number;
  video_url?: string | null;
  audio_url?: string | null;
  attachments?: any;
  is_free?: boolean;
  completed?: boolean;
  last_position_ms?: number;
};

const listFromResponse = (data: any) => {
  const payload = data?.results ?? data ?? [];
  return Array.isArray(payload) ? payload : [];
};

const attachmentList = (value: any): Array<{ title: string; url: string }> => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        if (typeof item === 'string') return { title: `Attachment ${index + 1}`, url: item };
        return {
          title: item.title || item.name || item.label || `Attachment ${index + 1}`,
          url: item.url || item.file || item.href,
        };
      })
      .filter((item) => item.url);
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([title, url]) => ({ title, url: String(url) }))
      .filter((item) => item.url);
  }
  return [];
};

export default function BibleLessonsPanel() {
  const { palette } = useKISTheme();
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | 'all'>('all');
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [message, setMessage] = useState('');

  const loadCourses = async () => {
    setLoadingCourses(true);
    const res = await getRequest(`${ROUTES.bible.courses}?scope=bible`, {
      errorMessage: 'Unable to load KCAN foundational lessons.',
      forceNetwork: true,
    });
    setCourses(listFromResponse(res?.data));
    setLoadingCourses(false);
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const openCourse = async (course: Course) => {
    setSelectedCourse(course);
    setSelectedLesson(null);
    setSelectedModuleId('all');
    setLoadingContent(true);
    const [moduleRes, lessonRes] = await Promise.all([
      getRequest(`${ROUTES.bible.courseModules}?course=${course.id}`, {
        errorMessage: 'Unable to load course modules.',
        forceNetwork: true,
      }),
      getRequest(`${ROUTES.bible.lessons}?course=${course.id}`, {
        errorMessage: 'Unable to load course lessons.',
        forceNetwork: true,
      }),
    ]);
    const nextModules = listFromResponse(moduleRes?.data);
    const nextLessons = listFromResponse(lessonRes?.data);
    setModules(nextModules.length ? nextModules : course.modules ?? []);
    setLessons(nextLessons.length ? nextLessons : course.lessons ?? []);
    setSelectedLesson((nextLessons[0] ?? course.lessons?.[0]) || null);
    setLoadingContent(false);
  };

  const markProgress = async (lesson: Lesson, completed: boolean) => {
    const res = await postRequest(
      ROUTES.bible.lessonProgress,
      { lesson: lesson.id, completed, last_position_ms: lesson.last_position_ms || 0 },
      { errorMessage: 'Unable to update lesson progress.' },
    );
    setMessage(res?.success ? (completed ? 'Lesson marked complete.' : 'Lesson reopened.') : res?.message || 'Unable to update lesson progress.');
    if (res?.success) {
      setLessons((prev) => prev.map((item) => (item.id === lesson.id ? { ...item, completed } : item)));
      setSelectedLesson((prev) => (prev?.id === lesson.id ? { ...prev, completed } : prev));
    }
  };

  const filteredLessons = useMemo(() => {
    if (selectedModuleId === 'all') return lessons;
    return lessons.filter((lesson) => String(lesson.module || lesson.module_detail?.id || '') === selectedModuleId);
  }, [lessons, selectedModuleId]);

  const courseProgress = useMemo(() => {
    if (!lessons.length) return Number(selectedCourse?.enrollment_progress || 0);
    const completed = lessons.filter((lesson) => lesson.completed).length;
    return Math.round((completed / lessons.length) * 100);
  }, [lessons, selectedCourse?.enrollment_progress]);

  const renderCourseList = () => (
    <View style={styles.stack}>
      <BibleSectionCard>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: palette.text }]}>Lessons</Text>
            <Text style={{ color: palette.subtext, marginTop: 4 }}>
              KCAN foundational lessons for discipleship and biblical growth.
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: palette.primarySoft }]}>
            <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>KCAN</Text>
          </View>
        </View>
      </BibleSectionCard>

      {loadingCourses ? (
        <BibleSectionCard>
          <View style={styles.stateBox}>
            <ActivityIndicator color={palette.primaryStrong} />
            <Text style={{ color: palette.subtext }}>Loading KCAN lessons...</Text>
          </View>
        </BibleSectionCard>
      ) : null}

      {!loadingCourses && !courses.length ? (
        <BibleSectionCard>
          <View style={styles.stateBox}>
            <KISIcon name="layers" size={24} color={palette.subtext} />
            <Text style={{ color: palette.text, fontWeight: '900' }}>No foundational lessons published yet</Text>
            <Text style={{ color: palette.subtext, textAlign: 'center' }}>
              KCAN lessons will appear here after manual publishing.
            </Text>
          </View>
        </BibleSectionCard>
      ) : null}

      {courses.map((course) => {
        const progress = Math.max(0, Math.min(100, Number(course.enrollment_progress || 0)));
        return (
          <TouchableOpacity
            key={course.id}
            onPress={() => openCourse(course)}
            style={[styles.courseCard, { borderColor: palette.divider, backgroundColor: palette.surface }]}
          >
            {course.cover_image ? <Image source={{ uri: course.cover_image }} style={styles.cover} resizeMode="cover" /> : null}
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontSize: 18, fontWeight: '900' }}>{course.title}</Text>
                <Text style={{ color: palette.subtext, marginTop: 4 }} numberOfLines={2}>
                  {course.subtitle || course.description}
                </Text>
              </View>
              <KISIcon name="book" size={22} color={palette.primaryStrong} />
            </View>
            <Text style={{ color: palette.text, lineHeight: 22 }} numberOfLines={3}>
              {course.description}
            </Text>
            <View style={styles.metaRow}>
              <Text style={{ color: palette.subtext }}>{course.level || 'Foundation'}</Text>
              <Text style={{ color: palette.subtext }}>·</Text>
              <Text style={{ color: palette.subtext }}>{course.duration_minutes || 0} min</Text>
              <Text style={{ color: palette.subtext }}>·</Text>
              <Text style={{ color: palette.subtext }}>{course.lessons?.length || 0} lessons</Text>
            </View>
            {progress ? (
              <View style={styles.progressRow}>
                <View style={[styles.progressTrack, { backgroundColor: palette.divider }]}>
                  <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: palette.primaryStrong }]} />
                </View>
                <Text style={{ color: palette.subtext }}>{progress}%</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderLessonReader = () => {
    if (!selectedCourse) return null;
    const attachments = attachmentList(selectedLesson?.attachments);

    return (
      <View style={styles.stack}>
        <BibleSectionCard>
          <View style={styles.headerRow}>
            <KISButton title="Courses" size="xs" variant="outline" onPress={() => setSelectedCourse(null)} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: palette.text }]}>{selectedCourse.title}</Text>
              <Text style={{ color: palette.subtext, marginTop: 4 }}>
                {selectedCourse.partner_display_name || selectedCourse.partner_name || 'KCAN'}
              </Text>
            </View>
          </View>
          <View style={styles.progressRow}>
            <View style={[styles.progressTrack, { backgroundColor: palette.divider }]}>
              <View style={[styles.progressFill, { width: `${courseProgress}%`, backgroundColor: palette.primaryStrong }]} />
            </View>
            <Text style={{ color: palette.subtext }}>{courseProgress}%</Text>
          </View>
        </BibleSectionCard>

        {loadingContent ? (
          <BibleSectionCard>
            <View style={styles.stateBox}>
              <ActivityIndicator color={palette.primaryStrong} />
              <Text style={{ color: palette.subtext }}>Loading modules and lessons...</Text>
            </View>
          </BibleSectionCard>
        ) : null}

        <BibleSectionCard>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Modules</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
            <TouchableOpacity
              onPress={() => setSelectedModuleId('all')}
              style={[
                styles.optionChip,
                { borderColor: palette.divider, backgroundColor: selectedModuleId === 'all' ? palette.primarySoft : palette.surface },
              ]}
            >
              <Text style={{ color: selectedModuleId === 'all' ? palette.primaryStrong : palette.text, fontWeight: '800' }}>All</Text>
            </TouchableOpacity>
            {modules.map((module) => (
              <TouchableOpacity
                key={module.id}
                onPress={() => setSelectedModuleId(String(module.id))}
                style={[
                  styles.optionChip,
                  { borderColor: palette.divider, backgroundColor: selectedModuleId === String(module.id) ? palette.primarySoft : palette.surface },
                ]}
              >
                <Text style={{ color: selectedModuleId === String(module.id) ? palette.primaryStrong : palette.text, fontWeight: '800' }}>
                  {module.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredLessons.length ? (
            <View style={styles.stack}>
              {filteredLessons.map((lesson) => {
                const active = selectedLesson?.id === lesson.id;
                return (
                  <TouchableOpacity
                    key={lesson.id}
                    onPress={() => setSelectedLesson(lesson)}
                    style={[
                      styles.lessonRow,
                      {
                        borderColor: active ? palette.primaryStrong : palette.divider,
                        backgroundColor: active ? palette.primarySoft : 'transparent',
                      },
                    ]}
                  >
                    <KISIcon name={lesson.completed ? 'check' : 'book'} size={18} color={active ? palette.primaryStrong : palette.subtext} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '900' }}>
                        {lesson.title}
                      </Text>
                      <Text style={{ color: palette.subtext, marginTop: 3 }} numberOfLines={1}>
                        {lesson.summary || lesson.module_detail?.title || `${lesson.duration_minutes || 0} min`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={{ color: palette.subtext }}>No lessons in this module yet.</Text>
          )}
        </BibleSectionCard>

        {selectedLesson ? (
          <BibleSectionCard>
            <Text style={[styles.lessonTitle, { color: palette.text }]}>{selectedLesson.title}</Text>
            <Text style={{ color: palette.subtext }}>
              {selectedLesson.module_detail?.title ? `${selectedLesson.module_detail.title} · ` : ''}
              {selectedLesson.duration_minutes || 0} min · {selectedLesson.language || 'en'}
            </Text>

            {selectedLesson.video_url ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(selectedLesson.video_url as string)}
                style={[styles.mediaBox, { borderColor: palette.divider, backgroundColor: palette.surface }]}
              >
                <KISIcon name="play" size={28} color={palette.primaryStrong} />
                <Text style={{ color: palette.text, fontWeight: '900' }}>Open lesson video</Text>
              </TouchableOpacity>
            ) : null}

            {selectedLesson.audio_url ? (
              <KISButton
                title="Open audio"
                size="sm"
                variant="secondary"
                onPress={() => Linking.openURL(selectedLesson.audio_url as string)}
              />
            ) : null}

            {selectedLesson.summary ? (
              <View style={[styles.callout, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
                <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>Summary</Text>
                <Text style={{ color: palette.text, lineHeight: 23, marginTop: 4 }}>{selectedLesson.summary}</Text>
              </View>
            ) : null}

            {selectedLesson.content ? (
              <View style={styles.copyBlock}>
                <Text style={[styles.blockLabel, { color: palette.subtext }]}>Lesson</Text>
                <Text style={[styles.copy, { color: palette.text }]}>{selectedLesson.content}</Text>
              </View>
            ) : null}

            {selectedLesson.transcript ? (
              <View style={styles.copyBlock}>
                <Text style={[styles.blockLabel, { color: palette.subtext }]}>Transcript</Text>
                <Text style={[styles.copy, { color: palette.text }]}>{selectedLesson.transcript}</Text>
              </View>
            ) : null}

            {attachments.length ? (
              <View style={styles.stack}>
                <Text style={[styles.blockLabel, { color: palette.subtext }]}>Attachments</Text>
                {attachments.map((attachment) => (
                  <TouchableOpacity
                    key={`${attachment.title}-${attachment.url}`}
                    onPress={() => Linking.openURL(attachment.url)}
                    style={[styles.attachmentRow, { borderColor: palette.divider }]}
                  >
                    <KISIcon name="download" size={16} color={palette.primaryStrong} />
                    <Text style={{ color: palette.text, flex: 1, fontWeight: '800' }}>{attachment.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <View style={styles.optionRow}>
              <KISButton
                title={selectedLesson.completed ? 'Reopen lesson' : 'Mark complete'}
                size="sm"
                onPress={() => markProgress(selectedLesson, !selectedLesson.completed)}
              />
              {selectedLesson.captions_url ? (
                <KISButton
                  title="Captions"
                  size="sm"
                  variant="outline"
                  onPress={() => Linking.openURL(selectedLesson.captions_url as string)}
                />
              ) : null}
            </View>
            {message ? <Text style={{ color: palette.primaryStrong, fontWeight: '800' }}>{message}</Text> : null}
          </BibleSectionCard>
        ) : !loadingContent ? (
          <BibleSectionCard>
            <View style={styles.stateBox}>
              <KISIcon name="book" size={24} color={palette.subtext} />
              <Text style={{ color: palette.text, fontWeight: '900' }}>No lesson selected</Text>
              <Text style={{ color: palette.subtext, textAlign: 'center' }}>
                Select a lesson from a module to begin reading.
              </Text>
            </View>
          </BibleSectionCard>
        ) : null}
      </View>
    );
  };

  return selectedCourse ? renderLessonReader() : renderCourseList();
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '900' },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  lessonTitle: { fontSize: 24, fontWeight: '900', lineHeight: 30 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  courseCard: { borderWidth: 2, borderRadius: 12, padding: 12, gap: 10 },
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { flex: 1, height: 7, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 7, borderRadius: 999 },
  stateBox: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 10 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { borderWidth: 2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  lessonRow: { borderWidth: 2, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mediaBox: { borderWidth: 2, borderRadius: 12, minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 8 },
  callout: { borderWidth: 2, borderRadius: 12, padding: 12 },
  copyBlock: { gap: 6 },
  blockLabel: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  copy: { lineHeight: 25 },
  attachmentRow: { borderWidth: 2, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
