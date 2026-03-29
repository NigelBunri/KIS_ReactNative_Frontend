export const HEALTH_DASHBOARD_INSTITUTION_TYPES = [
  'clinic',
  'hospital',
  'lab',
  'diagnostics',
  'pharmacy',
  'wellness_center',
] as const;

export type HealthDashboardInstitutionType = (typeof HEALTH_DASHBOARD_INSTITUTION_TYPES)[number];

export type RevenueSnapshot = {
  today: number;
  week: number;
  month: number;
};

export type ConversionSnapshot = {
  views: number;
  bookings: number;
  rate: number;
};

export type PaymentBreakdown = {
  cash: number;
  insurance: number;
  online: number;
};

export type AnalyticsHeader = {
  revenue: RevenueSnapshot;
  bookingsCount: number;
  completedConsultations: number;
  pendingSchedules: number;
  cancellationRate: number;
  conversion: ConversionSnapshot;
  averageRating: number;
  patientReturnRate: number;
  paymentBreakdown: PaymentBreakdown;
};

export type ChartPoint = {
  label: string;
  value: number;
};

export type UsageRow = {
  id: string;
  label: string;
  value: number;
};

export type ServiceAnalyticsBundle = {
  bookingsOverTime: ChartPoint[];
  revenueBreakdown: ChartPoint[];
  serviceUsageDistribution: ChartPoint[];
  topServices: UsageRow[];
  topPatients: UsageRow[];
  paymentMethodBreakdown: UsageRow[];
};

export type LandingHeroSection = {
  imageUrl: string;
  title: string;
  slogan: string;
  ctaLabel: string;
  ctaUrl: string;
};

export type LandingPreview = {
  hero: LandingHeroSection;
  about: string;
  servicesOverview: string[];
  careTeamPreviewEnabled: boolean;
  gallery: string[];
  testimonials: string[];
  certifications: string[];
  operatingHours: string[];
  emergencyNotice?: string;
};

export type ServiceDefinition = {
  id: string;
  name: string;
  description: string;
  basePriceCents?: number;
  active: boolean;
  mediumIds?: string[];
  mediumNames?: string[];
};

export type OperationalModule = {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
};

export type ScheduleSummary = {
  today: number;
  upcoming: number;
  past: number;
};

export type FinancialSummary = {
  totalRevenueCents: number;
  insuranceRevenueCents: number;
  directRevenueCents: number;
  pendingPaymentsCents: number;
  refundsCents: number;
  disputesCount: number;
};

export type ComplianceSummary = {
  auditLogCount: number;
  pendingCredentialReviews: number;
  licenseExpiringSoonCount: number;
  activeConsents: number;
  pendingDocuments: number;
};

export type InstitutionDashboardSchema = {
  institutionId: string;
  type: HealthDashboardInstitutionType;
  analyticsHeader: AnalyticsHeader;
  analytics: ServiceAnalyticsBundle;
  landingPreview: LandingPreview;
  services: ServiceDefinition[];
  operationalModules: OperationalModule[];
  schedule: ScheduleSummary;
  financial: FinancialSummary;
  compliance: ComplianceSummary;
  createdAt: string;
  updatedAt: string;
};

export type InstitutionProfileEditorDraft = {
  isPublished?: boolean;
  hero: LandingHeroSection;
  about: string;
  gallery: string[];
  servicesVisibility: Record<string, boolean>;
  staffDisplayEnabled: boolean;
  certifications: string[];
  faqs: Array<{ question: string; answer: string }>;
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  contact: {
    phone: string;
    email: string;
    address: string;
  };
  socialLinks: string[];
  emergencyBanner: {
    enabled: boolean;
    message: string;
  };
  operatingHours: string[];
  pricingVisibilityEnabled: boolean;
  landingBackgroundImageUrl?: string;
  landingBackgroundColorKey?: string;
  landingLogoUrl?: string;
  sections?: Array<{
    id: string;
    name: string;
    type: string;
    data: Record<string, any>;
  }>;
};
