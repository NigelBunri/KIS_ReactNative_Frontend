import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

// ─── Types ───────────────────────────────────────────────────────────────────

type Flag = {
  id: string;
  source: 'USER' | 'SYSTEM' | 'AI';
  target_type: string;
  target_id: string;
  reporter_id: string | null;
  reason: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'REVIEWED' | 'ACTIONED' | 'DISMISSED';
  escalation_level: string;
  ai_score: number | null;
  created_at: string;
  reviewed_at: string | null;
  resolved_at: string | null;
};

type AuditEntry = {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, any>;
  ip_address: string | null;
  created_at: string;
};

type KISUser = {
  id: string;
  email: string;
  display_name: string;
  username: string;
  tier: string;
  status: string;
  trust_score: number;
  created_at: string;
};

type Tab = 'queue' | 'users' | 'audit';

// ─── Severity badge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Flag['severity'] }) {
  const colors: Record<Flag['severity'], string> = {
    LOW: '#4CAF50',
    MEDIUM: '#FF9800',
    HIGH: '#F44336',
    CRITICAL: '#9C27B0',
  };
  return (
    <View style={[badgeStyles.root, { backgroundColor: colors[severity] + '22', borderColor: colors[severity] }]}>
      <Text style={[badgeStyles.label, { color: colors[severity] }]}>{severity}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  root: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  label: { fontSize: 11, fontWeight: '700' },
});

// ─── Status chip ─────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: Flag['status'] }) {
  const map: Record<Flag['status'], [string, string]> = {
    PENDING: ['#FF9800', 'Pending'],
    REVIEWED: ['#2196F3', 'Reviewed'],
    ACTIONED: ['#4CAF50', 'Actioned'],
    DISMISSED: ['#9E9E9E', 'Dismissed'],
  };
  const [color, label] = map[status] ?? ['#9E9E9E', status];
  return (
    <View style={[badgeStyles.root, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[badgeStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Flag Action Sheet ────────────────────────────────────────────────────────

function FlagActionSheet({
  flag,
  visible,
  onClose,
  onDone,
}: {
  flag: Flag | null;
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { palette } = useKISTheme();
  const [busy, setBusy] = useState(false);

  const doAction = useCallback(async (kind: 'review' | 'resolve') => {
    if (!flag) return;
    setBusy(true);
    try {
      const url = kind === 'review'
        ? ROUTES.moderation.flagReview(flag.id)
        : ROUTES.moderation.flagResolve(flag.id);
      const res = await postRequest(url, {});
      if (!res.success && !res.data) throw new Error(res.message || 'Failed');
      onDone();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  }, [flag, onDone, onClose]);

  const doModAction = useCallback(async (action: string) => {
    if (!flag) return;
    setBusy(true);
    try {
      const res = await postRequest(ROUTES.moderation.moderationActions, {
        flag: flag.id,
        action,
        notes: '',
      });
      if (!res.success && !res.data) throw new Error(res.message || 'Failed');
      onDone();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  }, [flag, onDone, onClose]);

  if (!flag) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheet.overlay} onPress={onClose} />
      <View style={[sheet.panel, { backgroundColor: palette.bg }]}>
        <View style={sheet.handle} />
        <Text style={[sheet.title, { color: palette.text }]}>Flag action</Text>
        <Text style={[sheet.sub, { color: palette.subtext }]} numberOfLines={3}>{flag.reason}</Text>
        <View style={sheet.row}>
          <SeverityBadge severity={flag.severity} />
          <StatusChip status={flag.status} />
          <Text style={[sheet.meta, { color: palette.subtext }]}>{flag.target_type}</Text>
        </View>
        {busy ? (
          <ActivityIndicator color={palette.primaryStrong} style={{ marginVertical: 20 }} />
        ) : (
          <>
            {flag.status === 'PENDING' && (
              <TouchableOpacity style={[sheet.btn, { backgroundColor: '#2196F322', borderColor: '#2196F3' }]} onPress={() => doAction('review')}>
                <Text style={[sheet.btnTxt, { color: '#2196F3' }]}>Mark reviewed</Text>
              </TouchableOpacity>
            )}
            {(flag.status === 'PENDING' || flag.status === 'REVIEWED') && (
              <>
                <TouchableOpacity style={[sheet.btn, { backgroundColor: '#FF980022', borderColor: '#FF9800' }]} onPress={() => doModAction('WARN')}>
                  <Text style={[sheet.btnTxt, { color: '#FF9800' }]}>Warn user</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[sheet.btn, { backgroundColor: '#F4433622', borderColor: '#F44336' }]} onPress={() => doModAction('SUSPEND')}>
                  <Text style={[sheet.btnTxt, { color: '#F44336' }]}>Suspend</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[sheet.btn, { backgroundColor: '#9C27B022', borderColor: '#9C27B0' }]} onPress={() => doModAction('BAN')}>
                  <Text style={[sheet.btnTxt, { color: '#9C27B0' }]}>Ban user</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[sheet.btn, { backgroundColor: '#f4433622', borderColor: '#F44336' }]} onPress={() => doModAction('DELETE')}>
                  <Text style={[sheet.btnTxt, { color: '#F44336' }]}>Delete content</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[sheet.btn, { backgroundColor: '#4CAF5022', borderColor: '#4CAF50' }]} onPress={() => doAction('resolve')}>
                  <Text style={[sheet.btnTxt, { color: '#4CAF50' }]}>Resolve (no action)</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
        <TouchableOpacity style={[sheet.btn, { backgroundColor: palette.surface, borderColor: palette.divider }]} onPress={onClose}>
          <Text style={[sheet.btnTxt, { color: palette.subtext }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 10 },
  handle: { width: 40, height: 4, backgroundColor: '#ccc', borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  meta: { fontSize: 12 },
  btn: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  btnTxt: { fontWeight: '700', fontSize: 14 },
});

// ─── Moderation Queue Tab ─────────────────────────────────────────────────────

function ModerationQueueTab() {
  const { palette } = useKISTheme();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [selectedFlag, setSelectedFlag] = useState<Flag | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const url = `${ROUTES.moderation.flags}?status=${statusFilter}&ordering=-created_at`;
      const res = await getRequest(url);
      const items: Flag[] = Array.isArray(res.data?.results)
        ? res.data.results
        : Array.isArray(res.data)
        ? res.data
        : [];
      setFlags(items);
    } catch {
      setFlags([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const STATUS_TABS = ['PENDING', 'REVIEWED', 'ACTIONED', 'DISMISSED'] as const;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 8 }}>
        {STATUS_TABS.map(s => (
          <TouchableOpacity
            key={s}
            onPress={() => setStatusFilter(s)}
            style={[
              filterChip.root,
              { borderColor: statusFilter === s ? palette.primaryStrong : palette.divider, backgroundColor: statusFilter === s ? palette.primarySoft : palette.surface },
            ]}
          >
            <Text style={[filterChip.label, { color: statusFilter === s ? palette.primaryStrong : palette.subtext }]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={palette.primaryStrong} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={flags}
          keyExtractor={f => f.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          ListEmptyComponent={<Text style={{ color: palette.subtext, textAlign: 'center', marginTop: 40 }}>No {statusFilter.toLowerCase()} flags</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[flagCard.root, { backgroundColor: palette.surface, borderColor: palette.divider }]}
              onPress={() => setSelectedFlag(item)}
              activeOpacity={0.8}
            >
              <View style={flagCard.row}>
                <Text style={[flagCard.targetType, { color: palette.primaryStrong }]}>{item.target_type}</Text>
                <SeverityBadge severity={item.severity} />
                <StatusChip status={item.status} />
              </View>
              <Text style={[flagCard.reason, { color: palette.text }]} numberOfLines={2}>{item.reason}</Text>
              <View style={flagCard.footer}>
                <Text style={[flagCard.meta, { color: palette.subtext }]}>Source: {item.source}</Text>
                {item.ai_score != null && (
                  <Text style={[flagCard.meta, { color: palette.subtext }]}>AI score: {(item.ai_score * 100).toFixed(0)}%</Text>
                )}
                <Text style={[flagCard.meta, { color: palette.subtext }]}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <FlagActionSheet
        flag={selectedFlag}
        visible={!!selectedFlag}
        onClose={() => setSelectedFlag(null)}
        onDone={() => load()}
      />
    </View>
  );
}

const filterChip = StyleSheet.create({
  root: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  label: { fontWeight: '600', fontSize: 12 },
});

const flagCard = StyleSheet.create({
  root: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 6 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  targetType: { fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },
  reason: { fontSize: 14, lineHeight: 20 },
  footer: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  meta: { fontSize: 11 },
});

// ─── User Management Tab ──────────────────────────────────────────────────────

function UserManagementTab() {
  const { palette } = useKISTheme();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<KISUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const url = q.trim()
        ? `${ROUTES.adminUsers.list}?search=${encodeURIComponent(q)}&ordering=-created_at`
        : `${ROUTES.adminUsers.list}?ordering=-created_at`;
      const res = await getRequest(url);
      const items: KISUser[] = Array.isArray(res.data?.results)
        ? res.data.results
        : Array.isArray(res.data)
        ? res.data
        : [];
      setUsers(items);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { search(''); }, [search]);

  const handleQuery = (q: string) => {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => search(q), 400);
  };

  const handleSuspend = useCallback((user: KISUser) => {
    Alert.alert(
      `Suspend ${user.display_name || user.email}?`,
      'This will temporarily restrict the user\'s account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend', style: 'destructive',
          onPress: async () => {
            try {
              await postRequest(ROUTES.adminUsers.suspend(user.id), { reason: 'Admin action' });
              search(query);
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to suspend user');
            }
          },
        },
      ]
    );
  }, [query, search]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12 }}>
        <TextInput
          value={query}
          onChangeText={handleQuery}
          placeholder="Search by name, email, username..."
          placeholderTextColor={palette.subtext}
          style={[userTab.searchInput, { backgroundColor: palette.surface, borderColor: palette.divider, color: palette.text }]}
        />
      </View>
      {loading ? (
        <ActivityIndicator color={palette.primaryStrong} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); search(query, true); }} />}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          ListEmptyComponent={<Text style={{ color: palette.subtext, textAlign: 'center', marginTop: 40 }}>No users found</Text>}
          renderItem={({ item }) => (
            <View style={[userTab.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
              <View style={userTab.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[userTab.name, { color: palette.text }]}>{item.display_name || item.username || item.email}</Text>
                  <Text style={[userTab.email, { color: palette.subtext }]}>{item.email}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[userTab.tier, { color: palette.primaryStrong }]}>{item.tier || 'free'}</Text>
                  <Text style={[userTab.score, { color: item.trust_score > 80 ? '#4CAF50' : item.trust_score > 50 ? '#FF9800' : '#F44336' }]}>
                    Trust {(item.trust_score ?? 0).toFixed(0)}
                  </Text>
                </View>
              </View>
              <View style={userTab.cardFooter}>
                <Text style={[userTab.meta, { color: palette.subtext }]}>
                  Status: <Text style={{ color: item.status === 'active' ? '#4CAF50' : '#F44336' }}>{item.status || 'active'}</Text>
                </Text>
                <Text style={[userTab.meta, { color: palette.subtext }]}>
                  Joined {new Date(item.created_at).toLocaleDateString()}
                </Text>
                <TouchableOpacity
                  onPress={() => handleSuspend(item)}
                  style={[userTab.suspendBtn, { borderColor: '#F44336' }]}
                >
                  <Text style={{ color: '#F44336', fontWeight: '700', fontSize: 12 }}>Suspend</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const userTab = StyleSheet.create({
  searchInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardFooter: { flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  name: { fontWeight: '700', fontSize: 15 },
  email: { fontSize: 12, marginTop: 2 },
  tier: { fontWeight: '600', fontSize: 12, textTransform: 'uppercase' },
  score: { fontWeight: '700', fontSize: 12 },
  meta: { fontSize: 12 },
  suspendBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 'auto' },
});

// ─── Audit Log Tab ────────────────────────────────────────────────────────────

function AuditLogTab() {
  const { palette } = useKISTheme();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getRequest(`${ROUTES.moderation.auditLogs}?ordering=-created_at`);
      const items: AuditEntry[] = Array.isArray(res.data?.results)
        ? res.data.results
        : Array.isArray(res.data)
        ? res.data
        : [];
      setEntries(items);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return loading ? (
    <ActivityIndicator color={palette.primaryStrong} style={{ marginTop: 40 }} />
  ) : (
    <FlatList
      data={entries}
      keyExtractor={e => e.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
      contentContainerStyle={{ padding: 12, gap: 8 }}
      ListEmptyComponent={<Text style={{ color: palette.subtext, textAlign: 'center', marginTop: 40 }}>No audit entries</Text>}
      renderItem={({ item }) => (
        <View style={[auditCard.root, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
          <Text style={[auditCard.action, { color: palette.primaryStrong }]}>{item.action}</Text>
          <View style={auditCard.row}>
            <Text style={[auditCard.meta, { color: palette.subtext }]}>Target: {item.target_type}</Text>
            {item.ip_address ? (
              <Text style={[auditCard.meta, { color: palette.subtext }]}>IP: {item.ip_address}</Text>
            ) : null}
            <Text style={[auditCard.meta, { color: palette.subtext }]}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
          {Object.keys(item.metadata || {}).length > 0 && (
            <Text style={[auditCard.meta, { color: palette.subtext }]} numberOfLines={2}>
              {JSON.stringify(item.metadata)}
            </Text>
          )}
        </View>
      )}
    />
  );
}

const auditCard = StyleSheet.create({
  root: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 4 },
  action: { fontWeight: '700', fontSize: 13 },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  meta: { fontSize: 11 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ModerationConsoleScreen() {
  const { palette } = useKISTheme();
  const [tab, setTab] = useState<Tab>('queue');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'queue', label: 'Reports' },
    { key: 'users', label: 'Users' },
    { key: 'audit', label: 'Audit Log' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Moderation Console</Text>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: palette.divider }]}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, tab === t.key && { borderBottomColor: palette.primaryStrong, borderBottomWidth: 2 }]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabLabel, { color: tab === t.key ? palette.primaryStrong : palette.subtext }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {tab === 'queue' && <ModerationQueueTab />}
        {tab === 'users' && <UserManagementTab />}
        {tab === 'audit' && <AuditLogTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: '900' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabLabel: { fontWeight: '700', fontSize: 13 },
});
