// src/components/partners/PartnerSupportInboxPanel.tsx
//
// Support Inbox & Helpdesk: members submit support tickets, admins
// triage/assign/resolve them and reply (optionally as an internal note
// hidden from the requester). Backed by apps.partners.SupportTicket +
// SupportTicketReply — a small, fully-Django ticket + reply thread (not
// routed through apps.chat.Conversation/NestJS, unlike PartnerPost
// comments, to keep this feature self-contained).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  canManage?: boolean;
  onClose: () => void;
};

type Ticket = {
  id: string | number;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  requester_name?: string | null;
  assignee?: string | null;
  assignee_name?: string | null;
  reply_count: number;
  created_at: string;
};

type Reply = { id: string | number; author_name?: string | null; body: string; is_internal_note: boolean; created_at: string };
type MemberOption = { user_id: string; display_name?: string | null; username?: string | null };

const inputStyle = (palette: any) => ({
  color: palette.text,
  borderColor: palette.borderMuted,
  borderWidth: 2,
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderRadius: 10,
  marginTop: 8,
});

const statusLabel: Record<string, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };
const priorityLabel: Record<string, string> = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };
const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent'];

export default function PartnerSupportInboxPanel({ isOpen, panelWidth, panelTranslateX, partnerId, canManage, onClose }: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [summary, setSummary] = useState<{ counts: Record<string, number>; unassigned: number; total: number } | null>(null);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('normal');

  const [selectedTicketId, setSelectedTicketId] = useState<string | number | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replyIsNote, setReplyIsNote] = useState(false);

  const backdropOpacity = panelTranslateX.interpolate({ inputRange: [0, panelWidth], outputRange: [1, 0], extrapolate: 'clamp' });

  const load = useCallback(async () => {
    if (!partnerId) return;
    const requests: Promise<any>[] = [
      getRequest(ROUTES.partners.supportTickets(partnerId), { errorMessage: 'Unable to load tickets.' }),
    ];
    if (canManage) {
      requests.push(getRequest(ROUTES.partners.supportInboxSummary(partnerId), { errorMessage: 'Unable to load summary.' }));
      requests.push(getRequest(`${ROUTES.partners.members(partnerId)}?page=1`, { errorMessage: 'Unable to load members.' }));
    }
    const [ticketRes, summaryRes, memberRes] = await Promise.all(requests);
    const payload = ticketRes?.data ?? [];
    setTickets(Array.isArray(payload) ? payload : []);
    if (summaryRes) setSummary(summaryRes.data ?? null);
    if (memberRes) {
      const memberPayload = memberRes.data ?? {};
      const memberList = (memberPayload.results ?? memberPayload.members ?? []) as MemberOption[];
      setMembers(Array.isArray(memberList) ? memberList : []);
    }
  }, [partnerId, canManage]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isOpen, load]);

  const selectedTicket = useMemo(
    () => tickets.find((t) => String(t.id) === String(selectedTicketId)) ?? null,
    [tickets, selectedTicketId],
  );

  const loadReplies = useCallback(
    async (ticketId: string | number) => {
      if (!partnerId) return;
      setRepliesLoading(true);
      const res = await getRequest(ROUTES.partners.supportTicketReplies(partnerId, String(ticketId)), {
        errorMessage: 'Unable to load replies.',
      });
      const payload = (res?.data ?? []) as Reply[];
      setReplies(Array.isArray(payload) ? payload : []);
      setRepliesLoading(false);
    },
    [partnerId],
  );

  const openTicket = (ticket: Ticket) => {
    setSelectedTicketId(ticket.id);
    setReplyBody('');
    setReplyIsNote(false);
    loadReplies(ticket.id);
  };

  const createTicket = async () => {
    if (!partnerId || !newSubject.trim()) {
      Alert.alert('Missing info', 'Subject is required.');
      return;
    }
    setSaving(true);
    const res = await postRequest(
      ROUTES.partners.supportTickets(partnerId),
      { subject: newSubject.trim(), description: newDescription.trim(), priority: newPriority },
      { errorMessage: 'Unable to submit ticket.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to submit ticket.');
      return;
    }
    setNewSubject('');
    setNewDescription('');
    setNewPriority('normal');
    setShowCreate(false);
    load();
  };

  const updateTicket = async (fields: Record<string, any>) => {
    if (!partnerId || !selectedTicket) return;
    const res = await patchRequest(ROUTES.partners.supportTicketDetail(partnerId, String(selectedTicket.id)), fields, {
      errorMessage: 'Unable to update ticket.',
    });
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to update ticket.');
      return;
    }
    load();
  };

  const sendReply = async () => {
    if (!partnerId || !selectedTicket || !replyBody.trim()) return;
    setSaving(true);
    const res = await postRequest(
      ROUTES.partners.supportTicketReplies(partnerId, String(selectedTicket.id)),
      { body: replyBody.trim(), is_internal_note: canManage ? replyIsNote : false },
      { errorMessage: 'Unable to send reply.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to send reply.');
      return;
    }
    setReplyBody('');
    setReplyIsNote(false);
    loadReplies(selectedTicket.id);
    load();
  };

  if (!isOpen) return null;

  const memberName = (m: MemberOption) => m.display_name || m.username || 'Member';

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.settingsPanelBackdrop, { backgroundColor: palette.backdrop, opacity: backdropOpacity }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          { width: panelWidth, backgroundColor: palette.surfaceElevated, borderLeftColor: palette.divider, transform: [{ translateX: panelTranslateX }] },
        ]}
      >
        <View style={[styles.settingsPanelHeader, { borderBottomColor: palette.divider }]}>
          <Pressable
            onPress={() => (selectedTicketId ? setSelectedTicketId(null) : onClose())}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>
              {selectedTicket ? selectedTicket.subject : 'Support Inbox'}
            </Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              {selectedTicket ? `${statusLabel[selectedTicket.status]} · ${priorityLabel[selectedTicket.priority]}` : 'Member support tickets & helpdesk'}
            </Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : selectedTicket ? (
            <>
              {selectedTicket.description ? (
                <Text style={{ color: palette.subtext, fontSize: 13, marginBottom: 16 }}>{selectedTicket.description}</Text>
              ) : null}

              {canManage ? (
                <>
                  <Text style={{ color: palette.text, fontSize: 13, fontWeight: '800', marginBottom: 6 }}>Status</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {STATUS_OPTIONS.map((opt) => {
                      const selected = selectedTicket.status === opt;
                      return (
                        <Pressable
                          key={opt}
                          onPress={() => updateTicket({ status: opt })}
                          style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: selected ? palette.primary : palette.borderMuted }}
                        >
                          <Text style={{ color: selected ? palette.primary : palette.text, fontSize: 12 }}>{statusLabel[opt]}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={{ color: palette.text, fontSize: 13, fontWeight: '800', marginBottom: 6 }}>Assign to</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 16 }}>
                    {members.map((m) => {
                      const selected = String(selectedTicket.assignee) === m.user_id;
                      return (
                        <Pressable
                          key={m.user_id}
                          onPress={() => updateTicket({ assignee: selected ? null : m.user_id })}
                          style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: selected ? palette.primary : palette.borderMuted }}
                        >
                          <Text style={{ color: selected ? palette.primary : palette.text, fontSize: 12 }}>{memberName(m)}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              ) : (
                <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 16 }}>
                  {selectedTicket.assignee_name ? `Assigned to ${selectedTicket.assignee_name}` : 'Not yet assigned'}
                </Text>
              )}

              <Text style={{ color: palette.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>
                Replies ({replies.filter((r) => !r.is_internal_note).length})
              </Text>
              {repliesLoading ? (
                <ActivityIndicator size="small" color={palette.primary} />
              ) : replies.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 13, marginBottom: 12 }}>No replies yet.</Text>
              ) : (
                replies.map((reply) => (
                  <View
                    key={reply.id}
                    style={[
                      styles.settingsFeatureRow,
                      {
                        borderColor: reply.is_internal_note ? palette.warning ?? palette.primary : palette.borderMuted,
                        backgroundColor: reply.is_internal_note ? `${palette.primary}11` : palette.surface,
                        marginBottom: 8,
                      },
                    ]}
                  >
                    <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                      {reply.author_name || 'Member'}{reply.is_internal_note ? ' · Internal note' : ''}
                    </Text>
                    <Text style={{ color: palette.text, fontSize: 13, marginTop: 4 }}>{reply.body}</Text>
                  </View>
                ))
              )}

              <TextInput
                value={replyBody}
                onChangeText={setReplyBody}
                placeholder="Write a reply…"
                placeholderTextColor={palette.subtext}
                multiline
                style={[inputStyle(palette), { minHeight: 70, textAlignVertical: 'top' }]}
              />
              {canManage ? (
                <Pressable onPress={() => setReplyIsNote((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <View
                    style={{
                      width: 18, height: 18, borderRadius: 4, borderWidth: 2, marginRight: 8,
                      borderColor: replyIsNote ? palette.primary : palette.borderMuted,
                      backgroundColor: replyIsNote ? palette.primary : 'transparent',
                    }}
                  />
                  <Text style={{ color: palette.text, fontSize: 12 }}>Internal note (hidden from requester)</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={sendReply}
                disabled={saving}
                style={({ pressed }) => [{ marginTop: 10, paddingVertical: 10, borderRadius: 10, backgroundColor: palette.royalInk, alignItems: 'center', opacity: pressed || saving ? 0.7 : 1, marginBottom: 20 }]}
              >
                <Text style={{ color: palette.ivory, fontWeight: '700' }}>{saving ? 'Sending…' : 'Send reply'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              {summary ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                  {STATUS_OPTIONS.map((opt) => (
                    <View key={opt} style={{ minWidth: '30%', borderRadius: 12, borderWidth: 1, borderColor: palette.borderMuted, backgroundColor: palette.surface, padding: 10 }}>
                      <Text style={{ color: palette.text, fontSize: 18, fontWeight: '900' }}>{summary.counts[opt] ?? 0}</Text>
                      <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700' }}>{statusLabel[opt]}</Text>
                    </View>
                  ))}
                  <View style={{ minWidth: '30%', borderRadius: 12, borderWidth: 1, borderColor: palette.primary, backgroundColor: `${palette.primary}11`, padding: 10 }}>
                    <Text style={{ color: palette.primary, fontSize: 18, fontWeight: '900' }}>{summary.unassigned}</Text>
                    <Text style={{ color: palette.primary, fontSize: 11, fontWeight: '700' }}>Unassigned</Text>
                  </View>
                </View>
              ) : null}

              <Pressable onPress={() => setShowCreate((v) => !v)}>
                <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '700', marginBottom: showCreate ? 8 : 12 }}>
                  {showCreate ? '− Cancel new ticket' : '+ Submit a ticket'}
                </Text>
              </Pressable>
              {showCreate ? (
                <View style={{ marginBottom: 16 }}>
                  <TextInput value={newSubject} onChangeText={setNewSubject} placeholder="Subject" placeholderTextColor={palette.subtext} style={[inputStyle(palette), { marginTop: 0 }]} />
                  <TextInput value={newDescription} onChangeText={setNewDescription} placeholder="Describe the issue (optional)" placeholderTextColor={palette.subtext} multiline style={[inputStyle(palette), { minHeight: 60, textAlignVertical: 'top' }]} />
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                    {PRIORITY_OPTIONS.map((opt) => {
                      const selected = newPriority === opt;
                      return (
                        <Pressable
                          key={opt}
                          onPress={() => setNewPriority(opt)}
                          style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: selected ? palette.primary : palette.borderMuted }}
                        >
                          <Text style={{ color: selected ? palette.primary : palette.text, fontSize: 12 }}>{priorityLabel[opt]}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable
                    onPress={createTicket}
                    disabled={saving}
                    style={({ pressed }) => [{ marginTop: 10, paddingVertical: 10, borderRadius: 10, backgroundColor: palette.royalInk, alignItems: 'center', opacity: pressed || saving ? 0.7 : 1 }]}
                  >
                    <Text style={{ color: palette.ivory, fontWeight: '700' }}>{saving ? 'Submitting…' : 'Submit ticket'}</Text>
                  </Pressable>
                </View>
              ) : null}

              {tickets.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginTop: 20 }}>No tickets yet.</Text>
              ) : (
                tickets.map((ticket) => (
                  <Pressable
                    key={ticket.id}
                    onPress={() => openTicket(ticket)}
                    style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.settingsFeatureTitle, { color: palette.text }]} numberOfLines={1}>{ticket.subject}</Text>
                      <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700' }}>{statusLabel[ticket.status]}</Text>
                    </View>
                    <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>
                      {priorityLabel[ticket.priority]}
                      {canManage && ticket.requester_name ? ` · ${ticket.requester_name}` : ''}
                      {ticket.assignee_name ? ` · Assigned: ${ticket.assignee_name}` : ''}
                      {' · '}{ticket.reply_count} repl{ticket.reply_count === 1 ? 'y' : 'ies'}
                    </Text>
                  </Pressable>
                ))
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
