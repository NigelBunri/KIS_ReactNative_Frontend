import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import type { RootStackParamList } from '@/navigation/types';
import { KISIcon } from '@/constants/kisIcons';
import {
  deleteInAppNotification,
  fetchInAppNotifications,
  markInAppNotificationAsRead,
  type InAppNotification,
} from '@/services/inAppNotificationService';
import NotificationRetentionPreviewCard from '@/components/profitability/NotificationRetentionPreviewCard';
import { getRequest } from '@/network/get';
import { queueableJsonRequest } from '@/services/offlineActionQueue';
import ROUTES from '@/network';

type NotificationRule = {
  id: string;
  type: string | null;
  enabled: boolean;
  channels_json?: string[];
  _isPlaceholder?: boolean;
};

const RULE_LABELS: Record<string, string> = {
  message: 'Direct messages',
  chat: 'Chat',
  community: 'Community activity',
  partner: 'Partner updates',
  broadcast: 'Broadcasts',
  channel: 'Channel posts',
  social: 'Social (likes, comments)',
  follow: 'New followers',
  mention: 'Mentions',
  system: 'System alerts',
};

const DEFAULT_TYPES = ['message', 'community', 'partner', 'broadcast', 'social', 'follow', 'mention'];

function NotificationPreferencesPanel() {
  const { palette } = useKISTheme();
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.notificationRules.list, { errorMessage: 'Could not load preferences' });
      const list: NotificationRule[] = Array.isArray(res?.data?.results)
        ? res.data.results
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setRules(list);
    } catch {
      setError('Could not load notification preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadRules(); }, [loadRules]));

  const toggle = useCallback(async (rule: NotificationRule) => {
    setToggling(rule.id);
    const newEnabled = !rule.enabled;
    // Optimistically update the display list
    setRules((prev) =>
      prev.length > 0
        ? prev.map((r) => r.id === rule.id ? { ...r, enabled: newEnabled } : r)
        : prev,
    );
    try {
      if (rule._isPlaceholder) {
        // No backend rule exists yet — create it via POST
        await queueableJsonRequest({
          domain: 'Settings',
          kind: 'settings.notification_rule',
          method: 'POST',
          url: ROUTES.notificationRules.list,
          body: { type: rule.type, enabled: newEnabled },
          dedupeKey: `settings:notification-rule-create:${rule.type}`,
          replaceExisting: true,
        });
        // Reload to get the real ids
        void loadRules();
      } else {
        await queueableJsonRequest({
          domain: 'Settings',
          kind: 'settings.notification_rule',
          method: 'PATCH',
          url: ROUTES.notificationRules.detail(rule.id),
          body: { enabled: newEnabled },
          dedupeKey: `settings:notification-rule:${rule.id}`,
          replaceExisting: true,
        });
      }
    } catch {
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, enabled: rule.enabled } : r));
    } finally {
      setToggling(null);
    }
  }, [loadRules]);

  const displayRules = useMemo((): NotificationRule[] => {
    if (rules.length > 0) return rules;
    // Return placeholder rules that will create real backend rules when toggled
    return DEFAULT_TYPES.map((t) => ({ id: t, type: t, enabled: true, _isPlaceholder: true }));
  }, [rules]);

  return (
    <View style={{ gap: 0 }}>
      <Text style={{ color: palette.text, fontSize: 17, fontWeight: '700', marginBottom: 10 }}>
        Notification preferences
      </Text>
      {error ? (
        <View style={{ alignItems: 'center', paddingVertical: 16, gap: 8 }}>
          <Text style={{ color: palette.danger, fontSize: 13, textAlign: 'center' }}>{error}</Text>
          <Pressable
            onPress={() => void loadRules()}
            style={{ paddingHorizontal: 20, paddingVertical: 8, backgroundColor: palette.primary, borderRadius: 8 }}
          >
            <Text style={{ color: palette.onPrimary, fontSize: 13, fontWeight: '600' }}>Retry</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <ActivityIndicator color={palette.primaryStrong} style={{ marginVertical: 8 }} />
      ) : (
        <View
          style={{
            borderWidth: 1,
            borderColor: palette.divider,
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          {displayRules.map((rule, idx) => {
            const label = RULE_LABELS[rule.type ?? ''] ?? (rule.type ?? 'Unknown');
            const isLast = idx === displayRules.length - 1;
            return (
              <View
                key={rule.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 14,
                  paddingVertical: 13,
                  backgroundColor: palette.surface,
                  borderBottomWidth: isLast ? 0 : 1,
                  borderBottomColor: palette.divider,
                }}
              >
                <Text style={{ color: palette.text, fontSize: 14 }}>{label}</Text>
                <Switch
                  value={rule.enabled}
                  onValueChange={() => toggle(rule)}
                  disabled={toggling === rule.id}
                  trackColor={{ false: palette.divider, true: palette.primary }}
                  thumbColor={palette.ivory}
                />
              </View>
            );
          })}
        </View>
      )}
      {rules.length === 0 && !loading && (
        <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 6 }}>
          Preferences are saved per type once your account has rules configured.
        </Text>
      )}
    </View>
  );
}

export default function ProfileNotificationsScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const responsive = useResponsiveLayout();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InAppNotification[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchInAppNotifications();
      setItems(list);
    } catch (loadError: any) {
      setError(loadError?.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const unreadCount = useMemo(() => items.filter((item) => !item.readAt).length, [items]);

  const openNotification = useCallback(
    async (item: InAppNotification) => {
      try {
        await markInAppNotificationAsRead(item.id);
      } catch (err: any) {
        console.warn('[ProfileNotificationsScreen] mark-as-read failed', err?.message);
      }
      navigation.navigate('ProfileNotificationDetail', {
        notificationId: item.id,
        notification: item,
      });
    },
    [navigation],
  );

  const removeNotification = useCallback(async (item: InAppNotification) => {
    try {
      await deleteInAppNotification(item.id);
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
    } catch (deleteError: any) {
      setError(deleteError?.message || 'Unable to delete notification.');
    }
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: responsive.pageGutter, gap: 14, width: '100%', maxWidth: responsive.contentMaxWidth, alignSelf: 'center' }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: palette.text, fontSize: responsive.headerTitleSize, fontWeight: '800' }}>Notifications</Text>
        <Text style={{ color: palette.subtext }}>{unreadCount} unread notification{unreadCount === 1 ? '' : 's'}.</Text>
      </View>

      <NotificationPreferencesPanel />

      <NotificationRetentionPreviewCard
        palette={palette}
        kind="profile"
        title="Notification and digest preview"
        subtitle="Smarter digests, saved-content nudges, and attention controls are visible for planning only."
      />

      {loading ? <ActivityIndicator color={palette.primaryStrong} /> : null}
      {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}

      {!loading && !items.length ? (
        <View style={{ padding: 18, borderWidth: 1, borderColor: palette.divider, borderRadius: 18, backgroundColor: palette.surface }}>
          <Text style={{ color: palette.text, fontWeight: '700' }}>No notifications yet.</Text>
        </View>
      ) : null}

      {items.map((item) => (
        <View
          key={item.id}
          style={{
            borderWidth: 1,
            borderColor: item.readAt ? palette.divider : palette.primaryStrong,
            borderRadius: 18,
            backgroundColor: palette.surface,
            padding: 14,
            flexDirection: 'row',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <Pressable onPress={() => openNotification(item)} style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700' }}>{item.title}</Text>
            <Text style={{ color: palette.subtext }}>{item.body}</Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown time'}
            </Text>
          </Pressable>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Pressable onPress={() => openNotification(item)} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <KISIcon name="chevron-right" size={18} color={palette.subtext} />
            </Pressable>
            <Pressable onPress={() => removeNotification(item)} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <KISIcon name="trash" size={16} color={palette.subtext} />
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
    </SafeAreaView>
  );
}
