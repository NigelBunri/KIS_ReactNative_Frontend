import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

import AudioRecorderPlayer from 'react-native-audio-recorder-player';

/* -------------------------------------------------------------------------- */
/*                         MENTION NOTIFICATION HELPER                         */
/* -------------------------------------------------------------------------- */

async function notifyMentions(
  mentionedUserIds: string[],
  context: { sender_name: string; preview: string; conversation_id: string; message_id?: string }
) {
  if (!mentionedUserIds.length) return;
  try {
    await postRequest(
      ROUTES.notifications.mention,
      { mentioned_user_ids: mentionedUserIds, context },
      { errorMessage: '' }
    );
  } catch { /* best effort */ }
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sticker, STICKER_STORAGE_KEY } from './FroSticker/StickerEditor';
import { ChatMessage } from '../../chatTypes';
import type { LocationMessage } from '../../chatTypes';
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
import { AttachmentFilePayload, UploadStatus } from '../../ChatRoomPage';
import { useResponsiveLayout } from '@/theme/responsive';
import { searchTenor, TenorGif } from './GifPickerSheet';
import { LocationPickerSheet } from './LocationPickerSheet';
import { ScheduleMessageSheet } from './ScheduleMessageSheet';

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

  // @mention autocomplete
  mentionParticipants?: { id: string; name: string }[];

  // mention notification context
  senderName?: string;
  conversationIdForMentions?: string;

  // NEW: GIF / Location / Schedule
  onSendGif?: (gif: { url: string; previewUrl: string; width: number; height: number }) => void;
  onSendLocation?: (loc: LocationMessage) => void;
  onScheduleSend?: (scheduledAt: string) => void;

  /** GAP 3: scanned document send */
  onSendScannedDocument?: (uri: string, mimeType: string, filename: string) => void;

  /** Called when the view-once toggle changes; parent attaches viewOnce to the message payload. */
  onViewOnceChange?: (enabled: boolean) => void;

  /**
   * GAP 4: Called when the user creates a payment message.
   * Receives the payment fields; the parent is responsible for building and
   * sending the ChatMessage with kind='payment'.
   */
  onSendPayment?: (payment: {
    amount: number;
    currency: string;
    note?: string;
    recipientId?: string;
  }) => void;

  bottomInset?: number;

  /** Called whenever the detected link preview changes (or clears). Parent stores this and attaches it to the message on send. */
  onLinkPreviewChange?: (preview: { title?: string; description?: string; image?: string; site_name?: string; url: string } | null) => void;
};

/* -------------------------------------------------------------------------- */
/*                           MESSAGE COMPOSER                                 */
/* -------------------------------------------------------------------------- */

export const MessageComposer: React.FC<MessageComposerProps> = ({
  value,
  onChangeText,
  onSend,
  onLinkPreviewChange,
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
  mentionParticipants,
  senderName = '',
  conversationIdForMentions = '',
  onSendGif,
  onSendLocation,
  onScheduleSend,
  onSendScannedDocument,
  onSendPayment,
  onViewOnceChange,
  bottomInset = 0,
}) => {
  /* ----------------------------- VIEW ONCE -------------------------------- */
  const [viewOnce, setViewOnce] = useState(false);
  const toggleViewOnce = () => {
    const next = !viewOnce;
    setViewOnce(next);
    onViewOnceChange?.(next);
  };

  /* ----------------------------- VOICE STATE ----------------------------- */
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const sendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responsive = useResponsiveLayout();
  const isTinyDevice = responsive.isWatch || responsive.isCompactPhone;
  const composerIconSize = responsive.isWatch ? 32 : responsive.isCompactPhone ? 34 : 36;
  const sendButtonSize = responsive.isWatch ? 40 : responsive.isCompactPhone ? 44 : 50;
  const composerIconGlyph = responsive.isWatch ? 18 : 22;

  /* ----------------------------- LINK PREVIEW ----------------------------- */
  type LinkPreviewData = { title?: string; description?: string; image?: string; site_name?: string; url: string };
  const [composerLinkPreview, setComposerLinkPreview] = useState<LinkPreviewData | null>(null);
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false);
  const [linkPreviewDismissed, setLinkPreviewDismissed] = useState(false);
  const lastFetchedUrl = useRef<string | null>(null);
  const linkPreviewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const urlMatch = value.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/);
    const url = urlMatch?.[0] ?? null;

    if (!url) {
      if (linkPreviewDebounceRef.current) clearTimeout(linkPreviewDebounceRef.current);
      setComposerLinkPreview(null);
      setLinkPreviewDismissed(false);
      lastFetchedUrl.current = null;
      onLinkPreviewChange?.(null);
      return;
    }

    if (url === lastFetchedUrl.current || linkPreviewDismissed) return;

    if (linkPreviewDebounceRef.current) clearTimeout(linkPreviewDebounceRef.current);
    linkPreviewDebounceRef.current = setTimeout(async () => {
      if (url === lastFetchedUrl.current) return;
      lastFetchedUrl.current = url;
      setLinkPreviewLoading(true);
      try {
        const { getRequest } = await import('@/network/get');
        const res = await getRequest(
          `${ROUTES.linkPreview}?url=${encodeURIComponent(url)}`,
          { errorMessage: '' },
        );
        const d = res?.data;
        if (d?.title || d?.description || d?.image) {
          const preview: LinkPreviewData = { ...d, url };
          setComposerLinkPreview(preview);
          onLinkPreviewChange?.(preview);
        }
      } catch { /* silent */ } finally {
        setLinkPreviewLoading(false);
      }
    }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const dismissLinkPreview = () => {
    setComposerLinkPreview(null);
    setLinkPreviewDismissed(true);
    onLinkPreviewChange?.(null);
  };

  const linkPreviewBarVisible = !!(composerLinkPreview || linkPreviewLoading);

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

  /* ----------------------------- LOCATION PICKER -------------------------- */
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

  /* ----------------------------- SCHEDULE SHEET --------------------------- */
  const [scheduleSheetVisible, setScheduleSheetVisible] = useState(false);

  /* ----------------------------- PAYMENT MODAL (GAP 4) -------------------- */
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCurrency, setPaymentCurrency] = useState('USD');
  const [paymentNote, setPaymentNote] = useState('');

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
    useState<'custom' | 'emoji' | 'stickers' | 'gif'>('emoji');

  /* ----------------------------- INLINE GIF STATE ------------------------- */
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<TenorGif[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const gifSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGifs = useCallback(async (q: string) => {
    setGifLoading(true);
    try {
      const results = await searchTenor(q);
      setGifResults(results);
    } catch {
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  }, []);

  const handleGifQueryChange = (text: string) => {
    setGifQuery(text);
    if (gifSearchTimerRef.current) clearTimeout(gifSearchTimerRef.current);
    gifSearchTimerRef.current = setTimeout(() => fetchGifs(text), 400);
  };

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
      if (sendingTimerRef.current) clearTimeout(sendingTimerRef.current);
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

  /* ----------------------------- @MENTION --------------------------------- */
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const mentionedUserIdsRef = useRef<string[]>([]);

  const handleTextChange = (text: string) => {
    onChangeText(text);
    if (!mentionParticipants?.length) return;
    const match = text.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
    } else {
      setMentionQuery(null);
    }
  };

  const mentionSuggestions =
    mentionQuery !== null && mentionParticipants
      ? mentionParticipants.filter((p) =>
          p.name.toLowerCase().startsWith(mentionQuery),
        )
      : [];

  const insertMention = (name: string, userId?: string) => {
    const updated = value.replace(/@\w*$/, `@${name} `);
    onChangeText(updated);
    setMentionQuery(null);
    if (userId && !mentionedUserIdsRef.current.includes(userId)) {
      mentionedUserIdsRef.current = [...mentionedUserIdsRef.current, userId];
    }
  };

  const handleTextSend = () => {
    if (!canSend || disabled || isSending) return;

    const now = Date.now();
    if (lastSendRef.current && now - lastSendRef.current < 400) {
      return;
    }
    lastSendRef.current = now;

    const mentionIds = [...mentionedUserIdsRef.current];
    mentionedUserIdsRef.current = [];

    setIsSending(true);
    onSend();
    // Reset view-once after send
    if (viewOnce) {
      setViewOnce(false);
      onViewOnceChange?.(false);
    }
    // Clear link preview after send
    setComposerLinkPreview(null);
    setLinkPreviewDismissed(false);
    lastFetchedUrl.current = null;
    onLinkPreviewChange?.(null);
    if (sendingTimerRef.current) clearTimeout(sendingTimerRef.current);
    sendingTimerRef.current = setTimeout(() => setIsSending(false), 600);

    if (mentionIds.length > 0) {
      void notifyMentions(mentionIds, {
        sender_name: senderName,
        preview: value.slice(0, 100),
        conversation_id: conversationIdForMentions,
      });
    }
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

  const isVoiceActive = isRecording;
  const showTextSend = canSend && !isRecording;

  /* -------------------------------------------------------------------------- */
  /*                             PANEL CONTENT                                  */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    if (panelTab === 'stickers') {
      loadStickers();
    }
    if (panelTab === 'gif' && gifResults.length === 0) {
      fetchGifs('');
    }
  }, [panelTab, loadStickers, gifResults.length, fetchGifs]);

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

      case 'gif':
        return (
          <View style={{ padding: 10 }}>
            {/* GIF search bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: palette.composerInputBg ?? palette.surface, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 }}>
              <TextInput
                value={gifQuery}
                onChangeText={handleGifQueryChange}
                placeholder="Search GIFs…"
                placeholderTextColor={palette.subtext}
                style={{ flex: 1, color: palette.text, fontSize: 14 }}
                returnKeyType="search"
                onSubmitEditing={() => fetchGifs(gifQuery)}
              />
              {gifQuery.length > 0 && (
                <Pressable onPress={() => { setGifQuery(''); fetchGifs(''); }} hitSlop={8}>
                  <Text style={{ color: palette.subtext, fontSize: 16 }}>✕</Text>
                </Pressable>
              )}
            </View>
            {gifLoading ? (
              <ActivityIndicator color={palette.primary} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={gifResults}
                keyExtractor={(g) => g.id}
                numColumns={2}
                style={{ maxHeight: 220 }}
                contentContainerStyle={{ gap: 6 }}
                columnWrapperStyle={{ gap: 6 }}
                renderItem={({ item }) => {
                  const aspectRatio = item.width > 0 && item.height > 0 ? item.width / item.height : 1;
                  return (
                    <Pressable
                      style={{ flex: 1, aspectRatio, borderRadius: 8, overflow: 'hidden', backgroundColor: palette.surface }}
                      onPress={() => {
                        onSendGif?.({ url: item.url, previewUrl: item.previewUrl, width: item.width, height: item.height });
                        setKeyboardMode(true);
                        textInputRef.current?.focus();
                      }}
                    >
                      <Image source={{ uri: item.previewUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    </Pressable>
                  );
                }}
                ListEmptyComponent={<Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginTop: 16 }}>No GIFs found</Text>}
              />
            )}
            <Text style={{ color: palette.subtext, fontSize: 10, textAlign: 'center', marginTop: 6 }}>Powered by Tenor</Text>
          </View>
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
      { id: 'gif', label: 'GIF' },
    ] as const;

    return (
      <View
        style={{
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderColor: palette.divider,
          paddingHorizontal: responsive.isWatch ? 4 : 8,
          paddingVertical: responsive.isWatch ? 4 : 6,
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
                  fontSize: responsive.labelFontSize,
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
          paddingBottom: bottomInset,
        },
      ]}
    >
      {/* @mention autocomplete dropdown */}
      {mentionSuggestions.length > 0 && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: palette.divider,
            backgroundColor: palette.surface,
            maxHeight: 180,
          }}
        >
          {mentionSuggestions.slice(0, 6).map((p) => (
            <Pressable
              key={p.id}
              onPress={() => insertMention(p.name, p.id)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 10,
                backgroundColor: pressed
                  ? (palette.surfaceSoft ?? palette.surface)
                  : 'transparent',
                borderBottomWidth: 1,
                borderBottomColor: palette.divider,
              })}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: palette.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                }}
              >
                <Text style={{ color: palette.onPrimary, fontWeight: '700', fontSize: 13 }}>
                  {p.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: palette.text, fontWeight: '600' }}>
                @{p.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {renderReplyOrEditBanner()}

      {/* LINK PREVIEW CARD */}
      {(composerLinkPreview || linkPreviewLoading) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            marginHorizontal: 12,
            marginBottom: 6,
            borderRadius: 10,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: palette.divider,
            backgroundColor: palette.surface,
          }}
        >
          {composerLinkPreview?.image ? (
            <Image
              source={{ uri: composerLinkPreview.image }}
              style={{ width: 64, height: 64 }}
              resizeMode="cover"
            />
          ) : null}
          <View style={{ flex: 1, padding: 8, justifyContent: 'center' }}>
            {linkPreviewLoading && !composerLinkPreview ? (
              <ActivityIndicator size="small" color={palette.primary} />
            ) : (
              <>
                {composerLinkPreview?.site_name ? (
                  <Text style={{ fontSize: 10, fontWeight: '700', color: palette.primary, textTransform: 'uppercase', letterSpacing: 0.4 }} numberOfLines={1}>
                    {composerLinkPreview.site_name}
                  </Text>
                ) : null}
                {composerLinkPreview?.title ? (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }} numberOfLines={2}>
                    {composerLinkPreview.title}
                  </Text>
                ) : null}
                {composerLinkPreview?.description ? (
                  <Text style={{ fontSize: 11, color: palette.subtext }} numberOfLines={2}>
                    {composerLinkPreview.description}
                  </Text>
                ) : null}
              </>
            )}
          </View>
          <Pressable
            onPress={dismissLinkPreview}
            hitSlop={8}
            style={{ padding: 8 }}
          >
            <KISIcon name="close" size={16} color={palette.subtext} />
          </Pressable>
        </View>
      )}

      {/* MAIN INPUT ROW */}
      <View style={[styles.composerMainRow, { paddingVertical: responsive.isWatch ? 5 : responsive.isCompactPhone ? 7 : 10 }]}>
        {!isVoiceActive && (
          <>
            <Pressable
              onPress={toggleEmojiKeyboard}
              style={[styles.iconTextButton, { width: composerIconSize, height: composerIconSize, borderRadius: composerIconSize / 2 }]}
            >
              <KISIcon
                name={keyboardMode ? 'smiley' : 'keyboard'}
                size={composerIconGlyph}
                color={palette.subtext}
              />
            </Pressable>

            <View
              style={[
                styles.composerInputWrapper,
                {
                  marginHorizontal: responsive.isWatch ? 2 : 4,
                  paddingHorizontal: responsive.isWatch ? 8 : 12,
                  paddingVertical: responsive.isWatch ? 4 : 6,
                  borderRadius: responsive.isWatch ? 15 : 18,
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
                onChangeText={handleTextChange}
                placeholder={
                  editing
                    ? 'Edit message'
                    : replyTo
                    ? 'Reply...'
                    : 'Message'
                }
                placeholderTextColor={palette.subtext}
                multiline
                style={[styles.composerInput, { color: palette.text, fontSize: responsive.bodyFontSize }]}
              />
            </View>

            {/* "+" → attachment sheet */}
            <Pressable
              style={[styles.iconTextButton, { width: composerIconSize, height: composerIconSize, borderRadius: composerIconSize / 2 }]}
              disabled={!!disabled}
              onPress={openAttachmentMenu}
            >
              <KISIcon
                name="add"
                size={composerIconGlyph}
                color={palette.subtext}
              />
            </Pressable>

            {/* Camera */}
            <Pressable
              style={[styles.iconTextButton, { width: composerIconSize, height: composerIconSize, borderRadius: composerIconSize / 2, display: isTinyDevice && value.trim().length > 0 ? 'none' : 'flex' }]}
              disabled={!!disabled}
              onPress={openCameraModal}
            >
              <KISIcon name="camera" size={composerIconGlyph} color={palette.subtext} />
            </Pressable>

            {/* View-once toggle */}
            <Pressable
              style={[
                styles.iconTextButton,
                {
                  width: composerIconSize,
                  height: composerIconSize,
                  borderRadius: composerIconSize / 2,
                  backgroundColor: viewOnce ? palette.primary : 'transparent',
                  display: isTinyDevice && value.trim().length > 0 ? 'none' : 'flex',
                },
              ]}
              onPress={toggleViewOnce}
            >
              <KISIcon
                name={viewOnce ? 'eye' : 'eye-closed'}
                size={composerIconGlyph}
                color={viewOnce ? palette.onPrimary : palette.subtext}
              />
            </Pressable>

          </>
        )}

        {/* SEND / VOICE */}
        {showTextSend ? (
          <Pressable
            onPress={handleTextSend}
            onLongPress={() => onScheduleSend && setScheduleSheetVisible(true)}
            delayLongPress={400}
            disabled={!canSend || !!disabled || isSending}
            style={[
              styles.composerActionButton,
              {
                backgroundColor:
                  !canSend || disabled
                    ? palette.subtext
                    : palette.primary,
                marginRight: responsive.isWatch ? 4 : 12,
                height: sendButtonSize,
                width: sendButtonSize,
                opacity: !canSend || disabled ? 0.6 : 1,
              },
            ]}
          >
            {isSending ? (
              <ActivityIndicator
                size="small"
                color={palette.onPrimary}
              />
            ) : (
              <KISIcon
                name="send"
                size={responsive.isWatch ? 16 : 18}
                color={palette.onPrimary}
              />
            )}
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
          const res = await onSendAttachment?.({
            ...files,
            onProgress: callbacks?.onProgress,
            onStatus: callbacks?.onStatus as ((uri: string, status: UploadStatus) => void) | undefined,
          });
          return res !== false;
        }}
        onSendContacts={(contacts) => {
          onSendContacts?.(contacts);
        }}
        onCreatePoll={(poll) => {
          onCreatePoll?.(poll);
        }}
        onCreateEvent={(event) => {
          onCreateEvent?.(event);
        }}
        onShareLocation={onSendLocation ? () => setLocationPickerVisible(true) : undefined}
        onSendScannedDocument={onSendScannedDocument}
        onSendPayment={onSendPayment ? () => setPaymentModalVisible(true) : undefined}
      />

      {/* CAMERA FULL-SCREEN MODAL (ONLY source for images/videos) */}
      <CameraCaptureModal
        visible={cameraVisible}
        palette={palette}
        onClose={closeCameraModal}
        onCapture={(files) => {
          onSendAttachment?.(files);
        }}
      />

      {/* LOCATION PICKER */}
      <LocationPickerSheet
        visible={locationPickerVisible}
        onClose={() => setLocationPickerVisible(false)}
        palette={palette}
        onSendLocation={(loc) => {
          onSendLocation?.(loc);
          setLocationPickerVisible(false);
        }}
      />

      {/* SCHEDULE SHEET */}
      <ScheduleMessageSheet
        visible={scheduleSheetVisible}
        onClose={() => setScheduleSheetVisible(false)}
        palette={palette}
        onSchedule={(scheduledAt) => {
          onScheduleSend?.(scheduledAt);
          setScheduleSheetVisible(false);
        }}
      />

      {/* GAP 4: PAYMENT MODAL */}
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', justifyContent: 'flex-end' }}
          onPress={() => setPaymentModalVisible(false)}
        >
          <Pressable
            style={{
              backgroundColor: palette.surface,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: 20,
              paddingBottom: 32,
            }}
            onStartShouldSetResponder={() => true}
          >
            {/* Handle */}
            <View style={{ width: 40, height: 4, borderRadius: 4, backgroundColor: palette.divider, alignSelf: 'center', marginBottom: 14 }} />

            <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text, marginBottom: 16 }}>
              Send payment
            </Text>

            {/* Amount */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: palette.subtext, marginBottom: 6 }}>Amount</Text>
            <TextInput
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={palette.placeholder ?? palette.subtext}
              style={{
                borderWidth: 1,
                borderColor: palette.inputBorder ?? palette.divider,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 16,
                color: palette.text,
                backgroundColor: palette.input ?? palette.surfaceSoft ?? palette.surface,
                marginBottom: 12,
              }}
            />

            {/* Currency */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: palette.subtext, marginBottom: 6 }}>Currency</Text>
            <TextInput
              value={paymentCurrency}
              onChangeText={(v) => setPaymentCurrency(v.toUpperCase().slice(0, 3))}
              placeholder="USD"
              placeholderTextColor={palette.placeholder ?? palette.subtext}
              autoCapitalize="characters"
              maxLength={3}
              style={{
                borderWidth: 1,
                borderColor: palette.inputBorder ?? palette.divider,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 16,
                color: palette.text,
                backgroundColor: palette.input ?? palette.surfaceSoft ?? palette.surface,
                marginBottom: 12,
              }}
            />

            {/* Note */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: palette.subtext, marginBottom: 6 }}>Note (optional)</Text>
            <TextInput
              value={paymentNote}
              onChangeText={setPaymentNote}
              placeholder="What's this for?"
              placeholderTextColor={palette.placeholder ?? palette.subtext}
              style={{
                borderWidth: 1,
                borderColor: palette.inputBorder ?? palette.divider,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 15,
                color: palette.text,
                backgroundColor: palette.input ?? palette.surfaceSoft ?? palette.surface,
                marginBottom: 20,
              }}
            />

            <Pressable
              onPress={() => {
                const amount = parseFloat(paymentAmount.replace(',', '.'));
                if (isNaN(amount) || amount <= 0) {
                  Alert.alert('Invalid amount', 'Please enter a valid positive amount.');
                  return;
                }
                if (!paymentCurrency.trim()) {
                  Alert.alert('Currency required', 'Please enter a currency code.');
                  return;
                }
                onSendPayment?.({
                  amount,
                  currency: paymentCurrency.trim().toUpperCase(),
                  note: paymentNote.trim() || undefined,
                });
                setPaymentAmount('');
                setPaymentCurrency('USD');
                setPaymentNote('');
                setPaymentModalVisible(false);
              }}
              style={({ pressed }) => ({
                backgroundColor: palette.primary,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={{ color: palette.onPrimary, fontSize: 15, fontWeight: '700' }}>
                Send payment
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};
