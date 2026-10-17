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
};

export type AttachmentLike = {
  uri: string;
  name?: string | null;
  type?: string | null;
  size?: number | null;
  kind?: string;
};

export type SelectionRange = { start: number; end: number };
