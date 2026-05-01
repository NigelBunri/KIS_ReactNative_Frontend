// src/navigation/types.ts
import type { PartnerOrganizationApp } from '@/screens/tabs/partners/hooks/usePartnerOrganizationApps';
import type { HealthInstitutionType } from '@/screens/tabs/profile-screen/types';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  DeviceVerification:
    | { phone?: string | null; email?: string | null }
    | undefined;
  MainTabs: undefined;
  BroadcastDetail: {
    id: string;
    item?: any;
    items?: any[];
    index?: number;
  };
  PartnerInsights: undefined;
  AdminTools: undefined;
  AdminDashboard: { target: string; title: string };
  AnalyticsDashboard: undefined;
  EventsDashboard: undefined;
  ContentDashboard: undefined;
  SurveysDashboard: undefined;
  MediaDashboard: undefined;
  BridgeDashboard: undefined;
  TiersDashboard: undefined;
  NotificationsDashboard: undefined;
  OrganizationApp: { app: PartnerOrganizationApp; partnerId?: string };
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
  ProfileLandingEditor: {
    kind: 'market' | 'education' | 'partner';
    profileLabel?: string;
    partnerId?: string;
    shopId?: string;
    shopName?: string;
    returnBroadcastProfileKey?: BroadcastProfileKey;
  };
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
