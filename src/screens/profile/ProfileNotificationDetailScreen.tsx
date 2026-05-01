import React, { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import type { RootStackParamList } from '@/navigation/types';
import { markInAppNotificationAsRead } from '@/services/inAppNotificationService';

export default function ProfileNotificationDetailScreen() {
  const { palette } = useKISTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'ProfileNotificationDetail'>>();
  const notification = route.params?.notification;

  useEffect(() => {
    if (route.params?.notificationId) {
      markInAppNotificationAsRead(route.params.notificationId).catch(() => undefined);
    }
  }, [route.params?.notificationId]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 20, gap: 16 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: palette.text, fontSize: 28, fontWeight: '800' }}>
          {notification?.title || 'Notification'}
        </Text>
        <Text style={{ color: palette.subtext }}>
          {notification?.createdAt ? new Date(notification.createdAt).toLocaleString() : 'Unknown time'}
        </Text>
      </View>

      <View
        style={{
          borderWidth: 1,
          borderColor: palette.divider,
          borderRadius: 20,
          backgroundColor: palette.surface,
          padding: 18,
          gap: 10,
        }}
      >
        <Text style={{ color: palette.text, fontSize: 16, lineHeight: 24 }}>
          {notification?.body || 'No notification message was provided.'}
        </Text>
        <Text style={{ color: palette.subtext, fontSize: 12 }}>
          Type: {notification?.kind || 'backend'}
        </Text>
        <Text style={{ color: palette.subtext, fontSize: 12 }}>
          Status: {notification?.readAt ? 'Read' : 'Unread'}
        </Text>
      </View>
    </ScrollView>
  );
}
