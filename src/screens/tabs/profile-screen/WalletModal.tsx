import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { KISPalette } from '@/theme/constants';
import { walletModes } from '../profile/profile.constants';
import { styles } from '../profile/profile.styles';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import KISButton from '@/constants/KISButton';
import ROUTES from '@/network';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

// setWalletRecipient/walletRecipientVerification/verifyWalletRecipient/
// saving/submitWalletAction/lastWalletPaymentUrl were plumbed in for the
// Deposit/Transfer/Convert/Upgrade panels removed in Phase 7 (of the
// billing/rewards project) — kept here as optional so ProfileScreen.tsx's
// existing call site (which still passes most of them) doesn't need a
// matching prop-plumbing change; none of them are read by this component
// anymore. navigation/closeSheet ARE used again as of Phase 8, to redirect
// the Rewards tab to the canonical LoyaltyScreen instead of duplicating it.
type WalletModalProps = {
  palette: KISPalette;
  walletForm: Record<string, any>;
  setWalletForm: React.Dispatch<React.SetStateAction<any>>;
  setWalletRecipient?: (value: string) => void;
  walletRecipientVerification?: {
    checking: boolean;
    verified: boolean;
    recipientName: string;
    recipientPhoneDisplay: string;
    error: string;
  };
  verifyWalletRecipient?: () => Promise<void>;
  saving: boolean;
  submitWalletAction?: () => Promise<void>;
  lastWalletPaymentUrl?: string;
  navigation?: any;
  closeSheet?: () => void;
};

// LoyaltyPanel used to duplicate LoyaltyScreen.tsx's balance/rules/history
// UI inline (reading the legacy apps.commerce loyalty endpoints, with its
// own separate fabricated fallback data) — one of three competing KIS
// Coins implementations found in the original project audit, capable of
// showing the user a different number than the other two. Phase 8 (of the
// billing/rewards project) retired that duplication: this is now a thin
// redirect to the one canonical screen (route 'Loyalty'), which reads the
// real apps.rewards ledger.
function LoyaltyRedirectCard({
  palette,
  navigation,
  closeSheet,
}: {
  palette: KISPalette;
  navigation?: any;
  closeSheet?: () => void;
}) {
  const goToRewards = () => {
    closeSheet?.();
    navigation?.navigate('Loyalty');
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>KIS Coins</Text>
      <Text style={{ color: palette.subtext, fontSize: 12, lineHeight: 17 }}>
        View your KIS Coins balance, how to earn them, and your activity history.
      </Text>
      <Pressable
        onPress={goToRewards}
        style={{
          backgroundColor: palette.primary,
          borderRadius: 10,
          padding: 14,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: palette.onPrimary, fontWeight: '800', fontSize: 14 }}>Open Rewards</Text>
      </Pressable>
    </View>
  );
}


type Invoice = {
  id: string;
  amount: number | string;
  status?: string;
  description?: string;
  currency?: string;
  created_at?: string;
};

function InvoicesPanel({ palette }: { palette: KISPalette }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  // Tracks a failed fetch distinctly from a genuinely empty invoice list —
  // without this, a network/auth failure rendered the exact same "No
  // invoices yet." text as actually having zero invoices, silently hiding
  // real billing errors from the user (financial data).
  const [loadError, setLoadError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.billing.invoices, { errorMessage: 'Could not load invoices' });
      if (!res?.success) {
        setLoadError(res?.message || 'Could not load invoices.');
        setInvoices([]);
        return;
      }
      const list: Invoice[] = Array.isArray(res?.data?.results)
        ? res.data.results
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setLoadError(null);
      setInvoices(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <ActivityIndicator color={palette.primary} style={{ marginVertical: 16 }} />;
  }

  if (loadError) {
    return (
      <View style={{ alignItems: 'center', gap: 8, marginVertical: 16 }}>
        <Text style={{ color: palette.danger, fontSize: 13, textAlign: 'center' }}>
          {loadError}
        </Text>
        <Pressable onPress={load} accessibilityRole="button" accessibilityLabel="Retry loading invoices">
          <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (invoices.length === 0) {
    return (
      <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginVertical: 16 }}>
        No invoices yet.
      </Text>
    );
  }

  return (
    <FlatList
      initialNumToRender={20}
      maxToRenderPerBatch={10}
      windowSize={10}
      removeClippedSubviews
      data={invoices}
      keyExtractor={(inv) => inv.id}
      scrollEnabled={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      ListEmptyComponent={
        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
          <Text style={{ color: palette.subtext, fontSize: 14, textAlign: 'center' }}>
            No transactions yet
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View
          style={{
            borderWidth: 1,
            borderColor: palette.divider,
            backgroundColor: palette.surface,
            borderRadius: 10,
            padding: 12,
            marginBottom: 8,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: palette.text, fontSize: 14, fontWeight: '600' }}>
              {item.currency ?? ''} {item.amount}
            </Text>
            {item.status && (
              <Text
                style={{
                  color: item.status === 'paid' ? palette.success : palette.subtext,
                  fontSize: 12,
                  fontWeight: '600',
                  textTransform: 'capitalize',
                }}
              >
                {item.status}
              </Text>
            )}
          </View>
          {item.description && (
            <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              {item.description}
            </Text>
          )}
          {item.created_at && (
            <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          )}
        </View>
      )}
    />
  );
}

type LedgerRow = {
  id: string;
  amount_cents?: number;
  currency?: string;
  status?: string;
  tx_ref?: string;
  provider?: string;
  method?: string;
  created_at?: string;
  receipt_url?: string;
  receipt_pdf_url?: string;
};

const formatLedgerAmount = (row: LedgerRow) => {
  const cents = Number(row.amount_cents || 0);
  const sign = cents < 0 ? '-' : '+';
  return `${sign}${row.currency || 'USD'} ${(Math.abs(cents) / 100).toFixed(2)}`;
};

// Was a static "Read-only credit center" placeholder for every mode other
// than Loyalty/Invoices, including 'history' - walletModes' only real
// entry ("Credit history") rendered nothing but that placeholder, and the
// one component that DID show real ledger rows with working
// receipt-download and self-service-refund buttons (AccountCreditsCard.tsx)
// was never imported anywhere in the app. Self-fetching, same pattern as
// InvoicesPanel just above, rather than threading the ProfileScreen-side
// ledger state through as new props.
function HistoryPanel({ palette }: { palette: KISPalette }) {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.wallet.ledger, { errorMessage: 'Unable to load transactions.' });
      if (!res?.success) {
        setLoadError(res?.message || 'Could not load transaction history.');
        setRows([]);
        return;
      }
      setLoadError(null);
      setRows(Array.isArray(res?.data?.results) ? res.data.results : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleRefund = useCallback((row: LedgerRow) => {
    Alert.alert(
      'Request refund',
      'Are you sure you want to request a refund for this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request refund',
          style: 'destructive',
          onPress: async () => {
            setRefundingId(row.id);
            try {
              const res = await postRequest(
                ROUTES.billing.walletRefund,
                { tx_ref: row.tx_ref, reason: 'Customer requested refund' },
                { errorMessage: 'Unable to process refund.' },
              );
              if (res?.success) {
                Alert.alert('Refund initiated', 'Your refund request has been submitted and will be processed within 5-10 business days.');
                await load();
              } else {
                Alert.alert('Refund failed', res?.message || 'Unable to process refund. Please contact support.');
              }
            } finally {
              setRefundingId(null);
            }
          },
        },
      ],
    );
  }, [load]);

  if (loading) {
    return <ActivityIndicator color={palette.primary} style={{ marginVertical: 16 }} />;
  }

  if (loadError) {
    return (
      <View style={{ alignItems: 'center', gap: 8, marginVertical: 16 }}>
        <Text style={{ color: palette.danger, fontSize: 13, textAlign: 'center' }}>{loadError}</Text>
        <Pressable onPress={load} accessibilityRole="button" accessibilityLabel="Retry loading transactions">
          <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginVertical: 16 }}>
        No recent promotional-credit or billing activity.
      </Text>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {rows.slice(0, 20).map(row => (
        <View
          key={row.id}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: palette.divider,
            backgroundColor: palette.surface,
            borderRadius: 10,
            padding: 12,
            gap: 8,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>
              {formatLedgerAmount(row)}
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>
              {String(row.method || row.provider || 'entry').replace(/_/g, ' ')}
              {row.created_at ? ` • ${new Date(row.created_at).toLocaleDateString()}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            {(row.receipt_pdf_url || row.receipt_url) && (
              <KISButton
                title="Receipt"
                size="xs"
                variant="outline"
                onPress={() => {
                  const url = row.receipt_pdf_url || row.receipt_url;
                  if (!url) return;
                  Linking.openURL(url).catch(() => {
                    Alert.alert('Receipt', 'Unable to open receipt.');
                  });
                }}
              />
            )}
            {row.tx_ref && row.status === 'success' && (
              <KISButton
                title="Refund"
                size="xs"
                variant="outline"
                loading={refundingId === row.id}
                disabled={refundingId === row.id}
                onPress={() => handleRefund(row)}
              />
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

export function WalletModal(props: WalletModalProps) {
  const {
    palette,
    walletForm,
    setWalletForm,
    navigation,
    closeSheet,
  } = props;

  const mode = String(walletForm.mode || 'history').trim().toLowerCase();

  return (
    <View style={{ gap: 12 }}>
      <Text style={[styles.subtext, { color: palette.subtext }]}>
        Promotional credits
      </Text>

      <View style={styles.walletModeRow}>
        {[...walletModes, { value: 'loyalty', label: 'Rewards' }, { value: 'invoices', label: 'Invoices' }].map((item) => (
          <Pressable
            key={item.value}
            onPress={() => setWalletForm((s: any) => ({ ...s, mode: item.value }))}
            style={[
              styles.walletModeChip,
              {
                backgroundColor: walletForm.mode === item.value ? palette.primarySoft : palette.surface,
                borderColor: palette.divider,
              },
            ]}
          >
            <Text style={{ color: palette.text, fontSize: 12 }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'loyalty' && (
        <LoyaltyRedirectCard palette={palette} navigation={navigation} closeSheet={closeSheet} />
      )}
      {mode === 'invoices' && <InvoicesPanel palette={palette} />}
      {mode === 'history' && <HistoryPanel palette={palette} />}

      {!['loyalty', 'invoices', 'history'].includes(mode) && (
        <View
          style={{
            borderWidth: 1,
            borderColor: palette.divider,
            backgroundColor: palette.surface,
            borderRadius: 12,
            padding: 12,
            gap: 6,
          }}
        >
          <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>
            Read-only credit center
          </Text>
          <Text style={[styles.subtext, { color: palette.subtext }]}>
            Promotional credits can only subsidize eligible KIS account upgrades when that option is available.
          </Text>
        </View>
      )}
    </View>
  );
}
