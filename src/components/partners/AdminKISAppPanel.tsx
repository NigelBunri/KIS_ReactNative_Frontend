/**
 * AdminKISAppPanel — KCAN admin full management of the KIS platform app.
 * Covers: messaging, broadcast, education, market, health, partners,
 * feature flags, notifications, governance, analytics, realtime systems.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

type KISSection =
  | 'feature_flags'
  | 'messaging'
  | 'broadcast'
  | 'education'
  | 'market'
  | 'health'
  | 'partners_mgmt'
  | 'notifications'
  | 'governance'
  | 'analytics'
  | 'realtime'
  | 'shortcut_analytics';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  onClose: () => void;
};

const SECTIONS: { key: KISSection; label: string; icon: string; description: string }[] = [
  { key: 'feature_flags', label: 'Feature Flags', icon: '🚩', description: 'Enable/disable platform features per tier or globally' },
  { key: 'broadcast', label: 'Broadcast', icon: '📢', description: 'Review, moderate, and feature broadcast content' },
  { key: 'education', label: 'Education', icon: '📚', description: 'Manage courses, sessions, enrolment and revenue' },
  { key: 'market', label: 'Marketplace', icon: '🛍', description: 'Product listings, categories, moderation' },
  { key: 'health', label: 'Health', icon: '❤️', description: 'Providers, appointments, and health content' },
  { key: 'partners_mgmt', label: 'Partner Orgs', icon: '🤝', description: 'Review and manage all partner organizations' },
  { key: 'messaging', label: 'Messaging', icon: '💬', description: 'Platform chat overview, flagged messages, compliance' },
  { key: 'notifications', label: 'Notifications', icon: '🔔', description: 'Send platform-wide push notifications' },
  { key: 'governance', label: 'Governance', icon: '⚖️', description: 'Access requests, approval flows, role policies' },
  { key: 'shortcut_analytics', label: 'App Shortcuts', icon: '📌', description: 'Home screen shortcut install analytics' },
  { key: 'realtime', label: 'Realtime Systems', icon: '⚡', description: 'WebSocket health, active sessions, signaling' },
  { key: 'analytics', label: 'Platform Analytics', icon: '📊', description: 'DAU/MAU, retention, revenue, regional breakdown' },
];

type FeatureFlag = {
  key: string;
  label: string;
  enabled: boolean;
  tier?: string;
  description?: string;
};

export default function AdminKISAppPanel({ isOpen, panelWidth, panelTranslateX, onClose }: Props) {
  const { palette } = useKISTheme();
  const [activeSection, setActiveSection] = useState<KISSection | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSection = useCallback(async (section: KISSection) => {
    setActiveSection(section);
    setData([]);
    setFlags([]);
    setAnalytics(null);
    setError(null);
    setLoading(true);
    try {
      if (section === 'feature_flags') {
        const res: any = await getRequest('/api/v1/admin/feature-flags/');
        const raw = res?.data ?? res;
        const flagList: FeatureFlag[] = (Array.isArray(raw) ? raw : raw?.results ?? []).map((f: any) => ({
          key: f.key || f.name,
          label: f.label || f.name,
          enabled: f.enabled ?? f.is_enabled ?? false,
          tier: f.tier,
          description: f.description,
        }));
        setFlags(flagList);
      } else if (section === 'analytics') {
        const res: any = await getRequest((ROUTES as any).adminAnalytics || '/api/v1/admin/analytics/');
        const d = res?.data ?? res;
        setAnalytics(typeof d === 'object' && d ? d : {});
      } else if (section === 'shortcut_analytics') {
        const res: any = await getRequest(ROUTES.partners.appShortcutsAnalytics);
        const d = res?.data ?? res;
        setData(d?.results ?? []);
      } else if (section === 'notifications') {
        const res: any = await getRequest('/api/v1/admin/notification-campaigns/');
        const d = res?.data ?? res;
        setData(Array.isArray(d) ? d : d?.results ?? []);
      } else if (section === 'broadcast') {
        const res: any = await getRequest('/api/v1/admin/broadcast-flags/');
        const d = res?.data ?? res;
        setData(Array.isArray(d) ? d : d?.results ?? []);
      } else if (section === 'education') {
        const res: any = await getRequest('/api/v1/admin/education-courses/');
        const d = res?.data ?? res;
        setData(Array.isArray(d) ? d : d?.results ?? []);
      } else if (section === 'market') {
        const res: any = await getRequest('/api/v1/admin/market-listings/');
        const d = res?.data ?? res;
        setData(Array.isArray(d) ? d : d?.results ?? []);
      } else if (section === 'health') {
        const res: any = await getRequest('/api/v1/admin/health-providers/');
        const d = res?.data ?? res;
        setData(Array.isArray(d) ? d : d?.results ?? []);
      } else if (section === 'messaging') {
        const res: any = await getRequest('/api/v1/admin/flagged-messages/');
        const d = res?.data ?? res;
        setData(Array.isArray(d) ? d : d?.results ?? []);
      } else if (section === 'governance') {
        const res: any = await getRequest('/api/v1/admin/governance/access-requests/');
        const d = res?.data ?? res;
        setData(Array.isArray(d) ? d : d?.results ?? []);
      } else if (section === 'partners_mgmt') {
        const res: any = await getRequest('/api/v1/partners/?page_size=50');
        const d = res?.data ?? res;
        setData(Array.isArray(d) ? d : d?.results ?? []);
      } else if (section === 'realtime') {
        const res: any = await getRequest('/api/v1/admin/realtime-health/');
        const d = res?.data ?? res;
        setAnalytics(typeof d === 'object' && d ? d : {});
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load data.');
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
      setSecondsAgo(0);
    }
  }, []);

  // Auto-refresh every 30 seconds when a section is active
  useEffect(() => {
    if (!activeSection) {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
      refreshIntervalRef.current = null;
      clockIntervalRef.current = null;
      return;
    }
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    refreshIntervalRef.current = setInterval(() => {
      void loadSection(activeSection);
    }, 30000);
    if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    clockIntervalRef.current = setInterval(() => {
      setSecondsAgo(prev => prev + 1);
    }, 1000);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, [activeSection, loadSection]);

  const toggleFlag = useCallback(async (flag: FeatureFlag) => {
    setActionLoading(flag.key);
    try {
      await postRequest(`/api/v1/admin/feature-flags/${flag.key}/toggle/`, {
        enabled: !flag.enabled,
      });
      setFlags(prev => prev.map(f => f.key === flag.key ? { ...f, enabled: !f.enabled } : f));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not toggle flag.');
    } finally {
      setActionLoading(null);
    }
  }, []);

  const sendNotification = useCallback(async () => {
    Alert.prompt(
      'Send Platform Notification',
      'Enter message to send to all active users:',
      async (message) => {
        if (!message?.trim()) return;
        try {
          await postRequest('/api/v1/admin/notifications/broadcast/', { message: message.trim(), type: 'platform' });
          Alert.alert('Sent', 'Platform notification queued.');
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'Failed to send.');
        }
      },
      'plain-text',
    );
  }, []);

  if (!isOpen) return null;

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: palette.backdrop, opacity: backdropOpacity },
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            width: panelWidth,
            backgroundColor: palette.surfaceElevated,
            borderLeftColor: palette.divider,
            transform: [{ translateX: panelTranslateX }],
          },
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: palette.divider }]}>
          <Pressable onPress={activeSection ? () => setActiveSection(null) : onClose} style={styles.backBtn}>
            <Text style={{ color: palette.primary, fontSize: 28, lineHeight: 32, fontWeight: '300' }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: palette.text }]}>
              ⚡ KIS App Admin
            </Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              {activeSection
                ? (SECTIONS.find(s => s.key === activeSection)?.label ?? '')
                : 'Platform systems management'}
            </Text>
          </View>
          {activeSection === 'notifications' && (
            <Pressable
              onPress={sendNotification}
              style={[styles.actionBtn, { backgroundColor: palette.primary }]}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Send</Text>
            </Pressable>
          )}
          {activeSection && (
            <Pressable
              onPress={() => void loadSection(activeSection)}
              style={[styles.actionBtn, { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.divider }]}
            >
              <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '700' }}>Refresh</Text>
            </Pressable>
          )}
        </View>

        {!activeSection ? (
          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {SECTIONS.map(section => (
                <Pressable
                  key={section.key}
                  onPress={() => void loadSection(section.key)}
                  style={({ pressed }) => [
                    styles.sectionCard,
                    { backgroundColor: palette.surface, borderColor: palette.divider, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Text style={{ fontSize: 26, marginBottom: 6 }}>{section.icon}</Text>
                  <Text style={[styles.sectionLabel, { color: palette.text }]}>{section.label}</Text>
                  <Text style={[styles.sectionDesc, { color: palette.subtext }]}>{section.description}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>
            {lastUpdated && !loading && (
              <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.divider }}>
                <Text style={{ fontSize: 11, color: palette.subtext }}>
                  Last updated: {secondsAgo < 60 ? `${secondsAgo}s ago` : `${Math.floor(secondsAgo / 60)}m ago`}
                </Text>
              </View>
            )}
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={palette.primary} />
              </View>
            ) : error ? (
              <View style={styles.center}>
                <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
                <Pressable onPress={() => void loadSection(activeSection)} style={[styles.retryBtn, { backgroundColor: palette.primary }]}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
                </Pressable>
              </View>
            ) : activeSection === 'feature_flags' ? (
              <FlatList
                data={flags}
                keyExtractor={item => item.key}
                contentContainerStyle={{ padding: 12, gap: 8 }}
                ListEmptyComponent={
                  <Text style={[styles.emptyText, { color: palette.subtext }]}>No feature flags found.</Text>
                }
                renderItem={({ item }) => (
                  <View style={[styles.flagRow, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.flagLabel, { color: palette.text }]}>{item.label}</Text>
                      {item.description ? (
                        <Text style={[styles.flagDesc, { color: palette.subtext }]}>{item.description}</Text>
                      ) : null}
                      {item.tier ? (
                        <Text style={[styles.flagTier, { color: palette.primary }]}>Min tier: {item.tier}</Text>
                      ) : null}
                    </View>
                    {actionLoading === item.key ? (
                      <ActivityIndicator size="small" color={palette.primary} />
                    ) : (
                      <Switch
                        value={item.enabled}
                        onValueChange={() => void toggleFlag(item)}
                        trackColor={{ true: palette.success, false: palette.borderMuted }}
                        thumbColor="#fff"
                      />
                    )}
                  </View>
                )}
              />
            ) : activeSection === 'analytics' || activeSection === 'realtime' ? (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                {analytics ? Object.entries(analytics).map(([k, v]) => (
                  <View key={k} style={[styles.kpiRow, { borderBottomColor: palette.divider }]}>
                    <Text style={[styles.kpiKey, { color: palette.subtext }]}>{k.replace(/_/g, ' ')}</Text>
                    <Text style={[styles.kpiVal, { color: palette.text }]}>{String(v)}</Text>
                  </View>
                )) : (
                  <Text style={{ color: palette.subtext }}>No data available.</Text>
                )}
              </ScrollView>
            ) : (
              <FlatList
                data={data}
                keyExtractor={(item, i) => String(item?.id ?? i)}
                contentContainerStyle={{ padding: 12, gap: 8 }}
                ListEmptyComponent={
                  <Text style={[styles.emptyText, { color: palette.subtext }]}>No items found.</Text>
                }
                renderItem={({ item }) => (
                  <View style={[styles.listRow, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>
                        {item?.title || item?.name || item?.label || item?.slug || item?.message || String(item?.id)}
                      </Text>
                      {(item?.status || item?.is_active !== undefined || item?.count) ? (
                        <Text style={[styles.rowMeta, { color: palette.subtext }]}>
                          {[
                            item?.status,
                            item?.is_active !== undefined ? (item.is_active ? 'Active' : 'Inactive') : null,
                            item?.count !== undefined ? `${item.count} installs` : null,
                            item?.total !== undefined ? `${item.total} total` : null,
                          ].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => Alert.alert('Detail', JSON.stringify(item, null, 2))}
                      style={[styles.manageBtn, { borderColor: palette.primary }]}
                    >
                      <Text style={{ color: palette.primary, fontSize: 11, fontWeight: '700' }}>View</Text>
                    </Pressable>
                  </View>
                )}
              />
            )}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    borderLeftWidth: 1,
    zIndex: 200,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  backBtn: {
    paddingVertical: 8,
    paddingRight: 10,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 1 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  grid: { padding: 12 },
  sectionCard: {
    width: '47.5%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 2,
  },
  sectionLabel: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  sectionDesc: { fontSize: 11, lineHeight: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  flagLabel: { fontSize: 14, fontWeight: '600' },
  flagDesc: { fontSize: 11, marginTop: 2 },
  flagTier: { fontSize: 10, marginTop: 2, fontWeight: '700' },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  kpiKey: { fontSize: 13, textTransform: 'capitalize' },
  kpiVal: { fontSize: 13, fontWeight: '700' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowMeta: { fontSize: 11, marginTop: 2 },
  manageBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});
