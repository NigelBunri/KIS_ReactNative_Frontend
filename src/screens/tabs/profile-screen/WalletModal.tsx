import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { KISPalette } from '@/theme/constants';
import { walletModes } from '../profile/profile.constants';
import { styles } from '../profile/profile.styles';
import { getRequest } from '@/network/get';
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
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.billing.invoices, { errorMessage: 'Could not load invoices' });
      const list: Invoice[] = Array.isArray(res?.data?.results)
        ? res.data.results
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setInvoices(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <ActivityIndicator color={palette.primary} style={{ marginVertical: 16 }} />;
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

      {!['loyalty', 'invoices'].includes(mode) && (
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
