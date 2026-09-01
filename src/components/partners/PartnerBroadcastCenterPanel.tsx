// src/components/partners/PartnerBroadcastCenterPanel.tsx
//
// Broadcast Center & Announcement Scheduler: admins compose an
// announcement and either send it to the partner feed immediately or
// schedule it for a future publish time, with a queue view of pending
// scheduled items. Backed by apps.partners.PartnerPost's new
// status/scheduled_for fields (not a separate model) — a scheduled
// announcement is just a PartnerPost that becomes visible in the normal
// feed once apps.partners.tasks.publish_due_scheduled_posts_task (a
// django_celery_beat sweep, 5-min interval) or an admin's "Publish now"
// flips it to published.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
};

type QueuedPost = {
  id: string;
  text_preview: string;
  scheduled_for: string;
  author: { display_name?: string | null };
};

const inputStyle = (palette: any) => ({
  color: palette.text,
  borderColor: palette.borderMuted,
  borderWidth: 2,
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderRadius: 10,
  marginTop: 8,
});

const buildPlainTextDoc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
});

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function PartnerBroadcastCenterPanel({ isOpen, panelWidth, panelTranslateX, partnerId, onClose }: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<QueuedPost[]>([]);
  const [text, setText] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [saving, setSaving] = useState(false);

  const backdropOpacity = panelTranslateX.interpolate({ inputRange: [0, panelWidth], outputRange: [1, 0], extrapolate: 'clamp' });

  const loadQueue = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.postQueue(partnerId), { errorMessage: 'Unable to load the announcement queue.' });
    const payload = res?.data ?? [];
    setQueue(Array.isArray(payload) ? payload : []);
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    loadQueue().finally(() => setLoading(false));
  }, [isOpen, loadQueue]);

  const send = async (mode: 'now' | 'schedule') => {
    if (!partnerId || !text.trim()) {
      Alert.alert('Missing text', 'Write your announcement first.');
      return;
    }
    if (mode === 'schedule' && !scheduledFor.trim()) {
      Alert.alert('Missing time', 'Enter a schedule time (e.g. 2026-10-01T09:00:00Z).');
      return;
    }
    setSaving(true);
    const res = await postRequest(
      ROUTES.partners.posts,
      {
        partner: partnerId,
        text: buildPlainTextDoc(text.trim()),
        ...(mode === 'schedule' ? { scheduled_for: scheduledFor.trim() } : {}),
      },
      { errorMessage: mode === 'schedule' ? 'Unable to schedule announcement.' : 'Unable to send announcement.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to send announcement.');
      return;
    }
    setText('');
    setScheduledFor('');
    Alert.alert(mode === 'schedule' ? 'Scheduled' : 'Sent', mode === 'schedule' ? 'Your announcement will publish at the scheduled time.' : 'Your announcement is live in the partner feed.');
    loadQueue();
  };

  const publishNow = async (post: QueuedPost) => {
    if (!partnerId) return;
    const res = await postRequest(ROUTES.partners.postPublishNow(post.id), {}, { errorMessage: 'Unable to publish now.' });
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to publish now.');
      return;
    }
    loadQueue();
  };

  const cancelScheduled = (post: QueuedPost) => {
    Alert.alert('Cancel announcement?', 'This scheduled announcement will be removed.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel announcement',
        style: 'destructive',
        onPress: async () => {
          const res = await postRequest(ROUTES.partners.postCancelScheduled(post.id), {}, { errorMessage: 'Unable to cancel.' });
          if (!res?.success) {
            Alert.alert('Failed', res?.message ?? 'Unable to cancel.');
            return;
          }
          loadQueue();
        },
      },
    ]);
  };

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
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Broadcast Center</Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>Compose and schedule announcements</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          <Text style={{ color: palette.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>New announcement</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Write your announcement…"
            placeholderTextColor={palette.subtext}
            multiline
            style={[inputStyle(palette), { minHeight: 90, textAlignVertical: 'top', marginTop: 0 }]}
          />
          <TextInput
            value={scheduledFor}
            onChangeText={setScheduledFor}
            placeholder="Schedule for (optional, e.g. 2026-10-01T09:00:00Z)"
            placeholderTextColor={palette.subtext}
            style={inputStyle(palette)}
            autoCapitalize="none"
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 24 }}>
            <Pressable
              onPress={() => send('now')}
              disabled={saving}
              style={({ pressed }) => [{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: palette.royalInk, opacity: pressed || saving ? 0.7 : 1 }]}
            >
              <Text style={{ color: palette.ivory, fontWeight: '700' }}>{saving ? 'Sending…' : 'Send now'}</Text>
            </Pressable>
            <Pressable
              onPress={() => send('schedule')}
              disabled={saving}
              style={({ pressed }) => [{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: palette.primary, opacity: pressed || saving ? 0.7 : 1 }]}
            >
              <Text style={{ color: palette.primary, fontWeight: '700' }}>{saving ? 'Scheduling…' : 'Schedule'}</Text>
            </Pressable>
          </View>

          <Text style={{ color: palette.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>
            Scheduled queue ({queue.length})
          </Text>
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : queue.length === 0 ? (
            <Text style={{ color: palette.subtext, fontSize: 13 }}>Nothing scheduled.</Text>
          ) : (
            queue.map((post) => (
              <View key={post.id} style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}>
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]} numberOfLines={2}>
                  {post.text_preview || '(no text)'}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>
                  Publishes {formatWhen(post.scheduled_for)}
                  {post.author?.display_name ? ` · ${post.author.display_name}` : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                  <Pressable onPress={() => publishNow(post)}>
                    <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '700' }}>Publish now</Text>
                  </Pressable>
                  <Pressable onPress={() => cancelScheduled(post)}>
                    <Text style={{ color: palette.danger, fontSize: 12, fontWeight: '700' }}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
