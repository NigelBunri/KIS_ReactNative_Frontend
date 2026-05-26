import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import type { VerificationCase, VerificationSummary, SuspiciousSignal } from '@/screens/tabs/partners/useAdminVerificationPanel';

const ACTIONS: { key: 'dismiss' | 'warn' | 'restrict' | 'takedown' | 'ban'; label: string; color: string }[] = [
  { key: 'dismiss', label: 'Dismiss', color: '#888' },
  { key: 'warn', label: 'Warn', color: '#f39c12' },
  { key: 'restrict', label: 'Restrict', color: '#e67e22' },
  { key: 'takedown', label: 'Takedown', color: '#e74c3c' },
  { key: 'ban', label: 'Ban', color: '#c0392b' },
];

const SEVERITY_COLOR: Record<string, string> = {
  LOW: '#4caf50',
  MEDIUM: '#f39c12',
  HIGH: '#e74c3c',
  CRITICAL: '#c0392b',
};

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  cases: VerificationCase[];
  summary: VerificationSummary | null;
  suspiciousSignals?: SuspiciousSignal[];
  loading: boolean;
  actionLoading: string | null;
  error: string | null;
  page: number;
  totalPages: number;
  onTakeAction: (id: string, action: 'dismiss' | 'warn' | 'restrict' | 'takedown' | 'ban', notes?: string) => Promise<boolean>;
  onApproveBadge?: (userId: string, badgeType: string) => Promise<boolean>;
  onRejectCase?: (caseId: string, notes?: string) => Promise<boolean>;
  onLoadPage: (p: number) => void;
  onClose: () => void;
};

export default function AdminVerificationPanel({
  isOpen, panelWidth, panelTranslateX,
  cases, summary, suspiciousSignals = [], loading, actionLoading, error,
  page, totalPages,
  onTakeAction, onApproveBadge, onRejectCase, onLoadPage, onClose,
}: Props) {
  const { palette } = useKISTheme();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAction = (item: VerificationCase, action: typeof ACTIONS[0]) => {
    Alert.alert(
      `${action.label} — ${item.content_type}`,
      `Apply "${action.label}" to this flagged item?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.label,
          style: action.key === 'dismiss' ? 'default' : 'destructive',
          onPress: () => void onTakeAction(item.id, action.key),
        },
      ],
    );
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
          <Text style={[styles.headerTitle, { color: palette.text }]}>Verification Queue</Text>
          <Text style={[styles.headerSub, { color: palette.subtext }]}>Review flagged content and badge requests</Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={{ color: palette.subtext, fontSize: 20, lineHeight: 22 }}>✕</Text>
        </Pressable>
      </View>

      {summary && (
        <View style={[styles.statsRow, { borderBottomColor: palette.border }]}>
          <StatBadge label="Pending" value={summary.total_pending} palette={palette} warn={summary.total_pending > 0} />
          <StatBadge label="Critical" value={summary.total_critical} palette={palette} warn={summary.total_critical > 0} />
          <StatBadge label="Actioned Today" value={summary.actioned_today} palette={palette} />
        </View>
      )}

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
          <Text style={[styles.loadingText, { color: palette.subtext }]}>Loading queue…</Text>
        </View>
      )}
      {!!error && !loading && (
        <View style={[styles.errorBox, { backgroundColor: (palette.danger ?? '#d9534f') + '22', borderColor: palette.danger ?? '#d9534f' }]}>
          <Text style={[styles.errorText, { color: palette.danger ?? '#d9534f' }]}>{error}</Text>
        </View>
      )}

      {!loading && (
        <FlatList
          data={cases}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={[styles.emptyTitle, { color: palette.text }]}>Queue is clear</Text>
              <Text style={[styles.emptyBody, { color: palette.subtext }]}>No pending items to review.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isExpanded = expanded === item.id;
            const sevColor = SEVERITY_COLOR[item.severity] ?? '#888';
            return (
              <View style={[styles.card, { backgroundColor: palette.card ?? palette.surface, borderColor: palette.border }]}>
                <Pressable onPress={() => setExpanded(isExpanded ? null : item.id)} style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.sevPill, { backgroundColor: sevColor + '22' }]}>
                      <Text style={[styles.sevText, { color: sevColor }]}>{item.severity}</Text>
                    </View>
                    <Text style={[styles.cardType, { color: palette.text }]}>{item.content_type}</Text>
                  </View>
                  <Text style={[styles.cardDate, { color: palette.subtext }]}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 16 }}>{isExpanded ? '▲' : '▼'}</Text>
                </Pressable>

                {item.content_preview && (
                  <Text style={[styles.preview, { color: palette.subtext }]} numberOfLines={isExpanded ? undefined : 2}>
                    {item.content_preview}
                  </Text>
                )}

                {isExpanded && (
                  <>
                    {/* Approve / Reject quick actions */}
                    <View style={[styles.actionsRow, { marginBottom: 4 }]}>
                      {onApproveBadge && (
                        <Pressable
                          onPress={() => {
                            Alert.alert(
                              'Approve & Issue Badge',
                              'Issue a verified badge to this user?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Issue Badge',
                                  onPress: () => void onApproveBadge(item.content_id, item.flag_type),
                                },
                              ],
                            );
                          }}
                          disabled={actionLoading === item.id}
                          style={[styles.actionBtn, { borderColor: '#4caf5088', backgroundColor: '#4caf5011' }]}
                        >
                          {actionLoading === item.id
                            ? <ActivityIndicator size="small" color="#4caf50" />
                            : <Text style={[styles.actionBtnText, { color: '#4caf50' }]}>Approve</Text>
                          }
                        </Pressable>
                      )}
                      {onRejectCase && (
                        <Pressable
                          onPress={() => void onRejectCase(item.id)}
                          disabled={actionLoading === item.id}
                          style={[styles.actionBtn, { borderColor: '#e74c3c88', backgroundColor: '#e74c3c11' }]}
                        >
                          <Text style={[styles.actionBtnText, { color: '#e74c3c' }]}>Reject</Text>
                        </Pressable>
                      )}
                    </View>
                    {/* Extended moderation actions */}
                    <View style={styles.actionsRow}>
                      {ACTIONS.map(a => (
                        <Pressable
                          key={a.key}
                          onPress={() => handleAction(item, a)}
                          disabled={actionLoading === item.id}
                          style={[styles.actionBtn, { borderColor: a.color + '88' }]}
                        >
                          {actionLoading === item.id
                            ? <ActivityIndicator size="small" color={a.color} />
                            : <Text style={[styles.actionBtnText, { color: a.color }]}>{a.label}</Text>
                          }
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
              </View>
            );
          }}
        />
      )}

      {!loading && suspiciousSignals.length > 0 && (
        <View style={[styles.signalsSection, { borderTopColor: palette.border }]}>
          <Text style={[styles.signalsTitle, { color: palette.text }]}>
            Suspicious Signals ({suspiciousSignals.length})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.signalsScroll}>
            {suspiciousSignals.slice(0, 10).map(sig => (
              <View key={sig.id} style={[styles.signalCard, { backgroundColor: (palette.danger ?? '#e74c3c') + '14', borderColor: (palette.danger ?? '#e74c3c') + '44' }]}>
                <Text style={[styles.signalType, { color: palette.danger ?? '#e74c3c' }]}>{sig.signal_type}</Text>
                {sig.detail && (
                  <Text style={[styles.signalDetail, { color: palette.subtext }]} numberOfLines={2}>{sig.detail}</Text>
                )}
                <Text style={[styles.signalDate, { color: palette.subtext }]}>
                  {new Date(sig.created_at).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
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

function StatBadge({ label, value, palette, warn }: { label: string; value: number; palette: any; warn?: boolean }) {
  return (
    <View style={[styles.statBadge, { backgroundColor: palette.card ?? palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.statValue, { color: warn && value > 0 ? palette.danger ?? '#e74c3c' : palette.text }]}>{value}</Text>
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
  centered: { padding: 40, alignItems: 'center' },
  loadingText: { marginTop: 8, fontSize: 13 },
  errorBox: { borderRadius: 8, borderWidth: 1, padding: 12, margin: 16 },
  errorText: { fontSize: 13, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 20 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptyBody: { fontSize: 13 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardHeaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sevPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  sevText: { fontSize: 10, fontWeight: '700' },
  cardType: { fontSize: 13, fontWeight: '700' },
  cardDate: { fontSize: 11 },
  preview: { fontSize: 12, lineHeight: 18, marginBottom: 8 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  actionBtn: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderTopWidth: 1 },
  pageBtn: { padding: 8 },
  pageInfo: { fontSize: 13 },
  signalsSection: { borderTopWidth: 1, paddingVertical: 10 },
  signalsTitle: { fontSize: 12, fontWeight: '800', paddingHorizontal: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  signalsScroll: { paddingLeft: 16 },
  signalCard: { borderRadius: 10, borderWidth: 1, padding: 10, marginRight: 10, width: 160 },
  signalType: { fontSize: 11, fontWeight: '800', marginBottom: 4, textTransform: 'uppercase' },
  signalDetail: { fontSize: 11, lineHeight: 15, marginBottom: 4 },
  signalDate: { fontSize: 10 },
});
