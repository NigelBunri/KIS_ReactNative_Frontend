import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SongLibrary'>;

type Song = {
  id: string;
  title: string;
  artist?: string;
  key?: string;
  tempo?: string;
  lyrics?: string;
  ccli_number?: string;
};

export default function SongLibraryScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      getRequest(`${ROUTES.church.songs}${params}`)
        .then(res => {
          if (res?.success) {
            const raw = res.data;
            setSongs(Array.isArray(raw) ? raw : raw?.results ?? []);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [search]),
  );

  const renderSong = ({ item }: { item: Song }) => {
    const expanded = expandedId === item.id;
    return (
      <TouchableOpacity
        style={[styles.songCard, expanded && styles.songCardExpanded]}
        onPress={() => setExpandedId(prev => prev === item.id ? null : item.id)}
        activeOpacity={0.8}
        hitSlop={{ top: 4, bottom: 4 }}
      >
        <View style={styles.songRow}>
          <View style={styles.songIconWrap}>
            <KISIcon name="musical-notes-outline" size={20} tone="primary" />
          </View>
          <View style={styles.songMeta}>
            <Text style={styles.songTitle}>{item.title}</Text>
            {item.artist ? <Text style={styles.songArtist}>{item.artist}</Text> : null}
          </View>
          <View style={styles.songTags}>
            {item.key && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>Key: {item.key}</Text>
              </View>
            )}
            {item.tempo && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{item.tempo}</Text>
              </View>
            )}
          </View>
          <KISIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} tone="muted" />
        </View>

        {expanded && (
          <View style={styles.songExpanded}>
            {item.lyrics ? (
              <>
                <Text style={styles.lyricsLabel}>Lyrics</Text>
                <ScrollView style={styles.lyricsScroll} nestedScrollEnabled>
                  <Text style={styles.lyricsText}>{item.lyrics}</Text>
                </ScrollView>
              </>
            ) : (
              <Text style={styles.noLyrics}>Lyrics not available.</Text>
            )}
            {item.ccli_number && (
              <Text style={styles.ccliText}>CCLI #: {item.ccli_number}</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.searchBar}>
        <KISIcon name="search" size={18} tone="muted" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search title or artist..."
          placeholderTextColor={palette.subtext}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={s => s.id}
          renderItem={renderSong}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {search ? `No songs matching "${search}".` : 'No songs in the library yet.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, marginTop: 25 },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderRadius: 12,
      marginHorizontal: sp,
      marginTop: 12,
      marginBottom: 10,
      paddingHorizontal: 12,
      height: 44,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
    },
    searchInput: { flex: 1, fontSize: 15, color: palette.text, marginLeft: 8 },
    list: { padding: sp, gap: 10, paddingBottom: 80 },
    songCard: {
      backgroundColor: palette.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      overflow: 'hidden',
    },
    songCardExpanded: { borderColor: palette.primary },
    songRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      minHeight: 60,
    },
    songIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: palette.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    songMeta: { flex: 1 },
    songTitle: { fontSize: 15, fontWeight: '600', color: palette.text },
    songArtist: { fontSize: 12, color: palette.subtext, marginTop: 2 },
    songTags: { flexDirection: 'row', gap: 4, marginRight: 8 },
    tag: {
      backgroundColor: palette.surface,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    tagText: { fontSize: 11, color: palette.subtext },
    songExpanded: {
      padding: 14,
      paddingTop: 0,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: palette.divider,
    },
    lyricsLabel: { fontSize: 12, fontWeight: '700', color: palette.subtext, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 10 },
    lyricsScroll: { maxHeight: 220 },
    lyricsText: { fontSize: 14, color: palette.text, lineHeight: 22 },
    noLyrics: { fontSize: 14, color: palette.subtext, fontStyle: 'italic', marginTop: 10, marginBottom: 4 },
    ccliText: { fontSize: 12, color: palette.subtext, marginTop: 10 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 14, color: palette.subtext, textAlign: 'center' },
  });
}
