// src/screens/broadcast/channels/components/LiveChatPanel.tsx
//
// Live-chat message list + composer, mounted inside LiveWatchPage.tsx's
// own integrated Chat/Polls/Q&A tab row (not a standalone floating
// overlay any more - see `container`'s own comment below). Messages
// arrive via useLiveStream (socket).
//
// Deliberately a plain ScrollView + .map() rather than a FlatList: this
// panel is nested inside LiveWatchPage's own page-level vertical
// ScrollView (`belowPlayer`), and a FlatList there is a VirtualizedList
// nested inside a plain ScrollView of the same orientation - caught live,
// not just in React Native's own documented warning about this exact
// nesting: the FlatList rendered with items in `messages` but no visible
// cells, so every message a viewer sent still counted up the badge (plain
// array length, unaffected) while the list itself stayed empty. A bounded,
// small chat panel like this one (capped at a few hundred pixels tall,
// not a primary full-screen feed) never needed virtualization's windowing
// in the first place.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import type { LiveChatMessage } from '../hooks/useLiveStream';
import { EmojiPicker } from '@/Module/ChatRoom/componets/EmojiPicker';
import { HoldToLockComposer } from '@/Module/ChatRoom/componets/HoldToLockComposer';
import {
  fetchStickerLibraryPage,
  resolveStickerImageUrl,
  type StickerLibraryEntry,
} from '@/Module/ChatRoom/componets/main/FroSticker/stickerLibrary';
import { uploadLiveChatVoiceNote } from '@/services/uploadLiveChatVoiceNote';
import { useVoiceMessagePlayer } from '@/contexts/VoiceMessagePlayerContext';

// Same two assets, same dark/light choice, as the real chat rooms
// (Module/ChatRoom/ChatRoomPage.tsx's DARK_CHAT_BACKGROUND/
// LIGHT_CHAT_BACKGROUND) - this panel should feel like the same chat
// surface the rest of the app already has, not a visually distinct
// one-off.
const DARK_CHAT_BACKGROUND = require('../../../../assets/dark_chat_background.png');
const LIGHT_CHAT_BACKGROUND = require('../../../../assets/light_chat_background.png');

type Props = {
  messages:        LiveChatMessage[];
  onSend:          (text: string) => Promise<void>;
  // Reuses the exact same sticker system and upload-intent pipeline the
  // real chat rooms use (apps.chat.Sticker - zero-ACL-between-conversations
  // by design, so any authenticated user sending any existing sticker is
  // already the correct, existing access model) and the generic
  // confirm-only media-upload pipeline for voice notes (live_chat_voice_note
  // context) - never a new mechanism invented for this panel specifically.
  onSendSticker?:  (stickerId: string) => Promise<void>;
  onSendVoiceNote?: (mediaId: string, durationSeconds: number) => Promise<void>;
  // Display-only, for the shared voice-note player's badge/bookkeeping -
  // see VoiceNoteBubble's own comment.
  streamTitle?:    string;
  palette:         any;
  isDark?:         boolean;
  disabled?:       boolean;   // true when stream is not live
  // Chat moderation (D4/D5 parity batch) - canModerate gates the Delete
  // action in the long-press sheet; Report is always offered. Both are
  // optional so existing call sites that haven't wired them up yet degrade
  // to long-press doing nothing, rather than crashing.
  canModerate?:    boolean;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onReportMessage?: (messageId: string) => Promise<void>;
  onPinMessage?:   (messageId: string, isPinned: boolean) => Promise<void>;
};

type PanelTab = 'emoji' | 'sticker' | null;

// Lazily resolves a sticker message's display image via the exact same
// signed-url flow (and in-memory cache) the real chat module's own
// StickerTile uses - a sticker message only ever carries stickerAssetId,
// never a baked URL (see useLiveStream.ts's LiveChatMessage comment for
// why: private bucket, real access-control chokepoint, ~1h presigned
// expiry).
function StickerBubbleImage({ assetId, size = 120 }: { assetId: string; size?: number }) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setUri(null);
    setFailed(false);
    resolveStickerImageUrl(assetId)
      .then(resolved => { if (!cancelled) setUri(resolved); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [assetId]);
  // Explicit pixel size, not '100%' - this renders both inside a
  // fixed-size sticker-picker tile AND directly in the message list with
  // no sized wrapper around it; a percentage size only resolves against
  // the latter's parent, which has no explicit dimensions of its own.
  if (failed) return <KISIcon name="image" size={28} color="#999" />;
  if (!uri) return <ActivityIndicator size="small" color="#999" />;
  return <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="contain" />;
}

// Inline play/pause + elapsed-time control for a voice-note bubble, via
// the same app-wide single-active-note player every other voice note in
// the app uses (src/contexts/VoiceMessagePlayerContext.tsx) - not a
// separate ad-hoc <Video> instance per bubble. conversationId/Title here
// are purely this shared player's own display/dedup bookkeeping, not a
// link to the real messaging/conversation system (this chat is
// deliberately NOT connected to that) - a live-stream id and title are
// all it needs.
function VoiceNoteBubble({
  message,
  isMine,
  textColor,
  streamTitle,
}: {
  message: LiveChatMessage;
  isMine: boolean;
  textColor: string;
  streamTitle: string;
}) {
  const player = useVoiceMessagePlayer();
  const active = player.isActive(message.id);
  const playing = active && player.playing;
  const totalMs = active && player.durationMs > 0
    ? player.durationMs
    : (message.durationSeconds ?? 0) * 1000;
  const positionMs = active ? player.positionMs : 0;
  const fmt = (ms: number) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  return (
    <Pressable
      style={styles.voiceRow}
      onPress={() => {
        if (!message.assetUrl) return;
        if (active) {
          player.togglePlay();
          return;
        }
        player.play({
          messageId: message.id,
          conversationId: `live-chat:${message.id}`,
          conversationTitle: streamTitle,
          senderName: message.displayName,
          source: { uri: message.assetUrl },
          initialDurationMs: (message.durationSeconds ?? 0) * 1000,
        });
      }}
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Pause voice note' : 'Play voice note'}
    >
      <KISIcon name={playing ? 'pause' : 'play'} size={18} color={textColor} />
      <Text style={[styles.voiceTime, { color: textColor }]}>
        {fmt(active ? positionMs : 0)} / {fmt(totalMs)}
      </Text>
    </Pressable>
  );
}

export default function LiveChatPanel({
  messages,
  onSend,
  onSendSticker,
  onSendVoiceNote,
  streamTitle = 'Live chat',
  palette,
  isDark = false,
  disabled = false,
  canModerate = false,
  onDeleteMessage,
  onReportMessage,
  onPinMessage,
}: Props) {
  const [draft,    setDraft]    = useState('');
  const [sending,  setSending]  = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>(null);
  const [stickerEntries, setStickerEntries] = useState<StickerLibraryEntry[]>([]);
  const [stickerLoading, setStickerLoading] = useState(false);
  const [sendingStickerId, setSendingStickerId] = useState<string | null>(null);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const listRef = useRef<ScrollView>(null);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  // Loads once, the first time the sticker tab is actually opened - not
  // on mount, since most viewers will never open it in a given session.
  useEffect(() => {
    if (panelTab !== 'sticker' || stickerEntries.length > 0 || stickerLoading) return;
    let cancelled = false;
    setStickerLoading(true);
    fetchStickerLibraryPage('all', 1)
      .then(res => { if (!cancelled) setStickerEntries(res.entries); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setStickerLoading(false); });
    return () => { cancelled = true; };
  }, [panelTab, stickerEntries.length, stickerLoading]);

  const handleSelectSticker = useCallback(async (entry: StickerLibraryEntry) => {
    if (!onSendSticker || sendingStickerId) return;
    setSendingStickerId(entry.sticker.id);
    try {
      await onSendSticker(entry.sticker.id);
      setPanelTab(null);
    } catch {
      Alert.alert('Sticker not sent', 'Could not send this sticker. Please try again.');
    } finally {
      setSendingStickerId(null);
    }
  }, [onSendSticker, sendingStickerId]);

  const handleSendVoiceNote = useCallback(async (payload: { uri: string; durationMs: number }) => {
    if (!onSendVoiceNote || uploadingVoice) return;
    setUploadingVoice(true);
    try {
      const { mediaId, durationSeconds } = await uploadLiveChatVoiceNote(payload);
      await onSendVoiceNote(mediaId, durationSeconds);
    } catch {
      Alert.alert('Voice note not sent', 'Could not send your voice note. Please try again.');
    } finally {
      setUploadingVoice(false);
    }
  }, [onSendVoiceNote, uploadingVoice]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending || disabled) return;
    setDraft('');
    setSending(true);
    try {
      await onSend(text);
    } catch {
      // Restore the draft so a failed send doesn't just silently vanish —
      // onSend (useLiveStream's sendChatMessage) removes its optimistic
      // bubble on failure, so without this the user would have no sign
      // their message never went out and no easy way to retry it.
      setDraft(text);
      Alert.alert('Message not sent', 'Could not send your message. Please try again.');
    } finally {
      setSending(false);
    }
  }, [draft, sending, disabled, onSend]);

  const handleLongPressMessage = useCallback((item: LiveChatMessage) => {
    if (!onDeleteMessage && !onReportMessage && !onPinMessage) return;
    const options: Array<{ text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }> = [];
    if (canModerate && onPinMessage) {
      const nextPinned = !item.is_pinned;
      options.push({
        text: item.is_pinned ? 'Unpin message' : 'Pin message',
        onPress: () => {
          onPinMessage(item.id, nextPinned).catch(() =>
            Alert.alert('Unable to update pin', 'Could not update the pinned message. Please try again.'),
          );
        },
      });
    }
    if (canModerate && onDeleteMessage) {
      options.push({
        text: 'Delete message',
        style: 'destructive',
        onPress: () => {
          onDeleteMessage(item.id).catch(() =>
            Alert.alert('Unable to delete', 'Could not delete this message. Please try again.'),
          );
        },
      });
    }
    if (onReportMessage) {
      options.push({
        text: 'Report message',
        onPress: () => {
          onReportMessage(item.id)
            .then(() => Alert.alert('Reported', 'Thanks — our team will review this message.'))
            .catch(() => Alert.alert('Unable to report', 'Could not report this message. Please try again.'));
        },
      });
    }
    if (!options.length) return;
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Message options', undefined, options);
  }, [canModerate, onDeleteMessage, onReportMessage, onPinMessage]);

  // Matches Module/ChatRoom/componets/MessageBubble.tsx's own convention
  // exactly (outgoingBubble/incomingBubble are the dedicated theme-aware
  // chat tokens - see theme/constants.ts) rather than inventing a second
  // one here. outgoingBubble/primary vary enough between light and dark
  // that a single static text color isn't safe on top of them (unlike
  // incomingBubble, which the palette already guarantees contrasts with
  // `text`) - same luminance check the real chat module uses.
  const outgoingBubbleColor = palette.outgoingBubble ?? palette.primary;
  const outgoingTextColor = (() => {
    const hex = String(outgoingBubbleColor || '').replace('#', '');
    if (hex.length !== 6) return '#ffffff';
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 160 ? '#111111' : '#ffffff';
  })();

  const renderItem = useCallback(({ item }: { item: LiveChatMessage }) => {
    const isSticker = item.messageType === 'sticker' && item.stickerAssetId;
    const isVoice = item.messageType === 'voice_note';
    const nameRow = !item.isMine && (
      <View style={styles.msgNameRow}>
        <Text style={[styles.msgName, { color: palette.primaryStrong }]}>
          {item.displayName}
        </Text>
        {item.is_member && (
          <View style={[styles.memberBadge, { backgroundColor: palette.gold }]}>
            <Text style={[styles.memberBadgeText, { color: palette.royalInk }]}>MEMBER</Text>
          </View>
        )}
      </View>
    );

    // Stickers render with no bubble background - matches
    // Module/ChatRoom/componets/MessageBubble.tsx's own sticker treatment
    // (just a sized image, no chat-bubble chrome around it).
    if (isSticker) {
      return (
        <Pressable
          style={[styles.msgRow, item.isMine && styles.msgRowMine]}
          onLongPress={() => handleLongPressMessage(item)}
          delayLongPress={350}
        >
          {nameRow}
          <StickerBubbleImage assetId={item.stickerAssetId!} />
        </Pressable>
      );
    }

    return (
      <Pressable
        style={[styles.msgRow, item.isMine && styles.msgRowMine]}
        onLongPress={() => handleLongPressMessage(item)}
        delayLongPress={350}
      >
        <View style={[
          styles.bubble,
          item.isMine
            ? [styles.bubbleMine, { backgroundColor: outgoingBubbleColor }]
            : [styles.bubbleOther, { backgroundColor: palette.incomingBubble ?? palette.surface ?? palette.card }],
        ]}>
          {nameRow}
          {isVoice ? (
            <VoiceNoteBubble
              message={item}
              isMine={Boolean(item.isMine)}
              textColor={item.isMine ? outgoingTextColor : palette.text}
              streamTitle={streamTitle}
            />
          ) : (
            <Text style={[styles.msgText, { color: item.isMine ? outgoingTextColor : palette.text }]}>{item.text}</Text>
          )}
        </View>
      </Pressable>
    );
  }, [outgoingBubbleColor, outgoingTextColor, palette.incomingBubble, palette.surface, palette.card, palette.primaryStrong, palette.gold, palette.royalInk, palette.text, handleLongPressMessage, streamTitle]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <ImageBackground
        source={isDark ? DARK_CHAT_BACKGROUND : LIGHT_CHAT_BACKGROUND}
        resizeMode="cover"
        style={styles.panel}
        imageStyle={styles.wallpaperImage}
      >
        {/* Message list - plain ScrollView, not FlatList; see this file's
            top-of-file comment for why a VirtualizedList doesn't work
            nested in the page's own outer ScrollView. Swapped out for the
            emoji/sticker picker in place (not an overlay on top of it)
            when one is open - only one of these is ever mounted, which is
            also what keeps EmojiPicker's own internal SectionList from
            ever being nested inside this component's own ScrollView. */}
        {panelTab === 'emoji' ? (
          <EmojiPicker palette={palette} onSelectEmoji={(emoji) => setDraft(d => d + emoji)} />
        ) : panelTab === 'sticker' ? (
          <ScrollView style={styles.list} contentContainerStyle={styles.stickerGrid}>
            {stickerLoading && stickerEntries.length === 0 ? (
              <ActivityIndicator color={palette.primaryStrong} style={{ marginTop: 16 }} />
            ) : stickerEntries.length === 0 ? (
              <Text style={{ color: palette.subtext, fontSize: 13, padding: 12 }}>
                No stickers available yet.
              </Text>
            ) : (
              stickerEntries.map(entry => (
                <Pressable
                  key={entry.id}
                  onPress={() => handleSelectSticker(entry)}
                  disabled={!!sendingStickerId}
                  style={[styles.stickerTile, { backgroundColor: palette.surface }]}
                  accessibilityRole="button"
                  accessibilityLabel={entry.sticker.captionText || 'Sticker'}
                >
                  {sendingStickerId === entry.sticker.id ? (
                    <ActivityIndicator size="small" color={palette.primaryStrong} />
                  ) : (
                    <StickerBubbleImage assetId={entry.sticker.assetId} size={64} />
                  )}
                </Pressable>
              ))
            )}
          </ScrollView>
        ) : (
          <ScrollView
            ref={listRef}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
          >
            {messages.length === 0 ? (
              // Deliberately NOT flex: 1 - the whole interaction panel is
              // now content-driven (grows from near-zero as real content
              // arrives, caps and scrolls past that point - see
              // LiveWatchPage's interactionPanelBody comment), so this
              // placeholder needs its own modest, natural height rather
              // than stretching to fill an otherwise-undetermined parent
              // size, which is exactly the circular case flex: 1 would
              // create here.
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 20 }}>
                <Text style={{ color: palette.subtext, fontSize: 14, textAlign: 'center' }}>
                  No messages yet
                </Text>
              </View>
            ) : (
              messages.map((item, index) => (
                <React.Fragment key={item.id}>
                  {index > 0 && (
                    <View style={[styles.separator, { backgroundColor: palette.divider ?? palette.border }]} />
                  )}
                  {renderItem({ item })}
                </React.Fragment>
              ))
            )}
          </ScrollView>
        )}

        {/* Input row */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.inputRow, { backgroundColor: palette.card ?? palette.surface }]}>
            {!isRecordingVoice && (
              <>
                <Pressable
                  onPress={() => setPanelTab(t => t === 'emoji' ? null : 'emoji')}
                  disabled={disabled}
                  style={styles.panelToggleBtn}
                  accessibilityRole="button"
                  accessibilityLabel={panelTab === 'emoji' ? 'Hide emoji picker' : 'Show emoji picker'}
                >
                  <KISIcon name="smiley" size={20} color={panelTab === 'emoji' ? palette.primaryStrong : palette.subtext} />
                </Pressable>
                {onSendSticker && (
                  <Pressable
                    onPress={() => setPanelTab(t => t === 'sticker' ? null : 'sticker')}
                    disabled={disabled}
                    style={styles.panelToggleBtn}
                    accessibilityRole="button"
                    accessibilityLabel={panelTab === 'sticker' ? 'Hide stickers' : 'Show stickers'}
                  >
                    <KISIcon name="image" size={20} color={panelTab === 'sticker' ? palette.primaryStrong : palette.subtext} />
                  </Pressable>
                )}
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={disabled ? 'Live chat unavailable' : 'Say something…'}
                  placeholderTextColor={palette.subtext}
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.composerInputBg ?? palette.inputBg,
                      borderColor: palette.composerInputBorder ?? palette.divider,
                      color: palette.text,
                    },
                  ]}
                  editable={!disabled && !sending}
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                  blurOnSubmit={false}
                  maxLength={300}
                />
              </>
            )}

            {draft.trim() && !isRecordingVoice ? (
              <Pressable
                onPress={handleSend}
                disabled={sending || disabled}
                style={[styles.sendBtn, { backgroundColor: palette.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Send message"
              >
                <KISIcon name="send" size={16} color={palette.onPrimary ?? '#fff'} />
              </Pressable>
            ) : onSendVoiceNote ? (
              // Always mounted (never conditionally unmounted) so an
              // active recording never gets torn down mid-record just
              // because the rest of this row re-renders - only the row
              // AROUND it hides/shows (above), giving its own recording
              // banner/waveform the full row width to expand into.
              <View style={isRecordingVoice ? styles.voiceComposerExpanded : undefined}>
                <HoldToLockComposer
                  palette={palette}
                  disabled={disabled || uploadingVoice}
                  onSendVoice={handleSendVoiceNote}
                  setIsRecording={setIsRecordingVoice}
                />
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Was position: 'absolute', bottom: 0, right: 0, width: 220 - its own
    // independent screen-relative positioning, completely detached from
    // its parent's layout (LiveWatchPage.tsx's bottomPanelWrap, which has
    // its own Chat/Polls/Q&A tab row stacked above where this renders).
    // Since this escaped the parent's normal flow, the parent's own
    // height collapsed down to just its tab row, and this panel's
    // independent "bottom: 0" pinned it to the exact same screen-bottom
    // corner as that tab row - the two overlapped directly instead of
    // stacking, visually crushing the tabs, message list, and input into
    // one cramped cluster. Flowing in the parent's own stack (which
    // already sizes/positions the whole column, including safe-area
    // clearance) fixes that; width matches the parent's own dynamic
    // chatPanelWidth via '100%' instead of a second, slightly different
    // hardcoded value.
    //
    // No flex/height here on purpose - LiveWatchPage's interactionPanelBody
    // (this View's parent) is a maxHeight: 440 box, not a fixed-height
    // one, specifically so the WHOLE interaction panel grows with real
    // content (messages/polls/questions) instead of always claiming a
    // fixed block of screen. flex: 1 would be wrong here - its
    // flex-basis: 0 default means "ignore your own content size, wait to
    // be told a size by the parent," which breaks exactly backwards
    // against a parent that's sizing itself FROM this child's content.
    // Plain content-based sizing (the default) is what lets this start
    // small and grow; `list` below is what actually caps and scrolls once
    // content exceeds the 440 ceiling.
    width: '100%',
  },
  panel: { overflow: 'hidden' },
  // Matches Module/ChatRoom/chatRoomStyles.ts's chatWallpaperImage exactly
  // (0.96 opacity) - same subtle wallpaper treatment, not a one-off.
  wallpaperImage: { opacity: 0.96 },
  // flexShrink: 1, not flex: 1 - this is the one place in the chain that
  // actually needs to give up space once the ancestor's maxHeight: 440
  // kicks in (that's what makes it scroll internally past that point),
  // while still reporting its own natural content height below the cap
  // (so the panel can grow from near-zero and the input row below never
  // floats above dead space). The input row itself has no flexShrink -
  // it should never be the thing that gives up height.
  list: { flexShrink: 1 },
  listContent: { paddingHorizontal: 8, paddingVertical: 4, flexGrow: 1, justifyContent: 'flex-end' },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
    marginHorizontal: 4,
  },
  msgRow: {
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  msgRowMine: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '88%',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bubbleOther: { borderBottomLeftRadius: 4 },
  bubbleMine:  { borderBottomRightRadius: 4 },
  msgNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  msgName: { fontSize: 10, fontWeight: '700' },
  memberBadge: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  memberBadgeText: { fontSize: 7, fontWeight: '900' },
  msgText: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  input: {
    flex: 1,
    height: 34,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 12,
    paddingVertical: 0,
    fontSize: 12,
    // Android defaults a TextInput's text/placeholder to the top of its
    // box rather than centering it vertically (iOS already centers by
    // default) - this is what made the placeholder look stuck to the top
    // instead of sitting centered in the 34px-tall pill.
    textAlignVertical: 'center',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelToggleBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  stickerTile: {
    width: 72,
    height: 72,
    margin: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 90,
  },
  voiceTime: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  // HoldToLockComposer's own recording banner needs the full row width to
  // show its waveform/timer - this only applies while isRecordingVoice is
  // true, at which point the rest of the row (text input, toggle buttons,
  // send button) is hidden above, so there's nothing else competing for
  // the space anyway.
  voiceComposerExpanded: {
    flex: 1,
  },
});
