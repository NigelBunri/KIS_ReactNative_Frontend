// src/components/composer/richUtils.ts
import { Span } from './types';

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
      let { start, end } = s;

      if (end <= editStart) return s;

      if (start >= editEndOld) {
        return { ...s, start: start + delta, end: end + delta };
      }

      // overlap edit
      const newStart = Math.min(start, editStart);
      const newEnd = Math.max(editStart, end + delta);
      if (newEnd <= newStart) return null;
      return { ...s, start: newStart, end: newEnd };
    })
    .filter(Boolean) as Span[];
}

export function normalizeSpans(spans: Span[]) {
  const cleaned = spans
    .map((s) => ({
      ...s,
      start: Math.max(0, s.start),
      end: Math.max(0, s.end),
    }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const eq = (a?: any, b?: any) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
  const merged: Span[] = [];

  for (const s of cleaned) {
    const prev = merged[merged.length - 1];
    if (prev && prev.end === s.start && eq(prev.marks, s.marks) && eq(prev.attrs, s.attrs)) {
      prev.end = s.end;
      continue;
    }
    merged.push({ ...s });
  }

  return merged;
}

export function applyMark(spans: Span[], start: number, end: number, mark: keyof NonNullable<Span['marks']>, on: boolean) {
  if (end <= start) return spans;
  const next = spans.slice();
  next.push({ start, end, marks: { [mark]: on } as any });
  return normalizeSpans(next);
}

export function applyAttr(spans: Span[], start: number, end: number, attrs: Span['attrs']) {
  if (end <= start) return spans;
  const next = spans.slice();
  next.push({ start, end, attrs: { ...attrs } });
  return normalizeSpans(next);
}

export function splitParagraphs(text: string) {
  return text.split(/\n\s*\n/);
}

export function paragraphIndexAt(text: string, cursor: number) {
  const before = text.slice(0, cursor);
  const parts = before.split(/\n\s*\n/);
  return Math.max(0, parts.length - 1);
}
