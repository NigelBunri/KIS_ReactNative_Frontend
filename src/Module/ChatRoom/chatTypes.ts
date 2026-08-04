import type { Chat } from './messagesUtils';

/**
 * ============================================================================
 * CHAT DOMAIN TYPES (OFFLINE-FIRST, WHATSAPP-STYLE)
 * ============================================================================
 *
 * This file defines the authoritative frontend chat domain model.
 * It is intentionally verbose and explicit to guarantee:
 *
 *  - Offline-first behavior
 *  - Deterministic identity & deduplication
 *  - Safe retries without duplication
 *  - Proper ACK reconciliation with the backend
 *  - TypeScript strictness (no `string | undefined` leaks)
 *
 * Architectural principles followed here:
 *
 * 1. Every message ALWAYS has a client-generated ID (clientId)
 * 2. `id` is NEVER undefined (initially equals clientId)
 * 3. `serverId` is assigned later by the backend ACK
 * 4. clientId is the deduplication + retry key
 * 5. serverId is the authoritative DB identity
 *
 * This mirrors WhatsApp / Signal / iMessage design.
 * ============================================================================
 */

/* ============================================================================
 * MESSAGE KIND
 * ============================================================================
 */

/**
 * Message kind must match backend enum:
 * 'text' | 'voice' | 'styled_text' | 'sticker' | 'contacts' | 'poll' | 'event' | 'system'
 *
 * NOTE:
 * - Media/files are represented via attachments
 * - `kind` describes semantic intent, not transport
 */
export type MessageKind =
  | 'text'
  | 'voice'
  | 'styled_text'
  | 'sticker'
  | 'system'
  | 'contacts'
  | 'poll'
  | 'event'
  | 'location'
  | 'attachment'
  | 'call_event';

/* ============================================================================
 * MESSAGE STATUS (STATE MACHINE)
 * ============================================================================
 */

/**
 * Message lifecycle states.
 *
 * local_only  → exists only on device, never attempted to send
 * pending     → queued, awaiting network
 * sending     → send in progress
 * sent        → ACKed by server (serverId assigned)
 * delivered   → delivered to recipient device
 * read        → read by recipient
 * failed      → send attempt failed (retryable)
 */
export type MessageStatus =
  | 'local_only'
  | 'pending'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

/* ============================================================================
 * ATTACHMENTS
 * ============================================================================
 */

/**
 * Kind of attachment file (frontend side).
 * Backend also has AttachmentKind; keep in sync if needed.
 */
export type AttachmentKindType =
  | 'image'
  | 'video'
  | 'file'
  | 'audio'
  | 'voice'
  | 'other';

/**
 * Attachment payload coming from / going to backend.
 * Mirrors the Mongoose / ORM schema for attachments.
 */
export type ChatAttachment = {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;

  kind?: AttachmentKindType | string;

  width?: number;
  height?: number;
  durationMs?: number;
  thumbUrl?: string;

  /** View-once media: auto-deletes after recipient opens it */
  viewOnce?: boolean;
  viewedAt?: string;
};

export type ChatMediaPayload = {
  attachments?: ChatAttachment[];
  [key: string]: any;
};

/* ============================================================================
 * VOICE NOTES
 * ============================================================================
 */

/**
 * Canonical voice-note attachment shape — the ONE structure sender-side
 * optimistic drafts, confirmed sends, and receiver hydration all populate
 * identically. Previously the sender wrote `voice.uri` (a field the
 * backend's Mongoose VoiceMeta schema didn't declare at all) while
 * confirmed/received messages used `voice.url` — and until VoiceMeta
 * declared these fields, EVERY field except `durationMs` was silently
 * stripped on persistence regardless of naming, which was the actual root
 * cause of voice notes being unplayable for receivers (see
 * backend/Nestjs's message.schema.ts VoiceMeta / messages.dto.ts VoiceDto).
 *
 * `objectKey` (Django's MediaAsset id) is the STABLE identity — safe to
 * keep indefinitely and re-resolve a fresh signed `url` from later. `url`
 * itself is a snapshot of the last-known signed download URL and WILL
 * expire; never treat it as permanent identity (see
 * requestVoiceDownloadUrl in voiceAttachment.ts for the refresh path).
 */
export type VoiceAttachment = {
  /** Legacy field, kept for backward compatibility with existing local
   * playback code paths — prefer `url`/`mediaAssetId` in new code. Always
   * populated (falls back to url/mediaAssetId when nothing else is available). */
  uri: string;
  url?: string;
  /** Django MediaAsset.id (UUID) — the PERMANENT identity, never an
   * expiring URL. Send this to Nest's GET
   * /chat/messages/:messageId/voice/playback-url to refresh an
   * expired/expiring `url` (see voicePlaybackResolver.ts). */
  mediaAssetId?: string;
  /** Display/back-compat only — Django's legacy upload endpoint never
   * returns the real S3 key to a client, so this is NOT a trustworthy
   * object key today; historically it was populated with the same value as
   * mediaAssetId. Never send this to a playback/download endpoint as if it
   * were a real storage key — the server always re-derives the object from
   * its own persisted record. */
  objectKey?: string;
  /** Stable id for the underlying upload (Django UploadFileView's local id or assetId). */
  id?: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  durationMs: number;
  waveform?: number[];
  /** ISO-8601. Advisory only — the freshness check that actually matters
   * happens against voicePlaybackResolver.ts's own cache, not this field;
   * kept for parity with what the server may echo back. */
  urlExpiresAt?: string;
  /** Present only on the sender's own device before/shortly after upload. */
  localUri?: string;
  localPath?: string;
  name?: string;
};

/* ============================================================================
 * CONTACT SHARING
 * ============================================================================
 */

/**
 * Contact card(s) shared in a message.
 */
export type ContactAttachment = {
  id: string;
  name: string;
  phone: string;
};

/* ============================================================================
 * POLLS
 * ============================================================================
 */

export type PollOption = {
  id: string;
  text: string;
  votes?: number;
  voterIds?: string[];
};

export type PollMessage = {
  id?: string;
  question: string;
  options: PollOption[];
  allowMultiple?: boolean;
  expiresAt?: string | null;
};

/* ============================================================================
 * EVENTS
 * ============================================================================
 */

export type EventMessage = {
  id?: string;
  title: string;
  description?: string;
  location?: string;
  startsAt?: string;
  endsAt?: string;
  reminderMinutes?: number;
};

/* ============================================================================
 * LOCATION
 * ============================================================================
 */

export type LocationMessage = {
  latitude: number;
  longitude: number;
  address?: string;
  title?: string;
  isLive?: boolean;
  expiresAt?: number | string;
};

/* ============================================================================
 * READ RECEIPT (per-user, groups)
 * ============================================================================
 */

export type ReadByEntry = {
  userId: string;
  displayName?: string;
  readAt: string;
  atMs?: number;
  deviceId?: string;
};

/* ============================================================================
 * CORE CHAT MESSAGE TYPE
 * ============================================================================
 */

/**
 * ChatMessage is the SINGLE source of truth for message state on the client.
 *
 * IMPORTANT INVARIANTS:
 * ---------------------
 * - `id` is ALWAYS defined
 * - `clientId` is ALWAYS defined
 * - `id === clientId` until the backend ACK assigns `serverId`
 * - `serverId` is optional and appears only after server persistence
 */
export type ChatMessage = {
  /**
   * Stable identifier used by UI & storage.
   *
   * Before ACK: id === clientId
   * After  ACK: id remains unchanged (do NOT overwrite)
   */
  id: string;

  /**
   * Backend conversation identifier.
   *
   * This is what the server expects as conversationId.
   * Optional to allow local-only / draft rooms.
   */
  conversationId?: string;

  /**
   * Local storage / UI room identifier.
   * Always defined.
   */
  roomId: string;

  /**
   * Client-generated identifier.
   *
   * REQUIRED.
   * Used for:
   * - deduplication
   * - retries
   * - ACK correlation
   */
  clientId: string;

  /**
   * Authoritative server identifier.
   *
   * Assigned ONLY after successful persistence on backend.
   */
  serverId?: string;

  /**
   * Monotonic per-conversation sequence (from backend).
   * Use for strict ordering when available.
   */
  seq?: number;

  createdAt: string;
  updatedAt?: string;

  senderId: string;

  /**
   * Backend flag for conversation bootstrap logic.
   */
  isFirstMessage?: boolean;

  senderName?: string;

  fromMe: boolean;

  kind?: MessageKind;
  status?: MessageStatus;

  /**
   * Plain text payload.
   */
  text?: string;
  ciphertext?: string;
  encryptionMeta?: Record<string, any>;
  iv?: string;
  tag?: string;
  aad?: string;
  encryptionVersion?: string;
  encryptionKeyVersion?: string;

  voice?: VoiceAttachment;

  styledText?: {
    text: string;
    backgroundColor: string;
    fontSize: number;
    fontColor: string;
    fontFamily?: string;
  };

  sticker?: {
    id: string;
    uri: string;
    text?: string;
    width?: number;
    height?: number;
  };

  attachments?: ChatAttachment[];

  /** Encrypted media/file metadata. `attachments` is only the UI projection. */
  media?: ChatMediaPayload;

  contacts?: ContactAttachment[];

  poll?: PollMessage;

  event?: EventMessage;

  location?: LocationMessage;

  replyToId?: string;

  isEdited?: boolean;
  isDeleted?: boolean;

  /**
   * True if message has never been accepted by server.
   */
  isLocalOnly?: boolean;

  isStarred?: boolean;
  isPinned?: boolean;

  reactions?: Record<string, string[]>;

  /** Disappearing message — auto-delete after this many seconds from send */
  disappearAfterSeconds?: number | null;

  /** ISO string — when the message was sent for disappearing countdown start */
  sentAt?: string;

  /** Scheduled send — ISO datetime to send at */
  scheduledAt?: string;

  /** Per-user read receipts (group chats) */
  readBy?: ReadByEntry[];

  /** Per-user delivery receipts returned by the messaging service. */
  deliveredTo?: Array<{ userId: string; deviceId?: string; atMs?: number }>;

  /** Device-local read timestamp, persisted immediately even while offline. */
  locallyReadAt?: string;

  /** Durable outbox marker; replay this receipt after reconnect until the server confirms it. */
  readReceiptPending?: boolean;

  /** Link preview fetched by server */
  linkPreview?: {
    title?: string;
    description?: string;
    image?: string;
    site_name?: string;
    url?: string;
  };

  /** Mentioned user IDs (extracted from @mentions in text) */
  mentionedUserIds?: string[];

  /** Prevents this message from being forwarded */
  noForward?: boolean;

  /** Edit history entries (previous text snapshots) */
  editHistory?: Array<{ editedAt: string; previousText?: string }>;

  /** Populated when kind === 'call_event'. Inline call history row in chat. */
  callEvent?: {
    callId: string;
    callType: string;
    status: 'completed' | 'missed' | 'cancelled';
    duration?: number | null;
    participantCount?: number;
    initiatedBy?: string;
  };
};

/* ============================================================================
 * SUB ROOMS (THREADS / REPLIES)
 * ============================================================================
 */

export type SubRoom = {
  id: string;
  parentRoomId: string;
  conversationId: string;
  rootMessageId?: string;
  title?: string;
  unreadCount?: number;
  lastMessage?: string;
  lastAt?: string;
};

/* ============================================================================
 * CHAT ROOM PAGE PROPS
 * ============================================================================
 */

export type ChatRoomPageProps = {
  chat: Chat | null;
  onBack: () => void;

  allChats?: Chat[];

  onForwardMessages?: (params: {
    fromRoomId: string;
    toChatIds: string[];
    messages: ChatMessage[];
  }) => void;
};
