import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SetLists'>;

type Song = {
  id: string;
  title: string;
  artist?: string;
  key?: string;
  tempo?: string;
};

type SetListSong = Song & { order: number };

type SetList = {
  id: string;
  title?: string;
  date: string;
  songs: SetListSong[];
};

type GroupedSetLists = { dateLabel: string; sets: SetList[] }[];

function groupByDate(setLists: SetList[]): GroupedSetLists {
  const map = new Map<string, SetList[]>();
  setLists.forEach(sl => {
    const key = new Date(sl.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(sl);
  });
  return Array.from(map.entries()).map(([dateLabel, sets]) => ({ dateLabel, sets }));
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function SetListScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [setLists, setSetLists] = useState<SetList[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create modal state
  const [createVisible, setCreateVisible] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDate, setCreateDate] = useState(todayISO);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [songsLoading, setSongsLoading] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);
  const grouped = useMemo(() => groupByDate(setLists), [setLists]);

  const loadSetLists = useCallback(() => {
    setLoading(true);
    getRequest(ROUTES.church.setlists)
      .then(res => {
        if (res?.success) {
          const raw = res.data;
          setSetLists(Array.isArray(raw) ? raw : raw?.results ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { loadSetLists(); }, [loadSetLists]));

  const openCreate = useCallback(() => {
    setCreateTitle('');
    setCreateDate(todayISO());
    setSelectedSongIds(new Set());
    setCreateVisible(true);
    setSongsLoading(true);
    getRequest(ROUTES.church.songs)
      .then(res => {
        const raw = res?.data ?? res;
        setAllSongs(Array.isArray(raw) ? raw : raw?.results ?? []);
      })
      .catch(() => setAllSongs([]))
      .finally(() => setSongsLoading(false));
  }, []);

  const toggleSong = useCallback((id: string) => {
    setSelectedSongIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleCreate = useCallback(async () => {
    if (!createTitle.trim()) {
      Alert.alert('Title required', 'Please enter a title for this set list.');
      return;
    }
    if (!createDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Invalid date', 'Please use YYYY-MM-DD format.');
      return;
    }
    setSaving(true);
    try {
      const songs = Array.from(selectedSongIds).map((songId, idx) => ({
        song: songId,
        order: idx + 1,
      }));
      const res = await postRequest(ROUTES.church.setlists, {
        title: createTitle.trim(),
        date: createDate,
        songs,
      });
      if (res?.success && res.data) {
        setSetLists(prev => [res.data as SetList, ...prev]);
        setCreateVisible(false);
      } else {
        Alert.alert('Error', res?.message ?? 'Failed to create set list.');
      }
    } catch {
      Alert.alert('Error', 'Failed to create set list. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [createTitle, createDate, selectedSongIds]);

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const renderSetList = (sl: SetList) => {
    const expanded = expandedId === sl.id;
    const sortedSongs = [...(sl.songs ?? [])].sort((a, b) => a.order - b.order);

    return (
      <TouchableOpacity
        key={sl.id}
        style={[styles.setCard, expanded && styles.setCardExpanded]}
        onPress={() => setExpandedId(prev => prev === sl.id ? null : sl.id)}
        activeOpacity={0.8}
      >
        <View style={styles.setHeader}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.setTitle} numberOfLines={1}>{sl.title ?? `Service — ${formatDate(sl.date)}`}</Text>
            <Text style={styles.setDate}>{formatDate(sl.date)}</Text>
          </View>
          <View style={styles.setHeaderRight}>
            <View style={styles.songCountBadge}>
              <Text style={styles.songCountText}>{sortedSongs.length} songs</Text>
            </View>
            <KISIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} tone="muted" />
          </View>
        </View>

        {expanded && (
          <View style={styles.songList}>
            {sortedSongs.length === 0 ? (
              <Text style={[styles.setlistSongTitle, { color: palette.subtext, paddingVertical: 12 }]}>No songs added.</Text>
            ) : sortedSongs.map((song, idx) => (
              <View key={song.id} style={styles.setlistSongRow}>
                <Text style={styles.songOrder}>{idx + 1}</Text>
                <View style={styles.setlistSongMeta}>
                  <Text style={styles.setlistSongTitle}>{song.title}</Text>
                  {song.artist ? <Text style={styles.setlistSongArtist}>{song.artist}</Text> : null}
                </View>
                <View style={styles.songTagsRow}>
                  {song.key ? <View style={styles.tag}><Text style={styles.tagText}>Key: {song.key}</Text></View> : null}
                  {song.tempo ? <View style={styles.tag}><Text style={styles.tagText}>{song.tempo}</Text></View> : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Set Lists</Text>
        <KISButton title="New Set List" variant="outline" size="sm" onPress={openCreate} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : grouped.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No set lists yet.</Text>
          <KISButton title="Create First Set List" size="sm" style={{ marginTop: 16 }} onPress={openCreate} />
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={g => g.dateLabel}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View>
              <Text style={styles.groupHeader}>{item.dateLabel}</Text>
              {item.sets.map(renderSetList)}
            </View>
          )}
        />
      )}

      {/* ── Create Set List Modal ── */}
      <Modal visible={createVisible} transparent animationType="slide" onRequestClose={() => setCreateVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: palette.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>New Set List</Text>
              <Pressable onPress={() => setCreateVisible(false)} hitSlop={12} accessibilityLabel="Close">
                <KISIcon name="x" size={22} tone="muted" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.fieldLabel, { color: palette.subtext }]}>Title</Text>
              <TextInput
                style={[styles.textInput, { color: palette.text, borderColor: palette.inputBorder, backgroundColor: palette.inputBg }]}
                value={createTitle}
                onChangeText={setCreateTitle}
                placeholder="Sunday Morning Service"
                placeholderTextColor={palette.subtext}
                maxLength={120}
              />

              <Text style={[styles.fieldLabel, { color: palette.subtext, marginTop: 14 }]}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={[styles.textInput, { color: palette.text, borderColor: palette.inputBorder, backgroundColor: palette.inputBg }]}
                value={createDate}
                onChangeText={setCreateDate}
                placeholder="2026-06-22"
                placeholderTextColor={palette.subtext}
                maxLength={10}
                keyboardType="numbers-and-punctuation"
              />

              <Text style={[styles.fieldLabel, { color: palette.subtext, marginTop: 14 }]}>
                Add Songs ({selectedSongIds.size} selected)
              </Text>

              {songsLoading ? (
                <ActivityIndicator color={palette.primary} style={{ marginVertical: 16 }} />
              ) : allSongs.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 13, marginBottom: 8 }}>
                  No songs in library yet. Add songs in Song Library first.
                </Text>
              ) : allSongs.map(song => {
                const selected = selectedSongIds.has(song.id);
                return (
                  <Pressable
                    key={song.id}
                    onPress={() => toggleSong(song.id)}
                    style={[
                      styles.songPickerRow,
                      { borderColor: selected ? palette.primary : palette.divider, backgroundColor: selected ? palette.primarySoft : palette.surface },
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                  >
                    <View style={styles.songPickerMeta}>
                      <Text style={[styles.songPickerTitle, { color: palette.text }]} numberOfLines={1}>{song.title}</Text>
                      {song.artist ? <Text style={[styles.songPickerArtist, { color: palette.subtext }]}>{song.artist}</Text> : null}
                    </View>
                    <View style={[styles.songCheckbox, { borderColor: selected ? palette.primary : palette.divider, backgroundColor: selected ? palette.primary : 'transparent' }]}>
                      {selected ? <KISIcon name="check" size={14} color={palette.onPrimary} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: palette.divider }]}>
              <KISButton
                title={saving ? 'Saving…' : 'Create Set List'}
                disabled={saving || !createTitle.trim()}
                onPress={handleCreate}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: sp,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    screenTitle: { fontSize: 22, fontWeight: '700', color: palette.text },
    list: { padding: sp, paddingBottom: 80 },
    groupHeader: {
      fontSize: 14,
      fontWeight: '700',
      color: palette.subtext,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
      marginTop: 8,
    },
    setCard: {
      backgroundColor: palette.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      marginBottom: 10,
      overflow: 'hidden',
    },
    setCardExpanded: { borderColor: palette.primary },
    setHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      minHeight: 60,
    },
    setTitle: { fontSize: 15, fontWeight: '600', color: palette.text, marginBottom: 2 },
    setDate: { fontSize: 12, color: palette.subtext },
    setHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    songCountBadge: {
      backgroundColor: palette.primarySoft,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    songCountText: { fontSize: 11, fontWeight: '600', color: palette.primary },
    songList: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: palette.divider,
      paddingHorizontal: 14,
    },
    setlistSongRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
      minHeight: 44,
    },
    songOrder: { width: 24, fontSize: 13, fontWeight: '700', color: palette.subtext, marginRight: 10 },
    setlistSongMeta: { flex: 1 },
    setlistSongTitle: { fontSize: 14, fontWeight: '600', color: palette.text },
    setlistSongArtist: { fontSize: 12, color: palette.subtext, marginTop: 1 },
    songTagsRow: { flexDirection: 'row', gap: 4 },
    tag: {
      backgroundColor: palette.surface,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    tagText: { fontSize: 11, color: palette.subtext },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 14, color: palette.subtext },
    // Modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    modalSheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '92%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: sp,
      paddingTop: 18,
      paddingBottom: 10,
    },
    modalTitle: { fontSize: 18, fontWeight: '800' },
    modalBody: { paddingHorizontal: sp, paddingBottom: 16 },
    modalFooter: {
      paddingHorizontal: sp,
      paddingTop: 12,
      paddingBottom: 24,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
    textInput: {
      borderWidth: 1.5,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontSize: 15,
      minHeight: 48,
    },
    songPickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
      minHeight: 48,
      gap: 10,
    },
    songPickerMeta: { flex: 1 },
    songPickerTitle: { fontSize: 14, fontWeight: '600' },
    songPickerArtist: { fontSize: 12, marginTop: 1 },
    songCheckbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
