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
import ROUTES, { useMediaHeaders } from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import { uploadEducationMedia } from '@/services/uploadEducationMedia';
import { inferMaterialKind } from '@/screens/broadcast/education/utils/materialPreview';
import MaterialViewer from '@/screens/education/shared/MaterialViewer';

function FieldLabel({ children }: { children: React.ReactNode }) {
  const { palette } = useKISTheme();
  return <Text style={{ fontSize: 12, fontWeight: '700', color: palette.subtext, marginBottom: 4 }}>{children}</Text>;
}

// Chip row used both when creating a material and when re-attaching an
// existing one — a material can belong to at most one lesson here (the
// backend also supports a lesson_ids many-link, but a single "which lesson
// is this material's home" choice is what the provider actually needs).
function LessonChipPicker({
  lessons,
  selectedId,
  onSelect,
}: {
  lessons: any[];
  selectedId: string | null;
  onSelect: (lessonId: string | null) => void;
}) {
  const { palette } = useKISTheme();
  const chips: Array<{ id: string | null; title: string }> = [
    { id: null, title: 'No lesson (course-wide)' },
    ...lessons.map(l => ({ id: l.id as string, title: l.title as string })),
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {chips.map(chip => {
        const selected = selectedId === chip.id;
        return (
          <Pressable
            key={chip.id ?? 'none'}
            onPress={() => onSelect(chip.id)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: selected ? palette.primary : palette.border,
              backgroundColor: selected ? palette.primarySoft : 'transparent',
            }}
          >
            <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: selected ? palette.primaryStrong : palette.subtext, maxWidth: 160 }}>
              {chip.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type Props = { institutionId: string; courseId: string };

export default function ContentEditor({ institutionId, courseId }: Props) {
  const { palette } = useKISTheme();
  const [lessons, setLessons] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [lessonDraft, setLessonDraft] = useState<{ title: string; summary: string; content: string; isPreview: boolean }>({ title: '', summary: '', content: '', isPreview: false });
  const [savingLesson, setSavingLesson] = useState(false);
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialUrl, setMaterialUrl] = useState('');
  const [materialLessonId, setMaterialLessonId] = useState<string | null>(null);
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string; type: string; size?: number } | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [attachingMaterialId, setAttachingMaterialId] = useState<string | null>(null);
  const [savingAttachment, setSavingAttachment] = useState(false);
  const [previewMaterialId, setPreviewMaterialId] = useState<string | null>(null);
  const mediaHeaders = useMediaHeaders();

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
    setLessonDraft({ title: lesson.title ?? '', summary: lesson.summary ?? '', content: lesson.content ?? '', isPreview: Boolean(lesson.is_preview) });
  };

  const saveLesson = useCallback(async () => {
    if (!expandedLessonId) return;
    setSavingLesson(true);
    try {
      const response = await patchRequest(
        ROUTES.broadcasts.educationInstitutionLesson(institutionId, expandedLessonId),
        { title: lessonDraft.title.trim(), summary: lessonDraft.summary.trim(), content: lessonDraft.content.trim(), is_preview: lessonDraft.isPreview },
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
      // PDF/video/audio/image — matches the backend's education-material
      // upload allowlist (apps/media/upload_intent.py), so a creator never
      // picks a file the server will then reject. The reason for the
      // allowlist at all: every material must be viewable inline via
      // MaterialViewer (below) rather than forcing a student to leave the
      // platform — MaterialViewer/inferMaterialKind already handle 'image'
      // (see materialPreview.ts), this picker just wasn't offering it yet.
      const document = await DocumentPicker.pickSingle({
        type: [
          DocumentPicker.types.pdf,
          DocumentPicker.types.video,
          DocumentPicker.types.audio,
          DocumentPicker.types.images,
        ],
      });
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
          lesson_id: materialLessonId ?? undefined,
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
      setMaterialLessonId(null);
      setPickedFile(null);
      setUploadStatus(null);
      await load();
    } finally {
      setSavingMaterial(false);
    }
  }, [materialTitle, materialUrl, materialLessonId, pickedFile, institutionId, courseId, load]);

  const deleteLesson = useCallback(
    (lesson: any) => {
      Alert.alert('Delete lesson', `Permanently delete "${lesson.title}"? This can't be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const response = await deleteRequest(ROUTES.broadcasts.educationInstitutionLesson(institutionId, lesson.id), {
              errorMessage: 'Unable to delete this lesson.',
            });
            if (response?.success || response === undefined) {
              if (expandedLessonId === lesson.id) setExpandedLessonId(null);
              await load();
            } else {
              Alert.alert('Delete lesson', response?.message || 'Unable to delete this lesson.');
            }
          },
        },
      ]);
    },
    [institutionId, expandedLessonId, load],
  );

  const deleteMaterial = useCallback(
    (material: any) => {
      Alert.alert('Delete material', `Permanently delete "${material.title}"? This can't be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const response = await deleteRequest(ROUTES.broadcasts.educationInstitutionMaterial(institutionId, material.id), {
              errorMessage: 'Unable to delete this material.',
            });
            if (response?.success || response === undefined) {
              if (previewMaterialId === material.id) setPreviewMaterialId(null);
              if (attachingMaterialId === material.id) setAttachingMaterialId(null);
              await load();
            } else {
              Alert.alert('Delete material', response?.message || 'Unable to delete this material.');
            }
          },
        },
      ]);
    },
    [institutionId, previewMaterialId, attachingMaterialId, load],
  );

  const attachMaterialToLesson = useCallback(
    async (materialId: string, lessonId: string | null) => {
      setSavingAttachment(true);
      try {
        const response = await patchRequest(
          ROUTES.broadcasts.educationInstitutionMaterial(institutionId, materialId),
          { lesson_id: lessonId ?? '' },
          { errorMessage: 'Unable to connect this material to a lesson.' },
        );
        if (!response?.success) {
          Alert.alert('Material', response?.message || 'Unable to connect this material to a lesson.');
          return;
        }
        setAttachingMaterialId(null);
        await load();
      } finally {
        setSavingAttachment(false);
      }
    },
    [institutionId, load],
  );

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
                <Pressable onPress={() => deleteLesson(lesson)} hitSlop={8}>
                  <KISIcon name="trash" size={15} color={palette.danger} />
                </Pressable>
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
                  <Pressable
                    onPress={() => setLessonDraft(d => ({ ...d, isPreview: !d.isPreview }))}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: lessonDraft.isPreview ? palette.primary : palette.border, backgroundColor: lessonDraft.isPreview ? palette.primarySoft : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {lessonDraft.isPreview ? <KISIcon name="check" size={13} color={palette.primary} /> : null}
                    </View>
                    <Text style={{ color: palette.text, fontSize: 13 }}>Free preview — visible before enrolling</Text>
                  </Pressable>
                  <KISButton title={savingLesson ? 'Saving…' : 'Save lesson'} disabled={savingLesson} loading={savingLesson} onPress={() => void saveLesson()} />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ fontWeight: '800', color: palette.text }}>Materials ({materials.length})</Text>
        <Text style={{ fontSize: 12, color: palette.subtext }}>
          A material only shows up inside a lesson once it's connected to that lesson below.
        </Text>
        {materials.map(material => {
          const connectedLesson = lessons.find(l => l.id === material.lesson_id);
          const attaching = attachingMaterialId === material.id;
          const previewing = previewMaterialId === material.id;
          return (
            <View key={material.id} style={{ gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: attaching ? palette.primary : palette.border, backgroundColor: palette.surface }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <KISIcon name="file" size={16} color={palette.primary} />
                <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>{material.title}</Text>
                <Text style={{ fontSize: 11, color: palette.subtext, textTransform: 'capitalize' }}>{material.kind}</Text>
                <Pressable onPress={() => deleteMaterial(material)} hitSlop={8}>
                  <KISIcon name="trash" size={15} color={palette.danger} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <Pressable onPress={() => setAttachingMaterialId(attaching ? null : material.id)}>
                  <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '700' }}>
                    {connectedLesson ? `Lesson: ${connectedLesson.title}` : 'Not connected to a lesson'} · {attaching ? 'Close' : 'Change'}
                  </Text>
                </Pressable>
                {material.resource_url || material.safe_resource_url ? (
                  <Pressable onPress={() => setPreviewMaterialId(previewing ? null : material.id)}>
                    <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '700' }}>
                      {previewing ? 'Hide preview' : 'Preview'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {attaching ? (
                <LessonChipPicker
                  lessons={lessons}
                  selectedId={material.lesson_id ?? null}
                  onSelect={lessonId => void attachMaterialToLesson(material.id, lessonId)}
                />
              ) : null}
              {savingAttachment && attaching ? <ActivityIndicator color={palette.primary} /> : null}
              {previewing ? (
                // Same viewer a student sees (MaterialViewer) — the creator
                // gets a real preview of exactly what will render for
                // learners, not just a filename/icon.
                <MaterialViewer material={material} mediaHeaders={mediaHeaders} hasAccess />
              ) : null}
            </View>
          );
        })}

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
            <View>
              <FieldLabel>Connect to a lesson</FieldLabel>
              <LessonChipPicker lessons={lessons} selectedId={materialLessonId} onSelect={setMaterialLessonId} />
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
                  setMaterialLessonId(null);
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
