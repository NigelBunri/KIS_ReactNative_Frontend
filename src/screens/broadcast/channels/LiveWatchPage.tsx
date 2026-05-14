import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KISIcon } from '@/constants/kisIcons';
import { resolveBackendAssetUrl } from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import type { BroadcastChannelLiveStream } from '@/screens/broadcast/channels/api/channels.types';
import { fetchLiveStreamDetail } from '@/screens/broadcast/channels/hooks/useChannelsData';

export default function LiveWatchPage() {
  const route = useRoute<RouteProp<RootStackParamList, 'LiveWatch'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'LiveWatch'>>();
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const [stream, setStream] = useState<BroadcastChannelLiveStream | null>(route.params?.stream || null);
  const [loading, setLoading] = useState(!route.params?.stream);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchLiveStreamDetail(route.params.streamId)
      .then(next => { if (mounted && next) setStream(next); })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [route.params.streamId]);

  const thumb = useMemo(() => resolveBackendAssetUrl(stream?.thumbnail_url || ''), [stream?.thumbnail_url]);

  if (loading && !stream) {
    return <SafeAreaView style={[styles.centered, { backgroundColor: palette.background }]}><ActivityIndicator color={palette.primaryStrong} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]} edges={['top']}>
      <View style={styles.stage}>
        {thumb ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <LinearGradient colors={[palette.primarySoft, palette.surfaceElevated, palette.surface]} style={StyleSheet.absoluteFillObject} />}
        <View style={styles.scrim} />
        <Pressable onPress={() => navigation.goBack()} style={[styles.backButton, { top: insets.top + 8 }]}> 
          <KISIcon name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={styles.playerCenter}>
          <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>{stream?.status === 'live' ? 'LIVE' : stream?.status === 'ended' ? 'REPLAY' : 'SCHEDULED'}</Text></View>
          <View style={styles.playCircle}><KISIcon name={stream?.status === 'live' ? 'radio' : 'play'} size={42} color="#fff" /></View>
          <Text style={styles.playerText}>{stream?.playback_url || stream?.replay_url ? 'Playback URL ready' : 'Player provider not connected yet'}</Text>
        </View>
      </View>
      <View style={[styles.infoCard, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
        <Text style={[styles.title, { color: palette.text }]}>{stream?.title || 'Live stream'}</Text>
        <Text style={[styles.meta, { color: palette.subtext }]}>{stream?.viewer_count || 0} watching · peak {stream?.peak_viewer_count || 0}</Text>
        <Text style={[styles.description, { color: palette.subtext }]}>{stream?.description || 'Live chat, moderation, reactions, and provider playback will be completed after the live provider is selected.'}</Text>
        <View style={[styles.chatPlaceholder, { borderColor: palette.border }]}> 
          <KISIcon name="chat" size={18} color={palette.primaryStrong} />
          <Text style={[styles.chatText, { color: palette.text }]}>Live chat placeholder</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stage: { height: 380, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.30)' },
  backButton: { position: 'absolute', left: 16, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  playerCenter: { alignItems: 'center', paddingHorizontal: 22 },
  liveBadge: { backgroundColor: '#C0262D', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 14 },
  liveBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  playCircle: { width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center' },
  playerText: { color: '#fff', marginTop: 14, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  infoCard: { margin: 16, marginTop: -24, borderWidth: 1, borderRadius: 8, padding: 16 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  meta: { marginTop: 6, fontSize: 12, fontWeight: '800' },
  description: { marginTop: 12, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  chatPlaceholder: { marginTop: 16, borderWidth: 1, borderRadius: 8, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatText: { fontSize: 13, fontWeight: '900' },
});
