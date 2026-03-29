import React, { useCallback, useEffect, useState } from 'react';
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
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
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

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const loadAll = useCallback(async () => {
    if (!partnerId) return;
    const [reqRes, reviewRes] = await Promise.all([
      getRequest(ROUTES.partners.accessRequests(partnerId), {
        errorMessage: 'Unable to load access requests.',
      }),
      getRequest(ROUTES.partners.accessReviews(partnerId), {
        errorMessage: 'Unable to load access reviews.',
      }),
    ]);
    const reqList = (reqRes?.data ?? reqRes ?? []) as AccessRequest[];
    const reviewList = (reviewRes?.data ?? reviewRes ?? []) as AccessReview[];
    setAccessRequests(Array.isArray(reqList) ? reqList : []);
    setAccessReviews(Array.isArray(reviewList) ? reviewList : []);
  }, [partnerId]);

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
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
