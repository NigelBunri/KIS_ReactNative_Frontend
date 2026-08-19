import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import {
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';

type Props = NativeStackScreenProps<RootStackParamList, 'WebsiteWebhooks'>;

type Webhook = { id: string; event_type: string; target_url: string; is_active: boolean; created_at: string };

const EVENT_TYPES: Array<{ value: string; label: string }> = [
  { value: 'published', label: 'Website Published' },
  { value: 'unpublished', label: 'Website Unpublished' },
  { value: 'form_submitted', label: 'Form Submitted' },
];

export default function WebsiteWebhooksScreen({ route }: Props) {
  const { websiteId } = route.params;
  const palette = getHealthThemeColors('light');
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [loading, setLoading] = useState(true);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [eventType, setEventType] = useState('published');
  const [targetUrl, setTargetUrl] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.websites.webhooks(websiteId));
      const data = (res as any)?.data ?? res;
      setWebhooks(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const handleCreate = useCallback(async () => {
    if (!targetUrl.trim().startsWith('https://')) {
      Alert.alert('Webhooks', 'target URL must start with https://');
      return;
    }
    setCreating(true);
    try {
      const res = await postRequest(
        ROUTES.websites.webhooks(websiteId),
        { event_type: eventType, target_url: targetUrl.trim() },
        { errorMessage: 'Unable to create webhook.' },
      );
      const data = (res as any)?.data ?? res;
      if (!res?.success) throw new Error((res as any)?.message || 'Unable to create webhook.');
      Alert.alert(
        'Webhook Created',
        `Signing secret (shown only once — save it now):\n\n${data.secret}`,
      );
      setTargetUrl('');
      await load();
    } catch (error: any) {
      Alert.alert('Webhooks', error?.message || 'Unable to create webhook.');
    } finally {
      setCreating(false);
    }
  }, [websiteId, eventType, targetUrl, load]);

  const handleDelete = useCallback((webhook: Webhook) => {
    Alert.alert('Delete webhook', `Stop sending "${webhook.event_type}" events to this URL?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteRequest(ROUTES.websites.webhookDetail(websiteId, webhook.id), { errorMessage: 'Unable to delete webhook.' });
          await load();
        },
      },
    ]);
  }, [websiteId, load]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.accentPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ padding: spacing.md }}>
        <Text style={{ ...typography.h2, color: palette.text }}>Webhooks</Text>
        <Text style={{ ...typography.caption, color: palette.subtext, marginTop: 2 }}>
          Notify another system (e.g. Zapier, your own server) when something happens on this website.
        </Text>

        <Text style={{ ...typography.label, color: palette.text, marginTop: spacing.md }}>Event</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
          {EVENT_TYPES.map((option) => (
            <KISButton
              key={option.value}
              title={option.label}
              size="sm"
              variant={eventType === option.value ? 'primary' : 'outline'}
              onPress={() => setEventType(option.value)}
            />
          ))}
        </View>
        <KISTextInput
          label="Target URL"
          placeholder="https://..."
          value={targetUrl}
          onChangeText={setTargetUrl}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ marginTop: spacing.sm }}
        />
        <View style={{ marginTop: spacing.sm }}>
          <KISButton title="Add Webhook" onPress={handleCreate} disabled={creating || !targetUrl.trim()} />
        </View>
      </View>
      <FlatList
        data={webhooks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0, gap: spacing.sm }}
        ListEmptyComponent={<Text style={{ ...typography.body, color: palette.subtext }}>No webhooks yet.</Text>}
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: spacing.md,
              borderWidth: 1,
              borderColor: palette.divider,
              backgroundColor: palette.card,
              padding: spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.label, color: palette.text }}>{item.event_type}</Text>
              <Text style={{ ...typography.caption, color: palette.subtext }} numberOfLines={1}>{item.target_url}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item)}>
              <Text style={{ ...typography.label, color: '#B42318' }}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
