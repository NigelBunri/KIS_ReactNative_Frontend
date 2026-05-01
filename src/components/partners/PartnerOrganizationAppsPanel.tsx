import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import styles from '@/components/partners/partnersStyles';
import KISButton from '@/constants/KISButton';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import type { PartnerOrganizationApp } from '@/screens/tabs/partners/hooks/usePartnerOrganizationApps';
import type { RootStackParamList } from '@/navigation/types';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
  apps: PartnerOrganizationApp[];
  loading: boolean;
  error?: string | null;
  onRefresh?: () => void;
  canManageApps?: boolean;
  onLaunchApp?: (app: PartnerOrganizationApp) => void;
};

const TYPE_LABELS: Record<string, string> = {
  kis: 'KIS App',
  bible: 'Bible App',
  external: 'External App',
};

const DEFAULT_VISIBILITY = ['owner', 'admin', 'manager'];

export default function PartnerOrganizationAppsPanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  partnerId,
  onClose,
  apps,
  loading,
  error,
  onRefresh,
  canManageApps = false,
  onLaunchApp,
}: Props) {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleLaunchApp = useCallback(async (app: PartnerOrganizationApp) => {
    if (!app.link) {
      Alert.alert('Organization app', 'This app does not provide a link yet.');
      return;
    }
    if (onLaunchApp) {
      onLaunchApp(app);
      return;
    }
    try {
      await Linking.openURL(app.link);
    } catch (err: any) {
      Alert.alert('Open app', err?.message || 'Unable to open this app yet.');
    }
  }, [onLaunchApp]);

  const handleDelete = useCallback(async (app: PartnerOrganizationApp) => {
    if (!partnerId) {
      Alert.alert('Partner required', 'Select a partner before deleting apps.');
      return;
    }
    if (!canManageApps) return;
    Alert.alert(
      'Delete app',
      `Remove ${app.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRequest(
                ROUTES.partners.organizationApp(partnerId, app.id),
                { errorMessage: 'Unable to delete app.' },
              );
              Alert.alert('Removed', `${app.name} was removed.`);
              onRefresh?.();
            } catch (err: any) {
              Alert.alert('Delete failed', err?.message || 'Unable to delete the app.');
            }
          },
        },
      ],
      { cancelable: true },
    );
  }, [canManageApps, onRefresh, partnerId]);

  const handleCreateApp = () => {
    if (!partnerId) {
      Alert.alert('Partner required', 'Select a partner before creating apps.');
      return;
    }
    if (!canManageApps) {
      Alert.alert('Permission denied', 'You cannot manage organization apps.');
      return;
    }
    navigation.navigate('OrganizationAppForm', { partnerId });
  };

  const handleEditApp = useCallback((app: PartnerOrganizationApp) => {
    if (!partnerId) {
      Alert.alert('Partner required', 'Select a partner before editing apps.');
      return;
    }
    if (!canManageApps) return;
    navigation.navigate('OrganizationAppForm', { partnerId, app });
  }, [canManageApps, navigation, partnerId]);

  const panelBody = useMemo(() => {
    if (loading) {
      return <ActivityIndicator size="large" color={palette.primaryStrong} />;
    }
    if (error) {
      return (
        <Text style={{ color: palette.danger, fontSize: 12 }}>{error}</Text>
      );
    }
    if (!apps.length) {
      return (
        <Text style={{ color: palette.subtext, fontSize: 12 }}>
          No organization apps configured yet. Use the create button above.
        </Text>
      );
    }
    return apps.map((app) => (
      <View
        key={app.id}
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 16,
          padding: 12,
          marginBottom: 12,
          backgroundColor: palette.surface,
          gap: 6,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: '700', fontSize: 16 }}>
          {app.name}
        </Text>
        <Text style={{ color: palette.subtext, fontSize: 12 }}>
          {TYPE_LABELS[app.type ?? ''] ?? 'Organization App'}
        </Text>
        <Text style={{ color: palette.subtext, fontSize: 11 }}>
          Status: {app.status || 'draft'} · Scope: {app.is_promoted_global ? 'global promoted' : 'partner launcher'}
        </Text>
        {app.description ? (
          <Text style={{ color: palette.subtext, fontSize: 12 }}>
            {app.description}
          </Text>
        ) : null}
        {app.tabs?.length ? (
          <Text style={{ color: palette.subtext, fontSize: 11 }}>
            Tabs: {app.tabs.map((tab) => tab.title).join(', ')}
          </Text>
        ) : null}
        <Text style={{ color: palette.subtext, fontSize: 11 }}>
          Visible to:{' '}
          {(app.visible_to && app.visible_to.length ? app.visible_to : DEFAULT_VISIBILITY).join(', ')}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <KISButton
            title={app.link ? 'Open' : 'Awaiting link'}
            size="xs"
            variant={app.link ? 'primary' : 'outline'}
            disabled={!app.link}
            onPress={() => handleLaunchApp(app)}
          />
          {canManageApps ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <KISButton
                title="Edit"
                size="xs"
                variant="outline"
                onPress={() => handleEditApp(app)}
              />
              <KISButton
                title="Delete"
                size="xs"
                variant="outline"
                onPress={() => handleDelete(app)}
              />
            </View>
          ) : null}
        </View>
      </View>
    ));
  }, [apps, error, loading, palette, canManageApps, handleLaunchApp, handleEditApp, handleDelete]);

  if (!isOpen) return null;

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

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
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>
              Organization apps
            </Text>
            <Text
              style={[
                styles.settingsPanelDescription,
                { color: palette.subtext },
              ]}
            >
              Floating buttons, KIS/white-label apps, and integrations in one catalog.
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.settingsPanelBody}
          showsVerticalScrollIndicator={false}
        >
          {canManageApps ? (
            <View
              style={{
                borderWidth: 2,
                borderColor: palette.divider,
                borderRadius: 16,
                padding: 12,
                marginBottom: 12,
                backgroundColor: palette.surface,
                gap: 8,
              }}
            >
              <Text style={{ color: palette.text, fontWeight: '700' }}>
                Manage organization apps
              </Text>
              <KISButton
                title="Create new app"
                onPress={handleCreateApp}
                size="sm"
              />
              {onRefresh ? (
                <KISButton
                  title="Refresh list"
                  variant="outline"
                  onPress={onRefresh}
                  size="sm"
                />
              ) : null}
            </View>
          ) : null}
          {panelBody}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
