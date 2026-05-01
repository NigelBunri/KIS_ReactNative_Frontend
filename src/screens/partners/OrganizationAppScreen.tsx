import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { useKISTheme } from '@/theme/useTheme';
import { resolveBackendAssetUrl } from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import type {
  PartnerOrganizationAppContentBlock,
  PartnerOrganizationAppTab,
} from '@/screens/tabs/partners/hooks/usePartnerOrganizationApps';

const TYPE_LABELS: Record<string, string> = {
  kis: 'KIS App',
  bible: 'Bible App',
  external: 'Embedded App',
};

type NavigationProps = NativeStackNavigationProp<RootStackParamList, 'OrganizationApp'>;
type RouteProps = RouteProp<RootStackParamList, 'OrganizationApp'>;

type AccessLog = {
  id: number;
  action: string;
  data_scope: string[];
  consent: boolean;
  created_at: string;
  user_display?: string;
};

export default function OrganizationAppScreen() {
  const navigation = useNavigation<NavigationProps>();
  const { params } = useRoute<RouteProps>();
  const { palette } = useKISTheme();
  const app = params.app;

  const resolvedLink = useMemo(() => resolveBackendAssetUrl(app.link ?? ''), [app.link]);
  const partnerId = params.partnerId ?? app.partner_id ?? null;
  const dataScope = useMemo(
    () =>
      Array.isArray(app.metadata?.dataAccess) && app.metadata.dataAccess.length
        ? app.metadata.dataAccess
        : app.metadata?.dataAccess
        ? [app.metadata.dataAccess]
        : [],
    [app.metadata?.dataAccess],
  );
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [tabs, setTabs] = useState<PartnerOrganizationAppTab[]>(app.tabs ?? []);
  const [activeTabId, setActiveTabId] = useState<string | null>(app.tabs?.[0]?.id ?? null);
  const [tabsLoading, setTabsLoading] = useState(false);
  const [tabsError, setTabsError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    if (!partnerId) return;
    setLogsLoading(true);
    try {
      const res = await getRequest(ROUTES.partners.organizationAppAccessLog(partnerId, app.id));
      const list = Array.isArray(res?.data?.logs) ? res.data.logs : [];
      setLogs(list);
    } catch (err: any) {
      console.log('[OrganizationAppScreen] failed to load logs', err?.message);
    } finally {
      setLogsLoading(false);
    }
  }, [app.id, partnerId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const loadTabs = useCallback(async () => {
    if (!partnerId) {
      setTabs(app.tabs ?? []);
      setActiveTabId(app.tabs?.[0]?.id ?? null);
      return;
    }
    setTabsLoading(true);
    setTabsError(null);
    const res = await getRequest(ROUTES.partners.organizationAppTabs(partnerId, app.id), {
      errorMessage: 'Unable to load app tabs.',
      forceNetwork: true,
    });
    if (res?.success) {
      const nextTabs = Array.isArray(res.data?.tabs) ? res.data.tabs : Array.isArray(res.data) ? res.data : [];
      setTabs(nextTabs);
      setActiveTabId((current) => current ?? nextTabs[0]?.id ?? null);
    } else {
      setTabsError(res?.message || 'Unable to load app tabs.');
      setTabs(app.tabs ?? []);
      setActiveTabId(app.tabs?.[0]?.id ?? null);
    }
    setTabsLoading(false);
  }, [app.id, app.tabs, partnerId]);

  useEffect(() => {
    loadTabs();
  }, [loadTabs]);
  const metadataRows = useMemo(
    () =>
      Object.entries(app.metadata || {}).filter(
        ([, value]) =>
          ['string', 'number', 'boolean'].includes(typeof value) && value !== undefined,
      ),
    [app.metadata],
  );

  const handleOpenExternal = useCallback(() => {
    if (!resolvedLink) return;
    Linking.openURL(resolvedLink).catch(() => {
      // Silently fail; this link should already be trusted.
    });
  }, [resolvedLink]);

  const typeLabel = TYPE_LABELS[String(app.type ?? '')] ?? 'Organization app';

  const renderBlock = (block: PartnerOrganizationAppContentBlock) => {
    const blockType = block.block_type || 'text';
    const payloadUrl = block.payload?.url || block.payload?.href || block.payload?.file;
    const url = block.media_url || payloadUrl;
    return (
      <View key={block.id} style={[styles.blockCard, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
        {block.title ? <Text style={[styles.bodyTitle, { color: palette.text }]}>{block.title}</Text> : null}
        {blockType === 'image' && url ? (
          <Image source={{ uri: resolveBackendAssetUrl(String(url)) || String(url) }} style={styles.blockImage} resizeMode="cover" />
        ) : null}
        {blockType === 'video' || blockType === 'file' || blockType === 'link' || blockType === 'embed' ? (
          <View style={styles.blockActionRow}>
            <Text style={[styles.bodyText, { color: palette.subtext, flex: 1 }]}>
              {blockType.toUpperCase()} {url ? String(url) : 'No URL configured'}
            </Text>
            {url ? (
              <KISButton title="Open" size="xs" variant="outline" onPress={() => Linking.openURL(String(url))} />
            ) : null}
          </View>
        ) : null}
        {block.body ? <Text style={[styles.bodyText, { color: palette.text }]}>{block.body}</Text> : null}
        {block.status ? (
          <Text style={[styles.subtext, { color: palette.subtext, marginTop: 6 }]}>
            Status: {block.status} · Active: {block.is_active ? 'yes' : 'no'}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderConfiguredTabs = () => {
    if (tabsLoading) {
      return (
        <View style={styles.section}>
          <ActivityIndicator color={palette.primaryStrong} />
          <Text style={[styles.subtext, { color: palette.subtext, marginTop: 6 }]}>Loading app tabs...</Text>
        </View>
      );
    }
    if (tabsError) {
      return (
        <View style={styles.section}>
          <Text style={[styles.subtext, { color: palette.danger }]}>{tabsError}</Text>
        </View>
      );
    }
    if (!tabs.length) {
      return (
        <View style={styles.section}>
          <Text style={[styles.bodyTitle, { color: palette.text }]}>App content</Text>
          <Text style={[styles.bodyText, { color: palette.subtext }]}>
            This partner app has no configured tabs yet.
          </Text>
        </View>
      );
    }
    const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
    const blocks = activeTab?.content_blocks ?? [];
    return (
      <View style={styles.section}>
        <Text style={[styles.bodyTitle, { color: palette.text }]}>App tabs</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRail}>
          {tabs.map((tab) => {
            const active = tab.id === activeTab?.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTabId(tab.id)}
                style={[
                  styles.tabChip,
                  {
                    borderColor: palette.divider,
                    backgroundColor: active ? palette.primarySoft : palette.surface,
                  },
                ]}
              >
                <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '700' }}>
                  {tab.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {activeTab?.description ? (
          <Text style={[styles.bodyText, { color: palette.subtext, marginBottom: 10 }]}>
            {activeTab.description}
          </Text>
        ) : null}
        {blocks.length ? (
          blocks.map(renderBlock)
        ) : (
          <Text style={[styles.bodyText, { color: palette.subtext }]}>
            No published content blocks in this tab yet.
          </Text>
        )}
      </View>
    );
  };

  const renderContent = () => {
    if (app.type === 'external') {
      return (
        <View style={styles.embedPreview}>
          <Text style={[styles.subtext, { color: palette.subtext, marginBottom: 6 }]}>
            We load this app inside a secure WebView/SDK container. Once the runtime embed module is in place,
            the experience will render directly inside this screen.
          </Text>
          <Text
            style={[
              styles.bodyText,
              { color: palette.text, marginBottom: 8 },
            ]}
          >
            URL: {resolvedLink ?? 'Link unavailable'}
          </Text>
          {resolvedLink ? (
            <KISButton title="Open externally" onPress={handleOpenExternal} size="sm" />
          ) : null}
        </View>
      );
    }

    return (
      <View style={styles.embedPreview}>
        <Text style={[styles.subtext, { color: palette.subtext }]}>
          {app.description || 'Internal module loaded via KIS host.'}
        </Text>
        <Text style={[styles.bodyText, { color: palette.text, marginTop: 12 }]}>
          Module: {app.module || 'unspecified'}
        </Text>
        <Text style={[styles.bodyText, { color: palette.text, marginTop: 4 }]}>
          Link: {resolvedLink ?? 'n/a'}
        </Text>
        {resolvedLink ? (
          <KISButton
            title="Preview in WebView"
            size="sm"
            onPress={handleOpenExternal}
            style={{ marginTop: 12 }}
          />
        ) : null}
      </View>
    );
  };

  const latestConsent = useMemo(() => logs.find((entry) => entry.consent), [logs]);
  const handleConsentToggle = useCallback(
    async (grant: boolean) => {
      if (!partnerId) {
        Alert.alert('Partner required', 'Unable to update data sharing without a partner context.');
        return;
      }
      setSharing(true);
      try {
        await postRequest(
          ROUTES.partners.organizationAppAccessLog(partnerId, app.id),
          {
            action: grant ? 'consent_granted' : 'consent_revoked',
            data_scope: dataScope,
            consent: grant,
          },
          { errorMessage: 'Unable to update data sharing.' },
        );
        loadLogs();
      } catch (err: any) {
        Alert.alert('Unable to update data access', err?.message || 'Try again later.');
      } finally {
        setSharing(false);
      }
    },
    [app.id, dataScope, loadLogs, partnerId],
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.surface }]}>
      <View style={[styles.header, { borderBottomColor: palette.divider, backgroundColor: palette.surfaceElevated }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, styles.backButton]}
        >
          <KISIcon name="chevron-left" size={20} color={palette.text} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
            {app.name}
          </Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>{typeLabel}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.bodyTitle, { color: palette.text }]}>About</Text>
          <Text style={[styles.bodyText, { color: palette.subtext }]}>{app.description || 'No description yet.'}</Text>
          <View style={styles.statusRow}>
            <Text style={[styles.statusPill, { color: palette.text, borderColor: palette.divider }]}>
              {app.status || 'draft'}
            </Text>
            {app.is_promoted_global ? (
              <Text style={[styles.statusPill, { color: palette.primaryStrong, borderColor: palette.primaryStrong }]}>
                Global promoted
              </Text>
            ) : (
              <Text style={[styles.statusPill, { color: palette.subtext, borderColor: palette.divider }]}>
                Partner-scoped
              </Text>
            )}
          </View>
        </View>
        <View style={styles.section}>
          <Text style={[styles.bodyTitle, { color: palette.text }]}>Data access</Text>
          <Text style={[styles.bodyText, { color: palette.subtext }]}>
            {dataScope.length ? dataScope.join(', ') : 'No data scope recorded.'}
          </Text>
          <KISButton
            title={latestConsent ? 'Revoke data sharing' : 'Share organization data'}
            size="sm"
            variant={latestConsent ? 'outline' : 'primary'}
            onPress={() => handleConsentToggle(!latestConsent)}
            disabled={sharing || !dataScope.length}
            style={{ marginTop: 8 }}
          />
        </View>
        {renderContent()}
        {renderConfiguredTabs()}
        {metadataRows.length ? (
          <View style={[styles.section, { marginTop: 10 }]}>
            <Text style={[styles.bodyTitle, { color: palette.text }]}>Metadata</Text>
            {metadataRows.map(([key, value]) => (
              <View key={key} style={styles.metadataRow}>
                <Text style={[styles.subtext, { color: palette.text }]}>{key}:</Text>
                <Text style={[styles.bodyText, { color: palette.subtext }]}>{String(value)}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.section}>
          <Text style={[styles.bodyTitle, { color: palette.text }]}>Visibility</Text>
          <Text style={[styles.bodyText, { color: palette.subtext }]}>
            {app.visible_to?.length ? app.visible_to.join(', ') : 'Visible to everyone'}
          </Text>
        </View>
        <View style={styles.section}>
          <Text style={[styles.bodyTitle, { color: palette.text }]}>Configuration</Text>
          <Text style={[styles.bodyText, { color: palette.subtext }]}>
            Order: {app.order} · Active: {app.is_active ? 'yes' : 'no'} · Published:{' '}
            {app.published_at ? new Date(app.published_at).toLocaleString() : 'not published'}
          </Text>
        </View>
        <View style={styles.section}>
          <Text style={[styles.bodyTitle, { color: palette.text }]}>Access Logs</Text>
          {logsLoading ? (
            <ActivityIndicator color={palette.primaryStrong} />
          ) : logs.length ? (
            logs.map((entry) => (
              <View key={entry.id} style={styles.metadataRow}>
                <Text style={[styles.subtext, { color: palette.text }]}>
                  {entry.user_display ?? 'User'} · {entry.action}
                </Text>
                <Text style={[styles.bodyText, { color: palette.subtext }]}>
                  {new Date(entry.created_at).toLocaleString()}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.subtext, { color: palette.subtext }]}>No access logs yet.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 6,
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  body: {
    padding: 16,
  },
  section: {
    marginBottom: 18,
  },
  bodyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 20,
  },
  subtext: {
    fontSize: 12,
    lineHeight: 18,
  },
  embedPreview: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 16,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  tabRail: {
    gap: 8,
    paddingVertical: 8,
  },
  tabChip: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  blockCard: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  blockImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 10,
  },
  blockActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
