// src/Module/ChatRoom/componets/ViewOnceViewerModal.tsx
//
// Dedicated full-screen viewer for view-once content (text, image, video,
// voice, or document). Opening this modal IS "the view" — the caller
// (MessageBubble) snapshots the message's content into `content` before the
// underlying message gets its content stripped for real (see
// ChatRoomPage.tsx's handleViewOnce), so this component never touches the
// live ChatMessage and keeps rendering the snapshot even after that happens.

import React, { useState } from 'react';
import { Modal, View, Text, Pressable, Image, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { resolveBackendAssetUrl } from '@/network';

export type ViewOnceAttachmentSnapshot = {
  url?: string | null;
  localUri?: string | null;
  mimeType?: string | null;
  originalName?: string | null;
  kind?: 'image' | 'video' | 'audio' | 'document' | 'other' | null;
  durationMs?: number | null;
};

export type ViewOnceContentSnapshot = {
  text?: string | null;
  attachments?: ViewOnceAttachmentSnapshot[];
  voice?: ViewOnceAttachmentSnapshot | null;
};

type Props = {
  visible: boolean;
  content: ViewOnceContentSnapshot | null;
  palette: any;
  onClose: () => void;
};

const resolveSnapshotUri = (item: ViewOnceAttachmentSnapshot | null | undefined): string | null => {
  if (!item) return null;
  if (item.localUri) return item.localUri;
  if (item.url) return resolveBackendAssetUrl(item.url) ?? item.url;
  return null;
};

const inferAttachmentKind = (item: ViewOnceAttachmentSnapshot): 'image' | 'video' | 'audio' | 'document' | 'other' => {
  if (item.kind) return item.kind;
  const mime = (item.mimeType ?? '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
};

export const ViewOnceViewerModal: React.FC<Props> = ({ visible, content, palette, onClose }) => {
  const [attachmentIndex, setAttachmentIndex] = useState(0);
  const [voicePlaying, setVoicePlaying] = useState(false);
  // React Native ignores a parent's paddingTop when placing an absolutely
  // positioned child — SafeAreaView's inset padding does nothing for these
  // overlay buttons, so without this they land `top: 8`/`top: 14` from the
  // screen's raw top edge, under the status bar/notch, where taps mostly
  // don't register. Read the real inset and add it in explicitly instead.
  const insets = useSafeAreaInsets();

  if (!content) return null;

  const attachments = content.attachments ?? [];
  const activeAttachment = attachments[Math.min(attachmentIndex, Math.max(0, attachments.length - 1))] ?? null;
  const primaryColor = palette?.primary ?? '#2f7dfa';

  const renderDocument = (item: ViewOnceAttachmentSnapshot, uri: string | null) => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <Ionicons name="document-text-outline" size={64} color="#fff" />
      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 14, textAlign: 'center' }} numberOfLines={2}>
        {item.originalName || 'Document'}
      </Text>
      {!!uri && (
        <Pressable
          onPress={() => { Linking.openURL(uri).catch(() => {}); }}
          style={{ marginTop: 18, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 22, backgroundColor: primaryColor }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Open</Text>
        </Pressable>
      )}
    </View>
  );

  const renderVoice = (item: ViewOnceAttachmentSnapshot) => {
    const uri = resolveSnapshotUri(item);
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {!!uri && (
          <Video
            source={{ uri }}
            paused={!voicePlaying}
            volume={1}
            muted={false}
            controls={false}
            audioOutput="speaker"
            ignoreSilentSwitch="ignore"
            playInBackground={false}
            playWhenInactive={false}
            onEnd={() => setVoicePlaying(false)}
            onError={() => setVoicePlaying(false)}
          />
        )}
        <Pressable
          onPress={() => setVoicePlaying((p) => !p)}
          disabled={!uri}
          style={{
            width: 76,
            height: 76,
            borderRadius: 38,
            backgroundColor: primaryColor,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: uri ? 1 : 0.5,
          }}
        >
          <Ionicons name={voicePlaying ? 'pause' : 'play'} size={32} color="#fff" />
        </Pressable>
        <Text style={{ color: 'rgba(255,255,255,0.85)', marginTop: 16, fontSize: 13, fontWeight: '600' }}>
          Voice message
        </Text>
      </View>
    );
  };

  const renderBody = () => {
    if (activeAttachment) {
      const uri = resolveSnapshotUri(activeAttachment);
      const kind = inferAttachmentKind(activeAttachment);

      if (kind === 'image') {
        return uri ? (
          <Image source={{ uri }} style={{ flex: 1 }} resizeMode="contain" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#fff" />
          </View>
        );
      }
      if (kind === 'video') {
        return uri ? (
          <Video source={{ uri }} style={{ flex: 1 }} resizeMode="contain" controls paused={false} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#fff" />
          </View>
        );
      }
      if (kind === 'audio') {
        return renderVoice(activeAttachment);
      }
      return renderDocument(activeAttachment, uri);
    }

    if (content.voice) {
      return renderVoice(content.voice);
    }

    if (content.text) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '500', textAlign: 'center', lineHeight: 28 }}>
            {content.text}
          </Text>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent={false} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top']}>
        {renderBody()}

        {attachments.length > 1 && (
          <View style={{ position: 'absolute', bottom: insets.bottom + 28, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {attachments.map((_, i) => (
              <Pressable
                key={i}
                onPress={() => setAttachmentIndex(i)}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i === attachmentIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                }}
              />
            ))}
          </View>
        )}

        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 16,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(0,0,0,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>

        <View
          style={{
            position: 'absolute',
            top: insets.top + 14,
            right: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'rgba(0,0,0,0.6)',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 14,
          }}
        >
          <Ionicons name="eye-outline" size={14} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>View once</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};
