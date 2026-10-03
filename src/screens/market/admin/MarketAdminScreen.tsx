// src/screens/market/admin/MarketAdminScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type RefreshControlProps,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout, type ResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';
import { useAuth } from '../../../../App';

type TabKey = 'shops' | 'verifications' | 'products' | 'complaints';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'shops', label: 'Shops' },
  { key: 'verifications', label: 'Verifications' },
  { key: 'products', label: 'Products' },
  { key: 'complaints', label: 'Complaints' },
];

// Every ModelViewSet list here may or may not be DRF-paginated depending on
// global settings; MarketplaceComplaintViewSet.list() deliberately returns
// a bare array (see its override in views.py). Handle both shapes rather
// than assuming one.
function extractList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export default function MarketAdminScreen() {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth() as { user?: any };

  const [tab, setTab] = useState<TabKey>('shops');
  const styles = createStyles(palette, responsive);

  const isStaff = Boolean(user?.is_staff || user?.is_superuser || user?.is_admin);

  if (!isStaff) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={['top']}>
        <View style={styles.centered}>
          <KISIcon name="lock-closed" size={32} color={palette.subtext} />
          <Text style={[styles.deniedText, { color: palette.subtext }]}>
            Staff access required.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={12}>
          <KISIcon name="arrow-back" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Market Admin</Text>
        <View style={{ width: responsive.minTouchTarget }} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { borderBottomColor: palette.divider, backgroundColor: palette.surface }]}
        contentContainerStyle={{ paddingHorizontal: responsive.pageGutter }}
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[
                styles.tabChip,
                active && { backgroundColor: palette.primaryStrong ?? palette.primary },
              ]}
            >
              <Text style={[styles.tabChipText, { color: active ? palette.onPrimary : palette.subtext }]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {tab === 'shops' ? <ShopsTab palette={palette} responsive={responsive} insets={insets} /> : null}
      {tab === 'verifications' ? <VerificationsTab palette={palette} responsive={responsive} insets={insets} /> : null}
      {tab === 'products' ? <ProductsTab palette={palette} responsive={responsive} insets={insets} /> : null}
      {tab === 'complaints' ? <ComplaintsTab palette={palette} responsive={responsive} insets={insets} /> : null}
    </SafeAreaView>
  );
}

type TabProps = { palette: any; responsive: ResponsiveLayout; insets: { bottom: number } };

// ---------------------------------------------------------------------------
// Shops — read-only. ShopViewSet.get_queryset() gives staff every shop
// (active or not); ShopSerializer is fields='__all__' and carries payout/
// financial columns (stripe_account_id, flutterwave_subaccount_id, etc.) -
// deliberately not rendered here even though staff are authorized to see
// them, since a moderation list has no need to surface them.
// ---------------------------------------------------------------------------
function ShopsTab({ palette, responsive, insets }: TabProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    if (opts?.refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.commerce.shops, { errorMessage: 'Failed to load shops.' });
      if (res.success) setItems(extractList(res.data));
      else setError(res.message ?? 'Failed to load shops.');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load shops.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const styles = rowStyles(palette);
  return (
    <ListBody
      loading={loading} error={error} onRetry={() => void load()}
      data={items} keyExtractor={(item) => String(item.id)} emptyLabel="No shops found."
      insets={insets}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load({ refresh: true })} tintColor={palette.primaryStrong} colors={[palette.primaryStrong]} />}
      renderItem={(item) => (
        <View style={styles.row}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{item.name ?? 'Unnamed shop'}</Text>
          <View style={styles.metaRow}>
            <StatusPill palette={palette} label={String(item.verification_status ?? 'unknown')} />
            <StatusPill palette={palette} label={String(item.status ?? 'unknown')} />
          </View>
          <Text style={[styles.subtitle, { color: palette.subtext }]} numberOfLines={1}>
            Owner: {item.owner_display_name ?? item.owner?.username ?? item.owner ?? '—'}
          </Text>
        </View>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Verifications — actionable. ShopVerificationRequestViewSet is already
// IsAdminUser-only and exposes a real review action (approve/reject) - this
// tab drives that exact endpoint, nothing invented.
// ---------------------------------------------------------------------------
function VerificationsTab({ palette, responsive, insets }: TabProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    if (opts?.refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.commerce.shopVerifications, { errorMessage: 'Failed to load verification requests.' });
      if (res.success) setItems(extractList(res.data));
      else setError(res.message ?? 'Failed to load verification requests.');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load verification requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const review = useCallback((item: any, action: 'approve' | 'reject') => {
    Alert.alert(
      action === 'approve' ? 'Approve verification' : 'Reject verification',
      `${action === 'approve' ? 'Approve' : 'Reject'} this shop's verification request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'approve' ? 'Approve' : 'Reject',
          style: action === 'reject' ? 'destructive' : 'default',
          onPress: async () => {
            setActioningId(item.id);
            try {
              const res = await postRequest(
                ROUTES.commerce.shopVerificationReview(item.id),
                { action },
                { errorMessage: 'Unable to review this request.' },
              );
              if (res.success) {
                setItems((prev) => prev.map((r) => (r.id === item.id ? { ...r, status: action === 'approve' ? 'APPROVED' : 'REJECTED' } : r)));
              } else {
                Alert.alert('Review', res.message ?? 'Unable to review this request.');
              }
            } catch (err: any) {
              Alert.alert('Review', err?.message ?? 'Unable to review this request.');
            } finally {
              setActioningId(null);
            }
          },
        },
      ],
    );
  }, []);

  const styles = rowStyles(palette);
  return (
    <ListBody
      loading={loading} error={error} onRetry={() => void load()}
      data={items} keyExtractor={(item) => String(item.id)} emptyLabel="No verification requests."
      insets={insets}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load({ refresh: true })} tintColor={palette.primaryStrong} colors={[palette.primaryStrong]} />}
      renderItem={(item) => (
        <View style={styles.row}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>Shop {item.shop ?? item.shop_id ?? item.id}</Text>
          <StatusPill palette={palette} label={String(item.status ?? 'pending')} />
          {String(item.status ?? '').toUpperCase() === 'PENDING' ? (
            actioningId === item.id ? (
              <ActivityIndicator size="small" color={palette.primaryStrong ?? palette.primary} style={{ marginTop: 8 }} />
            ) : (
              <View style={styles.actions}>
                <ActionButton label="Approve" color={palette.success} onPress={() => review(item, 'approve')} />
                <ActionButton label="Reject" color={palette.danger} onPress={() => review(item, 'reject')} />
              </View>
            )
          ) : null}
        </View>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Products — actionable toggle-active only. ProductViewSet.get_object()
// lets staff fetch/modify any product regardless of shop ownership, so a
// plain PATCH {is_active} is a real, already-supported endpoint.
// ---------------------------------------------------------------------------
function ProductsTab({ palette, responsive, insets }: TabProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    if (opts?.refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.commerce.products, { errorMessage: 'Failed to load products.' });
      if (res.success) setItems(extractList(res.data));
      else setError(res.message ?? 'Failed to load products.');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load products.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleActive = useCallback(async (item: any) => {
    setActioningId(item.id);
    try {
      const res = await patchRequest(
        ROUTES.commerce.product(item.id),
        { is_active: !item.is_active },
        { errorMessage: 'Unable to update this product.' },
      );
      if (res.success) {
        setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, is_active: !item.is_active } : p)));
      } else {
        Alert.alert('Update product', res.message ?? 'Unable to update this product.');
      }
    } catch (err: any) {
      Alert.alert('Update product', err?.message ?? 'Unable to update this product.');
    } finally {
      setActioningId(null);
    }
  }, []);

  const styles = rowStyles(palette);
  return (
    <ListBody
      loading={loading} error={error} onRetry={() => void load()}
      data={items} keyExtractor={(item) => String(item.id)} emptyLabel="No products found."
      insets={insets}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load({ refresh: true })} tintColor={palette.primaryStrong} colors={[palette.primaryStrong]} />}
      renderItem={(item) => (
        <View style={styles.row}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{item.name ?? 'Unnamed product'}</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]} numberOfLines={1}>
            {item.shop_name ?? item.shop?.name ?? item.shop ?? '—'} · {item.currency ?? ''} {item.price ?? ''}
          </Text>
          <View style={styles.actions}>
            <StatusPill palette={palette} label={item.is_active ? 'active' : 'inactive'} />
            {actioningId === item.id ? (
              <ActivityIndicator size="small" color={palette.primaryStrong ?? palette.primary} />
            ) : (
              <ActionButton
                label={item.is_active ? 'Deactivate' : 'Activate'}
                color={item.is_active ? palette.danger : palette.success}
                onPress={() => void toggleActive(item)}
              />
            )}
          </View>
        </View>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Complaints — actionable. MarketplaceComplaintViewSet.get_queryset() now
// has an is_staff branch giving global visibility, and /review/ + /resolve/
// actions exist (see views.py's _dispatch_resolution) - this tab drives
// those exact endpoints, same as the Verifications tab does for its own.
// ---------------------------------------------------------------------------
function ComplaintsTab({ palette, responsive, insets }: TabProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    if (opts?.refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.commerce.marketplaceComplaints, { errorMessage: 'Failed to load complaints.' });
      if (res.success) setItems(extractList(res.data));
      else setError(res.message ?? 'Failed to load complaints.');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load complaints.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = useCallback((item: any, action: 'review' | 'resolve') => {
    const label = action === 'review' ? 'Mark reviewed' : 'Mark resolved';
    Alert.alert(label, `${label} this complaint on order ${item.order}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: label,
        onPress: async () => {
          setActioningId(item.id);
          try {
            const url = action === 'review'
              ? ROUTES.commerce.marketplaceComplaintReview(item.id)
              : ROUTES.commerce.marketplaceComplaintResolve(item.id);
            const res = await postRequest(url, {}, { errorMessage: `Unable to ${action} this complaint.` });
            if (res.success) {
              setItems((prev) => prev.map((c) => (c.id === item.id ? { ...c, status: action === 'review' ? 'reviewed' : 'resolved' } : c)));
            } else {
              Alert.alert(label, res.message ?? `Unable to ${action} this complaint.`);
            }
          } catch (err: any) {
            Alert.alert(label, err?.message ?? `Unable to ${action} this complaint.`);
          } finally {
            setActioningId(null);
          }
        },
      },
    ]);
  }, []);

  const styles = rowStyles(palette);
  return (
    <ListBody
      loading={loading} error={error} onRetry={() => void load()}
      data={items} keyExtractor={(item) => String(item.id)} emptyLabel="No complaints found."
      insets={insets}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load({ refresh: true })} tintColor={palette.primaryStrong} colors={[palette.primaryStrong]} />}
      renderItem={(item) => {
        const status = String(item.status ?? 'pending').toLowerCase();
        return (
          <View style={styles.row}>
            <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>{item.text}</Text>
            <View style={styles.metaRow}>
              <StatusPill palette={palette} label={status} />
              <Text style={[styles.subtitle, { color: palette.subtext }]}>Order {item.order}</Text>
            </View>
            {actioningId === item.id ? (
              <ActivityIndicator size="small" color={palette.primaryStrong ?? palette.primary} style={{ marginTop: 8 }} />
            ) : status === 'pending' ? (
              <View style={styles.actions}>
                <ActionButton label="Mark reviewed" color={palette.primaryStrong ?? palette.primary} onPress={() => act(item, 'review')} />
                <ActionButton label="Resolve" color={palette.success} onPress={() => act(item, 'resolve')} />
              </View>
            ) : status === 'reviewed' ? (
              <View style={styles.actions}>
                <ActionButton label="Resolve" color={palette.success} onPress={() => act(item, 'resolve')} />
              </View>
            ) : null}
          </View>
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------
function ListBody({
  loading, error, onRetry, data, keyExtractor, renderItem, emptyLabel, insets, refreshControl,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  data: any[];
  keyExtractor: (item: any) => string;
  renderItem: (item: any) => React.ReactElement;
  emptyLabel: string;
  insets: { bottom: number };
  refreshControl: React.ReactElement<RefreshControlProps>;
}) {
  const { palette } = useKISTheme();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.primaryStrong ?? palette.primary} size="large" />
      </View>
    );
  }
  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <Text style={{ color: palette.danger, textAlign: 'center' }}>{error}</Text>
        <Pressable onPress={onRetry} style={{ borderWidth: 1, borderColor: palette.primaryStrong ?? palette.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: palette.primaryStrong ?? palette.primary, fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={({ item }) => renderItem(item)}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: 16, paddingTop: 12 }}
      refreshControl={refreshControl}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListEmptyComponent={() => (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Text style={{ color: palette.subtext }}>{emptyLabel}</Text>
        </View>
      )}
    />
  );
}

function StatusPill({ palette, label }: { palette: any; label: string }) {
  const normalized = label.toLowerCase();
  const color =
    ['approved', 'active', 'verified', 'resolved'].includes(normalized) ? palette.success :
    ['rejected', 'inactive', 'banned'].includes(normalized) ? palette.danger :
    palette.warning ?? palette.subtext;
  return (
    <View style={{ borderRadius: 6, borderWidth: 1, borderColor: color, backgroundColor: color + '18', paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ color, fontSize: 10, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function ActionButton({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 12, paddingVertical: 6, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: color, backgroundColor: color + '18' }}>
      <Text style={{ color, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

function rowStyles(palette: any) {
  return StyleSheet.create({
    row: { backgroundColor: palette.surface, borderRadius: 12, padding: 12, gap: 6 },
    title: { fontSize: 14, fontWeight: '700' },
    subtitle: { fontSize: 11 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  });
}

function createStyles(palette: any, responsive: ResponsiveLayout) {
  const gutter = responsive.pageGutter;
  return StyleSheet.create({
    safeArea: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: gutter,
      paddingVertical: 14,
      minHeight: responsive.minTouchTarget,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backButton: { width: responsive.minTouchTarget, minHeight: responsive.minTouchTarget, alignItems: 'flex-start', justifyContent: 'center' },
    headerTitle: { fontSize: responsive.bodyFontSize + 2, fontWeight: '700' },
    tabBar: { borderBottomWidth: StyleSheet.hairlineWidth, flexGrow: 0 },
    tabChip: { paddingHorizontal: 14, paddingVertical: 8, marginVertical: 8, marginRight: 8, borderRadius: 999, minHeight: 36, justifyContent: 'center' },
    tabChipText: { fontSize: responsive.labelFontSize, fontWeight: '700' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    deniedText: { fontSize: responsive.bodyFontSize },
  });
}
