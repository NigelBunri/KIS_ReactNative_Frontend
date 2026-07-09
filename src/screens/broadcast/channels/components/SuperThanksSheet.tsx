// src/screens/broadcast/channels/components/SuperThanksSheet.tsx
//
// Super Thanks bottom sheet for tipping on a video (content-level tips).
// Shows recent top tips, amount presets, optional message, and a send button.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

// ── Types ──────────────────────────────────────────────────────────────────────

type Tip = {
  id: string;
  user_display_name: string;
  amount_cents: number;
  message?: string;
  created_at: string;
};

type Props = {
  contentId: string;
  visible: boolean;
  onClose: () => void;
  contentTitle?: string;
};

const AMOUNT_PRESETS = [1, 2, 5, 10, 25, 50];

// ── Component ─────────────────────────────────────────────────────────────────

export default function SuperThanksSheet({
  contentId,
  visible,
  onClose,
  contentTitle,
}: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();

  const [topTips, setTopTips] = useState<Tip[]>([]);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [successShown, setSuccessShown] = useState(false);

  // ── Fetch recent tips ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!visible || !contentId) return;
    setLoading(true);
    getRequest(ROUTES.broadcasts.contentTips(contentId))
      .then(res => {
        if (res?.data) {
          const raw: Tip[] = Array.isArray(res.data)
            ? res.data
            : res.data.results ?? [];
          // Sort by amount descending, take top 5
          raw.sort((a, b) => b.amount_cents - a.amount_cents);
          setTopTips(raw.slice(0, 5));
        }
      })
      .catch(() => {/* silent */})
      .finally(() => setLoading(false));
  }, [visible, contentId]);

  // ── Send ─────────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!selectedAmount || sending) return;
    setSending(true);
    try {
      const res = await postRequest(
        ROUTES.broadcasts.contentTips(contentId),
        { amount_cents: Math.round(selectedAmount * 100), currency: 'USD', message: message.trim() || undefined },
        { errorMessage: 'Failed to send Super Thanks' },
      );
      if (res?.success || res?.data) {
        setSelectedAmount(null);
        setMessage('');
        setSuccessShown(true);
        setTimeout(() => {
          setSuccessShown(false);
          onClose();
        }, 1800);
      } else {
        Alert.alert('Super Thanks failed', res?.message || 'Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Super Thanks failed', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  }, [selectedAmount, sending, message, contentId, onClose]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={[styles.backdrop, { backgroundColor: palette.royalInk, opacity: 0.55 }]} onPress={onClose} />
        <View style={[styles.panel, { backgroundColor: palette.surface, paddingBottom: 28 + insets.bottom }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]}>
              Super Thanks{contentTitle ? ` — ${contentTitle}` : ''}
            </Text>
            <Pressable onPress={onClose}>
              <Text style={[styles.closeTxt, { color: palette.subtext }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            {/* Success toast */}
            {successShown && (
              <View style={[styles.toast, { backgroundColor: palette.success }]}>
                <Text style={[styles.toastText, { color: palette.onPrimary }]}>Your Super Thanks was sent! ❤️</Text>
              </View>
            )}

            {/* Top tips */}
            {loading ? (
              <ActivityIndicator color={palette.gold} style={styles.loader} />
            ) : topTips.length > 0 ? (
              <View style={[styles.topTipsBox, { backgroundColor: palette.surfaceElevated, borderColor: palette.border }]}>
                <Text style={[styles.topTipsLabel, { color: palette.subtext }]}>
                  Recent supporters
                </Text>
                {topTips.map(tip => (
                  <View key={tip.id} style={styles.tipRow}>
                    <Text style={[styles.tipName, { color: palette.text }]}>
                      {tip.user_display_name}
                    </Text>
                    <Text style={[styles.tipAmt, { color: palette.gold }]}>
                      ${(tip.amount_cents / 100).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Amount presets */}
            <View style={styles.chipsWrap}>
              {AMOUNT_PRESETS.map(amt => (
                <Pressable
                  key={amt}
                  onPress={() => setSelectedAmount(amt === selectedAmount ? null : amt)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        selectedAmount === amt ? palette.gold : palette.surfaceElevated,
                      borderColor:
                        selectedAmount === amt ? palette.gold : palette.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: selectedAmount === amt ? palette.onPrimary : palette.text },
                    ]}
                  >
                    ${amt}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Message input */}
            <View style={styles.msgWrap}>
              <TextInput
                value={message}
                onChangeText={t => setMessage(t.slice(0, 150))}
                placeholder="Add a message (optional)"
                placeholderTextColor={palette.subtext}
                style={[
                  styles.msgInput,
                  { color: palette.text, borderColor: palette.border },
                ]}
                multiline
                maxLength={150}
              />
              <Text style={[styles.charCount, { color: palette.subtext }]}>
                {message.length}/150
              </Text>
            </View>
          </ScrollView>

          {/* Send button */}
          <Pressable
            onPress={handleSend}
            disabled={!selectedAmount || sending}
            style={[
              styles.sendBtn,
              {
                backgroundColor:
                  selectedAmount && !sending ? palette.gold : palette.surfaceElevated,
              },
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color={palette.ivory} />
            ) : (
              <Text style={[styles.sendBtnText, { color: palette.onPrimary }]}>Send Thanks ❤</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: { fontSize: 17, fontWeight: '700', flex: 1, marginRight: 8 },
  closeTxt: { fontSize: 18, padding: 4, minWidth: 44, minHeight: 44, textAlign: 'center', lineHeight: 44 },
  body: { paddingHorizontal: 14, paddingBottom: 8, gap: 14 },
  toast: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  toastText: { fontWeight: '700', fontSize: 14 },
  loader: { marginVertical: 12 },
  topTipsBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  topTipsLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  tipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tipName: { fontSize: 13, fontWeight: '600' },
  tipAmt: { fontSize: 13, fontWeight: '800' },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipText: { fontWeight: '700', fontSize: 14 },
  msgWrap: { position: 'relative' },
  msgInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 30,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  charCount: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    fontSize: 10,
  },
  sendBtn: {
    marginHorizontal: 14,
    marginTop: 6,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: { fontWeight: '800', fontSize: 16 },
});
