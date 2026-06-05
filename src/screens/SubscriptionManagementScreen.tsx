import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useNavigation } from '@react-navigation/native';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { KISIcon } from '@/constants/kisIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Types ─────────────────────────────────────────────────────────────────────

type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing' | string;

type UsageMetric = {
  label: string;
  used: number;
  limit: number;
  unit?: string;
};

type TierUsageData = {
  metrics?: UsageMetric[];
  storage_used?: number;
  storage_limit?: number;
  api_calls_used?: number;
  api_calls_limit?: number;
  members_used?: number;
  members_limit?: number;
  [key: string]: any;
};

type PricingInsight = {
  insight?: string;
  message?: string;
  recommended_tier?: string;
  savings_percent?: number;
  cta_label?: string;
  cta_url?: string;
};

type Subscription = {
  id?: string;
  plan_name?: string;
  plan?: string;
  tier?: string;
  price?: number;
  price_cents?: number;
  currency?: string;
  billing_cycle?: string;
  next_billing_date?: string;
  current_period_end?: string;
  status?: SubscriptionStatus;
  cancel_at_period_end?: boolean;
  features?: string[];
  receipt_url?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (value?: string) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

const formatPrice = (cents?: number, amount?: number, currency = 'USD') => {
  const c = cents ?? (amount != null ? Math.round(Number(amount) * 100) : null);
  if (c == null) return 'N/A';
  return `${(c / 100).toLocaleString('en-US', { style: 'currency', currency })}`;
};

const statusColor = (status?: SubscriptionStatus): { bg: string; text: string; dot: string } => {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'trialing') return { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' };
  if (s === 'past_due') return { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' };
  if (s === 'cancelled' || s === 'canceled') return { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' };
  return { bg: '#f3f4f6', text: '#6b7280', dot: '#9ca3af' };
};

// ─── Downgrade Picker Modal ────────────────────────────────────────────────────

const TIER_OPTIONS = [
  { key: 'free', label: 'Free' },
  { key: 'basic', label: 'Basic' },
  { key: 'starter', label: 'Starter' },
  { key: 'pro', label: 'Pro' },
  { key: 'business', label: 'Business' },
];

type DowngradeModalProps = {
  visible: boolean;
  currentTier?: string;
  palette: ReturnType<typeof useKISTheme>['palette'];
  onClose: () => void;
  onConfirm: (tier: string) => void;
};

function DowngradeModal({ visible, currentTier, palette, onClose, onConfirm }: DowngradeModalProps) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!selectedTier) {
      Alert.alert('Select a Plan', 'Please select a plan to downgrade to.');
      return;
    }
    onConfirm(selectedTier);
    setSelectedTier(null);
  };

  const availableTiers = TIER_OPTIONS.filter(t => t.key !== currentTier?.toLowerCase());

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={m.overlay} onPress={onClose}>
        <Pressable style={[m.sheet, { backgroundColor: palette.card }]} onPress={() => {}}>
          <View style={[m.handle, { backgroundColor: palette.divider }]} />
          <Text style={[m.sheetTitle, { color: palette.text }]}>Downgrade Plan</Text>
          <Text style={[m.sheetSubtitle, { color: palette.subtext }]}>
            Choose a plan to downgrade to. Changes take effect at the end of your current billing period.
          </Text>

          <View style={{ gap: 8, marginTop: 8 }}>
            {availableTiers.map(tier => (
              <Pressable
                key={tier.key}
                style={[
                  m.tierOption,
                  {
                    borderColor: selectedTier === tier.key ? palette.primaryStrong : palette.divider,
                    backgroundColor: selectedTier === tier.key ? palette.primarySoft : palette.surface,
                  },
                ]}
                onPress={() => setSelectedTier(tier.key)}
              >
                <Text style={[m.tierLabel, { color: palette.text }]}>{tier.label}</Text>
                {selectedTier === tier.key ? (
                  <KISIcon name="checkmark-circle" size={20} color={palette.primaryStrong} />
                ) : (
                  <View style={[m.tierRadio, { borderColor: palette.divider }]} />
                )}
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[m.confirmBtn, { backgroundColor: selectedTier ? palette.primaryStrong : palette.divider }]}
            onPress={handleConfirm}
            disabled={!selectedTier}
          >
            <Text style={m.confirmBtnText}>Confirm Downgrade</Text>
          </Pressable>
          <Pressable onPress={onClose} style={m.cancelBtn}>
            <Text style={[m.cancelBtnText, { color: palette.subtext }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Cancel Reason Modal ───────────────────────────────────────────────────────

type CancelModalProps = {
  visible: boolean;
  palette: ReturnType<typeof useKISTheme>['palette'];
  onClose: () => void;
  onConfirm: (reason: string) => void;
  submitting: boolean;
};

const CANCEL_REASONS = [
  'Too expensive',
  'Missing features I need',
  'Not using the platform enough',
  'Switching to a different service',
  'Other',
];

function CancelModal({ visible, palette, onClose, onConfirm, submitting }: CancelModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState('');

  const handleConfirm = () => {
    const reason = selectedReason === 'Other' && customReason.trim()
      ? customReason.trim()
      : selectedReason;
    if (!reason) {
      Alert.alert('Reason Required', 'Please select a reason for cancellation.');
      return;
    }
    onConfirm(reason);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={m.overlay} onPress={onClose}>
        <Pressable style={[m.sheet, { backgroundColor: palette.card }]} onPress={() => {}}>
          <View style={[m.handle, { backgroundColor: palette.divider }]} />
          <Text style={[m.sheetTitle, { color: palette.text }]}>Cancel Subscription</Text>
          <Text style={[m.sheetSubtitle, { color: palette.subtext }]}>
            We're sorry to see you go. Your subscription will remain active until the end of the current billing period.
          </Text>

          <Text style={[m.label, { color: palette.subtext, marginTop: 8 }]}>Why are you cancelling?</Text>
          <View style={{ gap: 8, marginTop: 6 }}>
            {CANCEL_REASONS.map(reason => (
              <Pressable
                key={reason}
                style={[
                  m.tierOption,
                  {
                    borderColor: selectedReason === reason ? '#ef4444' : palette.divider,
                    backgroundColor: selectedReason === reason ? '#fee2e2' : palette.surface,
                  },
                ]}
                onPress={() => setSelectedReason(reason)}
              >
                <Text style={[m.tierLabel, { color: palette.text }]}>{reason}</Text>
                {selectedReason === reason ? (
                  <KISIcon name="checkmark-circle" size={20} color="#ef4444" />
                ) : (
                  <View style={[m.tierRadio, { borderColor: palette.divider }]} />
                )}
              </Pressable>
            ))}
          </View>

          {selectedReason === 'Other' && (
            <TextInput
              style={[m.reasonInput, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.surface }]}
              placeholder="Tell us more..."
              placeholderTextColor={palette.subtext}
              multiline
              numberOfLines={3}
              value={customReason}
              onChangeText={setCustomReason}
            />
          )}

          <Pressable
            style={[m.confirmBtn, { backgroundColor: submitting ? palette.subtext : '#ef4444' }]}
            onPress={handleConfirm}
            disabled={submitting || !selectedReason}
          >
            {submitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={m.confirmBtnText}>Confirm Cancellation</Text>
            }
          </Pressable>
          <Pressable onPress={onClose} style={m.cancelBtn}>
            <Text style={[m.cancelBtnText, { color: palette.subtext }]}>Keep My Subscription</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SubscriptionManagementScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [downgradeModalVisible, setDowngradeModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [tierUsage, setTierUsage] = useState<TierUsageData | null>(null);
  const [tierUsageLoading, setTierUsageLoading] = useState(true);
  const [pricingInsight, setPricingInsight] = useState<PricingInsight | null>(null);
  const [pricingInsightLoading, setPricingInsightLoading] = useState(true);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await getRequest(ROUTES.wallet.subscription, {
        errorMessage: 'Unable to load subscription.',
        forceNetwork: isRefresh,
      });
      if (res?.success) {
        const d = res.data?.subscription ?? res.data ?? {};
        setSubscription(d as Subscription);
      } else {
        setError(res?.message || 'Unable to load subscription information.');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load subscription information.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadExtras = useCallback(async () => {
    setTierUsageLoading(true);
    setPricingInsightLoading(true);
    try {
      const [usageRes, insightRes] = await Promise.all([
        getRequest(ROUTES.billing.tierUsage, { errorMessage: 'Unable to load usage.' }),
        getRequest(ROUTES.billing.pricingInsights, { errorMessage: 'Unable to load pricing insights.' }),
      ]);
      if (usageRes?.success) {
        setTierUsage(usageRes.data?.usage ?? usageRes.data ?? null);
      }
      if (insightRes?.success) {
        const d = insightRes.data?.insight ?? insightRes.data ?? {};
        setPricingInsight(d as PricingInsight);
      }
    } finally {
      setTierUsageLoading(false);
      setPricingInsightLoading(false);
    }
  }, []);

  useEffect(() => { void load(); void loadExtras(); }, [load, loadExtras]);

  const handleRefresh = useCallback(() => { void load(true); void loadExtras(); }, [load, loadExtras]);

  const handleCancel = useCallback(async (reason: string) => {
    setSubmitting(true);
    try {
      const res = await postRequest(ROUTES.wallet.subscriptionCancel, { reason }, {
        errorMessage: 'Unable to cancel subscription.',
      });
      if (res?.success) {
        Alert.alert('Subscription Cancelled', 'Your subscription has been scheduled for cancellation at the end of the billing period.');
        setCancelModalVisible(false);
        void load(true);
      } else {
        Alert.alert('Error', res?.message || 'Unable to cancel subscription.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Unable to cancel subscription.');
    } finally {
      setSubmitting(false);
    }
  }, [load]);

  const handleResume = useCallback(() => {
    Alert.alert(
      'Resume Subscription',
      'Are you sure you want to resume your subscription?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resume',
          style: 'default',
          onPress: async () => {
            setSubmitting(true);
            try {
              const res = await postRequest(ROUTES.wallet.subscriptionResume, {}, {
                errorMessage: 'Unable to resume subscription.',
              });
              if (res?.success) {
                Alert.alert('Subscription Resumed', 'Your subscription has been resumed.');
                void load(true);
              } else {
                Alert.alert('Error', res?.message || 'Unable to resume subscription.');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Unable to resume subscription.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  }, [load]);

  const handleDowngrade = useCallback(async (tier: string) => {
    setSubmitting(true);
    try {
      const res = await postRequest(ROUTES.wallet.subscriptionDowngrade, { tier }, {
        errorMessage: 'Unable to downgrade subscription.',
      });
      if (res?.success) {
        Alert.alert('Plan Downgraded', `Your plan has been scheduled to downgrade to ${tier} at the end of your billing period.`);
        setDowngradeModalVisible(false);
        void load(true);
      } else {
        Alert.alert('Error', res?.message || 'Unable to downgrade subscription.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Unable to downgrade subscription.');
    } finally {
      setSubmitting(false);
    }
  }, [load]);

  const openReceipt = useCallback(async (url?: string) => {
    if (!url) {
      Alert.alert('Receipt', 'No receipt link available.');
      return;
    }
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Receipt', 'Cannot open this link.');
      }
    } catch {
      Alert.alert('Receipt', 'Unable to open receipt.');
    }
  }, []);

  const status = (subscription?.status || '').toLowerCase() as SubscriptionStatus;
  const isActive = status === 'active' || status === 'trialing';
  const isCancelled = status === 'cancelled' || status === 'canceled';
  const badge = statusColor(subscription?.status);
  const planName = subscription?.plan_name ?? subscription?.plan ?? subscription?.tier ?? 'Unknown Plan';
  const nextBilling = subscription?.next_billing_date ?? subscription?.current_period_end;
  const features = Array.isArray(subscription?.features) ? subscription.features : [];
  const currentTier = subscription?.tier ?? subscription?.plan;

  return (
    <SafeAreaView style={[ss.root, { backgroundColor: palette.bg }]}>
      {/* Header */}
      <View style={[ss.header, { borderBottomColor: palette.divider }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={ss.backBtn}
        >
          <Text style={[ss.backText, { color: palette.primaryStrong }]}>Back</Text>
        </Pressable>
        <Text style={[ss.headerTitle, { color: palette.text }]}>Subscription</Text>
        <View style={ss.backBtn} />
      </View>

      {loading && !refreshing ? (
        <View style={ss.center}>
          <ActivityIndicator color={palette.primaryStrong} size="large" />
        </View>
      ) : error ? (
        <View style={ss.center}>
          <Text style={[ss.errorText, { color: palette.error ?? '#DC2626' }]}>{error}</Text>
          <Pressable onPress={() => load()} style={[ss.retryBtn, { borderColor: palette.primaryStrong }]}>
            <Text style={[ss.retryText, { color: palette.primaryStrong }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={ss.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primaryStrong} />
          }
        >
          {/* Plan header card */}
          <View style={[ss.planCard, { backgroundColor: palette.primaryStrong }]}>
            <View style={ss.planCardTop}>
              <Text style={ss.planName}>{planName}</Text>
              <View style={[ss.statusPill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <View style={[ss.statusDot, { backgroundColor: badge.dot }]} />
                <Text style={ss.statusPillText}>{subscription?.status ?? 'unknown'}</Text>
              </View>
            </View>
            <Text style={ss.planPrice}>
              {formatPrice(subscription?.price_cents, subscription?.price, subscription?.currency)}
              {subscription?.billing_cycle ? ` / ${subscription.billing_cycle}` : ''}
            </Text>
            {nextBilling ? (
              <Text style={ss.planNextBilling}>
                {isCancelled ? 'Access until' : 'Next billing'}: {formatDate(nextBilling)}
              </Text>
            ) : null}
            {subscription?.cancel_at_period_end ? (
              <View style={ss.cancelNotice}>
                <Text style={ss.cancelNoticeText}>Cancels at period end</Text>
              </View>
            ) : null}
          </View>

          {/* Features */}
          {features.length > 0 ? (
            <View style={[ss.section, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
              <Text style={[ss.sectionTitle, { color: palette.text }]}>Plan Features</Text>
              {features.map((feature, idx) => (
                <View key={String(idx)} style={ss.featureRow}>
                  <KISIcon name="checkmark-circle" size={18} color={palette.primaryStrong} />
                  <Text style={[ss.featureText, { color: palette.text }]}>{feature}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={[ss.section, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
              <Text style={[ss.sectionTitle, { color: palette.text }]}>Plan Features</Text>
              <Text style={[ss.emptyNote, { color: palette.subtext }]}>
                Contact support for a full list of features included in your plan.
              </Text>
            </View>
          )}

          {/* Subscription details */}
          <View style={[ss.section, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            <Text style={[ss.sectionTitle, { color: palette.text }]}>Subscription Details</Text>
            {[
              { label: 'Plan', value: planName },
              { label: 'Status', value: subscription?.status ?? 'Unknown' },
              { label: 'Billing Cycle', value: subscription?.billing_cycle ?? 'N/A' },
              { label: 'Next Billing', value: formatDate(nextBilling) },
              { label: 'Currency', value: subscription?.currency ?? 'USD' },
            ].map(item => (
              <View key={item.label} style={[ss.detailRow, { borderBottomColor: palette.divider }]}>
                <Text style={[ss.detailKey, { color: palette.subtext }]}>{item.label}</Text>
                <Text style={[ss.detailValue, { color: palette.text }]}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* Receipt link */}
          {subscription?.receipt_url ? (
            <Pressable
              style={[ss.receiptBtn, { borderColor: palette.primaryStrong }]}
              onPress={() => openReceipt(subscription.receipt_url)}
            >
              <KISIcon name="document" size={18} color={palette.primaryStrong} />
              <Text style={[ss.receiptBtnText, { color: palette.primaryStrong }]}>View Billing Receipt</Text>
            </Pressable>
          ) : null}

          {/* Tier Usage */}
          <View style={[ss.section, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            <Text style={[ss.sectionTitle, { color: palette.text }]}>Usage</Text>
            {tierUsageLoading ? (
              <ActivityIndicator color={palette.primaryStrong} size="small" style={{ marginVertical: 8 }} />
            ) : tierUsage == null ? (
              <Text style={[ss.emptyNote, { color: palette.subtext }]}>Usage data unavailable.</Text>
            ) : (() => {
              // Build metrics array from either a metrics array or flat fields
              const metrics: UsageMetric[] = Array.isArray(tierUsage.metrics) && tierUsage.metrics.length > 0
                ? tierUsage.metrics
                : [
                    ...(tierUsage.storage_limit ? [{ label: 'Storage', used: tierUsage.storage_used ?? 0, limit: tierUsage.storage_limit, unit: 'GB' }] : []),
                    ...(tierUsage.api_calls_limit ? [{ label: 'API Calls', used: tierUsage.api_calls_used ?? 0, limit: tierUsage.api_calls_limit }] : []),
                    ...(tierUsage.members_limit ? [{ label: 'Members', used: tierUsage.members_used ?? 0, limit: tierUsage.members_limit }] : []),
                  ];

              if (metrics.length === 0) {
                return <Text style={[ss.emptyNote, { color: palette.subtext }]}>No usage metrics available.</Text>;
              }

              return metrics.map((metric, idx) => {
                const pct = metric.limit > 0 ? Math.min(metric.used / metric.limit, 1) : 0;
                const pctInt = Math.round(pct * 100);
                const isHigh = pct >= 0.8;
                const barColor = isHigh ? '#ef4444' : palette.primaryStrong;
                return (
                  <View key={String(idx)} style={{ gap: 4, marginTop: idx > 0 ? 10 : 0 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[ss.usageLabel, { color: palette.text }]}>{metric.label}</Text>
                      <Text style={[ss.usageValue, { color: isHigh ? '#ef4444' : palette.subtext }]}>
                        {metric.used}{metric.unit ? ` ${metric.unit}` : ''} / {metric.limit}{metric.unit ? ` ${metric.unit}` : ''} ({pctInt}%)
                      </Text>
                    </View>
                    <View style={[ss.usageBarBg, { backgroundColor: palette.divider }]}>
                      <View style={[ss.usageBarFill, { width: `${pctInt}%` as any, backgroundColor: barColor }]} />
                    </View>
                  </View>
                );
              });
            })()}
          </View>

          {/* Pricing Insights */}
          {!pricingInsightLoading && pricingInsight && (pricingInsight.insight || pricingInsight.message) ? (
            <View style={[ss.insightCard, { backgroundColor: palette.primarySoft, borderColor: palette.primaryStrong }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <KISIcon name="trending-up" size={20} color={palette.primaryStrong} />
                <View style={{ flex: 1 }}>
                  <Text style={[ss.insightTitle, { color: palette.primaryStrong }]}>Pricing Insight</Text>
                  <Text style={[ss.insightText, { color: palette.text }]}>
                    {pricingInsight.insight ?? pricingInsight.message}
                  </Text>
                  {pricingInsight.recommended_tier ? (
                    <Text style={[ss.insightMeta, { color: palette.subtext }]}>
                      Recommended: {pricingInsight.recommended_tier}
                      {pricingInsight.savings_percent ? ` — save ${pricingInsight.savings_percent}%` : ''}
                    </Text>
                  ) : null}
                </View>
              </View>
              {pricingInsight.cta_label ? (
                <Pressable
                  style={[ss.insightCta, { backgroundColor: palette.primaryStrong }]}
                  onPress={async () => {
                    if (pricingInsight.cta_url) {
                      try {
                        const can = await Linking.canOpenURL(pricingInsight.cta_url!);
                        if (can) await Linking.openURL(pricingInsight.cta_url!);
                      } catch { /* ignore */ }
                    }
                  }}
                >
                  <Text style={ss.insightCtaText}>{pricingInsight.cta_label}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Actions */}
          <View style={ss.actionsSection}>
            {isActive && !subscription?.cancel_at_period_end ? (
              <>
                <Pressable
                  style={[ss.downgradeBtn, { borderColor: palette.primaryStrong }]}
                  onPress={() => setDowngradeModalVisible(true)}
                  disabled={submitting}
                >
                  <KISIcon name="arrow-down-circle" size={18} color={palette.primaryStrong} />
                  <Text style={[ss.downgradeBtnText, { color: palette.primaryStrong }]}>
                    Downgrade Plan
                  </Text>
                </Pressable>

                <Pressable
                  style={[ss.cancelBtn]}
                  onPress={() => setCancelModalVisible(true)}
                  disabled={submitting}
                >
                  {submitting
                    ? <ActivityIndicator color="#ef4444" size="small" />
                    : (
                      <>
                        <KISIcon name="close-circle" size={18} color="#ef4444" />
                        <Text style={ss.cancelBtnText}>Cancel Subscription</Text>
                      </>
                    )
                  }
                </Pressable>
              </>
            ) : null}

            {(isCancelled || subscription?.cancel_at_period_end) ? (
              <Pressable
                style={[ss.resumeBtn, { backgroundColor: palette.primaryStrong }]}
                onPress={handleResume}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : (
                    <>
                      <KISIcon name="refresh" size={18} color="#fff" />
                      <Text style={ss.resumeBtnText}>Resume Subscription</Text>
                    </>
                  )
                }
              </Pressable>
            ) : null}

            {!subscription || !subscription.status ? (
              <View style={[ss.noSubNote, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                <KISIcon name="information-circle" size={24} color={palette.subtext} />
                <Text style={[ss.noSubNoteText, { color: palette.subtext }]}>
                  No active subscription found. Upgrade your account to unlock premium features.
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}

      {/* Modals */}
      <CancelModal
        visible={cancelModalVisible}
        palette={palette}
        onClose={() => setCancelModalVisible(false)}
        onConfirm={handleCancel}
        submitting={submitting}
      />
      <DowngradeModal
        visible={downgradeModalVisible}
        currentTier={currentTier}
        palette={palette}
        onClose={() => setDowngradeModalVisible(false)}
        onConfirm={handleDowngrade}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ss = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 60 },
  backText: { fontSize: 15, fontWeight: '600' },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  retryBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontSize: 14, fontWeight: '700' },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  emptyNote: { fontSize: 13, fontStyle: 'italic' },

  // Plan card
  planCard: {
    borderRadius: 24,
    padding: 24,
    gap: 8,
  },
  planCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  planName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    flex: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPillText: { color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  planPrice: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
  },
  planNextBilling: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
  },
  cancelNotice: {
    marginTop: 4,
    backgroundColor: 'rgba(239,68,68,0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  cancelNoticeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Section
  section: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },

  // Features
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: { fontSize: 14, flex: 1 },

  // Details table
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailKey: { fontSize: 13, fontWeight: '600' },
  detailValue: { fontSize: 13, fontWeight: '700', textAlign: 'right', flex: 1, marginLeft: 12 },

  // Receipt
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
  },
  receiptBtnText: { fontSize: 15, fontWeight: '700' },

  // Actions
  actionsSection: { gap: 12 },
  downgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
  },
  downgradeBtnText: { fontSize: 15, fontWeight: '700' },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 14,
    paddingVertical: 14,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: '#ef4444' },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  resumeBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  noSubNote: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  noSubNoteText: { fontSize: 14, flex: 1, lineHeight: 20 },

  // Usage
  usageLabel: { fontSize: 13, fontWeight: '700' },
  usageValue: { fontSize: 12, fontWeight: '600' },
  usageBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  usageBarFill: {
    height: 8,
    borderRadius: 4,
  },

  // Pricing Insight card
  insightCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  insightTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  insightText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  insightMeta: { fontSize: 12, marginTop: 4 },
  insightCta: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  insightCtaText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});

// ─── Modal Styles ─────────────────────────────────────────────────────────────

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    gap: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  sheetSubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600' },
  tierOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tierLabel: { fontSize: 15, fontWeight: '700' },
  tierRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  reasonInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
    marginTop: 4,
  },
  confirmBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cancelBtn: { paddingVertical: 10, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600' },
});
