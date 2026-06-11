// src/screens/broadcast/channels/components/ContentQueueSheet.tsx
//
// Watch-queue / Up-Next manager with up/down reorder, remove, and clear actions.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

// ── Types ──────────────────────────────────────────────────────────────────────

type QueueItem = {
  id: string;
  content_id: string;
  title?: string;
  channel_name?: string;
  thumbnail_url?: string;
  position?: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onPlayContent: (contentId: string) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContentQueueSheet({ visible, onClose, onPlayContent }: Props) {
  const { palette } = useKISTheme();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.broadcasts.queue, { errorMessage: '' });
      const raw: QueueItem[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.results ?? [];
      setItems(raw);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void fetchQueue();
  }, [fetchQueue, visible]);

  const handleRemove = useCallback(async (item: QueueItem) => {
    const next = items.filter(i => i.id !== item.id);
    setItems(next);
    try {
      await postRequest(
        `${ROUTES.broadcasts.queue}${item.id}/remove/`,
        {},
        { errorMessage: '' },
      ).catch(() => {});
    } catch {
      // restore on failure
      await fetchQueue();
    }
  }, [fetchQueue, items]);

  const handleMoveUp = useCallback(async (index: number) => {
    if (index === 0) return;
    const next = [...items];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    setItems(next);
    await postRequest(
      ROUTES.broadcasts.queueReorder,
      { order: next.map(i => i.id) },
      { errorMessage: '' },
    ).catch(() => {});
  }, [items]);

  const handleMoveDown = useCallback(async (index: number) => {
    if (index >= items.length - 1) return;
    const next = [...items];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    setItems(next);
    await postRequest(
      ROUTES.broadcasts.queueReorder,
      { order: next.map(i => i.id) },
      { errorMessage: '' },
    ).catch(() => {});
  }, [items]);

  const handleClear = () => {
    Alert.alert('Clear Queue', 'Remove all items from your queue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setClearing(true);
          try {
            await postRequest(
              `${ROUTES.broadcasts.queue}clear/`,
              {},
              { errorMessage: '' },
            ).catch(() => {});
            setItems([]);
          } finally {
            setClearing(false);
          }
        },
      },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} />
      <SafeAreaView style={[styles.sheet, { backgroundColor: palette.card }]}>
        {/* Handle bar */}
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: palette.border }]} />
        </View>

        <View style={styles.header}>
          <Text style={[styles.sheetTitle, { color: palette.text }]}>Up Next</Text>
          {items.length > 0 && (
            <Pressable
              onPress={() => {
                const first = items[0];
                if (first) onPlayContent(first.content_id);
              }}
              style={[styles.playNextBtn, { borderColor: palette.primaryStrong }]}
            >
              <Text style={[styles.playNextText, { color: palette.primaryStrong }]}>
                Play Next
              </Text>
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator color={palette.primaryStrong} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              Your queue is empty
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContent}>
            {items.map((item, index) => (
              <View
                key={item.id}
                style={[styles.queueItem, { borderColor: palette.border, backgroundColor: palette.surface }]}
              >
                {item.thumbnail_url ? (
                  <Image source={{ uri: item.thumbnail_url }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, { backgroundColor: palette.border }]} />
                )}
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => onPlayContent(item.content_id)}
                >
                  <Text numberOfLines={1} style={[styles.itemTitle, { color: palette.text }]}>
                    {item.title ?? 'Untitled'}
                  </Text>
                  {item.channel_name ? (
                    <Text numberOfLines={1} style={[styles.itemChannel, { color: palette.subtext }]}>
                      {item.channel_name}
                    </Text>
                  ) : null}
                </Pressable>
                <View style={styles.itemActions}>
                  <Pressable onPress={() => handleMoveUp(index)} style={styles.arrowBtn}>
                    <Text style={[styles.arrowText, { color: palette.subtext }]}>↑</Text>
                  </Pressable>
                  <Pressable onPress={() => handleMoveDown(index)} style={styles.arrowBtn}>
                    <Text style={[styles.arrowText, { color: palette.subtext }]}>↓</Text>
                  </Pressable>
                  <Pressable onPress={() => handleRemove(item)} style={styles.removeBtn}>
                    <Text style={[styles.removeText, { color: '#EF4444' }]}>✕</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Clear queue */}
        {items.length > 0 && (
          <View style={[styles.footer, { borderColor: palette.border }]}>
            <Pressable
              onPress={handleClear}
              disabled={clearing}
              style={[styles.clearBtn, { borderColor: '#EF4444' }]}
            >
              {clearing ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <Text style={styles.clearBtnText}>Clear Queue</Text>
              )}
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  handleRow: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  playNextBtn: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  playNextText: { fontSize: 12, fontWeight: '800' },
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 14, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 16 },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  thumb: { width: 40, height: 40, borderRadius: 6 },
  itemTitle: { fontSize: 13, fontWeight: '800' },
  itemChannel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  arrowBtn: { padding: 6 },
  arrowText: { fontSize: 16, fontWeight: '700' },
  removeBtn: { padding: 6 },
  removeText: { fontSize: 15, fontWeight: '800' },
  footer: { borderTopWidth: 1, padding: 14 },
  clearBtn: { borderWidth: 1.5, borderRadius: 8, height: 42, alignItems: 'center', justifyContent: 'center' },
  clearBtnText: { color: '#EF4444', fontWeight: '800', fontSize: 14 },
});
