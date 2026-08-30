// src/components/partners/PartnerVerificationPanel.tsx
//
// Two audiences share one panel: (1) any partner member with access can see
// verification status, and staff with `partner.settings.manage` can submit a
// request (POST .../verification/start/ — backend only accepts safe
// references, e.g. private_media_id, never raw files/base64, see
// apps/verification/services.py's validate_private_evidence_metadata); (2)
// GO (Django is_staff — there is no partner-role reviewer tier for this,
// it's strictly platform staff) sees the global cases queue filtered to
// subject_type=partner and can approve/reject/request-more-info, awarding
// badges on approval. `isGoStaff` mirrors PartnersScreen.tsx's `isSuperuser`.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  isGoStaff?: boolean;
  onClose: () => void;
};

type Badge = { code: string; label: string; level: string; issued_at?: string | null; expires_at?: string | null };
type CaseStatus = {
  id: string;
  level: string;
  status: string;
  provider: string;
  provider_status: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  public_summary?: { message?: string; next_action?: string };
  reviewer_notes?: string;
  show_rejection_notice?: boolean;
};
type StatusPayload = {
  verified: boolean;
  status?: string;
  level?: string;
  last_verified_at?: string | null;
  badges: Badge[];
  case: CaseStatus | null;
};
type StaffCase = {
  id: string;
  subject: { subject_id: string; display_name: string; subject_type: string; owner_label?: string };
  requested_by_label?: string;
  level: string;
  status: string;
  provider: string;
  submitted_at?: string | null;
  public_summary?: { message?: string };
};

const BADGE_OPTIONS: { code: string; label: string }[] = [
  { code: 'verified_partner', label: 'Verified partner' },
  { code: 'verified_organization', label: 'Verified organization' },
  { code: 'official_partner', label: 'Official partner' },
];

export default function PartnerVerificationPanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  partnerId,
  isGoStaff,
  onClose,
}: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [queue, setQueue] = useState<StaffCase[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [reviewingCaseId, setReviewingCaseId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [selectedBadges, setSelectedBadges] = useState<Record<string, boolean>>({});
  const [reviewBusy, setReviewBusy] = useState(false);

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const loadStatus = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.verificationStatus(partnerId), {
      errorMessage: 'Unable to load verification status.',
    });
    const payload = (res?.data ?? res ?? null) as StatusPayload | null;
    setStatus(payload);
  }, [partnerId]);

  const loadQueue = useCallback(async () => {
    if (!isGoStaff) return;
    setQueueLoading(true);
    const res = await getRequest(`${ROUTES.partners.staffVerificationQueue}?subject_type=partner`, {
      errorMessage: 'Unable to load the verification queue.',
    });
    setQueueLoading(false);
    const payload = res?.data ?? res ?? {};
    setQueue(Array.isArray(payload.results) ? payload.results : []);
  }, [isGoStaff]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    Promise.all([loadStatus(), loadQueue()]).finally(() => setLoading(false));
  }, [isOpen, loadStatus, loadQueue]);

  const submitRequest = async () => {
    if (!partnerId) return;
    setSubmitting(true);
    const res = await postRequest(
      ROUTES.partners.verificationStart(partnerId),
      {},
      { errorMessage: 'Unable to submit verification request.' },
    );
    setSubmitting(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to submit verification request.');
      return;
    }
    Alert.alert('Submitted', 'Your verification request has been submitted for review.');
    loadStatus();
  };

  const startReview = (staffCase: StaffCase) => {
    setReviewingCaseId(staffCase.id);
    setReviewNotes('');
    setSelectedBadges({});
  };

  const toggleBadge = (code: string) => {
    setSelectedBadges((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const submitReview = async (staffCase: StaffCase, action: 'approve' | 'reject' | 'needs_more_info') => {
    if (!partnerId && !staffCase.subject.subject_id) return;
    const targetPartnerId = staffCase.subject.subject_id;
    setReviewBusy(true);
    const badgeCodes = Object.keys(selectedBadges).filter((code) => selectedBadges[code]);
    const res = await postRequest(
      ROUTES.partners.verificationCasesReview(targetPartnerId, staffCase.id),
      { action, notes: reviewNotes, badge_codes: action === 'approve' ? badgeCodes : [] },
      { errorMessage: 'Unable to submit review.' },
    );
    setReviewBusy(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to submit review.');
      return;
    }
    setReviewingCaseId(null);
    setQueue((prev) => prev.filter((c) => c.id !== staffCase.id));
    if (targetPartnerId === partnerId) loadStatus();
  };

  if (!isOpen) return null;

  const statusColor =
    status?.status === 'approved' ? palette.success ?? palette.primary
    : status?.status === 'rejected' ? palette.danger
    : palette.subtext;

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.settingsPanelBackdrop, { backgroundColor: palette.backdrop, opacity: backdropOpacity }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          {
            width: panelWidth,
            backgroundColor: palette.surfaceElevated,
            borderLeftColor: palette.divider,
            transform: [{ translateX: panelTranslateX }],
          },
        ]}
      >
        <View style={[styles.settingsPanelHeader, { borderBottomColor: palette.divider }]}>
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Verification</Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              Request a verified badge for this organization.
            </Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <>
              <Text style={[styles.settingsSectionTitle, { color: palette.text }]}>Status</Text>
              <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}>
                <Text style={[styles.settingsFeatureTitle, { color: statusColor }]}>
                  {status?.verified ? '✓ Verified' : status?.case ? `Case: ${status.case.status}` : 'Not verified'}
                </Text>
                {status?.badges?.length ? (
                  <Text style={[styles.settingsFeatureDescription, { color: palette.subtext, marginTop: 4 }]}>
                    {status.badges.map((b) => b.label).join(' · ')}
                  </Text>
                ) : null}
                {status?.case?.public_summary?.message ? (
                  <Text style={[styles.settingsFeatureDescription, { color: palette.subtext, marginTop: 4 }]}>
                    {status.case.public_summary.message}
                  </Text>
                ) : null}
                {status?.case?.show_rejection_notice && status.case.reviewer_notes ? (
                  <Text style={[styles.settingsFeatureDescription, { color: palette.danger, marginTop: 4 }]}>
                    Reviewer notes: {status.case.reviewer_notes}
                  </Text>
                ) : null}
              </View>

              {!status?.case || status.case.status === 'rejected' ? (
                <Pressable
                  onPress={submitRequest}
                  disabled={submitting}
                  style={({ pressed }) => [
                    {
                      marginTop: 12,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: palette.primary,
                      alignItems: 'center',
                      opacity: pressed || submitting ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: palette.onPrimary ?? '#fff', fontWeight: '600' }}>
                    {submitting ? 'Submitting…' : 'Request verification'}
                  </Text>
                </Pressable>
              ) : null}

              {isGoStaff ? (
                <View style={{ marginTop: 24 }}>
                  <Text style={[styles.settingsSectionTitle, { color: palette.text }]}>Review queue (GO)</Text>
                  {queueLoading ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : queue.length === 0 ? (
                    <Text style={{ color: palette.subtext, marginTop: 8 }}>No pending cases.</Text>
                  ) : (
                    queue.map((staffCase) => (
                      <View
                        key={staffCase.id}
                        style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginTop: 8 }]}
                      >
                        <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                          {staffCase.subject.display_name || staffCase.subject.owner_label || 'Organization'}
                        </Text>
                        <Text style={[styles.settingsFeatureDescription, { color: palette.subtext, marginTop: 2 }]}>
                          {staffCase.status} · {staffCase.provider || 'no provider'} · requested by {staffCase.requested_by_label || 'unknown'}
                        </Text>

                        {reviewingCaseId === staffCase.id ? (
                          <View style={{ marginTop: 10 }}>
                            <TextInput
                              value={reviewNotes}
                              onChangeText={setReviewNotes}
                              placeholder="Notes (optional)"
                              placeholderTextColor={palette.subtext}
                              multiline
                              style={{
                                borderWidth: 1,
                                borderColor: palette.borderMuted,
                                borderRadius: 10,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                color: palette.text,
                                minHeight: 60,
                                textAlignVertical: 'top',
                              }}
                            />
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                              {BADGE_OPTIONS.map((badge) => (
                                <Pressable
                                  key={badge.code}
                                  onPress={() => toggleBadge(badge.code)}
                                  style={{
                                    paddingVertical: 5,
                                    paddingHorizontal: 10,
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: selectedBadges[badge.code] ? palette.primary : palette.borderMuted,
                                  }}
                                >
                                  <Text style={{ color: selectedBadges[badge.code] ? palette.primary : palette.text, fontSize: 12 }}>
                                    {badge.label}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                              <Pressable
                                onPress={() => submitReview(staffCase, 'approve')}
                                disabled={reviewBusy}
                                style={({ pressed }) => [
                                  { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: palette.primary, alignItems: 'center', opacity: pressed || reviewBusy ? 0.7 : 1 },
                                ]}
                              >
                                <Text style={{ color: palette.onPrimary ?? '#fff', fontSize: 12, fontWeight: '600' }}>Approve</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => submitReview(staffCase, 'needs_more_info')}
                                disabled={reviewBusy}
                                style={({ pressed }) => [
                                  { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: palette.borderMuted, alignItems: 'center', opacity: pressed || reviewBusy ? 0.7 : 1 },
                                ]}
                              >
                                <Text style={{ color: palette.text, fontSize: 12, fontWeight: '600' }}>Need info</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => submitReview(staffCase, 'reject')}
                                disabled={reviewBusy}
                                style={({ pressed }) => [
                                  { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: palette.danger, alignItems: 'center', opacity: pressed || reviewBusy ? 0.7 : 1 },
                                ]}
                              >
                                <Text style={{ color: palette.danger, fontSize: 12, fontWeight: '600' }}>Reject</Text>
                              </Pressable>
                            </View>
                            <Pressable onPress={() => setReviewingCaseId(null)} style={{ marginTop: 8, alignItems: 'center' }}>
                              <Text style={{ color: palette.subtext, fontSize: 12 }}>Cancel</Text>
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable onPress={() => startReview(staffCase)} style={{ marginTop: 8 }}>
                            <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '600' }}>Review</Text>
                          </Pressable>
                        )}
                      </View>
                    ))
                  )}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
