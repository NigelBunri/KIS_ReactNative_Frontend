// src/navigation/types.ts
import type { PartnerOrganizationApp } from '@/screens/tabs/partners/hooks/usePartnerOrganizationApps';
import type { HealthInstitutionType } from '@/screens/tabs/profile-screen/types';

export type RootStackParamList = {
  Welcome: undefined;
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
  Login: undefined;
  Register: undefined;
  TwoFactor: {
    phone?: string;
    email?: string;
    tokens?: { access?: string; refresh?: string };
  };
  DeviceVerification:
    | {
        phone?: string | null;
        email?: string | null;
        channel?: 'sms' | 'email' | 'whatsapp';
        whatsapp_code?: string | null;
        whatsapp_link?: string | null;
      }
    | undefined;
  VerificationChannelSelect:
    | { phone?: string | null; purpose?: 'register' | 'login' }
    | undefined;
  MainTabs: undefined;
  BroadcastDetail: {
    id: string;
    item?: any;
    items?: any[];
    index?: number;
  };
  ChannelHome: {
    channelId?: string;
    handle?: string;
    channel?: any;
  };
  ChannelContentDetail: {
    contentId: string;
    item?: any;
    channel?: any;
  };
  LiveWatch: {
    streamId: string;
    stream?: any;
  };
  PartnerInsights: undefined;
  AdminTools: undefined;
  AdminDashboard: { target: string; title: string };
  ModerationConsole: undefined;
  GlobalSearch: undefined;
  Events: undefined;
  AnalyticsDashboard: undefined;
  EventsDashboard: undefined;
  ContentDashboard: undefined;
  SurveysDashboard: undefined;
  MediaDashboard: undefined;
  BridgeDashboard: undefined;
  BridgeManagement: undefined;
  TiersDashboard: undefined;
  AIIntegration: undefined;
  MediaAssetManager: undefined;
  SurveyManager: undefined;
  NotificationsDashboard: undefined;
  OrganizationApp: { app: PartnerOrganizationApp; partnerId?: string; partnerName?: string; canManage?: boolean };
  OrgAppLaunch: { partnerId: string; appId: string };
  InviteJoin: { type: 'group' | 'community'; token: string };
  CallJoin: { token: string };
  PartnerRedeemInvite: { code?: string };
  OrganizationAppForm: { partnerId: string; app?: PartnerOrganizationApp };
  HealthInstitutionDetail: {
    institutionId: string;
    institutionType: HealthInstitutionType;
    institutionName?: string;
  };
  HealthInstitutionManagement: {
    institutionId?: string;
    institutionName?: string;
    institutionType?: HealthInstitutionType;
    employees?: number;
  };
  InstitutionProfileEditor: {
    institutionId: string;
    institutionType: HealthInstitutionType;
  };
  AvailabilityManagement: {
    institutionId: string;
    institutionType: HealthInstitutionType;
  };
  HealthInstitutionMembers: {
    institutionId: string;
    institutionName?: string;
  };
  HealthInstitutionServicesCatalog: {
    institutionId: string;
    institutionType?: HealthInstitutionType;
    institutionName?: string;
  };
  HealthInstitutionCards: {
    institutionId: string;
    institutionType?: HealthInstitutionType;
    institutionName?: string;
  };
  HealthServiceSession: {
    institutionId: string;
    institutionType?: HealthInstitutionType;
    institutionName?: string;
    cardId: string;
    sessionId?: string;
    workflowSessionId?: string;
    appointmentBookingId?: string;
    sessionSource?: 'broadcasts' | 'health_ops';
    serviceId?: string;
    serviceName: string;
    serviceDescription?: string;
    configuredEngineFlowKeys?: string[];
    dateKey?: string;
    timeValue?: string;
    statusLabel?: string;
    basePriceCents?: number;
    memberPriceCents?: number;
    ownerPreview?: boolean;
  };
  ClinicalCommandCenter: {
    institutionId: string;
    institutionName?: string;
  };
  InstitutionLandingPreview: {
    institutionId?: string;
    institutionType?: HealthInstitutionType;
    institutionName?: string;
    draft: any;
    previewHeroImageUri?: string;
    previewGalleryImageUris?: string[];
  };
  ShopDashboard: {
    shop: Record<string, any>;
  };
  ServiceBooking: {
    serviceId: string;
    serviceName?: string;
  };
  ServiceBookingDetails: {
    bookingId: string;
  };
  ProductDetail: {
    productId: string;
    variantId?: string;
  };
  ShopProducts: {
    shopId: string;
    shopName?: string;
  };
  ShopServices: {
    shopId: string;
    shopName?: string;
  };
  CartsList: undefined;
  CartDetail: {
    shopId: string;
    shopName?: string;
  };
  MarketplaceReceivedOrders: undefined;
  MarketplaceOrders: undefined;
  MarketplaceProviderOrders: undefined;
  MarketplaceOrderDetail: { orderId: string; mode: 'buyer' | 'provider' };
  ProfileRecentActivity: undefined;
  ProfileImpactSnapshot: undefined;
  ProfileNotifications: undefined;
  ProfileNotificationDetail: {
    notificationId: string;
    notification?: any;
  };
  KISPrinciples: undefined;
  ProfileLandingEditor: {
    kind: 'market' | 'education' | 'partner';
    profileLabel?: string;
    partnerId?: string;
    shopId?: string;
    shopName?: string;
    returnBroadcastProfileKey?: BroadcastProfileKey;
  };
  AccountDeletion: undefined;
  BlockedContacts: undefined;
  PasswordChange: undefined;
  ComplianceSettings: undefined;
  CacheManagement: undefined;
  AdminUserManagement: undefined;
  DeviceManagement: undefined;
  LinkedDevices: undefined;
  QRScanLogin: undefined;
  ParentRecovery: undefined;
  InvoiceList: undefined;
  Loyalty: undefined;
  PromoCode: undefined;
  SetupPIN: undefined;
  QuickLock: undefined;
  Wallet: undefined;
  SubscriptionManagement: undefined;
  PlaylistList: undefined;
  PlaylistDetail: {
    playlistId: string;
    startIndex?: number;
    autoPlay?: boolean;
  };
  WatchHistory: undefined;
  LikedVideosScreen: undefined;
  DownloadsScreen: undefined;
  ShortsScreen: undefined;
  SubscriptionsScreen: undefined;
  LibraryScreen: undefined;
  ClipsListScreen: { contentId: string };
  TrendingScreen: undefined;
  CategoryBrowsePage: { categorySlug?: string; categoryName?: string };
  BroadcastSearchScreen: { query?: string } | undefined;
  ActivityNotifications: { channelId: string; channelName?: string };
  ChannelMembersScreen: { channelId: string; channelName?: string };
  Membership: { channelId: string; channelName?: string };
  ViewProfile: { userId: string; displayName?: string };
  JobsBoard: undefined;
  MyApplications: undefined;
  Connections: { userId?: string; tab?: 'mine' | 'requests' | 'discover' };
  TalentDiscover: { partnerId?: string };
  TestimonyHub: undefined;
  SeasonsBrowser: { category?: string };
  DeclareSeasonSheet: { editId?: string };
  DeclareTestimonySheet: { editId?: string };
  ReachOutSheet: { seasonId: string; seasonTitle: string; seasonCategory: string };
  TestimonyReachInbox: undefined;
  NotificationSettings: undefined;
  // Church & Faith
  ChurchHome: undefined;
  ChurchGiving: undefined;
  GiveNow: undefined;
  ChurchPledge: undefined;
  TitheStatement: undefined;
  MemberDirectory: undefined;
  MemberProfile: { memberId: string };
  ChurchAttendance: undefined;
  SmallGroups: undefined;
  SmallGroupDetail: { groupId: string };
  DiscipleshipJourney: undefined;
  SpiritualGifts: undefined;
  PrayerWall: undefined;
  NewPrayerRequest: undefined;
  FastingTracker: undefined;
  SetLists: undefined;
  SongLibrary: undefined;
  MinistryDepartments: undefined;
  EvangelismTracker: undefined;
  // Family
  FamilyHub: undefined;
  FamilySetup: undefined;
  FamilyMembers: undefined;
  ParentalControls: { memberId: string };
  FamilyCalendar: undefined;
  FamilyNoticeBoard: undefined;
  FamilyAlbum: undefined;
  FamilyMilestones: undefined;
  FamilyTimeCapsules: undefined;
  FamilyPrayer: undefined;
  MemorialPage: { memorialId: string };
  GriefSupport: undefined;
  FamilyTree: { familyId: string };
  FamilySOS: undefined;
  // Government
  GovernmentHub: undefined;
  Petitions: undefined;
  PetitionDetail: { petitionId: string };
  CreatePetition: undefined;
  CivicPolls: undefined;
  LegalAid: undefined;
  LegalTemplates: undefined;
  DiasporaCommunities: undefined;
  NGOTools: undefined;
  ComplianceTracker: undefined;
  WhistleblowerReport: undefined;
  BoardGovernance: undefined;
  // Education
  LiveClassroom: { classroomId: string };
  AssignmentsScreen: { classroomId: string };
  StudentProgress: undefined;
  Scholarships: undefined;
  DigitalBadges: undefined;
  EducationCertificate: undefined;
  // Media
  Podcasts: undefined;
  PodcastEpisodeScreen: { episodeId: string };
  KingdomMusic: undefined;
  MusicPlaylists: undefined;
  Ebooks: undefined;
  PPVEvents: undefined;
  KingdomNews: undefined;
  CreatorAnalytics: undefined;
  // Business
  BusinessHub: undefined;
  JobDetail: { jobId: string };
  Crowdfunding: undefined;
  CrowdfundDetail: { campaignId: string };
  CreateCampaign: undefined;
  SavingsGroups: undefined;
  SavingsGroupDetail: { groupId: string };
  BusinessMentorship: undefined;
  CoWorkingSpaces: undefined;
  KingdomCertification: undefined;
  BusinessImpactReport: undefined;
  // Health Extended
  TelemedicineHub: undefined;
  DoctorDirectory: { mode?: 'instant' | 'book' | 'browse' } | undefined;
  ConsultDetail: { consultId?: string; doctorId?: string; doctorName?: string };
  MentalHealthHub: undefined;
  MoodJournal: undefined;
  CrisisResources: undefined;
  AddictionRecovery: undefined;
  SobrietyTracker: undefined;
  PregnancyTrackerScreen: undefined;
  BabyMilestones: undefined;
  EmergencyHub: undefined;
  Medications: undefined;
  HealthGoals: undefined;
  SymptomChecker: undefined;
};

export type BroadcastTabId = 'feeds' | 'education' | 'market' | 'health';
export type BroadcastProfileKey =
  | 'broadcast_feed'
  | 'health'
  | 'market'
  | 'education';

export type BroadcastCreationType =
  | 'broadcast_feed'
  | 'health_profile'
  | 'market_profile'
  | 'education_profile';

export type BroadcastRouteParams = {
  focusTab?: BroadcastTabId;
  openCreate?: boolean;
  openManageFeeds?: boolean;
  creationType?: BroadcastCreationType;
  actionId?: string;
};

export type MainTabsParamList = {
  Partners: undefined;
  Bible: undefined;
  Messages: undefined;
  Broadcast: BroadcastRouteParams | undefined;
  Profile:
    | { broadcastProfileKey?: BroadcastProfileKey; educationProfileId?: string }
    | undefined;
};
