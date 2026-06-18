import React, { useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import type { AuditEntry } from '@/screens/tabs/partners/useAdminAuditTrailPanel';

const SEVERITY_COLORS: Record<string, string> = {
  INFO: '#4caf50',
  WARNING: '#f39c12',
  ERROR: '#e74c3c',
  CRITICAL: '#c0392b',
};

const SEVERITY_FILTERS = ['', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  entries: AuditEntry[];
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  severityFilter: string;
  actionFilter?: string;
  onFilterSeverity: (s: string) => void;
  onFilterAction?: (a: string) => void;
  onLoadPage: (p: number) => void;
  onClose: () => void;
};

export default function AdminAuditTrailPanel({
  isOpen, panelWidth, panelTranslateX,
  entries, loading, error,
  page, totalPages, severityFilter, actionFilter = '',
  onFilterSeverity, onFilterAction, onLoadPage, onClose,
}: Props) {
  const { palette } = useKISTheme();
  const [localAction, setLocalAction] = useState(actionFilter);
  if (!isOpen) return null;

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
          <Text style={[styles.headerTitle, { color: palette.text }]}>Audit Trail</Text>
          <Text style={[styles.headerSub, { color: palette.subtext }]}>Immutable log of all admin actions</Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={{ color: palette.subtext, fontSize: 20, lineHeight: 22 }}>✕</Text>
        </Pressable>
      </View>

      {/* Severity filter chips */}
      <View style={[styles.filterRow, { borderBottomColor: palette.border }]}>
        {SEVERITY_FILTERS.map(sev => {
          const active = severityFilter === sev;
          const color = sev ? SEVERITY_COLORS[sev] ?? palette.primary : palette.primary;
          return (
            <Pressable
              key={sev || 'all'}
              onPress={() => onFilterSeverity(sev)}
              style={[styles.chip, {
                backgroundColor: active ? color + '22' : 'transparent',
                borderColor: active ? color : palette.border,
              }]}
            >
              <Text style={[styles.chipText, { color: active ? color : palette.subtext }]}>
                {sev || 'All'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Action type filter input */}
      {onFilterAction && (
        <View style={[styles.actionFilterRow, { borderBottomColor: palette.border }]}>
          <TextInput
            value={localAction}
            onChangeText={setLocalAction}
            onSubmitEditing={() => onFilterAction(localAction)}
            placeholder="Filter by action type (e.g. USER_BAN)"
            placeholderTextColor={palette.subtext}
            style={[styles.actionFilterInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card ?? palette.surface }]}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {localAction.length > 0 && (
            <Pressable onPress={() => { setLocalAction(''); onFilterAction(''); }}>
              <Text style={{ color: palette.subtext, paddingHorizontal: 8, fontSize: 14 }}>Clear</Text>
            </Pressable>
          )}
        </View>
      )}

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      )}
      {!!error && !loading && (
        <View style={[styles.errorBox, { backgroundColor: (palette.danger) + '22', borderColor: palette.danger }]}>
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
        </View>
      )}

      {!loading && (
        <FlatList
          data={entries}
          keyExtractor={e => e.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: palette.subtext }]}>No audit entries found.</Text>
          }
          renderItem={({ item }) => {
            const sevColor = SEVERITY_COLORS[item.severity] ?? '#888';
            return (
              <View style={[styles.entry, { borderBottomColor: palette.border }]}>
                <View style={styles.entryLeft}>
                  <View style={[styles.sevDot, { backgroundColor: sevColor }]} />
                </View>
                <View style={styles.entryBody}>
                  <View style={styles.entryHeader}>
                    <Text style={[styles.entryAction, { color: palette.text }]}>{item.action_type}</Text>
                    <Text style={[styles.entryTime, { color: palette.subtext }]}>
                      {new Date(item.created_at).toLocaleString()}
                    </Text>
                  </View>
                  {(item.target_model || item.target_pk) && (
                    <Text style={[styles.entryTarget, { color: palette.subtext }]}>
                      {[item.target_app, item.target_model, item.target_pk].filter(Boolean).join(' › ')}
                    </Text>
                  )}
                  {item.actor_email && (
                    <Text style={[styles.entryActor, { color: palette.subtext }]}>{item.actor_email}</Text>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

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

const styles = StyleSheet.create({
  panel: { position: 'absolute', top: 0, right: 0, bottom: 0, borderLeftWidth: 1, zIndex: 122, shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '900' },
  headerSub: { fontSize: 12, marginTop: 2 },
  closeBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  filterRow: { flexDirection: 'row', padding: 12, gap: 6, borderBottomWidth: 1, flexWrap: 'wrap' },
  actionFilterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, gap: 8 },
  actionFilterInput: { flex: 1, height: 36, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, fontSize: 12 },
  chip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  chipText: { fontSize: 12, fontWeight: '600' },
  centered: { padding: 40, alignItems: 'center' },
  errorBox: { borderRadius: 8, borderWidth: 1, padding: 12, margin: 16 },
  errorText: { fontSize: 13, fontWeight: '600' },
  listContent: { paddingBottom: 20 },
  emptyText: { textAlign: 'center', padding: 40, fontSize: 14 },
  entry: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, gap: 10 },
  entryLeft: { paddingTop: 5 },
  sevDot: { width: 8, height: 8, borderRadius: 4 },
  entryBody: { flex: 1 },
  entryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  entryAction: { fontSize: 13, fontWeight: '700', flex: 1 },
  entryTime: { fontSize: 10 },
  entryTarget: { fontSize: 11, marginTop: 1 },
  entryActor: { fontSize: 10, marginTop: 1 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderTopWidth: 1 },
  pageBtn: { padding: 8 },
  pageInfo: { fontSize: 13 },
});
