/**
 * PartnerBibleScreen — bible tab for a partner org app.
 * Shows the global KIS Bible reader alongside partner-specific content
 * (devotionals, meditations, prayer days) stored as tab content blocks.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import BibleScreen from '@/screens/tabs/BibleScreen';

type BlockType = 'devotional' | 'meditation' | 'prayer';

type ContentBlock = {
  id: string;
  block_type: BlockType | string;
  title?: string | null;
  body?: string | null;
  payload?: Record<string, unknown> | null;
  created_at?: string | null;
};

type SubTab = 'bible' | BlockType;

const SUB_TABS: { key: SubTab; label: string; icon: string }[] = [
  { key: 'bible', label: 'Bible', icon: '📖' },
  { key: 'devotional', label: 'Devotionals', icon: '🌅' },
  { key: 'meditation', label: 'Meditations', icon: '🧘' },
  { key: 'prayer', label: 'Prayer', icon: '🙏' },
];

type Props = {
  partnerId: string;
  appId: string;
  tabId: string;
};

export default function PartnerBibleScreen({ partnerId, appId, tabId }: Props) {
  const { palette } = useKISTheme();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('bible');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  const blocksUrl = ROUTES.partners.organizationAppTabBlocks(partnerId, appId, tabId);

  const loadBlocks = useCallback(async () => {
    if (activeSubTab === 'bible') return;
    setLoading(true);
    try {
      const res = await getRequest(blocksUrl);
      const all: ContentBlock[] = Array.isArray(res?.data?.results)
        ? res.data.results
        : Array.isArray(res?.data)
          ? res.data
          : [];
      setBlocks(all.filter((b) => b.block_type === activeSubTab));
      setBlockError(null);
    } catch (err: any) {
      setBlockError(err?.message || 'Unable to load content.');
    } finally {
      setLoading(false);
    }
  }, [activeSubTab, blocksUrl]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBlocks();
    setRefreshing(false);
  }, [loadBlocks]);

  const renderBlock = ({ item }: { item: ContentBlock }) => (
    <View style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.surfaceElevated }]}>
      {item.title ? (
        <Text style={[styles.cardTitle, { color: palette.text }]}>{item.title}</Text>
      ) : null}
      {item.body ? (
        <Text style={[styles.cardBody, { color: palette.subtext }]}>{item.body}</Text>
      ) : null}
      {item.payload?.scripture ? (
        <Text style={[styles.cardMeta, { color: palette.primary }]}>
          📜 {String(item.payload.scripture)}
        </Text>
      ) : null}
      {item.payload?.date ? (
        <Text style={[styles.cardMeta, { color: palette.subtext }]}>
          {String(item.payload.date)}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Sub-tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: palette.divider, backgroundColor: palette.surfaceElevated }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarInner}>
          {SUB_TABS.map(({ key, label, icon }) => {
            const active = activeSubTab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setActiveSubTab(key)}
                style={[
                  styles.tabChip,
                  {
                    borderColor: active ? palette.primary : 'transparent',
                    backgroundColor: active ? palette.primary + '18' : 'transparent',
                  },
                ]}
              >
                <Text style={{ fontSize: 14 }}>{icon}</Text>
                <Text style={{ color: active ? palette.primary : palette.subtext, fontSize: 12, fontWeight: active ? '700' : '500' }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      {activeSubTab === 'bible' ? (
        <View style={{ flex: 1 }}>
          <BibleScreen />
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={blocks}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primary} />
          }
          ListEmptyComponent={() => (
            <View style={styles.center}>
              {blockError ? (
                <Text style={[styles.empty, { color: palette.danger }]}>{blockError}</Text>
              ) : (
                <>
                  <Text style={{ fontSize: 36 }}>{SUB_TABS.find((t) => t.key === activeSubTab)?.icon}</Text>
                  <Text style={[styles.empty, { color: palette.subtext }]}>
                    No {SUB_TABS.find((t) => t.key === activeSubTab)?.label.toLowerCase()} yet.{'\n'}
                    Add them via the app manager.
                  </Text>
                </>
              )}
            </View>
          )}
          renderItem={renderBlock}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  tabBarInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, gap: 4 },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  empty: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  listContent: { padding: 16, paddingBottom: 40, gap: 10 },
  card: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardBody: { fontSize: 13, lineHeight: 20 },
  cardMeta: { fontSize: 12, fontWeight: '600' },
});
