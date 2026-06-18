/**
 * AdminDashboardPanel — KCAN super-admin main dashboard.
 * Renders KPI tiles + sparkline charts + quick navigation to sub-panels.
 * Only visible to users with is_superuser or is_staff viewing the KCAN partner.
 */
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import type { AdminKPIs } from '@/screens/tabs/partners/useAdminDashboardPanel';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  kpis: AdminKPIs;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onOpenUsers: () => void;
  onOpenContent: () => void;
  onOpenAnalytics: () => void;
  onOpenPartners: () => void;
  onOpenVerification: () => void;
  onOpenSystemHealth: () => void;
  onOpenAuditTrail: () => void;
  onOpenBibleAdmin: () => void;
  onOpenKISAppAdmin: () => void;
  onRefresh: () => void;
};

export default function AdminDashboardPanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  kpis,
  loading,
  error,
  onClose,
  onOpenUsers,
  onOpenContent,
  onOpenAnalytics,
  onOpenPartners,
  onOpenVerification,
  onOpenSystemHealth,
  onOpenAuditTrail,
  onOpenBibleAdmin,
  onOpenKISAppAdmin,
  onRefresh,
}: Props) {
  const { palette } = useKISTheme();

  if (!isOpen) return null;

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
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>KCAN Admin Hub</Text>
          <Text style={[styles.headerSub, { color: palette.subtext }]}>
            Platform overview · General Overseer dashboard
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={onRefresh} style={[styles.refreshBtn, { borderColor: palette.border }]}>
            <Text style={{ color: palette.primaryStrong ?? palette.primary, fontWeight: '700', fontSize: 12 }}>
              Refresh
            </Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={{ color: palette.subtext, fontSize: 20, lineHeight: 22 }}>✕</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator color={palette.primary} size="large" />
            <Text style={[styles.loadingText, { color: palette.subtext }]}>Loading platform data…</Text>
          </View>
        )}

        {!!error && !loading && (
          <View style={[styles.errorBox, { backgroundColor: palette.danger + '22', borderColor: palette.danger }]}>
            <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          </View>
        )}

        {!loading && (
          <>
            {/* Quick-action tiles */}
            <View style={styles.tileRow}>
              <QuickActionTile
                label="Users"
                icon="👥"
                value={fmtNum(kpis.total_users)}
                sub={`+${fmtNum(kpis.new_users_7d)} this week`}
                palette={palette}
                onPress={onOpenUsers}
              />
              <QuickActionTile
                label="Partners"
                icon="🏢"
                value={fmtNum(kpis.total_partners)}
                sub={`${fmtNum(kpis.active_partners)} active`}
                palette={palette}
                onPress={onOpenPartners}
              />
              <QuickActionTile
                label="Flags"
                icon="⚠️"
                value={fmtNum(kpis.total_pending_flags)}
                sub={`${fmtNum(kpis.total_critical_flags)} critical`}
                palette={palette}
                onPress={onOpenContent}
                highlight={kpis.total_critical_flags > 0}
              />
              <QuickActionTile
                label="Revenue 30d"
                icon="💰"
                value={`$${fmtNum(kpis.revenue_30d_usd)}`}
                sub={`$${fmtNum(kpis.revenue_7d_usd)} this week`}
                palette={palette}
                onPress={onOpenAnalytics}
              />
            </View>

            {/* Secondary stats row */}
            <View style={styles.tileRow}>
              <StatBadge label="Banned Users" value={fmtNum(kpis.banned_users)} palette={palette} warn />
              <StatBadge label="Staff Accounts" value={fmtNum(kpis.staff_count)} palette={palette} />
              <StatBadge label="Moderated Today" value={fmtNum(kpis.actioned_today)} palette={palette} />
              <StatBadge label="Posts (30d)" value={fmtNum(kpis.posts_30d)} palette={palette} />
            </View>

            {/* User growth sparkline */}
            {kpis.growth_series.length > 0 && (
              <ChartSection
                title="User Growth (30d)"
                series={kpis.growth_series.map(d => ({ label: d.date.slice(5), value: d.new_users }))}
                palette={palette}
                color={palette.primary}
              />
            )}

            {/* Navigation cards */}
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Admin Modules</Text>
            <AdminNavCard
              icon="👤"
              title="User Management"
              description="Search, ban, tier-change, review any user account."
              palette={palette}
              onPress={onOpenUsers}
            />
            <AdminNavCard
              icon="🛡️"
              title="Content Moderation"
              description="Review flagged posts, statuses and channels. Issue takedowns and sanctions."
              palette={palette}
              onPress={onOpenContent}
              badge={kpis.total_critical_flags > 0 ? `${kpis.total_critical_flags} critical` : undefined}
            />
            <AdminNavCard
              icon="📊"
              title="Analytics & Insights"
              description="Platform-wide user growth, engagement, revenue and retention charts."
              palette={palette}
              onPress={onOpenAnalytics}
            />
            <AdminNavCard
              icon="🏢"
              title="Partner Organisations"
              description="View, activate, deactivate and audit all partner accounts."
              palette={palette}
              onPress={onOpenPartners}
            />
            <AdminNavCard
              icon="✅"
              title="Verification Queue"
              description="Review pending verification cases and badge requests."
              palette={palette}
              onPress={onOpenVerification}
              badge={kpis.total_pending_flags > 0 ? `${kpis.total_pending_flags} pending` : undefined}
            />
            <AdminNavCard
              icon="⚙️"
              title="System Health"
              description="Live metrics, error rates, performance and monitoring alerts."
              palette={palette}
              onPress={onOpenSystemHealth}
            />
            <AdminNavCard
              icon="📜"
              title="Audit Trail"
              description="Immutable log of all admin actions across the platform."
              palette={palette}
              onPress={onOpenAuditTrail}
            />
            <Text style={[styles.sectionTitle, { color: palette.text, marginTop: 8 }]}>App Management</Text>
            <AdminNavCard
              icon="📖"
              title="Bible App"
              description="Manage daily passages, meditations, courses, ministers, translations and monetisation."
              palette={palette}
              onPress={onOpenBibleAdmin}
            />
            <AdminNavCard
              icon="⚡"
              title="KIS App"
              description="Feature flags, broadcast, education, market, messaging, notifications and platform analytics."
              palette={palette}
              onPress={onOpenKISAppAdmin}
            />
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QuickActionTile({ label, icon, value, sub, palette, onPress, highlight }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tile,
        {
          backgroundColor: highlight ? (palette.danger) + '18' : palette.card ?? palette.surface,
          borderColor: highlight ? (palette.danger) : palette.border,
        },
      ]}
    >
      <Text style={styles.tileIcon}>{icon}</Text>
      <Text style={[styles.tileValue, { color: highlight ? (palette.danger) : palette.text }]}>
        {value}
      </Text>
      <Text style={[styles.tileLabel, { color: palette.text }]}>{label}</Text>
      <Text style={[styles.tileSub, { color: palette.subtext }]}>{sub}</Text>
    </Pressable>
  );
}

function StatBadge({ label, value, palette, warn }: any) {
  return (
    <View style={[styles.badge, { backgroundColor: palette.card ?? palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.badgeValue, { color: warn ? (palette.danger) : palette.text }]}>{value}</Text>
      <Text style={[styles.badgeLabel, { color: palette.subtext }]}>{label}</Text>
    </View>
  );
}

function AdminNavCard({ icon, title, description, palette, onPress, badge }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.navCard, { backgroundColor: palette.card ?? palette.surface, borderColor: palette.border }]}
    >
      <Text style={styles.navCardIcon}>{icon}</Text>
      <View style={styles.navCardBody}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.navCardTitle, { color: palette.text }]}>{title}</Text>
          {badge && (
            <View style={[styles.badgePill, { backgroundColor: palette.danger }]}>
              <Text style={styles.badgePillText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.navCardDesc, { color: palette.subtext }]}>{description}</Text>
      </View>
      <Text style={{ color: palette.subtext, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

function ChartSection({ title, series, palette, color }: {
  title: string;
  series: { label: string; value: number }[];
  palette: any;
  color: string;
}) {
  const max = Math.max(...series.map(s => s.value), 1);
  return (
    <View style={[styles.chartCard, { backgroundColor: palette.card ?? palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.chartTitle, { color: palette.text }]}>{title}</Text>
      <View style={styles.chartBars}>
        {series.slice(-14).map((s, i) => (
          <View key={i} style={styles.barWrap}>
            <View
              style={[
                styles.bar,
                { height: Math.max(4, (s.value / max) * 60), backgroundColor: color },
              ]}
            />
            {i % 7 === 0 && (
              <Text style={[styles.barLabel, { color: palette.subtext }]}>{s.label}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    borderLeftWidth: 1,
    zIndex: 120,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '900' },
  headerSub: { fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  closeBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorBox: { borderRadius: 8, borderWidth: 1, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 14, fontWeight: '800', marginTop: 24, marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  tileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  tile: { flex: 1, minWidth: 120, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center' },
  tileIcon: { fontSize: 22, marginBottom: 4 },
  tileValue: { fontSize: 20, fontWeight: '900' },
  tileLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  tileSub: { fontSize: 10, marginTop: 2 },
  badge: { flex: 1, minWidth: 100, borderRadius: 10, borderWidth: 1, padding: 10, alignItems: 'center' },
  badgeValue: { fontSize: 16, fontWeight: '900' },
  badgeLabel: { fontSize: 10, marginTop: 2 },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  navCardIcon: { fontSize: 24 },
  navCardBody: { flex: 1 },
  navCardTitle: { fontSize: 14, fontWeight: '800' },
  navCardDesc: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  badgePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  badgePillText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  chartCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginVertical: 10 },
  chartTitle: { fontSize: 13, fontWeight: '800', marginBottom: 10 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 70 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '70%', borderRadius: 3 },
  barLabel: { fontSize: 8, marginTop: 2 },
});
