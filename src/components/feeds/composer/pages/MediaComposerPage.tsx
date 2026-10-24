// src/components/feeds/composer/pages/MediaComposerPage.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';

import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';

import type { ComposerType, RichComposerState } from '../types';
import { makeAttachment } from '../attachments';

const MAX_IMAGES = 10;
const MAX_FILE_SIZE_MB: Partial<Record<ComposerType, number>> = {
  image: 20,
  video: 500,
  short_video: 200,
  document: 50,
  audio: 100,
};

const validateSize = (type: ComposerType, sizeBytes?: number | null): string | null => {
  const maxMb = MAX_FILE_SIZE_MB[type];
  if (!maxMb || !sizeBytes) return null;
  const mb = sizeBytes / (1024 * 1024);
  if (mb > maxMb) return `File is too large (max ${maxMb}MB, picked ${mb.toFixed(1)}MB).`;
  return null;
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const formatSize = (bytes?: number | null) => {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

export function MediaComposerPage({
  type,
  rich,
  setRich,
  attachments,
  setAttachments,
  videoThumbUri,
  setVideoThumbUri,
}: {
  type: ComposerType; // image | video | short_video | document | audio
  rich: RichComposerState;
  setRich: React.Dispatch<React.SetStateAction<RichComposerState>>;

  attachments: any[];
  setAttachments: React.Dispatch<React.SetStateAction<any[]>>;

  videoThumbUri: string | null;
  setVideoThumbUri: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [fileError, setFileError] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  const isImage = type === 'image';
  const isVideo = type === 'video' || type === 'short_video';
  const isGalleryMode = isImage;

  const pickImages = useCallback(async () => {
    setFileError(null);
    const remaining = MAX_IMAGES - attachments.length;
    if (remaining <= 0) {
      setFileError(`You can add up to ${MAX_IMAGES} images.`);
      return;
    }
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: remaining,
    });
    if (result.didCancel || !result.assets?.length) return;

    const accepted: any[] = [];
    let rejected = 0;
    result.assets.forEach(a => {
      if (!a?.uri) return;
      const sizeError = validateSize('image', a.fileSize);
      if (sizeError) {
        rejected += 1;
        return;
      }
      accepted.push(
        makeAttachment({
          uri: a.uri,
          name: a.fileName ?? 'photo.jpg',
          type: a.type,
          size: a.fileSize,
          kind: 'image',
        }),
      );
    });

    if (rejected) {
      setFileError(
        `${rejected} image${rejected > 1 ? 's' : ''} skipped — over the ${MAX_FILE_SIZE_MB.image}MB limit.`,
      );
    }
    setAttachments(prev => [...prev, ...accepted].slice(0, MAX_IMAGES));
  }, [attachments.length, setAttachments]);

  const removeImage = useCallback(
    (id: string) => {
      setAttachments(prev => prev.filter(a => a.id !== id));
    },
    [setAttachments],
  );

  const moveImage = useCallback(
    (index: number, direction: -1 | 1) => {
      setAttachments(prev => {
        const next = [...prev];
        const target = index + direction;
        if (target < 0 || target >= next.length) return prev;
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });
    },
    [setAttachments],
  );

  const setImageCaption = useCallback(
    (id: string, caption: string) => {
      setAttachments(prev => prev.map(a => (a.id === id ? { ...a, caption } : a)));
    },
    [setAttachments],
  );

  const pickVideo = useCallback(async () => {
    setFileError(null);
    const result = await launchImageLibrary({ mediaType: 'video', selectionLimit: 1 });
    if (result.didCancel || !result.assets?.length) return;
    const a = result.assets[0];
    if (!a?.uri) return;

    const sizeError = validateSize(type, a.fileSize);
    if (sizeError) {
      setFileError(sizeError);
      return;
    }

    // reset thumb when a new video is chosen
    setVideoThumbUri(null);
    setVideoDuration(a.duration ?? null);

    setAttachments([
      makeAttachment({
        uri: a.uri,
        name: a.fileName,
        type: a.type,
        size: a.fileSize,
        kind: 'video',
      }),
    ]);
  }, [setAttachments, setVideoThumbUri, type]);

  const pickDocument = useCallback(
    async (kind: 'document' | 'audio') => {
      setFileError(null);
      try {
        const docTypes = [DocumentPicker.types.pdf, DocumentPicker.types.doc, DocumentPicker.types.docx].filter(Boolean);
        const doc = await DocumentPicker.pickSingle({
          type: kind === 'audio' ? DocumentPicker.types.audio : docTypes,
        });

        const sizeError = validateSize(type, doc.size);
        if (sizeError) {
          setFileError(sizeError);
          return;
        }

        setAttachments([
          makeAttachment({
            uri: doc.uri,
            name: doc.name,
            type: doc.type,
            size: doc.size,
            kind: kind === 'audio' ? 'audio' : 'file',
          }),
        ]);
      } catch {}
    },
    [setAttachments, type],
  );

  const pickVideoThumbnail = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
    if (result.didCancel || !result.assets?.length) return;
    const a = result.assets[0];
    if (a?.uri) setVideoThumbUri(a.uri);
  }, [setVideoThumbUri]);

  const removeSingleAttachment = useCallback(() => {
    setAttachments([]);
    setVideoThumbUri(null);
    setVideoDuration(null);
    setFileError(null);
  }, [setAttachments, setVideoThumbUri]);

  const replaceSingleAttachment = useCallback(() => {
    if (isVideo) pickVideo();
    else if (type === 'audio') pickDocument('audio');
    else pickDocument('document');
  }, [isVideo, pickDocument, pickVideo, type]);

  const pickLabel = useMemo(() => {
    if (isImage) return attachments.length ? 'Add more photos' : 'Pick photos';
    if (isVideo) return 'Pick video';
    if (type === 'audio') return 'Pick audio';
    return 'Pick document';
  }, [attachments.length, isImage, isVideo, type]);

  const pickIcon = useMemo(() => {
    if (isImage) return { name: 'image-outline' as const, bg: '#4F8EF7' };
    if (isVideo) return { name: 'videocam-outline' as const, bg: '#7C5CFA' };
    if (type === 'audio') return { name: 'mic-outline' as const, bg: '#2FBF71' };
    return { name: 'document-text-outline' as const, bg: '#FF9F2E' };
  }, [isImage, isVideo, type]);

  const selected = attachments?.[0] ?? null;
  const selectedUri = selected?.url ?? selected?.uri ?? null;
  const selectedName = selected?.originalName ?? selected?.name ?? 'file';
  const selectedSize = formatSize(selected?.size);

  const border = palette.divider;
  const text = palette.text;
  const subtext = palette.subtext;

  return (
    <View style={[styles.page, { backgroundColor: palette.bg, }]}>
      {/* Main pick button — gallery mode keeps offering "add more" until the cap */}
      {(isGalleryMode && attachments.length < MAX_IMAGES) || (!isGalleryMode && !attachments.length) ? (
        <Pressable
          onPress={() => {
            if (isImage) pickImages();
            else if (isVideo) pickVideo();
            else if (type === 'audio') pickDocument('audio');
            else pickDocument('document');
          }}
          style={[styles.bigButton, { borderColor: border, backgroundColor: palette.card ?? '#FFFFFF' }]}
        >
          <View style={[styles.iconChip, { backgroundColor: pickIcon.bg }]}>
            <Ionicons name={pickIcon.name} size={18} color="#FFFFFF" />
          </View>
          <Text style={[styles.bigButtonText, { color: text }]}>{pickLabel}</Text>
        </Pressable>
      ) : null}

      {fileError ? (
        <Text style={[styles.errorText, { color: palette.danger }]}>{fileError}</Text>
      ) : null}

      {/* Gallery mode — multi-image strip with remove/reorder/caption */}
      {isGalleryMode && attachments.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
          {attachments.map((a, index) => {
            const uri = a.url ?? a.uri;
            return (
              <View key={a.id ?? index} style={[styles.galleryCard, { borderColor: border, backgroundColor: palette.card ?? '#FFFFFF' }]}>
                <View style={styles.galleryImageWrap}>
                  <Image source={{ uri }} style={styles.galleryImage} resizeMode="cover" />
                  <Pressable
                    onPress={() => removeImage(a.id)}
                    style={styles.galleryRemove}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove image ${index + 1}`}
                  >
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
                <View style={styles.galleryReorderRow}>
                  <Pressable
                    onPress={() => moveImage(index, -1)}
                    disabled={index === 0}
                    style={{ opacity: index === 0 ? 0.3 : 1 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Move image ${index + 1} left`}
                  >
                    <Ionicons name="chevron-back" size={16} color={text} />
                  </Pressable>
                  <Text style={{ color: subtext, fontSize: 11, fontWeight: '700' }}>{index + 1}/{attachments.length}</Text>
                  <Pressable
                    onPress={() => moveImage(index, 1)}
                    disabled={index === attachments.length - 1}
                    style={{ opacity: index === attachments.length - 1 ? 0.3 : 1 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Move image ${index + 1} right`}
                  >
                    <Ionicons name="chevron-forward" size={16} color={text} />
                  </Pressable>
                </View>
                <TextInput
                  placeholder="Caption (optional)"
                  placeholderTextColor={subtext}
                  value={a.caption ?? ''}
                  onChangeText={v => setImageCaption(a.id, v)}
                  style={[styles.galleryCaptionInput, { color: text, borderColor: border }]}
                />
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Thumbnail picker button — visible at all times for video, above preview */}
      {isVideo && (
        videoThumbUri ? (
          <View style={[styles.thumbRow, { maxWidth: responsive.contentMaxWidth }]}>
            <View style={[styles.thumbCard, { borderColor: border, backgroundColor: palette.card ?? '#FFFFFF' }]}>
              <Image source={{ uri: videoThumbUri }} style={[styles.thumbImage, { backgroundColor: palette.surface }]} resizeMode="cover" />
              <View style={styles.thumbMeta}>
                <Text style={[styles.thumbTitle, { color: text }]}>Thumbnail</Text>
                <Text style={[styles.thumbSub, { color: subtext }]}>Used as cover image</Text>
              </View>
            </View>
            <Pressable
              onPress={pickVideoThumbnail}
              style={[styles.thumbClear, { borderColor: palette.primary, backgroundColor: palette.card ?? '#FFFFFF' }]}
            >
              <Ionicons name="image-outline" size={18} color={palette.primary} />
            </Pressable>
            <Pressable
              onPress={() => setVideoThumbUri(null)}
              style={[styles.thumbClear, { borderColor: border, backgroundColor: palette.card ?? '#FFFFFF', marginLeft: 6 }]}
            >
              <Ionicons name="close" size={18} color={text} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={pickVideoThumbnail}
            style={[styles.bigButton, { borderColor: palette.primary, backgroundColor: palette.card ?? '#FFFFFF' }]}
          >
            <View style={[styles.iconChip, { backgroundColor: palette.primary }]}>
              <Ionicons name="image-outline" size={18} color={palette.onPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bigButtonText, { color: text, fontSize: 15 }]}>Pick thumbnail image</Text>
              <Text style={{ color: subtext, fontSize: 12, marginTop: 2 }}>Choose a cover photo from your device</Text>
            </View>
          </Pressable>
        )
      )}

      {/* PREVIEW AREA — single-file modes only (video/doc/audio) */}
      {isVideo && selectedUri ? (
        <View style={styles.previewWrap}>
          <View style={[styles.videoFrame, { borderColor: border }]}>
            <Video
              source={{ uri: selectedUri }}
              style={styles.video}
              resizeMode="cover"
              controls
              paused
              poster={videoThumbUri ?? undefined}
              posterResizeMode="cover"
            />
          </View>
          <View style={styles.singleFileActionsRow}>
            {formatDuration(videoDuration) ? (
              <Text style={[styles.helperText, { color: subtext }]}>{formatDuration(videoDuration)}</Text>
            ) : null}
            {selectedSize ? <Text style={[styles.helperText, { color: subtext }]}>{selectedSize}</Text> : null}
            <Pressable onPress={replaceSingleAttachment} accessibilityRole="button" accessibilityLabel="Replace video">
              <Text style={{ color: palette.primaryStrong, fontWeight: '800', fontSize: 12 }}>Replace</Text>
            </Pressable>
            <Pressable onPress={removeSingleAttachment} accessibilityRole="button" accessibilityLabel="Remove video">
              <Text style={{ color: palette.danger, fontWeight: '800', fontSize: 12 }}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* For non-image/video attachments, show selected file name */}
      {!isImage && !isVideo && attachments.length ? (
        <View style={styles.singleFileRow}>
          <Text style={[styles.helperText, { color: subtext }]}>
            {selectedName}{selectedSize ? ` · ${selectedSize}` : ''}
          </Text>
          <View style={styles.singleFileActionsRow}>
            <Pressable onPress={replaceSingleAttachment} accessibilityRole="button" accessibilityLabel="Replace file">
              <Text style={{ color: palette.primaryStrong, fontWeight: '800', fontSize: 12 }}>Replace</Text>
            </Pressable>
            <Pressable onPress={removeSingleAttachment} accessibilityRole="button" accessibilityLabel="Remove file">
              <Text style={{ color: palette.danger, fontWeight: '800', fontSize: 12 }}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Caption input — single caption field for non-gallery modes; gallery mode captions are per-image above */}
      {!isGalleryMode ? (
        <TextInput
          placeholder="Add a caption (optional)"
          placeholderTextColor={subtext}
          value={rich.text}
          onChangeText={(t) => setRich((p) => ({ ...p, text: t }))}
          multiline
          style={[
            styles.captionInput,
            {
              color: text,
              borderColor: border,
              backgroundColor: palette.card ?? '#FFFFFF',
            },
          ]}
        />
      ) : (
        <TextInput
          placeholder="Add an overall caption for this gallery (optional)"
          placeholderTextColor={subtext}
          value={rich.text}
          onChangeText={(t) => setRich((p) => ({ ...p, text: t }))}
          multiline
          style={[
            styles.captionInput,
            {
              color: text,
              borderColor: border,
              backgroundColor: palette.card ?? '#FFFFFF',
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 14,
    paddingVertical: 8,
  },

  bigButton: {
    borderWidth: 2,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,

    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  bigButtonText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorText: {
    fontSize: 12,
    fontWeight: '800',
  },

  galleryRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  galleryCard: {
    width: 140,
    borderWidth: 2,
    borderRadius: 16,
    padding: 8,
    gap: 6,
  },
  galleryImageWrap: { width: '100%', height: 120, borderRadius: 12, overflow: 'hidden' },
  galleryImage: { width: '100%', height: '100%' },
  galleryRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryReorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  galleryCaptionInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 11,
  },

  previewWrap: {
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },

  videoFrame: {
    width: 240,
    height: 240,
    borderRadius: 22,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#000',

    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  video: {
    width: '100%',
    height: '100%',
  },

  helperText: {
    fontSize: 13,
    fontWeight: '600',
  },

  singleFileRow: { gap: 6 },
  singleFileActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  // Thumbnail preview row
  thumbRow: {
    width: '100%',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  thumbCard: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 18,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,

    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  thumbImage: {
    width: 54,
    height: 54,
    borderRadius: 14,
  },
  thumbMeta: {
    flex: 1,
  },
  thumbTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  thumbSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
  },
  thumbClear: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  captionInput: {
    borderWidth: 2,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 72,
    fontSize: 16,
    lineHeight: 22,
  },
});
