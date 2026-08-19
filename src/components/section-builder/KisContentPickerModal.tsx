import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { KisContentTargetType } from './types';

type KisContentItem = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  price_display: string;
  deep_link: string;
};

type Props = {
  visible: boolean;
  targetType: KisContentTargetType;
  ownerType: string;
  ownerId: string;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
};

// "Add KIS Content" picker — the concrete mechanism behind "Add KIS
// Content → Courses → Select Course". Backed by one generic search
// endpoint (GET /api/v1/websites/kis-content/<target_type>/search/),
// scoped server-side to the owner's own records — never a global search.
export default function KisContentPickerModal({ visible, targetType, ownerType, ownerId, selectedIds, onToggle, onClose }: Props) {
  const { palette } = useKISTheme();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<KisContentItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!ownerType || !ownerId) return;
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.websites.kisContentSearch(targetType), {
        params: { owner_type: ownerType, owner_id: ownerId, q: query },
      });
      const results = (res as any)?.data?.results ?? (res as any)?.results ?? [];
      setItems(Array.isArray(results) ? results : []);
    } finally {
      setLoading(false);
    }
  }, [targetType, ownerType, ownerId, query]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const normalizedSelectedIds = Array.isArray(selectedIds) ? selectedIds : [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrapper}>
        <Pressable style={[styles.overlay, { backgroundColor: palette.bg }]} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]}>Add KIS Content</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>{normalizedSelectedIds.length} selected</Text>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={load}
            placeholder="Search…"
            placeholderTextColor={palette.subtext}
            style={[styles.search, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.card }]}
          />
          {loading ? (
            <ActivityIndicator style={{ marginTop: 16 }} color={palette.primaryStrong} />
          ) : (
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {items.length === 0 ? (
                <Text style={[styles.empty, { color: palette.subtext }]}>No content found.</Text>
              ) : null}
              {items.map((item) => {
                const isSelected = normalizedSelectedIds.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.option, { borderColor: palette.divider, backgroundColor: isSelected ? `${palette.primary}15` : palette.card }]}
                    onPress={() => onToggle(item.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionTitle, { color: palette.text }]}>{item.title}</Text>
                      {item.price_display ? (
                        <Text style={[styles.optionHint, { color: palette.subtext }]}>{item.price_display}</Text>
                      ) : null}
                    </View>
                    {isSelected ? <KISIcon name="check" size={18} color={palette.primaryStrong} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          <View style={styles.actions}>
            <KISButton title="Done" size="sm" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  overlay: { ...StyleSheet.absoluteFillObject, opacity: 0.85 },
  card: { borderRadius: 20, borderWidth: 1, width: '100%', maxHeight: '80%', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '600' },
  search: { marginTop: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  list: { marginTop: 10, maxHeight: 360 },
  empty: { fontSize: 13, paddingVertical: 16, textAlign: 'center' },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 12, marginBottom: 10 },
  optionTitle: { fontSize: 14, fontWeight: '600' },
  optionHint: { fontSize: 11, marginTop: 2 },
  actions: { marginTop: 8, alignItems: 'flex-end' },
});
