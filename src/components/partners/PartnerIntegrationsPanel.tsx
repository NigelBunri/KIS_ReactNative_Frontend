import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
};

type Integration = {
  id: string | number;
  kind: string;
  provider?: string;
  config?: Record<string, any>;
  is_enabled?: boolean;
};

type Webhook = {
  id: string | number;
  name: string;
  url: string;
  events?: string[];
  is_active?: boolean;
  retry_limit?: number;
  retry_backoff_seconds?: number;
  last_sent_at?: string | null;
  last_error?: string | null;
};

export default function PartnerIntegrationsPanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  partnerId,
  onClose,
}: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [webhookName, setWebhookName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState('message.created, message.deleted');
  const [ssoIssuer, setSsoIssuer] = useState('');
  const [ssoClientId, setSsoClientId] = useState('');
  const [ssoClientSecret, setSsoClientSecret] = useState('');
  const [ssoDiscoveryUrl, setSsoDiscoveryUrl] = useState('');
  const [ssoHasSecret, setSsoHasSecret] = useState(false);
  const [scimBaseUrl, setScimBaseUrl] = useState('');
  const [scimToken, setScimToken] = useState('');
  const [scimHasToken, setScimHasToken] = useState(false);
  const [testingSso, setTestingSso] = useState(false);

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const loadAll = useCallback(async () => {
    if (!partnerId) return;
    const [intRes, hookRes] = await Promise.all([
      getRequest(ROUTES.partners.integrations(partnerId), {
        errorMessage: 'Unable to load integrations.',
      }),
      getRequest(ROUTES.partners.webhooks(partnerId), {
        errorMessage: 'Unable to load webhooks.',
      }),
    ]);
    const intList = (intRes?.data ?? intRes ?? []) as Integration[];
    const hookList = (hookRes?.data ?? hookRes ?? []) as Webhook[];
    setIntegrations(Array.isArray(intList) ? intList : []);
    setWebhooks(Array.isArray(hookList) ? hookList : []);
    const ssoConfig = intList.find((item) => item.kind === 'sso')?.config ?? {};
    const scimConfig = intList.find((item) => item.kind === 'scim')?.config ?? {};
    setSsoIssuer(String(ssoConfig.issuer ?? ''));
    setSsoClientId(String(ssoConfig.client_id ?? ''));
    setSsoDiscoveryUrl(String(ssoConfig.discovery_url ?? ''));
    // client_secret/token come back as "[redacted]" (or absent) - never
    // show that literal string as if it were an editable value. Leave the
    // field blank; only a freshly-typed value gets sent on save.
    setSsoClientSecret('');
    setSsoHasSecret(Boolean(ssoConfig.client_secret));
    setScimBaseUrl(String(scimConfig.base_url ?? ''));
    setScimToken('');
    setScimHasToken(Boolean(scimConfig.token));
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [isOpen, loadAll]);

  const ensureIntegration = async (kind: string) => {
    if (!partnerId) return;
    const existing = integrations.find((item) => item.kind === kind);
    if (existing) return existing;
    const res = await postRequest(ROUTES.partners.integrations(partnerId), {
      kind,
      provider: kind === 'sso' ? 'oidc' : 'okta',
      config: {},
      is_enabled: false,
    });
    if (res?.success && res.data) {
      setIntegrations((prev) => [...prev, res.data]);
      return res.data as Integration;
    }
    Alert.alert('Error', res?.message ?? 'Unable to create integration');
    return null;
  };

  const toggleIntegration = async (kind: string, enabled: boolean) => {
    if (!partnerId) return;
    const integration = await ensureIntegration(kind);
    if (!integration) return;
    const res = await patchRequest(
      ROUTES.partners.integrationUpdate(partnerId, String(integration.id)),
      { is_enabled: enabled },
      { errorMessage: 'Unable to update integration.' },
    );
    if (res?.success) {
      setIntegrations((prev) =>
        prev.map((item) =>
          item.id === integration.id ? { ...item, is_enabled: enabled } : item,
        ),
      );
    } else {
      Alert.alert('Update failed', res?.message ?? 'Please try again.');
    }
  };

  const updateIntegrationConfig = async (kind: string, config: Record<string, any>) => {
    if (!partnerId) return;
    const integration = await ensureIntegration(kind);
    if (!integration) return;
    const res = await patchRequest(
      ROUTES.partners.integrationUpdate(partnerId, String(integration.id)),
      { config: { ...(integration.config ?? {}), ...config } },
      { errorMessage: 'Unable to update integration config.' },
    );
    if (res?.success && res.data) {
      setIntegrations((prev) =>
        prev.map((item) => (item.id === integration.id ? res.data : item)),
      );
    } else {
      Alert.alert('Update failed', res?.message ?? 'Please try again.');
    }
  };

  const testSsoConnection = async () => {
    if (!partnerId) return;
    const integration = integrations.find((item) => item.kind === 'sso');
    if (!integration) {
      Alert.alert('Nothing to test', 'Save an issuer URL first.');
      return;
    }
    setTestingSso(true);
    try {
      const res = await postRequest(
        ROUTES.partners.integrationTest(partnerId, String(integration.id)),
        {},
        { errorMessage: 'Unable to test this connection.' },
      );
      const payload = res?.data ?? res;
      if (payload?.ok) {
        Alert.alert('Connection OK', payload.detail ?? 'Discovery document reachable.');
      } else {
        Alert.alert('Connection failed', payload?.detail ?? 'Could not verify this issuer.');
      }
    } finally {
      setTestingSso(false);
    }
  };

  const onCreateWebhook = async () => {
    if (!partnerId) return;
    if (!webhookName.trim() || !webhookUrl.trim()) {
      Alert.alert('Missing info', 'Webhook name and URL are required.');
      return;
    }
    const events = webhookEvents
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const res = await postRequest(ROUTES.partners.webhooks(partnerId), {
      name: webhookName.trim(),
      url: webhookUrl.trim(),
      events,
      is_active: true,
    });
    if (!res?.success) {
      Alert.alert('Create failed', res?.message ?? 'Please try again.');
      return;
    }
    setWebhookName('');
    setWebhookUrl('');
    loadAll();
  };

  if (!isOpen) return null;

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.settingsPanelBackdrop,
          { backgroundColor: palette.backdrop, opacity: backdropOpacity },
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          {
            width: panelWidth,
            backgroundColor: palette.surfaceElevated,
            borderLeftColor: palette.divider,
            transform: [{ translateX: panelTranslateX }],
          },
        ]}
      >
        <View
          style={[
            styles.settingsPanelHeader,
            { borderBottomColor: palette.divider },
          ]}
        >
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>
              Integrations & Webhooks
            </Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              Connect identity systems and event webhooks.
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.settingsPanelBody}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <>
              <Text style={[styles.settingsSectionTitle, { color: palette.text }]}>
                Identity Providers
              </Text>
              <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  Enterprise SSO (OIDC)
                </Text>
                <Switch
                  value={Boolean(integrations.find((item) => item.kind === 'sso')?.is_enabled)}
                  onValueChange={(value) => toggleIntegration('sso', value)}
                />
              </View>
              <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}>
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  Identity provider config
                </Text>
                <Text style={[styles.settingsFeatureDescription, { color: palette.subtext, marginTop: 4 }]}>
                  From your IdP (Okta, Azure AD, Google Workspace, etc.) - the issuer and client
                  credentials for its OIDC application.
                </Text>
                <TextInput
                  value={ssoIssuer}
                  onChangeText={setSsoIssuer}
                  placeholder="Issuer (e.g. https://your-org.okta.com)"
                  placeholderTextColor={palette.subtext}
                  autoCapitalize="none"
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <TextInput
                  value={ssoClientId}
                  onChangeText={setSsoClientId}
                  placeholder="Client ID"
                  placeholderTextColor={palette.subtext}
                  autoCapitalize="none"
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <TextInput
                  value={ssoClientSecret}
                  onChangeText={setSsoClientSecret}
                  placeholder={ssoHasSecret ? 'Client secret already set - leave blank to keep it' : 'Client secret'}
                  placeholderTextColor={palette.subtext}
                  autoCapitalize="none"
                  secureTextEntry
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <TextInput
                  value={ssoDiscoveryUrl}
                  onChangeText={setSsoDiscoveryUrl}
                  placeholder="Discovery URL (optional - derived from issuer if blank)"
                  placeholderTextColor={palette.subtext}
                  autoCapitalize="none"
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Pressable
                    onPress={() => {
                      const config: Record<string, any> = {
                        issuer: ssoIssuer.trim(),
                        client_id: ssoClientId.trim(),
                        discovery_url: ssoDiscoveryUrl.trim(),
                      };
                      if (ssoClientSecret.trim()) {
                        config.client_secret = ssoClientSecret.trim();
                      }
                      updateIntegrationConfig('sso', config).then(() => {
                        setSsoClientSecret('');
                        if (ssoClientSecret.trim()) setSsoHasSecret(true);
                      });
                    }}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: palette.borderMuted,
                        backgroundColor: palette.primarySoft ?? palette.surface,
                        opacity: pressed ? 0.8 : 1,
                        alignItems: 'center',
                      },
                    ]}
                  >
                    <Text style={{ color: palette.primaryStrong ?? palette.text, fontWeight: '700' }}>
                      SAVE
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={testSsoConnection}
                    disabled={testingSso}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: palette.borderMuted,
                        backgroundColor: palette.surface,
                        opacity: pressed || testingSso ? 0.6 : 1,
                        alignItems: 'center',
                      },
                    ]}
                  >
                    {testingSso ? (
                      <ActivityIndicator size="small" color={palette.text} />
                    ) : (
                      <Text style={{ color: palette.text, fontWeight: '700' }}>TEST CONNECTION</Text>
                    )}
                  </Pressable>
                </View>
              </View>
              <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  SCIM Provisioning
                </Text>
                <Switch
                  value={Boolean(integrations.find((item) => item.kind === 'scim')?.is_enabled)}
                  onValueChange={(value) => toggleIntegration('scim', value)}
                />
              </View>
              <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}>
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  SCIM config
                </Text>
                <Text style={[styles.settingsFeatureDescription, { color: palette.subtext, marginTop: 4 }]}>
                  Paste this base URL and token into your IdP's SCIM provisioning app to
                  auto-create and deactivate accounts on hire/termination.
                </Text>
                <TextInput
                  value={scimBaseUrl}
                  onChangeText={setScimBaseUrl}
                  placeholder="SCIM base URL"
                  placeholderTextColor={palette.subtext}
                  autoCapitalize="none"
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <TextInput
                  value={scimToken}
                  onChangeText={setScimToken}
                  placeholder={scimHasToken ? 'Token already set - leave blank to keep it' : 'SCIM bearer token'}
                  placeholderTextColor={palette.subtext}
                  autoCapitalize="none"
                  secureTextEntry
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <Pressable
                  onPress={() => {
                    const config: Record<string, any> = { base_url: scimBaseUrl.trim() };
                    if (scimToken.trim()) config.token = scimToken.trim();
                    updateIntegrationConfig('scim', config).then(() => {
                      setScimToken('');
                      if (config.token) setScimHasToken(true);
                    });
                  }}
                  style={({ pressed }) => [
                    {
                      marginTop: 10,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: palette.borderMuted,
                      backgroundColor: palette.primarySoft ?? palette.surface,
                      opacity: pressed ? 0.8 : 1,
                      alignItems: 'center',
                    },
                  ]}
                >
                  <Text style={{ color: palette.primaryStrong ?? palette.text, fontWeight: '700' }}>
                    SAVE SCIM CONFIG
                  </Text>
                </Pressable>
              </View>

              <Text style={[styles.settingsSectionTitle, { color: palette.text, marginTop: 12 }]}>
                Webhooks
              </Text>
              <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}>
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  Create webhook
                </Text>
                <TextInput
                  value={webhookName}
                  onChangeText={setWebhookName}
                  placeholder="Webhook name"
                  placeholderTextColor={palette.subtext}
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <TextInput
                  value={webhookUrl}
                  onChangeText={setWebhookUrl}
                  placeholder="https://example.com/webhooks"
                  placeholderTextColor={palette.subtext}
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <TextInput
                  value={webhookEvents}
                  onChangeText={setWebhookEvents}
                  placeholder="event.one, event.two"
                  placeholderTextColor={palette.subtext}
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <Pressable
                  onPress={onCreateWebhook}
                  style={({ pressed }) => [
                    {
                      marginTop: 10,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: palette.borderMuted,
                      backgroundColor: palette.primarySoft ?? palette.surface,
                      opacity: pressed ? 0.8 : 1,
                      alignItems: 'center',
                    },
                  ]}
                >
                  <Text style={{ color: palette.primaryStrong ?? palette.text, fontWeight: '700' }}>
                    ADD WEBHOOK
                  </Text>
                </Pressable>
              </View>

              {webhooks.map((hook) => (
                <View
                  key={String(hook.id)}
                  style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}
                >
                  <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                    {hook.name}
                  </Text>
                  <Text style={[styles.settingsFeatureDescription, { color: palette.subtext }]}>
                    {hook.url}
                  </Text>
                  <Text style={[styles.settingsFeatureMeta, { color: palette.subtext }]}>
                    {hook.events?.join(', ') || 'No events'}
                  </Text>
                  {hook.last_error ? (
                    <Text style={[styles.settingsFeatureMeta, { color: palette.danger }]}>
                      Last error: {hook.last_error}
                    </Text>
                  ) : null}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
