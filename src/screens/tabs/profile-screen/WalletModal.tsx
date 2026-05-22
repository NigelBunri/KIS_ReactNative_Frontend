import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import type { KISPalette } from '@/theme/constants';
import { walletModes } from '../profile/profile.constants';
import { styles } from '../profile/profile.styles';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';

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
};

type LoyaltyBalance = {
  points: number;
  tier?: string;
  expiry?: string;
};

type Invoice = {
  id: string;
  amount: number | string;
  currency?: string;
  status?: string;
  created_at?: string;
  description?: string;
};

function LoyaltyPanel({ palette }: { palette: KISPalette }) {
  const [balance, setBalance] = useState<LoyaltyBalance | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.billing.loyaltyBalance, { errorMessage: 'Could not load loyalty balance' });
      setBalance(res?.data ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <ActivityIndicator color={palette.primary} style={{ marginVertical: 16 }} />;
  }

  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          borderWidth: 1,
          borderColor: palette.divider,
          backgroundColor: palette.surface,
          borderRadius: 12,
          padding: 16,
          gap: 4,
        }}
      >
        <Text style={{ color: palette.subtext, fontSize: 12 }}>Loyalty Points</Text>
        <Text style={{ color: palette.text, fontSize: 32, fontWeight: '700' }}>
          {balance?.points ?? 0}
        </Text>
        {balance?.tier && (
          <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '600' }}>
            {balance.tier} tier
          </Text>
        )}
        {balance?.expiry && (
          <Text style={{ color: palette.subtext, fontSize: 12 }}>
            Expires: {balance.expiry}
          </Text>
        )}
      </View>
      {!balance && (
        <Text style={{ color: palette.subtext, fontSize: 13 }}>No loyalty data available.</Text>
      )}
    </View>
  );
}

function InvoicesPanel({ palette }: { palette: KISPalette }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);

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
      data={invoices}
      keyExtractor={(inv) => inv.id}
      scrollEnabled={false}
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
                  color: item.status === 'paid' ? '#22c55e' : palette.subtext,
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
  } = props;

  const mode = String(walletForm.mode || 'history').trim().toLowerCase();
  const legacyActionMode = ['deposit', 'cash_to_credits', 'transfer'].includes(mode) || mode === `add_${'kisc'}`;

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

      {mode === 'loyalty' && <LoyaltyPanel palette={palette} />}

      {mode === 'invoices' && <InvoicesPanel palette={palette} />}

      {mode !== 'loyalty' && mode !== 'invoices' && (
        legacyActionMode ? (
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
              This wallet action is unavailable
            </Text>
            <Text style={[styles.subtext, { color: palette.subtext }]}>Locked</Text>
          </View>
        ) : (
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
        )
      )}
    </View>
  );
}
