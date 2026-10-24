// src/components/composer/types.ts
export type ComposerType =
  | 'text'
  | 'image'
  | 'video'
  | 'short_video'
  | 'document'
  | 'audio'
  | 'poll'
  | 'event'
  | 'link';

export type Align = 'left' | 'center' | 'right' | 'justify';

export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'blockquote'
  | 'code_block'
  | 'bullet_list'
  | 'ordered_list'
  | 'task_list'
  | 'callout'
  | 'hr';

export type CalloutTone = 'info' | 'warn' | 'success' | 'danger' | 'neutral';

export type MarkKey =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'inline_code'
  | 'superscript'
  | 'subscript';

export type Span = {
  start: number;
  end: number;
  marks?: Partial<Record<MarkKey, boolean>>;
  attrs?: {
    color?: string;
    highlight?: string;
    fontSize?: number;
    fontFamily?: string;
    letterSpacing?: number;
    lineHeight?: number;
    badge?: string;

    link?: string;
    mention?: string;
    hashtag?: string;
  };
};

export type BlockMeta = {
  type: BlockType;
  align?: Align;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  calloutTone?: CalloutTone;
  backgroundColor?: string;
};

export type RichComposerState = {
  text: string;
  spans: Span[];
  blocks: Record<number, BlockMeta>;
  defaultAlign: Align;
  styledBg?: string;

  // Advanced state (non-breaking)
  version?: number;
  meta?: {
    title?: string;
    mood?: string;
    language?: string;
    readingLevel?: 'simple' | 'standard' | 'advanced';
  };
};

export type FeedComposerPayload = {
  text?: any; // ProseMirror-ish doc
  textPlain?: string;
  textPreview?: string;
  attachments?: any[];
  poll?: any;
  event?: any;
  link?: string;
  composerType?: ComposerType;
  channelId?: string;
  channel_id?: string;
  contentType?: ComposerType | 'rich_text' | 'live_stream' | 'gallery';
  content_type?: ComposerType | 'rich_text' | 'live_stream' | 'gallery';
  visibility?: 'public' | 'unlisted' | 'private' | string;
  scheduledAt?: string | null;
  scheduled_at?: string | null;
  playlistIds?: string[];
  playlist_ids?: string[];
  thumbnail?: string | null;
  thumbnail_url?: string | null;
  captions?: any;
  embedAllowed?: boolean;
  embed_allowed?: boolean;
  linkPreviewTitle?: string;
  linkPreviewDescription?: string;
  linkPreviewImage?: string | null;
  linkOpenExternally?: boolean;
};

export type LinkSettings = {
  previewTitle: string;
  previewDescription: string;
  previewImage: string | null;
  openExternally: boolean;
};

export const DEFAULT_LINK_SETTINGS: LinkSettings = {
  previewTitle: '',
  previewDescription: '',
  previewImage: null,
  openExternally: true,
};

export type ChannelComposerContext = {
  channelId?: string;
  channelHandle?: string;
  channelName?: string;
  contentType?: FeedComposerPayload['contentType'];
  visibility?: string;
  scheduledAt?: string | null;
  playlistIds?: string[];
  thumbnail?: string | null;
  captions?: any;
  embedAllowed?: boolean;
};

// Shared by every screen that opens FeedComposerSheet directly (Feed
// Management hub, Channel Studio, Channel Content Manager) so each can
// resolve a channel object into composer context without duplicating
// this mapping or routing the open-composer trigger through a parent.
export const toChannelComposerContext = (
  channel?: { id?: string; handle?: string; display_name?: string } | null,
): ChannelComposerContext | undefined =>
  channel?.id
    ? {
        channelId: String(channel.id),
        channelHandle: channel.handle ? String(channel.handle) : undefined,
        channelName: channel.display_name ? String(channel.display_name) : undefined,
      }
    : undefined;

export type AttachmentLike = {
  uri: string;
  name?: string | null;
  type?: string | null;
  size?: number | null;
  kind?: string;
};

export type SelectionRange = { start: number; end: number };

export type PollSettings = {
  allowMultiple: boolean;
  duration: 'none' | '1h' | '1d' | '3d' | '1w';
  randomizeOrder: boolean;
  showResultsBeforeVoting: boolean;
  anonymous: boolean;
};

export const DEFAULT_POLL_SETTINGS: PollSettings = {
  allowMultiple: false,
  duration: '1d',
  randomizeOrder: false,
  showResultsBeforeVoting: false,
  anonymous: false,
};

export type EventSettings = {
  endsAt: string;
  allDay: boolean;
  isOnline: boolean;
  onlineUrl: string;
  rsvpCapacity: string;
  reminder: 'none' | '15m' | '1h' | '1d';
  description: string;
  coverImage: string | null;
  repeats: 'none' | 'weekly' | 'monthly';
  addToCalendar: boolean;
  category: string;
};

export const DEFAULT_EVENT_SETTINGS: EventSettings = {
  endsAt: '',
  allDay: false,
  isOnline: false,
  onlineUrl: '',
  rsvpCapacity: '',
  reminder: 'none',
  description: '',
  coverImage: null,
  repeats: 'none',
  addToCalendar: true,
  category: '',
};
