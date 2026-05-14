import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import type { KISPalette } from '@/theme/constants';
import {
  fetchVerificationExpiryReminders,
  fetchVerificationStaffAuditEvents,
  fetchVerificationStaffCases,
  issueVerificationStaffBadge,
  revokeVerificationStaffBadge,
  updateVerificationStaffCaseStatus,
  type VerificationStaffAuditEvent,
  type VerificationStaffCase,
} from '@/services/verificationService';

const SUBJECT_FILTERS = [
  { key: '', label: 'All' },
  { key: 'user', label: 'Users' },
  { key: 'shop', label: 'Shops' },
  { key: 'partner', label: 'Partners' },
  { key: 'health_institution', label: 'Health' },
  { key: 'education_institution', label: 'Education' },
];

const STATUS_FILTERS = [
  { key: '', label: 'Open' },
  { key: 'provider_pending', label: 'Provider' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'needs_more_info', label: 'Needs info' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const BADGE_ACTIONS: Record<string, Array<{ code: string; label: string }>> = {
  user: [
    { code: 'verified_user', label: 'Verified user' },
    { code: 'id_verified', label: 'ID verified' },
  ],
  shop: [
    { code: 'verified_shop', label: 'Verified shop' },
    { code: 'trusted_merchant', label: 'Trusted merchant' },
  ],
  partner: [
    { code: 'verified_partner', label: 'Verified partner' },
    { code: 'verified_organization', label: 'Verified org' },
    { code: 'official_partner', label: 'Official partner' },
  ],
  health_institution: [
    { code: 'verified_health_institution', label: 'Verified health' },
    { code: 'licensed_provider', label: 'Licensed' },
  ],
  education_institution: [
    { code: 'verified_education_institution', label: 'Verified education' },
    { code: 'accredited_education', label: 'Accredited' },
  ],
};

const humanize = (value?: string | null) =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, letter => letter.toUpperCase());

export function VerificationStaffConsole({
  visible,
  palette,
  onClose,
}: {
  visible: boolean;
  palette: KISPalette;
  onClose: () => void;
}) {
  const [cases, setCases] = useState<VerificationStaffCase[]>([]);
  const [auditEvents, setAuditEvents] = useState<VerificationStaffAuditEvent[]>([]);
  const [expiryCount, setExpiryCount] = useState(0);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedCase = useMemo(
    () => cases.find(item => item.id === selectedCaseId) || cases[0] || null,
    [cases, selectedCaseId],
  );
  const badgeActions = BADGE_ACTIONS[String(selectedCase?.subject?.subject_type || '')] || [];

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [queue, audit, expiry] = await Promise.all([
        fetchVerificationStaffCases({
          limit: 25,
          subject_type: subjectFilter || undefined,
          status: statusFilter || undefined,
        }),
        fetchVerificationStaffAuditEvents(15),
        fetchVerificationExpiryReminders(30),
      ]);
      setCases(queue);
      setAuditEvents(audit);
      setExpiryCount((expiry?.cases?.length || 0) + (expiry?.badges?.length || 0));
      if (!selectedCaseId && queue[0]?.id) setSelectedCaseId(queue[0].id);
    } catch (error: any) {
      setMessage(error?.message || 'Unable to load verification staff console.');
    } finally {
      setLoading(false);
    }
  }, [selectedCaseId, statusFilter, subjectFilter]);

  useEffect(() => {
    if (visible) load();
  }, [load, visible]);

  const refreshSelectedCase = (updatedCase?: VerificationStaffCase) => {
    if (updatedCase?.id) {
      setCases(prev => prev.map(item => (item.id === updatedCase.id ? updatedCase : item)));
    }
  };

  const issueBadge = async (code: string) => {
    if (!selectedCase?.id || !selectedCase.subject?.subject_type) return;
    setBusy(true);
    setMessage(null);
    try {
      await issueVerificationStaffBadge({
        case_id: selectedCase.id,
        subject_type: selectedCase.subject.subject_type,
        code,
        reason: notes || 'Issued from verification staff console.',
      });
      setMessage('Verification badge issued.');
      setNotes('');
      await load();
    } catch (error: any) {
      setMessage(error?.message || 'Unable to issue verification badge.');
    } finally {
      setBusy(false);
    }
  };

  const revokeBadge = async (badgeId?: string) => {
    if (!badgeId) return;
    setBusy(true);
    setMessage(null);
    try {
      await revokeVerificationStaffBadge(badgeId, notes || 'Revoked from verification staff console.');
      setMessage('Verification badge revoked.');
      setNotes('');
      await load();
    } catch (error: any) {
      setMessage(error?.message || 'Unable to revoke verification badge.');
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (status: 'in_review' | 'needs_more_info' | 'cancelled') => {
    if (!selectedCase?.id) return;
    setBusy(true);
    setMessage(null);
    try {
      const updated = await updateVerificationStaffCaseStatus(selectedCase.id, { status, notes });
      refreshSelectedCase(updated);
      setMessage('Verification case updated.');
      setNotes('');
    } catch (error: any) {
      setMessage(error?.message || 'Unable to update verification case.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: palette.card, borderColor: palette.divider }]}> 
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: palette.primaryStrong }]}>Staff review</Text>
              <Text style={[styles.title, { color: palette.text }]}>Verification console</Text>
              <Text style={[styles.subtitle, { color: palette.subtext }]}>Review queue, expiry visibility, and audit events. Evidence payloads stay summarized.</Text>
            </View>
            <Pressable onPress={onClose} style={[styles.iconButton, { backgroundColor: palette.surface }]}> 
              <KISIcon name="close" size={18} color={palette.text} />
            </Pressable>
          </View>
          {loading ? <ActivityIndicator color={palette.primaryStrong} /> : null}
          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 26 }} showsVerticalScrollIndicator={false}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SUBJECT_FILTERS.map(item => (
                <Pressable
                  key={item.key || 'all'}
                  onPress={() => {
                    setSubjectFilter(item.key);
                    setSelectedCaseId(null);
                  }}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: subjectFilter === item.key ? palette.primarySoft : palette.surface,
                      borderColor: subjectFilter === item.key ? palette.primaryStrong : palette.divider,
                    },
                  ]}
                >
                  <Text style={[styles.filterChipText, { color: palette.text }]}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {STATUS_FILTERS.map(item => (
                <Pressable
                  key={item.key || 'open'}
                  onPress={() => {
                    setStatusFilter(item.key);
                    setSelectedCaseId(null);
                  }}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: statusFilter === item.key ? palette.primarySoft : palette.surface,
                      borderColor: statusFilter === item.key ? palette.primaryStrong : palette.divider,
                    },
                  ]}
                >
                  <Text style={[styles.filterChipText, { color: palette.text }]}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}> 
                <Text style={[styles.statValue, { color: palette.text }]}>{cases.length}</Text>
                <Text style={[styles.statLabel, { color: palette.subtext }]}>Open cases</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}> 
                <Text style={[styles.statValue, { color: palette.text }]}>{expiryCount}</Text>
                <Text style={[styles.statLabel, { color: palette.subtext }]}>30-day expiry</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {cases.map(item => (
                <Pressable
                  key={item.id}
                  onPress={() => setSelectedCaseId(item.id)}
                  style={[
                    styles.caseChip,
                    {
                      backgroundColor: selectedCase?.id === item.id ? palette.primarySoft : palette.surface,
                      borderColor: selectedCase?.id === item.id ? palette.primaryStrong : palette.divider,
                    },
                  ]}
                >
                  <Text style={[styles.caseChipTitle, { color: palette.text }]} numberOfLines={1}>{item.subject?.display_name || humanize(item.subject?.subject_type) || 'Verification'}</Text>
                  <Text style={[styles.caseChipMeta, { color: palette.subtext }]}>{humanize(item.status)}</Text>
                </Pressable>
              ))}
              {!cases.length && !loading ? <Text style={{ color: palette.subtext }}>No open verification cases.</Text> : null}
            </ScrollView>

            {selectedCase ? (
              <View style={[styles.detailCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}> 
                <Text style={[styles.detailTitle, { color: palette.text }]}>{selectedCase.subject?.display_name || 'Verification case'}</Text>
                <Text style={[styles.detailMeta, { color: palette.subtext }]}>{humanize(selectedCase.subject?.subject_type)} • {humanize(selectedCase.status)} • {selectedCase.provider || 'manual'}</Text>
                <Text style={[styles.detailBody, { color: palette.subtext }]}>Evidence keys: {Array.isArray(selectedCase.evidence_summary?.keys) ? selectedCase.evidence_summary?.keys.join(', ') || 'none' : 'summarized only'}</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Reviewer note, optional"
                  placeholderTextColor={palette.subtext}
                  multiline
                  style={[styles.notes, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.card }]}
                />
                <View style={styles.actionRow}>
                  <KISButton title="In review" size="sm" variant="secondary" disabled={busy} onPress={() => updateStatus('in_review')} />
                  <KISButton title="Need info" size="sm" variant="outline" disabled={busy} onPress={() => updateStatus('needs_more_info')} />
                  <KISButton title="Cancel" size="sm" variant="danger" disabled={busy} onPress={() => updateStatus('cancelled')} />
                </View>
                {badgeActions.length ? (
                  <View style={styles.badgeActionBox}>
                    <Text style={[styles.detailMeta, { color: palette.text }]}>{humanize(selectedCase.subject?.subject_type)} badges</Text>
                    <View style={styles.actionRow}>
                      {badgeActions.map(action => (
                        <KISButton key={action.code} title={action.label} size="sm" disabled={busy} onPress={() => issueBadge(action.code)} />
                      ))}
                    </View>
                    {selectedCase.badges?.length ? (
                      <View style={{ gap: 6 }}>
                        {selectedCase.badges.map(badge => (
                          <View key={badge.id || badge.code} style={[styles.badgeRow, { borderColor: palette.divider, backgroundColor: palette.card }]}> 
                            <Text style={[styles.detailBody, { color: palette.text, flex: 1 }]} numberOfLines={1}>{badge.label || humanize(badge.code)} • {humanize(badge.status)}</Text>
                            {badge.id && badge.status === 'active' ? (
                              <KISButton title="Revoke" size="xs" variant="danger" disabled={busy} onPress={() => revokeBadge(badge.id)} />
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={[styles.detailCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}> 
              <Text style={[styles.detailTitle, { color: palette.text }]}>Recent audit</Text>
              {auditEvents.slice(0, 8).map(event => (
                <View key={event.id} style={styles.auditRow}>
                  <View style={[styles.auditDot, { backgroundColor: palette.primaryStrong }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.auditAction, { color: palette.text }]}>{humanize(event.action)}</Text>
                    <Text style={[styles.detailBody, { color: palette.subtext }]} numberOfLines={1}>{event.actor_label || event.provider || 'system'} • {event.created_at || ''}</Text>
                  </View>
                </View>
              ))}
              {!auditEvents.length && !loading ? <Text style={{ color: palette.subtext }}>No audit events loaded.</Text> : null}
            </View>

            {message ? <Text style={{ color: message.includes('updated') ? palette.primaryStrong : '#DC2626', fontWeight: '800' }}>{message}</Text> : null}
            <KISButton title="Refresh console" variant="outline" onPress={load} disabled={loading || busy} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.48)' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingHorizontal: 18, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 46, height: 5, borderRadius: 999, backgroundColor: 'rgba(148,163,184,0.55)', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  eyebrow: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0 },
  title: { fontSize: 22, fontWeight: '900' },
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 19 },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 14 },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 12, fontWeight: '800' },
  filterChip: { minHeight: 36, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center' },
  filterChipText: { fontSize: 12, fontWeight: '900' },
  caseChip: { width: 190, borderWidth: 1, borderRadius: 18, padding: 12, gap: 4 },
  caseChipTitle: { fontSize: 13, fontWeight: '900' },
  caseChipMeta: { fontSize: 12, fontWeight: '700' },
  detailCard: { borderWidth: 1, borderRadius: 20, padding: 14, gap: 10 },
  detailTitle: { fontSize: 15, fontWeight: '900' },
  detailMeta: { fontSize: 12, fontWeight: '800' },
  detailBody: { fontSize: 12, lineHeight: 18 },
  notes: { minHeight: 78, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: 'top' },
  badgeActionBox: { gap: 8, paddingTop: 4 },
  badgeRow: { minHeight: 42, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  auditRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  auditDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  auditAction: { fontSize: 12, fontWeight: '900' },
});
