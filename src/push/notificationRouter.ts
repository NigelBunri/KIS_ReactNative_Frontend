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
      channel_content_id,
      event_id,
      partner_id,
      org_app_id,
      appointment_id,
      health_service_session_id,
      order_id,
      invoice_id,
      transaction_id,
      subscription_id,
      stream_id,
      live_id,
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

    // Channel content deep-link (specific post/content inside a channel).
    if (channel_content_id) {
      navigation.navigate('ChannelContentDetail', { contentId: channel_content_id });
      return;
    }

    // Channel home.
    if (channel_id) {
      navigation.navigate('ChannelHome', { channelId: channel_id });
      return;
    }

    // Live stream notifications.
    if (stream_id || live_id) {
      navigation.navigate('LiveWatch', { streamId: stream_id || live_id });
      return;
    }

    // Health appointment reminders — navigate to HealthServiceSession when we
    // have enough context, HealthInstitutionDetail when we only have the
    // institution, or fall back to Profile.
    if (appointment_id || health_service_session_id) {
      const sessionId = health_service_session_id || appointment_id;
      if (data.institution_id && data.card_id) {
        navigation.navigate('HealthServiceSession', {
          institutionId: data.institution_id,
          institutionType: (data.institution_type as any) || 'clinic',
          cardId: data.card_id,
          sessionId,
          serviceName: data.service_name || 'Appointment',
          workflowSessionId: data.workflow_session_id,
          appointmentBookingId: appointment_id,
        });
      } else if (data.institution_id) {
        navigation.navigate('HealthInstitutionDetail', {
          institutionId: data.institution_id,
          institutionType: (data.institution_type as any) || 'clinic',
          institutionName: data.institution_name,
        });
      } else {
        navigation.navigate('MainTabs', { screen: 'Profile' });
      }
      return;
    }

    // Order status notifications.
    if (order_id) {
      navigation.navigate('MarketplaceOrderDetail', {
        orderId: order_id,
        mode: 'buyer',
      });
      return;
    }

    // Payment / billing notifications — go to invoice list or wallet.
    if (invoice_id) {
      navigation.navigate('InvoiceList');
      return;
    }

    // Wallet transaction notifications.
    if (transaction_id) {
      navigation.navigate('Wallet');
      return;
    }

    // Subscription lifecycle notifications.
    if (subscription_id || type === 'subscription') {
      navigation.navigate('SubscriptionManagement');
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

    // Call notifications — calls are handled via socket, navigate to Messages
    // where call history is visible.
    if (data.call_id || data.callId) {
      navigation.navigate('MainTabs', { screen: 'Messages' });
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
