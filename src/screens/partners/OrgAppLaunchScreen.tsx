/**
 * OrgAppLaunchScreen — deep-link entry point for `kis://org-app/:partnerId/:appId`.
 * Fetches the app record then immediately replaces itself with OrganizationAppScreen.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type NavigationProps = NativeStackNavigationProp<RootStackParamList, 'OrgAppLaunch'>;
type RouteProps = RouteProp<RootStackParamList, 'OrgAppLaunch'>;

export default function OrgAppLaunchScreen() {
  const navigation = useNavigation<NavigationProps>();
  const { params } = useRoute<RouteProps>();
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const { partnerId, appId } = params;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function launch() {
      try {
        const res = await getRequest(ROUTES.partners.organizationApps(partnerId));
        const apps: any[] = Array.isArray(res?.data?.apps)
          ? res.data.apps
          : Array.isArray(res?.data)
            ? res.data
            : [];
        const app = apps.find((a: any) => String(a.id) === String(appId));
        if (!app) {
          if (!cancelled) setError('App not found. It may have been removed.');
          return;
        }
        if (!cancelled) {
          navigation.replace('OrganizationApp', { app, partnerId });
        }
      } catch {
        if (!cancelled) setError('Unable to open this app. Please try again.');
      }
    }

    launch();
    return () => { cancelled = true; };
  }, [partnerId, appId, navigation]);

  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top, backgroundColor: palette.surface }]}>
        <Text style={{ fontSize: 36 }}>⚠️</Text>
        <Text style={[styles.msg, { color: palette.danger }]}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.center, { paddingTop: insets.top, backgroundColor: palette.surface }]}>
      <ActivityIndicator size="large" color={palette.primary} />
      <Text style={[styles.msg, { color: palette.subtext }]}>Opening app…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  msg: { fontSize: 14, textAlign: 'center', marginTop: 8 },
});
