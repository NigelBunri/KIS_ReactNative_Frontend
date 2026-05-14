import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import type { BroadcastChannelPlaylist } from '@/screens/broadcast/channels/api/channels.types';

type Props = { playlists: BroadcastChannelPlaylist[]; onSeeAll?: () => void };

export default function PlaylistRail({ playlists, onSeeAll }: Props) {
  const { palette } = useKISTheme();
  if (!playlists.length) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>Playlists</Text>
        {onSeeAll ? <Pressable onPress={onSeeAll}><Text style={[styles.seeAll, { color: palette.primaryStrong }]}>See all</Text></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {playlists.map(item => (
          <View key={item.id} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
            <KISIcon name="list" size={20} color={palette.primaryStrong} />
            <Text numberOfLines={2} style={[styles.cardTitle, { color: palette.text }]}>{item.title}</Text>
            <Text numberOfLines={2} style={[styles.cardText, { color: palette.subtext }]}>{item.description || 'Curated channel collection'}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  title: { fontSize: 17, fontWeight: '900' },
  seeAll: { fontSize: 12, fontWeight: '900' },
  row: { paddingHorizontal: 16, gap: 10 },
  card: { width: 156, borderWidth: 1, borderRadius: 8, padding: 12 },
  cardTitle: { marginTop: 8, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  cardText: { marginTop: 5, fontSize: 11, lineHeight: 16, fontWeight: '700' },
});
