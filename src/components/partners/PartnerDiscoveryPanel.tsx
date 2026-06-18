import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import { PartnerDiscover, PartnerJobPost } from '@/components/partners/partnersTypes';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import PartnerDiscoveryFilters from '@/components/partners/discovery/PartnerDiscoveryFilters';
import PartnerDiscoveryCard from '@/components/partners/discovery/PartnerDiscoveryCard';
import PartnerApplySheet from '@/components/partners/discovery/PartnerApplySheet';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  onClose: () => void;
  onJoined?: () => void;
};

const JOIN_METHODS = [
  { key: 'application', label: 'Application' },
  { key: 'subscription', label: 'Subscribe' },
  { key: 'invite', label: 'Invite' },
  { key: 'referral', label: 'Referral' },
  { key: 'auto_approve', label: 'Auto-approve' },
  { key: 'staff_pick', label: 'Staff pick' },
  { key: 'event_pass', label: 'Event pass' },
  { key: 'donation', label: 'Donation' },
  { key: 'volunteer', label: 'Volunteer' },
  { key: 'external_verification', label: 'Verification' },
  { key: 'course_completion', label: 'Course' },
];

export default function PartnerDiscoveryPanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  onClose,
  onJoined,
}: Props) {
  const { palette } = useKISTheme();
  const [query, setQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [partners, setPartners] = useState<PartnerDiscover[]>([]);
  const [loading, setLoading] = useState(false);
  const [applyTarget, setApplyTarget] = useState<PartnerDiscover | null>(null);
  const [applyMessage, setApplyMessage] = useState('');
  const [applyRole, setApplyRole] = useState('');
  const [jobPosts, setJobPosts] = useState<PartnerJobPost[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);

  const redeemInviteCode = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) return;
    setRedeemLoading(true);
    const res = await postRequest(ROUTES.partners.redeemInvite, { code });
    setRedeemLoading(false);
    if (res?.success || res?.detail) {
      setInviteCode('');
      Alert.alert('Success', res?.detail ?? 'You have joined the organisation!');
      onJoined?.();
    } else {
      Alert.alert('Invalid code', res?.message ?? res?.detail ?? 'Invite code not found or expired.');
    }
  };

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const activeMethods = useMemo(
    () => JOIN_METHODS.map((item) => item.key),
    [],
  );

  const loadPartners = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const parts: string[] = [];
      if (query.trim()) {
        parts.push(`q=${encodeURIComponent(query.trim())}`);
      }
      if (methodFilter) {
        parts.push(`method=${encodeURIComponent(methodFilter)}`);
      }
      if (openOnly) {
        parts.push('open=true');
      }
      const url = parts.length
        ? `${ROUTES.partners.discover}?${parts.join('&')}`
        : ROUTES.partners.discover;
      const res = await getRequest(url, {
        errorMessage: 'Unable to load partner listings.',
      });
      const list = (res?.data ?? res ?? []) as PartnerDiscover[];
      setPartners(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, [isOpen, methodFilter, openOnly, query]);

  useEffect(() => {
    if (!isOpen) return;
    loadPartners();
  }, [isOpen, loadPartners]);

  useEffect(() => {
    if (!applyTarget) {
      setJobPosts([]);
      setSelectedJobId(null);
      return;
    }
    getRequest(ROUTES.partners.jobs(String(applyTarget.id)), {
      errorMessage: 'Unable to load jobs.',
    }).then((res) => {
      const list = (res?.data ?? res ?? []) as PartnerJobPost[];
      const filtered = Array.isArray(list)
        ? list.filter((job) => job.is_active !== false)
        : [];
      setJobPosts(filtered);
      if (filtered.length > 0) {
        setSelectedJobId(String(filtered[0].id));
      }
    });
  }, [applyTarget]);

  const onApply = async () => {
    if (!applyTarget) return;
    try {
      await postRequest(ROUTES.partners.apply(applyTarget.id), {
        method: 'application',
        job_post: selectedJobId,
        message: applyMessage.trim(),
        answers: applyRole.trim() ? { desired_role: applyRole.trim() } : {},
        profile_visible: true,
      });
      Alert.alert('Application sent', 'The partner will review your request.');
      setApplyTarget(null);
      setApplyMessage('');
      setApplyRole('');
      loadPartners();
    } catch (e: any) {
      Alert.alert('Application failed', e?.message ?? 'Please try again.');
    }
  };

  const onSubscribe = async (partnerId: string) => {
    try {
      await postRequest(ROUTES.partners.subscribe(partnerId), {});
      Alert.alert('Subscribed', 'You can now follow this partner feed.');
      loadPartners();
      onJoined?.();
    } catch (e: any) {
      Alert.alert('Subscribe failed', e?.message ?? 'Please try again.');
    }
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
              Discover partners
            </Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              Browse partner listings and join the ones that match you.
            </Text>
          </View>
        </View>

        <PartnerDiscoveryFilters
          palette={palette}
          query={query}
          onQueryChange={setQuery}
          onSearch={loadPartners}
          methodFilter={methodFilter}
          onMethodFilter={setMethodFilter}
          openOnly={openOnly}
          onToggleOpen={() => setOpenOnly((prev) => !prev)}
          methods={JOIN_METHODS}
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Invite code redemption */}
          <View
            style={{
              backgroundColor: palette.surface,
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: palette.borderMuted,
            }}
          >
            <Text style={{ color: palette.text, fontWeight: '700', marginBottom: 4 }}>
              Have an invite code?
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 13, marginBottom: 10 }}>
              Enter your code to join a partner organisation directly.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={{
                  flex: 1,
                  height: 44,
                  borderWidth: 1,
                  borderRadius: 8,
                  borderColor: palette.borderMuted,
                  paddingHorizontal: 12,
                  color: palette.text,
                  backgroundColor: palette.inputBackground ?? palette.surfaceElevated,
                  fontSize: 14,
                  fontWeight: '600',
                  letterSpacing: 1,
                }}
                value={inviteCode}
                onChangeText={(t) => setInviteCode(t.toUpperCase())}
                placeholder="INVITE CODE"
                placeholderTextColor={palette.placeholder ?? palette.subtext}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={redeemInviteCode}
                editable={!redeemLoading}
              />
              <Pressable
                onPress={redeemInviteCode}
                disabled={redeemLoading || !inviteCode.trim()}
                style={({ pressed }) => ({
                  height: 44,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  backgroundColor: palette.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: redeemLoading || !inviteCode.trim() || pressed ? 0.6 : 1,
                })}
              >
                {redeemLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: palette.onPrimary, fontWeight: '700', fontSize: 13 }}>
                    Join
                  </Text>
                )}
              </Pressable>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator color={palette.primaryStrong} />
          ) : partners.length === 0 ? (
            <Text style={{ color: palette.subtext }}>No partners found.</Text>
          ) : (
            partners.map((partner) => (
              <PartnerDiscoveryCard
                key={partner.id}
                palette={palette}
                partner={partner}
                joinMethods={partner.join_config?.methods ?? activeMethods}
                onApply={() => setApplyTarget(partner)}
                onSubscribe={() => onSubscribe(partner.id)}
              />
            ))
          )}
        </ScrollView>

        {applyTarget ? (
          <PartnerApplySheet
            palette={palette}
            target={applyTarget}
            message={applyMessage}
            role={applyRole}
            jobPosts={jobPosts}
            selectedJobId={selectedJobId}
            onChangeJobId={setSelectedJobId}
            onChangeMessage={setApplyMessage}
            onChangeRole={setApplyRole}
            onCancel={() => setApplyTarget(null)}
            onSubmit={onApply}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}
