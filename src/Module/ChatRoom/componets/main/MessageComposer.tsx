import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  Image,
} from 'react-native';

import AudioRecorderPlayer from 'react-native-audio-recorder-player';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sticker, STICKER_STORAGE_KEY } from './FroSticker/StickerEditor';
import { ChatMessage } from '../../chatTypes';
import { AVATAR_OPTIONS, AvatarPicker } from '../AvatarPicker';
import { EmojiPicker } from '../EmojiPicker';
import { KISIcon } from '@/constants/kisIcons';
import { HoldToLockComposer } from '../HoldToLockComposer';
import { chatRoomStyles as styles } from '@/Module/ChatRoom/chatRoomStyles';
import {
  AttachmentSheet,
} from './AttachmentSheet';
import { CameraCaptureModal } from './CameraCaptureModal';
import type { SimpleContact } from './ForAttachments/ContactsModal';
import type { PollDraft } from './ForAttachments/PollModal';
import type { EventDraft } from './ForAttachments/EventModal';
import { AttachmentFilePayload } from '../../ChatRoomPage';

/* -------------------------------------------------------------------------- */
/*                          STICKER PICKER (BOTTOM PANEL)                     */
/* -------------------------------------------------------------------------- */

const StickerPicker = ({
  palette,
  stickers,
  onCreateStickerPress,
  onSelectSticker,
}: {
  palette: any;
  stickers: Sticker[];
  onCreateStickerPress: () => void;
  onSelectSticker: (sticker: Sticker) => void;
}) => {
  return (
    <View style={{ padding: 12 }}>
      {/* CREATE STICKER BUTTON */}
      <Pressable
        onPress={onCreateStickerPress}
        style={{
          marginBottom: 12,
          backgroundColor: palette.primary,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 10,
          alignSelf: 'flex-start',
        }}
      >
        <Text style={{ color: palette.onPrimary, fontWeight: '600' }}>
          + Create New Sticker
        </Text>
      </Pressable>

      {/* STICKER GRID */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {stickers.length === 0 && (
          <Text style={{ color: palette.subtext, fontSize: 13 }}>
            No stickers yet. Create one!
          </Text>
        )}

        {stickers.map((sticker) => (
          <Pressable
            key={sticker.id}
            onPress={() => onSelectSticker(sticker)}
            style={{
              width: 80,
              height: 80,
              margin: 6,
              borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: palette.surface,
            }}
          >
            <Image
              source={{ uri: sticker.uri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*                              AUDIO PLAYER                                  */
/* -------------------------------------------------------------------------- */

const audioRecorderPlayer = new AudioRecorderPlayer();
audioRecorderPlayer.setSubscriptionDuration(0.1);

/* -------------------------------------------------------------------------- */
/*                              COMPONENT PROPS                                */
/* -------------------------------------------------------------------------- */

type MessageComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  canSend: boolean;
  palette: any;
  disabled?: boolean;

  onSendVoice?: (payload: { uri: string; durationMs: number }) => void;
  onChooseTextBackground?: (backgroundColor: string) => void;

  onSendSticker?: (sticker: Sticker) => void;
  onOpenStickerEditor?: () => void;
  stickerVersion?: number;

  replyTo?: ChatMessage | null;
  onClearReply?: () => void;
  editing?: ChatMessage | null;
  onCancelEditing?: () => void;

  onSendAttachment?: (files: AttachmentFilePayload) => Promise<boolean | void> | boolean | void;

  // NEW: contacts / polls / events
  onSendContacts?: (contacts: SimpleContact[]) => void;
  onCreatePoll?: (poll: PollDraft) => void;
  onCreateEvent?: (event: EventDraft) => void;
};

/* -------------------------------------------------------------------------- */
/*                           MESSAGE COMPOSER                                 */
/* -------------------------------------------------------------------------- */

export const MessageComposer: React.FC<MessageComposerProps> = ({
  value,
  onChangeText,
  onSend,
  canSend,
  palette,
  disabled,
  onSendVoice,
  onChooseTextBackground,
  onSendSticker,
  onOpenStickerEditor,
  stickerVersion = 0,
  replyTo,
  onClearReply,
  editing,
  onCancelEditing,
  onSendAttachment,
  onSendContacts,
  onCreatePoll,
  onCreateEvent,
}) => {
  /* ----------------------------- VOICE STATE ----------------------------- */
  const [isRecording, setIsRecording] = useState(false);

  const previewVisible = false;

  /* ----------------------------- ATTACHMENT SHEET ------------------------- */
  const [attachmentMenuVisible, setAttachmentMenuVisible] =
    useState(false);

  const openAttachmentMenu = () => {
    if (disabled) return;
    setAttachmentMenuVisible(true);
  };

  const closeAttachmentMenu = () => {
    setAttachmentMenuVisible(false);
  };

  /* ----------------------------- CAMERA MODAL ----------------------------- */
  const [cameraVisible, setCameraVisible] = useState(false);

  const openCameraModal = () => {
    if (disabled) return;
    setCameraVisible(true);
  };

  const closeCameraModal = () => {
    setCameraVisible(false);
  };

  /* ----------------------------- STICKER STORAGE -------------------------- */
  const [stickers, setStickers] = useState<Sticker[]>([]);

  const loadStickers = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STICKER_STORAGE_KEY);

      if (!raw) {
        setStickers([]);
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.warn('Failed to parse stickers from storage', e);
        setStickers([]);
        return;
      }

      const list = Array.isArray(parsed) ? parsed : [];

      const cleaned: Sticker[] = list
        .filter((s: any) => s && typeof s.uri === 'string')
        .map((s: any, index: number) => ({
          id: String(s.id ?? `local-${Date.now()}-${index}`),
          uri: String(s.uri),
          text: typeof s.text === 'string' ? s.text : undefined,
          fileType: 'kis-sticker',
          mimeType: 'image/png',
          extension: '.png',
          metaPath: (s.metaPath as string) ?? '',
        }));

      setStickers(cleaned);
    } catch (err) {
      console.warn('Failed to load stickers', err);
      setStickers([]);
    }
  }, []);

  /* ----------------------------- INITIAL LOAD ----------------------------- */
  useEffect(() => {
    loadStickers();
  }, [loadStickers]);

  useEffect(() => {
    loadStickers();
  }, [stickerVersion, loadStickers]);

  /* ----------------------------- PANEL STATE ------------------------------ */
  const [keyboardMode, setKeyboardMode] = useState(true);
  const [panelTab, setPanelTab] =
    useState<'custom' | 'emoji' | 'stickers'>('emoji');

  const textInputRef = useRef<TextInput | null>(null);

  /* ----------------------------- CUSTOM (background text card) ------------ */
  const [avatarId, setAvatarId] = useState('sunrise_orange');

  const handleSelectAvatar = (id: string) => {
    setAvatarId(id);
    const avatar = AVATAR_OPTIONS.find((a) => a.id === id);
    if (avatar) {
      onChooseTextBackground?.(avatar.bgColor);
    }
  };

  /* ----------------------------- CLEANUP EFFECT --------------------------- */
  useEffect(() => {
    return () => {
      try {
        audioRecorderPlayer.stopPlayer();
        audioRecorderPlayer.removePlayBackListener();
      } catch {}
      try {
        audioRecorderPlayer.stopRecorder();
        audioRecorderPlayer.removeRecordBackListener();
      } catch {}
    };
  }, []);

  /* ----------------------------- SEND GUARD (DEDUP) ----------------------- */

  const lastSendRef = useRef<number | null>(null);

  const handleTextSend = () => {
    if (!canSend || disabled) return;

    const now = Date.now();
    if (lastSendRef.current && now - lastSendRef.current < 400) {
      console.log('[MessageComposer] Ignored duplicate send (too fast)');
      return;
    }
    lastSendRef.current = now;

    onSend();
  };

  /* ----------------------------- PANEL TOGGLING --------------------------- */
  const toggleEmojiKeyboard = () => {
    if (keyboardMode) {
      setKeyboardMode(false);
      setPanelTab('emoji');
      textInputRef.current?.blur();
    } else {
      setKeyboardMode(true);
      textInputRef.current?.focus();
    }
  };

  const isVoiceActive = isRecording || previewVisible;
  const showTextSend = canSend && !isRecording && !previewVisible;

  /* -------------------------------------------------------------------------- */
  /*                             PANEL CONTENT                                  */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    if (panelTab === 'stickers') {
      loadStickers();
    }
  }, [panelTab, loadStickers]);

  const renderPanelContent = () => {
    switch (panelTab) {
      case 'custom':
        return (
          <AvatarPicker
            palette={palette}
            selectedAvatarId={avatarId}
            onSelectAvatar={handleSelectAvatar}
          />
        );

      case 'emoji':
        return (
          <EmojiPicker
            palette={palette}
            onSelectEmoji={(emoji) => onChangeText(value + emoji)}
          />
        );

      case 'stickers':
        return (
          <StickerPicker
            palette={palette}
            stickers={stickers}
            onCreateStickerPress={() => {
              if (onOpenStickerEditor) onOpenStickerEditor();
            }}
            onSelectSticker={(sticker) => {
              onSendSticker?.(sticker);
              setKeyboardMode(true);
              textInputRef.current?.focus();
            }}
          />
        );

      default:
        return (
          <AvatarPicker
            palette={palette}
            selectedAvatarId={avatarId}
            onSelectAvatar={handleSelectAvatar}
          />
        );
    }
  };

  /* ----------------------------- TAB BAR ----------------------------------- */
  const renderTabBar = () => {
    const tabs = [
      { id: 'custom', label: 'Custom' },
      { id: 'emoji', label: 'Emoji' },
      { id: 'stickers', label: 'Stickers' },
    ] as const;

    return (
      <View
        style={{
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderColor: palette.divider,
          paddingHorizontal: 8,
          paddingVertical: 6,
        }}
      >
        {tabs.map((t) => {
          const active = panelTab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setPanelTab(t.id)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: active ? palette.primary : 'transparent',
                marginRight: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: active ? palette.onPrimary : palette.text,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  /* ----------------------------- REPLY / EDIT BANNER ----------------------- */

  const renderReplyOrEditBanner = () => {
    if (editing) {
      const snippet =
        editing.text ||
        editing.styledText?.text ||
        (editing.sticker ? 'Sticker' : '') ||
        (editing.voice ? 'Voice message' : '') ||
        (editing.contacts ? 'Contact(s)' : '') ||
        (editing.poll ? 'Poll' : '') ||
        (editing.event ? 'Event' : '') ||
        '';

      return (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderTopWidth: 1,
            borderColor: palette.divider,
            backgroundColor: palette.replyBannerBg ?? palette.card,
          }}
        >
          <KISIcon
            name="edit"
            size={16}
            color={palette.primary}
          />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: palette.primary,
              }}
            >
              Editing
            </Text>
            {!!snippet && (
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  fontSize: 12,
                  color: palette.subtext,
                }}
              >
                {snippet}
              </Text>
            )}
          </View>
          {onCancelEditing && (
            <Pressable onPress={onCancelEditing}>
              <KISIcon
                name="close"
                size={16}
                color={palette.subtext}
              />
            </Pressable>
          )}
        </View>
      );
    }

    if (replyTo) {
      const snippet =
        replyTo.text ||
        replyTo.styledText?.text ||
        (replyTo.sticker ? 'Sticker' : '') ||
        (replyTo.voice ? 'Voice message' : '') ||
        (replyTo.contacts ? 'Contact(s)' : '') ||
        (replyTo.poll ? 'Poll' : '') ||
        (replyTo.event ? 'Event' : '') ||
        '';

      return (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderTopWidth: 1,
            borderColor: palette.divider,
            backgroundColor: palette.replyBannerBg ?? palette.card,
          }}
        >
          <KISIcon
            name="reply"
            size={16}
            color={palette.primary}
          />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: palette.primary,
              }}
            >
              Replying
            </Text>
            {!!snippet && (
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  fontSize: 12,
                  color: palette.subtext,
                }}
              >
                {snippet}
              </Text>
            )}
          </View>
          {onClearReply && (
            <Pressable onPress={onClearReply}>
              <KISIcon
                name="close"
                size={16}
                color={palette.subtext}
              />
            </Pressable>
          )}
        </View>
      );
    }

    return null;
  };

  /* -------------------------------------------------------------------------- */
  /*                                  RENDER                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <View
      style={[
        styles.composerContainer,
        {
          borderTopColor: palette.divider,
          backgroundColor: palette.chatComposerBg ?? palette.card,
        },
      ]}
    >
      {renderReplyOrEditBanner()}

      {/* MAIN INPUT ROW */}
      <View style={styles.composerMainRow}>
        {!isVoiceActive && (
          <>
            <Pressable
              onPress={toggleEmojiKeyboard}
              style={styles.iconTextButton}
            >
              <KISIcon
                name={keyboardMode ? 'smiley' : 'keyboard'}
                size={22}
                color={palette.subtext}
              />
            </Pressable>

            <View
              style={[
                styles.composerInputWrapper,
                {
                  backgroundColor: palette.composerInputBg,
                  borderColor:
                    palette.composerInputBorder ?? 'transparent',
                },
              ]}
            >
              <TextInput
                ref={textInputRef}
                value={value}
                editable={!disabled}
                onChangeText={onChangeText}
                placeholder={
                  editing
                    ? 'Edit message'
                    : replyTo
                    ? 'Reply...'
                    : 'Message'
                }
                placeholderTextColor={palette.subtext}
                multiline
                style={[styles.composerInput, { color: palette.text }]}
              />
            </View>

            {/* "+" → attachment sheet */}
            <Pressable
              style={styles.iconTextButton}
              disabled={!!disabled}
              onPress={openAttachmentMenu}
            >
              <KISIcon
                name="add"
                size={22}
                color={palette.subtext}
              />
            </Pressable>

            {/* Camera → open full-screen camera modal (ONLY place for images/videos) */}
            <Pressable
              style={styles.iconTextButton}
              disabled={!!disabled}
              onPress={openCameraModal}
            >
              <KISIcon
                name="camera"
                size={22}
                color={palette.subtext}
              />
            </Pressable>
          </>
        )}

        {/* SEND / VOICE */}
        {showTextSend ? (
          <Pressable
            onPress={handleTextSend}
            disabled={!canSend || !!disabled}
            style={[
              styles.composerActionButton,
              {
                backgroundColor:
                  !canSend || disabled
                    ? palette.subtext
                    : palette.primary,
                marginRight: 12,
                height: 50,
                width: 50,
                opacity: !canSend || disabled ? 0.6 : 1,
              },
            ]}
          >
            <KISIcon
              name="send"
              size={18}
              color={palette.onPrimary}
            />
          </Pressable>
        ) : (
          <HoldToLockComposer
            palette={palette}
            onSendVoice={onSendVoice}
            setIsRecording={setIsRecording}
          />
        )}
      </View>

      {/* EMOJI / CUSTOM / STICKERS PANEL */}
      {!keyboardMode && !disabled && !isVoiceActive && (
        <View>
          {renderTabBar()}
          {renderPanelContent()}
        </View>
      )}

      {/* ATTACHMENT SHEET MODAL (files, audio, contacts, poll, event) */}
      <AttachmentSheet
        visible={attachmentMenuVisible}
        palette={palette}
        onClose={closeAttachmentMenu}
        onSendFiles={async (files, callbacks) => {
          console.log(
            '[MessageComposer] onSendFiles from sheet:',
            files,
          );
          const res = await onSendAttachment?.({
            ...files,
            onProgress: callbacks?.onProgress,
            onStatus: callbacks?.onStatus,
          });
          return res !== false;
        }}
        onSendContacts={(contacts) => {
          console.log(
            '[MessageComposer] contacts selected:',
            contacts,
          );
          onSendContacts?.(contacts);
        }}
        onCreatePoll={(poll) => {
          console.log('[MessageComposer] poll created:', poll);
          onCreatePoll?.(poll);
        }}
        onCreateEvent={(event) => {
          console.log('[MessageComposer] event created:', event);
          onCreateEvent?.(event);
        }}
      />

      {/* CAMERA FULL-SCREEN MODAL (ONLY source for images/videos) */}
      <CameraCaptureModal
        visible={cameraVisible}
        palette={palette}
        onClose={closeCameraModal}
        onCapture={(files) => {
          console.log(
            '[MessageComposer] camera captured files (images/videos):',
            files,
          );
          onSendAttachment?.(files);
        }}
      />
    </View>
  );
};
