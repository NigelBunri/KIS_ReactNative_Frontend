// src/components/partners/PartnerActivityPanel.tsx
//
// Fixes a real gap: the Partners tab badge counts two things that had no
// viewing UI anywhere in the app — the partner's own announcement
// conversation (Partner.main_conversation, never opened by any screen) and
// partner/community-tagged generic Notification rows (previously only
// visible via Profile's notification screen, and silently marked read by
// CommunityRoomPage on mount, a different tab entirely, before the user had
// ever seen them here). This panel is the actual place to view both, and is
// now also the place that marks them read — on open, not on some unrelated
// screen's mount.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, DeviceEventEmitter, Pressable, ScrollView, Text, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import {
  fetchInAppNotifications,
  type InAppNotification,
} from '@/services/inAppNotificationService';
import { markMainTabNotificationSourceRead } from '@/services/mainTabNotificationBadges';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
};

// Mirrors the backend's PARTNER_NOTIFICATION_TOKENS (badge_counts.py) so
// this panel shows the same rows the Partners tab badge is counting —
// keeping "what lit up the badge" and "what you see here" the same set.
const PARTNER_TOKENS = ['partner', 'community', 'partner_group', 'group_message'];

export const matchesPartnerTokens = (item: InAppNotification): boolean => {
  const haystack = [item.notificationType, item.targetType, item.title, item.body]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return PARTNER_TOKENS.some((token) => haystack.includes(token));
};

const timeAgo = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function PartnerActivityPanel({ isOpen, panelWidth, panelTranslateX, partnerId, onClose }: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [mainConversationId, setMainConversationId] = useState<string | null>(null);

  const backdropOpacity = panelTranslateX.interpolate({ inputRange: [0, panelWidth], outputRange: [1, 0], extrapolate: 'clamp' });

  const load = useCallback(async () => {
    const tasks: Promise<any>[] = [fetchInAppNotifications()];
    if (partnerId) {
      tasks.push(getRequest(ROUTES.partners.detail(partnerId), { errorMessage: 'Unable to load partner details.' }));
    }
    const [all, partnerRes] = await Promise.all(tasks);
    setItems((all as InAppNotification[]).filter(matchesPartnerTokens));
    if (partnerRes?.data) {
      setPartnerName(partnerRes.data.name ?? null);
      setMainConversationId(partnerRes.data.main_conversation_id ?? null);
    }
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    load().finally(() => setLoading(false));
    // Marking read here — not from some other screen's mount effect — is
    // the actual fix: this is now the one place a user can genuinely see
    // what these notifications are, so this is the correct moment to clear
    // them. markMainTabNotificationSourceRead already emits the badge-
    // refresh event on success, so the tab badge updates immediately.
    markMainTabNotificationSourceRead({ source: 'partners' }).catch(() => undefined);
  }, [isOpen, load]);

  const openAnnouncements = useCallback(() => {
    if (!mainConversationId) return;
    DeviceEventEmitter.emit('chat.open', {
      conversationId: String(mainConversationId),
      name: partnerName ? `${partnerName} Announcements` : 'Partner Announcements',
      kind: 'dm',
    });
    onClose();
  }, [mainConversationId, partnerName, onClose]);

  const hasAnnouncements = Boolean(mainConversationId);

  if (!isOpen) return null;

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.settingsPanelBackdrop, { backgroundColor: palette.backdrop, opacity: backdropOpacity }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          { width: panelWidth, backgroundColor: palette.surfaceElevated, borderLeftColor: palette.divider, transform: [{ translateX: panelTranslateX }] },
        ]}
      >
        <View style={[styles.settingsPanelHeader, { borderBottomColor: palette.divider }]}>
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Partner Activity</Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              Announcements & notifications for {partnerName ?? 'this partner'}
            </Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <>
              {hasAnnouncements ? (
                <Pressable
                  onPress={openAnnouncements}
                  style={[styles.settingsFeatureRow, { borderColor: palette.primary, backgroundColor: `${palette.primary}11`, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }]}
                >
                  <KISIcon name="chat" size={20} color={palette.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>Partner Announcements</Text>
                    <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>
                      The partner-wide conversation — open it here
                    </Text>
                  </View>
                  <KISIcon name="chevron-right" size={16} color={palette.subtext} />
                </Pressable>
              ) : null}

              <Text style={{ color: palette.text, fontSize: 13, fontWeight: '800', marginBottom: 8 }}>
                Notifications ({items.length})
              </Text>
              {items.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginTop: 20 }}>
                  Nothing here right now.
                </Text>
              ) : (
                items.map((item) => (
                  <View
                    key={item.id}
                    style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}
                  >
                    <Text style={[styles.settingsFeatureTitle, { color: palette.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.body ? (
                      <Text style={{ color: palette.text, fontSize: 13, marginTop: 4 }} numberOfLines={3}>
                        {item.body}
                      </Text>
                    ) : null}
                    <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 6 }}>{timeAgo(item.createdAt)}</Text>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
