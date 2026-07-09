import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'KingdomMusic'>;

type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  duration?: string;
  play_count: number;
  genre: string;
};

const GENRES = ['All', 'Gospel', 'Worship', 'Christian HipHop', 'Contemporary', 'Hymn'];

export default function KingdomMusicScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [genre, setGenre] = useState('All');
  const [nowPlaying, setNowPlaying] = useState<MusicTrack | null>(null);
  const [playLoading, setPlayLoading] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.mediaExtended.musicTracks)
        .then((res: any) => {
          if (active) setTracks(res?.data ?? res ?? []);
        })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  const filtered = genre === 'All' ? tracks : tracks.filter((t) => t.genre === genre);

  const handlePlay = async (track: MusicTrack) => {
    setPlayLoading(track.id);
    try {
      await postRequest(ROUTES.mediaExtended.musicTrackPlay(track.id), {});
      setNowPlaying(track);
      setTracks((prev) =>
        prev.map((t) => t.id === track.id ? { ...t, play_count: (t.play_count ?? 0) + 1 } : t),
      );
    } catch {
      Alert.alert('Error', 'Could not play track.');
    } finally {
      setPlayLoading(null);
    }
  };

  const handleAddToPlaylist = async (track: MusicTrack) => {
    try {
      const res: any = await getRequest(ROUTES.broadcasts.userPlaylists);
      const playlists: any[] = res?.data?.results ?? res?.data ?? res?.results ?? [];
      if (!playlists.length) {
        const createRes: any = await postRequest(ROUTES.broadcasts.userPlaylists, { title: 'My Music', description: '' });
        const playlistId = createRes?.data?.id ?? createRes?.id;
        if (playlistId) {
          await postRequest(ROUTES.broadcasts.userPlaylistItems(String(playlistId)), { content_id: track.id, content_type: 'music_track' });
          Alert.alert('Added', `"${track.title}" added to My Music playlist.`);
        }
      } else if (playlists.length === 1) {
        const playlistId = playlists[0].id;
        await postRequest(ROUTES.broadcasts.userPlaylistItems(String(playlistId)), { content_id: track.id, content_type: 'music_track' });
        Alert.alert('Added', `"${track.title}" added to ${playlists[0].title}.`);
      } else {
        Alert.alert(
          'Add to Playlist',
          'Choose a playlist:',
          playlists.slice(0, 4).map(pl => ({
            text: pl.title,
            onPress: async () => {
              try {
                await postRequest(ROUTES.broadcasts.userPlaylistItems(String(pl.id)), { content_id: track.id, content_type: 'music_track' });
                Alert.alert('Added', `"${track.title}" added to ${pl.title}.`);
              } catch { Alert.alert('Error', 'Could not add to playlist.'); }
            },
          })).concat([{ text: 'Cancel', style: 'cancel' } as any]),
        );
      }
    } catch {
      Alert.alert('Error', 'Could not add to playlist. Please try again.');
    }
  };

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
    header: { padding: sp, paddingBottom: sp + 4 },
    backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, minHeight: 44 },
    backLabel: { fontSize: 16, color: palette.ivory, marginLeft: 4 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: palette.ivory },
    genreBar: { paddingHorizontal: sp, paddingVertical: 10 },
    chipRow: { flexDirection: 'row', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      minHeight: 34,
      justifyContent: 'center',
    },
    chipText: { fontSize: 13, fontWeight: '500' },
    scroll: { flex: 1 },
    content: { paddingBottom: nowPlaying ? 140 : 80 },
    trackItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
      minHeight: 64,
      gap: 12,
    },
    trackActive: { backgroundColor: palette.primarySoft },
    trackInfo: { flex: 1 },
    trackTitle: { fontSize: 15, fontWeight: '600', color: palette.text },
    trackArtist: { fontSize: 13, color: palette.subtext, marginTop: 2 },
    trackMeta: { fontSize: 12, color: palette.subtext, marginTop: 2 },
    trackActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    actionBtn: {
      minWidth: 44,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    nowPlayingBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: sp,
      paddingBottom: sp + 16,
    },
    nowPlayingContent: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.primaryStrong,
      borderRadius: 12,
      padding: 12,
      gap: 12,
    },
    npIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: palette.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    npInfo: { flex: 1 },
    npTitle: { fontSize: 14, fontWeight: '600', color: palette.ivory },
    npArtist: { fontSize: 12, color: palette.ivory, opacity: 0.8 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { textAlign: 'center', color: palette.subtext, padding: sp * 2 },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="chevron-back-outline" size={22} color={palette.ivory} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Kingdom Music</Text>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreBar}>
        <View style={styles.chipRow}>
          {GENRES.map((g) => {
            const active = genre === g;
            return (
              <Pressable
                key={g}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? palette.primary : palette.surface,
                    borderColor: active ? palette.primary : palette.divider,
                  },
                ]}
                onPress={() => setGenre(g)}
                hitSlop={4}
              >
                <Text style={[styles.chipText, { color: active ? palette.ivory : palette.text }]}>
                  {g}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {filtered.length === 0 && (
          <Text style={styles.empty}>No tracks found.</Text>
        )}
        {filtered.map((track) => {
          const isPlaying = nowPlaying?.id === track.id;
          return (
            <View
              key={track.id}
              style={[styles.trackItem, isPlaying && styles.trackActive]}
            >
              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                <Text style={styles.trackMeta}>
                  {track.duration ?? ''}
                  {track.duration ? ' · ' : ''}
                  {track.play_count ?? 0} plays
                </Text>
              </View>
              <View style={styles.trackActions}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => handleAddToPlaylist(track)}
                  hitSlop={4}
                >
                  <KISIcon name="add-circle-outline" size={24} color={palette.subtext} />
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => handlePlay(track)}
                  hitSlop={4}
                  disabled={playLoading === track.id}
                >
                  {playLoading === track.id ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : (
                    <KISIcon
                      name={isPlaying ? 'pause-circle-outline' : 'play-circle-outline'}
                      size={32}
                      color={palette.primary}
                    />
                  )}
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {nowPlaying && (
        <LinearGradient
          colors={[palette.gradientStart, palette.gradientEnd]}
          style={styles.nowPlayingBar}
        >
          <View style={styles.nowPlayingContent}>
            <View style={styles.npIcon}>
              <KISIcon name="musical-notes-outline" size={22} color={palette.ivory} />
            </View>
            <View style={styles.npInfo}>
              <Text style={styles.npTitle} numberOfLines={1}>{nowPlaying.title}</Text>
              <Text style={styles.npArtist} numberOfLines={1}>{nowPlaying.artist}</Text>
            </View>
            <Pressable
              onPress={() => setNowPlaying(null)}
              style={styles.actionBtn}
              hitSlop={4}
            >
              <KISIcon name="close-circle-outline" size={24} color={palette.ivory} />
            </Pressable>
          </View>
        </LinearGradient>
      )}
    </SafeAreaView>
  );
}
