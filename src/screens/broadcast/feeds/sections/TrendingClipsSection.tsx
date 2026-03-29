import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

import FeedItemCard from '@/components/broadcast/FeedItemCard';
import SectionHeader from '@/screens/broadcast/feeds/components/SectionHeader';

export type TrendingClipItem = {
  id: string;
  title?: string;
  body?: string;
  broadcastedAt?: string;
  attachments?: any[];
  engagement?: { reactions?: number; comments?: number };
};

type Props = {
  items: TrendingClipItem[];
  onSeeAll?: () => void;
  onOpen: (item: TrendingClipItem) => void;
  onReact: (item: TrendingClipItem) => void;
};

export default function TrendingClipsSection({ items, onSeeAll, onOpen, onReact }: Props) {
  const { palette } = useKISTheme();

  const mapped = useMemo(() => {
    return items.map((it) => ({
      id: it.id,
      title: it.title,
      body: it.body,
      broadcastedAt: it.broadcastedAt,
      attachments: it.attachments ?? [],
      engagement: it.engagement ?? { reactions: 0, comments: 0 },
    }));
  }, [items]);

  return (
    <View
      style={{
        borderWidth: 2,
        borderColor: palette.divider,
        borderRadius: 22,
        backgroundColor: palette.card,
        paddingVertical: 10,
      }}
    >
      <View style={{ paddingHorizontal: 12, paddingBottom: 6 }}>
        <SectionHeader title="Trending Clips" rightLabel="See All" onRightPress={onSeeAll} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 6 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {mapped.map((it) => (
            <View key={it.id} style={{ width: 300 }}>
              <FeedItemCard item={it as any} onPress={() => onOpen(it)} onReact={() => onReact(it)} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
