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
  | 'event';

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
  startsAt: string;
  endsAt?: string;
  reminderMinutes?: number;
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

  voice?: {
    uri: string;
    durationMs: number;
  };

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

  contacts?: ContactAttachment[];

  poll?: PollMessage;

  event?: EventMessage;

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
};

/* ============================================================================
 * SUB ROOMS (THREADS / REPLIES)
 * ============================================================================
 */

export type SubRoom = {
  id: string;
  parentRoomId: string;
  rootMessageId?: string;
  title?: string;
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
