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
};

export type AttachmentLike = {
  uri: string;
  name?: string | null;
  type?: string | null;
  size?: number | null;
  kind?: string;
};

export type SelectionRange = { start: number; end: number };

// Feature system
export type FeatureId = string;

export type FeatureCategory =
  | 'inline'
  | 'block'
  | 'layout'
  | 'style'
  | 'insert'
  | 'review'
  | 'tools'
  | 'media'
  | 'accessibility'
  | 'automation';

export type FeatureAction = {
  id: FeatureId;
  label: string;
  icon?: string; // KISIcon name
  category: FeatureCategory;

  // If false, render disabled + tooltip
  enabled?: (ctx: FeatureContext) => boolean;

  // Highlight active state (e.g. Bold on)
  active?: (ctx: FeatureContext) => boolean;

  // Action runner
  run: (ctx: FeatureContext) => void;

  // Optional: long press variant
  runAlt?: (ctx: FeatureContext) => void;

  // UI hints
  priority?: number; // higher = shown first
  badge?: 'NEW' | 'PRO' | 'BETA';
};

export type FeatureContext = {
  type: ComposerType;

  rich: RichComposerState;
  setRich: (updater: (prev: RichComposerState) => RichComposerState) => void;

  selection: SelectionRange;
  setSelection: (r: SelectionRange) => void;

  activeParagraphIndex: number;
  activeBlock: BlockMeta;
  setBlock: (patch: Partial<BlockMeta>) => void;

  applyMarkToSelection: (mark: MarkKey, on: boolean) => void;
  applyAttrToSelection: (attrs: Span['attrs']) => void;

  // History
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Helpers
  toast: (msg: string) => void;
};
