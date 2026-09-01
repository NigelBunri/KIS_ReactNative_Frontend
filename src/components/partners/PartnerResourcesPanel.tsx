// src/components/partners/PartnerResourcesPanel.tsx
//
// Resource Library & Knowledge Base — files and written articles in one
// place, filterable by category. Files go through the same presigned-S3
// pipeline every other upload in this codebase uses.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import DocumentPicker, { DocumentPickerResponse } from 'react-native-document-picker';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { uploadPartnerResourceMedia, ResourceUploadProgress } from '@/services/uploadPartnerResourceMedia';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  canManage?: boolean;
  onClose: () => void;
};

type ResourceKind = 'file' | 'article';
type Resource = {
  id: number;
  kind: ResourceKind;
  title: string;
  category?: string;
  body?: string;
  file_name?: string;
  file_url?: string | null;
  mime_type?: string;
  size_bytes?: number;
  created_by_name?: string | null;
  created_at: string;
};

const formatBytes = (n?: number) => {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

export default function PartnerResourcesPanel({ isOpen, panelWidth, panelTranslateX, partnerId, canManage, onClose }: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [kindFilter, setKindFilter] = useState<ResourceKind | 'all'>('all');

  const [showCreate, setShowCreate] = useState(false);
  const [newKind, setNewKind] = useState<ResourceKind>('article');
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newBody, setNewBody] = useState('');
  const [pickedFile, setPickedFile] = useState<DocumentPickerResponse | null>(null);
  const [uploadProgress, setUploadProgress] = useState<ResourceUploadProgress | null>(null);
  const [saving, setSaving] = useState(false);

  const backdropOpacity = panelTranslateX.interpolate({ inputRange: [0, panelWidth], outputRange: [1, 0], extrapolate: 'clamp' });

  const load = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(
      ROUTES.partners.resources(partnerId, kindFilter === 'all' ? undefined : { kind: kindFilter }),
      { errorMessage: 'Unable to load resources.' },
    );
    const payload = (res?.data ?? res ?? []) as Resource[];
    setResources(Array.isArray(payload) ? payload : []);
  }, [partnerId, kindFilter]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isOpen, load]);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.pick({ type: [DocumentPicker.types.allFiles], allowMultiSelection: false, copyTo: 'cachesDirectory' });
      const file = Array.isArray(result) ? result[0] : result;
      setPickedFile(file);
    } catch (err: any) {
      if (DocumentPicker.isCancel(err)) return;
      Alert.alert('Unable to pick file', 'Please try again.');
    }
  };

  const createResource = async () => {
    if (!partnerId || !newTitle.trim()) {
      Alert.alert('Missing info', 'A title is required.');
      return;
    }
    if (newKind === 'file' && !pickedFile) {
      Alert.alert('Missing file', 'Pick a file to upload.');
      return;
    }
    setSaving(true);
    try {
      let assetId: string | undefined;
      if (newKind === 'file' && pickedFile) {
        const meta = await uploadPartnerResourceMedia({
          file: { uri: pickedFile.fileCopyUri || pickedFile.uri, name: pickedFile.name, type: pickedFile.type, size: pickedFile.size },
          onProgress: setUploadProgress,
        });
        assetId = meta.mediaId;
      }
      const res = await postRequest(
        ROUTES.partners.resources(partnerId),
        { kind: newKind, title: newTitle.trim(), category: newCategory.trim(), body: newBody.trim(), asset_id: assetId },
        { errorMessage: 'Unable to save resource.' },
      );
      if (!res?.success) {
        Alert.alert('Failed', res?.message ?? 'Unable to save resource.');
        return;
      }
      setNewTitle('');
      setNewCategory('');
      setNewBody('');
      setPickedFile(null);
      setUploadProgress(null);
      setShowCreate(false);
      load();
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        Alert.alert('Upload failed', err?.message ?? 'Unable to save resource.');
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteResource = (resource: Resource) => {
    if (!partnerId) return;
    Alert.alert('Delete resource?', `"${resource.title}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { deleteRequest } = await import('@/network/delete');
          const res = await deleteRequest(ROUTES.partners.resourceDetail(partnerId, String(resource.id)), { errorMessage: 'Unable to delete resource.' });
          if (!res?.success) {
            Alert.alert('Failed', res?.message ?? 'Unable to delete resource.');
            return;
          }
          load();
        },
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.settingsPanelBackdrop, { backgroundColor: palette.backdrop, opacity: backdropOpacity }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          { width: panelWidth, backgroundColor: palette.surfaceElevated, borderLeftColor: palette.divider, transform: [{ translateX: panelTranslateX }] },
        ]}
      >
        <View style={[styles.settingsPanelHeader, { borderBottomColor: palette.divider }]}>
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Resource Library</Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>Files and knowledge base articles</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
            {(['all', 'article', 'file'] as const).map((k) => (
              <Pressable
                key={k}
                onPress={() => setKindFilter(k)}
                style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: kindFilter === k ? palette.primary : palette.borderMuted }}
              >
                <Text style={{ color: kindFilter === k ? palette.primary : palette.text, fontSize: 12 }}>
                  {k === 'all' ? 'All' : k === 'article' ? 'Articles' : 'Files'}
                </Text>
              </Pressable>
            ))}
          </View>

          {canManage ? (
            <View style={{ marginBottom: 16 }}>
              <Pressable onPress={() => setShowCreate((v) => !v)}>
                <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '700', marginBottom: showCreate ? 8 : 0 }}>
                  {showCreate ? '− Cancel' : '+ New resource'}
                </Text>
              </Pressable>
              {showCreate ? (
                <View style={{ marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                    {(['article', 'file'] as const).map((k) => (
                      <Pressable
                        key={k}
                        onPress={() => setNewKind(k)}
                        style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: newKind === k ? palette.primary : palette.borderMuted }}
                      >
                        <Text style={{ color: newKind === k ? palette.primary : palette.text, fontSize: 12 }}>{k === 'article' ? 'Article' : 'File'}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={newTitle}
                    onChangeText={setNewTitle}
                    placeholder="Title"
                    placeholderTextColor={palette.subtext}
                    style={[styles.settingsTextInput, { borderColor: palette.borderMuted, color: palette.text, marginTop: 0 }]}
                  />
                  <TextInput
                    value={newCategory}
                    onChangeText={setNewCategory}
                    placeholder="Category (optional)"
                    placeholderTextColor={palette.subtext}
                    style={[styles.settingsTextInput, { borderColor: palette.borderMuted, color: palette.text }]}
                  />
                  {newKind === 'article' ? (
                    <TextInput
                      value={newBody}
                      onChangeText={setNewBody}
                      placeholder="Write the article…"
                      placeholderTextColor={palette.subtext}
                      multiline
                      style={[styles.settingsTextInput, { borderColor: palette.borderMuted, color: palette.text, minHeight: 90, textAlignVertical: 'top' }]}
                    />
                  ) : (
                    <View style={{ marginTop: 8 }}>
                      <Pressable
                        onPress={pickFile}
                        style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: palette.text, alignSelf: 'flex-start' }}
                      >
                        <Text style={{ color: palette.text, fontWeight: '700', fontSize: 12 }}>
                          {pickedFile ? pickedFile.name : '+ Choose file'}
                        </Text>
                      </Pressable>
                      {uploadProgress ? (
                        <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>
                          {uploadProgress.status}{uploadProgress.status === 'uploading' ? ` ${Math.round(uploadProgress.progress * 100)}%` : ''}
                        </Text>
                      ) : null}
                    </View>
                  )}
                  <Pressable
                    onPress={createResource}
                    disabled={saving}
                    style={({ pressed }) => [{ marginTop: 10, paddingVertical: 10, borderRadius: 10, backgroundColor: palette.royalInk, alignItems: 'center', opacity: pressed || saving ? 0.7 : 1 }]}
                  >
                    <Text style={{ color: palette.ivory, fontWeight: '700' }}>{saving ? 'Saving…' : 'Save resource'}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : resources.length === 0 ? (
            <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginTop: 20 }}>Nothing here yet.</Text>
          ) : (
            resources.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => r.kind === 'file' && r.file_url && Linking.openURL(r.file_url)}
                style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}
              >
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]} numberOfLines={1}>
                  {r.kind === 'file' ? '📎 ' : '📄 '}{r.title}
                </Text>
                {r.kind === 'article' && r.body ? (
                  <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }} numberOfLines={3}>{r.body}</Text>
                ) : null}
                <Text style={{ color: palette.subtext, fontSize: 10, marginTop: 4 }}>
                  {r.category ? `${r.category} · ` : ''}{r.kind === 'file' ? `${r.mime_type || ''} ${formatBytes(r.size_bytes)}` : ''}
                  {r.created_by_name ? ` · by ${r.created_by_name}` : ''}
                </Text>
                {canManage ? (
                  <Pressable onPress={() => deleteResource(r)} style={{ marginTop: 6 }}>
                    <Text style={{ color: palette.danger, fontSize: 11, fontWeight: '700' }}>Delete</Text>
                  </Pressable>
                ) : null}
              </Pressable>
            ))
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
