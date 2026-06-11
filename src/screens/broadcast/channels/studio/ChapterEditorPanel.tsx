// src/screens/broadcast/channels/studio/ChapterEditorPanel.tsx
//
// Manage manual and auto-suggested chapters for a piece of content.

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
import { deleteRequest } from '@/network/delete';

// ── Types ──────────────────────────────────────────────────────────────────────

type Chapter = {
  id: string;
  title: string;
  start_seconds: number;
  sort_order?: number;
};

type AutoChapter = {
  id: string;
  title: string;
  start_seconds: number;
  status: string;
};

type Props = {
  contentId: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function secondsToHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0'),
  ].join(':');
}

function hmsToSeconds(hms: string): number {
  const parts = hms.split(':').map(Number);
  if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  return parts[0] ?? 0;
}

function HMSInput({
  value,
  onChange,
  placeholder,
  palette,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  palette: any;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={text => {
        // Allow only digits and colons, max 8 chars (HH:MM:SS)
        const cleaned = text.replace(/[^0-9:]/g, '').slice(0, 8);
        onChange(cleaned);
      }}
      placeholder={placeholder ?? '00:00:00'}
      placeholderTextColor={palette.subtext}
      keyboardType="numeric"
      style={[hmsStyles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
    />
  );
}

const hmsStyles = StyleSheet.create({
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
    flex: 1,
  },
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChapterEditorPanel({ contentId }: Props) {
  const { palette } = useKISTheme();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [autoChapters, setAutoChapters] = useState<AutoChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Add form state
  const [newTitle, setNewTitle] = useState('');
  const [newStartHMS, setNewStartHMS] = useState('');
  const [showForm, setShowForm] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!contentId) return;
    setLoading(true);
    setError(null);
    try {
      const [chapRes, autoRes] = await Promise.all([
        getRequest(ROUTES.broadcasts.contentChapters(contentId), { errorMessage: '' }),
        getRequest(ROUTES.broadcasts.contentAutoChapters(contentId), { errorMessage: '' }),
      ]);
      const chapList: Chapter[] = Array.isArray(chapRes)
        ? chapRes
        : Array.isArray(chapRes?.data)
        ? chapRes.data
        : chapRes?.results ?? [];
      const autoList: AutoChapter[] = Array.isArray(autoRes)
        ? autoRes
        : Array.isArray(autoRes?.data)
        ? autoRes.data
        : autoRes?.results ?? [];
      setChapters(chapList.sort((a, b) => (a.sort_order ?? a.start_seconds) - (b.sort_order ?? b.start_seconds)));
      setAutoChapters(autoList);
    } catch {
      setError('Could not load chapters.');
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const handleAdd = useCallback(async () => {
    if (!newTitle.trim()) {
      Alert.alert('Missing title', 'Enter a chapter title.');
      return;
    }
    const startSec = hmsToSeconds(newStartHMS || '00:00:00');
    setSaving(true);
    try {
      await postRequest(
        ROUTES.broadcasts.contentChapters(contentId),
        { title: newTitle.trim(), start_seconds: startSec },
        { errorMessage: 'Could not add chapter.' },
      );
      setNewTitle('');
      setNewStartHMS('');
      setShowForm(false);
      await fetchAll();
    } catch {
      Alert.alert('Error', 'Could not add chapter.');
    } finally {
      setSaving(false);
    }
  }, [contentId, fetchAll, newStartHMS, newTitle]);

  const handleDelete = useCallback((chapter: Chapter) => {
    Alert.alert('Delete chapter?', `"${chapter.title}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(chapter.id);
          try {
            await deleteRequest(ROUTES.broadcasts.contentChapter(chapter.id));
            setChapters(prev => prev.filter(c => c.id !== chapter.id));
          } catch {
            Alert.alert('Error', 'Could not delete chapter.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }, []);

  const handleImport = useCallback(async (auto: AutoChapter) => {
    setImportingId(auto.id);
    try {
      await postRequest(
        ROUTES.broadcasts.contentChapters(contentId),
        { title: auto.title, start_seconds: auto.start_seconds },
        { errorMessage: 'Could not import chapter.' },
      );
      await fetchAll();
    } catch {
      Alert.alert('Error', 'Could not import chapter.');
    } finally {
      setImportingId(null);
    }
  }, [contentId, fetchAll]);

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
      {/* Manual chapters */}
      <Text style={[styles.sectionHeading, { color: palette.text }]}>Manual Chapters</Text>

      {chapters.length === 0 && (
        <View style={[styles.emptyCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No chapters added yet.</Text>
        </View>
      )}

      {chapters.map((chapter, idx) => (
        <View
          key={chapter.id}
          style={[styles.chapterRow, { borderColor: palette.border, backgroundColor: palette.card }]}
        >
          <View style={[styles.indexBadge, { backgroundColor: palette.primaryStrong + '22' }]}>
            <Text style={[styles.indexText, { color: palette.primaryStrong }]}>{idx + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.chapterTitle, { color: palette.text }]} numberOfLines={1}>
              {chapter.title}
            </Text>
            <Text style={[styles.chapterTime, { color: palette.subtext }]}>
              {secondsToHMS(chapter.start_seconds)}
            </Text>
          </View>
          <Text
            onPress={() => {
              if (deletingId === chapter.id) return;
              handleDelete(chapter);
            }}
            style={[styles.deleteBtn, { color: '#EF4444', opacity: deletingId === chapter.id ? 0.4 : 1 }]}
          >
            {deletingId === chapter.id ? '...' : 'Delete'}
          </Text>
        </View>
      ))}

      {/* Add chapter form */}
      {showForm ? (
        <View style={[styles.formCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={[styles.formTitle, { color: palette.text }]}>Add Chapter</Text>
          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="Chapter title"
            placeholderTextColor={palette.subtext}
            style={[styles.titleInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
          />
          <View style={styles.hmsRow}>
            <Text style={[styles.hmsLabel, { color: palette.subtext }]}>Start time</Text>
            <HMSInput value={newStartHMS} onChange={setNewStartHMS} palette={palette} />
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
              {saving ? 'Adding...' : 'Add Chapter'}
            </Text>
          </View>
        </View>
      ) : (
        <Text
          onPress={() => setShowForm(true)}
          style={[styles.addBtn, { backgroundColor: palette.primaryStrong }]}
        >
          + Add Chapter
        </Text>
      )}

      {/* Auto-suggested chapters */}
      {autoChapters.length > 0 && (
        <>
          <Text style={[styles.sectionHeading, { color: palette.text, marginTop: 16 }]}>
            Auto-suggested Chapters
          </Text>
          {autoChapters.map(auto => (
            <View
              key={auto.id}
              style={[styles.autoRow, { borderColor: palette.border, backgroundColor: palette.card }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.chapterTitle, { color: palette.text }]} numberOfLines={1}>
                  {auto.title}
                </Text>
                <Text style={[styles.chapterTime, { color: palette.subtext }]}>
                  {secondsToHMS(auto.start_seconds)}
                  {auto.status ? `  · ${auto.status}` : ''}
                </Text>
              </View>
              <Text
                onPress={() => {
                  if (importingId === auto.id) return;
                  void handleImport(auto);
                }}
                style={[
                  styles.importBtn,
                  { borderColor: palette.primaryStrong, color: palette.primaryStrong, opacity: importingId === auto.id ? 0.4 : 1 },
                ]}
              >
                {importingId === auto.id ? '...' : 'Import'}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  container: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  sectionHeading: { fontSize: 14, fontWeight: '900', marginBottom: 2 },
  emptyCard: { borderWidth: 1, borderRadius: 10, padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, fontWeight: '600' },
  chapterRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  autoRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  indexBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  indexText: { fontSize: 11, fontWeight: '900' },
  chapterTitle: { fontSize: 13, fontWeight: '800' },
  chapterTime: { fontSize: 11, fontWeight: '600', marginTop: 2, fontFamily: 'monospace' },
  deleteBtn: { fontSize: 12, fontWeight: '900' },
  importBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  formTitle: { fontSize: 14, fontWeight: '900' },
  titleInput: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '700',
  },
  hmsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hmsLabel: { fontSize: 12, fontWeight: '700', minWidth: 60 },
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
