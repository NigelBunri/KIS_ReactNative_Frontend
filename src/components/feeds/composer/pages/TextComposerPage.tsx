// src/components/feeds/composer/pages/TextComposerPage.tsx
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import RichTextRenderer from '@/components/feeds/RichTextRenderer';

import type { BlockMeta, MarkKey, RichComposerState, Span } from '../types';
import {
  applyAttr,
  applyMark,
  computeEditDelta,
  paragraphIndexAt,
  shiftSpans,
  splitParagraphs,
  stateToDoc,
} from '../richTextUtils';
import { Swatch } from '../UI/Swatch';
import { DropButton } from '../UI/DropButton';

// -----------------------------------------------------
// Color presets (20 each) — UNIQUE values
// -----------------------------------------------------
const TEXT_COLORS = [
  '#0B1E3B', '#0F3D2E', '#3B1E0B', '#2A2356', '#5A1A27',
  '#14532D', '#111827', '#0EA5E9', '#DC2626', '#F59E0B',
  '#7C3AED', '#059669', '#0891B2', '#9333EA', '#1D4ED8',
  '#0F172A', '#064E3B', '#7F1D1D', '#1E40AF', '#A21CAF',
];

const HIGHLIGHT_COLORS = [
  '#FEF08A', '#FDE68A', '#FCD34D', '#BBF7D0', '#86EFAC',
  '#BFDBFE', '#93C5FD', '#FBCFE8', '#F9A8D4', '#E9D5FF',
  '#DDD6FE', '#FFE4E6', '#FECACA', '#E0F2FE', '#CCFBF1',
  '#FAE8FF', '#FFEDD5', '#DCFCE7', '#DBEAFE', '#FFF1F2',
];

const BG_COLORS = [
  '#F8FAFC', '#EFF6FF', '#ECFDF5', '#FFF7ED', '#FDF2F8',
  '#F5F3FF', '#FAFAFA', '#0B1E3B', '#0F3D2E', '#2A2356',
  '#111827', '#1F2937', '#172554', '#052E16', '#4C0519',
  '#0A0A0A', '#FFFFFF', '#F1F5F9', '#FEFCE8', '#F0FDFA',
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// Smaller boxes so the sheet’s submit button can sit right under the form
const FIXED_HEIGHT = 110;

// Text padding (distance from borders)
const PAD_MIN = 0;
const PAD_MAX_SAFE = 600;

// Font size
const FONT_MIN = 10;
const FONT_MAX = 40;

type MenuKey = null | 'format' | 'block' | 'align' | 'color' | 'padding' | 'font';

function safeInt(value: string, fallback: number) {
  const n = parseInt(value.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function TextComposerPage({
  rich,
  setRich,
}: {
  rich: RichComposerState;
  setRich: React.Dispatch<React.SetStateAction<RichComposerState>>;
}) {
  const { palette } = useKISTheme();

  // selection for formatting only (DO NOT pass selection prop to TextInput)
  const [selection, _setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const [openMenu, setOpenMenu] = useState<MenuKey>(null);

  // ✅ text padding: how far the text is from borders (editor + preview)
  const [textPadding, setTextPadding] = useState<number>(12);
  const [paddingDraft, setPaddingDraft] = useState<string>('12');

  // ✅ font size for the editor input (and preview container text will scale via renderer if you apply fontSize marks)
  const [fontSize, setFontSize] = useState<number>(16);
  const [fontSizeDraft, setFontSizeDraft] = useState<string>('16');

  const activeParagraphIndex = useMemo(
    () => paragraphIndexAt(rich.text, selection.start),
    [rich.text, selection.start],
  );

  const activeBlock = useMemo<BlockMeta>(() => {
    return rich.blocks[activeParagraphIndex] ?? { type: 'paragraph', align: rich.defaultAlign };
  }, [rich.blocks, activeParagraphIndex, rich.defaultAlign]);

  const setBlock = useCallback(
    (patch: Partial<BlockMeta>) => {
      setRich((prev) => {
        const blocks = { ...(prev.blocks ?? {}) };
        const existing = blocks[activeParagraphIndex] ?? { type: 'paragraph', align: prev.defaultAlign };
        blocks[activeParagraphIndex] = { ...existing, ...patch };
        return { ...prev, blocks };
      });
    },
    [activeParagraphIndex, setRich],
  );

  // ✅ If user has no selection, apply formatting to ALL text.
  const getRangeOrAll = useCallback(() => {
    const sel = selectionRef.current;
    const len = rich.text.length;
    if (sel.end > sel.start) return sel;
    return { start: 0, end: len };
  }, [rich.text.length]);

  const applyMarkToRange = useCallback(
    (mark: MarkKey, on: boolean) => {
      const r = getRangeOrAll();
      if (r.end <= r.start) return;
      setRich((prev) => ({ ...prev, spans: applyMark(prev.spans, r.start, r.end, mark, on) }));
    },
    [setRich, getRangeOrAll],
  );

  const applyAttrToRange = useCallback(
    (attrs: Span['attrs']) => {
      const r = getRangeOrAll();
      if (r.end <= r.start) return;
      setRich((prev) => ({ ...prev, spans: applyAttr(prev.spans, r.start, r.end, attrs) }));
    },
    [setRich, getRangeOrAll],
  );

  // Active mark (latest override wins)
  const isMarkActive = useCallback(
    (mark: MarkKey) => {
      const sel = selectionRef.current;
      const start = sel.end > sel.start ? sel.start : 0;
      const end = sel.end > sel.start ? sel.end : rich.text.length;
      if (end <= start) return false;

      let v: boolean | undefined = undefined;
      for (const s of rich.spans) {
        if (s.start <= start && s.end >= end && s.marks && Object.prototype.hasOwnProperty.call(s.marks, mark)) {
          v = !!s.marks[mark];
        }
      }
      return v ?? false;
    },
    [rich.spans, rich.text.length],
  );

  const toggleMark = useCallback(
    (mark: MarkKey) => {
      const active = isMarkActive(mark);
      applyMarkToRange(mark, !active);
    },
    [isMarkActive, applyMarkToRange],
  );

  const activeTextColor = useMemo(() => {
    const sel = selectionRef.current;
    const start = sel.end > sel.start ? sel.start : 0;
    const end = sel.end > sel.start ? sel.end : rich.text.length;
    if (end <= start) return undefined;

    let v: any = undefined;
    for (const s of rich.spans) {
      if (s.start <= start && s.end >= end && s.attrs && Object.prototype.hasOwnProperty.call(s.attrs, 'color')) {
        v = (s.attrs as any).color;
      }
    }
    if (v === null || v === undefined || v === '') return undefined;
    return String(v);
  }, [rich.spans, rich.text.length]);

  const activeHighlight = useMemo(() => {
    const sel = selectionRef.current;
    const start = sel.end > sel.start ? sel.start : 0;
    const end = sel.end > sel.start ? sel.end : rich.text.length;
    if (end <= start) return undefined;

    let v: any = undefined;
    for (const s of rich.spans) {
      if (s.start <= start && s.end >= end && s.attrs && Object.prototype.hasOwnProperty.call(s.attrs, 'highlight')) {
        v = (s.attrs as any).highlight;
      }
    }
    if (v === null || v === undefined || v === '') return undefined;
    return String(v);
  }, [rich.spans, rich.text.length]);

  // If fontSize is being applied via spans (optional), you can detect it too:
  const activeSpanFontSize = useMemo(() => {
    const sel = selectionRef.current;
    const start = sel.end > sel.start ? sel.start : 0;
    const end = sel.end > sel.start ? sel.end : rich.text.length;
    if (end <= start) return undefined;

    let v: any = undefined;
    for (const s of rich.spans) {
      if (s.start <= start && s.end >= end && s.attrs && Object.prototype.hasOwnProperty.call(s.attrs, 'fontSize')) {
        v = (s.attrs as any).fontSize;
      }
    }
    if (v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, [rich.spans, rich.text.length]);

  // ✅ Toggle colors: click same color to remove; pick another anytime
  const onPickTextColor = useCallback(
    (c: string) => {
      const current = activeTextColor;
      if (current === c) applyAttrToRange({ color: null as any });
      else applyAttrToRange({ color: c });
    },
    [activeTextColor, applyAttrToRange],
  );

  const onPickHighlight = useCallback(
    (c: string) => {
      const current = activeHighlight;
      if (current === c) applyAttrToRange({ highlight: null as any });
      else applyAttrToRange({ highlight: c });
    },
    [activeHighlight, applyAttrToRange],
  );

  // ✅ Apply font size to selection (or whole text if no selection)
  const onApplyFontSizeToText = useCallback(
    (size: number) => {
      applyAttrToRange({ fontSize: size });
    },
    [applyAttrToRange],
  );

  // -----------------------------------------------------
  // Typing (keep spans stable)
  // -----------------------------------------------------
  const onChangeText = useCallback(
    (nextText: string) => {
      setRich((prev) => {
        const oldText = prev.text;
        const { start, removed, added } = computeEditDelta(oldText, nextText);

        const nextSpans = shiftSpans(prev.spans, start, removed, added);
        const newParas = splitParagraphs(nextText);

        const nextBlocks: Record<number, BlockMeta> = {};
        for (let i = 0; i < newParas.length; i++) {
          nextBlocks[i] = prev.blocks[i] ?? { type: 'paragraph', align: prev.defaultAlign };
        }

        return { ...prev, text: nextText, spans: nextSpans, blocks: nextBlocks };
      });
    },
    [setRich],
  );

  const onSelectionChange = useCallback((e: any) => {
    const sel = e.nativeEvent.selection as { start: number; end: number };
    selectionRef.current = sel;
    _setSelection(sel);
  }, []);

  // -----------------------------------------------------
  // Preview
  // -----------------------------------------------------
  const docPreview = useMemo(() => {
    const trimmed = rich.text.trim();
    if (!trimmed) return null;
    return stateToDoc(rich);
  }, [rich]);

  const wordCount = useMemo(() => {
    const t = rich.text.trim();
    if (!t) return 0;
    return t.split(/\s+/).filter(Boolean).length;
  }, [rich.text]);

  const readTime = useMemo(() => Math.max(1, Math.round(wordCount / 200)), [wordCount]);

  // -----------------------------------------------------
  // Dropdown
  // -----------------------------------------------------
  const renderDropdownPanel = () => {
    if (!openMenu) return null;

    const chip = (label: string, active: boolean, onPress: () => void) => (
      <Pressable
        onPress={onPress}
        style={[
          styles.menuChip,
          {
            borderColor: active ? palette.primary : palette.divider,
            backgroundColor: active ? 'rgba(0,0,0,0.06)' : palette.surface,
          },
        ]}
      >
        <Text style={{ color: palette.text, fontWeight: '900' }}>{label}</Text>
      </Pressable>
    );

    return (
      <View style={[styles.dropdownPanel, { borderColor: palette.divider, backgroundColor: palette.card }]}>
        <View style={styles.dropdownHeader}>
          <Text style={{ color: palette.text, fontWeight: '900' }}>
            {openMenu === 'format'
              ? 'Format'
              : openMenu === 'block'
                ? 'Blocks'
                : openMenu === 'align'
                  ? 'Alignment'
                  : openMenu === 'padding'
                    ? 'Text padding'
                    : openMenu === 'font'
                      ? 'Font size'
                      : 'Colors'}
          </Text>
          <Pressable onPress={() => setOpenMenu(null)} style={{ padding: 6 }}>
            <KISIcon name="close" size={18} color={palette.text} />
          </Pressable>
        </View>

        <ScrollView
          style={{ marginTop: 10 }}
          contentContainerStyle={{ paddingBottom: 6 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {openMenu === 'format' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {chip('Bold', isMarkActive('bold'), () => toggleMark('bold'))}
              {chip('Italic', isMarkActive('italic'), () => toggleMark('italic'))}
              {chip('Underline', isMarkActive('underline'), () => toggleMark('underline'))}
              {chip('Strike', isMarkActive('strikethrough'), () => toggleMark('strikethrough'))}
              {chip('Inline Code', isMarkActive('inline_code'), () => toggleMark('inline_code'))}
              {chip('Sup', isMarkActive('superscript'), () => toggleMark('superscript'))}
              {chip('Sub', isMarkActive('subscript'), () => toggleMark('subscript'))}
            </View>
          ) : null}

          {openMenu === 'block' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {chip('Paragraph', activeBlock.type === 'paragraph', () => setBlock({ type: 'paragraph' }))}
              {chip('Heading', activeBlock.type === 'heading', () => setBlock({ type: 'heading', headingLevel: 2 }))}
              {chip('Quote', activeBlock.type === 'blockquote', () => setBlock({ type: 'blockquote' }))}
              {chip('Code Block', activeBlock.type === 'code_block', () => setBlock({ type: 'code_block' }))}
              {chip('Bullets', activeBlock.type === 'bullet_list', () => setBlock({ type: 'bullet_list' }))}
              {chip('Numbered', activeBlock.type === 'ordered_list', () => setBlock({ type: 'ordered_list' }))}
              {chip('Tasks', activeBlock.type === 'task_list', () => setBlock({ type: 'task_list' }))}
              {chip('Callout', activeBlock.type === 'callout', () => setBlock({ type: 'callout', calloutTone: 'info' }))}
              {chip('HR', false, () => setBlock({ type: 'hr' }))}
            </View>
          ) : null}

          {openMenu === 'align' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {chip('Left', (activeBlock.align ?? rich.defaultAlign) === 'left', () => setBlock({ align: 'left' }))}
              {chip('Center', (activeBlock.align ?? rich.defaultAlign) === 'center', () => setBlock({ align: 'center' }))}
              {chip('Right', (activeBlock.align ?? rich.defaultAlign) === 'right', () => setBlock({ align: 'right' }))}
              {chip('Justify', (activeBlock.align ?? rich.defaultAlign) === 'justify', () => setBlock({ align: 'justify' }))}
            </View>
          ) : null}

          {openMenu === 'padding' ? (
            <View style={{ gap: 12 }}>
              <Text style={{ color: palette.subtext, fontWeight: '900' }}>Text padding</Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                This controls how far the text sits from the editor/preview borders.
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Pressable
                  onPress={() => {
                    const next = clamp(textPadding - 2, PAD_MIN, PAD_MAX_SAFE);
                    setTextPadding(next);
                    setPaddingDraft(String(next));
                  }}
                  style={[styles.smallBtn, { borderColor: palette.divider }]}
                >
                  <Text style={{ color: palette.text, fontWeight: '900' }}>−</Text>
                </Pressable>

                <TextInput
                  value={paddingDraft}
                  onChangeText={(v) => setPaddingDraft(v)}
                  onBlur={() => {
                    const n = clamp(safeInt(paddingDraft, textPadding), PAD_MIN, PAD_MAX_SAFE);
                    setTextPadding(n);
                    setPaddingDraft(String(n));
                  }}
                  keyboardType="number-pad"
                  style={[
                    styles.padInput,
                    { borderColor: palette.divider, color: palette.text, backgroundColor: palette.surface },
                  ]}
                  placeholder="0"
                  placeholderTextColor={palette.subtext}
                />

                <Pressable
                  onPress={() => {
                    const next = clamp(textPadding + 2, PAD_MIN, PAD_MAX_SAFE);
                    setTextPadding(next);
                    setPaddingDraft(String(next));
                  }}
                  style={[styles.smallBtn, { borderColor: palette.divider }]}
                >
                  <Text style={{ color: palette.text, fontWeight: '900' }}>+</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {openMenu === 'font' ? (
            <View style={{ gap: 12 }}>
              <Text style={{ color: palette.subtext, fontWeight: '900' }}>Font size</Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Pressable
                  onPress={() => {
                    const next = clamp(fontSize - 1, FONT_MIN, FONT_MAX);
                    setFontSize(next);
                    setFontSizeDraft(String(next));
                    onApplyFontSizeToText(next); // apply to selection (or all)
                  }}
                  style={[styles.smallBtn, { borderColor: palette.divider }]}
                >
                  <Text style={{ color: palette.text, fontWeight: '900' }}>−</Text>
                </Pressable>

                <TextInput
                  value={fontSizeDraft}
                  onChangeText={(v) => setFontSizeDraft(v)}
                  onBlur={() => {
                    const n = clamp(safeInt(fontSizeDraft, fontSize), FONT_MIN, FONT_MAX);
                    setFontSize(n);
                    setFontSizeDraft(String(n));
                    onApplyFontSizeToText(n);
                  }}
                  keyboardType="number-pad"
                  style={[
                    styles.padInput,
                    { borderColor: palette.divider, color: palette.text, backgroundColor: palette.surface },
                  ]}
                  placeholder="16"
                  placeholderTextColor={palette.subtext}
                />

                <Pressable
                  onPress={() => {
                    const next = clamp(fontSize + 1, FONT_MIN, FONT_MAX);
                    setFontSize(next);
                    setFontSizeDraft(String(next));
                    onApplyFontSizeToText(next);
                  }}
                  style={[styles.smallBtn, { borderColor: palette.divider }]}
                >
                  <Text style={{ color: palette.text, fontWeight: '900' }}>+</Text>
                </Pressable>
              </View>

              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Applies to the selected text (or whole text if nothing is selected).
              </Text>

              {/* quick presets */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
                {[12, 14, 16, 18, 20, 24, 28, 32].map((s) =>
                  chip(`${s}px`, activeSpanFontSize === s, () => {
                    setFontSize(s);
                    setFontSizeDraft(String(s));
                    onApplyFontSizeToText(s);
                  }),
                )}
              </View>
            </View>
          ) : null}

          {openMenu === 'color' ? (
            <View style={{ gap: 14 }}>
              <View>
                <Text style={{ color: palette.subtext, fontWeight: '900', marginBottom: 8 }}>
                  Text color (tap again to remove)
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {TEXT_COLORS.map((c, idx) => (
                    <Swatch
                      key={`${c}_${idx}`}
                      color={c}
                      selected={activeTextColor === c}
                      onPress={() => onPickTextColor(c)}
                    />
                  ))}
                </View>
              </View>

              <View>
                <Text style={{ color: palette.subtext, fontWeight: '900', marginBottom: 8 }}>
                  Highlight (tap again to remove)
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {HIGHLIGHT_COLORS.map((c, idx) => (
                    <Swatch
                      key={`${c}_${idx}`}
                      color={c}
                      selected={activeHighlight === c}
                      onPress={() => onPickHighlight(c)}
                    />
                  ))}
                </View>
              </View>

              <View>
                <Text style={{ color: palette.subtext, fontWeight: '900', marginBottom: 8 }}>
                  Background (change anytime)
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {BG_COLORS.map((c, idx) => (
                    <Swatch
                      key={`${c}_${idx}`}
                      color={c}
                      selected={rich.styledBg === c}
                      onPress={() => setRich((p) => ({ ...p, styledBg: p.styledBg === c ? undefined : c }))}
                    />
                  ))}
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={{ gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        <DropButton label="Format" active={openMenu === 'format'} onPress={() => setOpenMenu(openMenu === 'format' ? null : 'format')} />
        <DropButton label="Blocks" active={openMenu === 'block'} onPress={() => setOpenMenu(openMenu === 'block' ? null : 'block')} />
        <DropButton label="Align" active={openMenu === 'align'} onPress={() => setOpenMenu(openMenu === 'align' ? null : 'align')} />
        <DropButton label="Colors" active={openMenu === 'color'} onPress={() => setOpenMenu(openMenu === 'color' ? null : 'color')} />
        <DropButton label="Padding" active={openMenu === 'padding'} onPress={() => setOpenMenu(openMenu === 'padding' ? null : 'padding')} />
        <DropButton label="Font" active={openMenu === 'font'} onPress={() => setOpenMenu(openMenu === 'font' ? null : 'font')} />
      </ScrollView>

      {renderDropdownPanel()}

      {/* fixed-size editor (smaller) */}
      <View
        style={[
          styles.editorCard,
          {
            borderColor: palette.divider,
            backgroundColor: palette.surface,
            padding: textPadding, // ✅ TEXT padding
          },
        ]}
      >
        <ScrollView
          style={styles.fixedBox}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          <TextInput
            value={rich.text}
            onChangeText={onChangeText}
            placeholder="Write your update..."
            placeholderTextColor={palette.subtext}
            multiline
            style={[styles.textInput, { color: palette.text, fontSize }]} // ✅ font size for input
            onSelectionChange={onSelectionChange}
            textAlignVertical="top"
            disableFullscreenUI
            scrollEnabled={false}
          />
        </ScrollView>
      </View>

      {/* fixed-size preview (smaller) */}
      <View
        style={[
          styles.previewCard,
          {
            borderColor: palette.divider,
            backgroundColor: rich.styledBg ?? palette.card,
            padding: textPadding, // ✅ TEXT padding
          },
        ]}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.previewTitle, { color: palette.subtext }]}>Preview</Text>
          <Text style={{ color: palette.subtext, fontSize: 12 }}>
            {wordCount}w • {readTime}m • {rich.text.length}c
          </Text>
        </View>

        <ScrollView style={styles.fixedBox} showsVerticalScrollIndicator>
          <RichTextRenderer
            doc={docPreview ?? undefined}
            fallback={rich.text || 'Write something...'}
            style={{ minHeight: 40 }}
          />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  editorCard: {
    borderWidth: 2,
    borderRadius: 18,
  },
  previewCard: {
    borderWidth: 2,
    borderRadius: 18,
  },
  fixedBox: {
    height: FIXED_HEIGHT,
  },
  textInput: {
    // fontSize injected dynamically
  },

  previewTitle: { fontSize: 12, fontWeight: '900', marginBottom: 6 },

  dropdownPanel: {
    borderWidth: 2,
    borderRadius: 18,
    padding: 12,
    maxHeight: 240,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  menuChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
  },

  smallBtn: {
    width: 44,
    height: 38,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  padInput: {
    flex: 1,
    height: 38,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 10,
    fontWeight: '900',
  },
});
