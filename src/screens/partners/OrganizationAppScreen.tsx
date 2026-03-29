import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

const TYPE_LABELS: Record<string, string> = {
  kis: 'KIS App',
  bible: 'Bible App',
  external: 'Embedded App',
  ai: 'Assistant App',
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

    if (app.type === 'ai' || app.metadata?.kind === 'ai') {
      return (
        <View style={styles.embedPreview}>
          <Text style={[styles.subtext, { color: palette.subtext }]}>
            Assistant experiences are rendered securely through our in-app SDK. Review the data scope
            and app metadata before launching.
          </Text>
          {app.metadata?.dataAccess ? (
            <Text style={[styles.bodyText, { color: palette.text, marginTop: 10 }]}>
              Data access: {String(app.metadata.dataAccess)}
            </Text>
          ) : null}
          <KISButton title="Open app" onPress={handleOpenExternal} size="sm" disabled={!resolvedLink} />
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
            Order: {app.order} · Active: {app.is_active ? 'yes' : 'no'}
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
});
