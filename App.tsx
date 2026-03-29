// App.tsx
import React, {
  useEffect,
  useMemo,
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
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RESULTS, openSettings, type PermissionStatus } from 'react-native-permissions';

import SplashScreen from './src/screens/SplashScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DeviceVerificationScreen from './src/screens/DeviceVerificationScreen';
import { MainTabs } from '@/navigation/AppNavigator';
import type { RootStackParamList } from '@/navigation/types';
import PartnerInsightsScreen from './src/screens/insights/PartnerInsightsScreen';
import AdminToolsScreen from './src/screens/insights/AdminToolsScreen';
import AdminDashboardScreen from './src/screens/insights/AdminDashboardScreen';
import AnalyticsDashboardScreen from './src/screens/insights/AnalyticsDashboardScreen';
import EventsDashboardScreen from './src/screens/insights/EventsDashboardScreen';
import ContentDashboardScreen from './src/screens/insights/ContentDashboardScreen';
import SurveysDashboardScreen from './src/screens/insights/SurveysDashboardScreen';
import MediaDashboardScreen from './src/screens/insights/MediaDashboardScreen';
import BridgeDashboardScreen from './src/screens/insights/BridgeDashboardScreen';
import TiersDashboardScreen from './src/screens/insights/TiersDashboardScreen';
import NotificationsDashboardScreen from './src/screens/insights/NotificationsDashboardScreen';
import OrganizationAppScreen from './src/screens/partners/OrganizationAppScreen';
import OrganizationAppFormScreen from './src/screens/partners/OrganizationAppFormScreen';
import HealthInstitutionDetailScreen from './src/screens/health/HealthInstitutionDetailScreen';
import HealthInstitutionManagementScreen from './src/screens/health/HealthInstitutionManagementScreen';
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
import { getRequest } from '@/network/get';
import ROUTES, { NEST_API_BASE_URL } from '@/network';
import { postRequest } from '@/network/post';
import { SocketProvider } from '@/SocketProvider';
import { GlobalProfilePreviewProvider } from '@/components/profile/GlobalProfilePreviewProvider';
import { initPushHandlers } from './src/push/notifications';
import {
  DEFAULT_CALLING_CODE,
  DEFAULT_COUNTRY_ISO,
  LocationCountryError,
  resolveLocationCountry,
} from '@/services/locationCountryService';
import { cleanIrrelevantStorage } from '@/utils/storageCleaner';

type AuthCtx = {
  isAuth: boolean;
  setAuth: (b: boolean) => void;
  setPhone?: (p: string | null) => void;
  locationReady?: boolean;
  countryISO?: string;
  callingCode?: string;
  refreshLocation?: (requestPermission?: boolean) => Promise<boolean>;
  user?: any | null;
  setUser?: (user: any | null) => void;
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

export default function App() {
  const scheme = useColorScheme();
  const [booting, setBooting] = useState(true);

  const [isAuth, setAuth] = useState(false);
  const [load, setLoad] = useState(false);
  const [_phone, setPhone] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [locationChecking, setLocationChecking] = useState(true);
  const [locationCountryISO, setLocationCountryISO] = useState(DEFAULT_COUNTRY_ISO);
  const [locationCallingCode, setLocationCallingCode] = useState(DEFAULT_CALLING_CODE);
  const [locationStatus, setLocationStatus] = useState<PermissionStatus | null>(null);
  const [locationError, setLocationError] = useState('Location access is required to use KIS.');

  const syncLocationCountry = useCallback(async (requestPermission: boolean = false) => {
    setLocationChecking(true);
    try {
      const resolved = await resolveLocationCountry(requestPermission);
      setLocationStatus(resolved.permissionStatus);
      setLocationCountryISO(resolved.countryISO);
      setLocationCallingCode(resolved.callingCode);
      setLocationReady(true);
      setLocationError('');
      return true;
    } catch (error: any) {
      if (error instanceof LocationCountryError) {
        setLocationStatus(error.permissionStatus || null);
        setLocationError(error.message || 'Location access is required to use KIS.');
      } else {
        setLocationStatus(null);
        setLocationError('Location access is required to use KIS.');
      }
      setLocationReady(false);
      return false;
    } finally {
      setLocationChecking(false);
    }
  }, []);

  useEffect(() => {
    void cleanIrrelevantStorage();
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
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
        const qs = storedPhone ? `?phone=${encodeURIComponent(storedPhone)}` : '';
        const res = await getRequest(`${ROUTES.auth.checkLogin}${qs}`, {
          errorMessage: 'Status check failed.',
          cacheType: 'AUTH_CACHE',
          forceNetwork: true,
        });

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
        } else if (res?.success === false && res?.message === 'No internet connection.') {
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
      // ⏳ Force splash screen for minimum 5 seconds
      await Promise.all([
        syncLocationCountry(true),
        checkAuth(),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);

      setBooting(false);
    })();
  }, [load, syncLocationCountry, checkAuth]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncLocationCountry(false);
      }
    });
    return () => subscription.remove();
  }, [syncLocationCountry]);

  useEffect(() => {
    if (!locationReady) return;
    const intervalId = setInterval(() => {
      syncLocationCountry(false);
    }, 60000);
    return () => clearInterval(intervalId);
  }, [locationReady, syncLocationCountry]);

  useEffect(() => {
    console.log('isAuth ->', isAuth);
  }, [isAuth]);

  useEffect(() => {
    initPushHandlers();
  }, []);

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
          await postRequest(`${NEST_API_BASE_URL}/notifications/tokens/register`, {
            token: apnsToken,
            platform: 'ios',
            deviceId: deviceId ?? undefined,
          });
        }

        if (finalToken) {
          await postRequest(`${NEST_API_BASE_URL}/notifications/tokens/register`, {
            token: finalToken,
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
            deviceId: deviceId ?? undefined,
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
    [isAuth, locationReady, locationCountryISO, locationCallingCode, syncLocationCountry, user],
  );

  if (booting) {
    return <SplashScreen />;
  }

  if (!locationReady) {
    return (
      <View style={locationStyles.root}>
        <Text style={locationStyles.title}>Location Required</Text>
        <Text style={locationStyles.message}>
          {locationError || 'Location access is required to use KIS.'}
        </Text>

        {locationChecking ? <ActivityIndicator size="small" /> : null}

        <Pressable
          style={locationStyles.primaryButton}
          onPress={async () => {
            if (locationStatus === RESULTS.BLOCKED) {
              await openSettings().catch(() => undefined);
              return;
            }
            await syncLocationCountry(true);
          }}
        >
          <Text style={locationStyles.primaryText}>
            {locationStatus === RESULTS.BLOCKED ? 'Open Settings' : 'Enable Location'}
          </Text>
        </Pressable>

        <Pressable
          style={locationStyles.secondaryButton}
          onPress={async () => {
            await syncLocationCountry(false);
          }}
        >
          <Text style={locationStyles.secondaryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <AuthContext.Provider value={ctx}>
      <SocketProvider>
        <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          <GlobalProfilePreviewProvider>
            <RootStack.Navigator screenOptions={{ headerShown: false }}>
              {isAuth ? (
                <>
                  <RootStack.Screen name="MainTabs" component={MainTabs} />
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
                </>
              ) : (
                <>
                  <RootStack.Screen name="Welcome" component={WelcomeScreen} />
                  <RootStack.Screen name="Login" component={LoginScreen} />
                  <RootStack.Screen name="Register" component={RegisterScreen} />
                  <RootStack.Screen name="DeviceVerification">
                    {(props) => (
                      <DeviceVerificationScreen {...props} setLoad={setLoad} />
                    )}
                  </RootStack.Screen>
                </>
              )}
            </RootStack.Navigator>
          </GlobalProfilePreviewProvider>
        </NavigationContainer>
      </SocketProvider>
    </AuthContext.Provider>
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
});
