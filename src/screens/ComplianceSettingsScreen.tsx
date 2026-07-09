// src/screens/ComplianceSettingsScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import { useResponsiveLayout, type ResponsiveLayout } from '@/theme/responsive';
import { updateConsentCache } from '@/services/consentService';
import type { RootStackParamList } from '@/navigation/types';

const APP_VERSION = '0.0.1';

const ANALYTICS_ENABLED_KEY = 'kis_compliance_analytics_enabled';
const PERSONALIZATION_ENABLED_KEY = 'kis_compliance_personalization_enabled';
const OFFLINE_DATA_ENABLED_KEY = 'kis_compliance_offline_data_enabled';

// Keys that should be preserved when the user clears local cache
const AUTH_KEYS_TO_PRESERVE = ['access_token', 'refresh_token', 'kis_device_id', 'kis_pin_hash', 'kis_pin_enabled', 'kis_lock_timeout'];

export default function ComplianceSettingsScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const responsive = useResponsiveLayout();

  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [personalizationEnabled, setPersonalizationEnabled] = useState(true);
  const [offlineDataEnabled, setOfflineDataEnabled] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [dataExportLoading, setDataExportLoading] = useState(false);
  const [cacheClearLoading, setCacheClearLoading] = useState(false);

  useEffect(() => {
    void loadPreferences();
    void load2FAStatus();
  }, []);

  const syncConsentToBackend = useCallback(async (update: { analytics?: boolean; personalization?: boolean; offline_data?: boolean }) => {
    try {
      await patchRequest(ROUTES.profilePreferences.me, { consent_preferences: update });
    } catch { /* non-blocking — local state already updated */ }
  }, []);

  const loadPreferences = async () => {
    try {
      // Try backend first for cross-device consistency
      const res = await getRequest(ROUTES.profilePreferences.me, { errorMessage: '' });
      if (res?.success && res.data?.consent_preferences) {
        const prefs = res.data.consent_preferences;
        if (prefs.analytics !== undefined) setAnalyticsEnabled(Boolean(prefs.analytics));
        if (prefs.personalization !== undefined) setPersonalizationEnabled(Boolean(prefs.personalization));
        if (prefs.offline_data !== undefined) setOfflineDataEnabled(Boolean(prefs.offline_data));
        return;
      }
    } catch { /* fall through */ }
    try {
      const [analytics, personalization, offline] = await Promise.all([
        AsyncStorage.getItem(ANALYTICS_ENABLED_KEY),
        AsyncStorage.getItem(PERSONALIZATION_ENABLED_KEY),
        AsyncStorage.getItem(OFFLINE_DATA_ENABLED_KEY),
      ]);
      if (analytics !== null) setAnalyticsEnabled(analytics === 'true');
      if (personalization !== null) setPersonalizationEnabled(personalization === 'true');
      if (offline !== null) setOfflineDataEnabled(offline === 'true');
    } catch {}
  };

  const load2FAStatus = async () => {
    try {
      const res = await getRequest(ROUTES.auth.twoFactorStatus, {
        errorMessage: 'Unable to load 2FA status.',
      });
      if (res?.success) {
        setTwoFactorEnabled(!!res.data?.enabled);
      }
    } catch {}
  };

  const handleAnalyticsToggle = useCallback(async (value: boolean) => {
    setAnalyticsEnabled(value);
    updateConsentCache({ analytics: value });
    await Promise.allSettled([
      AsyncStorage.setItem(ANALYTICS_ENABLED_KEY, String(value)),
      syncConsentToBackend({ analytics: value }),
    ]);
  }, [syncConsentToBackend]);

  const handlePersonalizationToggle = useCallback(async (value: boolean) => {
    setPersonalizationEnabled(value);
    updateConsentCache({ personalization: value });
    await Promise.allSettled([
      AsyncStorage.setItem(PERSONALIZATION_ENABLED_KEY, String(value)),
      syncConsentToBackend({ personalization: value }),
    ]);
  }, [syncConsentToBackend]);

  const handleOfflineDataToggle = useCallback(async (value: boolean) => {
    setOfflineDataEnabled(value);
    updateConsentCache({ offlineData: value });
    await Promise.allSettled([
      AsyncStorage.setItem(OFFLINE_DATA_ENABLED_KEY, String(value)),
      syncConsentToBackend({ offline_data: value }),
    ]);
  }, [syncConsentToBackend]);

  const handleDownloadData = useCallback(() => {
    Alert.alert(
      'Download My Data',
      'A data export will be generated and sent to your registered email address. This may take a few minutes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Export',
          onPress: async () => {
            setDataExportLoading(true);
            try {
              const res = await getRequest(ROUTES.auth.dataExport, {
                errorMessage: 'Unable to request data export.',
              });
              if (res?.success) {
                Alert.alert('Data Export', 'Your data export has been queued. You will receive an email when it is ready.');
              } else {
                Alert.alert('Data Export', res?.message || 'Unable to request data export at this time.');
              }
            } catch (err: any) {
              Alert.alert('Data Export', err?.message || 'Unable to request data export at this time.');
            } finally {
              setDataExportLoading(false);
            }
          },
        },
      ],
    );
  }, []);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Clear Local Cache',
      'This will remove locally cached data (messages, images, app data) but will keep your login credentials and PIN. The app will reload fresh data from the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            setCacheClearLoading(true);
            try {
              const allKeys = await AsyncStorage.getAllKeys();
              const keysToRemove = allKeys.filter(
                key => !AUTH_KEYS_TO_PRESERVE.some(authKey => key.includes(authKey)),
              );
              await AsyncStorage.multiRemove(keysToRemove);
              Alert.alert('Cache Cleared', 'Local cache has been cleared successfully.');
            } catch (err: any) {
              Alert.alert('Clear Cache', err?.message || 'Unable to clear cache.');
            } finally {
              setCacheClearLoading(false);
            }
          },
        },
      ],
    );
  }, []);

  const styles = createStyles(palette, responsive);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg, }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={12}>
          <KISIcon name="arrow-back" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Privacy &amp; Compliance</Text>
        <View style={{ width: responsive.minTouchTarget }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Privacy Controls */}
        <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Privacy Controls</Text>
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: palette.text }]}>Analytics</Text>
              <Text style={[styles.rowSubtitle, { color: palette.subtext }]}>
                Help improve KIS by sharing anonymous usage data
              </Text>
            </View>
            <Switch
              value={analyticsEnabled}
              onValueChange={handleAnalyticsToggle}
              trackColor={{ false: palette.divider, true: palette.primaryStrong }}
              thumbColor={palette.onPrimary}
            />
          </View>

          <View style={[styles.separator, { backgroundColor: palette.divider }]} />

          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: palette.text }]}>Personalization</Text>
              <Text style={[styles.rowSubtitle, { color: palette.subtext }]}>
                Allow KIS to tailor content recommendations to you
              </Text>
            </View>
            <Switch
              value={personalizationEnabled}
              onValueChange={handlePersonalizationToggle}
              trackColor={{ false: palette.divider, true: palette.primaryStrong }}
              thumbColor={palette.onPrimary}
            />
          </View>

          <View style={[styles.separator, { backgroundColor: palette.divider }]} />

          <Pressable
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: palette.surfaceElevated },
            ]}
            onPress={handleDownloadData}
            disabled={dataExportLoading}
          >
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: palette.text }]}>
                {dataExportLoading ? 'Requesting…' : 'Download My Data'}
              </Text>
              <Text style={[styles.rowSubtitle, { color: palette.subtext }]}>
                Export a copy of all your KIS data
              </Text>
            </View>
            <KISIcon name="chevron-right" size={16} color={palette.subtext} />
          </Pressable>

          <View style={[styles.separator, { backgroundColor: palette.divider }]} />

          <Pressable
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: palette.surfaceElevated },
            ]}
            onPress={() => navigation.navigate('AccountDeletion')}
          >
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: palette.danger }]}>
                Delete All My Data
              </Text>
              <Text style={[styles.rowSubtitle, { color: palette.subtext }]}>
                Permanently remove your account and all associated data
              </Text>
            </View>
            <KISIcon name="chevron-right" size={16} color={palette.danger} />
          </Pressable>
        </View>

        {/* Section 2: Security */}
        <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Security</Text>
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
          <Pressable
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: palette.surfaceElevated },
            ]}
            onPress={() => navigation.navigate('SetupPIN')}
          >
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: palette.text }]}>Biometric / PIN</Text>
              <Text style={[styles.rowSubtitle, { color: palette.subtext }]}>
                Set up app lock using PIN or biometrics
              </Text>
            </View>
            <KISIcon name="chevron-right" size={16} color={palette.subtext} />
          </Pressable>

          <View style={[styles.separator, { backgroundColor: palette.divider }]} />

          <Pressable
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: palette.surfaceElevated },
            ]}
            onPress={() => navigation.navigate('DeviceManagement')}
          >
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: palette.text }]}>Active Sessions</Text>
              <Text style={[styles.rowSubtitle, { color: palette.subtext }]}>
                View and manage devices signed into your account
              </Text>
            </View>
            <KISIcon name="chevron-right" size={16} color={palette.subtext} />
          </Pressable>

          <View style={[styles.separator, { backgroundColor: palette.divider }]} />

          <Pressable
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: palette.surfaceElevated },
            ]}
            onPress={() => navigation.navigate('TwoFactor', {})}
          >
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: palette.text }]}>Two-Factor Authentication</Text>
              <Text style={[styles.rowSubtitle, { color: palette.subtext }]}>
                {twoFactorEnabled ? 'Enabled — tap to manage' : 'Disabled — tap to set up'}
              </Text>
            </View>
            <KISIcon name="chevron-right" size={16} color={palette.subtext} />
          </Pressable>
        </View>

        {/* Section 3: Data & Storage */}
        <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Data &amp; Storage</Text>
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
          <Pressable
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: palette.surfaceElevated },
            ]}
            onPress={handleClearCache}
            disabled={cacheClearLoading}
          >
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: palette.text }]}>
                {cacheClearLoading ? 'Clearing…' : 'Clear Local Cache'}
              </Text>
              <Text style={[styles.rowSubtitle, { color: palette.subtext }]}>
                Remove cached data to free storage space. Login and PIN are preserved.
              </Text>
            </View>
            <KISIcon name="chevron-right" size={16} color={palette.subtext} />
          </Pressable>

          <View style={[styles.separator, { backgroundColor: palette.divider }]} />

          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: palette.text }]}>Offline Data</Text>
              <Text style={[styles.rowSubtitle, { color: palette.subtext }]}>
                Allow KIS to store data locally for offline access
              </Text>
            </View>
            <Switch
              value={offlineDataEnabled}
              onValueChange={handleOfflineDataToggle}
              trackColor={{ false: palette.divider, true: palette.primaryStrong }}
              thumbColor={palette.onPrimary}
            />
          </View>
        </View>

        {/* Section 4: Legal */}
        <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Legal</Text>
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
          <Pressable
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: palette.surfaceElevated },
            ]}
            onPress={() => navigation.navigate('TermsAndConditions')}
          >
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: palette.text }]}>Terms of Service</Text>
            </View>
            <KISIcon name="chevron-right" size={16} color={palette.subtext} />
          </Pressable>

          <View style={[styles.separator, { backgroundColor: palette.divider }]} />

          <Pressable
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: palette.surfaceElevated },
            ]}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          >
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: palette.text }]}>Privacy Policy</Text>
            </View>
            <KISIcon name="chevron-right" size={16} color={palette.subtext} />
          </Pressable>

          <View style={[styles.separator, { backgroundColor: palette.divider }]} />

          <Pressable
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: palette.surfaceElevated },
            ]}
            onPress={() =>
              Alert.alert(
                'KIS Coins Terms',
                'KIS Coins are promotional credits used within the KIS platform. They are not real currency, have no monetary value, and cannot be redeemed for cash or transferred outside the app.',
              )
            }
          >
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: palette.text }]}>KIS Coins Terms</Text>
            </View>
            <KISIcon name="chevron-right" size={16} color={palette.subtext} />
          </Pressable>

          <View style={[styles.separator, { backgroundColor: palette.divider }]} />

          <View style={[styles.row, { paddingVertical: 16 }]}>
            <Text style={[styles.rowSubtitle, { color: palette.subtext }]}>
              App Version {APP_VERSION}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(palette: any, responsive: ResponsiveLayout) {
  const gutter = responsive.pageGutter;
  return StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: gutter,
      paddingVertical: 14,
      minHeight: responsive.minTouchTarget,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backButton: {
      width: responsive.minTouchTarget,
      minHeight: responsive.minTouchTarget,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: responsive.bodyFontSize + 2,
      fontWeight: '700',
    },
    scroll: {
      paddingHorizontal: gutter,
      paddingTop: 20,
      paddingBottom: 48,
      gap: 8,
    },
    sectionLabel: {
      fontSize: responsive.labelFontSize,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 12,
      marginBottom: 6,
      paddingHorizontal: 4,
    },
    section: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
      marginBottom: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      minHeight: responsive.minTouchTarget,
      gap: 12,
    },
    rowContent: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      fontSize: responsive.bodyFontSize,
      fontWeight: '600',
    },
    rowSubtitle: {
      fontSize: responsive.labelFontSize,
      lineHeight: 17,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      marginLeft: 16,
    },
  });
}
