import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { KISIcon } from '@/constants/kisIcons';
import ROUTES, { resolveBackendAssetUrl } from '@/network';
import { postRequest } from '@/network/post';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import RichTextRenderer from '@/components/feeds/RichTextRenderer';
import type { ComponentProps } from 'react';
import type { BroadcastChannelContent, BroadcastChannelContentAsset, BroadcastChannelSummary } from '@/screens/broadcast/channels/api/channels.types';
import {
  fetchChannelContentDetail,
  reactToChannelContent,
  recordChannelContentView,
  removeSavedChannelContent,
  saveChannelContent,
  shareChannelContent,
  reportChannelContent,
} from '@/screens/broadcast/channels/hooks/useChannelsData';
import ChannelCommentsPanel from '@/screens/broadcast/channels/components/ChannelCommentsPanel';
import SubscribeBellButton from '@/screens/broadcast/channels/components/SubscribeBellButton';
import { fetchPublicContentLanding } from '@/services/publicGrowthService';

const compactNumber = (value?: number) => {
  const num = Number(value || 0);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
};

const resolveAssetUrl = (asset?: BroadcastChannelContentAsset | null) => resolveBackendAssetUrl(asset?.url || asset?.thumbnail_url || '');
const resolveThumbUrl = (content?: BroadcastChannelContent | null) => resolveBackendAssetUrl(content?.thumbnail_url || content?.first_asset?.thumbnail_url || content?.first_asset?.url || content?.assets?.[0]?.thumbnail_url || content?.assets?.[0]?.url || '');

function TypeBadge({ type }: { type?: string }) {
  const { palette } = useKISTheme();
  const label = String(type || 'post').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
  return (
    <View style={[styles.typeBadge, { backgroundColor: palette.primarySoft }]}> 
      <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function MediaStage({ content }: { content: BroadcastChannelContent }) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const stageHeight = compact ? 240 : responsive.isTablet && responsive.isLandscape ? 420 : 340;
  const assets = content.assets?.length ? content.assets : content.first_asset ? [content.first_asset] : [];
  const primary = assets[0];
  const imageUrl = resolveThumbUrl(content) || resolveAssetUrl(primary);
  const type = content.content_type;

  if (type === 'text' || type === 'rich_text' || (!imageUrl && !primary && content.text_plain)) {
    return (
      <View style={[styles.textStage, { backgroundColor: palette.surface, minHeight: stageHeight, paddingHorizontal: responsive.pageGutter }]}> 
        <RichTextRenderer
          value={(content.text_doc || null) as ComponentProps<typeof RichTextRenderer>['value']}
          fallback={content.text_plain || content.title || ''}
          style={[styles.richTextStage, { color: palette.text }]}
        />
      </View>
    );
  }

  if (type === 'audio') {
    return (
      <View style={[styles.mediaStage, { backgroundColor: palette.surfaceElevated, height: stageHeight }]}> 
        <LinearGradient colors={[palette.primarySoft, palette.surfaceElevated, palette.surface]} style={StyleSheet.absoluteFillObject} />
        <View style={[styles.largeIconBubble, { backgroundColor: palette.surface }]}> 
          <KISIcon name="audio" size={42} color={palette.primaryStrong} />
        </View>
        <Text style={[styles.mediaStageTitle, { color: palette.text }]}>{primary?.caption || content.title || 'Audio broadcast'}</Text>
      </View>
    );
  }

  if (type === 'document') {
    return (
      <View style={[styles.mediaStage, { backgroundColor: palette.surfaceElevated, height: stageHeight }]}> 
        <LinearGradient colors={[palette.primarySoft, palette.surfaceElevated, palette.surface]} style={StyleSheet.absoluteFillObject} />
        <View style={[styles.largeIconBubble, { backgroundColor: palette.surface }]}> 
          <KISIcon name="file" size={42} color={palette.primaryStrong} />
        </View>
        <Text style={[styles.mediaStageTitle, { color: palette.text }]}>{primary?.caption || content.title || 'Document'}</Text>
        {primary?.url ? <Pressable onPress={() => Linking.openURL(resolveAssetUrl(primary) || primary.url || '')} style={[styles.openFileButton, { backgroundColor: palette.text }]}><Text style={{ color: palette.surface, fontWeight: '900' }}>Open file</Text></Pressable> : null}
      </View>
    );
  }

  if (type === 'live_stream') {
    return (
      <View style={[styles.mediaStage, { backgroundColor: palette.surfaceElevated, height: stageHeight }]}> 
        {imageUrl ? <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <LinearGradient colors={[palette.primarySoft, palette.surfaceElevated, palette.surface]} style={StyleSheet.absoluteFillObject} />}
        <View style={styles.mediaOverlay} />
        <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>{content.status === 'scheduled' ? 'Scheduled' : 'Live'}</Text></View>
        <KISIcon name="radio" size={46} color="#fff" />
      </View>
    );
  }

  return (
    <View style={[styles.mediaStage, { backgroundColor: palette.surfaceElevated, height: stageHeight }]}> 
      {imageUrl ? <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <LinearGradient colors={[palette.primarySoft, palette.surfaceElevated, palette.surface]} style={StyleSheet.absoluteFillObject} />}
      <View style={styles.mediaOverlay} />
      {['video', 'short_video'].includes(type) ? <View style={styles.playBubble}><KISIcon name="play" size={30} color="#fff" /></View> : null}
      {assets.length > 1 ? <View style={styles.galleryCount}><Text style={styles.galleryCountText}>{assets.length} files</Text></View> : null}
    </View>
  );
}

export default function ChannelContentDetailPage() {
  const route = useRoute<RouteProp<RootStackParamList, 'ChannelContentDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'ChannelContentDetail'>>();
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const insets = useSafeAreaInsets();
  const themed = useMemo(() => makeStyles(palette), [palette]);
  const [content, setContent] = useState<BroadcastChannelContent | null>(route.params?.item || null);
  const [loading, setLoading] = useState(!route.params?.item);
  const [counts, setCounts] = useState<Record<string, number>>((route.params?.item?.engagement_counts || {}) as Record<string, number>);
  const [saved, setSaved] = useState(false);
  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const channel = (content?.channel || route.params?.channel || null) as BroadcastChannelSummary | null;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchChannelContentDetail(route.params.contentId)
      .then(next => {
        if (mounted && next) {
          setContent(next);
          setCounts((next.engagement_counts || {}) as Record<string, number>);
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [route.params.contentId]);

  useEffect(() => {
    if (content?.id) void recordChannelContentView(content.id);
  }, [content?.id]);

  const applyCounts = useCallback((payload: any) => {
    if (payload?.engagement_counts) setCounts(payload.engagement_counts);
  }, []);

  const handleReact = useCallback(async () => {
    if (!content?.id) return;
    setCounts(prev => ({ ...prev, reactions: Number(prev.reactions || 0) + 1 }));
    applyCounts(await reactToChannelContent(content.id));
  }, [applyCounts, content?.id]);

  const handleSave = useCallback(async () => {
    if (!content?.id) return;
    const next = !saved;
    setSaved(next);
    applyCounts(next ? await saveChannelContent(content.id) : await removeSavedChannelContent(content.id));
  }, [applyCounts, content?.id, saved]);

  const handleShare = useCallback(async () => {
    if (!content?.id) return;
    const title = content?.title || 'KIS channel content';
    let url = '';
    try {
      const publicMeta = await fetchPublicContentLanding(content.id);
      url = publicMeta?.share_card?.url || publicMeta?.url || '';
    } catch {
      url = '';
    }
    const byline = channel?.display_name ? `By ${channel.display_name}` : '';
    const message = [title, byline, url].filter(Boolean).join('\n');
    const result = await Share.share({ message, url: url || undefined, title });
    const completed = result.action === Share.sharedAction;
    if (completed) applyCounts(await shareChannelContent(content.id, true));
  }, [applyCounts, channel?.display_name, content?.id, content?.title]);


  const handleReport = useCallback(() => {
    if (!content?.id) return;
    Alert.alert('Report content', 'Send this content to moderation review?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', style: 'destructive', onPress: () => { void reportChannelContent(content.id, 'Reported from channel detail'); } },
    ]);
  }, [content?.id]);

  const handleEmbed = useCallback(async () => {
    if (!content?.id) return;
    try {
      const res = await postRequest(ROUTES.broadcasts.channelContentEmbedToken(content.id), {}, {
        errorMessage: 'Unable to generate embed token.',
      });
      const token: string = res.data?.token || res.data?.embed_token || '';
      const embedUrl: string = res.data?.embed_url || '';
      if (token || embedUrl) {
        Alert.alert('Embed ready', embedUrl || `Use this token to embed the content:\n\n${token}`, [{ text: 'OK' }]);
      } else {
        Alert.alert('Embed', 'Embedding is not available for this content.');
      }
    } catch {
      Alert.alert('Embed', 'Unable to generate embed token. Please try again.');
    }
  }, [content?.id]);

  if (loading && !content) {
    return <SafeAreaView style={[styles.centered, { backgroundColor: palette.background }]}><ActivityIndicator color={palette.primaryStrong} /></SafeAreaView>;
  }

  if (!content) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: palette.background }]}> 
        <Text style={{ color: palette.text, fontWeight: '900' }}>Content unavailable</Text>
        <Pressable onPress={() => navigation.goBack()} style={[styles.retryButton, { borderColor: palette.border }]}><Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>Go back</Text></Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]} edges={['top']}>
      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + (compact ? 18 : 28) }}>
        <View style={[styles.stageWrap, { minHeight: compact ? 240 : 320 }]}>
          <MediaStage content={content} />
          <Pressable onPress={() => navigation.goBack()} style={[styles.backButton, { top: insets.top + 8 }]}><KISIcon name="arrow-left" size={20} color="#fff" /></Pressable>
        </View>

        <View style={[themed.contentCard, { marginHorizontal: responsive.pageGutter, padding: compact ? 12 : 16 }]}>
          <View style={styles.titleTopRow}>
            <TypeBadge type={content.content_type} />
            <Text style={[styles.dateText, { color: palette.subtext }]}>{content.published_at ? new Date(content.published_at).toLocaleDateString() : content.status || 'Draft'}</Text>
          </View>
          <Text style={[styles.title, { color: palette.text, fontSize: compact ? 19 : 24, lineHeight: compact ? 25 : 31 }]}>{content.title || content.text_plain_preview || 'Untitled content'}</Text>
          {content.content_type !== 'text' && content.content_type !== 'rich_text' && (content.description || content.text_plain) ? (
            <Text style={[styles.description, { color: palette.subtext }]}>{content.description || content.text_plain}</Text>
          ) : null}

          {channel ? (
            <Pressable onPress={() => navigation.navigate('ChannelHome', { channelId: channel.id, channel })} style={[styles.channelRow, { borderColor: palette.border }]}> 
              <View style={[styles.channelAvatar, { backgroundColor: palette.primarySoft }]}><Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>{String(channel.display_name || channel.handle || 'KC').slice(0, 2).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.channelName, { color: palette.text }]}>{channel.display_name || 'KIS Channel'}</Text>
                <Text style={[styles.channelHandle, { color: palette.subtext }]}>@{channel.handle || 'channel'} · {compactNumber(channel.subscriber_count)} subscribers</Text>
              </View>
              <SubscribeBellButton channelId={channel.id} initialSubscribed={Boolean(channel.is_subscribed)} compact />
            </Pressable>
          ) : null}

          <View style={[styles.actionGrid, { gap: compact ? 8 : 10 }]}>
            <ActionButton icon="heart" label="Like" value={compactNumber(counts.reactions)} onPress={handleReact} />
            <ActionButton icon="comment" label="Comment" value={compactNumber(counts.comments)} onPress={() => scrollViewRef.current?.scrollToEnd({ animated: true })} />
            <ActionButton icon="share" label="Share" value={compactNumber(counts.shares)} onPress={handleShare} />
            <ActionButton icon="bookmark" label="Save" value={saved ? 'Saved' : compactNumber(counts.saves)} onPress={handleSave} />
            <ActionButton icon="link" label="Embed" value="Token" onPress={handleEmbed} />
            <ActionButton icon="report" label="Report" value="Report" onPress={handleReport} />
          </View>
        </View>

        <ChannelCommentsPanel contentId={content.id} onCountChange={count => setCounts(prev => ({ ...prev, comments: count }))} />

        {content.assets?.length ? (
          <View style={[styles.assetsBlock, { paddingHorizontal: responsive.pageGutter }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Files</Text>
            {content.assets.map(asset => (
              <View key={asset.id || asset.url} style={[styles.assetRow, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
                <KISIcon name={asset.asset_type === 'audio' ? 'audio' : asset.asset_type === 'document' ? 'file' : 'image'} size={18} color={palette.primaryStrong} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text numberOfLines={1} style={[styles.assetTitle, { color: palette.text }]}>{asset.caption || asset.mime_type || asset.asset_type || 'Attachment'}</Text>
                  <Text style={[styles.assetMeta, { color: palette.subtext }]}>{asset.processing_status || 'ready'}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({ icon, label, value, onPress }: { icon: string; label: string; value: string; onPress: () => void }) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  return (
    <Pressable onPress={onPress} style={[styles.actionButton, { backgroundColor: palette.surfaceElevated, borderColor: palette.border, width: compact ? '47%' : '30.5%', minHeight: compact ? 68 : 76 }]}> 
      <KISIcon name={icon} size={18} color={palette.primaryStrong} />
      <Text style={[styles.actionLabel, { color: palette.text }]}>{label}</Text>
      <Text style={[styles.actionValue, { color: palette.subtext }]}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stageWrap: { minHeight: 320 },
  mediaStage: { height: 340, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  textStage: { minHeight: 340, paddingHorizontal: 24, paddingTop: 70, justifyContent: 'center' },
  richTextStage: { fontSize: 25, lineHeight: 34, fontWeight: '800' },
  mediaOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.16)' },
  backButton: { position: 'absolute', left: 16, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  playBubble: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' },
  largeIconBubble: { width: 94, height: 94, borderRadius: 47, alignItems: 'center', justifyContent: 'center' },
  mediaStageTitle: { marginTop: 18, fontSize: 18, fontWeight: '900' },
  openFileButton: { marginTop: 14, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  liveBadge: { position: 'absolute', top: 78, left: 20, backgroundColor: '#C0262D', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  liveBadgeText: { color: '#fff', fontWeight: '900', fontSize: 11, textTransform: 'uppercase' },
  galleryCount: { position: 'absolute', right: 14, bottom: 14, backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  galleryCountText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  titleTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  dateText: { fontSize: 11, fontWeight: '800' },
  title: { marginTop: 12, fontSize: 24, lineHeight: 31, fontWeight: '900', letterSpacing: 0 },
  description: { marginTop: 10, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  channelRow: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  channelAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  channelName: { fontSize: 14, fontWeight: '900' },
  channelHandle: { marginTop: 2, fontSize: 11, fontWeight: '700' },
  actionGrid: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionButton: { width: '30.5%', minHeight: 76, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', padding: 8 },
  actionLabel: { marginTop: 5, fontSize: 11, fontWeight: '900' },
  actionValue: { marginTop: 2, fontSize: 10, fontWeight: '700' },
  assetsBlock: { paddingHorizontal: 16, marginTop: 18 },
  sectionTitle: { fontSize: 17, fontWeight: '900', marginBottom: 10 },
  assetRow: { borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  assetTitle: { fontSize: 13, fontWeight: '900' },
  assetMeta: { marginTop: 2, fontSize: 11, fontWeight: '700' },
  retryButton: { marginTop: 14, borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
});

const makeStyles = (palette: ReturnType<typeof useKISTheme>['palette']) => StyleSheet.create({
  contentCard: {
    marginHorizontal: 16,
    marginTop: -24,
    borderRadius: 8,
    padding: 16,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.shadow ?? '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
});
