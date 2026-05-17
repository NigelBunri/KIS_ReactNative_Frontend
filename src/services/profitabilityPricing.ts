export type ProfitabilityPlanAudience =
  | 'consumer'
  | 'creator'
  | 'institution'
  | 'partner'
  | 'seller'
  | 'education'
  | 'health'
  | 'verification'
  | 'promotion'
  | 'enterprise';

export type ProfitabilityPlan = {
  id: string;
  audience: ProfitabilityPlanAudience;
  name: string;
  monthlyUsd?: number;
  annualUsd?: number;
  priceLabel: string;
  description: string;
  limits: string[];
  included: string[];
  upgradePrompt: string;
  enabled: false;
};

export type ProfitabilityFeatureFlagKey =
  | 'profitability.billing_live'
  | 'profitability.entitlements_enforced'
  | 'profitability.trials_enabled'
  | 'profitability.promotions_checkout_enabled'
  | 'profitability.enterprise_leads_enabled';

export type ProfitabilityEntitlementKey =
  | 'consumer.saved_content.expanded'
  | 'consumer.family_controls.advanced'
  | 'creator.channels.limit'
  | 'creator.scheduled_posts'
  | 'creator.analytics.advanced'
  | 'institution.staff_seats'
  | 'partner.workspace_seats'
  | 'seller.featured_listings'
  | 'education.certificates'
  | 'health.provider_dashboard'
  | 'verification.processing'
  | 'promotion.campaigns'
  | 'enterprise.network';

export type ProfitabilityUsageMeterKey =
  | 'saved_content'
  | 'family_members'
  | 'channels'
  | 'scheduled_posts'
  | 'analytics_exports'
  | 'staff_seats'
  | 'workspace_seats'
  | 'featured_listings'
  | 'certificates'
  | 'care_workflows'
  | 'verification_cases'
  | 'campaigns'
  | 'branches';

export type ProfitabilityFeatureFlag = {
  key: ProfitabilityFeatureFlagKey;
  envSetting: string;
  enabled: false;
  description: string;
};

export type ProfitabilityEntitlement = {
  key: ProfitabilityEntitlementKey;
  planIds: string[];
  meter: ProfitabilityUsageMeterKey;
  enabled: false;
  enforced: false;
  status: 'preview_only';
};

export type ProfitabilityUsageMeter = {
  key: ProfitabilityUsageMeterKey;
  freeLimit: number;
  unit: string;
  enforced: false;
};

export const KIS_PROFITABILITY_PRICING_ENABLED = false;

export const KIS_PROMOTIONAL_CREDIT_SAFETY_COPY =
  'KIS promotional credits are reward/subsidy credits only. They are not cash, not transferable, not withdrawable, and not exchange-rated.';

export const PROFITABILITY_FEATURE_FLAGS: ProfitabilityFeatureFlag[] = [
  {
    key: 'profitability.billing_live',
    envSetting: 'KIS_PROFITABILITY_BILLING_ENABLED',
    enabled: false,
    description: 'Allows live billing surfaces. Must remain false until launch approval.',
  },
  {
    key: 'profitability.entitlements_enforced',
    envSetting: 'KIS_PROFITABILITY_ENTITLEMENTS_ENFORCED',
    enabled: false,
    description: 'Allows server-side plan enforcement. Must remain false during preview phases.',
  },
  {
    key: 'profitability.trials_enabled',
    envSetting: 'KIS_PROFITABILITY_TRIALS_ENABLED',
    enabled: false,
    description: 'Allows real trial lifecycle state. Preview metadata only for now.',
  },
  {
    key: 'profitability.promotions_checkout_enabled',
    envSetting: 'KIS_PROFITABILITY_PROMOTION_CHECKOUT_ENABLED',
    enabled: false,
    description: 'Allows paid promotion checkout after campaign moderation is ready.',
  },
  {
    key: 'profitability.enterprise_leads_enabled',
    envSetting: 'KIS_PROFITABILITY_ENTERPRISE_LEADS_ENABLED',
    enabled: false,
    description: 'Allows enterprise lead capture. Disabled to avoid lead spam and unreviewed contracts.',
  },
];

export const PROFITABILITY_PLANS: ProfitabilityPlan[] = [
  {
    id: 'consumer_plus',
    audience: 'consumer',
    name: 'Consumer Plus',
    monthlyUsd: 4.99,
    annualUsd: 49,
    priceLabel: '$4.99/mo or $49/yr',
    description: 'For deeper spiritual growth, family-safe controls, and richer personal journeys.',
    limits: ['Personal account', 'Family-safe recommendations', 'Advanced Bible journeys'],
    included: ['Expanded saved content', 'Priority reminders', 'Spiritual progress insights'],
    upgradePrompt: 'Unlock deeper daily growth with Consumer Plus.',
    enabled: false,
  },
  {
    id: 'family_plus',
    audience: 'consumer',
    name: 'Family Plus',
    monthlyUsd: 7.99,
    annualUsd: 79,
    priceLabel: '$7.99/mo or $79/yr',
    description: 'For households that want child/youth-safe journeys and family progress.',
    limits: ['Household controls', 'Child/youth defaults', 'Family reports'],
    included: ['Family Bible journeys', 'Safer recommendations', 'Larger accessibility defaults'],
    upgradePrompt: 'Guide the whole family with Family Plus.',
    enabled: false,
  },
  {
    id: 'creator_pro',
    audience: 'creator',
    name: 'Creator Pro',
    monthlyUsd: 9.99,
    annualUsd: 99,
    priceLabel: '$9.99/mo or $99/yr',
    description: 'For creators who need channel studio tools, scheduling, and growth analytics.',
    limits: ['Up to 3 channels', 'Moderate media storage', 'Basic studio analytics'],
    included: ['Scheduled content', 'Subscriber tools', 'Custom channel profile'],
    upgradePrompt: 'Grow your channel with Creator Pro.',
    enabled: false,
  },
  {
    id: 'creator_growth',
    audience: 'creator',
    name: 'Creator Growth',
    monthlyUsd: 29.99,
    annualUsd: 299,
    priceLabel: '$29.99/mo or $299/yr',
    description: 'For serious creators, ministries, and media teams building a content ecosystem.',
    limits: ['Up to 10 channels', 'Higher media storage', 'Advanced studio tools'],
    included: ['Advanced analytics', 'Embed analytics', 'Promotion discounts', 'Paid content readiness'],
    upgradePrompt: 'Scale your audience with Creator Growth.',
    enabled: false,
  },
  {
    id: 'institution_starter',
    audience: 'institution',
    name: 'Institution Starter',
    monthlyUsd: 19.99,
    annualUsd: 199,
    priceLabel: '$19.99/mo or $199/yr',
    description: 'For small organizations that need a verified-ready profile and basic operations.',
    limits: ['3 staff seats', 'Basic dashboard', 'Limited landing-page tools'],
    included: ['Verified-ready profile', 'Member/customer messages', 'Basic analytics'],
    upgradePrompt: 'Give your institution a trusted operating space.',
    enabled: false,
  },
  {
    id: 'institution_growth',
    audience: 'institution',
    name: 'Institution Growth',
    monthlyUsd: 59.99,
    annualUsd: 599,
    priceLabel: '$59.99/mo or $599/yr',
    description: 'For growing organizations that need analytics, broadcast reach, and team workflows.',
    limits: ['10 staff seats', 'Advanced landing page', 'Promotion eligibility'],
    included: ['Analytics', 'Broadcast to followers', 'Workflow tools', 'Trust summaries'],
    upgradePrompt: 'Grow your institution with stronger reach and operations.',
    enabled: false,
  },
  {
    id: 'partner_workspace_pro',
    audience: 'partner',
    name: 'Partner Workspace Pro',
    monthlyUsd: 29.99,
    annualUsd: 299,
    priceLabel: '$29.99/mo or $299/yr',
    description: 'For partner communities that need roles, channels, events, and moderation.',
    limits: ['Up to 10 subrooms/channels', '5 admins', 'Basic audit visibility'],
    included: ['Roles', 'Announcements', 'Events', 'Moderation tools', 'Unread analytics'],
    upgradePrompt: 'Build a stronger partner workspace.',
    enabled: false,
  },
  {
    id: 'seller_pro',
    audience: 'seller',
    name: 'Seller Pro',
    monthlyUsd: 14.99,
    annualUsd: 149,
    priceLabel: '$14.99/mo or $149/yr',
    description: 'For shops that need more listings, services, analytics, and trust signals.',
    limits: ['Expanded listings', 'Service catalog tools', 'Featured eligibility'],
    included: ['Shop analytics', 'Trust badges', 'Customer messaging tools'],
    upgradePrompt: 'Sell with more visibility and trust.',
    enabled: false,
  },
  {
    id: 'instructor_pro',
    audience: 'education',
    name: 'Instructor Pro',
    monthlyUsd: 14.99,
    annualUsd: 149,
    priceLabel: '$14.99/mo or $149/yr',
    description: 'For instructors who need course publishing, cohorts, learner analytics, and certificate readiness.',
    limits: ['Expanded course tools', 'Instructor analytics', 'Certificate readiness'],
    included: ['Course scheduling', 'Learner progress insights', 'Promotion readiness'],
    upgradePrompt: 'Teach and grow with Instructor Pro.',
    enabled: false,
  },
  {
    id: 'education_institution_pro',
    audience: 'education',
    name: 'Education Institution Pro',
    monthlyUsd: 49.99,
    annualUsd: 499,
    priceLabel: '$49.99/mo or $499/yr',
    description: 'For schools and instructors that need paid courses, certificates, and learner analytics.',
    limits: ['Multiple instructors', 'Course bundles', 'Certificate governance'],
    included: ['Student progress', 'Institution dashboard', 'Trust badges', 'Cohort readiness'],
    upgradePrompt: 'Teach, certify, and grow with Education Pro.',
    enabled: false,
  },
  {
    id: 'health_provider_pro',
    audience: 'health',
    name: 'Health Provider Pro',
    monthlyUsd: 39.99,
    annualUsd: 399,
    priceLabel: '$39.99/mo or $399/yr',
    description: 'For verified providers that need bookings, reminders, service catalogs, and dashboards.',
    limits: ['Service catalog', 'Appointment reminders', 'Provider dashboard'],
    included: ['Verified provider profile', 'Patient messaging hooks', 'Payment state visibility'],
    upgradePrompt: 'Operate a trusted care profile with Health Provider Pro.',
    enabled: false,
  },
  {
    id: 'health_institution_growth',
    audience: 'health',
    name: 'Health Institution Growth',
    monthlyUsd: 79.99,
    annualUsd: 799,
    priceLabel: '$79.99/mo or $799/yr',
    description: 'For care teams that need dashboards, service growth, reminders, care-plan operations, and payment-state visibility.',
    limits: ['Multi-staff operations', 'Care workflow analytics', 'Promotion readiness'],
    included: ['Provider dashboards', 'Appointment/service reporting', 'Care-plan readiness', 'Trust badges'],
    upgradePrompt: 'Grow a trusted health institution with operational clarity.',
    enabled: false,
  },
  {
    id: 'verification_processing',
    audience: 'verification',
    name: 'Verification Processing',
    priceLabel: 'From $9.99 per institution review',
    description: 'For institution trust review, badge issuance, renewal, and staff/provider review costs.',
    limits: ['Subject-specific evidence', 'Private media references only', 'Staff review'],
    included: ['Trust badge readiness', 'Renewal reminders', 'Audit history'],
    upgradePrompt: 'Start verification to build public trust.',
    enabled: false,
  },
  {
    id: 'promotion_packages',
    audience: 'promotion',
    name: 'Promotion Packages',
    priceLabel: 'From $5 per campaign',
    description: 'For Christian-safe featured placement across channels, courses, shops, providers, and partners.',
    limits: ['Sponsored labels', 'Staff review for sensitive categories', 'Child/youth-safe filtering'],
    included: ['Featured placement', 'Campaign summary', 'Promotion readiness checks'],
    upgradePrompt: 'Promote trusted content without compromising KIS values.',
    enabled: false,
  },
  {
    id: 'enterprise',
    audience: 'enterprise',
    name: 'Enterprise',
    priceLabel: 'Custom annual contract',
    description: 'For networks, ministries, schools, clinics, NGOs, and KCAN regional structures.',
    limits: ['Custom onboarding', 'Multi-branch', 'Private network options'],
    included: ['Dedicated support', 'Audit exports', 'Custom branding', 'Advanced analytics'],
    upgradePrompt: 'Talk to KIS about a kingdom-scale operating system.',
    enabled: false,
  },
];

export const getProfitabilityPlansForAudience = (audience: ProfitabilityPlanAudience) =>
  PROFITABILITY_PLANS.filter((plan) => plan.audience === audience);

export const getProfitabilityPlanById = (id: string) =>
  PROFITABILITY_PLANS.find((plan) => plan.id === id) || null;

export const getLockedPremiumStateCopy = (planId: string, featureName: string) => {
  const plan = getProfitabilityPlanById(planId);
  return {
    title: featureName,
    badge: plan?.name || 'Premium',
    message: plan?.upgradePrompt || 'This premium feature is not enabled yet.',
    safetyCopy: KIS_PROMOTIONAL_CREDIT_SAFETY_COPY,
    enabled: false,
  };
};

export const PROFITABILITY_USAGE_METERS: ProfitabilityUsageMeter[] = [
  { key: 'saved_content', freeLimit: 100, unit: 'items', enforced: false },
  { key: 'family_members', freeLimit: 1, unit: 'household profiles', enforced: false },
  { key: 'channels', freeLimit: 1, unit: 'channels', enforced: false },
  { key: 'scheduled_posts', freeLimit: 0, unit: 'scheduled posts', enforced: false },
  { key: 'analytics_exports', freeLimit: 0, unit: 'exports', enforced: false },
  { key: 'staff_seats', freeLimit: 1, unit: 'staff seats', enforced: false },
  { key: 'workspace_seats', freeLimit: 5, unit: 'workspace seats', enforced: false },
  { key: 'featured_listings', freeLimit: 0, unit: 'featured listings', enforced: false },
  { key: 'certificates', freeLimit: 0, unit: 'certificates', enforced: false },
  { key: 'care_workflows', freeLimit: 1, unit: 'care workflows', enforced: false },
  { key: 'verification_cases', freeLimit: 0, unit: 'review cases', enforced: false },
  { key: 'campaigns', freeLimit: 0, unit: 'campaigns', enforced: false },
  { key: 'branches', freeLimit: 1, unit: 'branches', enforced: false },
];

export const PROFITABILITY_ENTITLEMENTS: ProfitabilityEntitlement[] = [
  { key: 'consumer.saved_content.expanded', planIds: ['consumer_plus', 'family_plus'], meter: 'saved_content', enabled: false, enforced: false, status: 'preview_only' },
  { key: 'consumer.family_controls.advanced', planIds: ['family_plus'], meter: 'family_members', enabled: false, enforced: false, status: 'preview_only' },
  { key: 'creator.channels.limit', planIds: ['creator_pro', 'creator_growth'], meter: 'channels', enabled: false, enforced: false, status: 'preview_only' },
  { key: 'creator.scheduled_posts', planIds: ['creator_pro', 'creator_growth'], meter: 'scheduled_posts', enabled: false, enforced: false, status: 'preview_only' },
  { key: 'creator.analytics.advanced', planIds: ['creator_growth'], meter: 'analytics_exports', enabled: false, enforced: false, status: 'preview_only' },
  { key: 'institution.staff_seats', planIds: ['institution_starter', 'institution_growth'], meter: 'staff_seats', enabled: false, enforced: false, status: 'preview_only' },
  { key: 'partner.workspace_seats', planIds: ['partner_workspace_pro', 'enterprise'], meter: 'workspace_seats', enabled: false, enforced: false, status: 'preview_only' },
  { key: 'seller.featured_listings', planIds: ['seller_pro', 'promotion_packages'], meter: 'featured_listings', enabled: false, enforced: false, status: 'preview_only' },
  { key: 'education.certificates', planIds: ['education_institution_pro'], meter: 'certificates', enabled: false, enforced: false, status: 'preview_only' },
  { key: 'health.provider_dashboard', planIds: ['health_provider_pro', 'health_institution_growth'], meter: 'care_workflows', enabled: false, enforced: false, status: 'preview_only' },
  { key: 'verification.processing', planIds: ['verification_processing'], meter: 'verification_cases', enabled: false, enforced: false, status: 'preview_only' },
  { key: 'promotion.campaigns', planIds: ['promotion_packages'], meter: 'campaigns', enabled: false, enforced: false, status: 'preview_only' },
  { key: 'enterprise.network', planIds: ['enterprise'], meter: 'branches', enabled: false, enforced: false, status: 'preview_only' },
];

export const getProfitabilityFeatureFlag = (key: ProfitabilityFeatureFlagKey) =>
  PROFITABILITY_FEATURE_FLAGS.find(flag => flag.key === key) || null;

export const getProfitabilityEntitlement = (key: ProfitabilityEntitlementKey) =>
  PROFITABILITY_ENTITLEMENTS.find(entitlement => entitlement.key === key) || null;

export const getProfitabilityUsageMeter = (key: ProfitabilityUsageMeterKey) =>
  PROFITABILITY_USAGE_METERS.find(meter => meter.key === key) || null;

export const canUseProfitabilityFeature = (key: ProfitabilityEntitlementKey) => {
  const entitlement = getProfitabilityEntitlement(key);
  return {
    allowed: true,
    enforced: false,
    reason: entitlement ? 'preview_only_no_hard_block' : 'unknown_feature_preview_passthrough',
    entitlement,
    meter: entitlement ? getProfitabilityUsageMeter(entitlement.meter) : null,
  };
};
