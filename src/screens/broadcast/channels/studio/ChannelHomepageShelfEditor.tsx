// src/screens/broadcast/channels/studio/ChannelHomepageShelfEditor.tsx
//
// Manage homepage shelves (featured content rows) for a channel.

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

type ShelfType = 'Uploads' | 'Playlists' | 'Live' | 'Shorts' | 'Featured' | 'Custom';

type ShelfItem = {
  id: string;
  title?: string;
  thumbnail_url?: string;
};

type Shelf = {
  id: string;
  title: string;
  shelf_type: ShelfType;
  sort_order: number;
  is_active: boolean;
  items?: ShelfItem[];
};

type Props = {
  channelId: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const SHELF_TYPES: ShelfType[] = ['Uploads', 'Playlists', 'Live', 'Shorts', 'Featured', 'Custom'];

// ── Sub-component: ShelfItemsPanel ────────────────────────────────────────────

function ShelfItemsPanel({
  shelfId,
  palette,
}: {
  shelfId: string;
  palette: any;
}) {
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addValue, setAddValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(
        ROUTES.broadcasts.channelShelfItems(shelfId),
        { errorMessage: '' },
      );
      const raw: ShelfItem[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.results ?? [];
      setItems(raw);
    } finally {
      setLoading(false);
    }
  }, [shelfId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleAdd = useCallback(async () => {
    if (!addValue.trim()) return;
    setAdding(true);
    try {
      await postRequest(
        ROUTES.broadcasts.channelShelfItems(shelfId),
        { content_id: addValue.trim() },
        { errorMessage: '' },
      );
      setAddValue('');
      await loadItems();
    } catch {
      Alert.alert('Error', 'Could not add content to shelf.');
    } finally {
      setAdding(false);
    }
  }, [addValue, loadItems, shelfId]);

  const handleRemove = useCallback(async (item: ShelfItem) => {
    setDeletingId(item.id);
    try {
      await deleteRequest(`${ROUTES.broadcasts.channelShelfItems(shelfId)}${item.id}/`);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch {
      Alert.alert('Error', 'Could not remove item.');
    } finally {
      setDeletingId(null);
    }
  }, [shelfId]);

  return (
    <View style={[itemStyles.panel, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      {loading ? (
        <ActivityIndicator size="small" color={palette.primaryStrong} />
      ) : (
        <>
          {items.length === 0 && (
            <Text style={[itemStyles.emptyText, { color: palette.subtext }]}>No items in this shelf.</Text>
          )}
          {items.map(item => (
            <View key={item.id} style={[itemStyles.itemRow, { borderColor: palette.border }]}>
              <Text style={[itemStyles.itemTitle, { color: palette.text, flex: 1 }]} numberOfLines={1}>
                {item.title ?? item.id}
              </Text>
              <Text
                onPress={() => {
                  if (deletingId === item.id) return;
                  void handleRemove(item);
                }}
                style={[itemStyles.removeBtn, { color: '#EF4444', opacity: deletingId === item.id ? 0.4 : 1 }]}
              >
                {deletingId === item.id ? '...' : 'Remove'}
              </Text>
            </View>
          ))}
          <View style={itemStyles.addRow}>
            <TextInput
              value={addValue}
              onChangeText={setAddValue}
              placeholder="Content ID or URL"
              placeholderTextColor={palette.subtext}
              style={[itemStyles.addInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }]}
            />
            <Text
              onPress={adding ? undefined : handleAdd}
              style={[itemStyles.addBtn, { backgroundColor: palette.primaryStrong, opacity: adding ? 0.5 : 1 }]}
            >
              {adding ? '...' : 'Add'}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const itemStyles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 8,
    marginTop: 8,
  },
  emptyText: { fontSize: 12, fontWeight: '600' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingVertical: 8,
    gap: 8,
  },
  itemTitle: { fontSize: 12, fontWeight: '700' },
  removeBtn: { fontSize: 11, fontWeight: '900' },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addInput: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: '700',
  },
  addBtn: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 12,
    fontWeight: '900',
    color: '#fff',
    overflow: 'hidden',
  },
});

// ── Main component ────────────────────────────────────────────────────────────

export default function ChannelHomepageShelfEditor({ channelId }: Props) {
  const { palette } = useKISTheme();
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<ShelfType>('Custom');

  const fetchShelves = useCallback(async () => {
    if (!channelId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(
        ROUTES.broadcasts.channelShelves(channelId),
        { errorMessage: '' },
      );
      const raw: Shelf[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.results ?? [];
      setShelves(raw.sort((a, b) => a.sort_order - b.sort_order));
    } catch {
      setError('Could not load shelves.');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    void fetchShelves();
  }, [fetchShelves]);

  const handleAdd = useCallback(async () => {
    if (!formTitle.trim()) {
      Alert.alert('Missing title', 'Enter a shelf title.');
      return;
    }
    setSaving(true);
    try {
      await postRequest(
        ROUTES.broadcasts.channelShelves(channelId),
        { title: formTitle.trim(), shelf_type: formType },
        { errorMessage: 'Could not add shelf.' },
      );
      setFormTitle('');
      setFormType('Custom');
      setShowForm(false);
      await fetchShelves();
    } catch {
      Alert.alert('Error', 'Could not add shelf.');
    } finally {
      setSaving(false);
    }
  }, [channelId, fetchShelves, formTitle, formType]);

  const handleToggleActive = useCallback(async (shelf: Shelf) => {
    setPatchingId(shelf.id);
    try {
      await patchRequest(
        ROUTES.broadcasts.channelShelf(shelf.id),
        { is_active: !shelf.is_active },
        { errorMessage: '' },
      );
      setShelves(prev =>
        prev.map(s => s.id === shelf.id ? { ...s, is_active: !s.is_active } : s),
      );
    } catch {
      Alert.alert('Error', 'Could not update shelf.');
    } finally {
      setPatchingId(null);
    }
  }, []);

  const handleReorder = useCallback(async (shelf: Shelf, dir: -1 | 1) => {
    const idx = shelves.findIndex(s => s.id === shelf.id);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= shelves.length) return;
    const swapShelf = shelves[swapIdx]!;
    setPatchingId(shelf.id);
    try {
      await Promise.all([
        patchRequest(ROUTES.broadcasts.channelShelf(shelf.id), { sort_order: swapShelf.sort_order }, { errorMessage: '' }),
        patchRequest(ROUTES.broadcasts.channelShelf(swapShelf.id), { sort_order: shelf.sort_order }, { errorMessage: '' }),
      ]);
      await fetchShelves();
    } catch {
      Alert.alert('Error', 'Could not reorder shelves.');
    } finally {
      setPatchingId(null);
    }
  }, [fetchShelves, shelves]);

  const handleDelete = useCallback((shelf: Shelf) => {
    Alert.alert('Delete shelf?', `"${shelf.title}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(shelf.id);
          try {
            await deleteRequest(ROUTES.broadcasts.channelShelf(shelf.id));
            setShelves(prev => prev.filter(s => s.id !== shelf.id));
          } catch {
            Alert.alert('Error', 'Could not delete shelf.');
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
    <ScrollView
      style={[styles.container, { backgroundColor: palette.surface }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.heading, { color: palette.text }]}>Homepage Shelves</Text>

      {shelves.length === 0 && (
        <View style={[styles.emptyCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No shelves configured.</Text>
        </View>
      )}

      {shelves.map((shelf, idx) => {
        const busy = patchingId === shelf.id || deletingId === shelf.id;
        const expanded = expandedId === shelf.id;
        return (
          <View
            key={shelf.id}
            style={[styles.shelfCard, { borderColor: palette.border, backgroundColor: palette.card, opacity: busy ? 0.6 : 1 }]}
          >
            <View style={styles.shelfHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.shelfTitle, { color: palette.text }]} numberOfLines={1}>
                  {shelf.title}
                </Text>
                <View style={styles.shelfMeta}>
                  <View style={[styles.shelfTypePill, { backgroundColor: palette.primaryStrong + '22' }]}>
                    <Text style={[styles.shelfTypeText, { color: palette.primaryStrong }]}>
                      {shelf.shelf_type}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Reorder */}
              <View style={styles.reorderBtns}>
                <Text
                  onPress={() => { if (!busy) void handleReorder(shelf, -1); }}
                  style={[styles.reorderBtn, { color: idx === 0 ? palette.border : palette.subtext }]}
                >
                  ↑
                </Text>
                <Text
                  onPress={() => { if (!busy) void handleReorder(shelf, 1); }}
                  style={[styles.reorderBtn, { color: idx === shelves.length - 1 ? palette.border : palette.subtext }]}
                >
                  ↓
                </Text>
              </View>

              {/* Active toggle */}
              <Switch
                value={shelf.is_active}
                onValueChange={() => { if (!busy) void handleToggleActive(shelf); }}
                trackColor={{ true: palette.primaryStrong }}
                thumbColor="#fff"
              />

              {/* Expand items */}
              <Text
                onPress={() => setExpandedId(expanded ? null : shelf.id)}
                style={[styles.manageBtn, { color: palette.primaryStrong }]}
              >
                {expanded ? 'Hide' : 'Items'}
              </Text>

              {/* Delete */}
              <Text
                onPress={() => { if (!busy) handleDelete(shelf); }}
                style={[styles.deleteBtn, { color: '#EF4444' }]}
              >
                {deletingId === shelf.id ? '...' : 'Del'}
              </Text>
            </View>

            {expanded && <ShelfItemsPanel shelfId={shelf.id} palette={palette} />}
          </View>
        );
      })}

      {/* Add shelf form */}
      {showForm ? (
        <View style={[styles.formCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={[styles.formTitle, { color: palette.text }]}>Add Shelf</Text>
          <TextInput
            value={formTitle}
            onChangeText={setFormTitle}
            placeholder="Shelf title"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
          />
          <View style={styles.typePicker}>
            {SHELF_TYPES.map(t => {
              const active = formType === t;
              return (
                <Text
                  key={t}
                  onPress={() => setFormType(t)}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: active ? palette.primaryStrong : palette.surface,
                      borderColor: active ? palette.primaryStrong : palette.border,
                      color: active ? '#fff' : palette.text,
                    },
                  ]}
                >
                  {t}
                </Text>
              );
            })}
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
              {saving ? 'Adding...' : 'Add Shelf'}
            </Text>
          </View>
        </View>
      ) : (
        <Text
          onPress={() => setShowForm(true)}
          style={[styles.addBtn, { backgroundColor: palette.primaryStrong }]}
        >
          + Add Shelf
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
  heading: { fontSize: 15, fontWeight: '900', marginBottom: 2 },
  emptyCard: { borderWidth: 1, borderRadius: 10, padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, fontWeight: '600' },
  shelfCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  shelfHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'nowrap' },
  shelfTitle: { fontSize: 13, fontWeight: '800' },
  shelfMeta: { flexDirection: 'row', marginTop: 3, gap: 6 },
  shelfTypePill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  shelfTypeText: { fontSize: 10, fontWeight: '900' },
  reorderBtns: { flexDirection: 'row', gap: 2 },
  reorderBtn: { fontSize: 14, fontWeight: '900', paddingHorizontal: 4 },
  manageBtn: { fontSize: 11, fontWeight: '900' },
  deleteBtn: { fontSize: 11, fontWeight: '900' },
  formCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  formTitle: { fontSize: 14, fontWeight: '900' },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '700',
  },
  typePicker: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
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
