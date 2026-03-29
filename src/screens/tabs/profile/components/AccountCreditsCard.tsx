import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Linking, Text, TouchableOpacity, View, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import KISButton from '@/constants/KISButton';
import { useKISTheme } from '@/theme/useTheme';
import { styles } from '../profile.styles';
import coin from '../../../../assets/KIS-Coin.png';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';

const MICROS_PER_KISC = 100000;
const CENTS_PER_KISC = 10000;

const toKisc = (micro?: number) => {
  const safe = Number.isFinite(Number(micro)) ? Number(micro) : 0;
  return (safe / MICROS_PER_KISC).toFixed(3);
};

const toKiscFromCents = (cents?: number) => {
  const safe = Number.isFinite(Number(cents)) ? Math.max(0, Number(cents)) : 0;
  return (safe / CENTS_PER_KISC).toFixed(3);
};

const toEntryAmount = (entry: any) => {
  const amountMicro = Number(entry?.amount_micro);
  if (Number.isFinite(amountMicro) && amountMicro !== 0) {
    const sign = String(entry?.transaction_type || '').toLowerCase() === 'debit' ? '-' : '+';
    return `${sign}${toKisc(Math.abs(amountMicro))} KISC`;
  }
  const amountCents = Number(entry?.amount_cents);
  if (Number.isFinite(amountCents) && amountCents !== 0) {
    const kisc = Math.abs(amountCents) / CENTS_PER_KISC;
    const sign = amountCents < 0 ? '-' : '+';
    return `${sign}${kisc.toFixed(3)} KISC`;
  }
  return '0.000 KISC';
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
      <Text style={[styles.title, { color: palette.text, fontSize: 15 }]}>{title}</Text>
      {bookings.length ? (
        bookings.slice(0, 3).map((booking) => (
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
                {`Payment: ${(booking.payment?.payment_status ? String(booking.payment.payment_status).replace(/_/g, ' ') : 'Pending')} • Escrow: ${booking.escrow_status || 'pending'}`}
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
        <Text style={{ color: palette.subtext, marginTop: 6 }}>{emptyMessage}</Text>
      )}
    </View>
  );
};

export default function AccountCreditsCard({
  tierName,
  tierPriceCents,
  kisBalanceMicro,
  kisBalanceKisc,
  kisBalanceUsd: _kisBalanceUsd,
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
  onDeleteWalletEntry,
  deletingWalletEntryId,
  pendingServicePayments = [],
  pendingReceivePayments = [],
  onOpenBookingDetails,
}: {
  tierName: string;
  tierPriceCents: number;
  kisBalanceMicro: number;
  kisBalanceKisc?: string;
  kisBalanceUsd?: string;
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
  onDeleteWalletEntry?: (entryId: string) => void;
  deletingWalletEntryId?: string | null;
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

  const resolvedKisc = useMemo(
    () => (kisBalanceKisc && kisBalanceKisc.trim() ? kisBalanceKisc : toKisc(kisBalanceMicro)),
    [kisBalanceKisc, kisBalanceMicro],
  );

  return (
    <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.divider }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.text }]}>Account & KIS-Coins</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Image source={coin} style={{ width: 14, height: 14 }} />
          <Text style={[styles.subtext, { color: palette.subtext }]}>
            {toKiscFromCents(tierPriceCents)} KISC
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
          colors={['rgba(255,221,87,0.16)', 'rgba(255,255,255,0.02)', 'rgba(255,173,51,0.12)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />

        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ width: 120, alignItems: 'center' }}>
            <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
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
              <Image source={coin} style={{ width: 130, height: 130, marginTop: 10 }} />
            </View>
            <Text style={[styles.statMeta, { color: palette.subtext, marginTop: 6 }]}>
              {resolvedKisc} KISC
            </Text>
          </View>

          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[styles.statLabel, { color: palette.subtext }]}>KIS Coin Balance</Text>
            <Text style={[styles.statValue, { color: palette.text }]}>{resolvedKisc} KISC</Text>
            <Text style={[styles.statMeta, { color: palette.subtext }]}>Used for upgrades, transfers, and billing.</Text>
            <Text style={[styles.statMeta, { color: palette.subtext }]}>Top up anytime from the wallet section.</Text>
          </View>
        </View>
      </View>

      <View style={styles.statRow}>
        <View style={[styles.statChip, { backgroundColor: palette.surfaceElevated }]}>
          <Text style={[styles.statLabel, { color: palette.subtext }]}>Wallet Micro Units</Text>
          <Text style={[styles.statValue, { color: palette.text }]}>{Math.max(0, Number(kisBalanceMicro || 0))}</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: palette.surfaceElevated }]}>
          <Text style={[styles.statLabel, { color: palette.subtext }]}>Points</Text>
          <Text style={[styles.statValue, { color: palette.text }]}>{points}</Text>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <KISButton title="Add KIS Coins" variant="secondary" onPress={onWallet} />
        <KISButton title={`Upgrade Account (${tierName})`} variant="outline" onPress={onUpgrade} style={{ borderColor: palette.border, borderWidth: 3 }} />
        {showCreatePartnerButton && onCreatePartner ? (
          <KISButton title="Create partner" variant="primary" onPress={onCreatePartner} />
        ) : null}
      </View>

      <View style={[styles.partnerRow, { justifyContent: 'space-between' }]}> 
        <Text style={[styles.subtext, { color: palette.text }]}>Partner orgs</Text>
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
        <TouchableOpacity onPress={() => setShowHistory((prev) => !prev)}>
          <Text style={[styles.title, { color: palette.text, fontSize: 16 }]}>
            Transaction History {showHistory ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        {!showHistory ? null : walletLedger.length === 0 ? (
          <Text style={[styles.subtext, { color: palette.subtext }]}>No recent KIS wallet activity.</Text>
        ) : (
          walletLedger.slice(0, 6).map((entry: any) => (
            <View key={entry.id} style={[styles.itemRow, { borderBottomColor: palette.divider }]}>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemTitle, { color: palette.text }]}>
                  {String(entry.transaction_type || entry.kind || 'entry').replace(/_/g, ' ')}
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
                {onDeleteWalletEntry ? (
                  <TouchableOpacity
                    onPress={() => onDeleteWalletEntry(String(entry.id || ''))}
                    disabled={deletingWalletEntryId === String(entry.id || '')}
                  >
                    <Text style={{ fontSize: 12, color: palette.warning }}>
                      {deletingWalletEntryId === String(entry.id || '') ? 'Deleting...' : 'Delete'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
