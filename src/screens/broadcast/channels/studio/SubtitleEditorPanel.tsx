// src/screens/broadcast/channels/studio/SubtitleEditorPanel.tsx
//
// Manage subtitle tracks for a piece of content. Fetches existing tracks,
// lets the owner add new ones, and delete them.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
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

type SubtitleTrack = {
  id: string;
  language: string;
  label: string;
  url: string;
  is_default: boolean;
};

type Props = {
  contentId: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SubtitleEditorPanel({ contentId }: Props) {
  const { palette } = useKISTheme();
  const [tracks, setTracks] = useState<SubtitleTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [lang, setLang] = useState('');
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const fetchTracks = useCallback(async () => {
    if (!contentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(
        ROUTES.broadcasts.contentSubtitles(contentId),
        { errorMessage: '' },
      );
      const raw: SubtitleTrack[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.results ?? [];
      setTracks(raw);
    } catch {
      setError('Could not load subtitle tracks.');
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    void fetchTracks();
  }, [fetchTracks]);

  const handleAdd = useCallback(async () => {
    if (!lang.trim() || !url.trim()) {
      Alert.alert('Missing fields', 'Language code and URL are required.');
      return;
    }
    setSaving(true);
    try {
      await postRequest(
        ROUTES.broadcasts.contentSubtitles(contentId),
        { language: lang.trim(), label: label.trim(), url: url.trim(), is_default: isDefault },
        { errorMessage: 'Could not add subtitle track.' },
      );
      setLang('');
      setLabel('');
      setUrl('');
      setIsDefault(false);
      setShowForm(false);
      await fetchTracks();
    } catch {
      Alert.alert('Error', 'Could not add subtitle track.');
    } finally {
      setSaving(false);
    }
  }, [contentId, fetchTracks, isDefault, label, lang, url]);

  const handleDelete = useCallback((track: SubtitleTrack) => {
    Alert.alert(
      'Remove subtitle track?',
      `"${track.label || track.language}" will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(track.id);
            try {
              await deleteRequest(ROUTES.broadcasts.contentSubtitle(track.id));
              setTracks(prev => prev.filter(t => t.id !== track.id));
            } catch {
              Alert.alert('Error', 'Could not remove subtitle track.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  }, []);

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
      <Text style={[styles.heading, { color: palette.text }]}>Subtitle Tracks</Text>

      {tracks.length === 0 && (
        <View style={[styles.emptyCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>
            No subtitle tracks added yet.
          </Text>
        </View>
      )}

      {tracks.map(track => (
        <View
          key={track.id}
          style={[styles.trackRow, { borderColor: palette.border, backgroundColor: palette.card }]}
        >
          <View style={styles.trackMeta}>
            <View style={[styles.langPill, { backgroundColor: palette.primaryStrong + '22' }]}>
              <Text style={[styles.langPillText, { color: palette.primaryStrong }]}>
                {track.language.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.trackLabel, { color: palette.text }]} numberOfLines={1}>
              {track.label || track.language}
            </Text>
            {track.is_default && (
              <View style={[styles.defaultBadge, { backgroundColor: '#22C55E22' }]}>
                <Text style={styles.defaultBadgeText}>DEFAULT</Text>
              </View>
            )}
          </View>
          <Text
            onPress={() => {
              if (deletingId === track.id) return;
              handleDelete(track);
            }}
            style={[
              styles.deleteBtn,
              { color: '#EF4444', opacity: deletingId === track.id ? 0.4 : 1 },
            ]}
          >
            {deletingId === track.id ? '...' : 'Remove'}
          </Text>
        </View>
      ))}

      {/* Add track form */}
      {showForm ? (
        <View style={[styles.formCard, { borderColor: palette.border, backgroundColor: palette.royalInk ?? palette.card }]}>
          <Text style={[styles.formTitle, { color: palette.text }]}>Add Subtitle Track</Text>
          <TextInput
            value={lang}
            onChangeText={setLang}
            placeholder="Language code (e.g. en, fr)"
            placeholderTextColor={palette.subtext}
            autoCapitalize="none"
            style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
          />
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="Label (e.g. English, Francais)"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
          />
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="Subtitle file URL (.vtt / .srt)"
            placeholderTextColor={palette.subtext}
            autoCapitalize="none"
            style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
          />
          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: palette.text }]}>Set as default</Text>
            <Switch
              value={isDefault}
              onValueChange={setIsDefault}
              trackColor={{ true: palette.primaryStrong }}
              thumbColor="#fff"
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
              style={[
                styles.addBtn,
                { backgroundColor: palette.primaryStrong, opacity: saving ? 0.5 : 1 },
              ]}
            >
              {saving ? 'Adding...' : 'Add Track'}
            </Text>
          </View>
        </View>
      ) : (
        <Text
          onPress={() => setShowForm(true)}
          style={[styles.addTrackBtn, { backgroundColor: palette.primaryStrong }]}
        >
          + Add Subtitle Track
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
  heading: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, fontWeight: '600' },
  trackRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trackMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  langPill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  langPillText: { fontSize: 10, fontWeight: '900' },
  trackLabel: { fontSize: 13, fontWeight: '700', flex: 1 },
  defaultBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  defaultBadgeText: { fontSize: 9, fontWeight: '900', color: '#22C55E' },
  deleteBtn: { fontSize: 12, fontWeight: '900' },
  formCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  formTitle: { fontSize: 14, fontWeight: '900', marginBottom: 2 },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '700',
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 13, fontWeight: '700' },
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
  addBtn: {
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
  addTrackBtn: {
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
