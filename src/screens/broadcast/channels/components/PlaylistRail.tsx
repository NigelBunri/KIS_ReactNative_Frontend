import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import type { BroadcastChannelPlaylist } from '@/screens/broadcast/channels/api/channels.types';

type Props = {
  playlists: BroadcastChannelPlaylist[];
  onSeeAll?: () => void;
  onPressPlaylist?: (playlist: BroadcastChannelPlaylist) => void;
};

export default function PlaylistRail({ playlists, onSeeAll, onPressPlaylist }: Props) {
  const { palette } = useKISTheme();
  const { bodyFontSize, labelFontSize, minTouchTarget, isCompactPhone } = useResponsiveLayout();
  const cardWidth = isCompactPhone ? 130 : 156;
  if (!playlists.length) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text, fontSize: bodyFontSize + 2 }]}>Playlists</Text>
        {onSeeAll ? (
          <Pressable
            onPress={onSeeAll}
            style={{ minHeight: minTouchTarget, justifyContent: 'center', paddingHorizontal: 4 }}
          >
            <Text style={[styles.seeAll, { color: palette.primaryStrong, fontSize: labelFontSize }]}>See all</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {playlists.map(item => (
          <Pressable
            key={item.id}
            onPress={() => {
              if (onPressPlaylist) {
                onPressPlaylist(item);
              }
            }}
            style={[styles.card, { width: cardWidth, backgroundColor: palette.surface, borderColor: palette.border }]}
          >
            <KISIcon name="list" size={20} color={palette.primaryStrong} />
            <Text numberOfLines={2} style={[styles.cardTitle, { color: palette.text, fontSize: labelFontSize + 1 }]}>{item.title}</Text>
            <Text numberOfLines={2} style={[styles.cardText, { color: palette.subtext, fontSize: labelFontSize }]}>{item.description || 'Curated channel collection'}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  title: { fontWeight: '900' },
  seeAll: { fontWeight: '900' },
  row: { paddingHorizontal: 16, gap: 10 },
  card: { borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 44 },
  cardTitle: { marginTop: 8, lineHeight: 18, fontWeight: '900' },
  cardText: { marginTop: 5, lineHeight: 16, fontWeight: '700' },
});
