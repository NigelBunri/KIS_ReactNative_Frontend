// src/screens/ComplianceSettingsScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { API_BASE_URL } from '@/network';
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

  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [personalizationEnabled, setPersonalizationEnabled] = useState(true);
  const [offlineDataEnabled, setOfflineDataEnabled] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [dataExportLoading, setDataExportLoading] = useState(false);
  const [cacheClearLoading, setCacheClearLoading] = useState(false);

  useEffect(() => {
    void loadPreferences();
    void load2FAStatus();
  }, []);

  const loadPreferences = async () => {
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
      const res = await getRequest(`${API_BASE_URL}/api/v1/auth/2fa/status/`, {
        errorMessage: 'Unable to load 2FA status.',
      });
      if (res?.success) {
        setTwoFactorEnabled(!!res.data?.enabled);
      }
    } catch {}
  };

  const handleAnalyticsToggle = useCallback(async (value: boolean) => {
    setAnalyticsEnabled(value);
    try {
      await AsyncStorage.setItem(ANALYTICS_ENABLED_KEY, String(value));
    } catch {}
  }, []);

  const handlePersonalizationToggle = useCallback(async (value: boolean) => {
    setPersonalizationEnabled(value);
    try {
      await AsyncStorage.setItem(PERSONALIZATION_ENABLED_KEY, String(value));
    } catch {}
  }, []);

  const handleOfflineDataToggle = useCallback(async (value: boolean) => {
    setOfflineDataEnabled(value);
    try {
      await AsyncStorage.setItem(OFFLINE_DATA_ENABLED_KEY, String(value));
    } catch {}
  }, []);

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
              const res = await getRequest(`${API_BASE_URL}/api/v1/auth/data-export/`, {
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

  const handle2FAToggle = useCallback(async (value: boolean) => {
    setTwoFactorLoading(true);
    try {
      const endpoint = value
        ? `${API_BASE_URL}/api/v1/auth/2fa/enable/`
        : `${API_BASE_URL}/api/v1/auth/2fa/disable/`;
      const res = await postRequest(endpoint, {}, {
        errorMessage: `Unable to ${value ? 'enable' : 'disable'} two-factor authentication.`,
      });
      if (res?.success) {
        setTwoFactorEnabled(value);
        Alert.alert(
          'Two-Factor Authentication',
          value ? '2FA has been enabled on your account.' : '2FA has been disabled.',
        );
      } else {
        Alert.alert('Two-Factor Authentication', res?.message || `Unable to ${value ? 'enable' : 'disable'} 2FA.`);
      }
    } catch (err: any) {
      Alert.alert('Two-Factor Authentication', err?.message || 'Unable to update 2FA settings.');
    } finally {
      setTwoFactorLoading(false);
    }
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

  const openURL = useCallback(async (url: string, label: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(label, 'Unable to open this link.');
      }
    } catch {
      Alert.alert(label, 'Unable to open this link.');
    }
  }, []);

  const styles = createStyles(palette);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={12}>
          <KISIcon name="arrow-back" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Privacy &amp; Compliance</Text>
        <View style={{ width: 40 }} />
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
              thumbColor="#fff"
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
              thumbColor="#fff"
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
              <Text style={[styles.rowTitle, { color: palette.danger ?? '#E53935' }]}>
                Delete All My Data
              </Text>
              <Text style={[styles.rowSubtitle, { color: palette.subtext }]}>
                Permanently remove your account and all associated data
              </Text>
            </View>
            <KISIcon name="chevron-right" size={16} color={palette.danger ?? '#E53935'} />
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

          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: palette.text }]}>Two-Factor Authentication</Text>
              <Text style={[styles.rowSubtitle, { color: palette.subtext }]}>
                {twoFactorEnabled ? 'Enabled — adds an extra layer of security' : 'Add an extra layer of login security'}
              </Text>
            </View>
            <Switch
              value={twoFactorEnabled}
              onValueChange={handle2FAToggle}
              disabled={twoFactorLoading}
              trackColor={{ false: palette.divider, true: palette.primaryStrong }}
              thumbColor="#fff"
            />
          </View>
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
              thumbColor="#fff"
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
            onPress={() => openURL('https://kisapp.com/terms', 'Terms of Service')}
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
            onPress={() => openURL('https://kisapp.com/privacy', 'Privacy Policy')}
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

function createStyles(palette: any) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backButton: {
      width: 40,
      alignItems: 'flex-start',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
    },
    scroll: {
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 48,
      gap: 8,
    },
    sectionLabel: {
      fontSize: 12,
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
      gap: 12,
    },
    rowContent: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: '600',
    },
    rowSubtitle: {
      fontSize: 12,
      lineHeight: 17,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      marginLeft: 16,
    },
  });
}
