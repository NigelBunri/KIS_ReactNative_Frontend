// src/screens/broadcast/channels/components/SuperChatPanel.tsx
//
// Super Chat panel for live streams. Shows pinned tips at top (gold highlight),
// then recent tips sorted by most recent. Bottom form lets viewer send a tip
// with a preset amount and optional message.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

// ── Types ──────────────────────────────────────────────────────────────────────

type SuperTip = {
  id: string;
  username: string;
  amount: number;
  message?: string;
  is_pinned?: boolean;
  created_at: string;
};

type Props = {
  streamId: string;
  visible: boolean;
  onClose: () => void;
};

const AMOUNT_PRESETS = [1, 2, 5, 10, 25, 50];
const REFRESH_INTERVAL_MS = 15000;

// ── Helpers ────────────────────────────────────────────────────────────────────

function amountColor(amount: number, palette: any): string {
  if (amount >= 10) return palette.gold;    // gold for large tips
  if (amount >= 5) return palette.primary;  // primary blue for mid tips
  return palette.success;                   // green for small tips
}

function avatarLetter(username: string): string {
  return (username || '?').charAt(0).toUpperCase();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SuperChatPanel({ streamId, visible, onClose }: Props) {
  const { palette } = useKISTheme();

  const [tips, setTips] = useState<SuperTip[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchTips = useCallback(async () => {
    if (!streamId) return;
    try {
      const res = await getRequest(ROUTES.broadcasts.liveStreamTips(streamId));
      if (res?.data) {
        const raw: SuperTip[] = Array.isArray(res.data)
          ? res.data
          : res.data.results ?? [];
        // Pinned first, then by most recent
        raw.sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setTips(raw);
      }
    } catch {
      // silent — auto-refresh will retry
    }
  }, [streamId]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    fetchTips().finally(() => setLoading(false));
    intervalRef.current = setInterval(fetchTips, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible, fetchTips]);

  // ── Send tip ─────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!selectedAmount || sending) return;
    setSending(true);
    try {
      const res = await postRequest(
        ROUTES.broadcasts.liveStreamTipSend(streamId),
        { amount: selectedAmount, message: message.trim() || undefined },
        { errorMessage: 'Failed to send Super Chat' },
      );
      if (res?.success || res?.data) {
        setSelectedAmount(null);
        setMessage('');
        setShowForm(false);
        await fetchTips();
      } else {
        Alert.alert('Super Chat failed', res?.message || 'Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Super Chat failed', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  }, [selectedAmount, sending, message, streamId, fetchTips]);

  // ── Render ───────────────────────────────────────────────────────────────────

  const renderTip = useCallback(({ item }: { item: SuperTip }) => {
    const color = amountColor(item.amount, palette);
    const isPinned = item.is_pinned;
    return (
      <View
        style={[
          styles.tipCard,
          { backgroundColor: isPinned ? palette.primarySoft ?? palette.surfaceElevated : palette.surfaceElevated },
          isPinned && { borderColor: color, borderWidth: 1 },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={[styles.avatarLetter, { color: palette.ivory }]}>{avatarLetter(item.username)}</Text>
        </View>
        <View style={styles.tipBody}>
          <View style={styles.tipHeader}>
            <Text style={[styles.tipName, { color: palette.text }]}>{item.username}</Text>
            <View style={[styles.amountBadge, { backgroundColor: color }]}>
              <Text style={[styles.amountText, { color: palette.ivory }]}>${item.amount}</Text>
            </View>
          </View>
          {!!item.message && (
            <Text style={[styles.tipMsg, { color: palette.subtext }]}>{item.message}</Text>
          )}
        </View>
      </View>
    );
  }, [palette]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={[styles.backdrop, { backgroundColor: palette.royalInk, opacity: 0.5 }]} onPress={onClose} />
        <View style={[styles.panel, { backgroundColor: palette.surface }]}>
          {/* Header */}
          <View style={styles.panelHeader}>
            <Text style={[styles.panelTitle, { color: palette.text }]}>Super Chat</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeTxt, { color: palette.subtext }]}>✕</Text>
            </Pressable>
          </View>

          {/* Tips list */}
          {loading ? (
            <ActivityIndicator style={styles.loader} color={palette.gold} />
          ) : (
            <FlatList
              data={tips}
              renderItem={renderTip}
              keyExtractor={t => t.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: palette.subtext }]}>
                  No Super Chats yet. Be the first!
                </Text>
              }
            />
          )}

          {/* Send form */}
          {showForm ? (
            <View style={[styles.form, { borderTopColor: palette.border }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
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
              </ScrollView>

              <View style={styles.msgRow}>
                <TextInput
                  value={message}
                  onChangeText={t => setMessage(t.slice(0, 150))}
                  placeholder="Add a message (optional)"
                  placeholderTextColor={palette.subtext}
                  style={[styles.msgInput, { color: palette.text, borderColor: palette.border }]}
                  multiline
                  maxLength={150}
                />
                <Text style={[styles.charCount, { color: palette.subtext }]}>
                  {message.length}/150
                </Text>
              </View>

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
                  <Text style={[styles.sendBtnText, { color: palette.onPrimary }]}>Send Super Chat</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setShowForm(true)}
              style={[styles.openFormBtn, { backgroundColor: palette.gold }]}
            >
              <Text style={[styles.openFormText, { color: palette.onPrimary }]}>⚡ Super Chat</Text>
            </Pressable>
          )}
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
    maxHeight: '80%',
    paddingBottom: 24,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: { padding: 4, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 18 },
  loader: { marginVertical: 20 },
  list: { maxHeight: 280 },
  listContent: { paddingHorizontal: 12, paddingBottom: 8 },
  empty: { textAlign: 'center', paddingVertical: 20, fontSize: 13 },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontWeight: '800', fontSize: 15 },
  tipBody: { flex: 1 },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  tipName: { fontWeight: '700', fontSize: 13, flex: 1 },
  amountBadge: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  amountText: { fontWeight: '800', fontSize: 11 },
  tipMsg: { fontSize: 12, lineHeight: 17 },
  form: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  chips: { flexGrow: 0 },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipText: { fontWeight: '700', fontSize: 13 },
  msgRow: { position: 'relative' },
  msgInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 28,
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  charCount: {
    position: 'absolute',
    bottom: 6,
    right: 10,
    fontSize: 10,
  },
  sendBtn: {
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: { fontWeight: '800', fontSize: 15 },
  openFormBtn: {
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openFormText: { fontWeight: '800', fontSize: 15 },
});
