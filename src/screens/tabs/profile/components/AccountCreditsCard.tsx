import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Linking,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import KISButton from '@/constants/KISButton';
import { useKISTheme } from '@/theme/useTheme';
import { styles } from '../profile.styles';
import coin from '../../../../assets/KIS-Coin.png';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
const MICROS_PER_PROMO_CREDIT = 1000;

const formatUsd = (cents?: number) => {
  const safe = Number.isFinite(Number(cents)) ? Math.max(0, Number(cents)) : 0;
  return `$${(safe / 100).toFixed(2)}`;
};

const normalizeCreditLabel = (label?: string) => {
  const value = String(label || '').trim();
  if (!value) return '0 promotional credits';
  return value.replace(/KISC/g, 'promotional credits').replace(/KIS Coins?/gi, 'promotional credits');
};

const toEntryAmount = (entry: any) => {
  const amountMicro = Number(entry?.amount_micro);
  if (Number.isFinite(amountMicro) && amountMicro !== 0) {
    const sign =
      String(entry?.transaction_type || '').toLowerCase() === 'debit'
        ? '-'
        : '+';
    return `${sign}${(Math.abs(amountMicro) / MICROS_PER_PROMO_CREDIT).toFixed(
      2,
    )} promotional credits`;
  }
  const amountCents = Number(entry?.amount_cents);
  if (Number.isFinite(amountCents) && amountCents !== 0) {
    const sign = amountCents < 0 ? '-' : '+';
    return `${sign}$${(Math.abs(amountCents) / 100).toFixed(2)} USD`;
  }
  return '0 promotional credits';
};

const toCounterpartyLabel = (entry: any) => {
  const name = String(entry?.counterparty_name || '').trim();
  const phone = String(entry?.counterparty_phone || '').trim();
  if (!name && !phone) return '';
  const kind = String(entry?.kind || '').toLowerCase();
  const direction =
    kind === 'transfer_out'
      ? 'To'
      : kind === 'transfer_in'
      ? 'From'
      : 'Counterparty';
  const identity = name && phone ? `${name} (${phone})` : name || phone;
  return `${direction}: ${identity}`;
};

const renderPendingBookings = (
  title: string,
  bookings: any[],
  emptyMessage: string,
  palette: any,
  onOpen?: ((bookingId: string) => void) | undefined,
) => {
  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: palette.divider,
        backgroundColor: palette.surface,
        padding: 12,
      }}
    >
      <Text style={[styles.title, { color: palette.text, fontSize: 15 }]}>
        {title}
      </Text>
      {bookings.length ? (
        bookings.slice(0, 3).map(booking => (
          <View
            key={booking.id || `${booking.service}-${booking.scheduled_at}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 10,
              borderTopColor: palette.divider,
              borderTopWidth: 1,
              paddingTop: 10,
            }}
          >
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ color: palette.text, fontWeight: '600' }}>
                {booking.service_name || 'Service booking'}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                {booking.schedule_label || booking.scheduled_at
                  ? new Date(booking.scheduled_at).toLocaleString()
                  : 'Schedule pending'}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 11 }}>
                {`Payment: ${
                  booking.payment?.payment_status
                    ? String(booking.payment.payment_status).replace(/_/g, ' ')
                    : 'Pending'
                } • Escrow: ${booking.escrow_status || 'pending'}`}
              </Text>
            </View>
            {onOpen && booking.id ? (
              <KISButton
                title="Details"
                size="xs"
                variant="outline"
                onPress={() => onOpen(String(booking.id))}
              />
            ) : null}
          </View>
        ))
      ) : (
        <Text style={{ color: palette.subtext, marginTop: 6 }}>
          {emptyMessage}
        </Text>
      )}
    </View>
  );
};

export default function AccountCreditsCard({
  tierName,
  tierPriceCents,
  walletBalanceLabel,
  points,
  onWallet,
  onUpgrade,
  walletLedger,
  showCreatePartnerButton,
  onCreatePartner,
  partnerProfilesCount,
  partnerProfilesLimitLabel,
  partnerProfilesLimitValue,
  partnerProfilesIsUnlimited,
  pendingServicePayments = [],
  pendingReceivePayments = [],
  onOpenBookingDetails,
}: {
  tierName: string;
  tierPriceCents: number;
  walletBalanceLabel?: string;
  points: number;
  onWallet: () => void;
  onUpgrade: () => void;
  walletLedger: any[];
  showCreatePartnerButton?: boolean;
  onCreatePartner?: () => void;
  partnerProfilesCount?: number;
  partnerProfilesLimitLabel?: string | null;
  partnerProfilesLimitValue?: number | null;
  partnerProfilesIsUnlimited?: boolean;
  pendingServicePayments?: any[];
  pendingReceivePayments?: any[];
  onOpenBookingDetails?: (bookingId: string) => void;
}) {
  const { palette } = useKISTheme();
  const [showHistory, setShowHistory] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulseAnim]);

  const partnerLimitText = partnerProfilesIsUnlimited
    ? 'Unlimited partner orgs'
    : partnerProfilesLimitLabel ?? (partnerProfilesLimitValue ?? 0).toString();

  const resolvedCreditLabel = useMemo(
    () => normalizeCreditLabel(walletBalanceLabel),
    [walletBalanceLabel],
  );

  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: palette.card, borderColor: palette.divider },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.text }]}>
          Account & promotional credits
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Image source={coin} style={{ width: 14, height: 14 }} />
          <Text style={[styles.subtext, { color: palette.subtext }]}>
            {formatUsd(tierPriceCents)}
          </Text>
          <Text style={[styles.subtext, { color: palette.subtext }]}>/mo</Text>
        </View>
      </View>

      <View
        style={{
          borderRadius: 20,
          borderWidth: 1,
          borderColor: `${palette.accentPrimary}33`,
          backgroundColor: palette.surfaceElevated,
          padding: 14,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={[
            'rgba(255,221,87,0.16)',
            'rgba(255,255,255,0.02)',
            'rgba(255,173,51,0.12)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />

        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ width: 120, alignItems: 'center' }}>
            <View
              style={{
                width: 120,
                height: 120,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 114,
                  height: 114,
                  borderRadius: 57,
                  borderWidth: 2,
                  borderColor: '#F8D26A66',
                  transform: [
                    {
                      scale: pulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.08],
                      }),
                    },
                  ],
                  opacity: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.65, 0.2],
                  }),
                }}
              />
              <Image
                source={coin}
                style={{ width: 130, height: 130, marginTop: 10 }}
              />
            </View>
            <Text
              style={[
                styles.statMeta,
                { color: palette.subtext, marginTop: 6 },
              ]}
            >
              {resolvedCreditLabel}
            </Text>
          </View>

          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[styles.statLabel, { color: palette.subtext }]}>
              Promotional credit balance
            </Text>
            <Text style={[styles.statValue, { color: palette.text }]}>
              {resolvedCreditLabel}
            </Text>
            <Text style={[styles.statMeta, { color: palette.subtext }]}>
              Gift/reward credits can subsidize eligible account upgrades only.
            </Text>
            <Text style={[styles.statMeta, { color: palette.subtext }]}>
              They cannot be bought, transferred, withdrawn, sold, or converted to cash.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.statRow}>
        <View
          style={[
            styles.statChip,
            { backgroundColor: palette.surfaceElevated },
          ]}
        >
          <Text style={[styles.statLabel, { color: palette.subtext }]}>
            Current plan
          </Text>
          <Text style={[styles.statValue, { color: palette.text }]}>
            {tierName || 'Free'}
          </Text>
        </View>
        <View
          style={[
            styles.statChip,
            { backgroundColor: palette.surfaceElevated },
          ]}
        >
          <Text style={[styles.statLabel, { color: palette.subtext }]}>
            Points
          </Text>
          <Text style={[styles.statValue, { color: palette.text }]}>
            {points}
          </Text>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <KISButton
          title="View credits & history"
          variant="secondary"
          onPress={onWallet}
        />
        <KISButton
          title={`Upgrade Account (${tierName})`}
          variant="outline"
          onPress={onUpgrade}
          style={{ borderColor: palette.border, borderWidth: 3 }}
        />
        {showCreatePartnerButton && onCreatePartner ? (
          <KISButton
            title="Create partner"
            variant="primary"
            onPress={onCreatePartner}
          />
        ) : null}
      </View>

      <View style={[styles.partnerRow, { justifyContent: 'space-between' }]}>
        <Text style={[styles.subtext, { color: palette.text }]}>
          Partner orgs
        </Text>
        <Text style={[styles.statMeta, { color: palette.subtext }]}>
          {partnerProfilesCount ?? 0}/{partnerLimitText}
        </Text>
      </View>

      <View style={{ marginTop: 12, gap: 10 }}>
        {renderPendingBookings(
          'Pending Service Payment',
          pendingServicePayments,
          'No payments are currently pending.',
          palette,
          onOpenBookingDetails,
        )}
        {renderPendingBookings(
          'Pending Receive Payment Completion',
          pendingReceivePayments,
          'No pending payout completions.',
          palette,
          onOpenBookingDetails,
        )}
      </View>

      <View style={{ marginTop: 10, gap: 8 }}>
        <TouchableOpacity onPress={() => setShowHistory(prev => !prev)}>
          <Text style={[styles.title, { color: palette.text, fontSize: 16 }]}>
            Transaction History {showHistory ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        {!showHistory ? null : walletLedger.length === 0 ? (
          <Text style={[styles.subtext, { color: palette.subtext }]}>
            No recent promotional-credit or billing activity.
          </Text>
        ) : (
          walletLedger.slice(0, 6).map((entry: any) => (
            <View
              key={entry.id}
              style={[styles.itemRow, { borderBottomColor: palette.divider }]}
            >
              <View style={styles.itemInfo}>
                <Text style={[styles.itemTitle, { color: palette.text }]}>
                  {String(
                    entry.transaction_type || entry.kind || 'entry',
                  ).replace(/_/g, ' ')}
                </Text>
                <Text style={[styles.subtext, { color: palette.subtext }]}>
                  {toEntryAmount(entry)}
                  {toCounterpartyLabel(entry)
                    ? ` • ${toCounterpartyLabel(entry)}`
                    : entry.reference
                    ? ` • ${entry.reference}`
                    : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={[styles.subtext, { color: palette.subtext }]}>
                  {new Date(entry.created_at).toLocaleDateString()}
                </Text>
                {(entry.receipt_pdf_url || entry.receipt_url) && (
                  <KISButton
                    title="Receipt"
                    size="xs"
                    variant="outline"
                    onPress={() => {
                      const url = entry.receipt_pdf_url || entry.receipt_url;
                      if (!url) return;
                      Linking.openURL(url).catch(() => {
                        Alert.alert('Receipt', 'Unable to open receipt.');
                      });
                    }}
                  />
                )}
                {entry.tx_ref && entry.status === 'success' && (
                  <KISButton
                    title="Refund"
                    size="xs"
                    variant="outline"
                    onPress={() => {
                      Alert.alert(
                        'Request refund',
                        'Are you sure you want to request a refund for this transaction?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Request refund',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                const res = await postRequest(
                                  (ROUTES.billing as any).walletRefund,
                                  { tx_ref: entry.tx_ref, reason: 'Customer requested refund' },
                                );
                                if (res.success || res.data) {
                                  Alert.alert('Refund initiated', 'Your refund request has been submitted and will be processed within 5–10 business days.');
                                } else {
                                  Alert.alert('Refund failed', res.message || 'Unable to process refund. Please contact support.');
                                }
                              } catch {
                                Alert.alert('Refund failed', 'Unable to process refund. Please contact support.');
                              }
                            },
                          },
                        ],
                      );
                    }}
                  />
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
