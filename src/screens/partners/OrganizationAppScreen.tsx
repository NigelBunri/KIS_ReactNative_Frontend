import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { createAppShortcut, type ShortcutState } from '@/services/ShortcutService';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { KISIcon } from '@/constants/kisIcons';
import { getThemeById } from '@/constants/appColorThemes';
import KISButton from '@/constants/KISButton';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { resolveBackendAssetUrl } from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import type {
  PartnerOrganizationAppContentBlock,
  PartnerOrganizationAppTab,
} from '@/screens/tabs/partners/hooks/usePartnerOrganizationApps';
import LocationAttendanceTemplate from '@/components/partners/LocationAttendanceTemplate';
import PartnerFeedPage from '@/components/partners/PartnerFeedPage';
import PartnerMessagingView from '@/components/partners/PartnerMessagingView';
import PartnerBibleScreen from '@/components/partners/PartnerBibleScreen';
import DashboardTab from '@/components/partners/DashboardTab';
import BibleScreen from '@/screens/tabs/BibleScreen';
import MessagesScreen from '@/screens/tabs/MessagesScreen';
import BroadcastScreen from '@/screens/tabs/BroadcastScreen';
import ProfileScreen from '@/screens/tabs/ProfileScreen';
import { ChatRoomPage } from '@/Module/ChatRoom/ChatRoomPage';
import type { Chat } from '@/Module/ChatRoom/messagesUtils';

// ─── Types ──────────────────────────────────────────────────────────────────

type NavigationProps = NativeStackNavigationProp<RootStackParamList, 'OrganizationApp'>;
type RouteProps = RouteProp<RootStackParamList, 'OrganizationApp'>;

type LayoutType = 'bottom_tabs' | 'top_tabs' | 'side_tabs' | 'single_page' | 'scroll';

type AppConfig = {
  layout_type?: LayoutType;
  brand_colors?: { primary?: string; accent?: string; background?: string };
  color_theme_id?: string;
  theme?: 'light' | 'dark' | 'system';
  show_tab_labels?: boolean;
  [key: string]: unknown;
};

type TabConfig = {
  template?: 'bible' | 'messaging' | 'workspace' | 'broadcast' | 'profile' | 'dashboard' | 'partner' | 'custom' | 'partner_geolocation_attendance';
  bg_color?: string;
  [key: string]: unknown;
};

type AccessLog = {
  id: number;
  action: string;
  data_scope: string[];
  consent: boolean;
  created_at: string;
  user_display?: string;
};

const TYPE_LABELS: Record<string, string> = {
  kis: 'KIS App',
  bible: 'Bible App',
  external: 'Embedded App',
};

const TEMPLATE_LABELS: Record<string, string> = {
  bible: '📖 Bible',
  messaging: '💬 Messaging',
  workspace: '🏢 Workspace',
  broadcast: '📡 Feed',
  profile: '👤 Profile',
  partner: '🤝 Partner',
  dashboard: '📊 Dashboard',
  custom: '✏️ Custom',
  partner_geolocation_attendance: '📍 Attendance',
};

// Templates that own their own scroll/list layout and must NOT be wrapped in a ScrollView.
const FULLSCREEN_TEMPLATES = new Set<string>([
  'messaging', 'workspace', 'broadcast', 'profile', 'partner', 'bible', 'dashboard', 'partner_geolocation_attendance',
]);

// ─── Embedded KIS-engine tab wrappers ────────────────────────────────────────
// Each template renders the FULL KIS screen, not a simplified version.
// The partner's brand colors are applied at the OrganizationAppScreen level
// (header, tab bar). The embedded screen provides complete feature parity.

function EmbeddedPartnerFeed({
  partnerId,
  partnerName,
}: {
  partnerId: string;
  partnerName: string;
}) {
  return (
    <PartnerFeedPage
      partner={{ id: partnerId, name: partnerName }}
      onBack={() => {}}
      hideHeader
    />
  );
}

function EmbeddedMessaging({
  appName,
  headerGradient,
  sheenColor,
}: {
  appName?: string;
  headerGradient?: readonly string[];
  sheenColor?: string;
}) {
  const [activeChat, setActiveChat] = React.useState<Chat | null>(null);
  if (activeChat) {
    return (
      <View style={{ flex: 1 }}>
        <ChatRoomPage chat={activeChat} onBack={() => setActiveChat(null)} />
      </View>
    );
  }
  return (
    <MessagesScreen
      onOpenChat={(chat) => setActiveChat(chat)}
      onOpenInfo={() => {}}
      appName={appName}
      headerGradient={headerGradient}
      sheenColor={sheenColor}
    />
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function OrganizationAppScreen() {
  const navigation = useNavigation<NavigationProps>();
  const { params } = useRoute<RouteProps>();
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const app = params.app;

  const appConfig = (app.config ?? {}) as AppConfig;
  const layoutType: LayoutType = appConfig.layout_type ?? 'bottom_tabs';
  // Use partner-defined brand color, or fall back to royalInk (always dark/legible).
  // Never default to palette.primaryStrong — it resolves to pale gold in dark mode,
  // making white text invisible.
  const colorTheme = getThemeById(appConfig.color_theme_id);
  const brandPrimary = appConfig.brand_colors?.primary ?? colorTheme.primary;
  const brandBg = appConfig.brand_colors?.background ?? palette.surface;
  const showTabLabels = appConfig.show_tab_labels !== false;

  const resolvedLink = useMemo(() => resolveBackendAssetUrl(app.link ?? ''), [app.link]);
  const partnerId = params.partnerId ?? app.partner_id ?? null;
  const partnerName = params.partnerName ?? app.name;
  const canManage = params.canManage === true;
  const dataScope = useMemo(() => {
    if (Array.isArray(app.metadata?.dataAccess)) return app.metadata.dataAccess;
    if (app.metadata?.dataAccess) return [app.metadata.dataAccess];
    return [];
  }, [app.metadata?.dataAccess]);

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
      setLogs(Array.isArray(res?.data?.logs) ? res.data.logs : []);
    } catch {
      /* silently ignored */
    } finally {
      setLogsLoading(false);
    }
  }, [app.id, partnerId]);

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

  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => { loadTabs(); }, [loadTabs]);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0] ?? null,
    [tabs, activeTabId],
  );

  const handleOpenExternal = useCallback(() => {
    if (resolvedLink) Linking.openURL(resolvedLink).catch(() => {});
  }, [resolvedLink]);

  const latestConsent = useMemo(() => logs.find((e) => e.consent), [logs]);

  const handleConsentToggle = useCallback(async (grant: boolean) => {
    if (!partnerId) {
      Alert.alert('Partner required', 'Unable to update data sharing without a partner context.');
      return;
    }
    setSharing(true);
    try {
      await postRequest(
        ROUTES.partners.organizationAppAccessLog(partnerId, app.id),
        { action: grant ? 'consent_granted' : 'consent_revoked', data_scope: dataScope, consent: grant },
        { errorMessage: 'Unable to update data sharing.' },
      );
      loadLogs();
    } catch (err: any) {
      Alert.alert('Unable to update data access', err?.message || 'Try again later.');
    } finally {
      setSharing(false);
    }
  }, [app.id, dataScope, loadLogs, partnerId]);

  const [shortcutState, setShortcutState] = useState<ShortcutState>('idle');

  const handleCreateShortcut = useCallback(async () => {
    if (shortcutState === 'loading') return;
    setShortcutState('loading');
    const result = await createAppShortcut({
      appId: app.id,
      partnerId: partnerId ?? app.partner_id ?? '',
      partnerName: app.name,
      label: app.name,
      iconUrl: app.icon || undefined,
      deepLink: `kis://org-app/${partnerId ?? app.partner_id ?? ''}/${app.id}`,
    });
    setShortcutState(result.state);
    if (result.handled) {
      // Service already showed its own alert (iOS flow) — just reset state after a moment
      setTimeout(() => setShortcutState('idle'), 500);
      return;
    }
    if (result.state === 'success') {
      Alert.alert(
        'Shortcut created',
        `"${app.name}" has been pinned to your home screen.`,
        [{ text: 'OK', onPress: () => setShortcutState('idle') }],
      );
    } else if (result.state === 'already_pinned') {
      Alert.alert('Already pinned', `"${app.name}" is already on your home screen.`, [
        { text: 'OK', onPress: () => setShortcutState('idle') },
      ]);
    } else if (result.state === 'error') {
      Alert.alert('Could not create shortcut', result.error || 'Please try again.', [
        { text: 'Retry', onPress: () => setShortcutState('idle') },
        { text: 'Cancel', style: 'cancel', onPress: () => setShortcutState('idle') },
      ]);
    }
  }, [app.id, app.name, app.icon, partnerId, shortcutState]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderBlock = (block: PartnerOrganizationAppContentBlock) => {
    const blockType = block.block_type || 'text';
    const payloadUrl = block.payload?.url || block.payload?.href || block.payload?.file;
    const url = block.media_url || payloadUrl;
    return (
      <View
        key={block.id}
        style={[styles.blockCard, { borderColor: palette.divider, backgroundColor: palette.surface }]}
      >
        {block.title ? (
          <Text style={[styles.blockTitle, { color: palette.text }]}>{block.title}</Text>
        ) : null}

        {blockType === 'image' && url ? (
          <Image
            source={{ uri: resolveBackendAssetUrl(String(url)) || String(url) }}
            style={styles.blockImage}
            resizeMode="cover"
          />
        ) : null}

        {['video', 'file', 'link', 'embed'].includes(blockType) ? (
          <View style={styles.blockActionRow}>
            <Text style={[styles.bodyText, { color: palette.subtext, flex: 1 }]}>
              {blockType.toUpperCase()}{url ? `: ${url}` : ': No URL configured'}
            </Text>
            {url ? (
              <KISButton title="Open" size="xs" variant="outline" onPress={() => Linking.openURL(String(url))} />
            ) : null}
          </View>
        ) : null}

        {block.body ? (
          <Text style={[styles.bodyText, { color: palette.text }]}>{block.body}</Text>
        ) : null}

        {block.status ? (
          <Text style={[styles.subtext, { color: palette.subtext, marginTop: 4 }]}>
            {block.status} · {block.is_active ? 'active' : 'inactive'}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderTabContent = (tab: PartnerOrganizationAppTab | null) => {
    if (!tab) return null;
    const tabCfg = (tab.config ?? {}) as TabConfig;
    const template = tabCfg.template ?? 'custom';
    const blocks = tab.content_blocks ?? [];
    const bgColor = tabCfg.bg_color ?? brandBg;

    // Full-screen templates that manage their own layout
    if (template === 'partner_geolocation_attendance' && partnerId) {
      return (
        <LocationAttendanceTemplate
          partnerId={partnerId}
          brandColors={appConfig.brand_colors}
          theme={(appConfig.theme as 'dark' | 'light') ?? 'dark'}
        />
      );
    }

    if (template === 'bible') {
      if (partnerId) {
        return (
          <View style={{ flex: 1 }}>
            <PartnerBibleScreen partnerId={partnerId} appId={app.id} tabId={tab.id} />
          </View>
        );
      }
      return (
        <View style={{ flex: 1, minHeight: 600 }}>
          <BibleScreen />
        </View>
      );
    }

    // Messaging: scoped to this partner's groups, channels, communities.
    if (template === 'messaging') {
      if (partnerId) {
        return <PartnerMessagingView partnerId={partnerId} partnerName={partnerName} />;
      }
      return <EmbeddedMessaging appName={app.name} headerGradient={colorTheme.headerGradient} sheenColor={colorTheme.sheenColor} />;
    }

    // Workspace: same partner-scoped conversation list as messaging.
    if (template === 'workspace') {
      if (partnerId) {
        return <PartnerMessagingView partnerId={partnerId} partnerName={partnerName} />;
      }
      return <EmbeddedMessaging appName={app.name} headerGradient={colorTheme.headerGradient} sheenColor={colorTheme.sheenColor} />;
    }

    // Broadcast: partner-scoped feed — only posts from members of this partner organization,
    // fully managed by the partner account (create, delete, react, comment).
    if (template === 'broadcast') {
      if (partnerId) {
        return (
          <View style={{ flex: 1 }}>
            <EmbeddedPartnerFeed partnerId={partnerId} partnerName={partnerName} />
          </View>
        );
      }
      return (
        <View style={{ flex: 1 }}>
          <BroadcastScreen />
        </View>
      );
    }

    // Profile: full KIS profile screen — bio, stats, settings, account.
    if (template === 'profile') {
      return (
        <View style={{ flex: 1 }}>
          <ProfileScreen />
        </View>
      );
    }

    // Partner: same as workspace — partner channels and conversations.
    if (template === 'partner') {
      if (partnerId) {
        return <PartnerMessagingView partnerId={partnerId} partnerName={partnerName} />;
      }
      return <EmbeddedMessaging appName={app.name} headerGradient={colorTheme.headerGradient} sheenColor={colorTheme.sheenColor} />;
    }

    // Dashboard: live partner stats and activity summary.
    if (template === 'dashboard') {
      if (partnerId) {
        return <DashboardTab partnerId={partnerId} partnerName={partnerName} />;
      }
    }

    return (
      <View style={{ backgroundColor: bgColor, flex: 1 }}>
        {template !== 'custom' ? (
          <View style={[styles.templateBanner, { backgroundColor: brandPrimary + '18', borderColor: brandPrimary + '44' }]}>
            <Text style={[styles.templateLabel, { color: brandPrimary }]}>
              {TEMPLATE_LABELS[template] ?? template}
            </Text>
          </View>
        ) : null}

        {tab.description ? (
          <Text style={[styles.tabDescription, { color: palette.subtext }]}>{tab.description}</Text>
        ) : null}

        {blocks.length ? (
          blocks.map(renderBlock)
        ) : (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 32 }}>📭</Text>
            <Text style={[styles.bodyText, { color: palette.subtext, textAlign: 'center', marginTop: 8 }]}>
              No published content in this tab yet.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderTabBar = (position: 'top' | 'bottom' | 'side') => {
    if (!tabs.length) return null;
    const isHorizontal = position !== 'side';
    const containerStyle = position === 'bottom' ? styles.tabBarBottom
      : position === 'top' ? styles.tabBarTop
      : styles.tabBarSide;

    return (
      <View style={[containerStyle, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
        {isHorizontal ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 4, alignItems: 'center', paddingHorizontal: 8 }}
          >
            {tabs.map((tab) => renderTabChip(tab))}
          </ScrollView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {tabs.map((tab) => renderTabChip(tab, true))}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderTabChip = (tab: PartnerOrganizationAppTab, vertical = false) => {
    const active = tab.id === activeTab?.id;
    return (
      <Pressable
        key={tab.id}
        onPress={() => setActiveTabId(tab.id)}
        style={[
          vertical ? styles.tabChipVertical : styles.tabChip,
          {
            borderColor: active ? brandPrimary : 'transparent',
            backgroundColor: active ? brandPrimary + '18' : 'transparent',
          },
        ]}
      >
        {tab.icon ? (
          <Text style={{ fontSize: 18 }}>{tab.icon}</Text>
        ) : null}
        {(showTabLabels || !tab.icon) ? (
          <Text
            style={{
              color: active ? brandPrimary : palette.text,
              fontWeight: active ? '800' : '500',
              fontSize: 12,
              marginTop: tab.icon && showTabLabels ? 2 : 0,
            }}
            numberOfLines={1}
          >
            {tab.title}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  // ── Layout rendering ──────────────────────────────────────────────────────

  const renderAppBody = () => {
    if (tabsLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={brandPrimary} />
          <Text style={[styles.subtext, { color: palette.subtext, marginTop: 8 }]}>Loading…</Text>
        </View>
      );
    }
    if (tabsError) {
      return (
        <View style={styles.centered}>
          <Text style={{ fontSize: 32 }}>⚠️</Text>
          <Text style={[styles.bodyText, { color: palette.danger, textAlign: 'center', marginTop: 8 }]}>{tabsError}</Text>
          <KISButton title="Retry" size="sm" onPress={loadTabs} style={{ marginTop: 12 }} />
        </View>
      );
    }
    if (!tabs.length) {
      if (app.type === 'external') {
        return (
          <View style={[styles.embedPreview, { borderColor: palette.divider }]}>
            <Text style={[styles.bodyText, { color: palette.subtext, marginBottom: 8 }]}>
              External URL: {resolvedLink || 'Not configured'}
            </Text>
            {resolvedLink ? (
              <KISButton title="Open externally" onPress={handleOpenExternal} size="sm" />
            ) : null}
          </View>
        );
      }
      if (app.type === 'bible') {
        // Bible-type apps with no custom tabs fall back to the full BibleScreen.
        // These apps are considered a global shortcut for non-KCAN users or
        // standalone partner Bible experiences.
        return (
          <View style={{ flex: 1 }}>
            <BibleScreen />
          </View>
        );
      }
      return (
        <View style={styles.centered}>
          <Text style={{ fontSize: 40 }}>🛠️</Text>
          <Text style={[styles.bodyText, { color: palette.subtext, textAlign: 'center', marginTop: 8 }]}>
            This app has no tabs configured yet.
          </Text>
        </View>
      );
    }

    // Single-tab apps: render content directly without any tab chrome
    if (tabs.length === 1) {
      const singleTab = tabs[0];
      const singleCfg = (singleTab.config ?? {}) as TabConfig;
      if (FULLSCREEN_TEMPLATES.has(singleCfg.template ?? '')) {
        return <View style={{ flex: 1 }}>{renderTabContent(singleTab)}</View>;
      }
      return (
        <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
          {renderTabContent(singleTab)}
        </ScrollView>
      );
    }

    const activeTemplate = ((activeTab?.config ?? {}) as TabConfig).template ?? '';
    const activeIsFullscreen = FULLSCREEN_TEMPLATES.has(activeTemplate);

    switch (layoutType) {
      case 'top_tabs':
        return (
          <View style={{ flex: 1 }}>
            {renderTabBar('top')}
            {activeIsFullscreen ? (
              <View style={{ flex: 1 }}>{renderTabContent(activeTab)}</View>
            ) : (
              <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
                {renderTabContent(activeTab)}
              </ScrollView>
            )}
          </View>
        );
      case 'side_tabs': {
        const sideTabWidth = responsive.isCompactPhone ? 60 : responsive.isTablet ? 88 : 72;
        return (
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <View style={[styles.tabBarSide, { width: sideTabWidth, borderColor: palette.divider, backgroundColor: palette.surface }]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {tabs.map((tab) => renderTabChip(tab, true))}
              </ScrollView>
            </View>
            {activeIsFullscreen ? (
              <View style={{ flex: 1 }}>{renderTabContent(activeTab)}</View>
            ) : (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
                {renderTabContent(activeTab)}
              </ScrollView>
            )}
          </View>
        );
      }
      case 'scroll':
        return (
          <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
            {tabs.map((tab) => (
              <View key={tab.id} style={{ marginBottom: 24 }}>
                <Text style={[styles.blockTitle, { color: brandPrimary, marginBottom: 8 }]}>{tab.title}</Text>
                {renderTabContent(tab)}
              </View>
            ))}
          </ScrollView>
        );
      case 'single_page': {
        const spTab = tabs[0] ?? null;
        const spFullscreen = FULLSCREEN_TEMPLATES.has(((spTab?.config ?? {}) as TabConfig).template ?? '');
        return spFullscreen ? (
          <View style={{ flex: 1 }}>{renderTabContent(spTab)}</View>
        ) : (
          <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
            {renderTabContent(spTab)}
          </ScrollView>
        );
      }
      default: // bottom_tabs
        return (
          <View style={{ flex: 1 }}>
            {activeIsFullscreen ? (
              <View style={{ flex: 1 }}>{renderTabContent(activeTab)}</View>
            ) : (
              <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
                {renderTabContent(activeTab)}
              </ScrollView>
            )}
            {renderTabBar('bottom')}
          </View>
        );
    }
  };

  // ── Full screen layout ────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: brandBg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.divider, backgroundColor: brandPrimary + '0D' }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }, styles.backButton]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
        >
          <Text style={{ color: brandPrimary, fontSize: 28, lineHeight: 32, fontWeight: '300' }}>‹</Text>
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
            {app.name}
          </Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            {TYPE_LABELS[String(app.type ?? '')] ?? 'Organization app'}
          </Text>
        </View>
        {app.is_promoted_global ? (
          <View style={[styles.promotedBadge, { backgroundColor: brandPrimary }]}>
            <Text style={{ color: palette.onPrimary, fontSize: 10, fontWeight: '800' }}>⚡ Global</Text>
          </View>
        ) : null}
        {canManage && partnerId ? (
          <Pressable
            onPress={() => navigation.navigate('OrganizationAppForm', { partnerId, app })}
            style={({ pressed }) => ({
              opacity: pressed ? 0.5 : 1,
              paddingHorizontal: 8,
              paddingVertical: 8,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
            })}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={{ fontSize: 18 }}>🎨</Text>
            <Text style={{ color: brandPrimary, fontSize: 9, fontWeight: '700', marginTop: 1 }}>Colours</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={handleCreateShortcut}
          disabled={shortcutState === 'loading'}
          style={({ pressed }) => ({
            opacity: pressed || shortcutState === 'loading' ? 0.5 : 1,
            paddingHorizontal: 10,
            paddingVertical: 8,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
          })}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          {shortcutState === 'loading' ? (
            <ActivityIndicator size="small" color={brandPrimary} />
          ) : (
            <>
              <Text style={{ fontSize: 18 }}>
                {shortcutState === 'success' ? '✅' : shortcutState === 'already_pinned' ? '📌' : '📌'}
              </Text>
              <Text style={{ color: brandPrimary, fontSize: 9, fontWeight: '700', marginTop: 1 }}>
                {shortcutState === 'success' ? 'Pinned!' : 'Shortcut'}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* App body */}
      <View style={{ flex: 1 }}>
        {renderAppBody()}
      </View>

      {/* Data sharing footer (only when data scope configured) */}
      {dataScope.length > 0 && (
        <View style={[styles.footer, { borderTopColor: palette.divider, backgroundColor: palette.surface }]}>
          <Text style={[styles.subtext, { color: palette.subtext, flex: 1 }]} numberOfLines={1}>
            Data: {dataScope.join(', ')}
          </Text>
          <KISButton
            title={latestConsent ? 'Revoke' : 'Share data'}
            size="xs"
            variant={latestConsent ? 'outline' : 'primary'}
            onPress={() => handleConsentToggle(!latestConsent)}
            disabled={sharing}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: { padding: 10, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, marginLeft: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  promotedBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  // Tab bars
  tabBarTop: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 6,
    minHeight: 48,
  },
  tabBarBottom: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 6,
    minHeight: 56,
  },
  tabBarSide: {
    width: 72,
    borderRightWidth: 1,
    paddingVertical: 8,
  },
  tabChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    marginHorizontal: 4,
    minHeight: 44,
    gap: 2,
  },
  tabChipVertical: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    marginVertical: 4,
    marginHorizontal: 6,
    minHeight: 44,
    minWidth: 44,
    gap: 2,
  },
  tabContent: {
    padding: 16,
    paddingBottom: 40,
  },
  // Template banner
  templateBanner: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  templateLabel: { fontSize: 12, fontWeight: '700' },
  tabDescription: { fontSize: 12, lineHeight: 18, marginBottom: 10 },
  // Blocks
  blockCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  blockTitle: { fontSize: 14, fontWeight: '700' },
  blockImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: 10 },
  blockActionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // States
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  embedPreview: { padding: 16, borderRadius: 16, borderWidth: 1, margin: 16 },
  bodyText: { fontSize: 13, lineHeight: 20 },
  subtext: { fontSize: 12, lineHeight: 18 },
});
