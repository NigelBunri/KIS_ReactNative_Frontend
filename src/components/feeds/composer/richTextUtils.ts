// src/components/feeds/composer/richTextUtils.ts
import type { MarkKey, RichComposerState, Span } from './types';

// -----------------------------------------------------
// Helpers: text diff to keep spans stable when typing
// -----------------------------------------------------
export function computeEditDelta(oldText: string, newText: string) {
  if (oldText === newText) return { start: 0, removed: 0, added: 0 };

  let start = 0;
  const oldLen = oldText.length;
  const newLen = newText.length;

  while (start < oldLen && start < newLen && oldText[start] === newText[start]) start++;

  let oldEnd = oldLen - 1;
  let newEnd = newLen - 1;
  while (oldEnd >= start && newEnd >= start && oldText[oldEnd] === newText[newEnd]) {
    oldEnd--;
    newEnd--;
  }

  const removed = oldEnd - start + 1;
  const added = newEnd - start + 1;
  return { start, removed: Math.max(0, removed), added: Math.max(0, added) };
}

export function shiftSpans(spans: Span[], editStart: number, removed: number, added: number) {
  const delta = added - removed;
  const editEndOld = editStart + removed;

  return spans
    .map((s) => {
      const { start, end } = s;

      if (end <= editStart) return s;

      if (start >= editEndOld) {
        return { ...s, start: start + delta, end: end + delta };
      }

      const newStart = Math.min(start, editStart);
      const newEnd = Math.max(editStart, end + delta);
      if (newEnd <= newStart) return null;
      return { ...s, start: newStart, end: newEnd };
    })
    .filter(Boolean) as Span[];
}

export function splitParagraphs(text: string) {
  return text.split(/\n\s*\n/);
}

export function paragraphIndexAt(text: string, cursor: number) {
  const before = text.slice(0, cursor);
  const parts = before.split(/\n\s*\n/);
  return Math.max(0, parts.length - 1);
}

// -----------------------------------------------------
// Span normalization + ordered overrides
// -----------------------------------------------------
type OrderedSpan = Span & { _o: number };

let _orderCounter = 1;

function toOrdered(s: Span): OrderedSpan {
  const anyS = s as any;
  const o = typeof anyS._o === 'number' ? anyS._o : 0;
  return { ...(s as any), _o: o };
}

function nextOrder() {
  _orderCounter += 1;
  return _orderCounter;
}

function normalizeSpans(spans: Span[]) {
  const cleaned = spans
    .map(toOrdered)
    .map((s) => ({
      ...s,
      start: Math.max(0, s.start),
      end: Math.max(0, s.end),
    }))
    .filter((s) => s.end > s.start);

  // Sort by range first, then by order
  cleaned.sort((a, b) => a.start - b.start || a.end - b.end || a._o - b._o);

  // Merge adjacent spans only when they are exactly identical (including order doesn’t matter)
  const eqMarks = (a?: any, b?: any) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
  const eqAttrs = (a?: any, b?: any) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

  const merged: OrderedSpan[] = [];
  for (const s of cleaned) {
    const prev = merged[merged.length - 1];
    if (prev && prev.end === s.start && eqMarks(prev.marks, s.marks) && eqAttrs(prev.attrs, s.attrs)) {
      prev.end = s.end;
      prev._o = Math.max(prev._o, s._o);
      continue;
    }
    merged.push({ ...s });
  }

  return merged as unknown as Span[];
}

// -----------------------------------------------------
// Apply mark/attr (supports ON + OFF + clear via null)
// -----------------------------------------------------
export function applyMark(spans: Span[], start: number, end: number, mark: MarkKey, on: boolean) {
  if (end <= start) return spans;
  const next = spans.slice();
  next.push({ start, end, marks: { [mark]: on } } as any);
  (next[next.length - 1] as any)._o = nextOrder();
  return normalizeSpans(next);
}

export function applyAttr(spans: Span[], start: number, end: number, attrs: Span['attrs']) {
  if (end <= start) return spans;
  const next = spans.slice();
  next.push({ start, end, attrs: { ...(attrs ?? {}) } } as any);
  (next[next.length - 1] as any)._o = nextOrder();
  return normalizeSpans(next);
}

// -----------------------------------------------------
// Convert state -> ProseMirror-ish doc
// -----------------------------------------------------
export function stateToDoc(state: RichComposerState) {
  const { text, spans, blocks, defaultAlign, styledBg } = state;
  const paragraphs = splitParagraphs(text);

  const offsets: { start: number; end: number }[] = [];
  let pos = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const start = pos;
    const end = pos + p.length;
    offsets.push({ start, end });
    pos = end + 2; // paragraph separator
  }

  const sliceSpansForParagraph = (pIdx: number) => {
    const off = offsets[pIdx];
    if (!off) return [];
    return spans
      .map((s) => {
        const a = Math.max(s.start, off.start);
        const b = Math.min(s.end, off.end);
        if (b <= a) return null;
        const local = { ...(s as any), start: a - off.start, end: b - off.start };
        return local as Span;
      })
      .filter(Boolean) as Span[];
  };

  const buildInline = (textValue: string, localSpans: Span[]) => {
    if (!textValue) return [];

    const cuts = new Set<number>([0, textValue.length]);
    for (const s of localSpans) {
      cuts.add(Math.max(0, Math.min(textValue.length, s.start)));
      cuts.add(Math.max(0, Math.min(textValue.length, s.end)));
    }
    const points = Array.from(cuts).sort((a, b) => a - b);

    // ✅ Merge ALL spans covering the chunk; latest order wins per mark/attr
    const resolveForChunk = (start: number, end: number) => {
      const covering = (localSpans as any[])
        .filter((s) => s.start <= start && s.end >= end)
        .map((s) => ({ ...s, _o: typeof s._o === 'number' ? s._o : 0 }))
        .sort((a, b) => a._o - b._o);

      if (!covering.length) return undefined;

      const effectiveMarks: Record<string, boolean> = {};
      const effectiveAttrs: Record<string, any> = {};

      for (const s of covering) {
        if (s.marks) {
          for (const k of Object.keys(s.marks)) {
            // last assignment wins (true OR false)
            effectiveMarks[k] = !!s.marks[k];
          }
        }
        if (s.attrs) {
          for (const k of Object.keys(s.attrs)) {
            // last assignment wins (can be null to clear)
            effectiveAttrs[k] = s.attrs[k];
          }
        }
      }

      const marks: any[] = [];

      // boolean marks
      if (effectiveMarks.bold) marks.push({ type: 'bold' });
      if (effectiveMarks.italic) marks.push({ type: 'italic' });
      if (effectiveMarks.underline) marks.push({ type: 'underline' });
      if (effectiveMarks.strikethrough) marks.push({ type: 'strikethrough' });
      if (effectiveMarks.inline_code) marks.push({ type: 'inline_code' });
      if (effectiveMarks.superscript) marks.push({ type: 'superscript' });
      if (effectiveMarks.subscript) marks.push({ type: 'subscript' });

      // attrs (null clears)
      const color = effectiveAttrs.color;
      const highlight = effectiveAttrs.highlight;
      const fontSize = effectiveAttrs.fontSize;
      const fontFamily = effectiveAttrs.fontFamily;
      const letterSpacing = effectiveAttrs.letterSpacing;
      const lineHeight = effectiveAttrs.lineHeight;
      const badge = effectiveAttrs.badge;

      const link = effectiveAttrs.link;
      const mention = effectiveAttrs.mention;
      const hashtag = effectiveAttrs.hashtag;

      if (color) marks.push({ type: 'text_color', attrs: { color } });
      if (highlight) marks.push({ type: 'highlight', attrs: { color: highlight } });
      if (fontSize) marks.push({ type: 'font_size', attrs: { size: fontSize } });
      if (fontFamily) marks.push({ type: 'font_family', attrs: { family: fontFamily } });
      if (letterSpacing) marks.push({ type: 'letter_spacing', attrs: { value: letterSpacing } });
      if (lineHeight) marks.push({ type: 'line_height', attrs: { value: lineHeight } });
      if (badge) marks.push({ type: 'badge', attrs: { label: badge } });

      if (link) marks.push({ type: 'link', attrs: { href: link } });
      if (mention) marks.push({ type: 'mention', attrs: { id: mention } });
      if (hashtag) marks.push({ type: 'hashtag', attrs: { tag: hashtag } });

      return marks.length ? marks : undefined;
    };

    const nodes: any[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (b <= a) continue;
      const chunk = textValue.slice(a, b);
      if (!chunk) continue;

      const node: any = { type: 'text', text: chunk };
      const marks = resolveForChunk(a, b);
      if (marks) node.marks = marks;
      nodes.push(node);
    }
    return nodes;
  };

  const content: any[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const pText = paragraphs[i] ?? '';
    const meta = blocks[i] ?? { type: 'paragraph', align: defaultAlign };
    const align = meta.align ?? defaultAlign;

    const commonAttrs: any = align ? { textAlign: align } : {};
    if (styledBg) commonAttrs.backgroundColor = styledBg;

    const inline = buildInline(pText, sliceSpansForParagraph(i));

    switch (meta.type) {
      case 'heading':
        content.push({
          type: 'heading',
          attrs: { level: meta.headingLevel ?? 2, ...commonAttrs },
          content: inline,
        });
        break;
      case 'blockquote':
        content.push({
          type: 'blockquote',
          attrs: commonAttrs,
          content: [{ type: 'paragraph', attrs: commonAttrs, content: inline }],
        });
        break;
      case 'code_block':
        content.push({
          type: 'code_block',
          attrs: { language: 'plaintext', ...commonAttrs },
          content: [{ type: 'text', text: pText }],
        });
        break;
      case 'bullet_list':
        content.push({
          type: 'bullet_list',
          content: [{ type: 'list_item', content: [{ type: 'paragraph', attrs: commonAttrs, content: inline }] }],
        });
        break;
      case 'ordered_list':
        content.push({
          type: 'ordered_list',
          content: [{ type: 'list_item', content: [{ type: 'paragraph', attrs: commonAttrs, content: inline }] }],
        });
        break;
      case 'task_list':
        content.push({
          type: 'task_list',
          content: [
            {
              type: 'task_item',
              attrs: { checked: false },
              content: [{ type: 'paragraph', attrs: commonAttrs, content: inline }],
            },
          ],
        });
        break;
      case 'callout':
        content.push({
          type: 'callout',
          attrs: { tone: meta.calloutTone ?? 'info', ...commonAttrs },
          content: [{ type: 'paragraph', attrs: commonAttrs, content: inline }],
        });
        break;
      case 'hr':
        content.push({ type: 'horizontal_rule' });
        break;
      default:
        content.push({ type: 'paragraph', attrs: commonAttrs, content: inline });
        break;
    }
  }

  // Merge adjacent lists of same type
  const merged: any[] = [];
  for (const b of content) {
    const prev = merged[merged.length - 1];
    if (prev && (b.type === 'bullet_list' || b.type === 'ordered_list') && prev.type === b.type) {
      prev.content = [...(prev.content ?? []), ...(b.content ?? [])];
      continue;
    }
    if (prev && b.type === 'task_list' && prev.type === 'task_list') {
      prev.content = [...(prev.content ?? []), ...(b.content ?? [])];
      continue;
    }
    merged.push(b);
  }

  return { type: 'doc' as const, content: merged };
}
