// src/screens/market/TransactionHistoryScreen.tsx
//
// Permanent in-app record of wallet transactions - the primary receipt.
// A downloadable receipt is offered per-transaction (receipt_pdf_url,
// already built server-side); emailing a copy is optional/user-requested
// via the on-demand email-receipt action, not automatic.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useNavigation } from '@react-navigation/native';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';

type Transaction = {
  id: string;
  provider?: string;
  method?: string;
  amount_cents: number;
  amount_usd?: string;
  currency?: string;
  status: string;
  payment_status?: string;
  tx_ref?: string;
  created_at?: string;
  receipt_url?: string | null;
  receipt_pdf_url?: string | null;
};

const buildStatusColors = (p: any): Record<string, string> => ({
  success: p.success,
  pending: p.gold,
  failed: p.danger,
  refunded: p.subtext,
});

const formatAmount = (cents: number, currency?: string) => {
  const formatted = (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

export default function TransactionHistoryScreen() {
  const { palette } = useKISTheme();
  const statusColors = buildStatusColors(palette);
  const navigation = useNavigation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);

  const fetchTransactions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.billing.walletTransactions, {
        forceNetwork: isRefresh,
        errorMessage: 'Unable to load transactions.',
      });
      if (res?.success) {
        setTransactions(res.data?.results ?? []);
      } else {
        setError(res?.message ?? 'Unable to load transactions.');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load transactions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  const handleDownload = useCallback((tx: Transaction) => {
    const url = tx.receipt_pdf_url ?? tx.receipt_url;
    if (!url) {
      Alert.alert('Not available', 'A receipt isn\'t available for this transaction yet.');
      return;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open the receipt.');
    });
  }, []);

  const handleEmailReceipt = useCallback(async (tx: Transaction) => {
    if (emailingId) return;
    setEmailingId(tx.id);
    try {
      const res = await postRequest(
        ROUTES.billing.walletTransactionEmailReceipt(tx.id),
        {},
        { errorMessage: 'Could not send receipt email.' },
      );
      if (res?.success) {
        Alert.alert('Sent', 'Receipt emailed to your account address.');
      } else {
        Alert.alert('Error', res?.message ?? 'Could not send receipt email.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not send receipt email.');
    } finally {
      setEmailingId(null);
    }
  }, [emailingId]);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: palette.bg }]}>
      <View style={[s.header, { borderBottomColor: palette.divider }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={s.backBtn}
        >
          <Text style={[s.backText, { color: palette.primaryStrong }]}>Back</Text>
        </Pressable>
        <Text style={[s.headerTitle, { color: palette.text }]}>Transaction History</Text>
        <View style={s.backBtn} />
      </View>

      {loading && !refreshing ? (
        <View style={s.center}>
          <ActivityIndicator color={palette.primaryStrong} size="large" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={[s.errorText, { color: palette.danger }]}>{error}</Text>
          <Pressable
            onPress={() => void fetchTransactions()}
            style={[s.retryBtn, { borderColor: palette.primaryStrong }]}
          >
            <Text style={[s.retryText, { color: palette.primaryStrong }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void fetchTransactions(true)}
              tintColor={palette.primaryStrong}
            />
          }
        >
          {transactions.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={[s.emptyTitle, { color: palette.text }]}>No transactions yet</Text>
              <Text style={[s.emptySubtitle, { color: palette.subtext }]}>
                Wallet top-ups and payments will appear here.
              </Text>
            </View>
          ) : (
            transactions.map(tx => {
              const statusColor = statusColors[tx.status?.toLowerCase()] ?? palette.subtext;
              const hasReceipt = Boolean(tx.receipt_pdf_url ?? tx.receipt_url);
              return (
                <View
                  key={tx.id}
                  style={[s.card, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}
                >
                  <View style={s.row}>
                    <View style={s.left}>
                      <Text style={[s.provider, { color: palette.text }]} numberOfLines={1}>
                        {(tx.provider || 'Payment').replace(/^\w/, c => c.toUpperCase())}
                        {tx.method ? ` · ${tx.method}` : ''}
                      </Text>
                      <Text style={[s.date, { color: palette.subtext }]}>{formatDate(tx.created_at)}</Text>
                      {tx.tx_ref ? (
                        <Text style={[s.ref, { color: palette.subtext }]} numberOfLines={1}>
                          Ref: {tx.tx_ref}
                        </Text>
                      ) : null}
                    </View>
                    <View style={s.right}>
                      <Text style={[s.amount, { color: palette.primaryStrong }]}>
                        {formatAmount(tx.amount_cents, tx.currency)}
                      </Text>
                      <View style={[s.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                        <Text style={[s.statusText, { color: statusColor }]}>
                          {(tx.status || 'pending').charAt(0).toUpperCase() + (tx.status || 'pending').slice(1)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {tx.status === 'success' && (
                    <View style={s.actionsRow}>
                      <Pressable
                        onPress={() => handleDownload(tx)}
                        disabled={!hasReceipt}
                        style={[
                          s.actionBtn,
                          { borderColor: palette.primaryStrong, opacity: hasReceipt ? 1 : 0.5 },
                        ]}
                      >
                        <Text style={[s.actionBtnText, { color: palette.primaryStrong }]}>
                          Download Receipt
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleEmailReceipt(tx)}
                        disabled={emailingId === tx.id}
                        style={[s.actionBtn, { borderColor: palette.divider }]}
                      >
                        {emailingId === tx.id ? (
                          <ActivityIndicator size="small" color={palette.text} />
                        ) : (
                          <Text style={[s.actionBtnText, { color: palette.text }]}>Email Me a Copy</Text>
                        )}
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
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
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  retryBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontSize: 14, fontWeight: '700' },
  listContent: { padding: 16, gap: 12, paddingBottom: 40 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', maxWidth: 280 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  left: { flex: 1, marginRight: 12, gap: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  provider: { fontSize: 15, fontWeight: '700' },
  date: { fontSize: 12 },
  ref: { fontSize: 11 },
  amount: { fontSize: 16, fontWeight: '800' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionBtnText: { fontWeight: '700', fontSize: 12 },
});
