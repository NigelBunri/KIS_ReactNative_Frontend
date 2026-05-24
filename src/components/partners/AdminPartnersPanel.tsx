import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import type { AdminPartner, AdminPartnerStats } from '@/screens/tabs/partners/useAdminPartnersPanel';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partners: AdminPartner[];
  stats: AdminPartnerStats | null;
  loading: boolean;
  actionLoading: string | null;
  error: string | null;
  query: string;
  page: number;
  totalPages: number;
  onSearch: (q: string) => void;
  onSetActive: (id: string, active: boolean) => Promise<boolean>;
  onLoadPage: (p: number) => void;
  onClose: () => void;
};

export default function AdminPartnersPanel({
  isOpen, panelWidth, panelTranslateX,
  partners, stats, loading, actionLoading, error,
  query, page, totalPages,
  onSearch, onSetActive, onLoadPage, onClose,
}: Props) {
  const { palette } = useKISTheme();
  const [localQuery, setLocalQuery] = useState(query);

  if (!isOpen) return null;

  const confirmToggle = (partner: AdminPartner) => {
    const action = partner.is_active ? 'Deactivate' : 'Activate';
    Alert.alert(`${action} Partner`, `${action} "${partner.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action,
        style: partner.is_active ? 'destructive' : 'default',
        onPress: () => void onSetActive(partner.id, !partner.is_active),
      },
    ]);
  };

  return (
    <Animated.View
      style={[styles.panel, {
        width: panelWidth,
        backgroundColor: palette.surface ?? palette.bg,
        borderLeftColor: palette.border,
        transform: [{ translateX: panelTranslateX }],
      }]}
    >
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Partner Organisations</Text>
          <Text style={[styles.headerSub, { color: palette.subtext }]}>View and manage all partner accounts</Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={{ color: palette.subtext, fontSize: 20, lineHeight: 22 }}>✕</Text>
        </Pressable>
      </View>

      {/* Stats row */}
      {stats && (
        <View style={[styles.statsRow, { borderBottomColor: palette.border }]}>
          <StatBadge label="Total" value={stats.total_partners} palette={palette} />
          <StatBadge label="Active" value={stats.active_partners} palette={palette} />
          <StatBadge label="Verified" value={stats.verified_partners} palette={palette} />
          <StatBadge label="New 30d" value={stats.new_30d} palette={palette} />
        </View>
      )}

      {/* Search */}
      <View style={[styles.searchRow, { borderBottomColor: palette.border }]}>
        <TextInput
          value={localQuery}
          onChangeText={setLocalQuery}
          onSubmitEditing={() => onSearch(localQuery)}
          placeholder="Search partners…"
          placeholderTextColor={palette.subtext}
          style={[styles.searchInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card ?? palette.surface }]}
          returnKeyType="search"
        />
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      )}
      {!!error && !loading && (
        <View style={[styles.errorBox, { backgroundColor: (palette.danger ?? '#d9534f') + '22', borderColor: palette.danger ?? '#d9534f' }]}>
          <Text style={[styles.errorText, { color: palette.danger ?? '#d9534f' }]}>{error}</Text>
        </View>
      )}

      {!loading && (
        <FlatList
          data={partners}
          keyExtractor={p => p.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: palette.subtext }]}>No partners found.</Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.row, { borderBottomColor: palette.border }]}>
              <View style={styles.rowLeft}>
                <Text style={[styles.rowName, { color: palette.text }]}>{item.name}</Text>
                <Text style={[styles.rowMeta, { color: palette.subtext }]}>
                  {item.tier} · {item.member_count} members · {item.country ?? '—'}
                </Text>
                {item.owner_email && (
                  <Text style={[styles.rowMeta, { color: palette.subtext }]}>{item.owner_email}</Text>
                )}
              </View>
              <View style={styles.rowRight}>
                <View style={[styles.pill, { backgroundColor: item.is_active ? '#4caf5022' : '#e74c3c22' }]}>
                  <Text style={[styles.pillText, { color: item.is_active ? '#4caf50' : '#e74c3c' }]}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
                {item.is_verified && (
                  <View style={[styles.pill, { backgroundColor: (palette.primary) + '22' }]}>
                    <Text style={[styles.pillText, { color: palette.primary }]}>✓ Verified</Text>
                  </View>
                )}
                <Pressable
                  onPress={() => confirmToggle(item)}
                  disabled={actionLoading === item.id}
                  style={[styles.actionBtn, { borderColor: palette.border }]}
                >
                  {actionLoading === item.id
                    ? <ActivityIndicator size="small" color={palette.primary} />
                    : <Text style={[styles.actionBtnText, { color: item.is_active ? palette.danger ?? '#e74c3c' : '#4caf50' }]}>
                        {item.is_active ? 'Deactivate' : 'Activate'}
                      </Text>
                  }
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={[styles.pagination, { borderTopColor: palette.border }]}>
          <Pressable onPress={() => onLoadPage(page - 1)} disabled={page <= 1} style={styles.pageBtn}>
            <Text style={{ color: page <= 1 ? palette.subtext : palette.primary }}>‹ Prev</Text>
          </Pressable>
          <Text style={[styles.pageInfo, { color: palette.subtext }]}>Page {page} of {totalPages}</Text>
          <Pressable onPress={() => onLoadPage(page + 1)} disabled={page >= totalPages} style={styles.pageBtn}>
            <Text style={{ color: page >= totalPages ? palette.subtext : palette.primary }}>Next ›</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

function StatBadge({ label, value, palette }: { label: string; value: number; palette: any }) {
  return (
    <View style={[styles.statBadge, { backgroundColor: palette.card ?? palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.statValue, { color: palette.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: palette.subtext }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', top: 0, right: 0, bottom: 0, borderLeftWidth: 1, zIndex: 122, shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '900' },
  headerSub: { fontSize: 12, marginTop: 2 },
  closeBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  statsRow: { flexDirection: 'row', padding: 12, gap: 8, borderBottomWidth: 1 },
  statBadge: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 10, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 10, marginTop: 2 },
  searchRow: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchInput: { height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14 },
  centered: { padding: 40, alignItems: 'center' },
  errorBox: { borderRadius: 8, borderWidth: 1, padding: 12, margin: 16 },
  errorText: { fontSize: 13, fontWeight: '600' },
  listContent: { paddingBottom: 20 },
  emptyText: { textAlign: 'center', padding: 40, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  rowLeft: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '700' },
  rowMeta: { fontSize: 11, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pillText: { fontSize: 10, fontWeight: '700' },
  actionBtn: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, marginTop: 2 },
  actionBtnText: { fontSize: 11, fontWeight: '700' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderTopWidth: 1 },
  pageBtn: { padding: 8 },
  pageInfo: { fontSize: 13 },
});
