import React, { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { resolveBackendAssetUrl } from '@/network';
import type { BroadcastItem } from '@/types/broadcast';

const pickAttachmentUrl = (attachment: any): string | undefined => {
  if (!attachment) return undefined;
  if (typeof attachment === 'string') return attachment;
  return (
    attachment.fileUrl ??
    attachment.url ??
    attachment.uri ??
    attachment.file_url ??
    attachment.path ??
    attachment.previewUrl ??
    attachment.preview_url
  );
};

const formatDate = (value: string | undefined) => {
  if (!value) return 'Moments ago';
  try {
    const diff = Math.max(new Date().getTime() - new Date(value).getTime(), 0);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return 'Moments ago';
  }
};

type Props = {
  item: BroadcastItem;
  onPress: () => void;
  onReact: () => void;
};

export default function FeedItemCard({ item, onPress, onReact }: Props) {
  const { palette } = useKISTheme();

  const normalizedAttachments = (item.attachments ?? [])
    .filter(Boolean)
    .map((att) => ({
      url: resolveBackendAssetUrl(pickAttachmentUrl(att)),
      label: att?.name ?? att?.title ?? att?.caption ?? undefined,
    }));

  const attachments = normalizedAttachments.filter((att) => att.url);
  const [activeAttachmentIndex, setActiveAttachmentIndex] = useState(0);

  useEffect(() => {
    setActiveAttachmentIndex(0);
  }, [attachments.length]);

  const handlePrevAttachment = () => {
    setActiveAttachmentIndex((prev) =>
      prev === 0 ? attachments.length - 1 : prev - 1,
    );
  };

  const handleNextAttachment = () => {
    setActiveAttachmentIndex((prev) => (prev + 1) % attachments.length);
  };

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}
      accessibilityRole="button"
      accessibilityLabel="Open broadcast detail"
    >
      <View style={styles.meta}>
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
          {item.title ?? 'Community update'}
        </Text>
        <View style={styles.row}>
          <Text style={[styles.time, { color: palette.subtext }]}>{formatDate(item.broadcastedAt)}</Text>
          <View style={[styles.badge, { backgroundColor: palette.primarySoft, borderColor: palette.primary }]}>
            <Text style={[styles.badgeText, { color: palette.primaryStrong }]}>Feed</Text>
          </View>
        </View>
      </View>

      {item.body ? (
        <Text style={[styles.body, { color: palette.text }]} numberOfLines={3}>
          {item.body}
        </Text>
      ) : null}

      {attachments.length > 0 ? (
        attachments.length === 1 ? (
          <Image source={{ uri: attachments[0].url! }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.slideshowWrap}>
            <Image
              source={{ uri: attachments[activeAttachmentIndex].url! }}
              style={styles.slideshowImage}
              resizeMode="cover"
            />
            <Pressable style={[styles.navButton, styles.navLeft]} onPress={handlePrevAttachment}>
              <Text style={[styles.navButtonText, { color: palette.primaryStrong }]}>{'‹'}</Text>
            </Pressable>
            <Pressable style={[styles.navButton, styles.navRight]} onPress={handleNextAttachment}>
              <Text style={[styles.navButtonText, { color: palette.primaryStrong }]}>{'›'}</Text>
            </Pressable>
            <View style={styles.dotRow}>
              {attachments.map((_, dotIndex) => (
                <View
                  key={`dot-${dotIndex}`}
                  style={[
                    styles.dot,
                    dotIndex === activeAttachmentIndex ? styles.dotActive : null,
                    { backgroundColor: dotIndex === activeAttachmentIndex ? palette.primaryStrong : palette.surface },
                  ]}
                />
              ))}
            </View>
          </View>
        )
      ) : null}

      <View style={styles.actions}>
        <Pressable onPress={onReact} style={styles.action}>
          <KISIcon name="heart" size={18} color={palette.primary} />
          <Text style={[styles.actionText, { color: palette.primary }]}>
            {item.engagement.reactions ?? 0}
          </Text>
        </Pressable>
        <View style={styles.action}>
          <KISIcon name="comment" size={18} color={palette.subtext} />
          <Text style={[styles.actionText, { color: palette.subtext }]}>
            {item.engagement.comments ?? 0}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderRadius: 20,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  meta: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
  },
  badge: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    backgroundColor: '#111',
  },
  slideshowWrap: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#111',
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
    zIndex: 2,
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
    color: '#fff',
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingTop: 6,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
