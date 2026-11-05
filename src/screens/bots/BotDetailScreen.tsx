// src/screens/bots/BotDetailScreen.tsx
// Single bot's management surface — status controls, credentials
// (secret shown once, exactly when issued/rotated), resource connections
// (grants a Group this user owns/administers access to the bot, with
// explicit permission scopes - never broader than what the owner
// themselves can do, enforced server-side), webhook subscription, and a
// tail of recent activity. Every control here calls a real backend
// endpoint; nothing is a placeholder.
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import { putData } from '@/network/put';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';

type Bot = {
  id: string;
  owner: string;
  name: string;
  handle: string;
  description: string;
  kind: string;
  status: string;
  has_credential: boolean;
  has_webhook: boolean;
  has_ai_connection: boolean;
  resource_count: number;
};

type Credential = {
  client_id: string;
  client_secret: string | null;
  scopes: string[];
  created_at: string;
};

type Grant = {
  id: string;
  resource_type: string;
  resource_id: string;
  resource_display_name: string;
  scopes: string[];
  is_currently_valid: boolean;
  granted_by_display_name: string | null;
  created_at: string;
};

type ActivityItem = {
  id: string;
  action: string;
  resource_type: string;
  metadata: Record<string, any>;
  created_at: string;
};

type AIConnection = {
  id: string;
  provider: string;
  has_api_key: boolean;
  custom_endpoint_url: string;
  model: string;
  system_instructions: string;
  is_active: boolean;
} | null;

type Approval = {
  id: string;
  action: string;
  details: Record<string, any>;
  status: string;
  created_at: string;
};

const SCOPE_OPTIONS = ['read_messages', 'send_messages', 'read_members', 'moderate', 'publish_content', 'manage_resource'];

const AI_PROVIDER_OPTIONS: { key: string; label: string }[] = [
  { key: 'openai', label: 'OpenAI' },
  { key: 'anthropic', label: 'Anthropic' },
  { key: 'gemini', label: 'Google Gemini' },
  { key: 'custom', label: 'Custom endpoint' },
];

const RESOURCE_TYPE_OPTIONS: { key: string; label: string; hint: string }[] = [
  { key: 'group', label: 'Group', hint: "Open the group's info screen to find its ID." },
  { key: 'channel', label: 'Channel', hint: "Open the channel's info screen to find its ID." },
  { key: 'community', label: 'Community', hint: "Open the community's info screen to find its ID." },
  { key: 'partner', label: 'Partner', hint: "Open your partner page's settings to find its ID." },
  { key: 'direct_conversation', label: 'Direct message', hint: 'Paste the conversation ID for the direct message thread.' },
  { key: 'feed_profile', label: 'My feed', hint: 'Connects this bot to your own profile feed — no ID needed.' },
];

function SectionCard({ title, children, palette }: { title: string; children: React.ReactNode; palette: any }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: palette.divider,
        backgroundColor: palette.card,
        borderRadius: 18,
        padding: 14,
        gap: 10,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '900', color: palette.text }}>{title}</Text>
      {children}
    </View>
  );
}

export default function BotDetailScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const botId: string = route.params?.botId;

  const [bot, setBot] = useState<Bot | null>(null);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [aiConnection, setAiConnection] = useState<AIConnection>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [resourceType, setResourceType] = useState('group');
  const [resourceIdInput, setResourceIdInput] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['send_messages']);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [aiProvider, setAiProvider] = useState('openai');
  const [aiApiKeyInput, setAiApiKeyInput] = useState('');
  const [aiModelInput, setAiModelInput] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const [botRes, credRes, grantsRes, activityRes, aiRes, approvalsRes] = await Promise.all([
      getRequest(ROUTES.bots.detail(botId), { forceNetwork: isRefresh }),
      getRequest(ROUTES.bots.credential(botId), { forceNetwork: isRefresh }),
      getRequest(ROUTES.bots.resourceGrants(botId), { forceNetwork: isRefresh }),
      getRequest(ROUTES.bots.activity(botId), { forceNetwork: isRefresh }),
      getRequest(ROUTES.bots.aiConnection(botId), { forceNetwork: isRefresh }),
      getRequest(ROUTES.bots.approvals(botId), { forceNetwork: isRefresh }),
    ]);
    if (botRes?.success) setBot(botRes.data);
    if (credRes?.success) setCredential(credRes.data);
    if (grantsRes?.success) setGrants(grantsRes.data ?? []);
    if (activityRes?.success) setActivity(activityRes.data ?? []);
    if (aiRes?.success) setAiConnection(aiRes.data ?? null);
    if (approvalsRes?.success) setApprovals(approvalsRes.data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [botId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const runStatusAction = async (action: 'activate' | 'pause' | 'resume' | 'disconnect') => {
    setBusy(true);
    const urlMap = {
      activate: ROUTES.bots.activate(botId),
      pause: ROUTES.bots.pause(botId),
      resume: ROUTES.bots.resume(botId),
      disconnect: ROUTES.bots.disconnect(botId),
    };
    const res = await postRequest(urlMap[action], {});
    setBusy(false);
    if (res?.success) {
      setBot(res.data);
    } else {
      Alert.alert('Action failed', res?.message || 'Please try again.');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete this bot?', 'This revokes its credentials and disconnects it from every resource. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteRequest(ROUTES.bots.detail(botId));
          if (res?.success) navigation.goBack();
          else Alert.alert('Could not delete bot', res?.message || 'Please try again.');
        },
      },
    ]);
  };

  const handleIssueCredential = async () => {
    setBusy(true);
    const res = await postRequest(ROUTES.bots.credential(botId), { scopes: ['read_messages', 'send_messages'] });
    setBusy(false);
    if (res?.success) {
      setCredential(res.data);
      Alert.alert(
        'Save this secret now',
        `Client ID: ${res.data.client_id}\n\nClient secret:\n${res.data.client_secret}\n\nThis secret will never be shown again.`,
      );
    } else {
      Alert.alert('Could not issue credential', res?.message || 'Please try again.');
    }
  };

  const handleRevokeCredential = () => {
    Alert.alert('Revoke credential?', 'Any externally-hosted bot using this credential will immediately stop working.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteRequest(ROUTES.bots.credential(botId));
          if (res?.success || res === undefined) setCredential(null);
          void load(true);
        },
      },
    ]);
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  };

  const handleConnectResource = async () => {
    const resourceId = resourceType === 'feed_profile' ? bot?.owner : resourceIdInput.trim();
    if (!resourceId) {
      Alert.alert('Resource ID required', 'Paste the ID of the resource you want to connect.');
      return;
    }
    setBusy(true);
    const res = await postRequest(ROUTES.bots.resourceGrants(botId), {
      resource_type: resourceType,
      resource_id: resourceId,
      scopes: selectedScopes,
    });
    setBusy(false);
    if (res?.success) {
      setResourceIdInput('');
      void load(true);
    } else {
      Alert.alert('Could not connect', res?.message || 'You must be an owner/admin of this resource.');
    }
  };

  const handleRevokeGrant = (grantId: string) => {
    Alert.alert('Disconnect this resource?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await deleteRequest(ROUTES.bots.resourceGrantDetail(botId, grantId));
          void load(true);
        },
      },
    ]);
  };

  const handleSaveWebhook = async () => {
    if (!webhookUrl.trim()) return;
    setBusy(true);
    const res = await putData(ROUTES.bots.webhook(botId), {
      url: webhookUrl.trim(),
      events: ['message.created'],
    });
    setBusy(false);
    if (res?.success) {
      if (res.data?.secret) {
        Alert.alert('Webhook secret', `Use this to verify incoming payloads (HMAC-SHA256):\n\n${res.data.secret}`);
      }
      setWebhookUrl('');
      void load(true);
    } else {
      Alert.alert('Could not save webhook', res?.message || 'Please try again.');
    }
  };

  const handleConnectAI = async () => {
    setBusy(true);
    const res = await putData(ROUTES.bots.aiConnection(botId), {
      provider: aiProvider,
      api_key: aiApiKeyInput.trim(),
      model: aiModelInput.trim(),
    });
    setBusy(false);
    if (res?.success) {
      setAiConnection(res.data);
      setAiApiKeyInput('');
      Alert.alert('AI provider connected', 'Your API key is encrypted at rest and never shown again.');
    } else {
      Alert.alert('Could not connect AI provider', res?.message || 'Please check your API key and try again.');
    }
  };

  const handleDisconnectAI = () => {
    Alert.alert('Disconnect AI provider?', 'This bot will stop using AI-generated responses.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await deleteRequest(ROUTES.bots.aiConnection(botId));
          setAiConnection(null);
          void load(true);
        },
      },
    ]);
  };

  const handleDecideApproval = async (approvalId: string, approve: boolean) => {
    setBusy(true);
    const res = await postRequest(ROUTES.bots.decideApproval(approvalId), { approve });
    setBusy(false);
    if (res?.success) {
      setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
    } else {
      Alert.alert('Could not record decision', res?.message || 'Please try again.');
    }
  };

  if (loading && !bot) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.primaryStrong} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: responsive.pageGutter,
          paddingTop: 10,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: palette.divider,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={{ padding: 4 }}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '900', color: palette.text }} numberOfLines={1}>
          {bot?.name ?? route.params?.name ?? 'Bot'}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: responsive.pageGutter, gap: responsive.cardGap }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {bot ? (
          <SectionCard title="Status" palette={palette}>
            <Text style={{ fontSize: 13, color: palette.subtext }}>
              Current status: <Text style={{ fontWeight: '800', color: palette.text }}>{bot.status}</Text>
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {bot.status !== 'active' && bot.status !== 'suspended' ? (
                <KISButton title="Activate" size="sm" onPress={() => runStatusAction(bot.status === 'draft' ? 'activate' : 'resume')} disabled={busy} />
              ) : null}
              {bot.status === 'active' ? (
                <KISButton title="Pause" size="sm" variant="outline" onPress={() => runStatusAction('pause')} disabled={busy} />
              ) : null}
              {bot.status !== 'disconnected' && bot.status !== 'suspended' ? (
                <KISButton title="Disconnect" size="sm" variant="outline" onPress={() => runStatusAction('disconnect')} disabled={busy} />
              ) : null}
              <KISButton title="Delete bot" size="sm" variant="danger" onPress={handleDelete} disabled={busy} />
            </View>
            {bot.status === 'suspended' ? (
              <Text style={{ fontSize: 12, color: palette.danger }}>
                This bot was suspended by KIS. Contact support if you believe this was in error.
              </Text>
            ) : null}
          </SectionCard>
        ) : null}

        <SectionCard title="Developer credentials" palette={palette}>
          <Text style={{ fontSize: 12, color: palette.subtext }}>
            For a custom-developed bot hosted on your own server. Use these to request an access token at the
            bots/oauth/token endpoint.
          </Text>
          {credential ? (
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, color: palette.text }}>Client ID: {credential.client_id}</Text>
              <Text style={{ fontSize: 12, color: palette.subtext }}>
                Secret was shown once at issue/rotation time. Rotate to get a new one.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <KISButton title="Rotate secret" size="sm" variant="outline" onPress={handleIssueCredential} disabled={busy} />
                <KISButton title="Revoke" size="sm" variant="danger" onPress={handleRevokeCredential} disabled={busy} />
              </View>
            </View>
          ) : (
            <KISButton title="Generate credentials" size="sm" onPress={handleIssueCredential} disabled={busy} />
          )}
        </SectionCard>

        <SectionCard title="Connected resources" palette={palette}>
          <Text style={{ fontSize: 12, color: palette.subtext }}>
            Connect this bot to anything you own or administer.
          </Text>
          {grants.map((grant) => (
            <View
              key={grant.id}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                borderTopWidth: 1, borderTopColor: palette.divider, paddingTop: 8,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>
                  {grant.resource_display_name || `${grant.resource_type}: ${grant.resource_id.slice(0, 8)}…`}
                </Text>
                <Text style={{ fontSize: 11, color: palette.subtext }}>{grant.scopes.join(', ')}</Text>
                {grant.granted_by_display_name ? (
                  <Text style={{ fontSize: 11, color: palette.subtext }}>
                    Granted by {grant.granted_by_display_name} on {new Date(grant.created_at).toLocaleDateString()}
                  </Text>
                ) : null}
                {!grant.is_currently_valid ? (
                  <Text style={{ fontSize: 11, color: palette.danger, fontWeight: '700' }}>No longer valid</Text>
                ) : null}
              </View>
              <Pressable onPress={() => handleRevokeGrant(grant.id)} hitSlop={8}>
                <KISIcon name="trash" size={16} color={palette.danger} />
              </Pressable>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {RESOURCE_TYPE_OPTIONS.map((option) => {
              const selected = resourceType === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => { setResourceType(option.key); setResourceIdInput(''); }}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
                    borderWidth: 1.5, borderColor: selected ? palette.primaryStrong : palette.divider,
                    backgroundColor: selected ? palette.primarySoft : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: selected ? palette.primaryStrong : palette.subtext }}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ fontSize: 11, color: palette.subtext }}>
            {RESOURCE_TYPE_OPTIONS.find((o) => o.key === resourceType)?.hint}
          </Text>
          {resourceType !== 'feed_profile' ? (
            <KISTextInput
              value={resourceIdInput}
              onChangeText={setResourceIdInput}
              placeholder={`${RESOURCE_TYPE_OPTIONS.find((o) => o.key === resourceType)?.label} ID`}
            />
          ) : null}
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {SCOPE_OPTIONS.map((scope) => {
              const selected = selectedScopes.includes(scope);
              return (
                <Pressable
                  key={scope}
                  onPress={() => toggleScope(scope)}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
                    borderWidth: 1.5, borderColor: selected ? palette.primaryStrong : palette.divider,
                    backgroundColor: selected ? palette.primarySoft : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: selected ? palette.primaryStrong : palette.subtext }}>
                    {scope.replace('_', ' ')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <KISButton
            title={`Connect ${RESOURCE_TYPE_OPTIONS.find((o) => o.key === resourceType)?.label.toLowerCase()}`}
            size="sm"
            onPress={handleConnectResource}
            disabled={busy}
          />
        </SectionCard>

        <SectionCard title="Webhook" palette={palette}>
          <Text style={{ fontSize: 12, color: palette.subtext }}>
            Receive signed event notifications (e.g. message.created) at your own endpoint.
          </Text>
          <KISTextInput value={webhookUrl} onChangeText={setWebhookUrl} placeholder="https://your-server.com/webhook" autoCapitalize="none" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <KISButton title={bot?.has_webhook ? 'Update webhook' : 'Save webhook'} size="sm" onPress={handleSaveWebhook} disabled={busy} />
            {bot?.has_webhook ? (
              <KISButton
                title="Delivery history" size="sm" variant="outline"
                onPress={() => navigation.navigate('BotWebhookDeliveries', { botId, botName: bot?.name })}
              />
            ) : null}
          </View>
        </SectionCard>

        <SectionCard title="AI provider" palette={palette}>
          {aiConnection ? (
            <>
              <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>
                {AI_PROVIDER_OPTIONS.find((o) => o.key === aiConnection.provider)?.label ?? aiConnection.provider}
              </Text>
              <Text style={{ fontSize: 12, color: palette.subtext }}>
                {aiConnection.model ? `Model: ${aiConnection.model}` : 'Default model'} · API key {aiConnection.has_api_key ? 'on file' : 'missing'}
              </Text>
              <KISButton title="Disconnect AI provider" size="sm" variant="danger" onPress={handleDisconnectAI} disabled={busy} />
            </>
          ) : (
            <>
              <Text style={{ fontSize: 12, color: palette.subtext }}>
                Connect your own OpenAI, Anthropic, Gemini, or custom endpoint so this bot can generate AI-powered replies.
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {AI_PROVIDER_OPTIONS.map((option) => {
                  const selected = aiProvider === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setAiProvider(option.key)}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
                        borderWidth: 1.5, borderColor: selected ? palette.primaryStrong : palette.divider,
                        backgroundColor: selected ? palette.primarySoft : 'transparent',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: selected ? palette.primaryStrong : palette.subtext }}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <KISTextInput value={aiApiKeyInput} onChangeText={setAiApiKeyInput} placeholder="API key" secureTextEntry autoCapitalize="none" />
              <KISTextInput value={aiModelInput} onChangeText={setAiModelInput} placeholder="Model (optional, e.g. gpt-4o-mini)" autoCapitalize="none" />
              <KISButton title="Connect AI provider" size="sm" onPress={handleConnectAI} disabled={busy} />
            </>
          )}
        </SectionCard>

        {approvals.length > 0 ? (
          <SectionCard title="Pending approvals" palette={palette}>
            <Text style={{ fontSize: 12, color: palette.subtext }}>
              This bot wants to perform a sensitive action and needs your approval.
            </Text>
            {approvals.map((approval) => (
              <View
                key={approval.id}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  borderTopWidth: 1, borderTopColor: palette.divider, paddingTop: 8,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>
                    {approval.action.replace(/_/g, ' ')}
                  </Text>
                  <Text style={{ fontSize: 11, color: palette.subtext }}>
                    {new Date(approval.created_at).toLocaleString()}
                  </Text>
                </View>
                <Pressable onPress={() => handleDecideApproval(approval.id, false)} hitSlop={8} style={{ padding: 4 }}>
                  <KISIcon name="close" size={18} color={palette.danger} />
                </Pressable>
                <Pressable onPress={() => handleDecideApproval(approval.id, true)} hitSlop={8} style={{ padding: 4 }}>
                  <KISIcon name="check" size={18} color={palette.success} />
                </Pressable>
              </View>
            ))}
          </SectionCard>
        ) : null}

        <SectionCard title="Workflows" palette={palette}>
          <Text style={{ fontSize: 12, color: palette.subtext }}>
            Build no-code automations — welcome messages, auto-replies, moderation and more — without writing any code.
          </Text>
          <KISButton
            title="Manage workflows"
            size="sm"
            onPress={() => navigation.navigate('WorkflowsList', { botId, botName: bot?.name })}
          />
        </SectionCard>

        <SectionCard title="Knowledge and memory" palette={palette}>
          <Text style={{ fontSize: 12, color: palette.subtext }}>
            Give this bot its own documents and notes to refer to, and let it keep short-term memory between events.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <KISButton
              title="Knowledge" size="sm" variant="outline"
              onPress={() => navigation.navigate('BotKnowledge', { botId, botName: bot?.name })}
            />
            <KISButton
              title="Memory" size="sm" variant="outline"
              onPress={() => navigation.navigate('BotMemory', { botId, botName: bot?.name })}
            />
          </View>
        </SectionCard>

        <SectionCard title="Recent activity" palette={palette}>
          {activity.length === 0 ? (
            <Text style={{ fontSize: 12, color: palette.subtext }}>No activity yet.</Text>
          ) : (
            activity.slice(0, 15).map((item) => (
              <Text key={item.id} style={{ fontSize: 12, color: palette.subtext }}>
                {new Date(item.created_at).toLocaleString()} · {item.action.replace(/_/g, ' ')}
              </Text>
            ))
          )}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
