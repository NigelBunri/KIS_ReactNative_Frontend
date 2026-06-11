import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
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
  onClose: () => void;
};

type PartnerInvite = {
  id: string | number;
  code: string;
  membership_role?: string;
  max_uses?: number | null;
  use_count?: number;
  expires_at?: string | null;
  is_active?: boolean;
};

type AccessRequest = {
  id: string | number;
  requester_name?: string;
  target_name?: string;
  status: string;
  justification?: string;
  requested_role?: string | null;
  created_at?: string;
};

type AccessReview = {
  id: string | number;
  name: string;
  status: string;
  created_at?: string;
};

export default function PartnerGovernancePanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  partnerId,
  onClose,
}: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [accessReviews, setAccessReviews] = useState<AccessReview[]>([]);
  const [reviewName, setReviewName] = useState('');
  const [reviewScopeType, setReviewScopeType] = useState('global');
  const [reviewScopeId, setReviewScopeId] = useState('');
  const [invites, setInvites] = useState<PartnerInvite[]>([]);
  const [newInviteRole, setNewInviteRole] = useState('member');
  const [newInviteMaxUses, setNewInviteMaxUses] = useState('');
  const [newInviteExpiry, setNewInviteExpiry] = useState('');
  const [inviteCreating, setInviteCreating] = useState(false);

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const loadAll = useCallback(async () => {
    if (!partnerId) return;
    const [reqRes, reviewRes, inviteRes] = await Promise.all([
      getRequest(ROUTES.partners.accessRequests(partnerId), {
        errorMessage: 'Unable to load access requests.',
      }),
      getRequest(ROUTES.partners.accessReviews(partnerId), {
        errorMessage: 'Unable to load access reviews.',
      }),
      getRequest(ROUTES.partners.invites(partnerId), {
        errorMessage: 'Unable to load invite codes.',
      }),
    ]);
    const reqList = (reqRes?.data ?? reqRes ?? []) as AccessRequest[];
    const reviewList = (reviewRes?.data ?? reviewRes ?? []) as AccessReview[];
    const inviteList = (inviteRes?.data ?? inviteRes ?? []) as PartnerInvite[];
    setAccessRequests(Array.isArray(reqList) ? reqList : []);
    setAccessReviews(Array.isArray(reviewList) ? reviewList : []);
    setInvites(Array.isArray(inviteList) ? inviteList : []);
  }, [partnerId]);

  const createInvite = async () => {
    if (!partnerId) return;
    setInviteCreating(true);
    const body: Record<string, unknown> = { membership_role: newInviteRole.trim() || 'member' };
    if (newInviteMaxUses.trim()) body.max_uses = parseInt(newInviteMaxUses, 10);
    if (newInviteExpiry.trim()) body.expires_at = newInviteExpiry.trim();
    const res = await postRequest(ROUTES.partners.invites(partnerId), body);
    setInviteCreating(false);
    if (!res?.success && !res?.id && !res?.code) {
      Alert.alert('Create failed', res?.message ?? 'Unable to create invite code.');
      return;
    }
    setNewInviteRole('member');
    setNewInviteMaxUses('');
    setNewInviteExpiry('');
    loadAll();
  };

  const deactivateInvite = async (inviteId: string | number) => {
    if (!partnerId) return;
    const res = await patchRequest(
      ROUTES.partners.inviteDetail(partnerId, String(inviteId)),
      { is_active: false },
    );
    if (!res?.success && !res?.id) {
      Alert.alert('Deactivate failed', res?.message ?? 'Please try again.');
      return;
    }
    loadAll();
  };

  const shareInviteCode = (code: string) => {
    const link = `kis://join/partner/${code}`;
    Share.share({ message: `Join us on KIS! Use invite code: ${code}\n${link}` });
  };

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [isOpen, loadAll]);

  const approveRequest = async (requestId: string | number) => {
    if (!partnerId) return;
    const res = await postRequest(
      ROUTES.partners.accessRequestApprove(partnerId, String(requestId)),
      {},
      { errorMessage: 'Unable to approve access request.' },
    );
    if (!res?.success) {
      Alert.alert('Approval failed', res?.message ?? 'Please try again.');
      return;
    }
    loadAll();
  };

  const rejectRequest = async (requestId: string | number) => {
    if (!partnerId) return;
    const res = await postRequest(
      ROUTES.partners.accessRequestReject(partnerId, String(requestId)),
      {},
      { errorMessage: 'Unable to reject access request.' },
    );
    if (!res?.success) {
      Alert.alert('Reject failed', res?.message ?? 'Please try again.');
      return;
    }
    loadAll();
  };

  const createReview = async () => {
    if (!partnerId) return;
    if (!reviewName.trim()) {
      Alert.alert('Missing info', 'Review name is required.');
      return;
    }
    const res = await postRequest(ROUTES.partners.accessReviews(partnerId), {
      name: reviewName.trim(),
      scope_type: reviewScopeType.trim() || 'global',
      scope_id: reviewScopeId.trim(),
    });
    if (!res?.success) {
      Alert.alert('Create failed', res?.message ?? 'Unable to create review.');
      return;
    }
    setReviewName('');
    setReviewScopeType('global');
    setReviewScopeId('');
    loadAll();
  };

  const closeReview = async (reviewId: string | number) => {
    if (!partnerId) return;
    const res = await postRequest(
      ROUTES.partners.accessReviewClose(partnerId, String(reviewId)),
      {},
      { errorMessage: 'Unable to close review.' },
    );
    if (!res?.success) {
      Alert.alert('Close failed', res?.message ?? 'Please try again.');
      return;
    }
    loadAll();
  };

  if (!isOpen) return null;

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.settingsPanelBackdrop,
          { backgroundColor: palette.backdrop, opacity: backdropOpacity },
        ]}
      >
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
        <View
          style={[
            styles.settingsPanelHeader,
            { borderBottomColor: palette.divider },
          ]}
        >
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>
              Access Governance
            </Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              Review access requests and run access reviews.
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.settingsPanelBody}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <>
              <Text style={[styles.settingsSectionTitle, { color: palette.text }]}>
                Access requests
              </Text>
              {accessRequests.map((req) => (
                <View
                  key={String(req.id)}
                  style={[
                    styles.settingsFeatureRow,
                    { borderColor: palette.borderMuted, backgroundColor: palette.surface },
                  ]}
                >
                  <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                    {req.requester_name || 'Requester'}
                  </Text>
                  <Text style={[styles.settingsFeatureDescription, { color: palette.subtext }]}>
                    Status: {req.status}
                  </Text>
                  {req.justification ? (
                    <Text style={[styles.settingsFeatureMeta, { color: palette.subtext }]}>
                      {req.justification}
                    </Text>
                  ) : null}
                  {req.status === 'pending' ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <Pressable
                        onPress={() => approveRequest(req.id)}
                        style={({ pressed }) => [
                          {
                            paddingVertical: 6,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            borderWidth: 2,
                            borderColor: palette.success,
                            backgroundColor: palette.successSoft ?? palette.surface,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <Text style={{ color: palette.success, fontWeight: '700' }}>APPROVE</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => rejectRequest(req.id)}
                        style={({ pressed }) => [
                          {
                            paddingVertical: 6,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            borderWidth: 2,
                            borderColor: palette.danger,
                            backgroundColor: palette.dangerSoft ?? palette.surface,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <Text style={{ color: palette.danger, fontWeight: '700' }}>REJECT</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))}

              <Text style={[styles.settingsSectionTitle, { color: palette.text, marginTop: 12 }]}>
                Access reviews
              </Text>
              <View
                style={[
                  styles.settingsFeatureRow,
                  { borderColor: palette.borderMuted, backgroundColor: palette.surface },
                ]}
              >
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  Start review
                </Text>
                <TextInput
                  value={reviewName}
                  onChangeText={setReviewName}
                  placeholder="Review name"
                  placeholderTextColor={palette.subtext}
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <TextInput
                  value={reviewScopeType}
                  onChangeText={setReviewScopeType}
                  placeholder="Scope type (global/community/group/channel)"
                  placeholderTextColor={palette.subtext}
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <TextInput
                  value={reviewScopeId}
                  onChangeText={setReviewScopeId}
                  placeholder="Scope id (optional)"
                  placeholderTextColor={palette.subtext}
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <Pressable
                  onPress={createReview}
                  style={({ pressed }) => [
                    {
                      marginTop: 10,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: palette.borderMuted,
                      backgroundColor: palette.primarySoft ?? palette.surface,
                      opacity: pressed ? 0.8 : 1,
                      alignItems: 'center',
                    },
                  ]}
                >
                  <Text style={{ color: palette.primaryStrong ?? palette.text, fontWeight: '700' }}>
                    CREATE REVIEW
                  </Text>
                </Pressable>
              </View>

              {accessReviews.map((review) => (
                <View
                  key={String(review.id)}
                  style={[
                    styles.settingsFeatureRow,
                    { borderColor: palette.borderMuted, backgroundColor: palette.surface },
                  ]}
                >
                  <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                    {review.name}
                  </Text>
                  <Text style={[styles.settingsFeatureDescription, { color: palette.subtext }]}>
                    Status: {review.status}
                  </Text>
                  {review.status === 'open' ? (
                    <Pressable
                      onPress={() => closeReview(review.id)}
                      style={({ pressed }) => [
                        {
                          marginTop: 8,
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          borderWidth: 2,
                          borderColor: palette.borderMuted,
                          opacity: pressed ? 0.8 : 1,
                          alignSelf: 'flex-start',
                        },
                      ]}
                    >
                      <Text style={{ color: palette.text, fontWeight: '700' }}>CLOSE REVIEW</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}

              {/* ── Invite Codes ── */}
              <Text style={[styles.settingsSectionTitle, { color: palette.text, marginTop: 20 }]}>
                Invite codes
              </Text>
              <View
                style={[
                  styles.settingsFeatureRow,
                  { borderColor: palette.borderMuted, backgroundColor: palette.surface },
                ]}
              >
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  Create invite code
                </Text>
                <TextInput
                  value={newInviteRole}
                  onChangeText={setNewInviteRole}
                  placeholder="Role (e.g. member, admin)"
                  placeholderTextColor={palette.subtext}
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <TextInput
                  value={newInviteMaxUses}
                  onChangeText={setNewInviteMaxUses}
                  placeholder="Max uses (leave blank for unlimited)"
                  placeholderTextColor={palette.subtext}
                  keyboardType="numeric"
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <TextInput
                  value={newInviteExpiry}
                  onChangeText={setNewInviteExpiry}
                  placeholder="Expires at (YYYY-MM-DD, optional)"
                  placeholderTextColor={palette.subtext}
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <Pressable
                  onPress={createInvite}
                  disabled={inviteCreating}
                  style={({ pressed }) => [
                    {
                      marginTop: 10,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: palette.borderMuted,
                      backgroundColor: palette.primarySoft ?? palette.surface,
                      opacity: inviteCreating || pressed ? 0.7 : 1,
                      alignItems: 'center',
                    },
                  ]}
                >
                  {inviteCreating ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : (
                    <Text style={{ color: palette.primaryStrong ?? palette.text, fontWeight: '700' }}>
                      CREATE CODE
                    </Text>
                  )}
                </Pressable>
              </View>

              {invites.map((invite) => {
                const fullLink = `kis://join/partner/${invite.code}`;
                return (
                <View
                  key={String(invite.id)}
                  style={[
                    styles.settingsFeatureRow,
                    {
                      borderColor: invite.is_active !== false ? palette.borderMuted : palette.danger,
                      backgroundColor: palette.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.settingsFeatureTitle,
                      { color: palette.text, letterSpacing: 1.5 },
                    ]}
                  >
                    {invite.code}
                  </Text>
                  {/* Selectable full link so admins can long-press copy too */}
                  <Text
                    selectable
                    numberOfLines={2}
                    style={{
                      color: palette.subtext,
                      fontSize: 11,
                      marginTop: 4,
                      fontFamily: 'monospace',
                    }}
                  >
                    {fullLink}
                  </Text>
                  <Text style={[styles.settingsFeatureDescription, { color: palette.subtext, marginTop: 4 }]}>
                    Role: {invite.membership_role ?? 'member'} · Uses:{' '}
                    {invite.use_count ?? 0}
                    {invite.max_uses != null ? `/${invite.max_uses}` : ''}
                    {invite.expires_at ? ` · Expires: ${invite.expires_at.slice(0, 10)}` : ''}
                  </Text>
                  <Text
                    style={[
                      styles.settingsFeatureMeta,
                      { color: invite.is_active !== false ? palette.success : palette.danger },
                    ]}
                  >
                    {invite.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Pressable
                      onPress={() => {
                        Clipboard.setString(fullLink);
                        Alert.alert('Copied', 'Invite link copied to clipboard.');
                      }}
                      style={({ pressed }) => [
                        {
                          paddingVertical: 5,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: palette.borderMuted,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text style={{ color: palette.text, fontSize: 12 }}>Copy link</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => shareInviteCode(invite.code)}
                      style={({ pressed }) => [
                        {
                          paddingVertical: 5,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: palette.borderMuted,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text style={{ color: palette.text, fontSize: 12 }}>Share</Text>
                    </Pressable>
                    {invite.is_active !== false && (
                      <Pressable
                        onPress={() =>
                          Alert.alert('Deactivate code?', `Code ${invite.code} will be disabled.`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Deactivate', style: 'destructive', onPress: () => deactivateInvite(invite.id) },
                          ])
                        }
                        style={({ pressed }) => [
                          {
                            paddingVertical: 5,
                            paddingHorizontal: 10,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: palette.danger,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text style={{ color: palette.danger, fontSize: 12 }}>Deactivate</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ); })}
              {invites.length === 0 && (
                <Text style={[styles.settingsFeatureDescription, { color: palette.subtext, paddingHorizontal: 4 }]}>
                  No invite codes yet. Create one above.
                </Text>
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
