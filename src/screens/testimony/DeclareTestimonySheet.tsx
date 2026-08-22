import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import Video from 'react-native-video';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import { uploadTestimonyMedia, type TestimonyUploadProgress } from '@/services/uploadTestimonyMedia';

const CATEGORY_LABELS: Record<string, string> = {
  health: 'Health & Medical',
  finances: 'Financial Hardship',
  relationships: 'Relationships & Marriage',
  faith: 'Faith & Spirituality',
  business: 'Business & Career',
  grief: 'Loss & Grief',
  addiction: 'Addiction & Recovery',
  family: 'Family & Parenting',
  mental_health: 'Mental Health',
  other: 'Other',
};
const CATEGORIES = Object.keys(CATEGORY_LABELS);
const CATEGORY_EMOJI: Record<string, string> = {
  health: '🏥',
  finances: '💰',
  relationships: '💑',
  faith: '🙏',
  business: '💼',
  grief: '🕊️',
  addiction: '🌱',
  family: '👨‍👩‍👧',
  mental_health: '🧠',
  other: '💙',
};

export default function DeclareTestimonySheet() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'DeclareTestimonySheet'>>();
  const editId = route.params?.editId;
  const isEdit = Boolean(editId);

  const [category, setCategory] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [openToContact, setOpenToContact] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Existing attachment (when editing) — mediaKind/existingMediaUrl reflect
  // what's already saved; pendingFile is a newly picked, not-yet-uploaded
  // replacement. Only one attachment per testimony, so picking a new file
  // simply replaces whichever is currently set.
  const [mediaKind, setMediaKind] = useState<'none' | 'video' | 'file'>('none');
  const [existingMediaUrl, setExistingMediaUrl] = useState('');
  const [pendingFile, setPendingFile] = useState<{
    uri: string; name?: string | null; type?: string | null; size?: number | null; pickedKind: 'video' | 'file';
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<TestimonyUploadProgress | null>(null);

  const styles = useMemo(() => makeStyles(palette), [palette]);

  useEffect(() => {
    if (!editId) return;
    getRequest(ROUTES.testimony.testimonyDetail(editId))
      .then(res => {
        if (res?.success && res.data) {
          const d = res.data;
          setCategory(d.category ?? null);
          setTitle(d.title ?? '');
          setStory(d.story ?? '');
          setOpenToContact(d.open_to_contact !== false);
          setMediaKind(d.media_kind ?? 'none');
          setExistingMediaUrl(d.safe_resource_url ?? '');
        }
      })
      .catch(() => {});
  }, [editId]);

  const canSubmit = Boolean(category && title.trim()) && !uploading;

  const handlePickVideo = useCallback(async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'video', videoQuality: 'medium' });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      setPendingFile({ uri: asset.uri, name: asset.fileName, type: asset.type, size: asset.fileSize, pickedKind: 'video' });
    } catch (error: any) {
      Alert.alert('Testimony', error?.message || 'Unable to pick video.');
    }
  }, []);

  const handlePickFile = useCallback(async () => {
    try {
      const document = await DocumentPicker.pickSingle({ type: [DocumentPicker.types.allFiles], copyTo: 'documentDirectory' });
      const uri = document.fileCopyUri || document.uri;
      setPendingFile({ uri, name: document.name, type: document.type, size: document.size, pickedKind: 'file' });
    } catch (error: any) {
      if (DocumentPicker.isCancel?.(error)) return;
      Alert.alert('Testimony', error?.message || 'Unable to pick file.');
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      let resourceAttachment: { media_id: string } | undefined;
      if (pendingFile) {
        setUploading(true);
        try {
          const uploaded = await uploadTestimonyMedia({
            file: { uri: pendingFile.uri, name: pendingFile.name, type: pendingFile.type, size: pendingFile.size },
            onProgress: setUploadProgress,
          });
          resourceAttachment = { media_id: uploaded.mediaId };
        } finally {
          setUploading(false);
          setUploadProgress(null);
        }
      }
      const payload: Record<string, unknown> = {
        category,
        title: title.trim(),
        story: story.trim(),
        open_to_contact: openToContact,
      };
      if (resourceAttachment) payload.resource_attachment = resourceAttachment;
      const res = isEdit && editId
        ? await patchRequest(ROUTES.testimony.testimonyDetail(editId), payload)
        : await postRequest(ROUTES.testimony.testimonies, payload);
      if (res?.success) {
        if (!isEdit) {
          Alert.alert('Thank you 🙏', 'Your testimony is now visible to people who need it.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          navigation.goBack();
        }
      } else {
        Alert.alert('Error', res?.message ?? 'Unable to save testimony.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Unable to save testimony.');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, category, title, story, openToContact, isEdit, editId, navigation, pendingFile]);

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: palette.bg, }]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        style={{ backgroundColor: palette.bg, }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>
            {isEdit ? 'Edit Testimony' : 'Share Your Testimony'}
          </Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <KISIcon name="close" size={22} color={palette.text} />
          </Pressable>
        </View>

        <Text style={[styles.intro, { color: palette.subtext }]}>
          Your story is someone else's survival guide.
        </Text>

        <Text style={[styles.sectionLabel, { color: palette.text }]}>Category</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map(cat => {
            const selected = category === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[
                  styles.categoryChip,
                  {
                    borderColor: selected ? palette.primary : palette.border,
                    backgroundColor: selected ? palette.primaryStrong + '22' : palette.surface,
                    borderWidth: selected ? 2 : 1,
                  },
                ]}
              >
                <Text style={styles.categoryEmoji}>{CATEGORY_EMOJI[cat]}</Text>
                <Text style={[styles.categoryLabel, { color: selected ? palette.primary : palette.text }]} numberOfLines={2}>
                  {CATEGORY_LABELS[cat]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: palette.text }]}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="What did you overcome?"
          placeholderTextColor={palette.subtext}
          style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }]}
        />

        <Text style={[styles.sectionLabel, { color: palette.text }]}>Your Story</Text>
        <TextInput
          value={story}
          onChangeText={setStory}
          placeholder="Share your story — what happened, how you got through it, and what you'd tell someone in it right now..."
          placeholderTextColor={palette.subtext}
          multiline
          numberOfLines={6}
          style={[styles.storyInput, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }]}
          textAlignVertical="top"
        />

        <Text style={[styles.sectionLabel, { color: palette.text }]}>Video or file (optional)</Text>
        {pendingFile ? (
          <View style={[styles.mediaPreviewBox, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            {pendingFile.pickedKind === 'video' ? (
              <Video source={{ uri: pendingFile.uri }} style={styles.videoPreview} controls paused resizeMode="cover" />
            ) : (
              <Text style={[styles.mediaFileName, { color: palette.text }]} numberOfLines={1}>
                {pendingFile.name || 'Selected file'}
              </Text>
            )}
            <Pressable onPress={() => setPendingFile(null)} style={styles.mediaRemoveBtn}>
              <Text style={{ color: palette.danger, fontWeight: '700', fontSize: 13 }}>Remove</Text>
            </Pressable>
          </View>
        ) : mediaKind !== 'none' && existingMediaUrl ? (
          <View style={[styles.mediaPreviewBox, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            {mediaKind === 'video' ? (
              <Video source={{ uri: existingMediaUrl }} style={styles.videoPreview} controls paused resizeMode="cover" />
            ) : (
              <Text style={[styles.mediaFileName, { color: palette.text }]} numberOfLines={1}>
                Attached file
              </Text>
            )}
            <Text style={[styles.mediaHint, { color: palette.subtext }]}>Pick a new video or file below to replace it.</Text>
          </View>
        ) : null}
        {uploading ? (
          <View style={styles.uploadRow}>
            <ActivityIndicator size="small" color={palette.primary} />
            <Text style={[styles.mediaHint, { color: palette.subtext }]}>
              {uploadProgress?.status === 'uploading'
                ? `Uploading… ${Math.round((uploadProgress.progress || 0) * 100)}%`
                : uploadProgress?.status === 'confirming'
                ? 'Confirming…'
                : 'Preparing…'}
            </Text>
          </View>
        ) : (
          <View style={styles.mediaButtonRow}>
            <Pressable
              onPress={handlePickVideo}
              style={[styles.mediaPickBtn, { borderColor: palette.border, backgroundColor: palette.surface }]}
            >
              <Text style={[styles.mediaPickBtnText, { color: palette.text }]}>🎥 Add video</Text>
            </Pressable>
            <Pressable
              onPress={handlePickFile}
              style={[styles.mediaPickBtn, { borderColor: palette.border, backgroundColor: palette.surface }]}
            >
              <Text style={[styles.mediaPickBtnText, { color: palette.text }]}>📎 Add file</Text>
            </Pressable>
          </View>
        )}

        <View style={[styles.contactRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.contactLabel, { color: palette.text }]}>I'm open to being contacted</Text>
            <Text style={[styles.contactSub, { color: palette.subtext }]}>
              People going through this can see your offer to help
            </Text>
          </View>
          <Switch
            value={openToContact}
            onValueChange={setOpenToContact}
            trackColor={{ false: palette.divider, true: palette.primary }}
            thumbColor={palette.ivory}
          />
        </View>

        <Pressable
          disabled={!canSubmit || submitting}
          onPress={handleSubmit}
          style={[
            styles.submitBtn,
            { backgroundColor: canSubmit ? palette.primaryStrong : palette.divider },
          ]}
        >
          <Text style={styles.submitBtnText}>
            {uploading ? 'Uploading…' : submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Share Testimony'}
          </Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any) {
  return StyleSheet.create({
    content: { paddingHorizontal: 16, paddingBottom: 60, gap: 14 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 4 },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    intro: { fontSize: 14, lineHeight: 20 },
    sectionLabel: { fontSize: 15, fontWeight: '700', marginTop: 4 },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    categoryChip: { width: '47%', borderRadius: 12, padding: 12, alignItems: 'center', gap: 6 },
    categoryEmoji: { fontSize: 22 },
    categoryLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
    storyInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 140 },
    contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
    contactLabel: { fontSize: 15, fontWeight: '700' },
    contactSub: { fontSize: 13, marginTop: 2 },
    submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
    submitBtnText: { color: palette.onPrimary, fontWeight: '800', fontSize: 16 },
    mediaButtonRow: { flexDirection: 'row', gap: 10 },
    mediaPickBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    mediaPickBtnText: { fontWeight: '700', fontSize: 14 },
    mediaPreviewBox: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
    videoPreview: { width: '100%', height: 180, borderRadius: 10, backgroundColor: '#000' },
    mediaFileName: { fontSize: 14, fontWeight: '600' },
    mediaHint: { fontSize: 12 },
    mediaRemoveBtn: { alignSelf: 'flex-start' },
    uploadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  });
}
