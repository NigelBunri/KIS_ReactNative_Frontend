// src/screens/broadcast/channels/studio/GuestInviteSheet.tsx
//
// Co-streaming guest management sheet for a live stream.
// Lists current guests with actions; lets the host invite new guests by
// email/username with a role selector.

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
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';

// ── Types ──────────────────────────────────────────────────────────────────────

type GuestRole   = 'CO_HOST' | 'GUEST';
type GuestStatus = 'invited' | 'accepted' | 'active' | 'declined';

type Guest = {
  id: string;
  display_name: string;
  email?: string;
  role: GuestRole;
  status: GuestStatus;
};

type Props = {
  streamId: string;
  visible: boolean;
  onClose: () => void;
  isHost?: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const guestStatusColor = (status: GuestStatus, p: any): string =>
  ({ invited: p.gold, accepted: p.primary, active: p.success, declined: p.danger } as Record<GuestStatus, string>)[status] ?? p.subtext;

const ROLE_LABEL: Record<GuestRole, string> = {
  CO_HOST: 'CO-HOST',
  GUEST:   'GUEST',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function GuestInviteSheet({
  streamId,
  visible,
  onClose,
  isHost = false,
}: Props) {
  const { palette } = useKISTheme();

  const [guests, setGuests]         = useState<Guest[]>([]);
  const [loading, setLoading]       = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteRole, setInviteRole] = useState<GuestRole>('GUEST');
  const [inviting, setInviting]     = useState(false);
  const [actioning, setActioning]   = useState<string | null>(null);

  // ── Fetch guests ─────────────────────────────────────────────────────────────

  const fetchGuests = useCallback(async () => {
    if (!streamId) return;
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.broadcasts.liveStreamGuests(streamId));
      if (res?.data) {
        const raw: Guest[] = Array.isArray(res.data)
          ? res.data
          : res.data.results ?? [];
        setGuests(raw);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  useEffect(() => {
    if (visible) fetchGuests();
  }, [visible, fetchGuests]);

  // ── Invite ───────────────────────────────────────────────────────────────────

  const handleInvite = useCallback(async () => {
    const query = inviteInput.trim();
    if (!query || inviting) return;
    setInviting(true);
    try {
      const res = await postRequest(
        ROUTES.broadcasts.liveStreamGuests(streamId),
        { user: query, role: inviteRole },
        { errorMessage: 'Failed to send invite' },
      );
      if (res?.success || res?.data) {
        setInviteInput('');
        await fetchGuests();
      } else {
        Alert.alert('Invite failed', res?.message || 'Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Invite failed', e?.message || 'Please try again.');
    } finally {
      setInviting(false);
    }
  }, [inviteInput, inviting, inviteRole, streamId, fetchGuests]);

  // ── Guest action (Activate / Remove) ─────────────────────────────────────────

  const handleGuestAction = useCallback(async (
    guestId: string,
    action: 'activate' | 'remove',
  ) => {
    if (actioning) return;
    setActioning(guestId);
    try {
      const res = await patchRequest(
        ROUTES.broadcasts.liveStreamGuestAction(streamId, guestId),
        { action },
        { errorMessage: `Failed to ${action} guest` },
      );
      if (res?.success || res?.data) {
        await fetchGuests();
      } else {
        Alert.alert('Action failed', res?.message || 'Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Action failed', e?.message || 'Please try again.');
    } finally {
      setActioning(null);
    }
  }, [actioning, streamId, fetchGuests]);

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
        <Pressable style={[styles.backdrop, { backgroundColor: palette.backdrop }]} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]}>
              Co-streaming Guests
            </Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeTouch}>
              <Text style={[styles.closeTxt, { color: palette.subtext }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Guest list */}
            {loading ? (
              <ActivityIndicator color={palette.gold} style={styles.loader} />
            ) : guests.length === 0 ? (
              <Text style={[styles.empty, { color: palette.subtext }]}>
                No guests yet.
              </Text>
            ) : (
              guests.map(guest => (
                <View
                  key={guest.id}
                  style={[styles.guestRow, { backgroundColor: palette.surfaceElevated }]}
                >
                  <View style={[styles.avatar, { backgroundColor: palette.gold }]}>
                    <Text style={[styles.avatarLetter, { color: palette.ivory }]}>
                      {(guest.display_name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.guestInfo}>
                    <Text style={[styles.guestName, { color: palette.text }]}>
                      {guest.display_name}
                    </Text>
                    {!!guest.email && (
                      <Text style={[styles.guestEmail, { color: palette.subtext }]}>
                        {guest.email}
                      </Text>
                    )}
                    <View style={styles.badges}>
                      <View style={[styles.badge, { backgroundColor: palette.primaryStrong + '22' }]}>
                        <Text style={[styles.badgeText, { color: palette.primaryStrong }]}>
                          {ROLE_LABEL[guest.role]}
                        </Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: guestStatusColor(guest.status, palette) + '22' }]}>
                        <Text style={[styles.badgeText, { color: guestStatusColor(guest.status, palette) }]}>
                          {guest.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {isHost && (
                    <View style={styles.actionCol}>
                      {guest.status === 'active' && (
                        <Pressable
                          onPress={() => handleGuestAction(guest.id, 'remove')}
                          disabled={actioning === guest.id}
                          style={[styles.actionBtn, { backgroundColor: palette.dangerSoft }]}
                        >
                          {actioning === guest.id ? (
                            <ActivityIndicator size="small" color={palette.danger} />
                          ) : (
                            <Text style={[styles.actionBtnText, { color: palette.danger }]}>
                              Remove
                            </Text>
                          )}
                        </Pressable>
                      )}
                      {guest.status === 'invited' && (
                        <Pressable
                          onPress={() => handleGuestAction(guest.id, 'activate')}
                          disabled={actioning === guest.id}
                          style={[styles.actionBtn, { backgroundColor: palette.successSoft }]}
                        >
                          {actioning === guest.id ? (
                            <ActivityIndicator size="small" color={palette.success} />
                          ) : (
                            <Text style={[styles.actionBtnText, { color: palette.success }]}>
                              Activate
                            </Text>
                          )}
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              ))
            )}

            {/* Invite section */}
            {isHost && (
              <View style={[styles.inviteSection, { borderTopColor: palette.border }]}>
                <Text style={[styles.inviteTitle, { color: palette.text }]}>
                  Invite Guest
                </Text>

                <TextInput
                  value={inviteInput}
                  onChangeText={setInviteInput}
                  placeholder="Username or email"
                  placeholderTextColor={palette.subtext}
                  style={[
                    styles.inviteInput,
                    { color: palette.text, borderColor: palette.border },
                  ]}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                {/* Role selector */}
                <View style={styles.roleRow}>
                  {(['GUEST', 'CO_HOST'] as GuestRole[]).map(role => (
                    <Pressable
                      key={role}
                      onPress={() => setInviteRole(role)}
                      style={[
                        styles.rolePill,
                        {
                          backgroundColor:
                            inviteRole === role ? palette.gold : palette.surfaceElevated,
                          borderColor:
                            inviteRole === role ? palette.gold : palette.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.rolePillText,
                          { color: inviteRole === role ? palette.onPrimary : palette.text },
                        ]}
                      >
                        {role === 'CO_HOST' ? 'Co-Host' : 'Guest'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  onPress={handleInvite}
                  disabled={!inviteInput.trim() || inviting}
                  style={[
                    styles.inviteBtn,
                    {
                      backgroundColor:
                        inviteInput.trim() && !inviting
                          ? palette.gold
                          : palette.surfaceElevated,
                    },
                  ]}
                >
                  {inviting ? (
                    <ActivityIndicator size="small" color={palette.onPrimary} />
                  ) : (
                    <Text style={[styles.inviteBtnText, { color: palette.onPrimary }]}>Send Invite</Text>
                  )}
                </Pressable>
              </View>
            )}
          </ScrollView>
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
    backgroundColor: undefined,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: { fontSize: 17, fontWeight: '700' },
  closeTouch: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 18 },
  body: { flex: 1 },
  bodyContent: { padding: 14, gap: 10 },
  loader: { marginVertical: 20 },
  empty: { textAlign: 'center', paddingVertical: 20, fontSize: 13 },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontWeight: '800', fontSize: 16 },
  guestInfo: { flex: 1, gap: 4 },
  guestName: { fontWeight: '700', fontSize: 14 },
  guestEmail: { fontSize: 12 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 2 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  actionCol: { justifyContent: 'center' },
  actionBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    minHeight: 44,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: { fontWeight: '700', fontSize: 12 },
  inviteSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    gap: 10,
    marginTop: 8,
  },
  inviteTitle: { fontSize: 15, fontWeight: '700' },
  inviteInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  roleRow: { flexDirection: 'row', gap: 10 },
  rolePill: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  rolePillText: { fontWeight: '700', fontSize: 13 },
  inviteBtn: {
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBtnText: { fontWeight: '800', fontSize: 14 },
});
