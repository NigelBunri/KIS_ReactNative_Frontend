// App.tsx
// Install the localization runtime patch as early as possible so ALL JSX text
// is auto-translated before any component ever renders.
import { installLocalizationRuntime } from '@/languages/runtimePatch';
installLocalizationRuntime();

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
  DeviceEventEmitter,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StatusBar,
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
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { startOfflineActionQueue, stopOfflineActionQueue } from '@/services/offlineActionQueue';
import { startMediaTransferQueue, stopMediaTransferQueue } from '@/services/mediaTransferQueue';
import { flushPendingMutations } from '@/services/pendingMutationsQueue';
import { loadConsentPreferences } from '@/services/consentService';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

import SplashScreen from './src/screens/SplashScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import TermsAndConditionsScreen from './src/screens/TermsAndConditionsScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import DeviceVerificationScreen from './src/screens/DeviceVerificationScreen';
import VerificationChannelSelectScreen from './src/screens/VerificationChannelSelectScreen';
import TwoFactorScreen from './src/screens/TwoFactorScreen';
import { MainTabs } from '@/navigation/AppNavigator';
import type { RootStackParamList } from '@/navigation/types';
import BroadcastDetailScreen from '@/screens/tabs/feeds/BroadcastDetailScreen';
import PlaylistsScreen from '@/screens/broadcast/playlists/PlaylistsScreen';
import PlaylistDetailScreen from '@/screens/broadcast/playlists/PlaylistDetailScreen';
import ChannelHomePage from '@/screens/broadcast/channels/ChannelHomePage';
import ChannelContentDetailPage from '@/screens/broadcast/channels/ChannelContentDetailPage';
import LiveWatchPage from '@/screens/broadcast/channels/LiveWatchPage';
import WatchHistoryScreen from '@/screens/broadcast/channels/WatchHistoryScreen';
import ShortsScreen from '@/screens/broadcast/channels/ShortsScreen';
import LikedVideosScreen from '@/screens/broadcast/channels/LikedVideosScreen';
import DownloadsScreen from '@/screens/broadcast/channels/DownloadsScreen';
import SubscriptionsScreen from '@/screens/broadcast/channels/SubscriptionsScreen';
import LibraryScreen from '@/screens/broadcast/channels/LibraryScreen';
import ClipsListScreen from '@/screens/broadcast/channels/ClipsListScreen';
import TrendingScreen from '@/screens/broadcast/channels/TrendingScreen';
import CategoryBrowsePage from '@/screens/broadcast/channels/CategoryBrowsePage';
import BroadcastSearchScreen from '@/screens/broadcast/channels/BroadcastSearchScreen';
import ActivityNotificationsScreen from '@/screens/broadcast/channels/ActivityNotificationsScreen';
import ChannelMembersScreen from '@/screens/broadcast/channels/ChannelMembersScreen';
import MembershipScreen from '@/screens/broadcast/channels/MembershipScreen';
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
import InviteJoinScreen from './src/screens/invite/InviteJoinScreen';
import CallJoinScreen from './src/screens/calls/CallJoinScreen';
import PartnerRedeemInviteScreen from './src/screens/partners/PartnerRedeemInviteScreen';
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
import { MiniPlayerProvider } from '@/contexts/MiniPlayerContext';
import MiniPlayer from '@/components/common/MiniPlayer';
import { initPushHandlers } from './src/push/notifications';
import InAppNotificationToast, {
  InAppNotificationToastRef,
} from './src/push/InAppNotificationToast';
import { getAccessToken, AUTH_SESSION_EXPIRED_EVENT } from './src/security/authStorage';
import { initE2EE } from '@/security/e2ee';
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
import BlockedContactsScreen from '@/screens/tabs/BlockedContactsScreen';
import PasswordChangeScreen from '@/screens/PasswordChangeScreen';
import ComplianceSettingsScreen from '@/screens/ComplianceSettingsScreen';
import CacheManagementScreen from '@/screens/CacheManagementScreen';
import AdminUserManagementScreen from '@/screens/AdminUserManagementScreen';
import DeviceManagementScreen from '@/screens/DeviceManagementScreen';
import QRScanLoginScreen from '@/screens/QRScanLoginScreen';
import ParentRecoveryScreen from '@/screens/ParentRecoveryScreen';
import InvoiceListScreen from '@/screens/market/InvoiceListScreen';
import LoyaltyScreen from '@/screens/market/LoyaltyScreen';
import PromoCodeScreen from '@/screens/market/PromoCodeScreen';
import GlobalSearchScreen from '@/screens/GlobalSearchScreen';
import EventsScreen from '@/screens/EventsScreen';
import LanguageSwitcher from '@/languages/LanguageSwitcher';
import { LanguageProvider, useLanguage } from '@/languages';
import { AgeModeProvider, useAgeMode } from '@/theme/ageModeContext';
import { ThemeModeProvider, useThemeMode } from '@/theme/themeModeContext';
import SetupPINScreen from '@/screens/SetupPINScreen';
import QuickLockScreen from '@/screens/QuickLockScreen';
import WalletScreen from '@/screens/WalletScreen';
import SubscriptionManagementScreen from '@/screens/SubscriptionManagementScreen';
import AIIntegrationScreen from './src/screens/insights/AIIntegrationScreen';
import MediaAssetManagerScreen from './src/screens/insights/MediaAssetManagerScreen';
import SurveyManagerScreen from './src/screens/insights/SurveyManagerScreen';
import { isPINEnabled, shouldLockAsync, persistLastActiveAt, getPersistedLastActiveAt } from '@/services/QuickLockService';
import UserProfileScreen from '@/screens/profile/UserProfileScreen';
import JobsBoardScreen from '@/screens/jobs/JobsBoardScreen';
import MyApplicationsScreen from '@/screens/jobs/MyApplicationsScreen';
import ConnectionsScreen from '@/screens/profile/ConnectionsScreen';
import TalentDiscoverScreen from '@/screens/jobs/TalentDiscoverScreen';
import TestimonyHubScreen from '@/screens/testimony/TestimonyHubScreen';
import SeasonsBrowserScreen from '@/screens/testimony/SeasonsBrowserScreen';
import DeclareSeasonSheet from '@/screens/testimony/DeclareSeasonSheet';
import DeclareTestimonySheet from '@/screens/testimony/DeclareTestimonySheet';
import ReachOutSheet from '@/screens/testimony/ReachOutSheet';
import TestimonyReachInboxScreen from '@/screens/testimony/TestimonyReachInboxScreen';
import SyncQueueBanner from '@/components/SyncQueueBanner';
import NetworkStatusPill from '@/components/common/NetworkStatusPill';
import LinkedDevicesScreen from '@/screens/LinkedDevicesScreen';
import NotificationSettingsScreen from '@/screens/NotificationSettingsScreen';

// ── Family ──
import FamilyHubScreen from '@/screens/family/FamilyHubScreen';
import FamilySetupScreen from '@/screens/family/FamilySetupScreen';
import FamilyCalendarScreen from '@/screens/family/FamilyCalendarScreen';
import FamilyAlbumScreen from '@/screens/family/FamilyAlbumScreen';
import FamilyTreeScreen from '@/screens/family/FamilyTreeScreen';
import FamilyMembersScreen from '@/screens/family/MembersScreen';
import FamilyMilestonesScreen from '@/screens/family/MilestonesScreen';
import FamilyTimeCapsuleScreen from '@/screens/family/TimeCapsuleScreen';
import FamilyNoticeBoardScreen from '@/screens/family/FamilyNoticeBoardScreen';
import FamilyPrayerScreen from '@/screens/family/FamilyPrayerScreen';
import GriefSupportScreen from '@/screens/family/GriefSupportScreen';
import ParentalControlsScreen from '@/screens/family/ParentalControlsScreen';
import FamilySOSScreen from '@/screens/family/SOSScreen';

// ── Church ──
import ChurchScreen from '@/screens/church/ChurchScreen';
import GiveNowScreen from '@/screens/church/giving/GiveNowScreen';
import ChurchGivingScreen from '@/screens/church/giving/GivingDashboardScreen';
import TitheStatementScreen from '@/screens/church/giving/TitheStatementScreen';
import PrayerWallScreen from '@/screens/church/prayer/PrayerWallScreen';
import NewPrayerRequestScreen from '@/screens/church/prayer/NewPrayerRequestScreen';
import FastingTrackerScreen from '@/screens/church/prayer/FastingTrackerScreen';
import SmallGroupsScreen from '@/screens/church/groups/SmallGroupsScreen';
import SmallGroupDetailScreen from '@/screens/church/groups/SmallGroupDetailScreen';
import ChurchAttendanceScreen from '@/screens/church/membership/AttendanceScreen';
import MemberDirectoryScreen from '@/screens/church/membership/MemberDirectoryScreen';
import MinistryScreen from '@/screens/church/ministry/MinistryScreen';
import EvangelismScreen from '@/screens/church/outreach/EvangelismScreen';
import DiscipleshipScreen from '@/screens/church/discipleship/DiscipleshipScreen';
import SpiritualGiftsScreen from '@/screens/church/discipleship/SpiritualGiftsScreen';
import SetListScreen from '@/screens/church/worship/SetListScreen';
import SongLibraryScreen from '@/screens/church/worship/SongLibraryScreen';

// ── Government ──
import GovernmentHubScreen from '@/screens/government/GovernmentHubScreen';
import PetitionsScreen from '@/screens/government/PetitionsScreen';
import PetitionDetailScreen from '@/screens/government/PetitionDetailScreen';
import CreatePetitionScreen from '@/screens/government/CreatePetitionScreen';
import CivicPollsScreen from '@/screens/government/CivicPollsScreen';
import LegalAidScreen from '@/screens/government/LegalAidScreen';
import LegalTemplatesScreen from '@/screens/government/LegalTemplatesScreen';
import DiasporaScreen from '@/screens/government/DiasporaScreen';
import NGOToolsScreen from '@/screens/government/NGOToolsScreen';
import ComplianceTrackerScreen from '@/screens/government/ComplianceTrackerScreen';
import BoardGovernanceScreen from '@/screens/government/BoardGovernanceScreen';
import WhistleblowerScreen from '@/screens/government/WhistleblowerScreen';

// ── Business ──
import BusinessHubScreen from '@/screens/business/BusinessHubScreen';
import CrowdfundScreen from '@/screens/business/CrowdfundScreen';
import CrowdfundDetailScreen from '@/screens/business/CrowdfundDetailScreen';
import CreateCampaignScreen from '@/screens/business/CreateCampaignScreen';
import SavingsGroupsScreen from '@/screens/business/SavingsGroupsScreen';
import SavingsGroupDetailScreen from '@/screens/business/SavingsGroupDetailScreen';
import MentorshipScreen from '@/screens/business/MentorshipScreen';
import CoWorkingScreen from '@/screens/business/CoWorkingScreen';
import KingdomCertificationScreen from '@/screens/business/KingdomCertificationScreen';
import ImpactReportScreen from '@/screens/business/ImpactReportScreen';
import BusinessJobDetailScreen from '@/screens/business/JobDetailScreen';

// ── Health sub-screens ──
import TelemedicineScreen from '@/screens/health/telemedicine/TelemedicineScreen';
import DoctorDirectoryScreen from '@/screens/health/telemedicine/DoctorDirectoryScreen';
import ConsultDetailScreen from '@/screens/health/telemedicine/ConsultDetailScreen';
import EmergencyScreen from '@/screens/health/emergency/EmergencyScreen';
import HealthGoalsScreen from '@/screens/health/goals/HealthGoalsScreen';
import PregnancyTrackerScreen from '@/screens/health/maternal/PregnancyTrackerScreen';
import BabyMilestonesScreen from '@/screens/health/maternal/BabyMilestonesScreen';
import MedicationsScreen from '@/screens/health/medications/MedicationsScreen';
import MentalHealthScreen from '@/screens/health/mental/MentalHealthScreen';
import MoodJournalScreen from '@/screens/health/mental/MoodJournalScreen';
import CrisisResourcesScreen from '@/screens/health/mental/CrisisResourcesScreen';
import AddictionRecoveryScreen from '@/screens/health/recovery/AddictionRecoveryScreen';
import SobrietyTrackerScreen from '@/screens/health/recovery/SobrietyTrackerScreen';
import SymptomCheckerScreen from '@/screens/health/symptoms/SymptomCheckerScreen';

// ── Broadcast education & media extended ──
import AssignmentsScreen from '@/screens/broadcast/education/AssignmentsScreen';
import StudentProgressScreen from '@/screens/broadcast/education/StudentProgressScreen';
import BadgesScreen from '@/screens/broadcast/education/BadgesScreen';
import CertificateScreen from '@/screens/broadcast/education/CertificateScreen';
import LiveClassroomScreen from '@/screens/broadcast/education/LiveClassroomScreen';
import ScholarshipsScreen from '@/screens/broadcast/education/ScholarshipsScreen';
import CreatorAnalyticsScreen from '@/screens/broadcast/media_extended/CreatorAnalyticsScreen';
import KingdomNewsScreen from '@/screens/broadcast/media_extended/KingdomNewsScreen';
import KingdomMusicScreen from '@/screens/broadcast/media_extended/KingdomMusicScreen';
import EbooksScreen from '@/screens/broadcast/media_extended/EbooksScreen';
import PodcastsScreen from '@/screens/broadcast/media_extended/PodcastsScreen';
import PPVEventsScreen from '@/screens/broadcast/media_extended/PPVEventsScreen';
import { GoldenSectionProvider, useGoldenSection } from '@/contexts/GoldenSectionContext';
import { GoldHeaderShell } from '@/components/common/GoldHeaderShell';
import { useKISTheme } from '@/theme/useTheme';
import { useRawTopInset } from '@/hooks/useSafeTopInset';


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


// Single persistent gold-gradient header shell, hoisted above the navigator
// as a normal-flow flex sibling (every gold-header screen uses this same
// path — Messages/Broadcast/Bible/Partners/Profile). Whichever main tab is
// focused registers its own content via useGoldenSectionContent; renders
// nothing when no gold screen is focused.
function GoldenSection() {
  const { payload, ownerKey } = useGoldenSection();
  const { palette } = useKISTheme();
  const topInset = useRawTopInset();

  if (!payload) return null;
  return (
    // marginTop pulls the gradient up so it bleeds behind the status bar
    // instead of leaving a gap above it.
    <View style={{ backgroundColor: palette.bg, marginTop: -(topInset * 2.6) }}>
      {/* key={ownerKey} — force a fresh native gradient view per registering
          screen instead of reusing/mutating one persistent view across tab
          switches. react-native-linear-gradient isn't fully Fabric-compatible
          yet (upstream: not fixed until its 3.0.0 line, still pre-release);
          a persistent view reused across screens risks one screen's heavier
          simultaneous-gradient rendering (Partners) wedging the shared native
          view so it stays blank for every screen after, until this remounts
          it. */}
      <GoldHeaderShell key={ownerKey} colors={payload.colors} style={payload.shellStyle}>
        {payload.content}
      </GoldHeaderShell>
      <NetworkStatusPill />
    </View>
  );
}

function AppContent() {
  const { language, languageVersion } = useLanguage();
  const { ageVersion } = useAgeMode();
  const { themeMode } = useThemeMode();
  const sysScheme = useColorScheme();
  const scheme = themeMode === 'system' ? sysScheme : themeMode;
  // Start null so the gold gradient never flashes before navigation is ready.
  // syncActiveRoute fires via onReady/onStateChange and sets the real value.
  const [activeRouteName, setActiveRouteName] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  const navigationRef = useRef<any>(null);
  const insets = useSafeAreaInsets();

  // getCurrentRoute() returns the deepest focused leaf route, not the bottom
  // tab. The Messages tab nests its own Tab.Navigator (Chats/Updates/Calls/
  // Communities), so its leaf is never literally 'Messages' — and any screen
  // could grow nested tabs/stacks later, silently breaking a leaf-name list
  // again. Walk the state tree instead and read MainTabs' own active route —
  // that's stable regardless of how deeply nested the focused leaf is.
  const getActiveBottomTabName = (state: any): string | null => {
    if (!state?.routes?.length) return null;
    const current = state.routes[state.index ?? state.routes.length - 1];
    if (!current) return null;
    if (current.name === 'MainTabs' && current.state) {
      const tabState = current.state;
      const activeTab = tabState.routes?.[tabState.index ?? tabState.routes.length - 1];
      return activeTab?.name ?? null;
    }
    return current.state ? getActiveBottomTabName(current.state) : null;
  };

  const syncActiveRoute = useCallback(() => {
    const rootState = navigationRef.current?.getRootState?.();
    const bottomTabName = getActiveBottomTabName(rootState);
    const routeName = bottomTabName ?? navigationRef.current?.getCurrentRoute?.()?.name;
    if (typeof routeName === 'string' && routeName.length > 0) {
      setActiveRouteName(routeName);
    }
  }, []);

  // Bible, Partners, and Profile render the same "gradient reaches y=0, inner
  // content pads by topInset" header pattern as Messages/Broadcast, so they
  // belong in this list too.
  const usesGoldStatusBar =
    activeRouteName === 'Messages' ||
    activeRouteName === 'Broadcast' ||
    activeRouteName === 'Bible' ||
    activeRouteName === 'Partners' ||
    activeRouteName === 'Profile';
  const statusBarStyle = usesGoldStatusBar || scheme !== 'dark'
    ? 'dark-content'
    : 'light-content';

  const [isAuth, setAuth] = useState(false);

  // onReady only fires once, on the very first NavigationContainer mount —
  // the Login → MainTabs swap is driven by `isAuth` flipping (a conditional
  // render, not a navigate() call), so onStateChange is the only other signal
  // and isn't guaranteed to fire for it. Re-sync explicitly on that flip too.
  useEffect(() => {
    syncActiveRoute();
  }, [isAuth, booting, syncActiveRoute]);

  const [load, setLoad] = useState(false);
  const [pendingVerificationPhone, setPendingVerificationPhone] = useState<string | null>(null);
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

  useEffect(() => {
    startOfflineActionQueue();
    startMediaTransferQueue();
    void loadConsentPreferences();

    // Flush chat/mutation queue on reconnect regardless of which screen is active
    const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void flushPendingMutations();
      }
    });

    return () => {
      netInfoUnsubscribe();
      stopMediaTransferQueue();
      stopOfflineActionQueue();
    };
  }, []);

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
      const netState = await NetInfo.fetch().catch(() => null);
      const online = !!(netState?.isConnected && netState.isInternetReachable !== false);

      console.log('checking login (token, phone):', token, storedPhone);

      setPhone(storedPhone);

      if (!token) {
        setUser(null);
        setAuth(false);
        return;
      }

      if (!online) {
        console.log('[checkAuth] offline with token — keeping cached session.');
        setAuth(true);
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
          // Anti-bypass: tokens exist but phone was never verified (edge case from old data)
          // Suspended via FEATURE_FLAGS.PHONE_VERIFICATION_ENABLED — flip it (and the
          // matching API flag) back to true to re-enforce this.
          const phoneVerified = Boolean(
            (u as any)?.verification?.phone?.verified,
          );
          if (FEATURE_FLAGS.PHONE_VERIFICATION_ENABLED && !phoneVerified) {
            const pendingPhone =
              (u as any)?.phone ||
              (u as any)?.phone_number ||
              '';
            setPendingVerificationPhone(pendingPhone);
            setUser(null);
            setAuth(false);
            return;
          }
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
        // If a token exists, a transient network error must not log the user out.
        setAuth(true);
      }
    } catch (e: any) {
      console.log('[checkAuth] outer error:', e?.message);
      const token = await getAccessToken().catch(() => null);
      setUser(null);
      setAuth(!!token);
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
      // Short visual minimum so the logo is briefly visible; no artificial wait.
      const BOOT_MIN_MS = 600;
      // Hard cap so splash never hangs if the backend is slow.
      const BOOT_MAX_MS = 12_000;

      await Promise.race([
        Promise.allSettled([
          // Only request the OS permission dialog on the very first launch.
          syncLocationCountry(!hadPermission),
          checkAuth(),
        ]),
        new Promise<void>(resolve => setTimeout(resolve, BOOT_MAX_MS)),
      ]);

      const elapsed = Date.now() - bootStart;
      if (elapsed < BOOT_MIN_MS) {
        await new Promise<void>(resolve => setTimeout(resolve, BOOT_MIN_MS - elapsed));
      }

      setBooting(false);
    })();
  }, [load, syncLocationCountry, checkAuth]);

  // Immediately re-check auth (→ navigate to Login) whenever clearAuthSession fires
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(AUTH_SESSION_EXPIRED_EVENT, () => {
      void checkAuth();
    });
    return () => sub.remove();
  }, [checkAuth]);

  useEffect(() => {
    if (!locationReady) return;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startInterval = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => syncLocationCountry(false), 60000);
    };

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        // Re-validate session whenever user returns to app — catches expired tokens
        void checkAuth();
        syncLocationCountry(false);
        startInterval();
        // Drain data-only background notifications stored while killed/backgrounded
        AsyncStorage.getItem('KIS_BACKGROUND_NOTIFS')
          .then(raw => {
            if (!raw) return;
            const queue: any[] = JSON.parse(raw);
            if (!queue.length) return;
            AsyncStorage.removeItem('KIS_BACKGROUND_NOTIFS').catch(() => {});
            const latest = queue[queue.length - 1];
            if (latest?.title || latest?.body) {
              Alert.alert(latest.title || 'New notification', latest.body || '');
            }
          })
          .catch(() => {});
        // Drain past-due event reminders stored by EventModal
        AsyncStorage.getItem('KIS_EVENT_REMINDERS')
          .then(raw => {
            if (!raw) return;
            const now = Date.now();
            const all: Array<{ title: string; startsAt: string; reminderAt: number }> = JSON.parse(raw);
            const fired = all.filter(r => r.reminderAt <= now);
            const pending = all.filter(r => r.reminderAt > now);
            if (fired.length) {
              AsyncStorage.setItem('KIS_EVENT_REMINDERS', JSON.stringify(pending)).catch(() => {});
              fired.forEach(r => {
                Alert.alert('📅 Event reminder', `"${r.title}" is starting soon.`);
              });
            }
          })
          .catch(() => {});
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

  // After boot, route unverified accounts (has tokens but phone_verified=false) to verification.
  // Retries until the navigator is ready (onReady fires async after first render).
  useEffect(() => {
    if (!booting && pendingVerificationPhone) {
      const tryNavigate = () => {
        if (navigationRef.current?.isReady?.()) {
          navigationRef.current.navigate('VerificationChannelSelect' as any, {
            phone: pendingVerificationPhone,
            purpose: 'register',
          });
        } else {
          setTimeout(tryNavigate, 50);
        }
      };
      tryNavigate();
    }
  }, [booting, pendingVerificationPhone]);

  useEffect(() => {
    if (user?.id) {
      initE2EE(String(user.id)).catch((err: any) => {
        console.warn('[E2EE] initE2EE failed:', err?.message);
      });
    }
  }, [user?.id]);

  useEffect(() => {
    initPushHandlers(navigationRef);
  }, []);

  // Quick Lock: seed lastActiveAtRef from persisted storage so cold restarts
  // correctly trigger the lock when the timeout has elapsed.
  useEffect(() => {
    if (!isAuth) return;
    getPersistedLastActiveAt().then((ts) => {
      lastActiveAtRef.current = ts;
    }).catch(() => {});
  }, [isAuth]);

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
        void persistLastActiveAt();
      }
    });
    return () => subscription.remove();
  }, [isAuth]);

  useEffect(() => {
    if (!isAuth) return;
    let active = true;

    const registerPushToken = async () => {
      try {
        // Read all four tokens concurrently instead of sequentially.
        const [token, fallbackToken, apnsToken, deviceId] = await Promise.all([
          AsyncStorage.getItem('push_token'),
          AsyncStorage.getItem('fcm_token'),
          AsyncStorage.getItem('apns_token'),
          AsyncStorage.getItem('device_id'),
        ]);
        const finalToken = token || fallbackToken;

        if (!active) return;

        const nestToken = finalToken || apnsToken;
        const nestPlatform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

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

        // Also register with the NestJS backend which handles call push notifications
        if (nestToken) {
          postRequest(ROUTES.nestNotifications.deviceTokenRegister, {
            token: nestToken,
            platform: nestPlatform,
            deviceId: deviceId || undefined,
          }).catch(() => {/* non-fatal */});
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
      <View key={`location-${languageVersion}-age-${ageVersion}`} style={{ flex: 1 }}>
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
    <AuthContext.Provider value={ctx}>
      <SocketProvider>
        <View style={{ flex: 1 }}>
          <StatusBar
            animated
            translucent
            backgroundColor="transparent"
            barStyle={statusBarStyle}
          />
          <GoldenSection />
          {/* Explicit zIndex so screen content (e.g. Profile's "overview" card,
              which overlaps up into the Golden Section's bottom edge via a
              negative marginTop) reliably paints above the gold header rather
              than being tucked underneath it, regardless of platform stacking
              defaults for plain siblings. */}
          <View style={{ flex: 1, zIndex: 1 }}>
            <SyncQueueBanner />
            <NavigationContainer
            ref={navigationRef}
            onReady={syncActiveRoute}
            onStateChange={syncActiveRoute}
            key={`nav-${languageVersion}`}
            theme={scheme === 'dark'
              ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: 'transparent' } }
              : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: 'transparent' } }
            }
            linking={{
              prefixes: [
                'kis://',
                'kisapp://',
                'https://kingdomimpactventures.org',
                'https://www.kingdomimpactventures.org',
                'https://kis.kingdomimpactventures.org',
              ],

              config: {
                screens: {
                  OrgAppLaunch: 'org-app/:partnerId/:appId',

                  InviteJoin: 'join/:type/:token',
                  PartnerRedeemInvite: 'join/partner/:code',

                  CallJoin: 'call/join/:token',

                  BroadcastDetail: 'broadcasts/:id',
                  BroadcastCommentRoom: 'broadcasts/:id/comments',

                  ChannelHome: 'channels/:channelId',
                  ChannelContentDetail: 'content/:contentId',

                  ShopDetail: 'shops/:slug',
                  ProductDetail: 'products/:slug',
                  ServiceDetail: 'services/:slug',

                  UserProfile: 'profiles/:id',
                  ProfileByHandle: 'u/:handle',

                  MainTabs: {
                    screens: {
                      Messages: 'messages',
                      Profile: 'profile',
                    },
                  } as any,
                },
              },
            }}
          >
            <MiniPlayerProvider>
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
                      name="WatchHistory"
                      component={WatchHistoryScreen}
                    />
                    <RootStack.Screen
                      name="LikedVideosScreen"
                      component={LikedVideosScreen}
                    />
                    <RootStack.Screen
                      name="DownloadsScreen"
                      component={DownloadsScreen}
                    />
                    <RootStack.Screen
                      name="SubscriptionsScreen"
                      component={SubscriptionsScreen}
                    />
                    <RootStack.Screen
                      name="LibraryScreen"
                      component={LibraryScreen}
                      options={{ headerShown: false }}
                    />
                    <RootStack.Screen
                      name="ShortsScreen"
                      component={ShortsScreen}
                      options={{ headerShown: false }}
                    />
                    <RootStack.Screen
                      name="ClipsListScreen"
                      component={ClipsListScreen}
                    />
                    <RootStack.Screen
                      name="TrendingScreen"
                      component={TrendingScreen}
                      options={{ title: 'Trending' }}
                    />
                    <RootStack.Screen
                      name="CategoryBrowsePage"
                      component={CategoryBrowsePage}
                      options={{ title: 'Categories' }}
                    />
                    <RootStack.Screen
                      name="BroadcastSearchScreen"
                      component={BroadcastSearchScreen}
                      options={{ title: 'Search' }}
                    />
                    <RootStack.Screen
                      name="ActivityNotifications"
                      component={ActivityNotificationsScreen}
                    />
                    <RootStack.Screen
                      name="ChannelMembersScreen"
                      component={ChannelMembersScreen}
                    />
                    <RootStack.Screen
                      name="Membership"
                      component={MembershipScreen}
                      options={{ headerShown: false }}
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
                      name="InviteJoin"
                      component={InviteJoinScreen}
                      options={{ headerShown: false }}
                    />
                    <RootStack.Screen
                      name="CallJoin"
                      component={CallJoinScreen}
                      options={{ headerShown: false }}
                    />
                    <RootStack.Screen
                      name="PartnerRedeemInvite"
                      component={PartnerRedeemInviteScreen}
                      options={{ headerShown: false }}
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
                      name="CacheManagement"
                      component={CacheManagementScreen}
                      options={{ headerShown: false }}
                    />
                    <RootStack.Screen
                      name="TermsAndConditions"
                      component={TermsAndConditionsScreen}
                      options={{ headerShown: false }}
                    />
                    <RootStack.Screen
                      name="PrivacyPolicy"
                      component={PrivacyPolicyScreen}
                      options={{ headerShown: false }}
                    />
                    <RootStack.Screen
                      name="DeviceManagement"
                      component={DeviceManagementScreen}
                    />
                    <RootStack.Screen
                      name="QRScanLogin"
                      component={QRScanLoginScreen}
                      options={{ presentation: 'fullScreenModal', headerShown: false }}
                    />
                    <RootStack.Screen
                      name="ParentRecovery"
                      component={ParentRecoveryScreen}
                    />
                    <RootStack.Screen
                      name="AccountDeletion"
                      component={AccountDeletionScreen}
                    />
                    <RootStack.Screen
                      name="BlockedContacts"
                      options={{ headerShown: false }}
                    >
                      {({ navigation }) => (
                        <BlockedContactsScreen onBack={() => navigation.goBack()} />
                      )}
                    </RootStack.Screen>
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
                    <RootStack.Screen
                      name="ViewProfile"
                      component={UserProfileScreen}
                      options={{ headerShown: false }}
                    />
                    <RootStack.Screen
                      name="JobsBoard"
                      component={JobsBoardScreen}
                      options={{ headerShown: false }}
                    />
                    <RootStack.Screen
                      name="MyApplications"
                      component={MyApplicationsScreen}
                      options={{ headerShown: false }}
                    />
                    <RootStack.Screen
                      name="Connections"
                      component={ConnectionsScreen}
                      options={{ headerShown: false }}
                    />
                    <RootStack.Screen
                      name="TalentDiscover"
                      component={TalentDiscoverScreen}
                      options={{ headerShown: false }}
                    />
                    <RootStack.Screen name="TestimonyHub" component={TestimonyHubScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="SeasonsBrowser" component={SeasonsBrowserScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="DeclareSeasonSheet" component={DeclareSeasonSheet} options={{ headerShown: false, presentation: 'modal' }} />
                    <RootStack.Screen name="DeclareTestimonySheet" component={DeclareTestimonySheet} options={{ headerShown: false, presentation: 'modal' }} />
                    <RootStack.Screen name="ReachOutSheet" component={ReachOutSheet} options={{ headerShown: false, presentation: 'modal' }} />
                    <RootStack.Screen name="TestimonyReachInbox" component={TestimonyReachInboxScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="LinkedDevices" component={LinkedDevicesScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ headerShown: false }} />

                    {/* ── Family ── */}
                    <RootStack.Screen name="FamilyHub" component={FamilyHubScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="FamilySetup" component={FamilySetupScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="FamilyCalendar" component={FamilyCalendarScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="FamilyAlbum" component={FamilyAlbumScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="FamilyTree" component={FamilyTreeScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="FamilyMembers" component={FamilyMembersScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="FamilyMilestones" component={FamilyMilestonesScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="FamilyTimeCapsules" component={FamilyTimeCapsuleScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="FamilyNoticeBoard" component={FamilyNoticeBoardScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="FamilyPrayer" component={FamilyPrayerScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="GriefSupport" component={GriefSupportScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="ParentalControls" component={ParentalControlsScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="FamilySOS" component={FamilySOSScreen} options={{ headerShown: false }} />

                    {/* ── Church ── */}
                    <RootStack.Screen name="ChurchHome" component={ChurchScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="GiveNow" component={GiveNowScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="ChurchGiving" component={ChurchGivingScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="TitheStatement" component={TitheStatementScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="PrayerWall" component={PrayerWallScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="NewPrayerRequest" component={NewPrayerRequestScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="FastingTracker" component={FastingTrackerScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="SmallGroups" component={SmallGroupsScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="SmallGroupDetail" component={SmallGroupDetailScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="ChurchAttendance" component={ChurchAttendanceScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="MemberDirectory" component={MemberDirectoryScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="MinistryDepartments" component={MinistryScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="EvangelismTracker" component={EvangelismScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="DiscipleshipJourney" component={DiscipleshipScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="SpiritualGifts" component={SpiritualGiftsScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="SetLists" component={SetListScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="SongLibrary" component={SongLibraryScreen} options={{ headerShown: false }} />

                    {/* ── Government ── */}
                    <RootStack.Screen name="GovernmentHub" component={GovernmentHubScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="Petitions" component={PetitionsScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="PetitionDetail" component={PetitionDetailScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="CreatePetition" component={CreatePetitionScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="CivicPolls" component={CivicPollsScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="LegalAid" component={LegalAidScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="LegalTemplates" component={LegalTemplatesScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="DiasporaCommunities" component={DiasporaScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="NGOTools" component={NGOToolsScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="ComplianceTracker" component={ComplianceTrackerScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="BoardGovernance" component={BoardGovernanceScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="WhistleblowerReport" component={WhistleblowerScreen} options={{ headerShown: false }} />

                    {/* ── Business ── */}
                    <RootStack.Screen name="BusinessHub" component={BusinessHubScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="Crowdfunding" component={CrowdfundScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="CrowdfundDetail" component={CrowdfundDetailScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="CreateCampaign" component={CreateCampaignScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="SavingsGroups" component={SavingsGroupsScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="SavingsGroupDetail" component={SavingsGroupDetailScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="BusinessMentorship" component={MentorshipScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="CoWorkingSpaces" component={CoWorkingScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="KingdomCertification" component={KingdomCertificationScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="BusinessImpactReport" component={ImpactReportScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="JobDetail" component={BusinessJobDetailScreen} options={{ headerShown: false }} />
                    {/* JobApplications → consolidated into MyApplications */}

                    {/* ── Health sub-screens ── */}
                    <RootStack.Screen name="TelemedicineHub" component={TelemedicineScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="DoctorDirectory" component={DoctorDirectoryScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="ConsultDetail" component={ConsultDetailScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="EmergencyHub" component={EmergencyScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="HealthGoals" component={HealthGoalsScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="PregnancyTrackerScreen" component={PregnancyTrackerScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="BabyMilestones" component={BabyMilestonesScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="Medications" component={MedicationsScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="MentalHealthHub" component={MentalHealthScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="MoodJournal" component={MoodJournalScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="CrisisResources" component={CrisisResourcesScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="AddictionRecovery" component={AddictionRecoveryScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="SobrietyTracker" component={SobrietyTrackerScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="SymptomChecker" component={SymptomCheckerScreen} options={{ headerShown: false }} />

                    {/* ── Broadcast education & media extended ── */}
                    <RootStack.Screen name="AssignmentsScreen" component={AssignmentsScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="StudentProgress" component={StudentProgressScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="DigitalBadges" component={BadgesScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="EducationCertificate" component={CertificateScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="LiveClassroom" component={LiveClassroomScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="Scholarships" component={ScholarshipsScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="CreatorAnalytics" component={CreatorAnalyticsScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="KingdomNews" component={KingdomNewsScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="KingdomMusic" component={KingdomMusicScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="Ebooks" component={EbooksScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="Podcasts" component={PodcastsScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="PPVEvents" component={PPVEventsScreen} options={{ headerShown: false }} />
                  </>
                ) : (
                  <>
                    <RootStack.Screen
                      name="Welcome"
                      component={WelcomeScreen}
                    />
                    <RootStack.Screen
                      name="TermsAndConditions"
                      component={TermsAndConditionsScreen}
                      options={{ headerShown: false }}
                    />
                    <RootStack.Screen
                      name="PrivacyPolicy"
                      component={PrivacyPolicyScreen}
                      options={{ headerShown: false }}
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
                      name="VerificationChannelSelect"
                      component={VerificationChannelSelectScreen}
                      options={{ headerShown: false }}
                    />
                    <RootStack.Screen
                      name="TwoFactor"
                      component={TwoFactorScreen}
                      options={{ headerShown: false }}
                    />
                    <RootStack.Screen
                      name="QRScanLogin"
                      component={QRScanLoginScreen}
                      options={{ presentation: 'fullScreenModal', headerShown: false }}
                    />
                    <RootStack.Screen
                      name="ParentRecovery"
                      component={ParentRecoveryScreen}
                    />
                  </>
                )}
              </RootStack.Navigator>
            </GlobalProfilePreviewProvider>
            <MiniPlayer />
            </MiniPlayerProvider>
          </NavigationContainer>
            </View>
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
          <ThemeModeProvider>
            <AgeModeProvider>
              <GoldenSectionProvider>
                <AppContent />
              </GoldenSectionProvider>
            </AgeModeProvider>
          </ThemeModeProvider>
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
