import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import type { RootStackParamList } from '@/navigation/types';
import { KISIcon } from '@/constants/kisIcons';
import {
  deleteInAppNotification,
  fetchInAppNotifications,
  markInAppNotificationAsRead,
  type InAppNotification,
} from '@/services/inAppNotificationService';

export default function ProfileNotificationsScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
      } catch {}
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
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 20, gap: 14 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: palette.text, fontSize: 28, fontWeight: '800' }}>Notifications</Text>
        <Text style={{ color: palette.subtext }}>{unreadCount} unread notification{unreadCount === 1 ? '' : 's'}.</Text>
      </View>

      {loading ? <ActivityIndicator color={palette.primaryStrong} /> : null}
      {error ? <Text style={{ color: palette.error || '#E53935' }}>{error}</Text> : null}

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
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => openNotification(item)}>
              <KISIcon name="chevron-right" size={18} color={palette.subtext} />
            </Pressable>
            <Pressable onPress={() => removeNotification(item)}>
              <KISIcon name="trash" size={16} color={palette.subtext} />
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
