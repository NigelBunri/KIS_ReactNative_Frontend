import React, { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import type { RootStackParamList } from '@/navigation/types';
import { markInAppNotificationAsRead, type InAppNotification } from '@/services/inAppNotificationService';
import { routeNotification } from '@/push/notificationRouter';

// Maps a backend Notification's target_type/target_id (see
// apps/notifications/models.py + the mark-source-read target_type alias
// list in apps/notifications/views.py, which is the closest thing to a
// canonical vocabulary for these values) onto the field shape
// routeNotification already knows how to navigate from a push payload -
// one router for "where does this notification actually go," reused
// instead of re-deriving navigation logic here. Conservative on purpose:
// an unrecognized/ambiguous target_type shows no "Go to" action rather
// than guessing and landing somewhere wrong.
function buildRouteNotificationData(item: InAppNotification): Record<string, string> | null {
  const targetType = String(item.targetType || '').toLowerCase();
  const targetId = item.targetId;
  if (!targetId) return null;
  switch (targetType) {
    case 'conversation':
    case 'chat':
    case 'message':
      return { conversationId: targetId, title: item.title };
    case 'channel_content':
      return { channel_content_id: targetId };
    case 'channel':
      return { channel_id: targetId };
    case 'partner_community':
    case 'partner_group':
    case 'community':
    case 'partner':
      return { partner_id: targetId };
    default:
      return null;
  }
}

// Education content (courses/lessons) opens through BroadcastScreen's own
// education sub-tab + actionId param (see deepLinkRouter.ts's identical
// 'education/courses/:id' handling) rather than routeNotification's flat
// field set, which has no education branch.
const EDUCATION_TARGET_TYPES = new Set(['education_content', 'course', 'lesson']);

export default function ProfileNotificationDetailScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProfileNotificationDetail'>>();
  const notification = route.params?.notification;

  useEffect(() => {
    if (route.params?.notificationId) {
      markInAppNotificationAsRead(route.params.notificationId).catch(() => undefined);
    }
  }, [route.params?.notificationId]);

  const goToSource = useMemo(() => {
    if (!notification) return null;
    const targetType = String(notification.targetType || '').toLowerCase();
    if (EDUCATION_TARGET_TYPES.has(targetType) && notification.targetId) {
      return () => navigation.navigate('MainTabs', {
        screen: 'Broadcast',
        params: { mainTab: 'education', actionId: notification.targetId },
      });
    }
    const data = buildRouteNotificationData(notification);
    if (!data) return null;
    return () => routeNotification(data, navigation);
  }, [notification, navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, }} edges={['top']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: responsive.pageGutter, gap: 16, width: '100%', maxWidth: responsive.contentMaxWidth, alignSelf: 'center' }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: palette.text, fontSize: responsive.headerTitleSize, fontWeight: '800' }}>
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

        {goToSource ? (
          <Pressable
            onPress={goToSource}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderRadius: 999,
              paddingVertical: 14,
              backgroundColor: palette.primaryStrong,
            }}
          >
            <Text style={{ color: palette.onPrimary, fontWeight: '800', fontSize: 15 }}>Go to</Text>
            <KISIcon name="chevron-right" size={16} color={palette.onPrimary} />
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
