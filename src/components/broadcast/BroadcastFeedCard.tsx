import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/constants';
import CommentThreadPanel from '@/components/feeds/CommentThreadPanel';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISText from '@/components/common/KISText';
import { resolveBackendAssetUrl } from '@/network';
import RichTextRenderer from '@/components/feeds/RichTextRenderer';
import {
  getFeedPlainText,
  getFeedRichTextValue,
} from '@/components/feeds/richTextValue';
import {
  dedupeAttachmentPreviews,
  getAttachmentPreviewInfo,
} from './attachmentPreview';
import BroadcastFeedVideoPreview from '@/components/broadcast/BroadcastFeedVideoPreview';
import {
  extractBroadcastAuthorBio,
  formatKisHandle,
  isUserBroadcastSource,
  truncateWords,
} from '@/components/broadcast/authorProfileUtils';

type BroadcastSourceMeta = {
  type:
    | 'community'
    | 'partner'
    | 'channel'
    | 'market'
    | 'lesson'
    | 'live'
    | string;
  id?: string | null;
  name?: string;
  conversation_id?: string;
  join_policy?: string;
  is_member?: boolean;
  allow_apply?: boolean;
  allow_subscribe?: boolean;
  auto_approve?: boolean;
  methods?: string[];
  is_subscribed?: boolean;
  can_open?: boolean;
  verified?: boolean;
  tier?: 'free' | 'pro' | 'business' | 'education' | string;
  followers_count?: number;
};

export type BroadcastFeedItem = {
  id: string;
  source_type: string;
  title?: string;
  text?: string;
  styled_text?: { text?: string } | null;
  text_doc?: any;
  text_plain?: string;
  attachments?: any[];
  author?: {
    display_name?: string;
    avatar_url?: string;
    id?: string;
    profile_id?: string;
    bio?: string;
    headline?: string;
    summary?: string;
  };
  created_at?: string;
  broadcasted_at?: string;
  reaction_count?: number;
  viewer_reaction?: string | null;
  viewer_saved?: boolean;
  comment_count?: number;
  comment_conversation_id?: string | null;
  share_count?: number;
  save_count?: number;
  view_count?: number;
  is_live?: boolean;
  live_viewers?: number;
  is_premium?: boolean;
  is_lesson?: boolean;
  lesson_duration?: number;
  lesson_level?: 'beginner' | 'intermediate' | 'advanced';
  product?: {
    name?: string;
    description?: string;
    price?: string;
    currency?: string;
    stock_qty?: number;
    badge?: 'drop' | 'limited' | 'exclusive';
  };
  video_category?: 'shorts' | 'videos' | 'lessons' | string | null;
  video_duration_seconds?: number;
  source?: BroadcastSourceMeta;
};

type Props = {
  item: BroadcastFeedItem;
  onLike: () => void;
  onShare: () => void;
  onOpenSource?: () => void;
  onOpenMarket?: () => void;
  onMenuPress?: () => void;
  // Optional attachment index — when this item has multiple uploaded
  // attachments (see the multi-attachment strip below), tapping a specific
  // one opens the full-screen viewer seeded to that attachment instead of
  // always the first.
  onVideoPress?: (attachmentIndex?: number) => void;
  onSave?: () => void;
  onJoinLesson?: () => void;
  onOpenAuthorProfile?: () => void;
  commentConversationId?: string | null;
  fetchConversationId?: () => Promise<string | null>;
  onConversationResolved?: (conversationId: string | null) => void;
  onMessageCountChange?: (count: number) => void;
  contextLabel?: string;
  showComments?: boolean;
  onToggleComments?: () => void;
  // True while this item's comment room is being opened (see
  // FeedsDiscoverPage's handleOpenComments) - shows a spinner in place of
  // the comment icon instead of leaving the tap looking unresponsive.
  commentsLoading?: boolean;
  onSubscribe?: () => void | Promise<void | boolean>;
  watchProgress?: number;
};

const fallbackAvatar = require('@/assets/logo-light.png');

const formatDuration = (seconds: number) => {
  const safe = Number.isFinite(Number(seconds))
    ? Math.max(0, Math.floor(Number(seconds)))
    : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const safeTimeLabel = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // lightweight “time ago” feel without extra deps
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const getTextExcerpt = (item: BroadcastFeedItem) => {
  return getFeedPlainText(item).replace(/\s+/g, ' ').trim();
};

export default function BroadcastFeedCard({
  item,
  onLike,
  onShare,
  onOpenSource,
  onOpenMarket,
  onMenuPress,
  onVideoPress,
  onSave,
  onJoinLesson,
  onOpenAuthorProfile,
  onToggleComments,
  commentsLoading,
  onSubscribe,
  watchProgress,
  showComments,
  commentConversationId,
  fetchConversationId,
  onConversationResolved,
  onMessageCountChange,
  contextLabel,
}: Props) {
  const { palette, tokens, gradients } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const [excerptExpanded, setExcerptExpanded] = useState(false);
  const [authorBioExpanded, setAuthorBioExpanded] = useState(false);

  const when = safeTimeLabel(item.broadcasted_at ?? item.created_at);
  const sourceName =
    item.source?.name ||
    (item.source?.type
      ? item.source.type.charAt(0).toUpperCase() + item.source.type.slice(1)
      : '') ||
    '';
  const isUserSource = isUserBroadcastSource(item);
  const authorDisplayName = String(item.author?.display_name ?? '').trim();
  const authorName = isUserSource
    ? authorDisplayName || 'KIS user'
    : authorDisplayName || sourceName || 'Broadcast';
  const headerName = isUserSource ? formatKisHandle(authorName) : authorName;
  const authorBio = isUserSource ? extractBroadcastAuthorBio(item) : '';
  const truncatedAuthorBio = useMemo(
    () => truncateWords(authorBio, 18),
    [authorBio],
  );
  const metaSource = isUserSource
    ? sourceName || 'Broadcast profile'
    : sourceName;

  const excerpt = getTextExcerpt(item);
  const richTextValue = getFeedRichTextValue(item);
  const showTitle = Boolean(item.title && item.title.trim().length);
  const showExcerpt = Boolean(excerpt && excerpt.length);

  const attachmentPreviews = useMemo(() => {
    // Same construction order as FeedItemCard.tsx (the trending clip card,
    // where video already plays correctly): dedupe BEFORE filtering by
    // url/previewUri presence, and correlate `.raw` back by index against
    // the same unfiltered array dedupe ran over — BroadcastFeedVideoPreview
    // needs the raw attachment record (stream_url/resource_url/etc.), not
    // just the preview info, to resolve a playable video source.
    const rawAttachments = (Array.isArray(item.attachments) ? item.attachments : []).filter(Boolean);
    const deduped = dedupeAttachmentPreviews(rawAttachments.map(a => getAttachmentPreviewInfo(a))).map(
      (info, i) => ({ ...info, raw: rawAttachments[i] ?? null }),
    );
    return deduped.filter(info => Boolean(info.previewUri || info.url));
  }, [item.attachments]);
  const [activeAttachmentIndex, setActiveAttachmentIndex] = useState(0);
  // Local, card-only - starts playing a single-video item's thumbnail in
  // place when the play button is tapped. Never sent to a parent callback;
  // tapping anywhere else on a video-forward card still opens the
  // full-screen viewer via onVideoPress (see the YouTube-style branch of
  // this component's return below).
  const [inlinePlaying, setInlinePlaying] = useState(false);

  const handlePrevAttachment = useCallback(() => {
    if (attachmentPreviews.length === 0) return;
    setActiveAttachmentIndex(prev =>
      prev === 0 ? attachmentPreviews.length - 1 : prev - 1,
    );
  }, [attachmentPreviews.length]);

  const handleNextAttachment = useCallback(() => {
    if (attachmentPreviews.length === 0) return;
    setActiveAttachmentIndex(prev => (prev + 1) % attachmentPreviews.length);
  }, [attachmentPreviews.length]);

  useEffect(() => {
    setActiveAttachmentIndex(0);
  }, [attachmentPreviews.length]);

  useEffect(() => {
    setAuthorBioExpanded(false);
    setInlinePlaying(false);
  }, [item.id]);

  const activeAttachment = attachmentPreviews[activeAttachmentIndex];
  const durationLabel =
    typeof item.video_duration_seconds === 'number'
      ? formatDuration(item.video_duration_seconds)
      : null;

  // YouTube-style presentation (thumbnail-first card, inline play, tap-to-
  // full-screen) applies to any item carrying video content - everything
  // else (text posts, testimonies, image-only posts, market/lesson cards)
  // keeps the existing social-card layout below, unchanged.
  const hasVideo =
    attachmentPreviews.some(preview => preview.isVideo) ||
    typeof item.video_duration_seconds === 'number';
  const isMultiAttachment = attachmentPreviews.length > 1;

  const canSubscribe = Boolean(item.source?.allow_subscribe);
  const isSubscribed = Boolean(item.source?.is_subscribed);

  const onPressPrimary = onVideoPress
    ? () => onVideoPress()
    : onOpenMarket ?? onOpenSource;
  const authorAvatarUri = resolveBackendAssetUrl(
    item.author?.avatar_url ??
      (item as any)?.author?.avatarUrl ??
      (item as any)?.author?.avatar ??
      (item as any)?.profile?.avatar_url ??
      (item as any)?.profile?.avatarUrl ??
      (item as any)?.profile?.avatar ??
      null,
  );

  // ───── Header (avatar + source + time + menu) — shared by both the
  // YouTube-style video card and the original social-card layout below. ─────
  const headerBlock = (
      <View style={styles.headerRow}>
        <Image
          source={authorAvatarUri ? { uri: authorAvatarUri } : fallbackAvatar}
          style={[
            styles.avatar,
            {
              backgroundColor: palette.bar,
              width: compact ? 36 : 44,
              height: compact ? 36 : 44,
              borderRadius: compact ? 14 : 16,
              shadowColor: palette.goldDeep ?? '#000',
            },
          ]}
        />

        <View style={{ flex: 1 }}>
          <View style={styles.headerTopLine}>
            {isUserSource ? (
              <Pressable
                disabled={!onOpenAuthorProfile}
                onPress={onOpenAuthorProfile}
                style={styles.authorTapTarget}
              >
                <KISText
                  autoLinkHandles={false}
                  style={[styles.headerName, { color: palette.text, fontSize: compact ? 13 : 15 }]}
                  numberOfLines={1}
                >
                  {headerName}
                </KISText>
              </Pressable>
            ) : (
              <KISText
                autoLinkHandles={false}
                style={[styles.headerName, { color: palette.text, fontSize: compact ? 13 : 15 }]}
                numberOfLines={1}
              >
                {headerName}
              </KISText>
            )}

            {item.source?.verified ? (
              <View
                style={[
                  styles.verifiedDot,
                  { backgroundColor: palette.primaryStrong },
                ]}
              >
                <KISIcon name="check" size={12} color={palette.onPrimary} />
              </View>
            ) : null}
          </View>

          <Text
            style={[styles.headerMeta, { color: palette.subtext }]}
            numberOfLines={1}
          >
            {metaSource ? `${metaSource}${when ? ' • ' : ''}` : ''}
            {when}
          </Text>
          {isUserSource && truncatedAuthorBio.text ? (
            <View style={styles.authorBioRow}>
              <KISText
                style={[styles.authorBioText, { color: palette.subtext }]}
                numberOfLines={authorBioExpanded ? undefined : 2}
              >
                {authorBioExpanded ? authorBio : truncatedAuthorBio.text}
              </KISText>
              {!authorBioExpanded && truncatedAuthorBio.truncated ? (
                <Pressable onPress={() => setAuthorBioExpanded(true)}>
                  <Text
                    style={[
                      styles.authorBioMore,
                      { color: palette.primaryStrong },
                    ]}
                  >
                    more
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={onMenuPress}
          disabled={!onMenuPress}
          style={[
            styles.menuBtn,
            { backgroundColor: palette.surface, borderColor: palette.divider },
          ]}
          hitSlop={10}
        >
          <KISIcon name="menu" size={18} color={palette.subtext} />
        </Pressable>
      </View>
  );

  const titleBlock = showTitle ? (
    <KISText
      style={[styles.title, { color: palette.text, fontSize: compact ? 15 : 18 }]}
      numberOfLines={2}
    >
      {item.title}
    </KISText>
  ) : null;

  // ───── Engagement row (icons + counts) — shared by both layouts. ─────
  const engagementBlock = (
    <View style={[styles.engagementRow, { borderTopColor: withAlpha(palette.divider, 0.5) }, compact && { flexWrap: 'wrap', rowGap: 8 }]}>
      {onSave ? (
        <Pressable onPress={onSave} style={styles.engItem} hitSlop={10}>
          <KISIcon
            name="bookmark"
            size={18}
            color={item.viewer_saved ? palette.primaryStrong : palette.subtext}
          />
          <Text
            style={[
              styles.engText,
              { color: item.viewer_saved ? palette.primaryStrong : palette.subtext },
            ]}
          >
            Save
          </Text>
        </Pressable>
      ) : null}

      <Pressable onPress={onLike} style={styles.engItem} hitSlop={10}>
        <KISIcon
          name="heart"
          size={18}
          color={item.viewer_reaction ? palette.primaryStrong : palette.subtext}
        />
        <Text
          style={[
            styles.engText,
            { color: item.viewer_reaction ? palette.primaryStrong : palette.subtext },
          ]}
        >
          {item.reaction_count ?? 0}
        </Text>
      </Pressable>

      {onToggleComments ? (
        <Pressable
          onPress={onToggleComments}
          disabled={commentsLoading}
          style={styles.engItem}
          hitSlop={10}
        >
          {commentsLoading ? (
            <ActivityIndicator size="small" color={palette.subtext} />
          ) : (
            <KISIcon
              name="comment"
              size={18}
              color={showComments ? palette.primaryStrong : palette.subtext}
            />
          )}
          <Text style={[styles.engText, { color: showComments ? palette.primaryStrong : palette.subtext }]}>
            {item.comment_count ?? 0}
          </Text>
        </Pressable>
      ) : null}

      <Pressable onPress={onShare} style={styles.engItem} hitSlop={10}>
        <KISIcon name="share" size={18} color={palette.subtext} />
        <Text style={[styles.engText, { color: palette.subtext }]}>
          {item.share_count ?? 0}
        </Text>
      </Pressable>
    </View>
  );

  const ctaRowBlock = (
    <View style={[styles.ctaRow, compact && { flexWrap: 'wrap' }]}>
      {canSubscribe ? (
        <Pressable
          onPress={onSubscribe ?? onOpenSource}
          style={[
            styles.subscribeBtn,
            isSubscribed
              ? { backgroundColor: palette.surface, borderColor: palette.danger }
              : styles.subscribeBtnGoldShadow,
          ]}
        >
          {!isSubscribed ? (
            <LinearGradient
              colors={gradients.tabSelected as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFillObject, styles.subscribeBtnFill]}
            />
          ) : null}
          <Text
            style={{
              color: isSubscribed ? palette.danger : '#1a1400',
              fontWeight: '900',
            }}
          >
            {isSubscribed ? 'Unsubscribe' : 'Subscribe'}
          </Text>
        </Pressable>
      ) : null}

      {item.is_lesson && onJoinLesson ? (
        <Pressable
          onPress={onJoinLesson}
          style={[styles.primaryPill, { backgroundColor: palette.primaryStrong }]}
        >
          <Text style={{ color: palette.onPrimary, fontWeight: '900' }}>Enroll</Text>
        </Pressable>
      ) : null}

      {item.product && onOpenMarket ? (
        <Pressable
          onPress={onOpenMarket}
          style={[styles.primaryPill, { backgroundColor: palette.primaryStrong }]}
        >
          <Text style={{ color: palette.onPrimary, fontWeight: '900' }}>Shop</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const commentBlock = showComments ? (
    <CommentThreadPanel
      postId={item.id}
      initialConversationId={commentConversationId}
      fetchConversationId={fetchConversationId}
      onConversationResolved={onConversationResolved}
      onMessageCountChange={onMessageCountChange}
      contextLabel={contextLabel}
      useScrollView
    />
  ) : null;

  // ───── YouTube-style layout: video-forward items only (see hasVideo). ─────
  if (hasVideo) {
    const ytPadStyle = { paddingHorizontal: compact ? 11 : 16 };
    return (
      <View style={[styles.fullBleedCard, { backgroundColor: palette.card }]}>
        <View style={[styles.ytPad, ytPadStyle, { paddingTop: compact ? 11 : 16 }]}>
          {headerBlock}
          {titleBlock}
        </View>

        {!isMultiAttachment && activeAttachment ? (
          <View
            style={[
              styles.slideshowWrap,
              styles.slideshowWrapBleed,
              { backgroundColor: palette.surface, aspectRatio: compact ? 4 / 3 : 16 / 9 },
            ]}
          >
            {inlinePlaying && activeAttachment.isVideo && activeAttachment.raw ? (
              <BroadcastFeedVideoPreview
                attachment={activeAttachment.raw}
                palette={palette}
                containerStyle={styles.slideshowImage}
                posterOverride={activeAttachment.previewUri ?? undefined}
                autoPlay
              />
            ) : (
              <Pressable
                onPress={() => onVideoPress?.(activeAttachmentIndex)}
                style={styles.slideshowPressable}
              >
                {activeAttachment.previewUri || activeAttachment.url ? (
                  <Image
                    source={{ uri: activeAttachment.previewUri ?? activeAttachment.url! }}
                    style={styles.slideshowImage}
                  />
                ) : (
                  <View style={[styles.slideshowImage, { backgroundColor: palette.bar }]} />
                )}
              </Pressable>
            )}

            {/* Bottom scrim - lifts the LIVE/duration badges and play
                button off the raw thumbnail with a produced, cinematic
                feel instead of flat overlays on bare pixels. Only over the
                still poster, never over an actively playing video. */}
            {!inlinePlaying ? (
              <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
                style={styles.thumbScrim}
                pointerEvents="none"
              />
            ) : null}

            {Boolean(item.is_live) ? (
              <View style={[styles.liveBadge, { backgroundColor: palette.danger }]}>
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            ) : null}

            {durationLabel && !inlinePlaying ? (
              <View style={[styles.durationPill, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>
                  {durationLabel}
                </Text>
              </View>
            ) : null}

            {/* Play button — the ONLY thing on a video-forward card that
                plays inline instead of opening the full-screen viewer. */}
            {!inlinePlaying && activeAttachment.isVideo ? (
              <Pressable
                onPress={() => setInlinePlaying(true)}
                style={styles.ytPlayOverlay}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Play"
              >
                <View style={styles.ytPlayCircle}>
                  <LinearGradient
                    colors={gradients.tabSelected as unknown as string[]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <KISIcon name="play" size={24} color="#1a1400" />
                </View>
              </Pressable>
            ) : null}

            {typeof watchProgress === 'number' && watchProgress > 0 ? (
              <View style={styles.watchProgressTrack} pointerEvents="none">
                <View
                  style={[
                    styles.watchProgressBar,
                    { width: `${Math.min(100, watchProgress * 100)}%`, backgroundColor: palette.primaryStrong },
                  ]}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Multi-item post: the other uploaded attachments shown as a
            horizontal strip within this card, mirroring a YouTube "shelf"
            row - tapping one opens the full-screen viewer seeded to that
            attachment, same as tapping the single big thumbnail above. */}
        {isMultiAttachment ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.ytStripContent, ytPadStyle]}
          >
            {attachmentPreviews.map((preview, idx) => (
              <Pressable
                key={`${item.id}-att-${idx}`}
                onPress={() => {
                  setActiveAttachmentIndex(idx);
                  onVideoPress?.(idx);
                }}
                style={[styles.ytChip, { borderColor: palette.divider }]}
              >
                {preview.previewUri || preview.url ? (
                  <Image
                    source={{ uri: preview.previewUri ?? preview.url! }}
                    style={styles.ytChipImage}
                  />
                ) : (
                  <View style={[styles.ytChipImage, { backgroundColor: palette.bar }]} />
                )}
                {preview.isVideo ? (
                  <View style={styles.ytChipPlayDot}>
                    <KISIcon name="play" size={10} color="#fff" />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={[styles.ytPad, ytPadStyle, { paddingBottom: compact ? 11 : 16 }]}>
          {ctaRowBlock}
          {engagementBlock}
          {commentBlock}
        </View>
      </View>
    );
  }

  // ───── Original social-card layout — every non-video item. ─────
  return (
    <View
      style={[
        styles.fullBleedCard,
        { backgroundColor: palette.card, padding: compact ? 11 : 16 },
      ]}
    >
      {headerBlock}

      {/* ───── Title + body (mockup-style) ───── */}
      {showTitle ? (
        <KISText
          style={[styles.title, { color: palette.text, fontSize: compact ? 15 : 18 }]}
          numberOfLines={2}
        >
          {item.title}
        </KISText>
      ) : null}

      {richTextValue ? (
        <View style={{ marginTop: 4 }}>
          <RichTextRenderer
            value={richTextValue}
            fallback={excerpt}
            style={{
              maxHeight: excerptExpanded ? undefined : 76,
              overflow: 'hidden',
            }}
          />
          {!excerptExpanded ? (
            <Pressable
              onPress={() => setExcerptExpanded(true)}
              style={{ marginTop: 2 }}
            >
              <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>
                Read more
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : showExcerpt ? (
        <View style={{ marginTop: 4 }}>
          <KISText
            style={[styles.bodyText, { color: palette.subtext, fontSize: responsive.bodyFontSize }]}
            numberOfLines={excerptExpanded ? undefined : 3}
          >
            {excerpt}
          </KISText>
          {!excerptExpanded ? (
            <Pressable
              onPress={() => setExcerptExpanded(true)}
              style={{ marginTop: 2 }}
            >
              <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>
                Read more
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : item.text_doc || item.text ? (
        <View style={{ marginTop: 2 }}>
          <RichTextRenderer
            value={item.text_doc ?? item.text}
            style={{
              color: palette.subtext,
              fontSize: 14,
              lineHeight: 21,
            }}
          />
        </View>
      ) : null}

      {/* ───── Media slideshow (full-width slide per attachment) ───── */}
      {activeAttachment ? (
        <View
          style={[
            styles.slideshowWrap,
            { borderColor: palette.divider, backgroundColor: palette.surface, aspectRatio: compact ? 4 / 3 : 16 / 9 },
          ]}
        >
          {activeAttachment.isVideo && activeAttachment.raw ? (
            <BroadcastFeedVideoPreview
              attachment={activeAttachment.raw}
              palette={palette}
              containerStyle={styles.slideshowImage}
              posterOverride={activeAttachment.previewUri ?? undefined}
            />
          ) : (
            <Pressable onPress={onPressPrimary} style={styles.slideshowPressable}>
              {activeAttachment.previewUri || activeAttachment.url ? (
                <Image
                  source={{
                    uri: activeAttachment.previewUri ?? activeAttachment.url!,
                  }}
                  style={styles.slideshowImage}
                />
              ) : (
                <View
                  style={[
                    styles.slideshowImage,
                    { backgroundColor: palette.bar },
                  ]}
                />
              )}
            </Pressable>
          )}

          {Boolean(item.is_live) ? (
            <View
              style={[styles.liveBadge, { backgroundColor: palette.danger }]}
            >
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          ) : null}

          {durationLabel ? (
            <View
              style={[
                styles.durationPill,
                { backgroundColor: 'rgba(0,0,0,0.6)' },
              ]}
            >
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>
                {durationLabel}
              </Text>
            </View>
          ) : null}

          {activeAttachment?.isVideo && !activeAttachment.raw ? (
            // Only shown in the (rare) fallback case where we couldn't
            // resolve a raw attachment record to play inline — otherwise
            // BroadcastFeedVideoPreview above already renders its own
            // poster + tap-to-play affordance, and this pill would just
            // sit on top of a real player showing native controls.
            <View style={styles.playOverlay} pointerEvents="none">
              <View style={styles.playPill}>
                <KISIcon name="play" size={18} color="#fff" />
                <Text style={styles.playText}>Play video</Text>
              </View>
            </View>
          ) : null}

          {attachmentPreviews.length > 1 ? (
            <>
              <Pressable
                style={[styles.navButton, styles.navLeft]}
                onPress={handlePrevAttachment}
              >
                <Text
                  style={[
                    styles.navButtonText,
                    { color: palette.primaryStrong },
                  ]}
                >
                  {'‹'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.navButton, styles.navRight]}
                onPress={handleNextAttachment}
              >
                <Text
                  style={[
                    styles.navButtonText,
                    { color: palette.primaryStrong },
                  ]}
                >
                  {'›'}
                </Text>
              </Pressable>
              <View style={styles.dotRow}>
                {attachmentPreviews.map((_, dotIndex) => (
                  <View
                    key={`dot-${dotIndex}`}
                    style={[
                      styles.dot,
                      dotIndex === activeAttachmentIndex
                        ? styles.dotActive
                        : null,
                      {
                        backgroundColor:
                          dotIndex === activeAttachmentIndex
                            ? palette.primaryStrong
                            : palette.surface,
                      },
                    ]}
                  />
                ))}
              </View>
            </>
          ) : null}

          {typeof watchProgress === 'number' && watchProgress > 0 ? (
            <View style={styles.watchProgressTrack} pointerEvents="none">
              <View
                style={[
                  styles.watchProgressBar,
                  { width: `${Math.min(100, watchProgress * 100)}%`, backgroundColor: palette.primaryStrong },
                ]}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ───── Subscribe row (like mockup buttons under media) ───── */}
      <View style={[styles.ctaRow, compact && { flexWrap: 'wrap' }]}>
        {canSubscribe ? (
          <Pressable
            onPress={onSubscribe ?? onOpenSource}
            style={[
              styles.subscribeBtn,
              isSubscribed
                ? { backgroundColor: palette.surface, borderColor: palette.danger }
                : styles.subscribeBtnGoldShadow,
            ]}
          >
            {!isSubscribed ? (
              <LinearGradient
                colors={gradients.tabSelected as unknown as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFillObject, styles.subscribeBtnFill]}
              />
            ) : null}
            <Text
              style={{
                color: isSubscribed ? palette.danger : '#1a1400',
                fontWeight: '900',
              }}
            >
              {isSubscribed ? 'Unsubscribe' : 'Subscribe'}
            </Text>
          </Pressable>
        ) : null}

        {item.is_lesson && onJoinLesson ? (
          <Pressable
            onPress={onJoinLesson}
            style={[
              styles.primaryPill,
              { backgroundColor: palette.primaryStrong },
            ]}
          >
            <Text style={{ color: palette.onPrimary, fontWeight: '900' }}>Enroll</Text>
          </Pressable>
        ) : null}

        {item.product && onOpenMarket ? (
          <Pressable
            onPress={onOpenMarket}
            style={[
              styles.primaryPill,
              { backgroundColor: palette.primaryStrong },
            ]}
          >
            <Text style={{ color: palette.onPrimary, fontWeight: '900' }}>Shop</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ───── Engagement row (icons + counts like mockup bottom bar) ───── */}
      <View style={[styles.engagementRow, { borderTopColor: withAlpha(palette.divider, 0.5) }, compact && { flexWrap: 'wrap', rowGap: 8 }]}>
        {onSave ? (
          <Pressable onPress={onSave} style={styles.engItem} hitSlop={10}>
            <KISIcon
              name="bookmark"
              size={18}
              color={
                item.viewer_saved ? palette.primaryStrong : palette.subtext
              }
            />
            <Text
              style={[
                styles.engText,
                {
                  color: item.viewer_saved
                    ? palette.primaryStrong
                    : palette.subtext,
                },
              ]}
            >
              Save
            </Text>
          </Pressable>
        ) : null}

        <Pressable onPress={onLike} style={styles.engItem} hitSlop={10}>
          <KISIcon
            name="heart"
            size={18}
            color={
              item.viewer_reaction ? palette.primaryStrong : palette.subtext
            }
          />
          <Text
            style={[
              styles.engText,
              {
                color: item.viewer_reaction
                  ? palette.primaryStrong
                  : palette.subtext,
              },
            ]}
          >
            {item.reaction_count ?? 0}
          </Text>
        </Pressable>

        {onToggleComments ? (
          <Pressable
            onPress={onToggleComments}
            disabled={commentsLoading}
            style={styles.engItem}
            hitSlop={10}
          >
            {commentsLoading ? (
              <ActivityIndicator size="small" color={palette.subtext} />
            ) : (
              <KISIcon
                name="comment"
                size={18}
                color={showComments ? palette.primaryStrong : palette.subtext}
              />
            )}
            <Text style={[styles.engText, { color: showComments ? palette.primaryStrong : palette.subtext }]}>
              {item.comment_count ?? 0}
            </Text>
          </Pressable>
        ) : null}

        <Pressable onPress={onShare} style={styles.engItem} hitSlop={10}>
          <KISIcon name="share" size={18} color={palette.subtext} />
          <Text style={[styles.engText, { color: palette.subtext }]}>
            {item.share_count ?? 0}
          </Text>
        </Pressable>
      </View>

      {/* ───── Comment thread (expands below engagement row) ───── */}
      {showComments ? (
        <CommentThreadPanel
          postId={item.id}
          initialConversationId={commentConversationId}
          fetchConversationId={fetchConversationId}
          onConversationResolved={onConversationResolved}
          onMessageCountChange={onMessageCountChange}
          contextLabel={contextLabel}
          useScrollView
        />
      ) : null}
    </View>
  );
}

const makeStyles = (_tokens: any) =>
  StyleSheet.create({
    // No border/radius/shadow and no horizontal margin from the parent
    // list (see FeedsMainListSection's card-list wrapper) - the default
    // Feeds view is edge-to-edge, matching the YouTube-style reference,
    // not a boxed/bordered card.
    fullBleedCard: {
      gap: 10,
    },

    // Horizontal-only padding wrapper used to keep header/title/footer
    // text readable while the thumbnail itself (slideshowWrapBleed) stays
    // truly flush with the screen edges.
    ytPad: {
      gap: 10,
    },

    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    avatar: {
      width: 44,
      height: 44,
      borderRadius: 16,
      shadowOpacity: 0.28,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },

    headerTopLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    authorTapTarget: {
      maxWidth: '92%',
      alignSelf: 'flex-start',
    },

    headerName: {
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: -0.2,
      maxWidth: '92%',
    },

    verifiedDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },

    headerMeta: {
      fontSize: 12,
      fontWeight: '700',
      marginTop: 2,
    },

    authorBioRow: {
      marginTop: 4,
    },

    authorBioText: {
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
    },

    authorBioMore: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '800',
    },

    menuBtn: {
      borderWidth: 2,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },

    title: {
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: -0.3,
      lineHeight: 23,
      marginTop: 4,
    },

    bodyText: {
      fontSize: 14,
      lineHeight: 21,
      fontWeight: '600',
    },

    slideshowWrap: {
      borderRadius: 18,
      overflow: 'hidden',
      position: 'relative',
      width: '100%',
      aspectRatio: 16 / 9,
      borderWidth: 2,
    },

    // Overrides slideshowWrap's border/radius for the YouTube-style card's
    // main thumbnail, which sits flush with the screen edges.
    slideshowWrapBleed: {
      borderRadius: 0,
      borderWidth: 0,
    },

    slideshowPressable: {
      width: '100%',
      height: '100%',
    },

    slideshowImage: {
      width: '100%',
      height: '100%',
    },

    navButton: {
      position: 'absolute',
      top: '50%',
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 2,
      borderColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -19,
      backgroundColor: 'rgba(0,0,0,0.35)',
      zIndex: 3,
    },

    navLeft: {
      left: 12,
    },

    navRight: {
      right: 12,
    },

    navButtonText: {
      fontSize: 20,
      fontWeight: '900',
    },

    dotRow: {
      position: 'absolute',
      bottom: 10,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
    },

    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: '#fff',
    },

    dotActive: {
      borderColor: '#fff',
    },

    liveBadge: {
      position: 'absolute',
      bottom: 10,
      left: 10,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },

    liveText: {
      color: '#fff',
      fontWeight: '900',
      fontSize: 11,
      letterSpacing: 0.4,
    },

    durationPill: {
      position: 'absolute',
      bottom: 10,
      right: 10,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },

    playOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },

    playPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(0,0,0,0.58)',
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },

    playText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '900',
    },

    // ───── YouTube-style video-forward card additions ─────
    ytPlayOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },

    ytPlayCircle: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },

    thumbScrim: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '55%',
    },

    ytStripContent: {
      gap: 8,
      paddingVertical: 2,
    },

    ytChip: {
      width: 128,
      aspectRatio: 16 / 9,
      borderRadius: 12,
      borderWidth: 1,
      overflow: 'hidden',
      position: 'relative',
    },

    ytChipImage: {
      width: '100%',
      height: '100%',
    },

    ytChipPlayDot: {
      position: 'absolute',
      bottom: 6,
      right: 6,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
    },

    ctaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
      marginTop: 2,
    },

    subscribeBtn: {
      borderWidth: 2,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Not-yet-subscribed state: filled gold gradient instead of a flat
    // tinted outline, with a matching soft shadow since the gradient
    // itself is rendered as an absolute-fill child (overflow: hidden
    // clips it to the pill).
    subscribeBtnGoldShadow: {
      borderWidth: 0,
      overflow: 'hidden',
      shadowColor: '#9A6A14',
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 4,
    },

    subscribeBtnFill: {
      borderRadius: 999,
    },

    primaryPill: {
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },

    engagementRow: {
      marginTop: 4,
      paddingTop: 10,
      borderTopWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },

    engItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    engText: {
      fontSize: 13,
      fontWeight: '900',
    },

    iconOnlyBtn: {
      paddingHorizontal: 6,
      paddingVertical: 6,
      borderRadius: 12,
    },

    watchProgressTrack: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 3,
      backgroundColor: 'rgba(255,255,255,0.25)',
    },

    watchProgressBar: {
      height: 3,
    },
  });
