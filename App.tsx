// App.tsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  createContext,
  useContext,
} from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RESULTS,
  openSettings,
  type PermissionStatus,
} from 'react-native-permissions';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SplashScreen from './src/screens/SplashScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DeviceVerificationScreen from './src/screens/DeviceVerificationScreen';
import TwoFactorScreen from './src/screens/TwoFactorScreen';
import { MainTabs } from '@/navigation/AppNavigator';
import type { RootStackParamList } from '@/navigation/types';
import BroadcastDetailScreen from '@/screens/tabs/feeds/BroadcastDetailScreen';
import PlaylistsScreen from '@/screens/broadcast/playlists/PlaylistsScreen';
import PlaylistDetailScreen from '@/screens/broadcast/playlists/PlaylistDetailScreen';
import ChannelHomePage from '@/screens/broadcast/channels/ChannelHomePage';
import ChannelContentDetailPage from '@/screens/broadcast/channels/ChannelContentDetailPage';
import LiveWatchPage from '@/screens/broadcast/channels/LiveWatchPage';
import PartnerInsightsScreen from './src/screens/insights/PartnerInsightsScreen';
import AdminToolsScreen from './src/screens/insights/AdminToolsScreen';
import AdminDashboardScreen from './src/screens/insights/AdminDashboardScreen';
import ModerationConsoleScreen from './src/screens/insights/ModerationConsoleScreen';
import AnalyticsDashboardScreen from './src/screens/insights/AnalyticsDashboardScreen';
import EventsDashboardScreen from './src/screens/insights/EventsDashboardScreen';
import ContentDashboardScreen from './src/screens/insights/ContentDashboardScreen';
import SurveysDashboardScreen from './src/screens/insights/SurveysDashboardScreen';
import MediaDashboardScreen from './src/screens/insights/MediaDashboardScreen';
import BridgeDashboardScreen from './src/screens/insights/BridgeDashboardScreen';
import BridgeManagementScreen from './src/screens/insights/BridgeManagementScreen';
import TiersDashboardScreen from './src/screens/insights/TiersDashboardScreen';
import NotificationsDashboardScreen from './src/screens/insights/NotificationsDashboardScreen';
import OrganizationAppScreen from './src/screens/partners/OrganizationAppScreen';
import OrganizationAppFormScreen from './src/screens/partners/OrganizationAppFormScreen';
import OrgAppLaunchScreen from './src/screens/partners/OrgAppLaunchScreen';
import HealthInstitutionDetailScreen from './src/screens/health/HealthInstitutionDetailScreen';
import HealthInstitutionManagementScreen from './src/screens/health/HealthInstitutionManagementScreen';
import ClinicalCommandCenterScreen from './src/screens/health/ClinicalCommandCenterScreen';
import InstitutionProfileEditorScreen from './src/screens/health/InstitutionProfileEditorScreen';
import ProfileLandingEditorScreen from './src/screens/profile/ProfileLandingEditorScreen';
import AvailabilityManagementScreen from './src/screens/health/AvailabilityManagementScreen';
import HealthInstitutionMembersScreen from './src/screens/health/HealthInstitutionMembersScreen';
import InstitutionServicesCatalogScreen from './src/screens/health/InstitutionServicesCatalogScreen';
import InstitutionLandingPreviewScreen from './src/screens/health/InstitutionLandingPreviewScreen';
import HealthInstitutionCardsScreen from './src/screens/health/HealthInstitutionCardsScreen';
import HealthServiceSessionScreen from './src/screens/health/HealthServiceSessionScreen';
import ShopDashboardScreen from '@/screens/market/ShopDashboardScreen';
import ServiceBookingDetailsPage from '@/screens/market/ServiceBookingDetailsPage';
import ServiceBookingScreen from '@/screens/market/ServiceBookingScreen';
import ProductDetailsPage from '@/screens/broadcast/market/ProductDetailsPage';
import NetInfo from '@react-native-community/netinfo';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import { SocketProvider } from '@/SocketProvider';
import { GlobalProfilePreviewProvider } from '@/components/profile/GlobalProfilePreviewProvider';
import { initPushHandlers } from './src/push/notifications';
import InAppNotificationToast, {
  InAppNotificationToastRef,
} from './src/push/InAppNotificationToast';
import { getAccessToken } from './src/security/authStorage';
import ShopProductsPage from '@/screens/broadcast/market/pages/ShopProductsPage';
import ShopServicesPage from '@/screens/broadcast/market/pages/ShopServicesPage';
import {
  CALLING_CODE_BY_ISO,
  COUNTRY_NAMES,
  DEFAULT_CALLING_CODE,
  DEFAULT_COUNTRY_ISO,
  LocationCountryError,
  callingCodeForCountry,
  resolveLocationCountry,
  wasLocationPermissionEverGranted,
  getLastCachedLocationCountry,
  cacheLocationCountry,
} from '@/services/locationCountryService';
import { cleanIrrelevantStorage } from '@/utils/storageCleaner';
import type { KISUser } from '@/types/user';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import CartsListPage from '@/screens/market/cart/CartsListPage';
import CartDetailPage from '@/screens/market/cart/CartDetailPage';
import MyOrdersPage from '@/screens/market/orders/MyOrdersPage';
import MarketplaceOrderDetailPage from '@/screens/market/orders/MarketplaceOrderDetailPage';
import ProviderOrdersPage from '@/screens/market/orders/ProviderOrdersPage';
import ProfileRecentActivityScreen from '@/screens/profile/ProfileRecentActivityScreen';
import ProfileImpactSnapshotScreen from '@/screens/profile/ProfileImpactSnapshotScreen';
import ProfileNotificationsScreen from '@/screens/profile/ProfileNotificationsScreen';
import ProfileNotificationDetailScreen from '@/screens/profile/ProfileNotificationDetailScreen';
import KISPrinciplesScreen from '@/screens/profile/KISPrinciplesScreen';
import AccountDeletionScreen from '@/screens/AccountDeletionScreen';
import PasswordChangeScreen from '@/screens/PasswordChangeScreen';
import ComplianceSettingsScreen from '@/screens/ComplianceSettingsScreen';
import AdminUserManagementScreen from '@/screens/AdminUserManagementScreen';
import DeviceManagementScreen from '@/screens/DeviceManagementScreen';
import InvoiceListScreen from '@/screens/market/InvoiceListScreen';
import LoyaltyScreen from '@/screens/market/LoyaltyScreen';
import PromoCodeScreen from '@/screens/market/PromoCodeScreen';
import GlobalSearchScreen from '@/screens/GlobalSearchScreen';
import EventsScreen from '@/screens/EventsScreen';
import LanguageSwitcher from '@/languages/LanguageSwitcher';
import { LanguageProvider, useLanguage } from '@/languages';
import SetupPINScreen from '@/screens/SetupPINScreen';
import QuickLockScreen from '@/screens/QuickLockScreen';
import WalletScreen from '@/screens/WalletScreen';
import SubscriptionManagementScreen from '@/screens/SubscriptionManagementScreen';
import AIIntegrationScreen from './src/screens/insights/AIIntegrationScreen';
import MediaAssetManagerScreen from './src/screens/insights/MediaAssetManagerScreen';
import SurveyManagerScreen from './src/screens/insights/SurveyManagerScreen';
import { isPINEnabled, shouldLockAsync } from '@/services/QuickLockService';

type AuthCtx = {
  isAuth: boolean;
  setAuth: (b: boolean) => void;
  setPhone?: (p: string | null) => void;
  locationReady?: boolean;
  countryISO?: string;
  callingCode?: string;
  refreshLocation?: (requestPermission?: boolean) => Promise<boolean>;
  user?: KISUser | null;
  setUser?: (user: KISUser | null) => void;
};
const AuthContext = createContext<AuthCtx>({
  isAuth: false,
  setAuth: () => {},
  locationReady: false,
  countryISO: DEFAULT_COUNTRY_ISO,
  callingCode: DEFAULT_CALLING_CODE,
  refreshLocation: async () => false,
  user: null,
  setUser: () => {},
});
export const useAuth = () => useContext(AuthContext);

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AUTH_429_BACKOFF_MS = 2 * 60 * 1000;
let appAuthCheckBlockedUntil = 0;

function AppContent() {
  const { language } = useLanguage();
  const scheme = useColorScheme();
  const [booting, setBooting] = useState(true);

  const navigationRef = useRef<any>(null);

  const [isAuth, setAuth] = useState(false);
  const [load, setLoad] = useState(false);
  const [_phone, setPhone] = useState<string | null>(null);
  const [user, setUser] = useState<KISUser | null>(null);
  const [showQuickLock, setShowQuickLock] = useState(false);
  const lastActiveAtRef = useRef<number>(Date.now());
  const [locationReady, setLocationReady] = useState(false);
  const locationReadyRef = useRef(false);
  const [locationChecking, setLocationChecking] = useState(true);
  const [locationCountryISO, setLocationCountryISO] =
    useState(DEFAULT_COUNTRY_ISO);
  const [locationCallingCode, setLocationCallingCode] =
    useState(DEFAULT_CALLING_CODE);
  const [locationStatus, setLocationStatus] = useState<PermissionStatus | null>(
    null,
  );
  const [locationError, setLocationError] = useState(
    'Location access is required to use KIS.',
  );
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const syncLocationCountry = useCallback(
    async (requestPermission: boolean = false) => {
      setLocationChecking(true);
      try {
        const resolved = await resolveLocationCountry(requestPermission);
        setLocationStatus(resolved.permissionStatus);
        setLocationCountryISO(resolved.countryISO);
        setLocationCallingCode(resolved.callingCode);
        locationReadyRef.current = true;
        setLocationReady(true);
        setLocationError('');

        // Permission granted but the device location service (GPS) is off.
        // The app proceeds normally (IP-based country was used), but we prompt
        // the user once to turn location back on — no blocking screen shown.
        if (resolved.locationServiceOff) {
          Alert.alert(
            'Location Services Off',
            'Your device location is turned off. Turn it on for accurate country and calling code detection.',
            [
              {
                text: 'Open Settings',
                onPress: () => openSettings().catch(() => undefined),
              },
              { text: 'OK', style: 'cancel' },
            ],
            { cancelable: true },
          );
        }

        return true;
      } catch (error: any) {
        if (__DEV__ && Platform.OS === 'android') {
          // Android emulators frequently have no working location provider.
          setLocationStatus(error?.permissionStatus || null);
          setLocationCountryISO(DEFAULT_COUNTRY_ISO);
          setLocationCallingCode(DEFAULT_CALLING_CODE);
          locationReadyRef.current = true;
          setLocationReady(true);
          setLocationError('');
          return true;
        }

        if (error instanceof LocationCountryError) {
          setLocationStatus(error.permissionStatus || null);

          // GPS is off AND IP also failed — don't block the app.
          // Use the default country and prompt to enable location services.
          if (error.code === 'location_service_off') {
            const cachedFallback = await getLastCachedLocationCountry();
            const iso = cachedFallback?.iso || DEFAULT_COUNTRY_ISO;
            const code = cachedFallback?.callingCode || DEFAULT_CALLING_CODE;
            setLocationCountryISO(iso);
            setLocationCallingCode(code);
            await cacheLocationCountry(iso, code);
            locationReadyRef.current = true;
            setLocationReady(true);
            setLocationError('');
            Alert.alert(
              'Location Services Off',
              'Your device location is turned off. Turn it on in Settings so KIS can detect your country automatically.',
              [
                {
                  text: 'Open Settings',
                  onPress: () => openSettings().catch(() => undefined),
                },
                { text: 'Continue', style: 'cancel' },
              ],
            );
            return true;
          }

          // Location could not be determined — unblock the app regardless of
          // connectivity. If offline, inform the user. If online but GPS and IP
          // both failed (poor signal, API timeout, etc.), silently fall back to
          // the last known cached country or default. The background refresh
          // will correct the country automatically once detection succeeds.
          if (error.code === 'location_unavailable') {
            const [netState, cachedFallback] = await Promise.all([
              NetInfo.fetch(),
              getLastCachedLocationCountry(),
            ]);
            const iso = cachedFallback?.iso || DEFAULT_COUNTRY_ISO;
            const code = cachedFallback?.callingCode || DEFAULT_CALLING_CODE;
            setLocationCountryISO(iso);
            setLocationCallingCode(code);
            await cacheLocationCountry(iso, code);
            locationReadyRef.current = true;
            setLocationReady(true);
            setLocationError('');
            if (!netState.isConnected) {
              Alert.alert(
                'No Internet Connection',
                'You appear to be offline. Default country settings will be used — your location will update automatically when you reconnect.',
                [{ text: 'OK', style: 'cancel' }],
              );
            }
            return true;
          }

          setLocationError(
            error.message || 'Location access is required to use KIS.',
          );
        } else {
          setLocationStatus(null);
          setLocationError('Location access is required to use KIS.');
        }
        // Never regress from ready → not-ready (would kick user back from login
        // screen to location wall during background refresh or on reconnect).
        if (!locationReadyRef.current) {
          setLocationReady(false);
        }
        return false;
      } finally {
        setLocationChecking(false);
      }
    },
    [],
  );

  useEffect(() => {
    void cleanIrrelevantStorage();
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const storedPhone = await AsyncStorage.getItem('user_phone');

      console.log('checking login (token, phone):', token, storedPhone);

      setPhone(storedPhone);

      if (!token) {
        setUser(null);
        setAuth(false);
        return;
      }

      if (Date.now() < appAuthCheckBlockedUntil) {
        setUser(null);
        setAuth(true);
        return;
      }

      try {
        const qs = storedPhone
          ? `?phone=${encodeURIComponent(storedPhone)}`
          : '';
        let res = await getRequest(`${ROUTES.auth.checkLogin}${qs}`, {
          errorMessage: 'Status check failed.',
          cacheType: 'AUTH_CACHE',
          forceNetwork: true,
        });

        // Stored phone values can drift out of sync with backend formatting.
        // If a token exists, retry the auth check without phone lookup before
        // treating the session as logged out.
        if (
          token &&
          (Number(res?.status) === 404 || Number(res?.status) === 401) &&
          storedPhone
        ) {
          res = await getRequest(ROUTES.auth.checkLogin, {
            errorMessage: 'Status check failed.',
            cacheType: 'AUTH_CACHE',
            forceNetwork: true,
          });
        }

        console.log('checkLogin response:', res);

        const u = res?.data?.user ?? res?.data ?? null;
        const active = res?.success && (u?.is_active || u?.status === 'active');
        console.log('active from backend:', active);

        if (active) {
          setUser(u);
          setAuth(true);
        } else if (Number(res?.status) === 429) {
          appAuthCheckBlockedUntil = Date.now() + AUTH_429_BACKOFF_MS;
          setUser(u);
          setAuth(true);
        } else if (
          res?.success === false &&
          res?.message === 'No internet connection.'
        ) {
          console.log('Offline but token exists — trusting local auth.');
          setUser(u);
          setAuth(true);
        } else {
          setUser(null);
          setAuth(false);
        }
      } catch (networkErr: any) {
        console.log('[checkAuth] network error:', networkErr?.message);
        setUser(null);
        setAuth(true);
      }
    } catch (e: any) {
      console.log('[checkAuth] outer error:', e?.message);
      setUser(null);
      setAuth(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      // Pre-fill from cache immediately — prevents "Location Required" screen
      // on repeat launches when permission was already granted.
      const [cached, hadPermission] = await Promise.all([
        getLastCachedLocationCountry(),
        wasLocationPermissionEverGranted(),
      ]);
      if (cached?.iso) {
        setLocationCountryISO(cached.iso);
        setLocationCallingCode(cached.callingCode);
        locationReadyRef.current = true;
        setLocationReady(true);
      }

      const bootStart = Date.now();
      const BOOT_MIN_MS = 3_000;
      // Hard cap: auth check retries up to 3×15s; cap so splash never hangs.
      const BOOT_MAX_MS = 12_000;

      await Promise.race([
        Promise.allSettled([
          // Only request the OS permission dialog on the very first launch.
          syncLocationCountry(!hadPermission),
          checkAuth(),
        ]),
        new Promise<void>(resolve => setTimeout(resolve, BOOT_MAX_MS)),
      ]);

      // Ensure minimum splash duration regardless of how fast the checks ran.
      const elapsed = Date.now() - bootStart;
      if (elapsed < BOOT_MIN_MS) {
        await new Promise<void>(resolve => setTimeout(resolve, BOOT_MIN_MS - elapsed));
      }

      setBooting(false);
    })();
  }, [load, syncLocationCountry, checkAuth]);

  useEffect(() => {
    if (!locationReady) return;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startInterval = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => syncLocationCountry(false), 60000);
    };

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        syncLocationCountry(false);
        startInterval();
      } else {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
    });

    startInterval();
    return () => {
      subscription.remove();
      if (intervalId) clearInterval(intervalId);
    };
  }, [locationReady, syncLocationCountry]);

  useEffect(() => {
    console.log('isAuth ->', isAuth);
  }, [isAuth]);

  useEffect(() => {
    initPushHandlers(navigationRef);
  }, []);

  // Quick Lock: track background → foreground transitions
  useEffect(() => {
    if (!isAuth) return;
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        const pinEnabled = await isPINEnabled();
        if (pinEnabled) {
          const lock = await shouldLockAsync(lastActiveAtRef.current);
          if (lock) {
            setShowQuickLock(true);
          }
        }
        lastActiveAtRef.current = Date.now();
      } else if (nextState === 'background' || nextState === 'inactive') {
        lastActiveAtRef.current = Date.now();
      }
    });
    return () => subscription.remove();
  }, [isAuth]);

  useEffect(() => {
    if (!isAuth) return;
    let active = true;

    const registerPushToken = async () => {
      try {
        const token = await AsyncStorage.getItem('push_token');
        const fallbackToken = await AsyncStorage.getItem('fcm_token');
        const apnsToken = await AsyncStorage.getItem('apns_token');
        const deviceId = await AsyncStorage.getItem('device_id');
        const finalToken = token || fallbackToken;

        if (!active) return;

        if (Platform.OS === 'ios' && apnsToken) {
          await postRequest(ROUTES.notifications.deviceTokenRegister, {
            device_id: deviceId || 'unknown-device',
            platform: 'ios',
            push_token: finalToken || apnsToken,
            token_type: 'fcm',
            apns_token: apnsToken,
            metadata: { source: 'auth-bootstrap', apns_only: !finalToken },
          });
        } else if (finalToken) {
          await postRequest(ROUTES.notifications.deviceTokenRegister, {
            device_id: deviceId || 'unknown-device',
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
            push_token: finalToken,
            token_type: 'fcm',
            apns_token: apnsToken || '',
            metadata: { source: 'auth-bootstrap' },
          });
        }
      } catch (e: any) {
        console.log('[push-token] register failed:', e?.message);
      }
    };

    registerPushToken();

    return () => {
      active = false;
    };
  }, [isAuth]);

  const ctx = useMemo(
    () => ({
      isAuth,
      setAuth,
      setPhone,
      locationReady,
      countryISO: locationCountryISO,
      callingCode: locationCallingCode,
      refreshLocation: syncLocationCountry,
      user,
      setUser,
    }),
    [
      isAuth,
      locationReady,
      locationCountryISO,
      locationCallingCode,
      syncLocationCountry,
      user,
    ],
  );

  if (booting) {
    return <SplashScreen />;
  }

  if (!locationReady) {
    const isBlocked = locationStatus === RESULTS.BLOCKED;
    const countryList = Object.keys(CALLING_CODE_BY_ISO)
      .map((iso) => ({ iso, name: COUNTRY_NAMES[iso] ?? iso, code: CALLING_CODE_BY_ISO[iso] }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const filtered = countrySearch.trim()
      ? countryList.filter(
          (c) =>
            c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
            c.iso.toLowerCase().includes(countrySearch.toLowerCase()) ||
            c.code.includes(countrySearch),
        )
      : countryList;

    return (
      <View key={`location-${language}`} style={{ flex: 1 }}>
        <View style={locationStyles.root}>
          <Text style={locationStyles.title}>Location Required</Text>
          <Text style={locationStyles.message}>
            KIS uses your location to set your country and calling code automatically.
          </Text>

          {locationChecking ? (
            <ActivityIndicator size="small" color="#111" />
          ) : null}

          {/* Primary action */}
          {!locationChecking && (
            <Pressable
              style={locationStyles.primaryButton}
              onPress={async () => {
                if (isBlocked) {
                  await openSettings().catch(() => undefined);
                } else {
                  await syncLocationCountry(true);
                }
              }}
            >
              <Text style={locationStyles.primaryText}>
                {isBlocked ? 'Open Settings' : 'Allow Location Access'}
              </Text>
            </Pressable>
          )}

          {/* Retry (when not blocked) */}
          {!locationChecking && !isBlocked && (
            <Pressable
              style={locationStyles.secondaryButton}
              onPress={() => syncLocationCountry(false)}
            >
              <Text style={locationStyles.secondaryText}>Retry</Text>
            </Pressable>
          )}

          {/* Manual country picker — always available */}
          {!locationChecking && (
            <Pressable
              style={locationStyles.skipButton}
              onPress={() => setShowCountryPicker(true)}
            >
              <Text style={locationStyles.skipText}>
                Choose country manually
              </Text>
            </Pressable>
          )}
        </View>

        {/* Country picker modal */}
        <Modal
          visible={showCountryPicker}
          animationType="slide"
          onRequestClose={() => setShowCountryPicker(false)}
        >
          <View style={locationStyles.pickerContainer}>
            <View style={locationStyles.pickerHeader}>
              <Text style={locationStyles.pickerTitle}>Choose your country</Text>
              <Pressable onPress={() => setShowCountryPicker(false)}>
                <Text style={locationStyles.pickerClose}>Cancel</Text>
              </Pressable>
            </View>
            <TextInput
              style={locationStyles.searchInput}
              placeholder="Search country…"
              value={countrySearch}
              onChangeText={setCountrySearch}
              autoFocus
              clearButtonMode="while-editing"
            />
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.iso}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={locationStyles.countryRow}
                  onPress={() => {
                    setLocationCountryISO(item.iso);
                    setLocationCallingCode(item.code);
                    void cacheLocationCountry(item.iso, item.code);
                    locationReadyRef.current = true;
                    setLocationReady(true);
                    setShowCountryPicker(false);
                    setCountrySearch('');
                  }}
                >
                  <Text style={locationStyles.countryName}>{item.name}</Text>
                  <Text style={locationStyles.countryCode}>
                    {item.iso}  {item.code}
                  </Text>
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={locationStyles.separator} />}
            />
          </View>
        </Modal>

        <LanguageSwitcher />
      </View>
    );
  }

  return (
    <AuthContext.Provider key={`auth-${language}`} value={ctx}>
      <SocketProvider>
        <View key={`app-${language}`} style={{ flex: 1 }}>
          <NavigationContainer
            ref={navigationRef}
            key={`nav-${language}`}
            theme={scheme === 'dark' ? DarkTheme : DefaultTheme}
            linking={{
              prefixes: ['kis://'],
              config: {
                screens: {
                  OrgAppLaunch: 'org-app/:partnerId/:appId',
                },
              },
            }}
          >
            <GlobalProfilePreviewProvider>
              <RootStack.Navigator screenOptions={{ headerShown: false }}>
                {isAuth ? (
                  <>
                    <RootStack.Screen name="MainTabs" component={MainTabs} />
                    <RootStack.Screen
                      name="BroadcastDetail"
                      component={BroadcastDetailScreen}
                    />
                    <RootStack.Screen
                      name="ChannelHome"
                      component={ChannelHomePage}
                    />
                    <RootStack.Screen
                      name="ChannelContentDetail"
                      component={ChannelContentDetailPage}
                    />
                    <RootStack.Screen
                      name="LiveWatch"
                      component={LiveWatchPage}
                    />
                    <RootStack.Screen
                      name="PartnerInsights"
                      component={PartnerInsightsScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="OrganizationApp"
                      component={OrganizationAppScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="OrgAppLaunch"
                      component={OrgAppLaunchScreen}
                    />
                    <RootStack.Screen
                      name="OrganizationAppForm"
                      component={OrganizationAppFormScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="AdminTools"
                      component={AdminToolsScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="AdminUserManagement"
                      component={AdminUserManagementScreen}
                      options={{ headerShown: false }}
                    />
                    <RootStack.Screen
                      name="ModerationConsole"
                      component={ModerationConsoleScreen}
                      options={{ presentation: 'modal', title: 'Moderation Console' }}
                    />
                    <RootStack.Screen
                      name="GlobalSearch"
                      component={GlobalSearchScreen}
                      options={{ presentation: 'modal', title: 'Search' }}
                    />
                    <RootStack.Screen
                      name="Events"
                      component={EventsScreen}
                      options={{ presentation: 'modal', title: 'Events' }}
                    />
                    <RootStack.Screen
                      name="AnalyticsDashboard"
                      component={AnalyticsDashboardScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="EventsDashboard"
                      component={EventsDashboardScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="ContentDashboard"
                      component={ContentDashboardScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="SurveysDashboard"
                      component={SurveysDashboardScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="MediaDashboard"
                      component={MediaDashboardScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="BridgeDashboard"
                      component={BridgeDashboardScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="BridgeManagement"
                      component={BridgeManagementScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="TiersDashboard"
                      component={TiersDashboardScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="NotificationsDashboard"
                      component={NotificationsDashboardScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="ShopDashboard"
                      component={ShopDashboardScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="ServiceBooking"
                      component={ServiceBookingScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="ProductDetail"
                      component={ProductDetailsPage}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="ShopProducts"
                      component={ShopProductsPage}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="ShopServices"
                      component={ShopServicesPage}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="CartsList"
                      component={CartsListPage}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="CartDetail"
                      component={CartDetailPage}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="MarketplaceOrders"
                      component={MyOrdersPage}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="MarketplaceProviderOrders"
                      component={ProviderOrdersPage}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="MarketplaceReceivedOrders"
                      component={ProviderOrdersPage}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="MarketplaceOrderDetail"
                      component={MarketplaceOrderDetailPage}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="ProfileRecentActivity"
                      component={ProfileRecentActivityScreen}
                      options={{
                        presentation: 'modal',
                        title: 'Recent activity',
                      }}
                    />
                    <RootStack.Screen
                      name="ProfileImpactSnapshot"
                      component={ProfileImpactSnapshotScreen}
                      options={{
                        presentation: 'modal',
                        title: 'Impact snapshot',
                      }}
                    />
                    <RootStack.Screen
                      name="ProfileNotifications"
                      component={ProfileNotificationsScreen}
                      options={{
                        presentation: 'modal',
                        title: 'Notifications',
                      }}
                    />
                    <RootStack.Screen
                      name="ProfileNotificationDetail"
                      component={ProfileNotificationDetailScreen}
                      options={{ presentation: 'modal', title: 'Notification' }}
                    />
                    <RootStack.Screen
                      name="KISPrinciples"
                      component={KISPrinciplesScreen}
                      options={{
                        presentation: 'modal',
                        title: 'KIS Principles',
                      }}
                    />
                    <RootStack.Screen
                      name="PasswordChange"
                      component={PasswordChangeScreen}
                    />
                    <RootStack.Screen
                      name="ComplianceSettings"
                      component={ComplianceSettingsScreen}
                      options={{ headerShown: false }}
                    />
                    <RootStack.Screen
                      name="DeviceManagement"
                      component={DeviceManagementScreen}
                    />
                    <RootStack.Screen
                      name="AccountDeletion"
                      component={AccountDeletionScreen}
                    />
                    <RootStack.Screen
                      name="InvoiceList"
                      component={InvoiceListScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="Loyalty"
                      component={LoyaltyScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="PromoCode"
                      component={PromoCodeScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="Wallet"
                      component={WalletScreen}
                      options={{ presentation: 'modal', title: 'Wallet' }}
                    />
                    <RootStack.Screen
                      name="SubscriptionManagement"
                      component={SubscriptionManagementScreen}
                      options={{ presentation: 'modal', title: 'Subscription' }}
                    />
                    <RootStack.Screen
                      name="PlaylistList"
                      component={PlaylistsScreen}
                    />
                    <RootStack.Screen
                      name="PlaylistDetail"
                      component={PlaylistDetailScreen}
                    />
                    <RootStack.Screen
                      name="ServiceBookingDetails"
                      component={ServiceBookingDetailsPage}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="HealthInstitutionDetail"
                      component={HealthInstitutionDetailScreen}
                    />
                    <RootStack.Screen
                      name="HealthInstitutionManagement"
                      component={HealthInstitutionManagementScreen}
                    />
                    <RootStack.Screen
                      name="ClinicalCommandCenter"
                      component={ClinicalCommandCenterScreen}
                    />
                    <RootStack.Screen
                      name="InstitutionProfileEditor"
                      component={InstitutionProfileEditorScreen}
                    />
                    <RootStack.Screen
                      name="ProfileLandingEditor"
                      component={ProfileLandingEditorScreen}
                    />
                    <RootStack.Screen
                      name="AvailabilityManagement"
                      component={AvailabilityManagementScreen}
                    />
                    <RootStack.Screen
                      name="HealthInstitutionMembers"
                      component={HealthInstitutionMembersScreen}
                    />
                    <RootStack.Screen
                      name="HealthInstitutionServicesCatalog"
                      component={InstitutionServicesCatalogScreen}
                    />
                    <RootStack.Screen
                      name="HealthInstitutionCards"
                      component={HealthInstitutionCardsScreen}
                    />
                    <RootStack.Screen
                      name="HealthServiceSession"
                      component={HealthServiceSessionScreen}
                    />
                    <RootStack.Screen
                      name="InstitutionLandingPreview"
                      component={InstitutionLandingPreviewScreen}
                    />
                    <RootStack.Screen
                      name="AdminDashboard"
                      component={AdminDashboardScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="AIIntegration"
                      component={AIIntegrationScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="MediaAssetManager"
                      component={MediaAssetManagerScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="SurveyManager"
                      component={SurveyManagerScreen}
                      options={{ presentation: 'modal' }}
                    />
                    <RootStack.Screen
                      name="SetupPIN"
                      component={SetupPINScreen}
                      options={{ presentation: 'modal' }}
                    />
                  </>
                ) : (
                  <>
                    <RootStack.Screen
                      name="Welcome"
                      component={WelcomeScreen}
                    />
                    <RootStack.Screen name="Login" component={LoginScreen} />
                    <RootStack.Screen
                      name="Register"
                      component={RegisterScreen}
                    />
                    <RootStack.Screen name="DeviceVerification">
                      {props => (
                        <DeviceVerificationScreen
                          {...props}
                          setLoad={setLoad}
                        />
                      )}
                    </RootStack.Screen>
                    <RootStack.Screen
                      name="TwoFactor"
                      component={TwoFactorScreen}
                      options={{ headerShown: false }}
                    />
                  </>
                )}
              </RootStack.Navigator>
            </GlobalProfilePreviewProvider>
          </NavigationContainer>
          <LanguageSwitcher />
          <InAppNotificationToast ref={InAppNotificationToastRef} />
          {showQuickLock && isAuth ? (
            <QuickLockScreen onDismiss={() => {
              setShowQuickLock(false);
              lastActiveAtRef.current = Date.now();
            }} />
          ) : null}
        </View>
      </SocketProvider>
    </AuthContext.Provider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary fallbackLabel="The app encountered an unexpected error. Please restart.">
        <LanguageProvider>
          <AppContent />
        </LanguageProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const locationStyles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#444444',
    textAlign: 'center',
    maxWidth: 420,
  },
  primaryButton: {
    minHeight: 48,
    minWidth: 180,
    borderRadius: 10,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 44,
    minWidth: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryText: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  skipText: {
    color: '#555555',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDDDDD',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  pickerClose: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  searchInput: {
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    fontSize: 15,
    backgroundColor: '#F7F7F7',
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  countryName: {
    fontSize: 15,
    color: '#111111',
    flex: 1,
  },
  countryCode: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '600',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EEEEEE',
    marginLeft: 20,
  },
});
