import React, { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  GestureResponderEvent,
  Alert,
} from 'react-native';
import DocumentPicker, {
  DocumentPickerResponse,
} from 'react-native-document-picker';

import { KISIcon } from '@/constants/kisIcons';
import { KIS_TOKENS, kisRadius, KISPalette } from '@/theme/constants';

import { ContactsModal, SimpleContact } from './ForAttachments/ContactsModal';
import { PollModal, PollDraft } from './ForAttachments/PollModal';
import { EventModal, EventDraft } from './ForAttachments/EventModal';
import {
  AttachmentPreviewPage,
  PreviewKind,
} from './ForAttachments/AttachmentPreviewPage';
import type { AttachmentFilePayload, FilesType } from '../../ChatRoomPage';
import usePullDownToClose from '@/hooks/usePullDownToClose';
export type { AttachmentFilePayload, FilesType } from '../../ChatRoomPage';

type AttachmentSheetProps = {
  visible: boolean;
  palette: KISPalette;
  onClose: () => void;

  onSendFiles?: (
    files: AttachmentFilePayload,
    callbacks?: {
      onProgress?: (uri: string, progress: number) => void;
      onStatus?: (uri: string, status: 'uploading' | 'done' | 'failed') => void;
    },
  ) => Promise<boolean> | boolean;

  onSendContacts?: (contacts: SimpleContact[]) => void;
  onCreatePoll?: (poll: PollDraft) => void;
  onCreateEvent?: (event: EventDraft) => void;
};

export const AttachmentSheet: React.FC<AttachmentSheetProps> = ({
  visible,
  palette,
  onClose,
  onSendFiles,
  onSendContacts,
  onCreatePoll,
  onCreateEvent,
}) => {
  const cardRadius = kisRadius.xl ?? 20;
  const pickInProgressRef = useRef(false);
  const { panHandlers } = usePullDownToClose({
    enabled: visible,
    onClose,
  });

  const [contactsVisible, setContactsVisible] = useState(false);
  const [pollVisible, setPollVisible] = useState(false);
  const [eventVisible, setEventVisible] = useState(false);

  // Preview page state
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewItems, setPreviewItems] = useState<FilesType[]>([]);
  const [previewKind, setPreviewKind] = useState<PreviewKind | null>(null);

  const handleBackdropPress = () => {
    onClose();
  };

  const handleMenuInnerPress = (e: GestureResponderEvent) => {
    e.stopPropagation();
  };

  /** ─────────────────────────
   *  PREVIEW HELPERS
   *  ───────────────────────── */
  const openPreview = (kind: PreviewKind, items: FilesType[]) => {
    setPreviewKind(kind);
    setPreviewItems(items);
    setPreviewVisible(true);

    // Close attachment sheet so we only see the preview page
    onClose();
  };

  const closePreview = () => {
    setPreviewVisible(false);
    setPreviewItems([]);
    setPreviewKind(null);
  };

  const handlePreviewSend = async (
    caption: string,
    callbacks?: {
      onProgress?: (uri: string, progress: number) => void;
      onStatus?: (uri: string, status: 'uploading' | 'done' | 'failed') => void;
    },
  ): Promise<boolean> => {
    if (!previewKind || !previewItems.length) {
      closePreview();
      return true;
    }

    const filesToBeSent = previewItems.map(item => ({
      ...item,
    }));

    let shouldClose = true;
    try {
      if (onSendFiles) {
        const ok = await onSendFiles(
          {
            caption,
            files: filesToBeSent,
            onProgress: callbacks?.onProgress,
            onStatus: callbacks?.onStatus,
          },
          callbacks,
        );
        if (!ok) {
          shouldClose = false;
          return false;
        }
      } else {
        Alert.alert(
          'Attachments ready',
          `You selected ${filesToBeSent.length} item(s).`,
        );
      }
    } catch (err) {
      console.warn('[AttachmentSheet] Error sending attachments', err);
      Alert.alert(
        'Send error',
        'Something went wrong while sending your attachments.',
      );
      return false;
    } finally {
      if (shouldClose) closePreview();
    }
    return true;
  };

  /** ─────────────────────────
   *  FILES (non-image, non-video)
   *  ───────────────────────── */
  const handleSendFilesPress = async () => {
    if (pickInProgressRef.current) {
      console.log(
        '[AttachmentSheet] File picker already in progress, ignoring tap',
      );
      return;
    }

    pickInProgressRef.current = true;

    try {
      const options: any = {
        type: [DocumentPicker.types.allFiles],
        allowMultiSelection: true,
      };

      const result = await DocumentPicker.pick(options);

      const resultsArray: DocumentPickerResponse[] = Array.isArray(result)
        ? result
        : [result];

      const rawPayload: FilesType[] = resultsArray.map(file => ({
        uri: file.uri,
        name: file.name ?? 'file',
        type: file.type ?? null,
        size: file.size,
      }));

      // filter out images/videos – they must come from CameraCaptureModal, not here
      const payload = rawPayload.filter(f => {
        const type = f.type || '';
        if (type.startsWith('image/')) return false;
        if (type.startsWith('video/')) return false;
        const lower = f.name.toLowerCase();
        if (lower.endsWith('.jpg')) return false;
        if (lower.endsWith('.jpeg')) return false;
        if (lower.endsWith('.png')) return false;
        if (lower.endsWith('.gif')) return false;
        if (lower.endsWith('.webp')) return false;
        if (lower.endsWith('.heic')) return false;
        if (lower.endsWith('.mp4')) return false;
        if (lower.endsWith('.mov')) return false;
        if (lower.endsWith('.mkv')) return false;
        return true;
      });

      if (!payload.length) {
        Alert.alert(
          'No valid files',
          'Only documents are allowed here. Use the camera button for photos or videos.',
        );
        return;
      }

      openPreview('file', payload);
    } catch (err: any) {
      if (DocumentPicker.isCancel(err)) {
        console.log('[AttachmentSheet] User cancelled document picker');
      } else if (DocumentPicker.isInProgress?.(err)) {
        console.log(
          '[AttachmentSheet] Another picker is already in progress, skipping',
        );
      } else {
        console.warn('[AttachmentSheet] Error picking files', err);
        Alert.alert(
          'File picker error',
          'Something went wrong while opening the file picker.',
        );
      }
    } finally {
      pickInProgressRef.current = false;
    }
  };

  /** ─────────────────────────
   *  AUDIO (ONLY audio, not generic files)
   *  ───────────────────────── */
  const handleAudioPress = async () => {
    if (pickInProgressRef.current) {
      console.log(
        '[AttachmentSheet] Audio picker already in progress, ignoring tap',
      );
      return;
    }

    pickInProgressRef.current = true;

    try {
      // This restricts to audio MIME types only (from device & providers)
      const options: any = {
        type: [DocumentPicker.types.audio],
        allowMultiSelection: true,
      };

      const result = await DocumentPicker.pick(options);

      const resultsArray: DocumentPickerResponse[] = Array.isArray(result)
        ? result
        : [result];

      const payload: FilesType[] = resultsArray.map(file => ({
        uri: file.uri,
        name: file.name ?? 'audio',
        type: file.type ?? 'audio/*',
        size: file.size,
      }));

      if (!payload.length) {
        return;
      }

      openPreview('audio', payload);
    } catch (err: any) {
      if (DocumentPicker.isCancel(err)) {
        console.log('[AttachmentSheet] User cancelled audio picker');
      } else if (DocumentPicker.isInProgress?.(err)) {
        console.log(
          '[AttachmentSheet] Another picker is already in progress, skipping',
        );
      } else {
        console.warn('[AttachmentSheet] Error picking audio files', err);
        Alert.alert(
          'Audio picker error',
          'Something went wrong while opening the audio picker.',
        );
      }
    } finally {
      pickInProgressRef.current = false;
    }
  };

  /** ─────────────────────────
   *  OTHER OPTIONS
   *  ───────────────────────── */
  const handleSendContactsPress = () => {
    onClose();
    setContactsVisible(true);
  };

  const handleCreatePollPress = () => {
    onClose();
    setPollVisible(true);
  };

  const handleCreateEventPress = () => {
    onClose();
    setEventVisible(true);
  };

  const attachments = [
    {
      key: 'files',
      label: 'Send files',
      description: 'Documents, PDFs, and more',
      icon: 'file' as const,
      color: palette.primary,
      onPress: handleSendFilesPress,
    },
    // NO photo/videos here — handled only via CameraCaptureModal
    {
      key: 'audio',
      label: 'Audio',
      description: 'Voice notes and music',
      icon: 'audio' as const,
      color: palette.info,
      onPress: handleAudioPress,
    },
    {
      key: 'contacts',
      label: 'Send contacts',
      description: 'Share saved contacts',
      icon: 'contacts' as const,
      color: palette.info,
      onPress: handleSendContactsPress,
    },
    {
      key: 'poll',
      label: 'Create a poll',
      description: 'Ask the group and vote',
      icon: 'poll' as const,
      color: palette.success,
      onPress: handleCreatePollPress,
    },
    {
      key: 'event',
      label: 'Create an event',
      description: 'Schedule a meetup',
      icon: 'calendar' as const,
      color: palette.warning,
      onPress: handleCreateEventPress,
    },
  ];

  return (
    <>
      {/* Main attachment sheet */}
      <Modal
        transparent
        animationType="fade"
        visible={visible}
        onRequestClose={onClose}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: palette.backdrop,
            justifyContent: 'flex-end',
          }}
          onPress={handleBackdropPress}
        >
          <Pressable
            onPress={handleMenuInnerPress}
            style={{
              backgroundColor: palette.surfaceElevated,
              borderTopLeftRadius: cardRadius,
              borderTopRightRadius: cardRadius,
              paddingHorizontal: KIS_TOKENS.spacing.lg,
              paddingTop: KIS_TOKENS.spacing.md,
              paddingBottom: KIS_TOKENS.spacing['2xl'],
              ...KIS_TOKENS.elevation.modal,
            }}
          >
            {/* Grab handle */}
            <View
              {...panHandlers}
              style={{
                alignSelf: 'center',
                width: 40,
                height: 4,
                borderRadius: 999,
                backgroundColor: palette.divider,
                marginBottom: KIS_TOKENS.spacing.sm,
              }}
            />

            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: KIS_TOKENS.spacing.sm,
              }}
            >
              <KISIcon name="add" size={18} color={palette.primary} />
              <Text
                style={{
                  marginLeft: 8,
                  fontSize: KIS_TOKENS.typography.title,
                  fontWeight: KIS_TOKENS.typography.weight.bold,
                  color: palette.text,
                }}
              >
                Share more
              </Text>
            </View>

            <Text
              style={{
                fontSize: KIS_TOKENS.typography.helper,
                color: palette.subtext,
                marginBottom: KIS_TOKENS.spacing.lg,
              }}
            >
              Attach files, audio, contacts, polls or events to this
              conversation.
            </Text>

            {/* Options grid */}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
              }}
            >
              {attachments.map((item, index) => (
                <Pressable
                  key={item.key}
                  onPress={item.onPress}
                  android_ripple={{
                    color: palette.primarySoft,
                    borderless: false,
                  }}
                  style={({ pressed }) => ({
                    width: '48%',
                    marginBottom: KIS_TOKENS.spacing.md,
                    borderRadius: kisRadius.lg,
                    backgroundColor:
                      index === 0 ? palette.primarySoft : palette.surface,
                    paddingHorizontal: KIS_TOKENS.spacing.md,
                    paddingVertical: KIS_TOKENS.spacing.md,
                    ...KIS_TOKENS.elevation.popover,
                    opacity: pressed ? KIS_TOKENS.opacity.pressed : 1,
                  })}
                >
                  {/* Icon bubble */}
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: KIS_TOKENS.spacing.sm,
                      backgroundColor: item.color,
                    }}
                  >
                    <KISIcon
                      name={item.icon}
                      size={20}
                      color={palette.onPrimary}
                    />
                  </View>

                  {/* Text */}
                  <Text
                    style={{
                      fontSize: KIS_TOKENS.typography.label,
                      fontWeight: KIS_TOKENS.typography.weight.bold,
                      color: palette.text,
                      marginBottom: 2,
                    }}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: KIS_TOKENS.typography.tiny,
                      color: palette.subtext,
                    }}
                    numberOfLines={2}
                  >
                    {item.description}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Separate preview page */}
      <AttachmentPreviewPage
        visible={previewVisible}
        palette={palette}
        kind={previewKind}
        items={previewItems}
        onCancel={closePreview}
        onSend={handlePreviewSend}
      />

      {/* Contacts modal */}
      <ContactsModal
        visible={contactsVisible}
        palette={palette}
        onClose={() => setContactsVisible(false)}
        onSendContacts={contacts => {
          if (onSendContacts) {
            onSendContacts(contacts);
          }
        }}
      />

      {/* Poll modal */}
      <PollModal
        visible={pollVisible}
        palette={palette}
        onClose={() => setPollVisible(false)}
        onCreatePoll={poll => {
          if (onCreatePoll) {
            onCreatePoll(poll);
          }
        }}
      />

      {/* Event modal */}
      <EventModal
        visible={eventVisible}
        palette={palette}
        onClose={() => setEventVisible(false)}
        onCreateEvent={event => {
          if (onCreateEvent) {
            onCreateEvent(event);
          }
        }}
      />
    </>
  );
};
