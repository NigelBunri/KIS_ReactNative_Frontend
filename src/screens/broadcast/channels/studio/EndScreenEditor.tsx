// src/screens/broadcast/channels/studio/EndScreenEditor.tsx
//
// Data-management UI for end screen elements on a piece of content.
// (A visual canvas editor would require a native view; this manages elements as a list.)

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { putData as putRequest } from '@/network/put';

// ── Types ──────────────────────────────────────────────────────────────────────

type ElementType = 'video' | 'subscribe' | 'channel' | 'link';

type EndScreenElement = {
  id?: string;
  element_type: ElementType;
  x_pct?: number;
  y_pct?: number;
  width_pct?: number;
  height_pct?: number;
  target_url?: string;
  target_content_id?: string;
  start_seconds?: number;
  end_seconds?: number;
};

type EndScreen = {
  id?: string;
  elements: EndScreenElement[];
};

type Props = {
  contentId: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const ELEMENT_TYPES: ElementType[] = ['video', 'subscribe', 'channel', 'link'];

const elementTypeColor = (type: ElementType, p: any): string =>
  ({ video: p.primary, subscribe: p.danger, channel: p.primaryStrong, link: p.gold } as Record<ElementType, string>)[type] ?? p.subtext;

// ── Component ─────────────────────────────────────────────────────────────────

export default function EndScreenEditor({ contentId }: Props) {
  const { palette } = useKISTheme();
  const [endScreen, setEndScreen] = useState<EndScreen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formType, setFormType] = useState<ElementType>('video');
  const [formTargetUrl, setFormTargetUrl] = useState('');
  const [formStartSec, setFormStartSec] = useState('');
  const [formEndSec, setFormEndSec] = useState('');

  const fetchEndScreen = useCallback(async () => {
    if (!contentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(
        ROUTES.broadcasts.contentEndScreen(contentId),
        { errorMessage: '' },
      );
      const data = res?.data ?? res;
      setEndScreen(data ?? { elements: [] });
    } catch {
      setError('Could not load end screen configuration.');
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    void fetchEndScreen();
  }, [fetchEndScreen]);

  // The backend end-screen endpoint is a single config-blob resource (PUT).
  // There are no per-element sub-paths; the full list is sent on every write.
  const putConfig = useCallback(async (config: EndScreenElement[]) => {
    await putRequest(
      ROUTES.broadcasts.contentEndScreen(contentId),
      { config, is_enabled: true },
      { errorMessage: 'Could not save end screen.' },
    );
  }, [contentId]);

  const handleAdd = useCallback(async () => {
    setSaving(true);
    try {
      const newEl: EndScreenElement = {
        element_type: formType,
        target_url: formTargetUrl.trim() || undefined,
        start_seconds: formStartSec ? Number(formStartSec) : undefined,
        end_seconds: formEndSec ? Number(formEndSec) : undefined,
      };
      const updated = [...(endScreen?.elements ?? []), newEl];
      await putConfig(updated);
      setFormType('video');
      setFormTargetUrl('');
      setFormStartSec('');
      setFormEndSec('');
      setShowForm(false);
      await fetchEndScreen();
    } catch {
      Alert.alert('Error', 'Could not add end screen element.');
    } finally {
      setSaving(false);
    }
  }, [contentId, endScreen, fetchEndScreen, formEndSec, formStartSec, formTargetUrl, formType, putConfig]);

  const handleDelete = useCallback((el: EndScreenElement) => {
    Alert.alert('Remove element?', `The ${el.element_type} element will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(el.id ?? el.element_type);
          try {
            const updated = (endScreen?.elements ?? []).filter(e =>
              el.id ? e.id !== el.id : e !== el,
            );
            await putConfig(updated);
            await fetchEndScreen();
          } catch {
            Alert.alert('Error', 'Could not remove element.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }, [endScreen, fetchEndScreen, putConfig]);

  const elements = endScreen?.elements ?? [];

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={palette.primaryStrong} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={[styles.errorText, { color: palette.subtext }]}>{error}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <ScrollView
      style={[styles.container, { backgroundColor: palette.surface }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.heading, { color: palette.text }]}>End Screen Elements</Text>
      <Text style={[styles.hint, { color: palette.subtext }]}>
        Elements appear in the final seconds of the video. A visual canvas editor is available on desktop.
      </Text>

      {elements.length === 0 && (
        <View style={[styles.emptyCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No end screen elements configured.</Text>
        </View>
      )}

      {elements.map((el, idx) => {
        const color = elementTypeColor(el.element_type, palette);
        return (
          <View
            key={el.id ?? idx}
            style={[styles.elementRow, { borderColor: palette.border, backgroundColor: palette.card }]}
          >
            <View style={[styles.typeBadge, { backgroundColor: color + '22' }]}>
              <Text style={[styles.typeBadgeText, { color }]}>{el.element_type.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              {el.target_url ? (
                <Text style={[styles.metaText, { color: palette.text }]} numberOfLines={1}>
                  {el.target_url}
                </Text>
              ) : null}
              {(el.start_seconds != null || el.end_seconds != null) && (
                <Text style={[styles.metaTime, { color: palette.subtext }]}>
                  {el.start_seconds ?? 0}s – {el.end_seconds ?? '?'}s
                </Text>
              )}
              {(el.x_pct != null && el.y_pct != null) && (
                <Text style={[styles.metaPos, { color: palette.subtext }]}>
                  pos {el.x_pct?.toFixed(0)}% / {el.y_pct?.toFixed(0)}%
                </Text>
              )}
            </View>
            <Pressable
              hitSlop={10}
              style={styles.deleteTouch}
              onPress={() => {
                const key = el.id ?? el.element_type;
                if (deletingId === key) return;
                handleDelete(el);
              }}
            >
              <Text style={[styles.deleteBtn, { color: palette.danger, opacity: deletingId === (el.id ?? el.element_type) ? 0.4 : 1 }]}>
                {deletingId === (el.id ?? el.element_type) ? '...' : 'Remove'}
              </Text>
            </Pressable>
          </View>
        );
      })}

      {/* Add element form */}
      {showForm ? (
        <View style={[styles.formCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={[styles.formTitle, { color: palette.text }]}>Add Element</Text>

          {/* Type picker */}
          <View style={styles.typePicker}>
            {ELEMENT_TYPES.map(t => {
              const active = formType === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setFormType(t)}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: active ? elementTypeColor(t, palette) : palette.surface,
                      borderColor: active ? elementTypeColor(t, palette) : palette.border,
                    },
                  ]}
                >
                  <Text style={[styles.typeChipText, { color: active ? palette.onPrimary : palette.text }]}>{t}</Text>
                </Pressable>
              );
            })}
          </View>

          {formType === 'link' && (
            <TextInput
              value={formTargetUrl}
              onChangeText={setFormTargetUrl}
              placeholder="Target URL"
              placeholderTextColor={palette.subtext}
              autoCapitalize="none"
              style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
            />
          )}

          <View style={styles.timeRow}>
            <TextInput
              value={formStartSec}
              onChangeText={setFormStartSec}
              placeholder="Start (sec)"
              placeholderTextColor={palette.subtext}
              keyboardType="numeric"
              style={[styles.timeInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
            />
            <TextInput
              value={formEndSec}
              onChangeText={setFormEndSec}
              placeholder="End (sec)"
              placeholderTextColor={palette.subtext}
              keyboardType="numeric"
              style={[styles.timeInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
            />
          </View>

          <View style={styles.formActions}>
            <Pressable onPress={() => setShowForm(false)} style={[styles.cancelBtn, { borderColor: palette.border }]}>
              <Text style={[styles.cancelBtnText, { color: palette.subtext }]}>Cancel</Text>
            </Pressable>
            <Pressable disabled={saving} onPress={handleAdd} style={[styles.saveBtn, { backgroundColor: palette.primaryStrong, opacity: saving ? 0.5 : 1 }]}>
              <Text style={[styles.saveBtnText, { color: palette.onPrimary }]}>{saving ? 'Adding...' : 'Add Element'}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setShowForm(true)} style={[styles.addBtn, { backgroundColor: palette.primaryStrong }]}>
          <Text style={[styles.addBtnText, { color: palette.onPrimary }]}>+ Add Element</Text>
        </Pressable>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  container: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  heading: { fontSize: 15, fontWeight: '900' },
  hint: { fontSize: 11, fontWeight: '600', lineHeight: 16, marginBottom: 4 },
  emptyCard: { borderWidth: 1, borderRadius: 10, padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, fontWeight: '600' },
  elementRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  typeBadgeText: { fontSize: 10, fontWeight: '900' },
  metaText: { fontSize: 12, fontWeight: '700' },
  metaTime: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  metaPos: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  deleteTouch: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { fontSize: 12, fontWeight: '900' },
  formCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  formTitle: { fontSize: 14, fontWeight: '900' },
  typePicker: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeChip: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
  },
  typeChipText: { fontSize: 12, fontWeight: '700' },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '700',
  },
  timeRow: { flexDirection: 'row', gap: 10 },
  timeInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '700',
  },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  cancelBtnText: { fontSize: 12, fontWeight: '900' },
  saveBtn: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  saveBtnText: { fontSize: 12, fontWeight: '900', textAlign: 'center' },
  addBtn: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  addBtnText: { fontSize: 13, fontWeight: '900' },
  errorText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
