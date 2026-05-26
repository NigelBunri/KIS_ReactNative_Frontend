// src/push/notificationRouter.ts
// Maps incoming notification payload fields to the correct navigation target.

export function routeNotification(
  data: Record<string, string>,
  navigation: any,
): void {
  try {
    const {
      type,
      conversation_id,
      broadcast_id,
      channel_id,
      event_id,
      partner_id,
      org_app_id,
    } = data ?? {};

    // Conversation / chat message — deep-link into Messages tab.
    if (conversation_id) {
      navigation.navigate('MainTabs', {
        screen: 'Messages',
        params: { conversationId: conversation_id },
      });
      return;
    }

    // Broadcast post detail.
    if (broadcast_id) {
      navigation.navigate('BroadcastDetail', { id: broadcast_id });
      return;
    }

    // Channel home.
    if (channel_id) {
      navigation.navigate('ChannelHome', { channelId: channel_id });
      return;
    }

    // Event listing.
    if (event_id || type === 'event') {
      navigation.navigate('Events');
      return;
    }

    // Org app launch (requires both ids).
    if (org_app_id && partner_id) {
      navigation.navigate('OrgAppLaunch', {
        partnerId: partner_id,
        appId: org_app_id,
      });
      return;
    }

    // Partner tab.
    if (partner_id || type === 'partner') {
      navigation.navigate('MainTabs', { screen: 'Partners' });
      return;
    }

    // Fallback — go to home (MainTabs default screen).
    navigation.navigate('MainTabs');
  } catch (err: any) {
    if (__DEV__) {
      console.log('[notificationRouter] navigation error:', err?.message);
    }
  }
}
