// src/components/feeds/composer/pages/MediaComposerPage.tsx
import React, { useCallback, useMemo } from 'react';
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

import type { ComposerType, RichComposerState } from '../types';
import { makeAttachment } from '../attachments';

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

  const pickImage = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
    if (result.didCancel || !result.assets?.length) return;
    const a = result.assets[0];
    if (!a?.uri) return;

    setAttachments([
      makeAttachment({
        uri: a.uri,
        name: a.fileName ?? 'photo.jpg',
        type: a.type,
        size: a.fileSize,
        kind: 'image',
      }),
    ]);
  }, [setAttachments]);

  const pickVideo = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'video', selectionLimit: 1 });
    if (result.didCancel || !result.assets?.length) return;
    const a = result.assets[0];
    if (!a?.uri) return;

    // reset thumb when a new video is chosen
    setVideoThumbUri(null);

    setAttachments([
      makeAttachment({
        uri: a.uri,
        name: a.fileName,
        type: a.type,
        size: a.fileSize,
        kind: 'video',
      }),
    ]);
  }, [setAttachments, setVideoThumbUri]);

  const pickDocument = useCallback(
    async (kind: 'document' | 'audio') => {
      try {
        const docTypes = [DocumentPicker.types.pdf, DocumentPicker.types.doc, DocumentPicker.types.docx].filter(Boolean);
        const doc = await DocumentPicker.pickSingle({
          type: kind === 'audio' ? DocumentPicker.types.audio : docTypes,
        });

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
    [setAttachments],
  );

  const pickVideoThumbnail = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
    if (result.didCancel || !result.assets?.length) return;
    const a = result.assets[0];
    if (a?.uri) setVideoThumbUri(a.uri);
  }, [setVideoThumbUri]);

  const pickLabel = useMemo(() => {
    if (type === 'image') return 'Pick image';
    if (type === 'video' || type === 'short_video') return 'Pick video';
    if (type === 'audio') return 'Pick audio';
    return 'Pick document';
  }, [type]);

  const pickIcon = useMemo(() => {
    if (type === 'image') return { name: 'image-outline' as const, bg: '#4F8EF7' };
    if (type === 'video' || type === 'short_video') return { name: 'videocam-outline' as const, bg: '#7C5CFA' };
    if (type === 'audio') return { name: 'mic-outline' as const, bg: '#2FBF71' };
    return { name: 'document-text-outline' as const, bg: '#FF9F2E' };
  }, [type]);

  const selected = attachments?.[0] ?? null;
  const selectedUri = selected?.url ?? selected?.uri ?? null;
  const selectedName = selected?.originalName ?? selected?.name ?? 'file';

  const isImage = type === 'image';
  const isVideo = type === 'video' || type === 'short_video';

  const border = palette.divider;
  const text = palette.text;
  const subtext = palette.subtext;

  return (
    <View style={[styles.page, { backgroundColor: palette.bg ?? '#F2F4F7' }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Main pick button */}
        <Pressable
          onPress={() => {
            if (type === 'image') pickImage();
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

        {/* Thumbnail button (for video/short_video) */}
        {isVideo && (
          <Pressable
            onPress={pickVideoThumbnail}
            style={[styles.bigButton, { borderColor: border, backgroundColor: palette.card ?? '#FFFFFF' }]}
          >
            <View style={[styles.iconChip, { backgroundColor: '#7C5CFA' }]}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
            </View>
            <Text style={[styles.bigButtonText, { color: text }]}>Add video thumbnail</Text>
          </Pressable>
        )}

        {/* PREVIEW AREA */}
        {isImage && selectedUri ? (
          <View style={styles.previewWrap}>
            <Image
              source={{ uri: selectedUri }}
              style={[styles.previewSquare, { borderColor: border }]}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {isVideo && selectedUri ? (
          <View style={styles.previewWrap}>
            {/* Main video preview */}
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

            {/* Thumbnail preview card */}
            {videoThumbUri ? (
              <View style={styles.thumbRow}>
                <View style={[styles.thumbCard, { borderColor: border, backgroundColor: palette.card ?? '#FFFFFF' }]}>
                  <Image source={{ uri: videoThumbUri }} style={styles.thumbImage} resizeMode="cover" />
                  <View style={styles.thumbMeta}>
                    <Text style={[styles.thumbTitle, { color: text }]}>Thumbnail</Text>
                    <Text style={[styles.thumbSub, { color: subtext }]}>Will be used as poster</Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => setVideoThumbUri(null)}
                  style={[styles.thumbClear, { borderColor: border, backgroundColor: palette.card ?? '#FFFFFF' }]}
                >
                  <Ionicons name="close" size={18} color={text} />
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.helperText, { color: subtext, marginTop: 10 }]}>
                No thumbnail selected (optional)
              </Text>
            )}
          </View>
        ) : null}

        {/* For non-image/video attachments, show selected file name */}
        {!isImage && !isVideo && attachments.length ? (
          <Text style={[styles.helperText, { color: subtext }]}>Selected: {selectedName}</Text>
        ) : null}

        {/* Caption input */}
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1, // important: prevents the page from stretching in height
    paddingVertical: 8,
  },
  scrollContent: {
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 18,
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

  previewWrap: {
    alignItems: 'center',
    marginTop: 4,
  },

  // used for image preview to match the design
  previewSquare: {
    width: 240,
    height: 240,
    borderRadius: 22,
    borderWidth: 2,
    backgroundColor: 'transparent',

    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
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
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Thumbnail preview row
  thumbRow: {
    width: '100%',
    maxWidth: 360,
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
    backgroundColor: '#EEE',
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
