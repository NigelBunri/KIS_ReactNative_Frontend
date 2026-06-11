// src/screens/broadcast/channels/studio/ContentCardsEditor.tsx
//
// Manage interactive cards for a piece of content.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';

// ── Types ──────────────────────────────────────────────────────────────────────

type CardType = 'video' | 'channel' | 'poll' | 'link' | 'merchandise';

type ContentCard = {
  id: string;
  card_type: CardType;
  title?: string;
  body?: string;
  target_url?: string;
  cta_text?: string;
  start_seconds?: number;
  end_seconds?: number;
  sort_order?: number;
};

type Props = {
  contentId: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_TYPES: CardType[] = ['video', 'channel', 'poll', 'link', 'merchandise'];

const CARD_TYPE_COLOR: Record<CardType, string> = {
  video: '#3B82F6',
  channel: '#8B5CF6',
  poll: '#22C55E',
  link: '#F59E0B',
  merchandise: '#EC4899',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function secondsToHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0'),
  ].join(':');
}

function hmsToSeconds(hms: string): number {
  const parts = hms.split(':').map(Number);
  if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  return parts[0] ?? 0;
}

function HMSInput({
  value,
  onChange,
  placeholder,
  palette,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  palette: any;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={text => onChange(text.replace(/[^0-9:]/g, '').slice(0, 8))}
      placeholder={placeholder ?? '00:00:00'}
      placeholderTextColor={palette.subtext}
      keyboardType="numeric"
      style={[hmsStyles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
    />
  );
}

const hmsStyles = StyleSheet.create({
  input: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContentCardsEditor({ contentId }: Props) {
  const { palette } = useKISTheme();
  const [cards, setCards] = useState<ContentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formType, setFormType] = useState<CardType>('link');
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formTargetUrl, setFormTargetUrl] = useState('');
  const [formCta, setFormCta] = useState('');
  const [formStartHMS, setFormStartHMS] = useState('');
  const [formEndHMS, setFormEndHMS] = useState('');

  const fetchCards = useCallback(async () => {
    if (!contentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(
        ROUTES.broadcasts.contentCards(contentId),
        { errorMessage: '' },
      );
      const raw: ContentCard[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.results ?? [];
      setCards(raw.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    } catch {
      setError('Could not load content cards.');
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    void fetchCards();
  }, [fetchCards]);

  const resetForm = useCallback(() => {
    setFormType('link');
    setFormTitle('');
    setFormBody('');
    setFormTargetUrl('');
    setFormCta('');
    setFormStartHMS('');
    setFormEndHMS('');
  }, []);

  const handleAdd = useCallback(async () => {
    setSaving(true);
    try {
      await postRequest(
        ROUTES.broadcasts.contentCards(contentId),
        {
          card_type: formType,
          title: formTitle.trim() || undefined,
          body: formBody.trim() || undefined,
          target_url: formTargetUrl.trim() || undefined,
          cta_text: formCta.trim() || undefined,
          start_seconds: formStartHMS ? hmsToSeconds(formStartHMS) : undefined,
          end_seconds: formEndHMS ? hmsToSeconds(formEndHMS) : undefined,
        },
        { errorMessage: 'Could not add card.' },
      );
      resetForm();
      setShowForm(false);
      await fetchCards();
    } catch {
      Alert.alert('Error', 'Could not add card.');
    } finally {
      setSaving(false);
    }
  }, [contentId, fetchCards, formBody, formCta, formEndHMS, formStartHMS, formTargetUrl, formTitle, formType, resetForm]);

  const handleDelete = useCallback((card: ContentCard) => {
    Alert.alert('Delete card?', `"${card.title ?? card.card_type}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(card.id);
          try {
            await deleteRequest(ROUTES.broadcasts.contentCard(card.id));
            setCards(prev => prev.filter(c => c.id !== card.id));
          } catch {
            Alert.alert('Error', 'Could not delete card.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }, []);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={palette.primaryStrong} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={[styles.errorText, { color: palette.subtext }]}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.surface }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.heading, { color: palette.text }]}>Content Cards</Text>

      {cards.length === 0 && (
        <View style={[styles.emptyCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No cards added yet.</Text>
        </View>
      )}

      {cards.map(card => {
        const color = CARD_TYPE_COLOR[card.card_type] ?? palette.primaryStrong;
        return (
          <View
            key={card.id}
            style={[styles.cardRow, { borderColor: palette.border, backgroundColor: palette.card }]}
          >
            <View style={[styles.typeBadge, { backgroundColor: color + '22' }]}>
              <Text style={[styles.typeBadgeText, { color }]}>{card.card_type.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              {card.title ? (
                <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                  {card.title}
                </Text>
              ) : null}
              {(card.start_seconds != null || card.end_seconds != null) && (
                <Text style={[styles.cardTime, { color: palette.subtext }]}>
                  {secondsToHMS(card.start_seconds ?? 0)} – {secondsToHMS(card.end_seconds ?? 0)}
                </Text>
              )}
              {card.cta_text ? (
                <Text style={[styles.cardCta, { color: palette.primaryStrong }]}>{card.cta_text}</Text>
              ) : null}
            </View>
            <Text
              onPress={() => {
                if (deletingId === card.id) return;
                handleDelete(card);
              }}
              style={[styles.deleteBtn, { color: '#EF4444', opacity: deletingId === card.id ? 0.4 : 1 }]}
            >
              {deletingId === card.id ? '...' : 'Delete'}
            </Text>
          </View>
        );
      })}

      {/* Add card form */}
      {showForm ? (
        <View style={[styles.formCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={[styles.formTitle, { color: palette.text }]}>Add Card</Text>

          {/* Type picker */}
          <View style={styles.typePicker}>
            {CARD_TYPES.map(t => {
              const active = formType === t;
              const color = CARD_TYPE_COLOR[t];
              return (
                <Text
                  key={t}
                  onPress={() => setFormType(t)}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: active ? color : palette.surface,
                      borderColor: active ? color : palette.border,
                      color: active ? '#fff' : palette.text,
                    },
                  ]}
                >
                  {t}
                </Text>
              );
            })}
          </View>

          <TextInput
            value={formTitle}
            onChangeText={setFormTitle}
            placeholder="Title"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
          />
          <TextInput
            value={formBody}
            onChangeText={setFormBody}
            placeholder="Body text (optional)"
            placeholderTextColor={palette.subtext}
            multiline
            style={[styles.input, styles.textarea, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
          />
          <TextInput
            value={formTargetUrl}
            onChangeText={setFormTargetUrl}
            placeholder="Target URL (optional)"
            placeholderTextColor={palette.subtext}
            autoCapitalize="none"
            style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
          />
          <TextInput
            value={formCta}
            onChangeText={setFormCta}
            placeholder="CTA text, e.g. Watch now"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
          />
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={[styles.timeLabel, { color: palette.subtext }]}>Start</Text>
              <HMSInput value={formStartHMS} onChange={setFormStartHMS} palette={palette} />
            </View>
            <View style={styles.timeField}>
              <Text style={[styles.timeLabel, { color: palette.subtext }]}>End</Text>
              <HMSInput value={formEndHMS} onChange={setFormEndHMS} palette={palette} />
            </View>
          </View>

          <View style={styles.formActions}>
            <Text
              onPress={() => { setShowForm(false); resetForm(); }}
              style={[styles.cancelBtn, { color: palette.subtext, borderColor: palette.border }]}
            >
              Cancel
            </Text>
            <Text
              onPress={saving ? undefined : handleAdd}
              style={[styles.saveBtn, { backgroundColor: palette.primaryStrong, opacity: saving ? 0.5 : 1 }]}
            >
              {saving ? 'Adding...' : 'Add Card'}
            </Text>
          </View>
        </View>
      ) : (
        <Text
          onPress={() => setShowForm(true)}
          style={[styles.addBtn, { backgroundColor: palette.primaryStrong }]}
        >
          + Add Card
        </Text>
      )}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  container: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  heading: { fontSize: 15, fontWeight: '900', marginBottom: 2 },
  emptyCard: { borderWidth: 1, borderRadius: 10, padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, fontWeight: '600' },
  cardRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  typeBadgeText: { fontSize: 10, fontWeight: '900' },
  cardTitle: { fontSize: 13, fontWeight: '800' },
  cardTime: { fontSize: 11, fontWeight: '600', marginTop: 2, fontFamily: 'monospace' },
  cardCta: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  deleteBtn: { fontSize: 12, fontWeight: '900' },
  formCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  formTitle: { fontSize: 14, fontWeight: '900' },
  typePicker: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '700',
  },
  textarea: { minHeight: 64, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row', gap: 10 },
  timeField: { flex: 1, gap: 4 },
  timeLabel: { fontSize: 11, fontWeight: '700' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
  },
  saveBtn: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 12,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    overflow: 'hidden',
  },
  addBtn: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '900',
    color: '#fff',
    overflow: 'hidden',
  },
  errorText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
