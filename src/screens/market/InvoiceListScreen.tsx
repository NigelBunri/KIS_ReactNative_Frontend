import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
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
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';

type Invoice = {
  id: string;
  invoice_number?: string;
  number?: string;
  amount: number | string;
  status: 'paid' | 'pending' | 'overdue' | string;
  date?: string;
  due_date?: string;
  created_at?: string;
  description?: string;
  currency?: string;
  items?: any[];
  recipient?: any;
  issuer?: any;
  pdf_url?: string;
  download_url?: string;
  url?: string;
};

const buildStatusColors = (p: any): Record<string, string> => ({
  paid: p.success,
  pending: p.gold,
  overdue: p.danger,
});

const buildStatusColor = (p: any) => (status: string) =>
  buildStatusColors(p)[status?.toLowerCase() ?? ''] ?? p.subtext;

const formatAmount = (amount: number | string, currency?: string) => {
  const num = Number(amount);
  const formatted = Number.isFinite(num)
    ? num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';
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

const normalizeInvoices = (payload: any): Invoice[] => {
  const source = payload?.data ?? payload ?? {};
  const results = source?.results ?? source;
  if (!Array.isArray(results)) return [];
  return results.map((item: any) => ({
    id: String(item?.id ?? ''),
    invoice_number: item?.invoice_number ?? item?.number ?? `INV-${item?.id ?? '?'}`,
    amount: item?.amount ?? item?.total ?? item?.total_amount ?? 0,
    status: String(item?.status ?? 'pending').toLowerCase(),
    date: item?.date ?? item?.issued_at ?? item?.created_at,
    due_date: item?.due_date,
    created_at: item?.created_at,
    description: item?.description ?? item?.notes,
    currency: item?.currency,
    items: item?.line_items ?? item?.items ?? [],
    recipient: item?.recipient ?? item?.customer,
    issuer: item?.issuer ?? item?.shop,
    pdf_url: item?.pdf_url,
    download_url: item?.download_url,
    url: item?.url,
  }));
};

export default function InvoiceListScreen() {
  const { palette } = useKISTheme();
  const statusColor = buildStatusColor(palette);
  const navigation = useNavigation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const fetchInvoices = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await getRequest(ROUTES.billing.invoices, {
        forceNetwork: isRefresh,
        errorMessage: 'Unable to load invoices.',
      });
      if (response?.success) {
        setInvoices(normalizeInvoices(response.data));
      } else {
        setError(response?.message ?? 'Unable to load invoices.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load invoices.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  const handleRefresh = useCallback(() => {
    void fetchInvoices(true);
  }, [fetchInvoices]);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: palette.bg, }]}>
      <View style={[s.header, { borderBottomColor: palette.divider }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={s.backBtn}
        >
          <Text style={[s.backText, { color: palette.primaryStrong }]}>Back</Text>
        </Pressable>
        <Text style={[s.headerTitle, { color: palette.text }]}>Invoices</Text>
        <View style={s.backBtn} />
      </View>

      {loading && !refreshing ? (
        <View style={s.center}>
          <ActivityIndicator color={palette.primaryStrong} size="large" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={[s.errorText, { color: palette.danger }]}>
            {error}
          </Text>
          <Pressable
            onPress={() => void fetchInvoices()}
            style={[s.retryBtn, { borderColor: palette.primaryStrong }]}
          >
            <Text style={[s.retryText, { color: palette.primaryStrong }]}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={palette.primaryStrong}
            />
          }
        >
          {invoices.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={[s.emptyTitle, { color: palette.text }]}>
                No invoices yet
              </Text>
              <Text style={[s.emptySubtitle, { color: palette.subtext }]}>
                Invoices for your orders and subscriptions will appear here.
              </Text>
            </View>
          ) : (
            invoices.map(invoice => (
              <Pressable
                key={invoice.id}
                style={[
                  s.invoiceCard,
                  {
                    backgroundColor: palette.surfaceElevated,
                    borderColor: palette.divider,
                  },
                ]}
                onPress={() => setSelectedInvoice(invoice)}
              >
                <View style={s.invoiceRow}>
                  <View style={s.invoiceLeft}>
                    <Text
                      style={[s.invoiceNumber, { color: palette.text }]}
                      numberOfLines={1}
                    >
                      {invoice.invoice_number}
                    </Text>
                    <Text style={[s.invoiceDate, { color: palette.subtext }]}>
                      {formatDate(invoice.date ?? invoice.created_at)}
                    </Text>
                  </View>
                  <View style={s.invoiceRight}>
                    <Text
                      style={[s.invoiceAmount, { color: palette.primaryStrong }]}
                    >
                      {formatAmount(invoice.amount, invoice.currency)}
                    </Text>
                    <View
                      style={[
                        s.statusBadge,
                        { backgroundColor: `${statusColor(invoice.status)}20` },
                      ]}
                    >
                      <Text
                        style={[
                          s.statusText,
                          { color: statusColor(invoice.status) },
                        ]}
                      >
                        {invoice.status.charAt(0).toUpperCase() +
                          invoice.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>
                {invoice.description ? (
                  <Text
                    style={[s.invoiceDesc, { color: palette.subtext }]}
                    numberOfLines={1}
                  >
                    {invoice.description}
                  </Text>
                ) : null}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      <Modal
        visible={Boolean(selectedInvoice)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedInvoice(null)}
      >
        <Pressable
          style={[s.modalBackdrop, { backgroundColor: palette.overlay }]}
          onPress={() => setSelectedInvoice(null)}
        >
          <Pressable
            style={[s.bottomSheet, { backgroundColor: palette.surface }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={[s.sheetHandle, { backgroundColor: palette.divider }]} />
            <ScrollView>
              {selectedInvoice ? (
                <View style={s.sheetContent}>
                  <View style={s.sheetHeader}>
                    <Text style={[s.sheetTitle, { color: palette.text }]}>
                      {selectedInvoice.invoice_number}
                    </Text>
                    <View
                      style={[
                        s.statusBadge,
                        {
                          backgroundColor: `${statusColor(selectedInvoice.status)}20`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.statusText,
                          { color: statusColor(selectedInvoice.status) },
                        ]}
                      >
                        {selectedInvoice.status.charAt(0).toUpperCase() +
                          selectedInvoice.status.slice(1)}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      s.detailSection,
                      { borderColor: palette.divider },
                    ]}
                  >
                    <DetailRow
                      label="Amount"
                      value={formatAmount(
                        selectedInvoice.amount,
                        selectedInvoice.currency,
                      )}
                      palette={palette}
                      accent
                    />
                    <DetailRow
                      label="Date issued"
                      value={formatDate(
                        selectedInvoice.date ?? selectedInvoice.created_at,
                      )}
                      palette={palette}
                    />
                    {selectedInvoice.due_date ? (
                      <DetailRow
                        label="Due date"
                        value={formatDate(selectedInvoice.due_date)}
                        palette={palette}
                      />
                    ) : null}
                    {selectedInvoice.description ? (
                      <DetailRow
                        label="Notes"
                        value={selectedInvoice.description}
                        palette={palette}
                      />
                    ) : null}
                    {selectedInvoice.issuer?.name ? (
                      <DetailRow
                        label="From"
                        value={selectedInvoice.issuer.name}
                        palette={palette}
                      />
                    ) : null}
                    {selectedInvoice.recipient?.name ??
                    selectedInvoice.recipient?.display_name ? (
                      <DetailRow
                        label="To"
                        value={
                          selectedInvoice.recipient.name ??
                          selectedInvoice.recipient.display_name
                        }
                        palette={palette}
                      />
                    ) : null}
                  </View>

                  {Array.isArray(selectedInvoice.items) &&
                  selectedInvoice.items.length > 0 ? (
                    <View>
                      <Text
                        style={[s.lineItemsTitle, { color: palette.text }]}
                      >
                        Line items
                      </Text>
                      {selectedInvoice.items.map((item: any, idx: number) => (
                        <View
                          key={item?.id ?? idx}
                          style={[
                            s.lineItem,
                            { borderColor: palette.divider },
                          ]}
                        >
                          <Text
                            style={[
                              s.lineItemName,
                              { color: palette.text },
                            ]}
                            numberOfLines={2}
                          >
                            {item?.name ?? item?.description ?? `Item ${idx + 1}`}
                          </Text>
                          <Text
                            style={[
                              s.lineItemAmount,
                              { color: palette.primaryStrong },
                            ]}
                          >
                            {formatAmount(
                              item?.amount ?? item?.total ?? 0,
                              selectedInvoice.currency,
                            )}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <Pressable
                    style={[s.downloadBtn, { borderColor: palette.primaryStrong }]}
                    onPress={() => {
                      const pdfUrl =
                        selectedInvoice.pdf_url ??
                        selectedInvoice.download_url ??
                        selectedInvoice.url;
                      if (pdfUrl) {
                        Linking.openURL(pdfUrl).catch(() => {
                          Alert.alert('Error', 'Could not open the PDF link.');
                        });
                      } else {
                        Alert.alert(
                          'Not Available',
                          'PDF not yet generated for this invoice.',
                        );
                      }
                    }}
                  >
                    <Text style={[s.downloadBtnText, { color: palette.primaryStrong }]}>
                      Download PDF
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      s.closeBtn,
                      { backgroundColor: palette.primaryStrong },
                    ]}
                    onPress={() => setSelectedInvoice(null)}
                  >
                    <Text style={[s.closeBtnText, { color: palette.onPrimary }]}>Close</Text>
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  palette,
  accent,
}: {
  label: string;
  value: string;
  palette: any;
  accent?: boolean;
}) {
  return (
    <View style={s.detailRow}>
      <Text style={[s.detailLabel, { color: palette.subtext }]}>{label}</Text>
      <Text
        style={[
          s.detailValue,
          { color: accent ? palette.primaryStrong : palette.text },
          accent && s.detailValueAccent,
        ]}
      >
        {value}
      </Text>
    </View>
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
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { fontSize: 14, fontWeight: '700' },
  listContent: { padding: 16, gap: 12, paddingBottom: 40 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', maxWidth: 280 },
  invoiceCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  invoiceLeft: { flex: 1, marginRight: 12 },
  invoiceRight: { alignItems: 'flex-end' },
  invoiceNumber: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  invoiceDate: { fontSize: 12 },
  invoiceAmount: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  invoiceDesc: { fontSize: 12, marginTop: 6 },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetContent: { padding: 20, paddingBottom: 40 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', flex: 1, marginRight: 12 },
  detailSection: { borderWidth: 1, borderRadius: 12, marginBottom: 16 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
    borderBottomWidth: 0,
  },
  detailLabel: { fontSize: 13, fontWeight: '600', flex: 1 },
  detailValue: { fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' },
  detailValueAccent: { fontWeight: '800' },
  lineItemsTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  lineItemName: { fontSize: 13, flex: 1, marginRight: 12 },
  lineItemAmount: { fontSize: 13, fontWeight: '700' },
  downloadBtn: {
    marginTop: 20,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  downloadBtnText: { fontWeight: '700', fontSize: 15 },
  closeBtn: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: { fontWeight: '700', fontSize: 15 },
});
