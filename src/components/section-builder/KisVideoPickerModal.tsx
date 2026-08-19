import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';

export type KisVideoResult = {
  source: 'broadcast_content' | 'health_engine_item';
  target_id: string;
  title: string;
  video_url: string;
  thumbnail_url: string;
  duration_seconds: number | null;
};

type Props = {
  visible: boolean;
  ownerType: string;
  ownerId: string;
  selectedTargetId?: string;
  onSelect: (video: KisVideoResult) => void;
  onClose: () => void;
};

// Picker for the `kis_video` section — a single specific KIS video (not
// third-party). Only Broadcast Channel and Health Institution owners
// currently have real video content to pick from (see
// apps.websites.kis_video's docstring on the backend) — everyone else
// sees an honest empty state rather than a fake result set.
export default function KisVideoPickerModal({ visible, ownerType, ownerId, selectedTargetId, onSelect, onClose }: Props) {
  const { palette } = useKISTheme();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<KisVideoResult[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!ownerType || !ownerId) return;
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.websites.kisVideoSearch, {
        params: { owner_type: ownerType, owner_id: ownerId, q: query },
      });
      const results = (res as any)?.data?.results ?? (res as any)?.results ?? [];
      setItems(Array.isArray(results) ? results : []);
    } finally {
      setLoading(false);
    }
  }, [ownerType, ownerId, query]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const supported = ownerType === 'broadcast_channel' || ownerType === 'health_institution';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrapper}>
        <Pressable style={[styles.overlay, { backgroundColor: palette.bg }]} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]}>Choose a KIS Video</Text>
          </View>
          {!supported ? (
            <Text style={[styles.empty, { color: palette.subtext }]}>
              Video embedding is available for Broadcast Channel and Health Institution websites for now — this owner
              type doesn't have KIS video content to pick from yet.
            </Text>
          ) : (
            <>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={load}
                placeholder="Search your videos…"
                placeholderTextColor={palette.subtext}
                style={[styles.search, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.card }]}
              />
              {loading ? (
                <ActivityIndicator style={{ marginTop: 16 }} color={palette.primaryStrong} />
              ) : (
                <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                  {items.length === 0 ? (
                    <Text style={[styles.empty, { color: palette.subtext }]}>No videos found.</Text>
                  ) : null}
                  {items.map((item) => {
                    const isSelected = item.target_id === selectedTargetId;
                    return (
                      <Pressable
                        key={`${item.source}-${item.target_id}`}
                        style={[styles.option, { borderColor: palette.divider, backgroundColor: isSelected ? `${palette.primary}15` : palette.card }]}
                        onPress={() => onSelect(item)}
                      >
                        {item.thumbnail_url ? (
                          <Image source={{ uri: item.thumbnail_url }} style={styles.thumb} />
                        ) : (
                          <View style={[styles.thumb, { backgroundColor: palette.divider }]} />
                        )}
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.optionTitle, { color: palette.text }]}>{item.title}</Text>
                        </View>
                        {isSelected ? <KISIcon name="check" size={18} color={palette.primaryStrong} /> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </>
          )}
          <View style={styles.actions}>
            <KISButton title="Close" size="sm" onPress={onClose} />
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
  search: { marginTop: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  list: { marginTop: 10, maxHeight: 360 },
  empty: { fontSize: 13, paddingVertical: 16, textAlign: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 8, marginBottom: 10 },
  thumb: { width: 56, height: 40, borderRadius: 6 },
  optionTitle: { fontSize: 14, fontWeight: '600' },
  actions: { marginTop: 8, alignItems: 'flex-end' },
});
