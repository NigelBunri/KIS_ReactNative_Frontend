import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, Dimensions, Modal, Linking, Platform, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import Video, { type VideoRef } from 'react-native-video';
import RNFS from 'react-native-fs';

import { chatRoomStyles as styles } from '../chatRoomStyles';

import Pdf from 'react-native-pdf';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { KISIcon } from '@/constants/kisIcons';
import { ChatMessage } from '../chatTypes';
import { EmojiPicker } from './EmojiPicker';
import { useResponsiveLayout } from '@/theme/responsive';
import { useLanguage, useTranslation } from '@/languages';
import { getAccessToken } from '@/security/authStorage';
import { buildChatMediaPath, fileUriForPath, sanitizeChatMediaFileName, stripFileScheme } from '../chatMediaStorage';
import { normalizeChatDisplayText } from '../safeChatText';
import { API_BASE_URL, NEST_API_BASE_URL, resolveBackendAssetUrl } from '@/network';
import { AttachmentDownloadError, requestAttachmentDownloadUrl } from '../attachmentDownload';
import { classifyVoicePlaybackReadiness, resolveEmbeddedVoicePlaybackUri } from '../voiceAttachment';
import { cachedVoicePlaybackUrl, describeVoicePlaybackError, resolveFreshVoicePlaybackUrl } from '../voicePlaybackResolver';
import { ViewOnceViewerModal, type ViewOnceContentSnapshot } from './ViewOnceViewerModal';
import {
  BIBLE_REFERENCE_RE,
  BIBLE_QUOTE_BLOCK_RE,
  parseBibleReference,
  parseBibleQuoteBlock,
  type ParsedBibleReference,
} from '@/utils/bibleReference';
import { openBibleVerse } from '@/utils/bibleVerseOpenBridge';

const CHAT_VOICE_PLAYBACK_EVENT = 'chat.voice.playback.started';

/**
 * Shape coming from the backend, e.g.
 * {
 *   id: "693731200ae7...",
 *   createdAt: "2025-12-08T20:12:16.547Z",
 *   roomId: "...",
 *   senderId: "...",
 *   fromMe: true,
 *   kind: "text",
 *   status: "sent",
 *   text: "Hello John",
 *   replyToId: null
 * }
 */
type ServerMessageLike = {
  id: string;
  createdAt: string | number | Date;
  roomId?: string;
  senderId?: string;
  onUpdateMessage?: (message: ChatMessage) => void;
  fromMe: boolean;
  kind?: string;
  status?: ChatMessage['status'] | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'pending' | 'local_only';
  text?: string | null;
  replyToId?: string | null;
  // allow extra fields without complaining
  [key: string]: any;
};

/**
 * Attachment metadata shape – this should match what comes from the backend.
 * Even if ChatMessage doesn't declare it explicitly, we'll treat
 * `message.attachments` as `AttachmentMeta[]` structurally.
 */
type AttachmentKind = 'image' | 'video' | 'audio' | 'document' | 'other';

type AttachmentMeta = {
  id: string;
  url: string;
  originalName: string;
  mimeType?: string; // ← made optional, be defensive
  size?: number;
  kind?: AttachmentKind;
  width?: number;
  height?: number;
  durationMs?: number;
  downloadUrl?: string;
  displayUrl?: string;
  publicUrl?: string;
  assetId?: string;
  mediaAssetId?: string;
  mediaAssetRef?: string;
  localUri?: string;
  localPath?: string;
};

/**
 * Old backend attachment wrapper:
 * {
 *   attachment: { id, url, name, mime, size }
 * }
 */
type LegacyAttachmentWrapper = {
  attachment: {
    id?: string | number;
    url?: string;
    uri?: string;
    mimeType?: string;
    contentType?: string;
    mime?: string;
    name?: string;
    filename?: string;
    sizeBytes?: number;
    size?: number;
  };
  id?: string | number;
};


/**
 * New flat AttachmentMeta we send/receive when using uploadFileToBackend.
 */
type FlatAttachmentMeta = {
  id?: string | number;
  url?: string;
  uri?: string;
  displayUrl?: string;
  downloadUrl?: string;
  publicUrl?: string;
  mimeType?: string;
  mimetype?: string;
  contentType?: string;
  mime?: string;
  name?: string;
  originalName?: string;
  filename?: string;
  sizeBytes?: number;
  size?: number;
  localUri?: string;
  localPath?: string;
};

type NormalizedAttachment = {
  key: string;
  // The server-issued stable attachment id, only set when it's genuinely
  // trustworthy (i.e. not a synthesized fallback like the uri or a bare
  // array index). Downloads must be requested by this id, never a url/key
  // the client happens to be holding.
  attachmentId?: string;
  uri: string;
  mime?: string;
  name?: string;
  filename?: string;
  size?: number;
  localUri?: string;
  localPath?: string;
  expired?: boolean;
  quarantined?: boolean;
  scanStatus?: string;
  viewOnce?: boolean;
  viewedAt?: string;
};

type MessageBubbleProps = {
  // ✅ Accept both your internal ChatMessage and direct server messages
  message: ChatMessage | ServerMessageLike;
  palette: any;
  currentUserId?: string;
  onReact?: (message: ChatMessage, emoji: string) => void;
  onVotePoll?: (messageId: string, optionId: string) => void;
  onRetry?: (message: ChatMessage) => void;

  // reply preview
  replySource?: ChatMessage;
  onPressReplySource?: () => void;

  // highlight when scrolled-to from reply
  isHighlighted?: boolean;

  // selection visual
  isSelected?: boolean;

  // group bubble context
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;

  // star / read-receipts handlers
  onStar?: (message: ChatMessage) => void;
  onShowReadReceipts?: (message: ChatMessage) => void;
  onViewOnce?: (messageId: string) => void;

  mentionMap?: Record<string, string>;
  participantMap?: Record<string, string>;
  participantAvatarMap?: Record<string, string>;
  senderId?: string;
  onUpdateMessage?: (message: ChatMessage) => void;
};

const formatTimeFromMs = (ms: number) => {
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return `${mm}:${ss}`;
};

const renderStatusIcon = (
  status?: ChatMessage['status'] | string,
  color?: string,
  size: number = 13,
) => {
  if (!status) return null;
  if (status === 'local_only' || status === 'pending' || status === 'sending') {
    return <Ionicons name="time-outline" size={size} color={color ?? '#aaa'} />;
  }
  if (status === 'sent') {
    return <Ionicons name="checkmark" size={size} color={color ?? '#aaa'} />;
  }
  if (status === 'delivered') {
    return <Ionicons name="checkmark-done-outline" size={size} color={color ?? '#aaa'} />;
  }
  if (status === 'read') {
    return <Ionicons name="checkmark-done" size={size} color={color ?? '#34B7F1'} />;
  }
  if (status === 'failed') {
    return <Ionicons name="alert-circle" size={size} color="#DC2626" />;
  }
  return null;
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  palette,
  currentUserId,
  onReact,
  onVotePoll,
  onRetry,
  replySource,
  onPressReplySource,
  isHighlighted,
  isSelected = false,
  isFirstInGroup = true,
  isLastInGroup = true,
  onStar: _onStar,
  onShowReadReceipts,
  onViewOnce,
  mentionMap,
  participantMap,
  participantAvatarMap,
  senderId,
  onUpdateMessage,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // ── Auto-download preference ──────────────────────────────────────────────
  const [autoLoadImages, setAutoLoadImages] = React.useState(true);
  const [tappedImageIds, setTappedImageIds] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const pref = await AsyncStorage.getItem('KIS_AUTODL_IMAGES');
        if (cancelled) return;
        if (pref === 'never') { setAutoLoadImages(false); return; }
        if (pref === 'always') { setAutoLoadImages(true); return; }
        // 'wifi' (default): check connection type
        const NetInfo = require('@react-native-community/netinfo')?.default ?? require('@react-native-community/netinfo');
        const state = await NetInfo.fetch().catch(() => null);
        if (cancelled) return;
        setAutoLoadImages(state?.type === 'wifi' || state?.type === 'ethernet');
      } catch { /* graceful — default to showing images */ }
    };
    void check();
    return () => { cancelled = true; };
  }, []);

  // ─────────────────────────────────────
  // 🔁 Normalize fields so both shapes work
  // ─────────────────────────────────────
  const rawCreatedAt = (message as any).createdAt;
  const date =
    rawCreatedAt instanceof Date
      ? rawCreatedAt
      : new Date(rawCreatedAt ?? Date.now());

  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isMe = (message as any).fromMe ?? false;
  const status = (message as any).status as
    | ChatMessage['status']
    | string
    | undefined;

  // text can be undefined or empty string from the server. Final display
  // text is derived after attachments so encrypted media-only placeholders can
  // be suppressed without hiding real captions.
  const rawText: string = normalizeChatDisplayText((message as any).text);

  const voice = (message as any).voice;
  const styled = (message as any).styledText;
  const sticker = (message as any).sticker;
  const contacts = (message as any).contacts as
    | { name: string; phone: string }[]
    | undefined;
  const poll = (message as any).poll as
    | {
        question: string;
        options: { id: string; text: string; votes?: number }[];
        allowMultiple?: boolean;
        expiresAt?: string | null;
      }
    | undefined;
  const eventData = (message as any).event as
    | {
        title: string;
        description?: string;
        location?: string;
        startsAt: string;
        endsAt?: string;
      }
    | undefined;

  const senderName = (message as any).senderName as string | undefined;
  const isPinned = !!(message as any).isPinned;
  const isDeleted = !!(message as any).isDeleted;
  const reactions = (message as any).reactions as
    | Record<string, string[]>
    | undefined;

  // ---------------------------------------------------------------------------
  // Attachments: be SUPER defensive about shape
  // ---------------------------------------------------------------------------
  const rawAttachments = ((message as any).attachments ?? []) as any[];

  const isLocalAttachmentUrl = (url: string) =>
    /^(file|ph|assets-library|content):/i.test(url);

  const dedupeAttachments = (items: AttachmentMeta[]): AttachmentMeta[] => {
    const byKey = new Map<string, AttachmentMeta>();
    const orderedKeys: string[] = [];

    const keyFor = (att: AttachmentMeta) => {
      const assetKey = att.mediaAssetId ?? att.assetId ?? att.mediaAssetRef;
      if (assetKey) return `asset:${assetKey}`;
      const url = String(att.displayUrl ?? att.url ?? att.downloadUrl ?? att.publicUrl ?? '').trim();
      if (url && !isLocalAttachmentUrl(url)) return `remote:${url}`;
      const name = (att.originalName || '').trim().toLowerCase();
      const mime = (att.mimeType || '').trim().toLowerCase();
      const size = typeof att.size === 'number' ? att.size : '';
      if (name || mime || size) return `file:${name}:${mime}:${size}`;
      return `id:${att.id}`;
    };

    for (const att of items) {
      const key = keyFor(att);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, att);
        orderedKeys.push(key);
        continue;
      }
      const existingIsLocal = isLocalAttachmentUrl(existing.url);
      const nextIsLocal = isLocalAttachmentUrl(att.url);
      if (existingIsLocal && !nextIsLocal) {
        byKey.set(key, att);
      }
    }

    const deduped = orderedKeys.map((key) => byKey.get(key)).filter(Boolean) as AttachmentMeta[];
    const hasRemoteMedia = deduped.some((att) => {
      const mime = att.mimeType ?? '';
      const kind = att.kind;
      return !isLocalAttachmentUrl(att.url) && (kind === 'image' || kind === 'video' || mime.startsWith('image/') || mime.startsWith('video/'));
    });
    if (!hasRemoteMedia) return deduped;

    return deduped.filter((att) => {
      const mime = att.mimeType ?? '';
      const kind = att.kind;
      const isMedia = kind === 'image' || kind === 'video' || mime.startsWith('image/') || mime.startsWith('video/');
      return !(isMedia && isLocalAttachmentUrl(att.url));
    });
  };

  const attachments: AttachmentMeta[] = dedupeAttachments(rawAttachments
    .filter((att) => att && typeof att === 'object')
    .map((att, index): AttachmentMeta => {
      const id =
        typeof att.id === 'string'
          ? att.id
          : `att-${index}-${(message as any).id ?? 'local'}`;
      const url: string =
        typeof att.displayUrl === 'string'
          ? att.displayUrl
          : typeof att.url === 'string'
          ? att.url
          : typeof att.downloadUrl === 'string'
          ? att.downloadUrl
          : typeof att.publicUrl === 'string'
          ? att.publicUrl
          : typeof att.uri === 'string'
          ? att.uri
          : typeof att.path === 'string'
          ? att.path
          : '';

      const originalName: string =
        typeof att.originalName === 'string'
          ? att.originalName
          : typeof att.name === 'string'
          ? att.name
          : 'file';

      const mimeType: string | undefined =
        typeof att.mimeType === 'string'
          ? att.mimeType
          : typeof att.mimetype === 'string'
          ? att.mimetype
          : typeof att.mime === 'string'
          ? att.mime
          : typeof att.contentType === 'string'
          ? att.contentType
          : undefined;

      const kind: AttachmentKind | undefined =
        typeof att.kind === 'string' ? (att.kind as AttachmentKind) : undefined;

      return {
        id,
        url,
        originalName,
        mimeType,
        size: typeof att.size === 'number' ? att.size : undefined,
        kind,
        width: typeof att.width === 'number' ? att.width : undefined,
        height: typeof att.height === 'number' ? att.height : undefined,
        durationMs:
          typeof att.durationMs === 'number' ? att.durationMs : undefined,
        downloadUrl: typeof att.downloadUrl === 'string' ? att.downloadUrl : undefined,
        displayUrl: typeof att.displayUrl === 'string' ? att.displayUrl : undefined,
        publicUrl: typeof att.publicUrl === 'string' ? att.publicUrl : undefined,
        assetId: typeof att.assetId === 'string' ? att.assetId : undefined,
        mediaAssetId: typeof att.mediaAssetId === 'string' ? att.mediaAssetId : undefined,
        mediaAssetRef: typeof att.mediaAssetRef === 'string' ? att.mediaAssetRef : undefined,
        localUri: typeof att.localUri === 'string' ? att.localUri : undefined,
        localPath: typeof att.localPath === 'string' ? att.localPath : undefined,
      };
    })
    .filter((att) => !!att.url)); // require a URL to show something

  const hasAttachments = attachments.length > 0;
  const isEncryptedPlaceholderText = rawText.trim().toLowerCase() === 'encrypted message';
  const hasEncryptedPayload = !!(
    (message as any).encryptionMeta ||
    (message as any).ciphertext ||
    (message as any).encrypted
  );
  // Suppress the literal "Encrypted message" placeholder for any encrypted
  // message — text or media. It will be replaced once decryption resolves.
  const text = hasEncryptedPayload && isEncryptedPlaceholderText ? '' : rawText;

  const isVoiceOnly =
    !!voice &&
    !text &&
    !styled &&
    !sticker &&
    !contacts &&
    !poll &&
    !eventData;

  // Edit indicator
  const isEdited = !!(message as any).isEdited || !!(message as any).edited_at ||
    (!!(message as any).is_edited) ||
    (
      typeof (message as any).updated_at === 'string' &&
      typeof (message as any).created_at === 'string' &&
      (message as any).updated_at !== (message as any).created_at
    );

  // Voice transcription state (keyed by message id)
  const messageId = (message as any).id as string;
  const [transcription, setTranscription] = useState<string | null>(
    (message as any).transcription ?? (message as any).transcript ?? null,
  );
  const [showTranscription, setShowTranscription] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const handleShowTranscription = async () => {
    if (transcription) {
      setShowTranscription(prev => !prev);
      return;
    }
    setTranscribing(true);
    try {
      const { getRequest: get } = await import('@/network/get');
      const res = await get(`/api/v1/messages/${messageId}/transcription/`, { errorMessage: '' });
      const text: string | undefined = res?.data?.transcription ?? res?.data?.transcript ?? res?.data?.text;
      if (text) {
        setTranscription(text);
        setShowTranscription(true);
      }
    } catch { /* silent */ } finally {
      setTranscribing(false);
    }
  };

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);
  const [playbackDurationMs, setPlaybackDurationMs] = useState(0);
  const [voicePlaybackError, setVoicePlaybackError] = useState<string | null>(null);
  const [voiceBuffering, setVoiceBuffering] = useState(false);
  // Set once resolveFreshVoicePlaybackUrl() returns a url the embedded
  // voice.url/attachments[0] didn't have (expired/missing) — see
  // handleVoicePress/onError below.
  const [remoteResolvedUrl, setRemoteResolvedUrl] = useState<string | null>(null);
  const [voiceResolving, setVoiceResolving] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 1.5 | 2>(1);
  const voiceVideoRef = useRef<VideoRef | null>(null);
  // Guards setState-after-unmount from an in-flight resolveFreshVoicePlaybackUrl
  // call, and against a stale response landing after the message/bubble has
  // already moved on (e.g. fast list scroll while a refresh was in flight).
  const voiceMountedRef = useRef(true);
  useEffect(() => {
    voiceMountedRef.current = true;
    return () => {
      voiceMountedRef.current = false;
    };
  }, []);
  // Proactive refresh: warms voicePlaybackResolver's cache as soon as a
  // settled (not still sending) voice message renders, instead of waiting
  // for the user to tap play or for playback to fail. Silent — no spinner,
  // no error surfaced — a tap or a playback error still triggers its own
  // resolve/retry independently if this fails (offline, rate limited,
  // etc.), so swallowing the error here is safe, not a silent-failure risk.
  useEffect(() => {
    if ((message as any).kind !== 'voice' || !voice) return;
    if (status === 'local_only' || status === 'pending' || status === 'sending') return;
    const msgId = String((message as any).serverId ?? (message as any).id ?? '');
    const assetId = (voice as any).mediaAssetId || (voice as any).objectKey;
    if (!msgId || !assetId) return;
    if (cachedVoicePlaybackUrl(msgId)) return; // already fresh, nothing to warm
    resolveFreshVoicePlaybackUrl(msgId)
      .then((resolved) => {
        if (!voiceMountedRef.current) return;
        setRemoteResolvedUrl(resolved.url);
      })
      .catch(() => {});
    // Re-run only when the message's own identity/status actually changes —
    // not on every render (voice's object identity can change without its
    // content changing across some of this file's mapping paths).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(message as any).id, (message as any).serverId, (message as any).kind, status]);

  // One automatic retry per play attempt after a playback error — reset in
  // beginPlayback() so a later, separate attempt gets its own retry budget.
  const voiceRetriedRef = useRef(false);
  const playbackOwnerRef = useRef(
    String((message as any).serverId ?? (message as any).id ?? `voice-${Date.now()}`),
  );
  const SPEED_CYCLE: Array<0.5 | 1 | 1.5 | 2> = [1, 1.5, 2, 0.5];

  // Disappearing messages countdown
  const disappearAfterSeconds = (message as any).disappearAfterSeconds as number | null | undefined;
  const sentAt = (message as any).sentAt ?? (message as any).createdAt;
  const [disappearSecsLeft, setDisappearSecsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!disappearAfterSeconds || !sentAt) { setDisappearSecsLeft(null); return; }
    const sentMs = new Date(sentAt).getTime();
    const expiresMs = sentMs + disappearAfterSeconds * 1000;
    const update = () => {
      const left = Math.ceil((expiresMs - Date.now()) / 1000);
      setDisappearSecsLeft(left > 0 ? left : 0);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [disappearAfterSeconds, sentAt]);

  // Top-level view-once — applies to the whole message (text, attachments,
  // or voice, whichever it carries), not just text. A message is either
  // view-once or it isn't; there's no per-attachment granularity.
  const isTopLevelViewOnce = !!(message as any).viewOnce;
  const [topLevelViewOnceViewed, setTopLevelViewOnceViewed] = useState(!!(message as any).viewedAt);
  const [viewOnceModalOpen, setViewOnceModalOpen] = useState(false);
  const viewOnceSnapshotRef = useRef<ViewOnceContentSnapshot | null>(null);

  // Opening the viewer IS "the view": snapshot the still-present content
  // into a ref (so the modal keeps showing it even after the parent strips
  // the live message's content — see ChatRoomPage.tsx's handleViewOnce),
  // mark it viewed so a re-mount (scrolling off-screen and back) respects
  // the one-time reveal, and tell the parent to persist that + notify the
  // server, which is what actually deletes the content, locally and
  // remotely — this component never deletes anything itself.
  const openViewOnceViewer = () => {
    if (topLevelViewOnceViewed) return;
    const snapshotAttachments = hasAttachments
      ? attachments.map((att: any) => ({
          url: att.url,
          localUri: att.localUri,
          mimeType: att.mimeType,
          originalName: att.originalName,
          kind: att.kind,
          durationMs: att.durationMs,
        }))
      : undefined;
    viewOnceSnapshotRef.current = {
      text: text || undefined,
      attachments: snapshotAttachments,
      voice: voice
        ? {
            url: (voice as any).url,
            localUri: (voice as any).localUri,
            mimeType: (voice as any).mimeType,
            originalName: (voice as any).fileName,
            durationMs: (voice as any).durationMs,
            kind: 'audio',
          }
        : undefined,
    };
    setTopLevelViewOnceViewed(true);
    setViewOnceModalOpen(true);
    const msgId = (message as any).serverId ?? (message as any).id;
    if (msgId) onViewOnce?.(String(msgId));
  };

  const renderViewOnceModal = () => (
    <ViewOnceViewerModal
      visible={viewOnceModalOpen}
      content={viewOnceSnapshotRef.current}
      palette={palette}
      onClose={() => setViewOnceModalOpen(false)}
    />
  );

  const isStarred = !!(message as any).isStarred;

  const [videoFullscreen, setVideoFullscreen] = useState<{ localUri?: string; remoteUri: string } | null>(null);
  const [videoFullscreenUseRemote, setVideoFullscreenUseRemote] = useState(false);

  const [mediaHeaders, setMediaHeaders] = useState<Record<string, string>>({});

  // A persisted localUri/localPath can point at a file that no longer exists
  // — e.g. after a fresh app install/reload wipes the sandbox container the
  // path was captured under. Once an <Image>/<Video> using it fails to load,
  // we stop trusting it (per-attachment) and fall back to the remote CDN url
  // instead of silently rendering a blank/black box forever.
  const [localMediaBroken, setLocalMediaBroken] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getAccessToken().catch(() => null),
      AsyncStorage.getItem('device_id').catch(() => null),
    ]).then(([token, deviceId]) => {
      if (cancelled) return;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (deviceId) headers['X-Device-Id'] = deviceId;
      setMediaHeaders(headers);
    });
    return () => { cancelled = true; };
  }, []);

  // Per-attachment download state (non-image files)
  const [downloadState, setDownloadState] = useState<Record<string, {
    progress: number; // 0..1
    status: 'idle' | 'downloading' | 'done' | 'failed' | 'expired' | 'forbidden' | 'quarantined';
    localPath?: string;
    message?: string;
  }>>({});
  // In-flight guard keyed by attachment state key — belt-and-braces against
  // double-taps beyond what the `disabled` prop on the control already does
  // (e.g. the image-tile onPress path below, which isn't disabled).
  const downloadsInFlightRef = useRef<Set<string>>(new Set());

  const persistDownloadedAttachmentPath = useCallback((attId: string, localPath: string) => {
    if (!attId || !localPath || !onUpdateMessage) return;
    const localUri = fileUriForPath(localPath);
    // Some stored attachments are wrapped as { attachment: {...} } (legacy
    // shape) rather than flat — unwrap so matching/updating works either way.
    const unwrap = (att: any) =>
      att && typeof att === 'object' && 'attachment' in att && att.attachment ? att.attachment : att;
    const matches = (att: any, index: number) => {
      const inner = unwrap(att);
      const values = [
        inner?.id,
        inner?.key,
        inner?.assetId,
        inner?.mediaAssetId,
        inner?.mediaAssetRef,
        inner?.url,
        inner?.displayUrl,
        inner?.downloadUrl,
        inner?.publicUrl,
        inner?.localUri,
        inner?.localPath,
        inner?.uri,
        inner?.path,
        index,
      ].map((value) => String(value ?? ''));
      return values.includes(String(attId));
    };
    const withLocalPath = (list: any[] | undefined) =>
      Array.isArray(list)
        ? list.map((att: any, index: number) => {
            if (!matches(att, index)) return att;
            const isWrapped = att && typeof att === 'object' && 'attachment' in att && att.attachment;
            return isWrapped
              ? { ...att, attachment: { ...att.attachment, localPath, localUri } }
              : { ...att, localPath, localUri };
          })
        : list;

    const nextAttachments = withLocalPath((message as any).attachments) ?? [];
    const currentMedia = (message as any).media && typeof (message as any).media === 'object'
      ? (message as any).media
      : undefined;
    const nextMedia = currentMedia
      ? { ...currentMedia, attachments: withLocalPath(currentMedia.attachments) }
      : undefined;
    const currentVoice = (message as any).voice && typeof (message as any).voice === 'object'
      ? (message as any).voice
      : undefined;
    const voiceIds = currentVoice
      ? [
          (message as any).serverId,
          (message as any).id,
          currentVoice.id,
          currentVoice.uri,
          currentVoice.url,
        ].map((value) => String(value ?? ''))
      : [];
    const nextVoice = currentVoice && voiceIds.includes(String(attId))
      ? { ...currentVoice, localPath, localUri, uri: localUri }
      : currentVoice;
    onUpdateMessage({
      ...(message as any),
      attachments: nextAttachments,
      ...(nextMedia ? { media: nextMedia } : {}),
      ...(nextVoice ? { voice: nextVoice } : {}),
    } as ChatMessage);
  }, [message, onUpdateMessage]);

  const logDownload = (stage: string, details: Record<string, unknown>) => {
    if (!__DEV__) return;
    // Deliberately excludes bearer tokens and signed-URL query strings.
    console.log(`[attachment-download:${stage}]`, details);
  };

  const safeUrlForLog = (url?: string) => {
    if (!url) return undefined;
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return url.split('?')[0];
    }
  };

  const downloadFile = async (att: NormalizedAttachment) => {
    const attId = att.key;
    const filename = att.name || att.filename || `kis_file_${Date.now()}`;

    if (downloadsInFlightRef.current.has(attId)) return; // duplicate-tap guard
    if (downloadState[attId]?.status === 'downloading' || downloadState[attId]?.status === 'done') return;

    if (att.expired) {
      setDownloadState(prev => ({ ...prev, [attId]: { progress: 0, status: 'expired', message: 'This file has expired.' } }));
      return;
    }
    if (att.quarantined || (att.scanStatus && ['pending_review', 'blocked', 'failed'].includes(att.scanStatus))) {
      setDownloadState(prev => ({ ...prev, [attId]: { progress: 0, status: 'quarantined', message: 'This file is unavailable pending review.' } }));
      return;
    }

    downloadsInFlightRef.current.add(attId);
    setDownloadState(prev => ({ ...prev, [attId]: { progress: 0, status: 'downloading' } }));
    logDownload('start', { attachmentId: att.attachmentId, hasStorageKeyClientSide: false, originalName: filename, mime: att.mime, expectedSize: att.size });

    let destPath: string | undefined;
    let RNBlobUtil: any = null;
    try { RNBlobUtil = require('react-native-blob-util').default; } catch {}

    const fail = async (status: 'failed' | 'expired' | 'forbidden' | 'quarantined', message: string) => {
      if (destPath) {
        await RNBlobUtil?.fs?.unlink(destPath).catch(() => {});
      }
      logDownload('error', { attachmentId: att.attachmentId, status, message });
      setDownloadState(prev => ({ ...prev, [attId]: { progress: 0, status, message } }));
    };

    try {
      if (!RNBlobUtil) {
        await fail('failed', 'Downloads are not supported on this build.');
        return;
      }

      const safeName = sanitizeChatMediaFileName(filename);
      destPath = await buildChatMediaPath('downloads', safeName, attId);
      const existingStat = await RNFS.stat(destPath).catch(() => null);
      if (existingStat && Number(existingStat.size) > 0) {
        setDownloadState(prev => ({ ...prev, [attId]: { progress: 1, status: 'done', localPath: destPath } }));
        persistDownloadedAttachmentPath(attId, destPath!);
        return;
      }

      // Resolve a fresh, authorized fetch URL by attachment id — never
      // trust the attachment's cached url/key directly. Falls back to the
      // legacy (now-authenticated) url only when there's no usable id, or
      // the id-based lookup can't find a record (very old cached data).
      let fetchUrl: string | undefined;
      let expectedSize = att.size;
      let expectedMime = att.mime;

      if (att.attachmentId) {
        try {
          const resolved = await requestAttachmentDownloadUrl(att.attachmentId);
          fetchUrl = resolved.downloadUrl;
          expectedSize = resolved.size || expectedSize;
          expectedMime = resolved.mimeType || expectedMime;
          logDownload('authorized', {
            attachmentId: att.attachmentId,
            endpoint: safeUrlForLog(`${NEST_API_BASE_URL}/uploads/${att.attachmentId}/download-url`),
            resolvedUrl: safeUrlForLog(resolved.downloadUrl),
            expiresInSeconds: resolved.expiresInSeconds,
          });
        } catch (error) {
          if (error instanceof AttachmentDownloadError) {
            logDownload('authorization_error', { attachmentId: att.attachmentId, kind: error.kind, status: error.status, message: error.message });
            if (error.kind === 'expired') return void (await fail('expired', 'This file has expired.'));
            if (error.kind === 'forbidden') return void (await fail('forbidden', error.message || 'You do not have access to this file.'));
            if (error.kind === 'not_found' && att.uri) {
              // Very old cached attachment with no server-resolvable id — fall
              // back to the legacy (now-authenticated) direct link.
              fetchUrl = undefined;
            } else {
              return void (await fail('failed', error.message || 'Download failed.'));
            }
          } else {
            throw error;
          }
        }
      }

      if (!fetchUrl) {
        fetchUrl = resolveBackendAssetUrl(att.uri) ?? att.uri;
      }
      if (!fetchUrl) {
        await fail('failed', 'No download link is available for this file.');
        return;
      }

      const token = await getAccessToken();
      const deviceId = await AsyncStorage.getItem('device_id');
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (deviceId) headers['X-Device-Id'] = deviceId;
      // Never attach our own bearer token to a presigned storage URL (S3) —
      // only our own backends expect/accept it, and a signed URL's
      // authorization is entirely in its query string.
      const requestHeaders = (fetchUrl.startsWith(API_BASE_URL) || fetchUrl.startsWith(NEST_API_BASE_URL)) ? headers : {};

      logDownload('request', { attachmentId: att.attachmentId, endpoint: safeUrlForLog(fetchUrl), destinationPath: destPath });

      const task = RNBlobUtil.config({ fileCache: true, path: destPath, addAndroidDownloads: { useDownloadManager: true, notification: true, title: safeName, path: destPath } })
        .fetch('GET', fetchUrl, requestHeaders);
      task.progress((received: number, total: number) => {
        if (total > 0) {
          setDownloadState(prev => ({ ...prev, [attId]: { progress: Math.max(0, Math.min(1, received / total)), status: 'downloading' } }));
        }
      });
      const response = await task;
      const info = response?.info?.();
      const statusCode = Number(info?.status);
      const responseContentType = String(info?.headers?.['Content-Type'] ?? info?.headers?.['content-type'] ?? '').toLowerCase();

      logDownload('response', { attachmentId: att.attachmentId, httpStatus: statusCode, contentType: responseContentType });

      if (!Number.isFinite(statusCode) || statusCode < 200 || statusCode >= 300) {
        const kind = statusCode === 401 ? 'failed' : statusCode === 403 ? 'forbidden' : statusCode === 410 ? 'expired' : 'failed';
        await fail(kind as any, `Download failed with status ${statusCode || 'unknown'}`);
        return;
      }
      if (responseContentType.includes('application/json') || responseContentType.includes('text/html')) {
        await fail('failed', 'Server returned an error instead of the file.');
        return;
      }

      const finalStat = await RNFS.stat(destPath).catch(() => null);
      const finalSize = finalStat ? Number(finalStat.size) : 0;
      const fileExists = !!finalStat && finalSize > 0;
      logDownload('complete', { attachmentId: att.attachmentId, downloadedBytes: finalSize, fileExists });

      if (!fileExists) {
        await fail('failed', 'Downloaded file was empty.');
        return;
      }
      // Sanity-check against the size the server told us to expect —
      // generous tolerance since compression/re-encoding can shift this.
      if (expectedSize && expectedSize > 0 && finalSize < expectedSize * 0.5) {
        await fail('failed', 'Downloaded file was incomplete.');
        return;
      }

      setDownloadState(prev => ({ ...prev, [attId]: { progress: 1, status: 'done', localPath: destPath } }));
      persistDownloadedAttachmentPath(attId, destPath);
      RNBlobUtil.android?.actionViewIntent?.(destPath, expectedMime || 'application/octet-stream').catch(() => {
        /* Protected media URLs need auth headers; do not open them in Safari. */
      });
    } catch (error) {
      logDownload('exception', {
        attachmentId: att.attachmentId,
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      await fail('failed', error instanceof Error ? error.message : 'Download failed.');
    } finally {
      downloadsInFlightRef.current.delete(attId);
    }
  };

  const renderDownloadControl = (
    att: NormalizedAttachment,
    variant: 'overlay' | 'inline' = 'inline',
  ) => {
    const attId = att.key;
    if (isMe || !att.uri) return null;
    const state = downloadState[attId] ?? { status: 'idle', progress: 0 };
    const pct = Math.max(0, Math.min(100, Math.round((state.progress ?? 0) * 100)));
    const isDownloading = state.status === 'downloading';
    const isDone = state.status === 'done';
    if (isDone) return null;
    const isFailed = state.status === 'failed';
    const isExpired = state.status === 'expired' || att.expired;
    const isBlocked = state.status === 'forbidden' || state.status === 'quarantined' || att.quarantined;
    // isFailed alone gates the retry affordance below — expired/forbidden are terminal, no retry.
    const label = isDownloading
      ? `Downloading ${pct}%`
      : isDone
      ? 'Downloaded'
      : isExpired
      ? 'Expired'
      : isBlocked
      ? 'Unavailable'
      : isFailed
      ? 'Retry download'
      : 'Download';
    const isOverlay = variant === 'overlay';
    return (
      <Pressable
        disabled={isDownloading || isDone || isExpired || isBlocked}
        onPress={() => downloadFile(att)}
        style={{
          ...(isOverlay
            ? {
                position: 'absolute' as const,
                right: 8,
                bottom: 8,
                minWidth: 124,
                maxWidth: '92%' as const,
              }
            : { alignSelf: 'flex-start' as const, marginTop: 6 }),
          minHeight: 34,
          minWidth: isOverlay ? 124 : 132,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: isOverlay ? 'rgba(0,0,0,0.62)' : (palette.surfaceSoft ?? 'rgba(0,0,0,0.08)'),
          borderWidth: isFailed ? 1 : 0,
          borderColor: palette.danger,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          overflow: 'hidden',
        }}
      >
        {isDownloading && (
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${pct}%`,
              backgroundColor: isOverlay ? 'rgba(255,255,255,0.24)' : `${palette.primary}33`,
            }}
          />
        )}
        {isDownloading ? (
          <ActivityIndicator size="small" color={isOverlay ? '#FFFFFF' : palette.primary} />
        ) : (
          <KISIcon
            name={isDone ? 'check' : 'download'}
            size={14}
            color={isOverlay ? '#FFFFFF' : isFailed ? palette.danger : palette.primary}
          />
        )}
        <Text
          numberOfLines={1}
          style={{
            fontSize: isDownloading ? 12 : 11,
            fontWeight: '800',
            color: isOverlay ? '#FFFFFF' : isFailed ? palette.danger : palette.text,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const responsive = useResponsiveLayout();
  const width = responsive.width || Dimensions.get('window').width;
  const bubbleMaxWidth = responsive.isTablet ? '68%' : responsive.isWatch ? '92%' : responsive.isCompactPhone ? '88%' : '80%';
  const bubblePaddingX = responsive.isWatch ? 8 : 10;
  const bubbleTextSize = responsive.bodyFontSize;

  const { language: userLanguage } = useLanguage();
  const { t } = useTranslation();

  // Read-more state for long messages
  const READ_MORE_THRESHOLD = 300;
  const isLongText = !!text && text.length > READ_MORE_THRESHOLD;
  const [expanded, setExpanded] = useState(false);
  const displayText = isLongText && !expanded ? text!.slice(0, READ_MORE_THRESHOLD) : text;

  // Translation — uses the language the user set in their profile
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  const handleTranslate = useCallback(async () => {
    if (!text || translating) return;
    setTranslating(true);
    try {
      const { postRequest: post } = await import('@/network/post');
      const ROUTES_mod = await import('@/network');
      const res = await post(
        ROUTES_mod.default.translate,
        { text, target_lang: userLanguage },
        {},
      );
      if (res?.data?.translated && res.data.translated !== text) {
        setTranslatedText(res.data.translated);
      }
    } catch { /* silent */ } finally {
      setTranslating(false);
    }
  }, [text, translating, userLanguage]);

  // Auto-translate incoming messages when the user's language is not English
  useEffect(() => {
    if (!text || isMe || translatedText || userLanguage === 'en') return;
    handleTranslate();
  // Only run when language changes or a new message arrives (text changes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, userLanguage]);

  // Reset translation when language changes so it is re-fetched in the new language
  useEffect(() => {
    setTranslatedText(null);
  }, [userLanguage]);

  // Link preview
  const serverLinkPreview = (message as any).linkPreview as
    | { title?: string; description?: string; image?: string; site_name?: string; url?: string }
    | undefined;
  const [linkPreview, setLinkPreview] = useState<
    { title?: string; description?: string; image?: string; site_name?: string; url?: string } | null
  >(serverLinkPreview ?? null);
  const [linkPreviewUrl, setLinkPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (serverLinkPreview) { setLinkPreview(serverLinkPreview); return; }
    if (!text) return;
    const urlMatch = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/);
    if (!urlMatch) return;
    const url = urlMatch[0];
    setLinkPreviewUrl(url);
    let cancelled = false;
    (async () => {
      try {
        const ROUTES_mod = await import('@/network');
        const { getRequest } = await import('@/network/get');
        const res = await getRequest(
          `${ROUTES_mod.default.linkPreview}?url=${encodeURIComponent(url)}`,
          { errorMessage: '' },
        );
        if (!cancelled && (res?.data?.title || res?.data?.description || res?.data?.image)) {
          setLinkPreview({ ...res.data, url });
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [text, serverLinkPreview]);

  const inviteInfo = React.useMemo(() => {
    if (!text) return null;
    const m = text.match(/https?:\/\/[^\s]+\/join\/(group|community)\/([A-Za-z0-9_-]+)/);
    if (!m) return null;
    return { type: m[1] as 'group' | 'community', token: m[2] };
  }, [text]);

  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [reactionViewerVisible, setReactionViewerVisible] = useState(false);
  const [reactionViewerEmoji, setReactionViewerEmoji] = useState<string | null>(null);

  // ✅ local state for selected poll option
  const [selectedPollOptionKey, setSelectedPollOptionKey] = useState<
    string | null
  >(null);

  const stopPlayback = (reset = false) => {
    setIsPlaying(false);
    setVoiceBuffering(false);
    if (reset) {
      voiceVideoRef.current?.seek(0);
      setProgress(0);
      setPlaybackPositionMs(0);
    }
  };

  const handleCycleSpeed = () => {
    const currentIdx = SPEED_CYCLE.indexOf(playbackSpeed);
    const nextSpeed = SPEED_CYCLE[(currentIdx + 1) % SPEED_CYCLE.length];
    setPlaybackSpeed(nextSpeed);
  };

  // Shared by the fast path (embedded url already usable) and the resolver
  // path (handleVoicePress below, after a fresh url comes back) so both
  // start playback identically.
  const beginPlayback = () => {
    voiceRetriedRef.current = false;
    setVoicePlaybackError(null);
    setVoiceBuffering(true);
    DeviceEventEmitter.emit(CHAT_VOICE_PLAYBACK_EVENT, playbackOwnerRef.current);
    setIsPlaying(true);
  };

  const handleTogglePlay = () => {
    if (!voice) return;
    if (isPlaying) {
      stopPlayback(false);
    } else {
      beginPlayback();
    }
  };

  const handlePollOptionPress = (optionKey: string, rawOptionId: string) => {
    setSelectedPollOptionKey(optionKey);
    const messageId = (message as any).serverId ?? (message as any).id;
    if (messageId) {
      onVotePoll?.(messageId, rawOptionId);
    }
  };

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      CHAT_VOICE_PLAYBACK_EVENT,
      (ownerId: string) => {
        if (ownerId !== playbackOwnerRef.current) {
          stopPlayback(true);
        }
      },
    );
    return () => {
      subscription.remove();
    };
  }, []);

  const bubbleBaseStyle = [
    styles.messageBubble,
    isMe
      ? { backgroundColor: palette.outgoingBubble ?? palette.primary }
      : {
          backgroundColor:
            palette.incomingBubble ?? palette.surface ?? palette.card,
        },
    !isLastInGroup
      ? isMe
        ? { borderBottomRightRadius: 8 }
        : { borderBottomLeftRadius: 8 }
      : null,
  ];

  const highlightedStyle = isHighlighted
    ? {
        borderWidth: 2,
        borderColor: palette.highlightBorder ?? palette.primary,
        shadowColor: palette.highlightShadow ?? palette.primary,
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
      }
    : null;

  /**
   * Subtle border for pinned messages.
   * This is intentionally lighter than the selection/highlight styling.
   */
  const pinnedStyle = isPinned
    ? {
        borderWidth: 2,
        borderColor:
          palette.pinnedBorder ?? (palette.primarySoft ?? '#4F46E533'),
      }
    : null;

  const selectedStyle = isSelected
    ? {
        borderWidth: 2,
        borderColor: palette.selectedBorder ?? '#4F46E5',
        backgroundColor: isMe
          ? palette.selectedBgOutgoing ?? '#ffffff22'
          : palette.selectedBgIncoming ?? '#00000011',
      }
    : null;

  const outgoingBubbleColor = palette.outgoingBubble ?? palette.primary;
  const parseHex = (hex?: string) => {
    if (!hex || typeof hex !== 'string') return null;
    const cleaned = hex.replace('#', '').trim();
    if (cleaned.length === 3) {
      const r = parseInt(cleaned[0] + cleaned[0], 16);
      const g = parseInt(cleaned[1] + cleaned[1], 16);
      const b = parseInt(cleaned[2] + cleaned[2], 16);
      return { r, g, b };
    }
    if (cleaned.length === 6) {
      const r = parseInt(cleaned.slice(0, 2), 16);
      const g = parseInt(cleaned.slice(2, 4), 16);
      const b = parseInt(cleaned.slice(4, 6), 16);
      return { r, g, b };
    }
    return null;
  };
  const readableTextForBg = (hex: string) => {
    const rgb = parseHex(hex);
    if (!rgb) return '#ffffff';
    const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return yiq >= 160 ? '#111111' : '#ffffff';
  };
  const outgoingTextColor = readableTextForBg(outgoingBubbleColor);
  const outgoingMetaColor = outgoingTextColor === '#111111' ? '#2b2b2b' : '#e0e0e0';

  const textColor = isMe ? outgoingTextColor : palette.text;
  const metaColor = isMe ? outgoingMetaColor : palette.subtext;
  const chatBgColor = String(palette.chatBg ?? palette.bg ?? '');
  const chatLooksLight = readableTextForBg(chatBgColor) === '#111111';
  const deletedBubbleColor =
    palette.deletedBubbleBg ?? (chatLooksLight ? '#F1E7DA' : '#2A2434');
  const deletedTextColor =
    palette.deletedTextColor ?? (chatLooksLight ? '#765D47' : '#CFC6DA');
  const deletedMetaColor =
    palette.deletedMetaColor ?? (chatLooksLight ? '#8B735D' : '#AFA5BC');

  const statusColor =
    status === 'read'
      ? palette.readStatus ?? palette.primary
      : metaColor;

  // Upload progress overlay data (synthetic in-flight bubbles only)
  const uploadStatus = (message as any)._uploadStatus as
    | 'verifying' | 'uploading' | 'verification_failed' | 'failed'
    | undefined;
  const uploadProgress = typeof (message as any)._uploadProgress === 'number'
    ? (message as any)._uploadProgress as number
    : undefined;
  const hasUploadState = Boolean(uploadStatus || uploadProgress !== undefined);
  const isUploadFailed = uploadStatus === 'failed' || uploadStatus === 'verification_failed';
  const showRetry = (status === 'failed' && !hasUploadState) || isUploadFailed;

  const normalizeAttachments = (
      attachmentsRaw: unknown,
    ): NormalizedAttachment[] => {
      if (!Array.isArray(attachmentsRaw)) return [];
  
      const list = attachmentsRaw as any[];
  
      return list
        .map((raw, index): NormalizedAttachment | null => {
          if (!raw || typeof raw !== 'object') return null;
  
          let att: any;
  
          // Legacy shape: { attachment: {...} }
          if ('attachment' in raw && raw.attachment) {
            att = (raw as LegacyAttachmentWrapper).attachment;
          } else {
            // New flat metadata shape (AttachmentMeta[] from uploadFileToBackend)
            att = raw as FlatAttachmentMeta;
          }
  
          const uri =
            att.displayUrl ||
            att.url ||
            att.downloadUrl ||
            att.publicUrl ||
            att.localUri ||
            (att.localPath ? `file://${att.localPath}` : '') ||
            att.uri ||
            (typeof att.path === 'string' ? att.path : '');
  
          if (!uri) return null;
  
          const mime =
            att.mimeType ||
            att.mimetype ||
            att.contentType ||
            att.mime ||
            undefined;
  
          const name =
            att.name ||
            att.originalName ||
            att.filename ||
            (uri ? uri.split('/').pop() : '');
  
          const size =
            typeof att.sizeBytes === 'number'
              ? att.sizeBytes
              : typeof att.size === 'number'
              ? att.size
              : undefined;
  
          // Only trust att.id as the real backend attachment id when it's
          // actually a distinct identifier — not a fallback that already
          // collapsed to the uri itself (chatStorage.ts synthesizes ids
          // like `att-${index}-${url}` for malformed legacy rows).
          const rawId = att.id != null ? String(att.id) : undefined;
          const attachmentId = rawId && rawId !== uri && !rawId.startsWith('att-') ? rawId : undefined;
          const key = String(rawId ?? uri ?? index);

          return {
            key,
            attachmentId,
            uri,
            mime,
            name,
            filename: att.filename,
            size,
            localUri: att.localUri,
            localPath: att.localPath,
            expired: att.expired === true,
            quarantined: att.quarantined === true,
            scanStatus: att.scanStatus,
            viewOnce: att.viewOnce === true,
            viewedAt: att.viewedAt,
          };
        })
        .filter(Boolean) as NormalizedAttachment[];
    };

    /* ----------------------------- Helpers ---------------------------------- */
    
    const formatFileSize = (bytes?: number) => {
      if (!bytes || bytes <= 0) return '';
      const kb = bytes / 1024;
      if (kb < 1024) return `${kb.toFixed(1)} KB`;
      const mb = kb / 1024;
      if (mb < 1024) return `${mb.toFixed(1)} MB`;
      const gb = mb / 1024;
      return `${gb.toFixed(1)} GB`;
    };
  
    const getExtension = (nameOrUrl: string | undefined) => {
      if (!nameOrUrl) return '';
      const last = nameOrUrl.split('.').pop();
      if (!last) return '';
      return last.split('?')[0].split('#')[0].toLowerCase();
    };
  
    const getDisplayName = (raw?: string) => {
      if (!raw) return 'File';
      try {
        const decoded = decodeURIComponent(raw);
        return decoded.replace(/_/g, ' ');
      } catch {
        return raw.replace(/_/g, ' ');
      }
    };
  
    const getShortUrl = (url?: string) => {
      if (!url) return '';
      try {
        const u = new URL(url);
        const last = u.pathname.split('/').pop();
        return `${u.host}${last ? ` / ${decodeURIComponent(last)}` : ''}`;
      } catch {
        const parts = url.split('/');
        return parts.slice(-2).join('/');
      }
    };

  const renderAttachments = (
    attachmentsRaw: unknown,
    fromMe: boolean | undefined,
  ) => {
    const attachments = normalizeAttachments(attachmentsRaw);
    if (!attachments.length) return null;

    const isOutgoing = !!fromMe;
    const bubbleWidthRatio = responsive.isTablet ? 0.68 : responsive.isWatch ? 0.92 : responsive.isCompactPhone ? 0.88 : 0.8;
    const gridGap = 6;
    const gridOuterWidth = Math.max(220, Math.floor(width * bubbleWidthRatio) - (bubblePaddingX * 2));
    const gridItemWidth = attachments.length > 1
      ? Math.max(104, Math.floor((gridOuterWidth - gridGap) / 2))
      : Math.min(220, gridOuterWidth);
    const gridItemHight = attachments.length > 1
      ? Math.max(104, Math.floor((gridOuterWidth - gridGap) / 2))
      : Math.min(220, gridOuterWidth);
    const gridItemWidth2 = attachments.length > 1
      ? Math.max(104, Math.floor((gridOuterWidth - gridGap) / 2.11))
      : "100%";
    const pdfTileHeight = Math.max(170, Math.floor(gridItemWidth * 1.25));
    const videoTileHeight = Math.max(96, Math.floor(gridItemWidth * 0.68));

    return (
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          width: gridOuterWidth,
          maxWidth: '100%',
          marginTop: 4,
          marginBottom: 6,
          justifyContent: 'space-between',
          alignSelf: isOutgoing ? 'flex-end' : 'flex-start',
        }}
      >
        {attachments.map((att, _index) => {
          const key = att.key;
          const uri = att.uri;
          const mime = att.mime;
          const ext = getExtension(att.name || att.filename || uri);
          const downloadKey = String(key);
          const savedLocalPath = (att as any).localPath;
          const savedLocalUri = (att as any).localUri;
          const localUriPath = typeof savedLocalUri === 'string' && savedLocalUri.startsWith('file://')
            ? stripFileScheme(savedLocalUri)
            : undefined;
          const downloadedPath = downloadState[downloadKey]?.localPath ?? savedLocalPath ?? localUriPath;
          const rawDownloadedUri = downloadedPath ? fileUriForPath(downloadedPath) : (savedLocalUri || '');
          // Once this attachment's local file has failed to actually load
          // (see onError below), stop trusting it so we fall through to the
          // remote CDN url instead of a permanently blank/black render.
          const downloadedUri = localMediaBroken[downloadKey] ? '' : rawDownloadedUri;
          const canOpenRemote = isOutgoing || isLocalAttachmentUrl(uri);
          const canOpenDownloaded = !!downloadedUri;
          const openableUri = downloadedUri || (canOpenRemote ? uri : '');
          const markLocalMediaBroken = () => {
            if (!rawDownloadedUri || localMediaBroken[downloadKey]) return;
            // Don't trust a single onError — <Image>/<Video> can fire it for
            // transient reasons (decode hiccup, brief lock right after a
            // download finishes writing) unrelated to the file being gone.
            // Only poison this attachment once we've confirmed the file is
            // genuinely missing, so a one-off glitch doesn't permanently
            // re-blur an already-downloaded attachment or bring back the
            // download button/percentage indicator for no reason.
            RNFS.exists(stripFileScheme(rawDownloadedUri))
              .catch(() => false)
              .then((stillExists) => {
                if (!stillExists) {
                  setLocalMediaBroken((prev) => ({ ...prev, [downloadKey]: true }));
                }
              });
          };

          const isImage =
            mime?.startsWith('image/') ||
            (uri &&
              (uri.toLowerCase().endsWith('.png') ||
                uri.toLowerCase().endsWith('.jpg') ||
                uri.toLowerCase().endsWith('.jpeg') ||
                uri.toLowerCase().endsWith('.gif') ||
                uri.toLowerCase().endsWith('.webp')));

          const isPdf =
            mime === 'application/pdf' ||
            ext === 'pdf' ||
            (uri && uri.toLowerCase().endsWith('.pdf'));

          const isVideo =
            mime?.startsWith('video/') ||
            ['mp4', 'mov', 'm4v', 'webm'].includes(ext);

          const isAudio =
            mime?.startsWith('audio/') ||
            ['mp3', 'm4a', 'wav', 'ogg'].includes(ext);

          const shouldBlurUntilDownloaded = !isOutgoing && !isLocalAttachmentUrl(uri) && !canOpenDownloaded;
          const sizeLabel = formatFileSize(att.size);
          const displayName = getDisplayName(
            att.name || att.filename || (uri ? uri.split('/').pop() : ''),
          );
          const shortUrl = getShortUrl(uri);

          // IMAGE THUMBNAIL PREVIEW (images will only reach here from camera or backend)
          if (isImage && uri) {
            return (
              <Pressable
                key={key}
                style={{
                  width: gridItemWidth2,
                  height: gridItemHight,
                  borderRadius: 16,
                  overflow: 'hidden',
                  marginHorizontal: 0,
                  marginVertical: gridGap / 2,
                  backgroundColor: palette.surface ?? palette.card,
                }}
                onPress={() => {
                  if (!openableUri) {
                    void downloadFile(att);
                    return;
                  }
                  Linking.openURL(openableUri).catch((err) =>
                    console.warn('open attachment error', err),
                  );
                }}
              >
                {(!autoLoadImages && !tappedImageIds.has(downloadKey)) ? (
                  <Pressable
                    style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface }}
                    onPress={() => setTappedImageIds(prev => new Set([...prev, downloadKey]))}
                  >
                    <Text style={{ fontSize: 22 }}>🖼</Text>
                    <Text style={{ fontSize: 11, color: palette.subtext, marginTop: 4 }}>Tap to load</Text>
                  </Pressable>
                ) : (
                  <Image
                    source={{ uri: openableUri || uri, headers: mediaHeaders }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                    // Android only: decode the bitmap at roughly this
                    // display size instead of the source's full resolution.
                    // Chat images can be sent at up to 1600px (see
                    // uploadFileToBackend.ts); rendered at bubble size,
                    // that's a lot of avoidable bitmap memory across a
                    // scrolling message list without this.
                    resizeMethod="resize"
                    blurRadius={shouldBlurUntilDownloaded ? 9 : 0}
                    onError={markLocalMediaBroken}
                  />
                )}
                {shouldBlurUntilDownloaded && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(0,0,0,0.22)',
                    }}
                  />
                )}
                {!canOpenDownloaded && renderDownloadControl(att, 'overlay')}
                {renderInlineUploadOverlay()}
              </Pressable>
            );
          }

          // PDF FIRST-PAGE PREVIEW
          if (isPdf && uri) {
            return (
              <Pressable
                key={key}
                style={{
                  width: gridItemWidth,
                  height: pdfTileHeight,
                  borderRadius: 18,
                  overflow: 'hidden',
                  marginHorizontal: 0,
                  marginVertical: gridGap / 2,
                  backgroundColor: palette.surface ?? palette.card,
                }}
                onPress={() => {
                  if (!openableUri) {
                    void downloadFile(att);
                    return;
                  }
                  Linking.openURL(openableUri).catch((err) =>
                    console.warn('open pdf error', err),
                  );
                }}
              >
                {/* First page as preview */}
                <View style={{ flex: 1 }}>
                  <Pdf
                    source={{ uri: openableUri || uri, cache: true, headers: mediaHeaders }}
                    page={1}
                    singlePage
                    style={{ flex: 1, opacity: shouldBlurUntilDownloaded ? 0.45 : 1 }}
                  />
                </View>

                {/* Overlay footer with filename + meta */}
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    backgroundColor: '#00000088',
                  }}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="middle"
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: '#ffffff',
                    }}
                  >
                    {displayName}
                  </Text>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      fontSize: 11,
                      color: palette.ivory,
                      marginTop: 2,
                    }}
                  >
                    PDF {sizeLabel ? `• ${sizeLabel}` : ''}
                  </Text>
                </View>
                {shouldBlurUntilDownloaded && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(0,0,0,0.24)',
                    }}
                  />
                )}
                {!canOpenDownloaded && renderDownloadControl(att, 'overlay')}
                {renderInlineUploadOverlay()}
              </Pressable>
            );
          }


          if (isVideo && uri) {
            return (
              <Pressable
                key={key}
                style={{
                  width: gridItemWidth,
                  height: videoTileHeight,
                  borderRadius: 18,
                  overflow: 'hidden',
                  marginHorizontal: 0,
                  marginVertical: gridGap / 2,
                  backgroundColor: '#111827',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => {
                  if (!downloadedUri) {
                    void downloadFile(att);
                    return;
                  }
                  setVideoFullscreenUseRemote(false);
                  setVideoFullscreen({ localUri: downloadedUri, remoteUri: uri });
                }}
              >
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    backgroundColor: shouldBlurUntilDownloaded ? 'rgba(0,0,0,0.58)' : 'rgba(0,0,0,0.28)',
                  }}
                />
                <Ionicons name={downloadedUri ? 'play-circle' : 'videocam'} size={42} color="#fff" />
                <Text style={{ marginTop: 8, color: '#fff', fontWeight: '700', fontSize: 12 }} numberOfLines={1}>
                  {downloadedUri ? 'Play video' : displayName}
                </Text>
                {!canOpenDownloaded && renderDownloadControl(att, 'overlay')}
                {renderInlineUploadOverlay()}
              </Pressable>
            );
          }

          if (isAudio && uri) {
            return (
              <Pressable
                key={key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  width: attachments.length > 1 ? gridItemWidth : Math.min(300, gridOuterWidth),
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  marginHorizontal: 0,
                  marginVertical: gridGap / 2,
                  borderRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: isOutgoing ? palette.outgoingBubble ?? palette.primary : palette.incomingBubble ?? palette.surface ?? palette.card,
                }}
                onPress={() => {
                  if (!openableUri) {
                    void downloadFile(att);
                    return;
                  }
                  Linking.openURL(openableUri).catch((err) => console.warn('open audio error', err));
                }}
              >
                <KISIcon name="mic" size={22} color={isOutgoing ? palette.onPrimary : palette.primary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: isOutgoing ? palette.onPrimary : palette.text }}>
                    {displayName}
                  </Text>
                  <Text numberOfLines={1} style={{ fontSize: 11, marginTop: 3, color: isOutgoing ? palette.onPrimaryMuted ?? '#e0e0e0' : palette.subtext }}>
                    Audio {sizeLabel ? `• ${sizeLabel}` : ''}
                  </Text>
                  {!canOpenDownloaded && renderDownloadControl(att, 'inline')}
                </View>
                {renderInlineUploadOverlay()}
              </Pressable>
            );
          }

          // DOCUMENT / OTHER FILE MINI PREVIEW CARD
          return (
            <Pressable
              key={key}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                width: attachments.length > 1 ? gridItemWidth : Math.min(340, gridOuterWidth),
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginHorizontal: 0,
                marginVertical: gridGap / 2,
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: isOutgoing
                  ? palette.outgoingBubble ?? palette.primary
                  : palette.incomingBubble ??
                    palette.surface ??
                    palette.card,
              }}
              onPress={() => {
                if (!openableUri) {
                  void downloadFile(att);
                  return;
                }
                if (openableUri) {
                  Linking.openURL(openableUri).catch((err) =>
                    console.warn('open attachment error', err),
                  );
                }
              }}
            >
              {/* Extension badge on the left */}
              <View
                style={{
                  width: 46,
                  height: 56,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                  backgroundColor: isOutgoing
                    ? palette.onPrimary
                      ? `${palette.onPrimary}22`
                      : '#ffffff22'
                    : palette.primary
                    ? `${palette.primary}22`
                    : '#00000011',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    color: isOutgoing
                      ? palette.onPrimary
                      : palette.primary,
                  }}
                >
                  {ext || 'FILE'}
                </Text>
              </View>

              {/* Right side: file "preview" info */}
              <View style={{ flex: 1 }}>
                {/* File name */}
                <Text
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isOutgoing
                      ? palette.onPrimary
                      : palette.text,
                  }}
                >
                  {displayName}
                </Text>

                {/* Mime + size */}
                <Text
                  style={{
                    fontSize: 11,
                    marginTop: 4,
                    color: isOutgoing
                      ? palette.onPrimaryMuted ?? '#e0e0e0'
                      : palette.subtext,
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {(mime || 'Document') +
                    (sizeLabel ? ` • ${sizeLabel}` : '')}
                </Text>

                {/* Short URL / location hint */}
                {!!shortUrl && (
                  <Text
                    style={{
                      fontSize: 10,
                      marginTop: 4,
                      color: isOutgoing
                        ? palette.onPrimaryMuted ?? '#e0e0e0'
                        : palette.subtext,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {shortUrl}
                  </Text>
                )}

                {!canOpenDownloaded && renderDownloadControl(att, 'inline')}
              </View>
              {renderInlineUploadOverlay()}
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderUploadOverlay = () => {
    if (!uploadStatus || !isMe || hasAttachments) return null;
    const pct = uploadProgress != null ? Math.round(uploadProgress * 100) : null;
    const isVerifFailed = uploadStatus === 'verification_failed';
    const isFailed = uploadStatus === 'failed' || isVerifFailed;
    return (
      <Pressable
        disabled={!isFailed || !onRetry}
        hitSlop={8}
        onStartShouldSetResponder={() => isFailed}
        onPress={() => onRetry?.(message as ChatMessage)}
        style={{
          marginTop: 6,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 8,
          backgroundColor: isFailed ? 'rgba(220,38,38,0.15)' : 'rgba(0,0,0,0.12)',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {!isFailed && (
          <ActivityIndicator size="small" color={palette.primary} />
        )}
        <Text
          style={{
            fontSize: 12,
            fontWeight: '600',
            color: isFailed ? '#DC2626' : (isMe ? outgoingTextColor : (palette.subtext)),
            flexShrink: 1,
          }}
        >
          {isVerifFailed
            ? 'Verification failed'
            : isFailed
            ? 'Upload failed - tap to retry'
            : pct != null && pct > 0
            ? `Uploading ${pct}%`
            : 'Verifying…'}
        </Text>
      </Pressable>
    );
  };

  const renderInlineUploadOverlay = () => {
    if (!uploadStatus || !isMe) return null;
    const pct = uploadProgress != null ? Math.round(uploadProgress * 100) : null;
    const isVerifFailed = uploadStatus === 'verification_failed';
    const isFailed = uploadStatus === 'failed' || isVerifFailed;
    return (
      <Pressable
        disabled={!isFailed || !onRetry}
        hitSlop={8}
        onStartShouldSetResponder={() => isFailed}
        onPress={() => onRetry?.(message as ChatMessage)}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isFailed ? 'rgba(127,29,29,0.42)' : 'rgba(0,0,0,0.35)',
          padding: 12,
        }}
      >
        {!isFailed && <ActivityIndicator size="small" color="#FFFFFF" />}
        <Text
          style={{
            marginTop: isFailed ? 0 : 8,
            fontSize: 12,
            fontWeight: '700',
            color: '#FFFFFF',
            textAlign: 'center',
          }}
        >
          {isVerifFailed
            ? 'Verification failed'
            : isFailed
            ? 'Upload failed'
            : pct != null && pct > 0
            ? `Uploading ${pct}%`
            : 'Verifying...'}
        </Text>
        {isFailed && onRetry && (
          <Text
            style={{
              marginTop: 8,
              fontSize: 12,
              fontWeight: '700',
              color: '#FFFFFF',
              textDecorationLine: 'underline',
            }}
          >
            Tap to retry
          </Text>
        )}
      </Pressable>
    );
  };

  const reactionEntries = reactions
    ? Object.entries(reactions).filter(
        ([emoji, users]) => !!emoji && Array.isArray(users) && users.length > 0,
      )
    : [];

  const INVITE_PATH_RE = /\/join\/(group|community)\/([A-Za-z0-9_-]+)/;
  const URL_OR_MENTION_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+|@\w+/g;

  const openBibleReference = (ref: ParsedBibleReference) => {
    // The chat room is a full-screen overlay layered above the tab
    // navigator, not a stack screen — switching tabs underneath it doesn't
    // close it. Dismiss it explicitly so the Bible tab is actually visible.
    DeviceEventEmitter.emit('chat.close_all');
    (navigation as any).navigate('MainTabs', { screen: 'Bible' });
    openBibleVerse({
      reference: ref.reference,
      book: ref.bookCode,
      chapter: ref.chapter,
      verse: ref.verseStart,
      verseEnd: ref.verseEnd,
    });
  };

  type RichToken =
    | { type: 'text'; text: string }
    | { type: 'mention' | 'url'; text: string }
    | { type: 'bible'; text: string; bibleRef: ParsedBibleReference }
    | { type: 'bible-quote'; text: string; bibleRef: ParsedBibleReference; quote: string };

  const tokenizeRichText = (raw: string): RichToken[] => {
    // Scan for URLs/@mentions, "reference + quoted line" blocks, and bare
    // Bible references independently (each has its own capture groups),
    // then merge by position — split() can't be used for the combined
    // pattern since mismatched group counts across alternatives would
    // scramble the resulting array.
    const found: Array<{ index: number; length: number; type: 'mention' | 'url' | 'bible' | 'bible-quote'; text: string }> = [];

    const urlMentionRe = new RegExp(URL_OR_MENTION_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = urlMentionRe.exec(raw))) {
      found.push({ index: m.index, length: m[0].length, type: m[0].startsWith('@') ? 'mention' : 'url', text: m[0] });
    }

    // Quote-block matches are pushed BEFORE bare-reference matches, and
    // Array#sort is stable, so when both match at the same starting index
    // (a bare reference is always a prefix of its own quote-block match)
    // the quote-block — the longer, more specific match — sorts first and
    // wins; the bare-reference match at that same index then gets skipped
    // below as an overlap.
    const quoteBlockRe = new RegExp(BIBLE_QUOTE_BLOCK_RE.source, 'gi');
    while ((m = quoteBlockRe.exec(raw))) {
      found.push({ index: m.index, length: m[0].length, type: 'bible-quote', text: m[0] });
    }

    const bibleRe = new RegExp(BIBLE_REFERENCE_RE.source, 'gi');
    while ((m = bibleRe.exec(raw))) {
      found.push({ index: m.index, length: m[0].length, type: 'bible', text: m[0] });
    }

    found.sort((a, b) => a.index - b.index);

    const tokens: RichToken[] = [];
    let cursor = 0;
    for (const match of found) {
      if (match.index < cursor) continue; // overlaps an earlier match, skip
      if (match.index > cursor) tokens.push({ type: 'text', text: raw.slice(cursor, match.index) });
      if (match.type === 'bible-quote') {
        const block = parseBibleQuoteBlock(match.text);
        if (block) {
          tokens.push({ type: 'bible-quote', text: match.text, bibleRef: block.referenceMatch, quote: block.quote });
        } else {
          tokens.push({ type: 'text', text: match.text });
        }
      } else if (match.type === 'bible') {
        const bibleRef = parseBibleReference(match.text);
        if (bibleRef) {
          tokens.push({ type: 'bible', text: match.text, bibleRef });
        } else {
          tokens.push({ type: 'text', text: match.text });
        }
      } else {
        tokens.push({ type: match.type, text: match.text });
      }
      cursor = match.index + match.length;
    }
    if (cursor < raw.length) tokens.push({ type: 'text', text: raw.slice(cursor) });
    return tokens;
  };

  const renderRichText = (raw: string) => {
    const tokens = tokenizeRichText(raw);
    // A message that's ENTIRELY one match (e.g. just "Genesis 12:16", no
    // surrounding text) tokenizes to a single non-'text' token — length
    // alone can't tell "nothing to link" apart from "the whole thing is a
    // link", so check token type instead.
    const hasRichToken = tokens.some((t) => t.type !== 'text');
    if (!hasRichToken) {
      return <Text style={[styles.messageText, { color: textColor, fontSize: bubbleTextSize }]}>{raw}</Text>;
    }
    // outgoingTextColor is '#111111' on light bubbles, '#ffffff' on dark bubbles
    const onLightBubble = isMe && outgoingTextColor === '#111111';
    const urlColor = isMe
      ? (onLightBubble ? (palette.primary) : 'rgba(255,255,255,0.9)')
      : (palette.primary);
    const inviteColor = isMe
      ? (onLightBubble ? (palette.primaryStrong ?? palette.primary) : '#fde68a')
      : (palette.primaryStrong ?? palette.primary);
    return (
      <Text style={[styles.messageText, { color: textColor, fontSize: bubbleTextSize }]}>
        {tokens.map((token, i) => {
          if (token.type === 'mention') {
            return (
              <Pressable
                key={i}
                onPress={() => {
                  const uname = token.text.slice(1).toLowerCase();
                  const uid = mentionMap?.[uname];
                  if (uid) navigation.navigate('ViewProfile', { userId: uid, displayName: token.text.slice(1) });
                }}
              >
                <Text style={{ color: palette.mentionColor ?? palette.primary, fontWeight: '700' }}>{token.text}</Text>
              </Pressable>
            );
          }
          if (token.type === 'bible-quote') {
            return (
              <Pressable key={i} onPress={() => openBibleReference(token.bibleRef)}>
                <Text style={{ color: urlColor, fontWeight: '700', textDecorationLine: 'underline' }}>
                  {token.bibleRef.reference}
                </Text>
                <Text>{'\n'}</Text>
                <Text style={{ color: urlColor, fontStyle: 'italic', textDecorationLine: 'underline' }}>
                  “{token.quote}”
                </Text>
              </Pressable>
            );
          }
          if (token.type === 'bible') {
            return (
              <Pressable key={i} onPress={() => openBibleReference(token.bibleRef)}>
                <Text style={{ color: urlColor, fontWeight: '700', textDecorationLine: 'underline' }}>{token.text}</Text>
              </Pressable>
            );
          }
          if (token.type === 'url') {
            const inviteMatch = token.text.match(INVITE_PATH_RE);
            if (inviteMatch) {
              return (
                <Pressable
                  key={i}
                  onPress={() => navigation.navigate('InviteJoin', {
                    type: inviteMatch[1] as 'group' | 'community',
                    token: inviteMatch[2],
                  })}
                >
                  <Text style={{ color: inviteColor, fontWeight: '700', textDecorationLine: 'underline' }}>{token.text}</Text>
                </Pressable>
              );
            }
            return (
              <Pressable key={i} onPress={() => Linking.openURL(token.text).catch(() => {})}>
                <Text style={{ color: urlColor, textDecorationLine: 'underline' }}>{token.text}</Text>
              </Pressable>
            );
          }
          return <React.Fragment key={i}>{token.text}</React.Fragment>;
        })}
      </Text>
    );
  };

  /* ─────────────────────────────────────────
   * Helper: sender avatar + name (group chats)
   * ──────────────────────────────────────── */
  const renderSenderName = () => {
    if (isMe || !isFirstInGroup) return null;
    const resolvedSenderId = senderId ?? (message as any).senderId ?? '';
    const effectiveName: string =
      senderName ||
      (resolvedSenderId ? participantMap?.[resolvedSenderId] ?? '' : '');
    if (!effectiveName) return null;
    const effectiveAvatar: string | undefined =
      (message as any).senderAvatar ??
      (message as any).sender_avatar_url ??
      (resolvedSenderId ? participantAvatarMap?.[resolvedSenderId] : undefined);
    const initials = effectiveName.trim().split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
    const accentColor = palette.senderNameColor ?? palette.primary;

    const handleTap = () => {
      DeviceEventEmitter.emit('member.tap', { userId: resolvedSenderId, name: effectiveName, avatarUrl: effectiveAvatar });
    };

    return (
      <Pressable onPress={handleTap} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, overflow: 'hidden', backgroundColor: accentColor + '33', alignItems: 'center', justifyContent: 'center' }}>
          {effectiveAvatar ? (
            <Image source={{ uri: effectiveAvatar }} style={{ width: 26, height: 26 }} resizeMode="cover" />
          ) : (
            <Text style={{ fontSize: 10, fontWeight: '700', color: accentColor }}>{initials}</Text>
          )}
        </View>
        <Text style={{ fontSize: 11, fontWeight: '800', color: accentColor }} numberOfLines={1}>
          {effectiveName}
        </Text>
      </Pressable>
    );
  };

  /* ─────────────────────────────────────────
   * Helper: small "Pinned" icon next to time
   * ──────────────────────────────────────── */
  const renderPinnedIcon = () => {
    if (!isPinned) return null;

    return (
      <View style={{ marginLeft: 4 }}>
        <KISIcon
          name="pin"
          size={12}
          color={metaColor}
        />
      </View>
    );
  };

  /* ─────────────────────────────────────────
   * Helper: reply preview
   * ──────────────────────────────────────── */
  const renderReplyPreview = () => {
    if (!replySource) return null;

    const previewText =
      replySource.text ||
      replySource.styledText?.text ||
      (replySource.sticker ? 'Sticker' : '') ||
      (replySource.voice ? 'Voice message' : '') ||
      (replySource.contacts?.length ? 'Contact(s)' : '') ||
      (replySource.poll ? 'Poll' : '') ||
      (replySource.event ? 'Event' : '') ||
      '';

    const labelColor = isMe
      ? palette.replyPreviewLabelOnOutgoing ?? '#ffffffcc'
      : palette.replyPreviewLabelOnIncoming ?? palette.primary;

    const borderColor = isMe
      ? palette.replyPreviewBorderOnOutgoing ?? '#ffffff55'
      : palette.replyPreviewBorderOnIncoming ??
        (palette.primary);

    const bgColor = isMe
      ? palette.replyPreviewBgOnOutgoing ?? '#00000022'
      : palette.replyPreviewBgOnIncoming ?? '#00000011';

    return (
      <Pressable
        onPress={onPressReplySource}
        style={{
          marginBottom: 6,
          paddingVertical: 4,
          paddingHorizontal: 8,
          borderLeftWidth: 3,
          borderLeftColor: borderColor,
          borderRadius: 8,
          backgroundColor: bgColor,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '600',
            color: labelColor,
            marginBottom: 2,
          }}
        >
          Replying to
        </Text>
        {!!previewText && (
          <Text
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{
              fontSize: 12,
              color: isMe ? palette.onPrimary : palette.text,
            }}
          >
            {previewText}
          </Text>
        )}
      </Pressable>
    );
  };

  const renderReactionsRow = () => {
    if (!reactionEntries.length && !onReact) return null;

    return (
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginTop: 6,
        }}
      >
        {reactionEntries.map(([emoji, users]) => {
          const safeUsers = Array.isArray(users) ? users : [];
          const count = safeUsers.length;
          const reactedByMe = currentUserId
            ? safeUsers.includes(currentUserId)
            : false;

          return (
            <Pressable
              key={`${emoji}-${count}`}
              onPress={() => onReact?.(message as ChatMessage, emoji)}
              onLongPress={() => {
                setReactionViewerEmoji(emoji);
                setReactionViewerVisible(true);
              }}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                marginRight: 6,
                marginBottom: 6,
                backgroundColor: reactedByMe
                  ? palette.reactionActiveBg ?? '#00000022'
                  : palette.reactionBg ?? '#00000011',
                borderWidth: reactedByMe ? 1 : 0,
                borderColor: reactedByMe
                  ? palette.reactionActiveBorder ?? palette.primary
                  : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: textColor,
                  fontWeight: reactedByMe ? '600' : '400',
                }}
              >
                {emoji}
                {count > 1 ? ` ${count}` : ''}
              </Text>
            </Pressable>
          );
        })}

        {onReact && (
          <Pressable
            onPress={() => setReactionPickerVisible(true)}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
              marginRight: 6,
              marginBottom: 6,
              backgroundColor: palette.reactionAddBg ?? '#0000000d',
              borderWidth: 2,
              borderColor: palette.reactionAddBorder ?? '#00000022',
            }}
          >
            <Text style={{ fontSize: 12, color: textColor }}>+</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderRetry = () => {
    if (!showRetry || !onRetry) return null;
    return (
      <Pressable
        onPress={() => onRetry(message as ChatMessage)}
        style={{
          marginTop: 6,
          alignSelf: 'flex-end',
        }}
      >
        <Text style={{ color: palette.danger, fontSize: 12 }}>
          Tap to retry
        </Text>
      </Pressable>
    );
  };

  const renderReactionPicker = () => {
    if (!onReact) return null;

    return (
      <Modal
        transparent
        visible={reactionPickerVisible}
        animationType="fade"
        onRequestClose={() => setReactionPickerVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.35)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setReactionPickerVisible(false)}
        >
          <View
            style={{
              maxHeight: '60%',
              backgroundColor: palette.surface,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingBottom: 16,
            }}
            onStartShouldSetResponder={() => true}
          >
            <EmojiPicker
              palette={palette}
              onSelectEmoji={(emoji) => {
                setReactionPickerVisible(false);
                onReact(message as ChatMessage, emoji);
              }}
            />
          </View>
        </Pressable>
      </Modal>
    );
  };

  const renderReactionViewerSheet = () => {
    if (!reactionEntries.length) return null;

    // Determine which emoji tab to show; default to first available
    const activeEmoji =
      reactionViewerEmoji &&
      reactionEntries.some(([e]) => e === reactionViewerEmoji)
        ? reactionViewerEmoji
        : reactionEntries[0]?.[0] ?? null;

    const activeUsers = activeEmoji
      ? (reactions?.[activeEmoji] ?? [])
      : [];

    return (
      <Modal
        transparent
        visible={reactionViewerVisible}
        animationType="slide"
        onRequestClose={() => setReactionViewerVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.35)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setReactionViewerVisible(false)}
        >
          <View
            style={{
              maxHeight: '55%',
              backgroundColor: palette.surface,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingBottom: 24,
            }}
            onStartShouldSetResponder={() => true}
          >
            {/* Tab row */}
            <View
              style={{
                flexDirection: 'row',
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 8,
                borderBottomWidth: 1,
                borderBottomColor: palette.divider,
              }}
            >
              {reactionEntries.map(([emoji, users]) => {
                const isActive = emoji === activeEmoji;
                return (
                  <Pressable
                    key={emoji}
                    onPress={() => setReactionViewerEmoji(emoji)}
                    style={{
                      marginRight: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 12,
                      backgroundColor: isActive
                        ? palette.reactionActiveBg ?? '#00000022'
                        : 'transparent',
                      borderWidth: isActive ? 1 : 0,
                      borderColor: isActive
                        ? palette.reactionActiveBorder ?? palette.primary
                        : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>
                      {emoji}{' '}
                      <Text
                        style={{
                          fontSize: 12,
                          color: palette.subtext,
                        }}
                      >
                        {Array.isArray(users) ? users.length : 0}
                      </Text>
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* User list */}
            {activeUsers.map((userId) => {
              const isCurrentUser =
                currentUserId && String(userId) === String(currentUserId);
              const displayName = isCurrentUser
                ? 'You'
                : `User ${String(userId).slice(0, 6)}`;
              return (
                <View
                  key={String(userId)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: palette.divider,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor:
                        palette.surfaceSoft ?? palette.surface,
                      marginRight: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <KISIcon name="person" size={18} color={palette.subtext} />
                  </View>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: isCurrentUser ? '700' : '400',
                      color: palette.text,
                    }}
                  >
                    {displayName}
                  </Text>
                </View>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    );
  };

  /* ─────────────────────────────────────────
   * Helper: attachments renderer (defensive)
   * (for images, files, etc.)
   * ──────────────────────────────────────── */





















  /* ─────────────────────────────────────────
   * Helper: contacts card
   * ──────────────────────────────────────── */
  const renderContactsCard = () => {
    if (!contacts || !contacts.length) return null;

    const headerColor = isMe
      ? outgoingTextColor
      : palette.primary ?? palette.text;

    const phoneColor = isMe
      ? outgoingMetaColor
      : palette.subtext;

    return (
      <View
        style={{
          marginTop: text ? 8 : 0,
          paddingVertical: 8,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <KISIcon
            name="contacts"
            size={14}
            color={headerColor}
          />
          <Text
            style={{
              marginLeft: 4,
              fontSize: 12,
              fontWeight: '600',
              color: headerColor,
            }}
          >
            Shared contact{contacts.length > 1 ? 's' : ''}
          </Text>
        </View>

        {contacts.map((c, idx) => (
          <View
            key={`${c.phone}-${idx}`}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 10,
              backgroundColor: isMe
                ? palette.contactCardBgOutgoing ?? '#00000022'
                : palette.contactCardBgIncoming ?? '#00000008',
              marginBottom: idx === contacts.length - 1 ? 0 : 6,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: textColor,
              }}
            >
              {c.name}
            </Text>
            <Text
              style={{
                fontSize: 12,
                marginTop: 2,
                color: phoneColor,
              }}
            >
              {c.phone}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  /* ─────────────────────────────────────────
   * Helper: poll card (with tap-to-vote)
   * ──────────────────────────────────────── */
  const renderPollCard = () => {
    if (!poll) return null;

    const questionColor = isMe
      ? outgoingTextColor
      : palette.text;

    const optionBg = isMe
      ? palette.pollOptionBgOutgoing ?? '#00000022'
      : palette.pollOptionBgIncoming ?? '#00000008';

    const optionTextColor = isMe
      ? outgoingTextColor
      : palette.text;

    const metaTextColor = isMe
      ? outgoingMetaColor
      : palette.subtext;

    const totalVotes = poll.options.reduce(
      (sum, o) => sum + (o.votes ?? 0),
      0,
    );

    return (
      <View
        style={{
          marginTop: text ? 8 : 0,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <KISIcon
            name="poll"
            size={14}
            color={questionColor}
          />
          <Text
            style={{
              marginLeft: 4,
              fontSize: 12,
              fontWeight: '600',
              color: questionColor,
            }}
          >
            Poll
          </Text>
        </View>

        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: questionColor,
            marginBottom: 8,
          }}
        >
          {poll.question}
        </Text>

        {poll.options.map((opt, idx) => {
          const votes = opt.votes ?? 0;
          const percentage =
            totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

          const rawOptionId =
            typeof opt.id === 'string' && opt.id.length > 0 ? opt.id : String(idx);
          const optionKey =
            typeof opt.id === 'string' && opt.id.length > 0
              ? `poll-opt-${opt.id}`
              : `poll-opt-${idx}`;

          const isSelected = selectedPollOptionKey === optionKey;

          return (
            <Pressable
              key={optionKey}
              onPress={() => handlePollOptionPress(optionKey, rawOptionId)}
              style={{ marginBottom: 6 }}
            >
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: optionBg,
                  borderWidth: isSelected ? 2 : 0,
                  borderColor: isSelected
                    ? palette.pollOptionSelectedBorder ?? palette.primary
                    : 'transparent',
                  overflow: 'hidden',
                }}
              >
                {/* Percentage fill bar behind content */}
                {totalVotes > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${percentage}%`,
                      backgroundColor: isSelected
                        ? (palette.pollBarSelected ?? (palette.primary) + '44')
                        : (palette.pollBarBg ?? '#00000011'),
                      borderRadius: 10,
                    }}
                  />
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: optionTextColor, fontWeight: isSelected ? '700' : '400' }}>
                      {opt.text}
                    </Text>
                    <Text style={{ fontSize: 11, color: metaTextColor, marginTop: 2 }}>
                      {votes} vote{votes === 1 ? '' : 's'}
                      {totalVotes > 0 ? ` • ${percentage}%` : ''}
                    </Text>
                  </View>

                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={palette.primary}
                      style={{ marginLeft: 8 }}
                    />
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}

        <Text
          style={{
            fontSize: 11,
            color: metaTextColor,
            marginTop: 4,
          }}
        >
          {poll.allowMultiple ? 'Multiple choices allowed' : 'Single choice'}
          {poll.expiresAt
            ? ` • closes ${new Date(poll.expiresAt).toLocaleString()}`
            : ''}
        </Text>
      </View>
    );
  };

  /* ─────────────────────────────────────────
   * Helper: event card
   * ──────────────────────────────────────── */
  const renderEventCard = () => {
    if (!eventData) return null;

    const titleColor = isMe
      ? outgoingTextColor
      : palette.text;

    const metaTextColor = isMe
      ? outgoingMetaColor
      : palette.subtext;

    const startsRaw =
      eventData.startsAt ??
      ((eventData as any).date && (eventData as any).time
        ? `${(eventData as any).date}T${(eventData as any).time}:00`
        : undefined);
    const endsRaw =
      eventData.endsAt ??
      ((eventData as any).endDate && (eventData as any).endTime
        ? `${(eventData as any).endDate}T${(eventData as any).endTime}:00`
        : undefined);

    const starts = startsRaw ? new Date(startsRaw) : new Date(NaN);
    const ends = endsRaw ? new Date(endsRaw) : null;
    const reminderMinutes = (eventData as any).reminderMinutes;

    const formatGcalDate = (dt: Date) =>
      dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

    const buildGoogleCalendarUrl = () => {
      if (Number.isNaN(starts.getTime())) return null;
      const endTime = ends && !Number.isNaN(ends.getTime())
        ? ends
        : new Date(starts.getTime() + 60 * 60 * 1000);
      const dates = `${formatGcalDate(starts)}/${formatGcalDate(endTime)}`;
      const text = encodeURIComponent(eventData.title ?? 'Event');
      const details = encodeURIComponent(eventData.description ?? '');
      const location = encodeURIComponent(eventData.location ?? '');
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
    };

    const hasStart = !Number.isNaN(starts.getTime());

    const dateLabel = hasStart
      ? starts.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : 'Date TBD';

    const timeLabelLocal = hasStart
      ? starts.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Time TBD';

    const endTimeLabel =
      ends &&
      !Number.isNaN(ends.getTime()) &&
      ends.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });

    return (
      <View
        style={{
          marginTop: text ? 8 : 0,
          paddingVertical: 4,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <KISIcon
            name="calendar"
            size={14}
            color={titleColor}
          />
          <Text
            style={{
              marginLeft: 4,
              fontSize: 12,
              fontWeight: '600',
              color: titleColor,
            }}
          >
            Event
          </Text>
        </View>

        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: titleColor,
            marginBottom: 4,
          }}
        >
          {eventData.title}
        </Text>

        <Text
          style={{
            fontSize: 12,
            color: metaTextColor,
            marginBottom: 2,
          }}
        >
          {dateLabel} • {timeLabelLocal}
          {endTimeLabel ? ` – ${endTimeLabel}` : ''}
        </Text>

        {!!eventData.location && (
          <Text
            style={{
              fontSize: 12,
              color: metaTextColor,
              marginBottom: 2,
            }}
          >
            📍 {eventData.location}
          </Text>
        )}

        {!!eventData.description && (
          <Text
            style={{
              fontSize: 12,
              color: metaTextColor,
              marginTop: 4,
            }}
          >
            {eventData.description}
          </Text>
        )}

        {typeof reminderMinutes === 'number' && reminderMinutes > 0 && (
          <Text
            style={{
              fontSize: 11,
              color: metaTextColor,
              marginTop: 4,
            }}
          >
            Reminder: {reminderMinutes} min before
          </Text>
        )}

        {buildGoogleCalendarUrl() && (
          <Pressable
            onPress={() => {
              const url = buildGoogleCalendarUrl();
              if (url) {
                /* Protected media URLs need auth headers; do not open them in Safari. */
              }
            }}
            style={{
              alignSelf: 'flex-start',
              marginTop: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: titleColor,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                color: titleColor,
                fontWeight: '600',
              }}
            >
              Add to Google Calendar
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  /* ─────────────────────────────────────────
   * Helper: location card
   * ──────────────────────────────────────── */
  const renderLocationCard = () => {
    const locationData = (message as any).location as
      | { lat?: number; lng?: number; latitude?: number; longitude?: number; label?: string; address?: string; title?: string }
      | undefined;
    if (!locationData) return null;

    const lat = locationData.lat ?? locationData.latitude ?? 0;
    const lng = locationData.lng ?? locationData.longitude ?? 0;
    const label = locationData.label ?? locationData.title ?? locationData.address;

    const titleColor = isMe ? outgoingTextColor : palette.text;
    const metaTextColor = isMe ? outgoingMetaColor : palette.subtext;

    const mapsUrl = Platform.select({
      ios: `maps://?q=${lat},${lng}`,
      default: `https://maps.google.com/?q=${lat},${lng}`,
    });

    return (
      <View
        style={{
          marginTop: text ? 8 : 0,
          paddingVertical: 4,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <KISIcon name="pin" size={14} color={titleColor} />
          <Text
            style={{
              marginLeft: 4,
              fontSize: 12,
              fontWeight: '600',
              color: titleColor,
            }}
          >
            Location
          </Text>
        </View>

        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: titleColor,
            marginBottom: 4,
          }}
        >
          {label || 'Shared location'}
        </Text>

        <Text
          style={{
            fontSize: 12,
            color: metaTextColor,
            marginBottom: 4,
          }}
        >
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </Text>

        <Pressable
          onPress={() => {
            Linking.openURL(mapsUrl).catch(() => {});
          }}
          style={{
            alignSelf: 'flex-start',
            marginTop: 4,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: titleColor,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: titleColor,
              fontWeight: '600',
            }}
          >
            Open in Maps
          </Text>
        </Pressable>
      </View>
    );
  };

  /* ─────────────────────────────────────────
   * GAP 10: Product / catalog card
   * ──────────────────────────────────────── */
  const renderProductCard = () => {
    const productData = (message as any).product as
      | { id?: string; name: string; description?: string; price?: string; currency?: string; imageUri?: string; url?: string }
      | undefined;
    const isProduct = !!productData || (message as any).kind === 'product';
    if (!isProduct || !productData) return null;

    const priceColor = palette.primary;
    const dividerColor = palette.divider;

    return (
      <View
        style={{
          marginTop: text ? 8 : 0,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: dividerColor,
          overflow: 'hidden',
          backgroundColor: isMe
            ? 'rgba(255,255,255,0.10)'
            : (palette.surface),
          minWidth: 200,
        }}
      >
        {/* Product image */}
        {productData.imageUri ? (
          <Image
            source={{ uri: productData.imageUri }}
            style={{ width: '100%', height: 140, borderRadius: 8 }}
            resizeMode="cover"
            resizeMethod="resize"
          />
        ) : (
          <View
            style={{
              width: '100%',
              height: 140,
              borderRadius: 8,
              backgroundColor: palette.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 36 }}>🛍</Text>
          </View>
        )}

        <View style={{ padding: 10, gap: 4 }}>
          {/* Name */}
          <Text
            style={{
              fontSize: 15,
              fontWeight: '700',
              color: isMe ? outgoingTextColor : (palette.text),
            }}
            numberOfLines={2}
          >
            {productData.name}
          </Text>

          {/* Price */}
          {productData.price !== undefined && productData.price !== null ? (
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: isMe ? '#A5D6A7' : priceColor,
              }}
            >
              {productData.currency ?? '$'}{productData.price}
            </Text>
          ) : null}

          {/* Description */}
          {productData.description ? (
            <Text
              style={{
                fontSize: 13,
                color: isMe ? outgoingMetaColor : (palette.subtext),
              }}
              numberOfLines={2}
            >
              {productData.description}
            </Text>
          ) : null}

          {/* View button */}
          <View style={{ alignItems: 'flex-end', marginTop: 4 }}>
            <Pressable
              onPress={() => {
                if (productData.url) {
                  Linking.openURL(productData.url).catch(() => {
                    const { Alert: RNAlert } = require('react-native');
                    RNAlert.alert('Error', 'Could not open URL.');
                  });
                } else {
                  const { Alert: RNAlert } = require('react-native');
                  RNAlert.alert('No URL available');
                }
              }}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 10,
                backgroundColor: isMe
                  ? 'rgba(255,255,255,0.18)'
                  : (palette.primary),
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: isMe ? outgoingTextColor : (palette.onPrimary),
                }}
              >
                View
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  /* ─────────────────────────────────────────
   * Bible verse / chapter share card
   * ──────────────────────────────────────── */
  const renderBibleVerseCard = () => {
    const bibleVerse = (message as any).bibleVerse as
      | { reference: string; bookCode?: string; bookName?: string; chapter: number; verseStart?: number; verseEnd?: number; text?: string }
      | undefined;
    const isBibleVerse = !!bibleVerse || (message as any).kind === 'bible_verse';
    if (!isBibleVerse || !bibleVerse) return null;

    return (
      <Pressable
        onPress={() => {
          DeviceEventEmitter.emit('chat.close_all');
          (navigation as any).navigate('MainTabs', { screen: 'Bible' });
          openBibleVerse({
            reference: bibleVerse.reference,
            book: bibleVerse.bookCode,
            chapter: bibleVerse.chapter,
            verse: bibleVerse.verseStart,
            verseEnd: bibleVerse.verseEnd,
          });
        }}
        style={({ pressed }) => ({
          marginTop: text ? 8 : 0,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: palette.divider,
          overflow: 'hidden',
          backgroundColor: isMe ? 'rgba(255,255,255,0.10)' : (palette.surface),
          minWidth: 200,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View style={{ padding: 12, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <KISIcon name="book" size={16} color={isMe ? outgoingTextColor : palette.primary} />
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: isMe ? outgoingTextColor : palette.text,
              }}
            >
              {bibleVerse.reference}
            </Text>
          </View>
          {bibleVerse.text ? (
            <Text
              style={{
                fontSize: 13,
                fontStyle: 'italic',
                color: isMe ? outgoingMetaColor : palette.subtext,
              }}
              numberOfLines={6}
            >
              “{bibleVerse.text}”
            </Text>
          ) : null}
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: isMe ? outgoingMetaColor : palette.primary,
              alignSelf: 'flex-end',
            }}
          >
            Read in Bible →
          </Text>
        </View>
      </Pressable>
    );
  };

  /* ─────────────────────────────────────────
   * GAP 4: Payment card
   * ──────────────────────────────────────── */
  const renderPaymentCard = () => {
    const paymentData = (message as any).payment as
      | { amount: number; currency: string; note?: string; status: string; transactionId?: string; recipientName?: string }
      | undefined;
    if (!paymentData) return null;

    const statusColors: Record<string, string> = {
      completed: palette.success,
      pending: palette.gold,
      failed: palette.danger,
      cancelled: palette.subtext,
    };
    const statusLabels: Record<string, string> = {
      completed: 'Completed',
      pending: 'Pending',
      failed: 'Failed',
      cancelled: 'Cancelled',
    };
    const statusColor = statusColors[paymentData.status] ?? palette.subtext;
    const statusLabel = statusLabels[paymentData.status] ?? paymentData.status;

    const currencySymbols: Record<string, string> = {
      USD: '$', NGN: '₦', EUR: '€', GBP: '£', GHS: '₵', KES: 'Ksh',
    };
    const symbol = currencySymbols[paymentData.currency] ?? paymentData.currency;

    const emitPaymentAction = (event: 'payment.accept' | 'payment.decline', transactionId: string | undefined) => {
      try {
        const { DeviceEventEmitter } = require('react-native');
        DeviceEventEmitter.emit('payment.action', { event, transactionId });
      } catch { /* ignore */ }
    };

    const isPending = paymentData.status === 'pending' && !isMe;

    return (
      <View
        style={{
          marginTop: text ? 8 : 0,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: statusColor + '44',
          backgroundColor: isMe
            ? 'rgba(255,255,255,0.12)'
            : (palette.surfaceSoft ?? 'rgba(0,0,0,0.05)'),
          padding: 14,
          minWidth: 200,
        }}
      >
        {/* Amount */}
        <Text
          style={{
            fontSize: 26,
            fontWeight: '900',
            color: isMe ? outgoingTextColor : palette.text,
            marginBottom: 4,
          }}
        >
          {symbol}{paymentData.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>

        {/* Status badge */}
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: statusColor + '22',
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
            marginBottom: 6,
          }}
        >
          <Text style={{ fontSize: 11, color: statusColor, fontWeight: '700' }}>
            {statusLabel}
          </Text>
        </View>

        {/* Recipient */}
        {!!paymentData.recipientName && (
          <Text
            style={{
              fontSize: 12,
              color: isMe ? outgoingMetaColor : palette.subtext,
              marginBottom: 4,
            }}
          >
            To: {paymentData.recipientName}
          </Text>
        )}

        {/* Note */}
        {!!paymentData.note && (
          <Text
            style={{
              fontSize: 12,
              color: isMe ? outgoingMetaColor : palette.subtext,
              marginBottom: 4,
            }}
            numberOfLines={2}
          >
            {paymentData.note}
          </Text>
        )}

        {!!paymentData.transactionId && (
          <Text
            style={{
              fontSize: 11,
              color: isMe ? outgoingMetaColor : palette.subtext,
              marginBottom: 4,
            }}
            numberOfLines={1}
          >
            Ref: {paymentData.transactionId}
          </Text>
        )}

        {/* Accept / Decline buttons for pending incoming payments */}
        {isPending && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={() => emitPaymentAction('payment.accept', paymentData.transactionId)}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: palette.success,
                borderRadius: 10,
                paddingVertical: 10,
                alignItems: 'center',
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={{ color: palette.ivory, fontWeight: '700', fontSize: 13 }}>Accept</Text>
            </Pressable>
            <Pressable
              onPress={() => emitPaymentAction('payment.decline', paymentData.transactionId)}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: `${palette.danger}22`,
                borderRadius: 10,
                paddingVertical: 10,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: palette.danger,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={{ color: palette.danger, fontWeight: '700', fontSize: 13 }}>Decline</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  /* ─────────────────────────────────────────
   * -1) Deleted message placeholder
   * ──────────────────────────────────────── */
  if (isDeleted) {
    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.messageRowMe : styles.messageRowThem,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: deletedBubbleColor,
            },
            pinnedStyle || undefined,
            selectedStyle || undefined,
            highlightedStyle || undefined,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              {
                color: deletedTextColor,
                fontStyle: 'italic',
              },
            ]}
          >
            Message deleted
          </Text>

          {renderReactionsRow()}
          {renderRetry()}

          <View style={styles.messageMetaRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={[
                  styles.messageTime,
                  {
                    color: isDeleted ? deletedMetaColor : metaColor,
                  },
                ]}
              >
                {timeLabel}
              </Text>
              {renderPinnedIcon()}
            </View>

            {isMe && status && (
              <View style={{ marginLeft: 4, alignSelf: 'center' }}>
                {renderStatusIcon(status, statusColor, 13)}
              </View>
            )}
          </View>
        </View>

        {renderReactionPicker()}
        {renderReactionViewerSheet()}
      </View>
    );
  }

  /* ─────────────────────────────────────────
   * 0) Sticker bubble
   * ──────────────────────────────────────── */
  if (sticker?.uri) {
    const stickerWidth = sticker.width ?? 180;
    const stickerHeight = sticker.height ?? 180;

    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.messageRowMe : styles.messageRowThem,
        ]}
      >
        <View
          style={[
            {
              maxWidth: stickerWidth,
              borderRadius: 16,
              overflow: 'visible',
              backgroundColor: 'transparent',
            },
            pinnedStyle || undefined,
            selectedStyle || undefined,
            highlightedStyle || undefined,
          ]}
        >
          {renderSenderName()}
          {renderReplyPreview()}

          <Image
            source={{ uri: sticker.uri }}
            style={{ width: stickerWidth, height: stickerHeight }}
            resizeMode="contain"
            resizeMethod="resize"
          />

          {renderReactionsRow()}
          {renderRetry()}

          {/* time + ticks row */}
          <View
            style={[
              styles.messageMetaRow,
              { paddingHorizontal: 6, paddingBottom: 4 },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={[
                  styles.messageTime,
                  {
                    color: metaColor,
                  },
                ]}
              >
                {timeLabel}
                {isEdited ? ' • edited' : ''}
              </Text>
              {renderPinnedIcon()}
            </View>

            {isMe && status && (
              <View style={{ marginLeft: 4, alignSelf: 'center' }}>
                {renderStatusIcon(status, statusColor, 13)}
              </View>
            )}
          </View>
        </View>

        {renderReactionPicker()}
        {renderReactionViewerSheet()}
      </View>
    );
  }

  /* ─────────────────────────────────────────
   * 1) Styled text card (background + font)
   * ──────────────────────────────────────── */
  if (styled) {
    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.messageRowMe : styles.messageRowThem,
        ]}
      >
        <View
          style={[
            {
              maxWidth: '80%',
              borderRadius: 18,
              overflow: 'hidden',
              backgroundColor: styled.backgroundColor,
              paddingHorizontal: 16,
              paddingVertical: 12,
            },
            pinnedStyle || undefined,
            selectedStyle || undefined,
            highlightedStyle || undefined,
          ]}
        >
          {renderSenderName()}
          {renderReplyPreview()}

          <Text
            style={{
              fontSize: styled.fontSize,
              color: styled.fontColor,
              fontFamily: styled.fontFamily || undefined,
              textAlign: 'center',
            }}
          >
            {styled.text}
          </Text>

          {renderReactionsRow()}
          {renderRetry()}

          {/* time + ticks row */}
          <View style={styles.messageMetaRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={[
                  styles.messageTime,
                  {
                    color: metaColor,
                  },
                ]}
              >
                {timeLabel}
                {isEdited ? ' • edited' : ''}
              </Text>
              {renderPinnedIcon()}
            </View>

            {isMe && status && (
              <View style={{ marginLeft: 4, alignSelf: 'center' }}>
                {renderStatusIcon(status, statusColor, 13)}
              </View>
            )}
          </View>
        </View>

        {renderReactionPicker()}
        {renderReactionViewerSheet()}
      </View>
    );
  }

  /* ─────────────────────────────────────────
   * 2) Voice-only bubble
   * ──────────────────────────────────────── */
  if (isVoiceOnly && voice && isTopLevelViewOnce && !isMe && !topLevelViewOnceViewed) {
    // Gate the whole player behind "Tap to view" — showing the normal
    // player here would let the receiver play (and thus keep) the audio
    // without ever going through the viewer modal + deletion flow below.
    return (
      <View style={[styles.messageRow, styles.messageRowThem]}>
        <View style={[bubbleBaseStyle, pinnedStyle || undefined, selectedStyle || undefined, highlightedStyle || undefined]}>
          {renderSenderName()}
          {renderReplyPreview()}
          <Pressable
            onPress={openViewOnceViewer}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: (palette.primarySoft ?? (palette.primary ? palette.primary + '22' : 'rgba(0,0,0,0.08)')),
            }}
          >
            <KISIcon name="eye" size={18} color={palette.primary} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: palette.primary }}>
              Tap to view
            </Text>
          </Pressable>
        </View>
        {renderViewOnceModal()}
      </View>
    );
  }

  if (isVoiceOnly && voice) {
    const durationLabel = formatTimeFromMs(
      isPlaying ? playbackPositionMs : playbackDurationMs || voice.durationMs,
    );
    const totalDurationLabel = formatTimeFromMs(playbackDurationMs || voice.durationMs);

    const voiceMessageId = String((message as any).serverId ?? (message as any).id ?? '');
    // Falls back to objectKey for messages persisted before mediaAssetId
    // existed as its own field — see chatTypes.ts's VoiceAttachment and
    // voice-playback.service.ts's identical fallback on the Nest side.
    const voiceMediaAssetId = ((voice as any).mediaAssetId || (voice as any).objectKey) as string | undefined;

    // Canonical resolution (see voiceAttachment.ts): local file first (the
    // sender's own device, right after recording/before upload confirms),
    // then a freshly-resolved url from Nest (remoteResolvedUrl, set after
    // handleVoicePress/onError below calls resolveFreshVoicePlaybackUrl),
    // then voice.url/voice.uri, then the parallel attachments[0] entry every
    // voice message also carries as a redundant, independently-persisted
    // copy — the only thing that saved receivers from an unplayable voice
    // note before VoiceMeta declared url/objectKey on the backend.
    const localPlaybackUri = (voice as any).localUri ??
      ((voice as any).localPath ? fileUriForPath((voice as any).localPath) : undefined);
    const remoteVoiceCandidate =
      remoteResolvedUrl || resolveEmbeddedVoicePlaybackUri(voice, attachments[0]?.url);
    const resolvedRemoteUri = remoteVoiceCandidate
      ? resolveBackendAssetUrl(remoteVoiceCandidate) ?? remoteVoiceCandidate
      : null;
    const voicePlaybackUri: string | null = localPlaybackUri ?? resolvedRemoteUri ?? null;

    // A message still being sent/uploaded legitimately has no playable url
    // yet — that is not the same as a genuinely broken/missing voice note,
    // and must not show the "Cannot play this" failure state prematurely.
    const voiceReadiness = classifyVoicePlaybackReadiness(voicePlaybackUri, status);
    const isVoiceStillResolving = voiceReadiness === 'resolving' || voiceResolving;
    // "unavailable" only means truly unrecoverable — no local file, no
    // embedded url, AND no mediaAssetId to refresh one via Nest. When a
    // mediaAssetId IS present, tapping play should try the resolver instead
    // of immediately declaring the note unplayable (see handleVoicePress).
    const isVoiceRecoverableViaResolver = voiceReadiness === 'unavailable' && Boolean(voiceMediaAssetId);
    const isVoiceUnavailable = voiceReadiness === 'unavailable' && !isVoiceRecoverableViaResolver;

    const handleVoicePress = async () => {
      if (voicePlaybackUri) {
        handleTogglePlay();
        return;
      }
      if (!isVoiceRecoverableViaResolver || !voiceMessageId) return;
      setVoicePlaybackError(null);
      setVoiceResolving(true);
      try {
        const resolved = await resolveFreshVoicePlaybackUrl(voiceMessageId);
        if (!voiceMountedRef.current) return; // bubble unmounted mid-request
        setVoiceResolving(false);
        setRemoteResolvedUrl(resolved.url);
        beginPlayback();
      } catch (error) {
        if (!voiceMountedRef.current) return;
        setVoiceResolving(false);
        setVoicePlaybackError(describeVoicePlaybackError(error));
      }
    };

    const voicePlaybackSource = voicePlaybackUri
      ? {
          uri: voicePlaybackUri,
          ...(voicePlaybackUri.startsWith(API_BASE_URL) && Object.keys(mediaHeaders).length
            ? { headers: mediaHeaders }
            : {}),
        }
      : null;

    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.messageRowMe : styles.messageRowThem,
        ]}
      >
        <View
          style={[
            bubbleBaseStyle,
            pinnedStyle || undefined,
            selectedStyle || undefined,
            highlightedStyle || undefined,
            { width: width / 2 },
          ]}
        >
          {renderSenderName()}
          {renderReplyPreview()}

          {isTopLevelViewOnce && isMe && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <KISIcon name="eye" size={12} color={outgoingTextColor === '#111111' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.65)'} />
              <Text style={{ fontSize: 10, color: outgoingTextColor === '#111111' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.65)', fontWeight: '600' }}>
                View once
              </Text>
            </View>
          )}

          {voicePlaybackSource ? (
            <Video
              ref={voiceVideoRef}
              source={voicePlaybackSource}
              paused={!isPlaying}
              rate={playbackSpeed}
              volume={1}
              muted={false}
              controls={false}
              audioOutput="speaker"
              ignoreSilentSwitch="ignore"
              mixWithOthers="duck"
              playInBackground={false}
              playWhenInactive={false}
              progressUpdateInterval={100}
              onLoadStart={() => {
                if (isPlaying) setVoiceBuffering(true);
              }}
              onLoad={({ duration }) => {
                const durationMs = Math.max(0, Number(duration || 0) * 1000);
                if (durationMs > 0) setPlaybackDurationMs(durationMs);
                setVoiceBuffering(false);
              }}
              onBuffer={({ isBuffering }) => setVoiceBuffering(isBuffering)}
              onProgress={({ currentTime }) => {
                const positionMs = Math.max(0, Number(currentTime || 0) * 1000);
                const durationMs = playbackDurationMs || voice.durationMs || 0;
                setVoiceBuffering(false);
                setPlaybackPositionMs(positionMs);
                setProgress(durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0);
              }}
              onEnd={() => stopPlayback(true)}
              onError={(error) => {
                if (__DEV__) {
                  console.warn('[MessageBubble] voice media error', {
                    sourceUrl: safeUrlForLog(voicePlaybackUri ?? undefined),
                    error,
                  });
                }
                stopPlayback(false);
                // One automatic retry: the embedded/cached url may simply
                // be expired. Force-refresh via Nest and retry play once
                // before showing a failure — see voiceRetriedRef (reset in
                // beginPlayback so a later, separate attempt gets its own
                // budget).
                if (!voiceRetriedRef.current && voiceMediaAssetId && voiceMessageId) {
                  voiceRetriedRef.current = true;
                  setVoiceBuffering(true);
                  resolveFreshVoicePlaybackUrl(voiceMessageId, { force: true })
                    .then((resolved) => {
                      if (!voiceMountedRef.current) return;
                      setRemoteResolvedUrl(resolved.url);
                      beginPlayback();
                    })
                    .catch((refreshError) => {
                      if (!voiceMountedRef.current) return;
                      setVoiceBuffering(false);
                      setVoicePlaybackError(describeVoicePlaybackError(refreshError));
                    });
                  return;
                }
                // react-native-video's onError doesn't reliably surface the
                // underlying HTTP status (401/403/404 vs a network/format
                // failure all collapse into the same generic decoder error
                // on both ExoPlayer and AVPlayer) — this is the honest,
                // achievable message rather than a fabricated status code.
                setVoicePlaybackError('Unable to play this voice message. Check your connection and try again.');
              }}
              style={styles.hiddenVoicePlayer}
            />
          ) : null}

          <Pressable
            onPress={() => {
              void handleVoicePress();
            }}
            disabled={!voicePlaybackSource && !isVoiceRecoverableViaResolver}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              opacity: voicePlaybackSource || isVoiceRecoverableViaResolver ? 1 : 0.5,
            }}
          >
            {isVoiceStillResolving || voiceBuffering ? (
              <ActivityIndicator size="small" color={palette.primary} />
            ) : (
              <KISIcon
                name={isPlaying ? 'pause' : 'play'}
                size={20}
                color={palette.primary}
              />
            )}

            <View style={{ flex: 1, marginHorizontal: 8 }}>
              {/* progress track */}
              <View
                style={{
                  height: 3,
                  borderRadius: 999,
                  backgroundColor: palette.primary,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: 3,
                    width: `${Math.round(progress * 100)}%`,
                    backgroundColor: isMe
                      ? palette.onPrimary
                      : palette.primary,
                  }}
                />
              </View>

              {/* duration */}
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: metaColor,
                }}
              >
                {durationLabel}{isPlaying && totalDurationLabel ? ` / ${totalDurationLabel}` : ''}
              </Text>
            </View>
          </Pressable>

          {!(voice as any).localPath && !(voice as any).localUri && resolvedRemoteUri && renderDownloadControl(
            {
              key: String((message as any).serverId ?? messageId ?? voice.uri ?? 'voice'),
              // Voice notes aren't tracked in the Nest attachments[] id
              // contract (they upload via Django's legacy multipart
              // endpoint — see uploadFileToBackend.ts's isNestChatBackend
              // check), so this always falls back to the legacy
              // authenticated-by-url path in downloadFile rather than the
              // Nest id-based download-url flow.
              attachmentId: undefined,
              uri: resolvedRemoteUri,
              mime: (voice as any).mimeType || 'audio/mp4',
              name: String((voice as any).fileName ?? (voice as any).name ?? `voice_${messageId ?? Date.now()}.m4a`),
            } as NormalizedAttachment,
            'inline',
          )}

          {voicePlaybackError || isVoiceUnavailable ? (
            <Text style={{ marginTop: 6, fontSize: 11, color: palette.danger }}>
              {voicePlaybackError || 'This voice message could not be found. It may still be uploading, or the sender may need to resend it.'}
            </Text>
          ) : null}

          {/* Speed control + Transcription */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 12 }}>
            <Pressable
              onPress={handleCycleSpeed}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : (palette.surfaceSoft ?? '#0000000D'),
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: isMe ? '#fff' : palette.primary }}>
                {playbackSpeed}x
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void handleShowTranscription()}
              disabled={transcribing}
              style={{ opacity: transcribing ? 0.5 : 1 }}
            >
              <Text style={{ fontSize: 11, color: metaColor }}>
                {transcribing ? 'Transcribing…' : showTranscription ? 'Hide transcript' : 'Transcript'}
              </Text>
            </Pressable>
          </View>
          {showTranscription && transcription ? (
            <View
              style={{
                marginTop: 4,
                paddingVertical: 6,
                paddingHorizontal: 8,
                borderRadius: 8,
                backgroundColor: isMe ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.06)',
              }}
            >
              <Text style={{ fontSize: 12, color: textColor, fontStyle: 'italic' }}>{transcription}</Text>
            </View>
          ) : null}

          {renderUploadOverlay()}
          {renderReactionsRow()}
          {renderRetry()}

          {/* time + ticks row */}
          <View style={styles.messageMetaRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={[
                  styles.messageTime,
                  {
                    color: metaColor,
                  },
                ]}
              >
                {timeLabel}
                {isEdited ? ' • edited' : ''}
              </Text>
              {renderPinnedIcon()}
            </View>

            {isMe && status && (
              <View style={{ marginLeft: 4, alignSelf: 'center' }}>
                {renderStatusIcon(status, statusColor, 13)}
              </View>
            )}
          </View>
        </View>

        {renderReactionPicker()}
        {renderReactionViewerSheet()}
      </View>
    );
  }

  /* ─────────────────────────────────────────
   * 3) Default text + contacts/poll/event + attachments bubble
   * ──────────────────────────────────────── */
  return (
    <View
      style={[
        styles.messageRow,
        isMe ? styles.messageRowMe : styles.messageRowThem,
      ]}
    >
      <View
        style={[
          bubbleBaseStyle,
          pinnedStyle || undefined,
          selectedStyle || undefined,
          highlightedStyle || undefined,
          { maxWidth: bubbleMaxWidth, paddingHorizontal: bubblePaddingX },
        ]}
      >
        {renderSenderName()}
        {renderReplyPreview()}

        {/* View-once label on sender side */}
        {isTopLevelViewOnce && isMe && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <KISIcon name="eye" size={12} color={outgoingTextColor === '#111111' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.65)'} />
            <Text style={{ fontSize: 10, color: outgoingTextColor === '#111111' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.65)', fontWeight: '600' }}>
              View once
            </Text>
          </View>
        )}

        {/* View-once overlay for incoming view-once messages of any kind
            (text, attachments, or — post-strip, once its content is gone —
            whatever this message used to be). Gates text AND attachments
            below; a not-yet-viewed message shows only this. */}
        {isTopLevelViewOnce && !isMe && (
          topLevelViewOnceViewed ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}>
              <KISIcon name="eye-closed" size={16} color={palette.subtext} />
              <Text style={{ fontSize: 13, color: palette.subtext, fontStyle: 'italic' }}>Opened</Text>
            </View>
          ) : (
            <Pressable
              onPress={openViewOnceViewer}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: (palette.primarySoft ?? (palette.primary ? palette.primary + '22' : 'rgba(0,0,0,0.08)')),
              }}
            >
              <KISIcon name="eye" size={18} color={palette.primary} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: palette.primary }}>
                Tap to view
              </Text>
            </Pressable>
          )
        )}

        {!!text && (!isTopLevelViewOnce || isMe || topLevelViewOnceViewed) && (
          <View>
            {renderRichText((displayText ?? '') + (isLongText && !expanded ? '…' : ''))}
            {isLongText && (
              <Pressable onPress={() => setExpanded(prev => !prev)} style={{ marginTop: 2 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: isMe ? 'rgba(255,255,255,0.75)' : (palette.primary) }}>
                  {expanded ? t('Show less') : t('Read more')}
                </Text>
              </Pressable>
            )}
            {isEdited && (
              <Text style={{ fontSize: 10, color: metaColor, marginTop: 2 }}>(edited)</Text>
            )}
          </View>
        )}

        {/* Shown briefly while decryption is in-flight after a reload */}
        {hasEncryptedPayload && !text && !voice && !styled && !sticker && !hasAttachments && !contacts && !poll && !eventData && (
          <Text style={{ fontSize: 13, color: metaColor, fontStyle: 'italic' }}>🔒</Text>
        )}

        {/* Translation */}
        {text && text.length > 15 && !isMe && !translatedText && (
          <Pressable
            onPress={() => void handleTranslate()}
            style={{ marginTop: 4, opacity: translating ? 0.5 : 1 }}
            disabled={translating}
          >
            <Text style={{ color: palette.subtext, fontSize: 11 }}>
              {translating ? `🌐 ${t('Translating...')}` : `🌐 ${t('Translate')}`}
            </Text>
          </Pressable>
        )}
        {translating && isMe && (
          <Text style={{ fontSize: 11, color: palette.subtext, marginTop: 4 }}>🌐 {t('Translating...')}</Text>
        )}
        {translatedText && (
          <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.2)' }}>
            <Text style={{ fontSize: 10, color: palette.subtext, marginBottom: 2 }}>
              🌐 {t('Translation')}
            </Text>
            <Text style={{ color: isMe ? '#fff' : (palette.text), fontSize: 14 }}>{translatedText}</Text>
            <Pressable onPress={() => setTranslatedText(null)}>
              <Text style={{ fontSize: 10, color: palette.subtext, marginTop: 2 }}>
                {t('Hide')}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Link preview card */}
        {linkPreview && linkPreview.title && (
          <Pressable
            onPress={() => { const u = linkPreview.url ?? linkPreviewUrl; if (u) Linking.openURL(u).catch(() => {}); }}
            style={{
              marginTop: 6,
              borderRadius: 10,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: isMe ? 'rgba(255,255,255,0.2)' : (palette.divider),
              backgroundColor: isMe ? 'rgba(0,0,0,0.08)' : (palette.surface),
            }}
          >
            {linkPreview.image ? (
              <Image
                source={{ uri: linkPreview.image }}
                style={{ width: '100%', height: 120 }}
                resizeMode="cover"
                resizeMethod="resize"
              />
            ) : null}
            <View style={{ padding: 8, gap: 2 }}>
              {linkPreview.site_name ? (
                <Text style={{ fontSize: 10, color: palette.primary, fontWeight: '700', textTransform: 'uppercase' }}>
                  {linkPreview.site_name}
                </Text>
              ) : null}
              <Text style={{ fontSize: 13, fontWeight: '700', color: isMe ? '#fff' : (palette.text) }} numberOfLines={2}>
                {linkPreview.title}
              </Text>
              {linkPreview.description ? (
                <Text style={{ fontSize: 11, color: isMe ? 'rgba(255,255,255,0.7)' : (palette.subtext) }} numberOfLines={2}>
                  {linkPreview.description}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}

        {/* KIS invite card */}
        {inviteInfo && (() => {
          const onLight = isMe && outgoingTextColor === '#111111';
          const cardBorder = isMe
            ? (onLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.25)')
            : (palette.primary);
          const cardBg = isMe
            ? (onLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)')
            : (palette.primarySoft ?? (palette.primary ? palette.primary + '18' : '#e8f0fe'));
          const iconColor = isMe
            ? (onLight ? (palette.primary) : '#fde68a')
            : (palette.primary);
          const labelColor = isMe
            ? (onLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)')
            : (palette.subtext);
          const titleColor = isMe ? outgoingTextColor : (palette.text);
          const chevronColor = isMe
            ? (onLight ? (palette.primary) : 'rgba(255,255,255,0.6)')
            : (palette.primary);
          return (
            <Pressable
              onPress={() => navigation.navigate('InviteJoin', inviteInfo)}
              style={{
                marginTop: 8,
                borderRadius: 12,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: cardBorder,
                backgroundColor: cardBg,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 10,
                gap: 10,
              }}
            >
              <KISIcon name="group" size={20} color={iconColor} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: labelColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {inviteInfo.type === 'community' ? 'Community Invite' : 'Group Invite'}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: titleColor, marginTop: 1 }}>
                  Tap to join {inviteInfo.type}
                </Text>
              </View>
              <KISIcon name="chevron-right" size={16} color={chevronColor} />
            </Pressable>
          );
        })()}

        {(!isTopLevelViewOnce || isMe || topLevelViewOnceViewed) && (
          <>
            {/* Contacts / Poll / Event / Location / Product / Payment cards */}
            {renderContactsCard()}
            {renderPollCard()}
            {renderEventCard()}
            {renderLocationCard()}
            {renderProductCard()}
            {renderBibleVerseCard()}
            {renderPaymentCard()}

            {/* Attachments (images, files, etc.) */}
            {renderAttachments(attachments, (message as any).fromMe)}
          </>
        )}

        {renderUploadOverlay()}
        {renderReactionsRow()}
        {renderRetry()}

        <View style={styles.messageMetaRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {isStarred && (
              <Text style={{ fontSize: 11 }}>⭐</Text>
            )}
            {disappearSecsLeft !== null && disappearSecsLeft > 0 && (
              <Text style={{ fontSize: 10, color: metaColor }}>
                ⏱ {disappearSecsLeft < 60
                  ? `${disappearSecsLeft}s`
                  : disappearSecsLeft < 3600
                  ? `${Math.floor(disappearSecsLeft / 60)}m`
                  : `${Math.floor(disappearSecsLeft / 3600)}h`}
              </Text>
            )}
            <Text
              style={[
                styles.messageTime,
                { color: metaColor },
              ]}
            >
              {timeLabel}
              {isEdited ? ' • edited' : ''}
            </Text>
            {renderPinnedIcon()}
          </View>

          {isMe && status && (
            <Pressable
              onPress={() => onShowReadReceipts?.(message as ChatMessage)}
              style={{ marginLeft: 4, alignSelf: 'center' }}
              hitSlop={6}
            >
              {renderStatusIcon(status, statusColor, 13)}
            </Pressable>
          )}
        </View>
      </View>

      {renderReactionPicker()}
      {renderReactionViewerSheet()}

      {/* Fullscreen video player */}
      {videoFullscreen && (
        <Modal
          visible
          transparent={false}
          animationType="fade"
          onRequestClose={() => { setVideoFullscreen(null); setVideoFullscreenUseRemote(false); }}
          statusBarTranslucent
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top']}>
            <Video
              source={{
                uri: (!videoFullscreenUseRemote && videoFullscreen.localUri) || videoFullscreen.remoteUri,
              }}
              style={{ flex: 1 }}
              resizeMode="contain"
              controls
              onError={() => {
                // Local file is stale/missing (e.g. after a reload wiped the
                // sandbox container it was captured under) — fall back to
                // the remote CDN url instead of a black screen.
                if (!videoFullscreenUseRemote && videoFullscreen.localUri) {
                  setVideoFullscreenUseRemote(true);
                }
              }}
            />
            <Pressable
              onPress={() => { setVideoFullscreen(null); setVideoFullscreenUseRemote(false); }}
              style={{ position: 'absolute', top: 8, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </SafeAreaView>
        </Modal>
      )}
      {renderViewOnceModal()}
    </View>
  );
};
