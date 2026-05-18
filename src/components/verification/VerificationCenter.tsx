import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import type { KISPalette } from '@/theme/constants';
import {
  fetchVerificationStatus,
  getVerificationSummary,
  startVerificationCase,
  submitCaseEvidence,
  uploadVerificationEvidenceMedia,
  type VerificationEvidencePrivateRef,
  type VerificationSubjectRef,
  type VerificationSummary,
} from '@/services/verificationService';

type BadgeTone = 'verified' | 'pending' | 'review' | 'neutral' | 'rejected';

const humanize = (value?: string | null) =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, letter => letter.toUpperCase());

const resolveTone = (summary?: VerificationSummary | null): BadgeTone => {
  const status = String(summary?.status || summary?.latest_case?.status || '').toLowerCase();
  if (summary?.verified || status === 'approved' || status === 'verified') return 'verified';
  if (status.includes('reject') || status.includes('fail')) return 'rejected';
  if (status.includes('review') || status.includes('pending') || status.includes('submitted')) return 'pending';
  if (status.includes('more') || status.includes('progress')) return 'review';
  return 'neutral';
};

const toneColors = (palette: KISPalette, tone: BadgeTone) => {
  if (tone === 'verified') {
    return {
      bg: palette.primarySoft || 'rgba(15,118,110,0.12)',
      border: palette.primaryStrong || '#0F766E',
      text: palette.primaryStrong || '#0F766E',
    };
  }
  if (tone === 'rejected') {
    return { bg: 'rgba(220,38,38,0.10)', border: '#DC2626', text: '#DC2626' };
  }
  if (tone === 'pending') {
    return { bg: 'rgba(217,119,6,0.12)', border: '#D97706', text: '#B45309' };
  }
  if (tone === 'review') {
    return { bg: 'rgba(37,99,235,0.10)', border: '#2563EB', text: '#2563EB' };
  }
  return {
    bg: palette.surface || 'rgba(148,163,184,0.12)',
    border: palette.divider || 'rgba(148,163,184,0.4)',
    text: palette.subtext || '#64748B',
  };
};

export const normalizeVerificationSummary = getVerificationSummary;

export function VerificationBadgeRow({
  palette,
  summary,
  compact,
}: {
  palette: KISPalette;
  summary?: VerificationSummary | null;
  compact?: boolean;
}) {
  if (!summary && compact) return null;
  const tone = resolveTone(summary);
  const colors = toneColors(palette, tone);
  const label = summary?.verified
    ? 'Verified'
    : humanize(summary?.status || summary?.latest_case?.status) || 'Unverified';
  const badges = Array.isArray(summary?.badges) ? summary?.badges ?? [] : [];

  return (
    <View style={styles.badgeWrap}>
      <View style={[styles.badge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        <KISIcon name={tone === 'verified' ? 'shield' : 'check'} size={13} color={colors.text} />
        <Text style={[styles.badgeText, { color: colors.text }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {badges.slice(0, compact ? 1 : 3).map(badge => (
        <View
          key={badge.code || badge.label}
          style={[styles.badge, { backgroundColor: palette.surface, borderColor: palette.divider }]}
        >
          <Text style={[styles.badgeText, { color: palette.text }]} numberOfLines={1}>
            {badge.label || humanize(badge.code)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function VerificationStatusCard({
  palette,
  summary,
  title = 'Verification',
  subtitle,
  onOpen,
}: {
  palette: KISPalette;
  summary?: VerificationSummary | null;
  title?: string;
  subtitle?: string;
  onOpen?: () => void;
}) {
  const tone = resolveTone(summary);
  const colors = toneColors(palette, tone);
  const statusLabel = summary?.verified
    ? 'Verified and badge-ready'
    : humanize(summary?.status || summary?.latest_case?.status) || 'Ready to start';

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.statusCard,
        {
          backgroundColor: palette.card,
          borderColor: colors.border,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={[styles.statusIcon, { backgroundColor: colors.bg }]}>
        <KISIcon name="shield" size={20} color={colors.text} />
        <Text style={[styles.statusTitle, { color: palette.text }]}>Verification</Text>
        <KISIcon name="chevron-right" size={18} color={palette.subtext} />
      </View>
        
    </Pressable>
  );
}

export function VerificationCenterSheet({
  visible,
  palette,
  subject,
  initialSummary,
  title,
  subtitle,
  onClose,
  onSubmitted,
}: {
  visible: boolean;
  palette: KISPalette;
  subject: VerificationSubjectRef;
  initialSummary?: VerificationSummary | null;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmitted?: (summary?: VerificationSummary | null) => void;
}) {
  const [summary, setSummary] = useState<VerificationSummary | null>(initialSummary ?? null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [provider, setProvider] = useState('');
  const [referenceIds, setReferenceIds] = useState('');
  const [uploadedRefs, setUploadedRefs] = useState<VerificationEvidencePrivateRef[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [legalName, setLegalName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [issuer, setIssuer] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const subjectType = subject.type;
  const subjectId = subject.id ? String(subject.id) : '';

  useEffect(() => {
    if (!visible) return;
    setSummary(initialSummary ?? null);
    setMessage(null);
    let active = true;
    setLoading(true);
    fetchVerificationStatus({ type: subjectType, id: subjectId || undefined })
      .then(next => {
        if (active) setSummary(next ?? initialSummary ?? null);
      })
      .catch(error => {
        if (active) setMessage(error?.message || 'Unable to load verification status.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialSummary, subjectId, subjectType, visible]);

  const timeline = useMemo(() => {
    const latest = summary?.latest_case;
    const items = [
      {
        key: 'request',
        label: latest?.submitted_at ? 'Request submitted' : 'Verification not submitted',
        value: latest?.submitted_at || 'No private evidence reference has been sent yet.',
      },
      {
        key: 'review',
        label: latest?.reviewed_at ? 'Review completed' : 'Review pending',
        value: latest?.reviewed_at || 'Staff/provider review will appear here.',
      },
      {
        key: 'badge',
        label: summary?.verified ? 'Badge issued' : 'Badge not issued',
        value: summary?.last_verified_at || 'A public badge appears after approval.',
      },
    ];
    return items;
  }, [summary]);

  const pickEvidenceFile = async () => {
    try {
      setUploadingEvidence(true);
      setMessage(null);
      const document = await DocumentPicker.pickSingle({ type: [DocumentPicker.types.allFiles] });
      const uploaded = await uploadVerificationEvidenceMedia({
        uri: document.uri,
        name: document.name,
        type: document.type,
        size: document.size,
      });
      setUploadedRefs(prev => [...prev, uploaded]);
      setReferenceIds(prev => {
        const nextId = uploaded.private_media_id;
        const existing = prev
          .split(',')
          .map(item => item.trim())
          .filter(Boolean);
        return Array.from(new Set([...existing, nextId])).join(', ');
      });
      setMessage('Private evidence uploaded. Only the private media reference will be submitted.');
    } catch (error: any) {
      if (DocumentPicker.isCancel?.(error)) return;
      setMessage(error?.message || 'Unable to upload verification evidence.');
    } finally {
      setUploadingEvidence(false);
    }
  };

  const pendingCaseId = summary?.latest_case?.id &&
    ['submitted', 'pending', 'under_review', 'more_info_required'].includes(
      String(summary?.latest_case?.status || '').toLowerCase(),
    )
    ? summary.latest_case.id
    : null;

  const submit = async () => {
    const refs = Array.from(new Set([
      ...referenceIds
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
      ...uploadedRefs.map(item => item.private_media_id).filter(Boolean),
    ]));
    if (!refs.length) {
      setMessage('Add at least one private media reference. Raw document uploads do not belong in this form.');
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const evidence_metadata = {
        private_references_only: true,
        private_media_refs: refs,
        private_media: uploadedRefs,
        legal_name: legalName.trim() || undefined,
        registration_number: registrationNumber.trim() || undefined,
        certificate_issuer: issuer.trim() || undefined,
        expires_at: expiresAt.trim() || undefined,
        applicant_notes: notes.trim() || undefined,
      };
      let response: any;
      if (pendingCaseId) {
        response = await submitCaseEvidence(String(pendingCaseId), evidence_metadata);
      } else {
        response = await startVerificationCase(subject, {
          provider: provider.trim(),
          evidence_metadata,
        });
      }
      const nextSummary = response?.status || response?.verification_summary || response?.summary || summary;
      setSummary(nextSummary ?? summary);
      setMessage(pendingCaseId ? 'Evidence added to your existing case.' : 'Verification request submitted for review.');
      onSubmitted?.(nextSummary ?? summary);
    } catch (error: any) {
      setMessage(error?.message || 'Unable to submit verification request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: palette.card, borderColor: palette.divider }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.sheetEyebrow, { color: palette.primaryStrong }]}>Verification Center</Text>
              <Text style={[styles.sheetTitle, { color: palette.text }]}>{title}</Text>
              {subtitle ? <Text style={[styles.sheetSubtitle, { color: palette.subtext }]}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: palette.surface }]}>
              <KISIcon name="close" size={18} color={palette.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
            <VerificationStatusCard
              palette={palette}
              summary={summary}
              title="Current status"
              subtitle="Public badges are issued only after review. This screen sends private media references, not raw documents."
            />

            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={palette.primaryStrong} />
                <Text style={{ color: palette.subtext }}>Loading status...</Text>
              </View>
            ) : null}

            <View style={[styles.providerBox, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
              <Text style={[styles.blockTitle, { color: palette.text }]}>Provider handoff</Text>
              <Text style={[styles.statusBody, { color: palette.subtext }]}>
                Dojah, Sumsub, Smile ID, and manual review are placeholder-ready. No live provider call is made from the app in this phase.
              </Text>
              <TextInput
                value={provider}
                onChangeText={setProvider}
                placeholder="Provider key, optional"
                placeholderTextColor={palette.subtext}
                style={[styles.input, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.card }]}
              />
            </View>

            <View style={[styles.providerBox, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
              <Text style={[styles.blockTitle, { color: palette.text }]}>Evidence metadata</Text>
              <Text style={[styles.statusBody, { color: palette.subtext }]}>
                Paste private media IDs or private file references created by the secure upload flow. Do not paste file contents, tokens, or public URLs.
              </Text>
              <View style={styles.evidenceUploadRow}>
                <KISButton
                  title={uploadingEvidence ? 'Uploading...' : 'Upload private evidence'}
                  variant="secondary"
                  size="sm"
                  onPress={pickEvidenceFile}
                  disabled={uploadingEvidence}
                />
                <Text style={[styles.statusBody, { color: palette.subtext, flex: 1 }]}>Files are uploaded as private references. Raw files are not stored in verification cases.</Text>
              </View>
              {uploadedRefs.length ? (
                <View style={{ gap: 6 }}>
                  {uploadedRefs.map(ref => (
                    <Text key={ref.private_media_id} style={[styles.uploadedRef, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.card }]} numberOfLines={1}>
                      {ref.original_name || 'Private evidence'} • {ref.private_media_id}
                    </Text>
                  ))}
                </View>
              ) : null}
              <TextInput
                value={referenceIds}
                onChangeText={setReferenceIds}
                placeholder="private-media-id-1, private-media-id-2"
                placeholderTextColor={palette.subtext}
                style={[styles.input, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.card }]}
              />
              <TextInput
                value={legalName}
                onChangeText={setLegalName}
                placeholder="Legal name / registered name"
                placeholderTextColor={palette.subtext}
                style={[styles.input, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.card }]}
              />
              <TextInput
                value={registrationNumber}
                onChangeText={setRegistrationNumber}
                placeholder="Registration, license, or ID reference"
                placeholderTextColor={palette.subtext}
                style={[styles.input, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.card }]}
              />
              <TextInput
                value={issuer}
                onChangeText={setIssuer}
                placeholder="Issuer / authority, optional"
                placeholderTextColor={palette.subtext}
                style={[styles.input, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.card }]}
              />
              <TextInput
                value={expiresAt}
                onChangeText={setExpiresAt}
                placeholder="Expiry date, optional"
                placeholderTextColor={palette.subtext}
                style={[styles.input, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.card }]}
              />
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Reviewer notes, optional"
                placeholderTextColor={palette.subtext}
                multiline
                style={[styles.input, styles.textArea, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.card }]}
              />
            </View>

            <View style={[styles.providerBox, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
              <Text style={[styles.blockTitle, { color: palette.text }]}>Review timeline</Text>
              {timeline.map(item => (
                <View key={item.key} style={styles.timelineRow}>
                  <View style={[styles.timelineDot, { backgroundColor: palette.primaryStrong }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.timelineTitle, { color: palette.text }]}>{item.label}</Text>
                    <Text style={[styles.statusBody, { color: palette.subtext }]}>{item.value}</Text>
                  </View>
                </View>
              ))}
            </View>

            {pendingCaseId ? (
              <View style={[styles.providerBox, { backgroundColor: 'rgba(217,119,6,0.08)', borderColor: '#D97706' }]}>
                <Text style={[styles.blockTitle, { color: '#B45309' }]}>Pending case — add evidence</Text>
                <Text style={[styles.statusBody, { color: '#92400E' }]}>
                  You have an open verification case. Submitting here adds evidence to that case instead of starting a new one.
                </Text>
              </View>
            ) : null}

            {message ? (
              <Text style={{ color: message.includes('submitted') || message.includes('added') ? palette.primaryStrong : '#DC2626', fontWeight: '700' }}>
                {message}
              </Text>
            ) : null}

            <KISButton
              title={submitting ? 'Submitting...' : pendingCaseId ? 'Add evidence to case' : 'Submit verification request'}
              onPress={submit}
              disabled={submitting}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: 180,
  },
  badgeText: { fontSize: 11, fontWeight: '800' },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusIcon: {
    padding: 5,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  statusTitle: { fontSize: 14, fontWeight: '900' },
  statusMeta: { fontSize: 12, fontWeight: '800' },
  statusBody: { fontSize: 12, lineHeight: 18 },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.46)',
  },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.55)',
    marginBottom: 12,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  sheetEyebrow: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0 },
  sheetTitle: { fontSize: 22, fontWeight: '900' },
  sheetSubtitle: { fontSize: 13, lineHeight: 19 },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerBox: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 10 },
  blockTitle: { fontSize: 14, fontWeight: '900' },
  evidenceUploadRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  uploadedRef: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, fontWeight: '700' },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  textArea: { minHeight: 76, textAlignVertical: 'top' },
  timelineRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  timelineDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  timelineTitle: { fontSize: 12, fontWeight: '800' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
});
