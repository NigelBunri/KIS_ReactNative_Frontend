// src/screens/broadcast/channels/studio/KeywordFilterPanel.tsx
//
// Manage keyword filters for automated comment moderation.

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
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';

// ── Types ──────────────────────────────────────────────────────────────────────

type FilterType = 'block' | 'hold' | 'flag';

type KeywordFilter = {
  id: string;
  keyword: string;
  filter_type: FilterType;
  is_active: boolean;
};

type Props = {
  channelId: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const FILTER_TYPES: FilterType[] = ['block', 'hold', 'flag'];

const FILTER_TYPE_COLOR: Record<FilterType, string> = {
  block: '#EF4444',
  hold: '#F59E0B',
  flag: '#3B82F6',
};

const FILTER_TYPE_LABEL: Record<FilterType, string> = {
  block: 'Block',
  hold: 'Hold',
  flag: 'Flag',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function KeywordFilterPanel({ channelId }: Props) {
  const { palette } = useKISTheme();
  const [filters, setFilters] = useState<KeywordFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [keyword, setKeyword] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('block');

  const fetchFilters = useCallback(async () => {
    if (!channelId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(
        ROUTES.broadcasts.channelKeywordFilters(channelId),
        { errorMessage: '' },
      );
      const raw: KeywordFilter[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.results ?? [];
      setFilters(raw);
    } catch {
      setError('Could not load keyword filters.');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    void fetchFilters();
  }, [fetchFilters]);

  const handleAdd = useCallback(async () => {
    if (!keyword.trim()) {
      Alert.alert('Missing keyword', 'Enter a keyword to filter.');
      return;
    }
    setSaving(true);
    try {
      await postRequest(
        ROUTES.broadcasts.channelKeywordFilters(channelId),
        { keyword: keyword.trim(), filter_type: filterType, is_active: true },
        { errorMessage: 'Could not add filter.' },
      );
      setKeyword('');
      setFilterType('block');
      await fetchFilters();
    } catch {
      Alert.alert('Error', 'Could not add keyword filter.');
    } finally {
      setSaving(false);
    }
  }, [channelId, fetchFilters, filterType, keyword]);

  const handleToggleActive = useCallback(async (filter: KeywordFilter) => {
    setPatchingId(filter.id);
    try {
      await patchRequest(
        ROUTES.broadcasts.channelKeywordFilter(filter.id),
        { is_active: !filter.is_active },
        { errorMessage: '' },
      );
      setFilters(prev =>
        prev.map(f => f.id === filter.id ? { ...f, is_active: !f.is_active } : f),
      );
    } catch {
      Alert.alert('Error', 'Could not update filter.');
    } finally {
      setPatchingId(null);
    }
  }, []);

  const handleChangeType = useCallback(async (filter: KeywordFilter, newType: FilterType) => {
    setPatchingId(filter.id);
    try {
      await patchRequest(
        ROUTES.broadcasts.channelKeywordFilter(filter.id),
        { filter_type: newType },
        { errorMessage: '' },
      );
      setFilters(prev =>
        prev.map(f => f.id === filter.id ? { ...f, filter_type: newType } : f),
      );
    } catch {
      Alert.alert('Error', 'Could not update filter type.');
    } finally {
      setPatchingId(null);
    }
  }, []);

  const handleDelete = useCallback((filter: KeywordFilter) => {
    Alert.alert('Delete filter?', `"${filter.keyword}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(filter.id);
          try {
            await deleteRequest(ROUTES.broadcasts.channelKeywordFilter(filter.id));
            setFilters(prev => prev.filter(f => f.id !== filter.id));
          } catch {
            Alert.alert('Error', 'Could not delete filter.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
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
    <View style={[styles.container, { backgroundColor: palette.surface }]}>
      {/* Add filter form */}
      <View style={[styles.addForm, { borderColor: palette.border, backgroundColor: palette.card }]}>
        <Text style={[styles.formTitle, { color: palette.text }]}>Add Keyword Filter</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            placeholder="Keyword or phrase"
            placeholderTextColor={palette.subtext}
            style={[styles.keywordInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
          />
        </View>
        <View style={styles.typePicker}>
          {FILTER_TYPES.map(t => {
            const active = filterType === t;
            const color = FILTER_TYPE_COLOR[t];
            return (
              <Text
                key={t}
                onPress={() => setFilterType(t)}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: active ? color : palette.surface,
                    borderColor: active ? color : palette.border,
                    color: active ? '#fff' : palette.text,
                  },
                ]}
              >
                {FILTER_TYPE_LABEL[t]}
              </Text>
            );
          })}
          <Text
            onPress={saving ? undefined : handleAdd}
            style={[
              styles.addChip,
              { backgroundColor: palette.primaryStrong, opacity: saving ? 0.5 : 1 },
            ]}
          >
            {saving ? '...' : 'Add'}
          </Text>
        </View>
      </View>

      {/* Filters list */}
      {filters.length === 0 ? (
        <View style={[styles.emptyCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No keyword filters set.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {filters.map(filter => {
            const color = FILTER_TYPE_COLOR[filter.filter_type] ?? palette.primaryStrong;
            const busy = patchingId === filter.id || deletingId === filter.id;
            return (
              <View
                key={filter.id}
                style={[
                  styles.filterRow,
                  { borderColor: palette.border, backgroundColor: palette.card, opacity: busy ? 0.6 : 1 },
                ]}
              >
                <Text style={[styles.keywordText, { color: palette.text, flex: 1 }]} numberOfLines={1}>
                  {filter.keyword}
                </Text>
                {/* Type pill - tappable to cycle */}
                <View style={[styles.typePill, { backgroundColor: color + '22' }]}>
                  <Text
                    onPress={() => {
                      if (busy) return;
                      const idx = FILTER_TYPES.indexOf(filter.filter_type);
                      const next = FILTER_TYPES[(idx + 1) % FILTER_TYPES.length]!;
                      void handleChangeType(filter, next);
                    }}
                    style={[styles.typePillText, { color }]}
                  >
                    {FILTER_TYPE_LABEL[filter.filter_type]}
                  </Text>
                </View>
                <Switch
                  value={filter.is_active}
                  onValueChange={() => {
                    if (busy) return;
                    void handleToggleActive(filter);
                  }}
                  trackColor={{ true: palette.primaryStrong }}
                  thumbColor="#fff"
                />
                <Text
                  onPress={() => {
                    if (busy) return;
                    handleDelete(filter);
                  }}
                  style={[styles.deleteBtn, { color: '#EF4444' }]}
                >
                  {deletingId === filter.id ? '...' : 'Delete'}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loaderContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  container: { gap: 10 },
  addForm: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  formTitle: { fontSize: 13, fontWeight: '900' },
  inputRow: { flexDirection: 'row', gap: 8 },
  keywordInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '700',
  },
  typePicker: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  typeChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  addChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '900',
    color: '#fff',
    overflow: 'hidden',
  },
  emptyCard: { borderWidth: 1, borderRadius: 10, padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, fontWeight: '600' },
  listContent: { gap: 8 },
  filterRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  keywordText: { fontSize: 13, fontWeight: '700' },
  typePill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  typePillText: { fontSize: 10, fontWeight: '900' },
  deleteBtn: { fontSize: 12, fontWeight: '900' },
  errorText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
