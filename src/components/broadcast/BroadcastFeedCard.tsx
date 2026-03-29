import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import KISText from '@/components/common/KISText';
import { resolveBackendAssetUrl } from '@/network';
import RichTextRenderer from '@/components/feeds/RichTextRenderer';
import { getAttachmentPreviewInfo } from './attachmentPreview';
import {
  extractBroadcastAuthorBio,
  formatKisHandle,
  isUserBroadcastSource,
  truncateWords,
} from '@/components/broadcast/authorProfileUtils';

type BroadcastSourceMeta = {
  type: 'community' | 'partner' | 'channel' | 'market' | 'lesson' | 'live' | string;
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
  tier?: 'free' | 'pro' | 'business' | 'education';
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
  onVideoPress?: () => void;
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
  onSubscribe?: () => void | Promise<void | boolean>;
};

const fallbackAvatar = require('@/assets/logo-light.png');

const formatDuration = (seconds: number) => {
  const safe = Number.isFinite(Number(seconds)) ? Math.max(0, Math.floor(Number(seconds))) : 0;
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
  const raw =
    item.text_plain ??
    item.styled_text?.text ??
    (typeof item.text === 'string' ? item.text : '') ??
    '';
  return String(raw).replace(/\s+/g, ' ').trim();
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
  onSubscribe,
}: Props) {
  const { palette, tokens } = useKISTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const [excerptExpanded, setExcerptExpanded] = useState(false);
  const [authorBioExpanded, setAuthorBioExpanded] = useState(false);

  const when = safeTimeLabel(item.broadcasted_at ?? item.created_at);
  const sourceName =
    item.source?.name ||
    (item.source?.type ? item.source.type.charAt(0).toUpperCase() + item.source.type.slice(1) : '') ||
    '';
  const isUserSource = isUserBroadcastSource(item);
  const authorDisplayName = String(item.author?.display_name ?? '').trim();
  const authorName = isUserSource
    ? authorDisplayName || 'KIS user'
    : authorDisplayName || sourceName || 'Broadcast';
  const headerName = isUserSource ? formatKisHandle(authorName) : authorName;
  const authorBio = isUserSource ? extractBroadcastAuthorBio(item) : '';
  const truncatedAuthorBio = useMemo(() => truncateWords(authorBio, 18), [authorBio]);
  const metaSource = isUserSource ? sourceName || 'Broadcast profile' : sourceName;

  const excerpt = getTextExcerpt(item);
  const showTitle = Boolean(item.title && item.title.trim().length);
  const showExcerpt = Boolean(excerpt && excerpt.length);

  const attachmentPreviews = useMemo(() => {
    const attachments = Array.isArray(item.attachments) ? item.attachments : [];
    return attachments
      .map((a) => getAttachmentPreviewInfo(a))
      .filter((info) => Boolean(info.previewUri || info.url));
  }, [item.attachments]);
  const [activeAttachmentIndex, setActiveAttachmentIndex] = useState(0);

  const handlePrevAttachment = useCallback(() => {
    if (attachmentPreviews.length === 0) return;
    setActiveAttachmentIndex((prev) =>
      prev === 0 ? attachmentPreviews.length - 1 : prev - 1,
    );
  }, [attachmentPreviews.length]);

  const handleNextAttachment = useCallback(() => {
    if (attachmentPreviews.length === 0) return;
    setActiveAttachmentIndex((prev) => (prev + 1) % attachmentPreviews.length);
  }, [attachmentPreviews.length]);

  useEffect(() => {
    setActiveAttachmentIndex(0);
  }, [attachmentPreviews.length]);

  useEffect(() => {
    setAuthorBioExpanded(false);
  }, [item.id]);

  const activeAttachment = attachmentPreviews[activeAttachmentIndex];
  const durationLabel =
    typeof item.video_duration_seconds === 'number' ? formatDuration(item.video_duration_seconds) : null;

  const canSubscribe = Boolean(item.source?.allow_subscribe);
  const isSubscribed = Boolean(item.source?.is_subscribed);

  const onPressPrimary = onVideoPress ?? onOpenMarket ?? onOpenSource;
  const authorAvatarUri = resolveBackendAssetUrl(
    item.author?.avatar_url ??
      (item as any)?.author?.avatarUrl ??
      (item as any)?.author?.avatar ??
      (item as any)?.profile?.avatar_url ??
      (item as any)?.profile?.avatarUrl ??
      (item as any)?.profile?.avatar ??
      null,
  );

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.primaryStrong }]}>
      {/* ───── Header (avatar + source + time + menu) ───── */}
      <View style={styles.headerRow}>
        <Image
          source={
            authorAvatarUri
              ? { uri: authorAvatarUri }
              : fallbackAvatar
          }
          style={[styles.avatar, { backgroundColor: palette.bar }]}
        />

        <View style={{ flex: 1 }}>
          <View style={styles.headerTopLine}>
            {isUserSource ? (
              <Pressable
                disabled={!onOpenAuthorProfile}
                onPress={onOpenAuthorProfile}
                style={styles.authorTapTarget}
              >
                <KISText autoLinkHandles={false} style={[styles.headerName, { color: palette.text }]} numberOfLines={1}>
                  {headerName}
                </KISText>
              </Pressable>
            ) : (
              <KISText autoLinkHandles={false} style={[styles.headerName, { color: palette.text }]} numberOfLines={1}>
                {headerName}
              </KISText>
            )}

            {item.source?.verified ? (
              <View style={[styles.verifiedDot, { backgroundColor: palette.primaryStrong }]}>
                <KISIcon name="check" size={12} color="#fff" />
              </View>
            ) : null}
          </View>

          <Text style={[styles.headerMeta, { color: palette.subtext }]} numberOfLines={1}>
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
                  <Text style={[styles.authorBioMore, { color: palette.primaryStrong }]}>more</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={onMenuPress}
          style={[styles.menuBtn, { backgroundColor: palette.surface, borderColor: palette.divider }]}
          hitSlop={10}
        >
          <KISIcon name="menu" size={18} color={palette.subtext} />
        </Pressable>
      </View>

      {/* ───── Title + body (mockup-style) ───── */}
      {showTitle ? (
        <KISText style={[styles.title, { color: palette.text }]} numberOfLines={2}>
          {item.title}
        </KISText>
      ) : null}

      {showExcerpt ? (
        <View style={{ marginTop: 4 }}>
          <KISText
            style={[styles.bodyText, { color: palette.subtext }]}
            numberOfLines={excerptExpanded ? undefined : 3}
          >
            {excerpt}
          </KISText>
          {!excerptExpanded ? (
            <Pressable onPress={() => setExcerptExpanded(true)} style={{ marginTop: 2 }}>
              <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>Read more</Text>
            </Pressable>
          ) : null}
        </View>
      ) : item.text_doc || item.text ? (
        <View style={{ marginTop: 2 }}>
          <RichTextRenderer
            value={item.text ?? item.text_doc}
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
            { borderColor: palette.divider, backgroundColor: palette.surface },
          ]}
        >
          <Pressable onPress={onPressPrimary} style={styles.slideshowPressable}>
            {activeAttachment.previewUri || activeAttachment.url ? (
              <Image
                source={{ uri: activeAttachment.previewUri ?? activeAttachment.url! }}
                style={styles.slideshowImage}
              />
            ) : (
              <View style={[styles.slideshowImage, { backgroundColor: palette.bar }]} />
            )}
          </Pressable>

          {Boolean(item.is_live) ? (
            <View style={[styles.liveBadge, { backgroundColor: palette.danger }]}>
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          ) : null}

          {durationLabel ? (
            <View style={[styles.durationPill, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{durationLabel}</Text>
            </View>
          ) : null}

          {attachmentPreviews.length > 1 ? (
            <>
              <Pressable style={[styles.navButton, styles.navLeft]} onPress={handlePrevAttachment}>
                <Text style={[styles.navButtonText, { color: palette.primaryStrong }]}>{'‹'}</Text>
              </Pressable>
              <Pressable style={[styles.navButton, styles.navRight]} onPress={handleNextAttachment}>
                <Text style={[styles.navButtonText, { color: palette.primaryStrong }]}>{'›'}</Text>
              </Pressable>
              <View style={styles.dotRow}>
                {attachmentPreviews.map((_, dotIndex) => (
                  <View
                    key={`dot-${dotIndex}`}
                    style={[
                      styles.dot,
                      dotIndex === activeAttachmentIndex ? styles.dotActive : null,
                      {
                        backgroundColor:
                          dotIndex === activeAttachmentIndex ? palette.primaryStrong : palette.surface,
                      },
                    ]}
                  />
                ))}
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      {/* ───── Subscribe row (like mockup buttons under media) ───── */}
      <View style={styles.ctaRow}>
        {canSubscribe ? (
        <Pressable
          onPress={onSubscribe ?? onOpenSource}
          style={[
            styles.subscribeBtn,
            {
              backgroundColor: isSubscribed ? palette.surface : palette.primarySoft,
              borderColor: isSubscribed ? palette.divider : palette.primary,
            },
          ]}
        >
          <Text
            style={{
              color: isSubscribed ? palette.subtext : palette.primaryStrong,
              fontWeight: '900',
            }}
          >
            {isSubscribed ? 'Subscribed' : 'Subscribe'}
          </Text>
        </Pressable>
        ) : null}

        {item.is_lesson && onJoinLesson ? (
          <Pressable
            onPress={onJoinLesson}
            style={[styles.primaryPill, { backgroundColor: palette.primaryStrong }]}
          >
            <Text style={{ color: '#fff', fontWeight: '900' }}>Enroll</Text>
          </Pressable>
        ) : null}

        {item.product && onOpenMarket ? (
          <Pressable onPress={onOpenMarket} style={[styles.primaryPill, { backgroundColor: palette.primaryStrong }]}>
            <Text style={{ color: '#fff', fontWeight: '900' }}>Shop</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ───── Engagement row (icons + counts like mockup bottom bar) ───── */}
      <View style={[styles.engagementRow, { borderTopColor: palette.divider }]}>
        <View style={styles.engItem}>
          <KISIcon name="heart" size={18} color={palette.primaryStrong} />
          <Text style={[styles.engText, { color: palette.subtext }]}>
            {item.reaction_count ?? 0}
          </Text>
        </View>

        <View style={styles.engItem}>
          <KISIcon name="comment" size={18} color={palette.subtext} />
          <Text style={[styles.engText, { color: palette.subtext }]}>
            {item.comment_count ?? 0}
          </Text>
        </View>

        <Pressable onPress={onShare} style={styles.engItem}>
          <KISIcon name="share" size={18} color={palette.subtext} />
          <Text style={[styles.engText, { color: palette.subtext }]}>
            {item.share_count ?? 0}
          </Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        {onSave ? (
          <Pressable onPress={onSave} style={styles.iconOnlyBtn} hitSlop={10}>
            <KISIcon name="bookmark" size={18} color={palette.subtext} />
          </Pressable>
        ) : null}

        <Pressable onPress={onLike} style={styles.iconOnlyBtn} hitSlop={10}>
          <KISIcon name="heart" size={18} color={palette.primaryStrong} />
        </Pressable>

        {onToggleComments ? (
          <Pressable onPress={onToggleComments} style={styles.iconOnlyBtn} hitSlop={10}>
            <KISIcon name="comment" size={18} color={palette.subtext} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (_tokens: any) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderRadius: 26,
      padding: 16,
      gap: 10,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
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
      letterSpacing: -0.2,
      marginTop: 2,
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
  });
