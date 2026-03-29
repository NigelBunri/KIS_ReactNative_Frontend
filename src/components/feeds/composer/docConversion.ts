// src/components/composer/docConversion.ts
import { RichComposerState, Span } from './types';
import { splitParagraphs } from './richUtils';

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
    pos = end + 2;
  }

  const sliceSpansForParagraph = (pIdx: number) => {
    const off = offsets[pIdx];
    if (!off) return [];
    return spans
      .map((s) => {
        const a = Math.max(s.start, off.start);
        const b = Math.min(s.end, off.end);
        if (b <= a) return null;
        return { ...s, start: a - off.start, end: b - off.start };
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

    const markForChunk = (start: number, end: number) => {
      const covering = localSpans.find((s) => s.start <= start && s.end >= end);
      if (!covering) return undefined;

      const marks: any[] = [];
      const m = covering.marks ?? {};
      const a = covering.attrs ?? {};

      if (m.bold) marks.push({ type: 'bold' });
      if (m.italic) marks.push({ type: 'italic' });
      if (m.underline) marks.push({ type: 'underline' });
      if (m.strikethrough) marks.push({ type: 'strikethrough' });
      if (m.inline_code) marks.push({ type: 'inline_code' });
      if (m.superscript) marks.push({ type: 'superscript' });
      if (m.subscript) marks.push({ type: 'subscript' });

      if (a.color) marks.push({ type: 'text_color', attrs: { color: a.color } });
      if (a.highlight) marks.push({ type: 'highlight', attrs: { color: a.highlight } });
      if (a.fontSize) marks.push({ type: 'font_size', attrs: { size: a.fontSize } });
      if (a.fontFamily) marks.push({ type: 'font_family', attrs: { family: a.fontFamily } });
      if (a.letterSpacing) marks.push({ type: 'letter_spacing', attrs: { value: a.letterSpacing } });
      if (a.lineHeight) marks.push({ type: 'line_height', attrs: { value: a.lineHeight } });
      if (a.badge) marks.push({ type: 'badge', attrs: { label: a.badge } });

      if (a.link) marks.push({ type: 'link', attrs: { href: a.link } });
      if (a.mention) marks.push({ type: 'mention', attrs: { id: a.mention } });
      if (a.hashtag) marks.push({ type: 'hashtag', attrs: { tag: a.hashtag } });

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
      const marks = markForChunk(a, b);
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
          content: [{ type: 'task_item', attrs: { checked: false }, content: [{ type: 'paragraph', attrs: commonAttrs, content: inline }] }],
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

      case 'paragraph':
      default:
        content.push({ type: 'paragraph', attrs: commonAttrs, content: inline });
        break;
    }
  }

  // Merge consecutive list blocks
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

  return { type: 'doc', content: merged };
}
