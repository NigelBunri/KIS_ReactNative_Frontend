// src/screens/education/provider/course-builder/ContentEditor.tsx
//
// Education UX v2, Phase 3 — real editor for a course's lessons and
// materials, replacing the Content tab's "go use Curriculum" pointer.
// Reuses the same production upload service the old
// EducationManagementModal used (src/services/uploadEducationMedia.ts) —
// this is a standalone shared service, not something extracted out of the
// modal, so wiring it in here duplicates zero business logic.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { uploadEducationMedia } from '@/services/uploadEducationMedia';
import { inferMaterialKind } from '@/screens/broadcast/education/utils/materialPreview';

function FieldLabel({ children }: { children: React.ReactNode }) {
  const { palette } = useKISTheme();
  return <Text style={{ fontSize: 12, fontWeight: '700', color: palette.subtext, marginBottom: 4 }}>{children}</Text>;
}

type Props = { institutionId: string; courseId: string };

export default function ContentEditor({ institutionId, courseId }: Props) {
  const { palette } = useKISTheme();
  const [lessons, setLessons] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [lessonDraft, setLessonDraft] = useState<{ title: string; summary: string; content: string }>({ title: '', summary: '', content: '' });
  const [savingLesson, setSavingLesson] = useState(false);
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialUrl, setMaterialUrl] = useState('');
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string; type: string; size?: number } | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [savingMaterial, setSavingMaterial] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lessonsRes, materialsRes] = await Promise.all([
        getRequest(`${ROUTES.broadcasts.educationInstitutionLessons(institutionId)}?course_id=${courseId}`, { forceNetwork: true }),
        getRequest(`${ROUTES.broadcasts.educationInstitutionMaterials(institutionId)}?course_id=${courseId}`, { forceNetwork: true }),
      ]);
      setLessons(lessonsRes?.data?.lessons ?? []);
      setMaterials(materialsRes?.data?.materials ?? []);
    } finally {
      setLoading(false);
    }
  }, [institutionId, courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const openLesson = (lesson: any) => {
    if (expandedLessonId === lesson.id) {
      setExpandedLessonId(null);
      return;
    }
    setExpandedLessonId(lesson.id);
    setLessonDraft({ title: lesson.title ?? '', summary: lesson.summary ?? '', content: lesson.content ?? '' });
  };

  const saveLesson = useCallback(async () => {
    if (!expandedLessonId) return;
    setSavingLesson(true);
    try {
      const response = await patchRequest(
        ROUTES.broadcasts.educationInstitutionLesson(institutionId, expandedLessonId),
        { title: lessonDraft.title.trim(), summary: lessonDraft.summary.trim(), content: lessonDraft.content.trim() },
        { errorMessage: 'Unable to save lesson.' },
      );
      if (response?.success) {
        setExpandedLessonId(null);
        await load();
      }
    } finally {
      setSavingLesson(false);
    }
  }, [expandedLessonId, lessonDraft, institutionId, load]);

  const pickMaterialFile = useCallback(async () => {
    try {
      const document = await DocumentPicker.pickSingle({ type: [DocumentPicker.types.allFiles] });
      setPickedFile({
        uri: document.uri,
        name: document.name || `material-${Date.now()}`,
        type: document.type || 'application/octet-stream',
        size: document.size ?? undefined,
      });
      if (!materialTitle.trim() && document.name) setMaterialTitle(document.name);
    } catch (error: any) {
      if (DocumentPicker.isCancel?.(error)) return;
      Alert.alert('Material', error?.message || 'Unable to pick file.');
    }
  }, [materialTitle]);

  const saveMaterial = useCallback(async () => {
    if (!materialTitle.trim()) {
      Alert.alert('Material', 'Give this material a title first.');
      return;
    }
    if (!pickedFile && !materialUrl.trim()) {
      Alert.alert('Material', 'Either pick a file or paste a link.');
      return;
    }
    setSavingMaterial(true);
    try {
      let resourceAttachment: { media_id: string } | undefined;
      let kind = 'reference';
      if (pickedFile) {
        setUploadStatus('uploading');
        const uploaded = await uploadEducationMedia({
          context: 'education_material',
          file: pickedFile,
          institutionId,
          onProgress: update => setUploadStatus(update.status),
        });
        resourceAttachment = { media_id: uploaded.mediaId };
        kind = inferMaterialKind({ resource_mime_type: uploaded.mimeType, resource_name: uploaded.originalName });
      }
      const response = await postRequest(
        ROUTES.broadcasts.educationInstitutionMaterials(institutionId),
        {
          title: materialTitle.trim(),
          course_ids: [courseId],
          kind: pickedFile ? kind : 'link',
          resource_url: pickedFile ? undefined : materialUrl.trim(),
          resource_attachment: resourceAttachment,
          is_downloadable: true,
          status: 'published',
        },
        { errorMessage: 'Unable to save material.' },
      );
      if (!response?.success) {
        Alert.alert('Material', response?.message || 'Unable to save material.');
        return;
      }
      setAddingMaterial(false);
      setMaterialTitle('');
      setMaterialUrl('');
      setPickedFile(null);
      setUploadStatus(null);
      await load();
    } finally {
      setSavingMaterial(false);
    }
  }, [materialTitle, materialUrl, pickedFile, institutionId, courseId, load]);

  if (loading) {
    return <ActivityIndicator color={palette.primary} style={{ marginTop: 20 }} />;
  }

  return (
    <View style={{ gap: 20 }}>
      <Text style={{ fontSize: 12, color: palette.subtext }}>
        Edit any lesson or material's own fields here. To place one inside the curriculum a learner sees, use Curriculum's "+ Add content".
      </Text>
      <View style={{ gap: 10 }}>
        <Text style={{ fontWeight: '800', color: palette.text }}>Lessons ({lessons.length})</Text>
        {lessons.length === 0 ? (
          <Text style={{ color: palette.subtext, fontSize: 13 }}>
            Use Curriculum's "+ Add content" to create your first lesson.
          </Text>
        ) : null}
        {lessons.map(lesson => {
          const expanded = expandedLessonId === lesson.id;
          return (
            <View key={lesson.id} style={{ gap: 8 }}>
              <Pressable
                onPress={() => openLesson(lesson)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: expanded ? palette.primary : palette.border, backgroundColor: palette.surface }}
              >
                <KISIcon name="book" size={16} color={palette.primary} />
                <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>{lesson.title}</Text>
                <KISIcon name={expanded ? 'chevron-down' : 'chevron-right'} size={16} color={palette.subtext} />
              </Pressable>
              {expanded ? (
                <View style={{ gap: 10, padding: 12, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }}>
                  <View>
                    <FieldLabel>Title</FieldLabel>
                    <KISTextInput value={lessonDraft.title} onChangeText={t => setLessonDraft(d => ({ ...d, title: t }))} />
                  </View>
                  <View>
                    <FieldLabel>Summary</FieldLabel>
                    <KISTextInput value={lessonDraft.summary} onChangeText={t => setLessonDraft(d => ({ ...d, summary: t }))} />
                  </View>
                  <View>
                    <FieldLabel>Lesson content</FieldLabel>
                    <KISTextInput value={lessonDraft.content} onChangeText={t => setLessonDraft(d => ({ ...d, content: t }))} multiline style={{ minHeight: 120 }} />
                  </View>
                  <KISButton title={savingLesson ? 'Saving…' : 'Save lesson'} disabled={savingLesson} loading={savingLesson} onPress={() => void saveLesson()} />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ fontWeight: '800', color: palette.text }}>Materials ({materials.length})</Text>
        {materials.map(material => (
          <View key={material.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface }}>
            <KISIcon name="file" size={16} color={palette.primary} />
            <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>{material.title}</Text>
            <Text style={{ fontSize: 11, color: palette.subtext, textTransform: 'capitalize' }}>{material.kind}</Text>
          </View>
        ))}

        {addingMaterial ? (
          <View style={{ gap: 10, padding: 12, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }}>
            <View>
              <FieldLabel>Title</FieldLabel>
              <KISTextInput value={materialTitle} onChangeText={setMaterialTitle} />
            </View>
            <KISButton
              title={pickedFile ? `File: ${pickedFile.name}` : 'Pick a file to upload'}
              variant="outline"
              onPress={() => void pickMaterialFile()}
            />
            <Text style={{ fontSize: 12, color: palette.subtext, textAlign: 'center' }}>— or —</Text>
            <View>
              <FieldLabel>Paste a link instead</FieldLabel>
              <KISTextInput placeholder="https://…" value={materialUrl} onChangeText={setMaterialUrl} autoCapitalize="none" editable={!pickedFile} />
            </View>
            {uploadStatus ? <Text style={{ fontSize: 12, color: palette.subtext, textTransform: 'capitalize' }}>{uploadStatus}…</Text> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <KISButton title={savingMaterial ? 'Saving…' : 'Save material'} disabled={savingMaterial} loading={savingMaterial} onPress={() => void saveMaterial()} />
              <KISButton
                title="Cancel"
                variant="secondary"
                disabled={savingMaterial}
                onPress={() => {
                  setAddingMaterial(false);
                  setPickedFile(null);
                  setMaterialTitle('');
                  setMaterialUrl('');
                }}
              />
            </View>
          </View>
        ) : (
          <KISButton title="+ Add material" size="sm" variant="outline" onPress={() => setAddingMaterial(true)} />
        )}
      </View>
    </View>
  );
}
