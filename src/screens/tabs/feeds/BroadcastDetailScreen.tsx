import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import { resolveBackendAssetUrl } from '@/network';
import { BroadcastItem } from '@/types/broadcast';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

import type { FeedsStackParamList } from './FeedsNavigator';

const REACTION_EVENT = 'broadcast.reaction';

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

export default function BroadcastDetailScreen() {
  const route = useRoute<RouteProp<FeedsStackParamList, 'BroadcastDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<FeedsStackParamList, 'BroadcastDetail'>>();
  const { palette } = useKISTheme();

  const initialItem = route.params?.item ?? null;
  const [broadcastItem, setBroadcastItem] = useState<BroadcastItem | null>(initialItem);
  const [loading] = useState(false);
  const [error, setError] = useState<string | null>(
    initialItem ? null : 'Broadcast details are only available when navigating from the feed list.',
  );
  const broadcastId = broadcastItem?.id ?? route.params?.id;

  const handleReact = useCallback(async () => {
    if (!broadcastItem) return;
    setBroadcastItem((prev) =>
      prev
        ? {
            ...prev,
            engagement: {
              ...prev.engagement,
              reactions: prev.engagement.reactions + 1,
            },
          }
        : prev,
    );
    try {
      const response = await postRequest(
        ROUTES.broadcasts.react(broadcastId ?? ''),
        { type: 'like' },
        { errorMessage: 'Unable to register reaction.' },
      );
      if (!response?.success) {
        throw new Error(response?.message ?? 'Could not react');
      }
      DeviceEventEmitter.emit(REACTION_EVENT, { id: broadcastId, delta: 1 });
    } catch {
      setBroadcastItem((prev) =>
        prev
          ? {
              ...prev,
              engagement: {
                ...prev.engagement,
                reactions: Math.max(prev.engagement.reactions - 1, 0),
              },
            }
          : prev,
      );
    }
  }, [broadcastId, broadcastItem]);

  const attachmentUrls = useMemo(() => {
    const rawAttachments = Array.isArray(broadcastItem?.attachments) ? broadcastItem.attachments : [];
    return rawAttachments
      .map((attachment) => pickAttachmentUrl(attachment))
      .filter(Boolean)
      .map((url) => resolveBackendAssetUrl(url!))
      .filter(Boolean);
  }, [broadcastItem?.attachments]);
  const [activeAttachmentIndex, setActiveAttachmentIndex] = useState(0);

  useEffect(() => {
    setActiveAttachmentIndex(0);
  }, [attachmentUrls.length]);

  const attachmentUrl = attachmentUrls[activeAttachmentIndex] ?? null;
  const showCarousel = attachmentUrls.length > 0;
  const showControls = attachmentUrls.length > 1;
  const handlePrevAttachment = () => {
    setActiveAttachmentIndex((prev) =>
      attachmentUrls.length ? (prev === 0 ? attachmentUrls.length - 1 : prev - 1) : 0,
    );
  };
  const handleNextAttachment = () => {
    setActiveAttachmentIndex((prev) =>
      attachmentUrls.length ? (prev + 1) % attachmentUrls.length : 0,
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.bg }]}>
        <Text style={[styles.error, { color: palette.text }]}>{error}</Text>
        <Pressable
          onPress={() =>
            setError('Broadcast details are only available when navigating from the feed list.')
          }
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!broadcastItem) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.bg }]}>
        <Text style={[styles.error, { color: palette.text }]}>Broadcast not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: palette.bg }]} contentContainerStyle={styles.content}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <KISIcon name="arrow-left" size={24} color={palette.text} />
        <Text style={[styles.backLabel, { color: palette.text }]}>Back</Text>
      </Pressable>
      <Text style={[styles.heading, { color: palette.text }]}>{broadcastItem.title ?? 'Community broadcast'}</Text>
      {showCarousel ? (
        <View style={[styles.slideshowWrap, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
          {attachmentUrl ? (
            <Image source={{ uri: attachmentUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, { backgroundColor: palette.bar }]} />
          )}

          {showControls ? (
            <>
              <Pressable style={[styles.navButton, styles.navLeft]} onPress={handlePrevAttachment}>
                <Text style={[styles.navButtonText, { color: palette.primaryStrong }]}>{'‹'}</Text>
              </Pressable>
              <Pressable style={[styles.navButton, styles.navRight]} onPress={handleNextAttachment}>
                <Text style={[styles.navButtonText, { color: palette.primaryStrong }]}>{'›'}</Text>
              </Pressable>
              <View style={styles.dotRow}>
                {attachmentUrls.map((_, dotIndex) => (
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
      {broadcastItem.body ? (
        <Text style={[styles.body, { color: palette.text }]}>{broadcastItem.body}</Text>
      ) : null}
      <View style={styles.footer}>
        <Pressable onPress={handleReact} style={[styles.reactButton, { borderColor: palette.primary }]}>
          <KISIcon name="heart" size={20} color={palette.primary} />
          <Text style={[styles.reactText, { color: palette.primary }]}>React</Text>
        </Pressable>
        <Text style={[styles.counter, { color: palette.subtext }]}>
          {broadcastItem.engagement.reactions} reaction
          {broadcastItem.engagement.reactions === 1 ? '' : 's'}
        </Text>
        <Text style={[styles.counter, { color: palette.subtext }]}>
          {broadcastItem.engagement.comments} comment
          {broadcastItem.engagement.comments === 1 ? '' : 's'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    backgroundColor: '#000',
  },
  slideshowWrap: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#111',
    borderWidth: 2,
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
  body: {
    fontSize: 16,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reactButton: {
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reactText: {
    fontSize: 14,
    fontWeight: '600',
  },
  counter: {
    fontSize: 13,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#eee',
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
