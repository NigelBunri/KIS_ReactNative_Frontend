/**
 * AdminContentPanel — platform-wide content moderation for KCAN admin.
 * Shows flagged posts, statuses, channels with one-tap action controls.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import type { ContentFlag, ContentSummary, ContentAction } from '@/screens/tabs/partners/useAdminContentPanel';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  flags: ContentFlag[];
  summary: ContentSummary | null;
  loading: boolean;
  actionLoading: string | null;
  error: string | null;
  totalPages: number;
  page: number;
  onLoadPage: (p: number) => void;
  onTakeAction: (flagId: string, action: ContentAction, notes?: string) => Promise<{ success: boolean; message?: string }>;
  onClose: () => void;
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#C0392B',
  high: '#E74C3C',
  medium: '#E67E22',
  low: '#F1C40F',
};

export default function AdminContentPanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  flags,
  summary,
  loading,
  actionLoading,
  error,
  totalPages,
  page,
  onLoadPage,
  onTakeAction,
  onClose,
}: Props) {
  const { palette } = useKISTheme();

  if (!isOpen) return null;

  const handleAction = (flag: ContentFlag) => {
    Alert.alert(
      `Moderate ${flag.target_type}`,
      `Severity: ${flag.severity.toUpperCase()}\nReporter: ${flag.reporter_email ?? 'System'}\nReason: ${flag.reason || 'No reason given'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Dismiss', onPress: () => void onTakeAction(flag.id, 'dismiss') },
        { text: 'Warn creator', onPress: () => void onTakeAction(flag.id, 'warn') },
        { text: 'Restrict creator', onPress: () => void onTakeAction(flag.id, 'restrict') },
        {
          text: 'Takedown content',
          style: 'destructive',
          onPress: () => void onTakeAction(flag.id, 'takedown'),
        },
        {
          text: 'Suspend creator',
          style: 'destructive',
          onPress: () => void onTakeAction(flag.id, 'suspend'),
        },
        {
          text: 'Ban creator',
          style: 'destructive',
          onPress: () => void onTakeAction(flag.id, 'ban'),
        },
      ],
    );
  };

  return (
    <Animated.View
      style={[
        styles.panel,
        {
          width: panelWidth,
          backgroundColor: palette.surface ?? palette.bg,
          borderLeftColor: palette.border,
          transform: [{ translateX: panelTranslateX }],
        },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Content Moderation</Text>
        <Pressable onPress={onClose}>
          <Text style={{ color: palette.subtext, fontSize: 20 }}>✕</Text>
        </Pressable>
      </View>

      {/* Summary tiles */}
      {summary && (
        <View style={[styles.summaryRow, { borderBottomColor: palette.border }]}>
          <SummaryTile
            label="Pending"
            value={summary.total_pending}
            palette={palette}
          />
          <SummaryTile
            label="Critical"
            value={summary.total_critical}
            palette={palette}
            color={palette.danger ?? '#C0392B'}
          />
          <SummaryTile
            label="Actioned Today"
            value={summary.actioned_today}
            palette={palette}
            color={palette.success ?? '#27AE60'}
          />
        </View>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={[styles.pageRow, { borderBottomColor: palette.border }]}>
          <Text style={[styles.pageInfo, { color: palette.subtext }]}>
            Page {page} / {totalPages}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {page > 1 && (
              <Pressable onPress={() => onLoadPage(page - 1)}>
                <Text style={[styles.pageBtn, { color: palette.primary }]}>← Prev</Text>
              </Pressable>
            )}
            {page < totalPages && (
              <Pressable onPress={() => onLoadPage(page + 1)}>
                <Text style={[styles.pageBtn, { color: palette.primary }]}>Next →</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={palette.primary} /></View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={[styles.errorText, { color: palette.danger ?? '#d9534f' }]}>{error}</Text>
        </View>
      ) : flags.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 32 }}>✅</Text>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No pending flags. Queue is clear.</Text>
        </View>
      ) : (
        <FlatList
          data={flags}
          keyExtractor={f => f.id}
          renderItem={({ item }) => (
            <FlagRow
              flag={item}
              palette={palette}
              isActioning={actionLoading === item.id}
              onAction={() => handleAction(item)}
            />
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: palette.border + '55' }} />}
        />
      )}
    </Animated.View>
  );
}

function SummaryTile({ label, value, palette, color }: any) {
  return (
    <View style={[styles.summaryTile, { borderColor: palette.border }]}>
      <Text style={[styles.summaryValue, { color: color ?? palette.text }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: palette.subtext }]}>{label}</Text>
    </View>
  );
}

function FlagRow({ flag, palette, isActioning, onAction }: any) {
  const sevColor = SEVERITY_COLORS[flag.severity] ?? palette.subtext;
  return (
    <View style={styles.flagRow}>
      <View style={[styles.severityBar, { backgroundColor: sevColor }]} />
      <View style={styles.flagBody}>
        <View style={styles.flagHeader}>
          <Text style={[styles.flagType, { color: palette.text }]}>
            {flag.target_type.toUpperCase()}
          </Text>
          <View style={[styles.severityPill, { backgroundColor: sevColor + '22', borderColor: sevColor }]}>
            <Text style={[styles.severityText, { color: sevColor }]}>{flag.severity}</Text>
          </View>
          {flag.ai_score != null && (
            <Text style={[styles.aiScore, { color: palette.subtext }]}>
              AI: {Math.round(flag.ai_score * 100)}%
            </Text>
          )}
        </View>
        {!!flag.reason && (
          <Text style={[styles.flagReason, { color: palette.subtext }]} numberOfLines={2}>
            {flag.reason}
          </Text>
        )}
        <Text style={[styles.flagMeta, { color: palette.subtext }]}>
          Reporter: {flag.reporter_email ?? 'System'} · {flag.created_at ? new Date(flag.created_at).toLocaleDateString() : '—'}
        </Text>
      </View>
      <Pressable
        onPress={onAction}
        disabled={isActioning}
        style={[styles.actionBtn, { backgroundColor: palette.primary }]}
      >
        {isActioning
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.actionBtnText}>Act</Text>
        }
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0,
    borderLeftWidth: 1,
    zIndex: 130,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '900' },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
  },
  summaryTile: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
  },
  summaryValue: { fontSize: 18, fontWeight: '900' },
  summaryLabel: { fontSize: 10, marginTop: 2 },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  pageInfo: { fontSize: 11 },
  pageBtn: { fontSize: 12, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 60 },
  emptyText: { fontSize: 14 },
  errorBox: { padding: 16 },
  errorText: { fontSize: 13 },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  severityBar: { width: 4, height: 50, borderRadius: 2 },
  flagBody: { flex: 1 },
  flagHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flagType: { fontSize: 12, fontWeight: '800' },
  severityPill: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  severityText: { fontSize: 10, fontWeight: '700' },
  aiScore: { fontSize: 10 },
  flagReason: { fontSize: 12, marginTop: 2 },
  flagMeta: { fontSize: 10, marginTop: 3 },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 48,
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
