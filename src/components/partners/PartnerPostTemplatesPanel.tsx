// src/components/partners/PartnerPostTemplatesPanel.tsx
//
// Post Templates: admins save reusable canned text (closures, welcome
// messages, event reminders) so they don't retype common announcements.
// "Copy" puts the body on the clipboard to paste into the feed composer
// or Broadcast Center — there's no cross-panel data channel to push it
// directly into another open panel's text field.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
};

type Template = { id: string | number; title: string; body: string; created_by_name?: string | null };

const inputStyle = (palette: any) => ({
  color: palette.text,
  borderColor: palette.borderMuted,
  borderWidth: 2,
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderRadius: 10,
  marginTop: 8,
});

export default function PartnerPostTemplatesPanel({ isOpen, panelWidth, panelTranslateX, partnerId, onClose }: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');

  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');

  const backdropOpacity = panelTranslateX.interpolate({ inputRange: [0, panelWidth], outputRange: [1, 0], extrapolate: 'clamp' });

  const load = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.postTemplates(partnerId), { errorMessage: 'Unable to load templates.' });
    const payload = res?.data ?? [];
    setTemplates(Array.isArray(payload) ? payload : []);
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isOpen, load]);

  const createTemplate = async () => {
    if (!partnerId || !newTitle.trim() || !newBody.trim()) {
      Alert.alert('Missing info', 'Title and body are required.');
      return;
    }
    setSaving(true);
    const res = await postRequest(
      ROUTES.partners.postTemplates(partnerId),
      { title: newTitle.trim(), body: newBody.trim() },
      { errorMessage: 'Unable to create template.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to create template.');
      return;
    }
    setNewTitle('');
    setNewBody('');
    setShowCreate(false);
    load();
  };

  const startEdit = (template: Template) => {
    setEditingId(template.id);
    setEditTitle(template.title);
    setEditBody(template.body);
  };

  const saveEdit = async () => {
    if (!partnerId || editingId === null) return;
    if (!editTitle.trim() || !editBody.trim()) {
      Alert.alert('Missing info', 'Title and body are required.');
      return;
    }
    setSaving(true);
    const res = await patchRequest(
      ROUTES.partners.postTemplateDetail(partnerId, String(editingId)),
      { title: editTitle.trim(), body: editBody.trim() },
      { errorMessage: 'Unable to update template.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to update template.');
      return;
    }
    setEditingId(null);
    load();
  };

  const deleteTemplate = (template: Template) => {
    if (!partnerId) return;
    Alert.alert('Delete template?', `"${template.title}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { deleteRequest } = await import('@/network/delete');
          const res = await deleteRequest(ROUTES.partners.postTemplateDetail(partnerId, String(template.id)), {
            errorMessage: 'Unable to delete template.',
          });
          if (!res?.success) {
            Alert.alert('Failed', res?.message ?? 'Unable to delete template.');
            return;
          }
          load();
        },
      },
    ]);
  };

  const copyTemplate = (template: Template) => {
    Clipboard.setString(template.body);
    Alert.alert('Copied', 'Template text copied — paste it into your post.');
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
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Templates</Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>Saved templates for posts</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <>
              <Pressable onPress={() => setShowCreate((v) => !v)}>
                <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '700', marginBottom: showCreate ? 8 : 12 }}>
                  {showCreate ? '− Cancel new template' : '+ New template'}
                </Text>
              </Pressable>
              {showCreate ? (
                <View style={{ marginBottom: 16 }}>
                  <TextInput value={newTitle} onChangeText={setNewTitle} placeholder="Template name" placeholderTextColor={palette.subtext} style={[inputStyle(palette), { marginTop: 0 }]} />
                  <TextInput value={newBody} onChangeText={setNewBody} placeholder="Template text" placeholderTextColor={palette.subtext} multiline style={[inputStyle(palette), { minHeight: 80, textAlignVertical: 'top' }]} />
                  <Pressable
                    onPress={createTemplate}
                    disabled={saving}
                    style={({ pressed }) => [{ marginTop: 10, paddingVertical: 10, borderRadius: 10, backgroundColor: palette.royalInk, alignItems: 'center', opacity: pressed || saving ? 0.7 : 1 }]}
                  >
                    <Text style={{ color: palette.ivory, fontWeight: '700' }}>{saving ? 'Creating…' : 'Create template'}</Text>
                  </Pressable>
                </View>
              ) : null}

              {templates.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginTop: 20 }}>No templates yet.</Text>
              ) : (
                templates.map((template) =>
                  editingId === template.id ? (
                    <View key={template.id} style={[styles.settingsFeatureRow, { borderColor: palette.primary, backgroundColor: palette.surface, marginBottom: 8 }]}>
                      <TextInput value={editTitle} onChangeText={setEditTitle} placeholderTextColor={palette.subtext} style={[inputStyle(palette), { marginTop: 0 }]} />
                      <TextInput value={editBody} onChangeText={setEditBody} multiline placeholderTextColor={palette.subtext} style={[inputStyle(palette), { minHeight: 70, textAlignVertical: 'top' }]} />
                      <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                        <Pressable onPress={saveEdit} disabled={saving}>
                          <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '700' }}>{saving ? 'Saving…' : 'Save'}</Text>
                        </Pressable>
                        <Pressable onPress={() => setEditingId(null)}>
                          <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '700' }}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View key={template.id} style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}>
                      <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>{template.title}</Text>
                      <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }} numberOfLines={3}>{template.body}</Text>
                      <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                        <Pressable onPress={() => copyTemplate(template)}>
                          <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '700' }}>Copy</Text>
                        </Pressable>
                        <Pressable onPress={() => startEdit(template)}>
                          <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>Edit</Text>
                        </Pressable>
                        <Pressable onPress={() => deleteTemplate(template)}>
                          <Text style={{ color: palette.danger, fontSize: 12, fontWeight: '700' }}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  ),
                )
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
