// src/push/notificationRouter.ts
// Maps incoming notification payload fields to the correct navigation target.

import { DeviceEventEmitter } from 'react-native';

export function routeNotification(
  data: Record<string, string>,
  navigation: any,
): void {
  try {
    const {
      type,
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

    // Nest's own push payloads (notifyNewMessage/notifyIncomingCall/
    // notifyMissedCall in notifications.service.ts) send camelCase
    // 'conversationId', not 'conversation_id' - this destructuring only
    // ever read the snake_case form, so this whole branch silently never
    // fired for a real message push. Read both defensively, same as the
    // per-chat-sound/channel-toggle checks in notifications.ts already do.
    const conversation_id = data?.conversationId ?? data?.conversation_id;

    // Conversation / chat message — open the exact chat room, not just the
    // Messages tab. 'MainTabs' -> 'Messages' with a conversationId param
    // used to be the whole implementation here, but ChatRoomPage isn't a
    // navigator screen at all - it's rendered by AppNavigator's own
    // chatHistory local state, and MessagesScreen never reads an incoming
    // conversationId param to open it. 'chat.open' is the real, established
    // bridge into that state (see AppNavigator.tsx's listener + every other
    // "jump into a specific chat" call site: ChatRoomPage, ChatInfoPage,
    // GlobalSearchScreen, etc.) - it works regardless of which tab is
    // currently active since the chat renders as an overlay above the tabs.
    if (conversation_id) {
      DeviceEventEmitter.emit('chat.open', {
        conversationId: String(conversation_id),
        name: data.sender_name ?? data.title ?? 'Chat',
        kind: data.chat_kind,
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

    // Wallet transaction notifications — WalletScreen (route 'Wallet') was
    // retired in the billing/rewards project's mobile consolidation
    // (Phase 8): its "Billing" tab duplicated InvoiceListScreen, which is
    // the actual home for WalletTransaction/payment records now.
    if (transaction_id) {
      navigation.navigate('InvoiceList');
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

    // Connection / friend request notifications — go to the Connections screen.
    if (type === 'connection_request' || data.connection_id || data.sender_id) {
      navigation.navigate('Connections');
      return;
    }

    // Job application status updates — go to the user's applications list.
    if (type === 'job_application_update' || data.job_id || data.application_id) {
      navigation.navigate('MyApplications');
      return;
    }

    // Testimony engagement (reach/reactions on a testimony post).
    if (type === 'testimony_reach' || data.testimony_id) {
      navigation.navigate('TestimonyHub');
      return;
    }

    // Call notifications — no dedicated calls tab exists; navigate to Messages
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
