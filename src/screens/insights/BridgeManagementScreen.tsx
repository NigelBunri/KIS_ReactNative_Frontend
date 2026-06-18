import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import { useKISTheme } from '@/theme/useTheme';
import type { RootStackParamList } from '@/navigation/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type BridgeAccount = {
  id: string;
  platform: string;
  username?: string;
  status?: string;
  last_sync?: string;
};

type BridgeAutomation = {
  id: string;
  name: string;
  trigger?: string;
  action?: string;
  target?: string;
  is_active: boolean;
};

type BridgeMessage = {
  id: string;
  source_platform?: string;
  content?: string;
  target?: string;
  timestamp?: string;
  status?: string;
};

type TabKey = 'accounts' | 'automations' | 'messages';

const TRIGGER_OPTIONS = [
  { label: 'Message received', value: 'message_received' },
  { label: 'Post published', value: 'post_published' },
  { label: 'Event created', value: 'event_created' },
];

const ACTION_OPTIONS = [
  { label: 'Send to channel', value: 'send_to_channel' },
  { label: 'Post to feed', value: 'post_to_feed' },
  { label: 'Notify team', value: 'notify_team' },
];

const PLATFORMS = ['Twitter / X', 'Instagram', 'Facebook', 'LinkedIn', 'Telegram', 'Discord', 'Slack', 'WhatsApp', 'Other'];

// ── Sub-components ─────────────────────────────────────────────────────────────

type SelectRowProps = {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  palette: ReturnType<typeof useKISTheme>['palette'];
};

function SelectRow({ label, value, options, onChange, palette }: SelectRowProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value)?.label ?? 'Select…';
  return (
    <View style={{ gap: 6 }}>
      <Text style={[mStyles.fieldLabel, { color: palette.subtext }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[mStyles.selectBtn, { borderColor: palette.divider, backgroundColor: palette.surface }]}
      >
        <Text style={{ color: value ? palette.text : palette.subtext }}>{selected}</Text>
        <Text style={{ color: palette.subtext }}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={mStyles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={[mStyles.dropdownSheet, { backgroundColor: palette.card, borderColor: palette.divider }]}>
            <Text style={[mStyles.dropdownTitle, { color: palette.text }]}>{label}</Text>
            {options.map(opt => (
              <Pressable
                key={opt.value}
                style={[
                  mStyles.dropdownItem,
                  opt.value === value && { backgroundColor: palette.primaryWeak },
                ]}
                onPress={() => { onChange(opt.value); setOpen(false); }}
              >
                <Text style={{ color: palette.text, fontWeight: opt.value === value ? '700' : '400' }}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Accounts Tab ──────────────────────────────────────────────────────────────

function AccountsTab({ palette }: { palette: ReturnType<typeof useKISTheme>['palette'] }) {
  const [accounts, setAccounts] = useState<BridgeAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [platform, setPlatform] = useState('');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [platformPickerOpen, setPlatformPickerOpen] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.bridge.accounts, { errorMessage: 'Unable to load accounts.' });
      if (res.success) {
        setAccounts(res.data?.results ?? res.data ?? []);
      } else {
        setError(res.message || 'Unable to load accounts.');
      }
    } catch (e: any) {
      setError(e?.message || 'Unable to load accounts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const handleConnect = async () => {
    if (!platform.trim()) {
      Alert.alert('Validation', 'Please select a platform.');
      return;
    }
    setSaving(true);
    try {
      const res = await postRequest(
        ROUTES.bridge.accounts,
        { platform, token: token.trim() || undefined },
        { errorMessage: 'Failed to connect account.' },
      );
      if (res.success) {
        setShowModal(false);
        setPlatform('');
        setToken('');
        load();
      } else {
        Alert.alert('Error', res.message || 'Failed to connect account.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to connect account.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = (account: BridgeAccount) => {
    Alert.alert(
      'Disconnect Account',
      `Disconnect ${account.platform} (${account.username || account.id})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteRequest(ROUTES.bridge.account(account.id), {
              errorMessage: 'Failed to disconnect.',
            });
            if (res.success) {
              load();
            } else {
              Alert.alert('Error', res.message || 'Failed to disconnect.');
            }
          },
        },
      ],
    );
  };

  const handleSync = async (account: BridgeAccount) => {
    const res = await postRequest(
      ROUTES.bridge.accountSync(account.id),
      {},
      { errorMessage: 'Sync failed.' },
    );
    if (!res.success) {
      Alert.alert('Sync', res.message || 'Sync failed.');
    } else {
      Alert.alert('Sync', 'Sync triggered successfully.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.primaryStrong} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: palette.danger, textAlign: 'center' }}>{error}</Text>
        <Pressable onPress={() => load()} style={[styles.retryBtn, { backgroundColor: palette.primaryStrong }]}>
          <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={accounts}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={{ color: palette.subtext }}>No connected accounts.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>{item.platform}</Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: item.status === 'connected' ? palette.successSoft : palette.dangerSoft },
              ]}>
                <Text style={[
                  styles.statusText,
                  { color: item.status === 'connected' ? palette.success : palette.danger },
                ]}>
                  {item.status ?? 'unknown'}
                </Text>
              </View>
            </View>
            {item.username ? (
              <Text style={[styles.cardMeta, { color: palette.subtext }]}>@{item.username}</Text>
            ) : null}
            {item.last_sync ? (
              <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                Last sync: {new Date(item.last_sync).toLocaleString()}
              </Text>
            ) : null}
            <View style={styles.cardActions}>
              <Pressable
                onPress={() => handleSync(item)}
                style={[styles.actionBtn, { borderColor: palette.primaryStrong }]}
              >
                <Text style={[styles.actionBtnText, { color: palette.primaryStrong }]}>Sync</Text>
              </Pressable>
              <Pressable
                onPress={() => handleDisconnect(item)}
                style={[styles.actionBtn, { borderColor: palette.danger }]}
              >
                <Text style={[styles.actionBtnText, { color: palette.danger }]}>Disconnect</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      {/* FAB */}
      <Pressable
        onPress={() => setShowModal(true)}
        style={[styles.fab, { backgroundColor: palette.primaryStrong, shadowColor: palette.royalInk }]}
      >
        <Text style={[styles.fabText, { color: palette.onPrimary }]}>+ Connect Account</Text>
      </Pressable>

      {/* Connect Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={mStyles.overlay}>
          <View style={[mStyles.sheet, { backgroundColor: palette.card }]}>
            <Text style={[mStyles.sheetTitle, { color: palette.text }]}>Connect Account</Text>

            {/* Platform selector */}
            <Text style={[mStyles.fieldLabel, { color: palette.subtext }]}>Platform</Text>
            <Pressable
              onPress={() => setPlatformPickerOpen(true)}
              style={[mStyles.selectBtn, { borderColor: palette.divider, backgroundColor: palette.surface }]}
            >
              <Text style={{ color: platform ? palette.text : palette.subtext }}>
                {platform || 'Select platform…'}
              </Text>
              <Text style={{ color: palette.subtext }}>▾</Text>
            </Pressable>

            <Modal
              visible={platformPickerOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setPlatformPickerOpen(false)}
            >
              <Pressable style={mStyles.modalBackdrop} onPress={() => setPlatformPickerOpen(false)}>
                <View style={[mStyles.dropdownSheet, { backgroundColor: palette.card, borderColor: palette.divider }]}>
                  <Text style={[mStyles.dropdownTitle, { color: palette.text }]}>Select Platform</Text>
                  {PLATFORMS.map(p => (
                    <Pressable
                      key={p}
                      style={[mStyles.dropdownItem, p === platform && { backgroundColor: palette.primaryWeak }]}
                      onPress={() => { setPlatform(p); setPlatformPickerOpen(false); }}
                    >
                      <Text style={{ color: palette.text, fontWeight: p === platform ? '700' : '400' }}>{p}</Text>
                    </Pressable>
                  ))}
                </View>
              </Pressable>
            </Modal>

            <Text style={[mStyles.fieldLabel, { color: palette.subtext, marginTop: 14 }]}>
              OAuth Token / API Key (optional)
            </Text>
            <TextInput
              style={[mStyles.input, { borderColor: palette.divider, color: palette.text, backgroundColor: palette.surface }]}
              placeholder="Paste token or leave blank for OAuth flow"
              placeholderTextColor={palette.subtext}
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={mStyles.sheetActions}>
              <Pressable
                onPress={() => { setShowModal(false); setPlatform(''); setToken(''); }}
                style={[mStyles.cancelBtn, { borderColor: palette.divider }]}
              >
                <Text style={{ color: palette.subtext, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConnect}
                disabled={saving}
                style={[mStyles.saveBtn, { backgroundColor: palette.primaryStrong, opacity: saving ? 0.6 : 1 }]}
              >
                {saving
                  ? <ActivityIndicator color={palette.onPrimary} size="small" />
                  : <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>Connect</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Automations Tab ───────────────────────────────────────────────────────────

function AutomationsTab({ palette }: { palette: ReturnType<typeof useKISTheme>['palette'] }) {
  const [automations, setAutomations] = useState<BridgeAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formTrigger, setFormTrigger] = useState('');
  const [formAction, setFormAction] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.bridge.automations, { errorMessage: 'Unable to load automations.' });
      if (res.success) {
        setAutomations(res.data?.results ?? res.data ?? []);
      } else {
        setError(res.message || 'Unable to load automations.');
      }
    } catch (e: any) {
      setError(e?.message || 'Unable to load automations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const resetForm = () => {
    setFormName('');
    setFormTrigger('');
    setFormAction('');
    setFormTarget('');
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('Validation', 'Please enter a name.');
      return;
    }
    if (!formTrigger) {
      Alert.alert('Validation', 'Please select a trigger.');
      return;
    }
    if (!formAction) {
      Alert.alert('Validation', 'Please select an action.');
      return;
    }
    setSaving(true);
    try {
      const res = await postRequest(
        ROUTES.bridge.automations,
        {
          name: formName.trim(),
          trigger: formTrigger,
          action: formAction,
          target: formTarget.trim() || undefined,
        },
        { errorMessage: 'Failed to create automation.' },
      );
      if (res.success) {
        setShowModal(false);
        resetForm();
        load();
      } else {
        Alert.alert('Error', res.message || 'Failed to create automation.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create automation.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: BridgeAutomation) => {
    const next = !item.is_active;
    setAutomations(prev => prev.map(a => a.id === item.id ? { ...a, is_active: next } : a));
    const res = await patchRequest(
      ROUTES.bridge.automation(item.id),
      { is_active: next },
      { errorMessage: 'Failed to update automation.' },
    );
    if (!res.success) {
      setAutomations(prev => prev.map(a => a.id === item.id ? { ...a, is_active: !next } : a));
      Alert.alert('Error', res.message || 'Failed to update automation.');
    }
  };

  const handleDelete = (item: BridgeAutomation) => {
    Alert.alert(
      'Delete Automation',
      `Delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteRequest(ROUTES.bridge.automation(item.id), {
              errorMessage: 'Failed to delete automation.',
            });
            if (res.success) {
              load();
            } else {
              Alert.alert('Error', res.message || 'Failed to delete automation.');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.primaryStrong} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: palette.danger, textAlign: 'center' }}>{error}</Text>
        <Pressable onPress={() => load()} style={[styles.retryBtn, { backgroundColor: palette.primaryStrong }]}>
          <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={automations}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={{ color: palette.subtext }}>No automations yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: palette.text, flex: 1 }]}>{item.name}</Text>
              <Switch
                value={item.is_active}
                onValueChange={() => handleToggle(item)}
                trackColor={{ true: palette.primaryStrong, false: palette.divider }}
                thumbColor={palette.ivory}
              />
            </View>
            {item.trigger ? (
              <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                Trigger: {TRIGGER_OPTIONS.find(t => t.value === item.trigger)?.label ?? item.trigger}
              </Text>
            ) : null}
            {item.action ? (
              <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                Action: {ACTION_OPTIONS.find(a => a.value === item.action)?.label ?? item.action}
              </Text>
            ) : null}
            {item.target ? (
              <Text style={[styles.cardMeta, { color: palette.subtext }]}>Target: {item.target}</Text>
            ) : null}
            <View style={styles.cardActions}>
              <Pressable
                onPress={() => handleDelete(item)}
                style={[styles.actionBtn, { borderColor: palette.danger }]}
              >
                <Text style={[styles.actionBtnText, { color: palette.danger }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      {/* Create button */}
      <Pressable
        onPress={() => setShowModal(true)}
        style={[styles.fab, { backgroundColor: palette.primaryStrong, shadowColor: palette.royalInk }]}
      >
        <Text style={[styles.fabText, { color: palette.onPrimary }]}>+ Create Automation</Text>
      </Pressable>

      {/* Create Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => { setShowModal(false); resetForm(); }}>
        <View style={mStyles.overlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }} keyboardShouldPersistTaps="handled">
            <View style={[mStyles.sheet, { backgroundColor: palette.card }]}>
              <Text style={[mStyles.sheetTitle, { color: palette.text }]}>Create Automation</Text>

              <Text style={[mStyles.fieldLabel, { color: palette.subtext }]}>Name</Text>
              <TextInput
                style={[mStyles.input, { borderColor: palette.divider, color: palette.text, backgroundColor: palette.surface }]}
                placeholder="Automation name"
                placeholderTextColor={palette.subtext}
                value={formName}
                onChangeText={setFormName}
              />

              <View style={{ marginTop: 14 }}>
                <SelectRow
                  label="Trigger"
                  value={formTrigger}
                  options={TRIGGER_OPTIONS}
                  onChange={setFormTrigger}
                  palette={palette}
                />
              </View>

              <View style={{ marginTop: 14 }}>
                <SelectRow
                  label="Action"
                  value={formAction}
                  options={ACTION_OPTIONS}
                  onChange={setFormAction}
                  palette={palette}
                />
              </View>

              <Text style={[mStyles.fieldLabel, { color: palette.subtext, marginTop: 14 }]}>
                Target account / channel (optional)
              </Text>
              <TextInput
                style={[mStyles.input, { borderColor: palette.divider, color: palette.text, backgroundColor: palette.surface }]}
                placeholder="e.g. #general or @handle"
                placeholderTextColor={palette.subtext}
                value={formTarget}
                onChangeText={setFormTarget}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={mStyles.sheetActions}>
                <Pressable
                  onPress={() => { setShowModal(false); resetForm(); }}
                  style={[mStyles.cancelBtn, { borderColor: palette.divider }]}
                >
                  <Text style={{ color: palette.subtext, fontWeight: '600' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  style={[mStyles.saveBtn, { backgroundColor: palette.primaryStrong, opacity: saving ? 0.6 : 1 }]}
                >
                  {saving
                    ? <ActivityIndicator color={palette.onPrimary} size="small" />
                    : <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>Save</Text>}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ── Messages Tab ──────────────────────────────────────────────────────────────

function MessagesTab({ palette }: { palette: ReturnType<typeof useKISTheme>['palette'] }) {
  const [messages, setMessages] = useState<BridgeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.bridge.messages, { errorMessage: 'Unable to load messages.' });
      if (res.success) {
        setMessages(res.data?.results ?? res.data ?? []);
      } else {
        setError(res.message || 'Unable to load messages.');
      }
    } catch (e: any) {
      setError(e?.message || 'Unable to load messages.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.primaryStrong} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: palette.danger, textAlign: 'center' }}>{error}</Text>
        <Pressable onPress={() => load()} style={[styles.retryBtn, { backgroundColor: palette.primaryStrong }]}>
          <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={messages}
      keyExtractor={item => String(item.id)}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Text style={{ color: palette.subtext }}>No bridged messages.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>
              {item.source_platform ?? 'Unknown'}
            </Text>
            {item.status ? (
              <View style={[
                styles.statusBadge,
                { backgroundColor: item.status === 'delivered' ? palette.successSoft : palette.goldHighlight },
              ]}>
                <Text style={[
                  styles.statusText,
                  { color: item.status === 'delivered' ? palette.success : palette.gold },
                ]}>
                  {item.status}
                </Text>
              </View>
            ) : null}
          </View>
          {item.content ? (
            <Text
              numberOfLines={2}
              style={[styles.cardMeta, { color: palette.text, fontSize: 13 }]}
            >
              {item.content}
            </Text>
          ) : null}
          <View style={styles.cardRow}>
            {item.target ? (
              <Text style={[styles.cardMeta, { color: palette.subtext }]}>→ {item.target}</Text>
            ) : null}
            {item.timestamp ? (
              <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                {new Date(item.timestamp).toLocaleString()}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    />
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<RootStackParamList, 'BridgeManagement'>;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'accounts', label: 'Accounts' },
  { key: 'automations', label: 'Automations' },
  { key: 'messages', label: 'Messages' },
];

export default function BridgeManagementScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('accounts');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: palette.primaryStrong }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>Bridge Management</Text>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: palette.divider, backgroundColor: palette.surface }]}>
        {TABS.map(tab => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[
              styles.tabItem,
              activeTab === tab.key && [styles.tabItemActive, { borderBottomColor: palette.primaryStrong }],
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === tab.key ? palette.primaryStrong : palette.subtext },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'accounts' && <AccountsTab palette={palette} />}
        {activeTab === 'automations' && <AutomationsTab palette={palette} />}
        {activeTab === 'messages' && <MessagesTab palette={palette} />}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  backText: { fontSize: 15, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomWidth: 2 },
  tabLabel: { fontSize: 13, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  list: { padding: 16, gap: 12 },
  emptyBox: { alignItems: 'center', paddingTop: 48 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  cardMeta: { fontSize: 12 },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 30,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  fabText: { fontSize: 14, fontWeight: '700' },
});

const mStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
    gap: 0,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 18 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  selectBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  saveBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
  },
  // dropdown
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dropdownSheet: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownTitle: {
    fontSize: 14,
    fontWeight: '700',
    padding: 14,
    paddingBottom: 10,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
});
