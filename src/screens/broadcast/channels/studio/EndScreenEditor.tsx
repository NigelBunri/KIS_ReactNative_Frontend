// src/screens/broadcast/channels/studio/EndScreenEditor.tsx
//
// Data-management UI for end screen elements on a piece of content.
// (A visual canvas editor would require a native view; this manages elements as a list.)

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';

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

const TYPE_COLOR: Record<ElementType, string> = {
  video: '#3B82F6',
  subscribe: '#EF4444',
  channel: '#8B5CF6',
  link: '#F59E0B',
};

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

  const handleAdd = useCallback(async () => {
    setSaving(true);
    try {
      await postRequest(
        ROUTES.broadcasts.contentEndScreen(contentId),
        {
          element_type: formType,
          target_url: formTargetUrl.trim() || undefined,
          start_seconds: formStartSec ? Number(formStartSec) : undefined,
          end_seconds: formEndSec ? Number(formEndSec) : undefined,
        },
        { errorMessage: 'Could not add end screen element.' },
      );
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
  }, [contentId, fetchEndScreen, formEndSec, formStartSec, formTargetUrl, formType]);

  const handleDelete = useCallback((el: EndScreenElement) => {
    if (!el.id) return;
    Alert.alert('Remove element?', `The ${el.element_type} element will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(el.id!);
          try {
            await deleteRequest(
              `${ROUTES.broadcasts.contentEndScreen(contentId)}${el.id}/`,
            );
            await fetchEndScreen();
          } catch {
            Alert.alert('Error', 'Could not remove element.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }, [contentId, fetchEndScreen]);

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
    <ScrollView
      style={[styles.container, { backgroundColor: palette.surface }]}
      contentContainerStyle={styles.content}
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
        const color = TYPE_COLOR[el.element_type] ?? palette.primaryStrong;
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
            {el.id && (
              <Text
                onPress={() => {
                  if (deletingId === el.id) return;
                  handleDelete(el);
                }}
                style={[styles.deleteBtn, { color: '#EF4444', opacity: deletingId === el.id ? 0.4 : 1 }]}
              >
                {deletingId === el.id ? '...' : 'Remove'}
              </Text>
            )}
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
                <Text
                  key={t}
                  onPress={() => setFormType(t)}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: active ? TYPE_COLOR[t] : palette.surface,
                      borderColor: active ? TYPE_COLOR[t] : palette.border,
                      color: active ? '#fff' : palette.text,
                    },
                  ]}
                >
                  {t}
                </Text>
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
            <Text
              onPress={() => setShowForm(false)}
              style={[styles.cancelBtn, { color: palette.subtext, borderColor: palette.border }]}
            >
              Cancel
            </Text>
            <Text
              onPress={saving ? undefined : handleAdd}
              style={[styles.saveBtn, { backgroundColor: palette.primaryStrong, opacity: saving ? 0.5 : 1 }]}
            >
              {saving ? 'Adding...' : 'Add Element'}
            </Text>
          </View>
        </View>
      ) : (
        <Text
          onPress={() => setShowForm(true)}
          style={[styles.addBtn, { backgroundColor: palette.primaryStrong }]}
        >
          + Add Element
        </Text>
      )}
    </ScrollView>
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
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
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
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
  },
  saveBtn: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 12,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    overflow: 'hidden',
  },
  addBtn: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '900',
    color: '#fff',
    overflow: 'hidden',
  },
  errorText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
