import { countProducts } from './helpers';
import type {
  BroadcastProfileDefinition,
  HealthInstitutionType,
} from './types';
import type {
  BroadcastProfileKey,
} from '@/navigation/types';

export const HEALTH_INSTITUTION_TYPES: HealthInstitutionType[] = [
  'clinic',
  'hospital',
  'lab',
  'diagnostics',
  'pharmacy',
  'wellness_center',
];

export const CLINICAL_OPERATIONS_FEATURES = [
  'Telemedicine scheduling + reminders',
  'Patient intake automation',
  'Clinical task assignments + accountability',
  'Care team command center',
  'Emergency escalation workflows',
  'Telehealth triage automation + decision support',
  'Referral network heatmaps + routing',
  'Clinical event reporting + logging',
];

export const MEDICAL_RESOURCES_FEATURES = [
  'Inventory + diagnostics tracker',
  'Lab order lifecycle management',
  'Imaging & results distribution',
  'Medication adherence + refill reminders',
  'Supply chain forecasting',
];

export const HEALTH_ANALYTICS_FEATURES = [
  'Clinical analytics + population insights',
  'Patient risk stratification',
  'Outcome tracking & benchmarks',
  'Patient satisfaction scoring + outreach campaigns',
  'Wellness challenge + habit tracking programs',
];

export const COMPLIANCE_AND_GOVERNANCE_FEATURES = [
  'Compliance audit log',
  'Credential verification + licensing dashboards',
  'Regulatory reporting + compliance dashboards',
  'Secure e-signature & document exchange',
  'Data access control & consent management',
];

export const FINANCIAL_WORKFLOW_FEATURES = [
  'Billing & insurance reconciliation workflows',
  'Claims lifecycle tracking',
  'Payment disputes & resolution',
  'Pricing transparency dashboards',
];

const mergeFeatureSets = (...lists: string[][]) =>
  Array.from(new Set(lists.flat()));

const applySharedFeatures = (items: string[]) =>
  mergeFeatureSets(items, COMPLIANCE_AND_GOVERNANCE_FEATURES, FINANCIAL_WORKFLOW_FEATURES);

const CLINIC_CAPABILITIES = CLINICAL_OPERATIONS_FEATURES.slice(0, 3);
const HOSPITAL_CAPABILITIES = [
  'Emergency escalation workflows',
  'Clinical task assignments + accountability',
  'Clinical event reporting + logging',
];
const SPECIALIST_CAPABILITIES = [
  'Referral network heatmaps + routing',
  'Clinical task assignments + accountability',
  'Patient intake automation',
];
const TELEMED_CAPABILITIES = [
  'Telemedicine scheduling + reminders',
  'Telehealth triage automation + decision support',
  'Patient intake automation',
];
const URGENT_CARE_CAPABILITIES = [
  'Emergency escalation workflows',
  'Patient intake automation',
  'Clinical event reporting + logging',
];
const LAB_CAPABILITIES = [
  'Referral network heatmaps + routing',
  'Clinical event reporting + logging',
  'Clinical task assignments + accountability',
];
const DIAGNOSTICS_CAPABILITIES = [
  'Clinical event reporting + logging',
  'Referral network heatmaps + routing',
  'Telehealth triage automation + decision support',
];
const REHAB_CAPABILITIES = [
  'Care team command center',
  'Clinical task assignments + accountability',
  'Patient intake automation',
];
const PHYSIO_CAPABILITIES = [
  'Care team command center',
  'Patient intake automation',
  'Referral network heatmaps + routing',
];
const PHARMACY_CAPABILITIES = [
  'Patient intake automation',
  'Clinical task assignments + accountability',
  'Referral network heatmaps + routing',
];
const MEDICAL_SUPPLY_CAPABILITIES = [
  'Clinical task assignments + accountability',
  'Referral network heatmaps + routing',
  'Patient intake automation',
];
const WELLNESS_CAPABILITIES = [
  'Care team command center',
  'Telehealth triage automation + decision support',
  'Patient intake automation',
];
const MENTAL_HEALTH_CAPABILITIES = [
  'Telemedicine scheduling + reminders',
  'Clinical task assignments + accountability',
  'Care team command center',
];
const NUTRITION_CAPABILITIES = [
  'Patient intake automation',
  'Care team command center',
  'Referral network heatmaps + routing',
];
const FITNESS_CAPABILITIES = ['Patient intake automation', 'Care team command center'];
const HOME_CARE_CAPABILITIES = ['Clinical task assignments + accountability', 'Emergency escalation workflows'];
const COMMUNITY_HEALTH_CAPABILITIES = [
  'Telemedicine scheduling + reminders',
  'Patient intake automation',
  'Care team command center',
];
const ELDERLY_CARE_CAPABILITIES = [
  'Care team command center',
  'Clinical task assignments + accountability',
  'Emergency escalation workflows',
];
const PALLIATIVE_CARE_CAPABILITIES = [
  'Clinical task assignments + accountability',
  'Care team command center',
  'Telehealth triage automation + decision support',
];
const EMERGENCY_RESPONSE_CAPABILITIES = [
  'Emergency escalation workflows',
  'Clinical event reporting + logging',
];
const AMBULANCE_CAPABILITIES = ['Emergency escalation workflows', 'Clinical task assignments + accountability'];
const TRAUMA_CAPABILITIES = [
  'Emergency escalation workflows',
  'Clinical event reporting + logging',
  'Referral network heatmaps + routing',
];
const INSURANCE_CAPABILITIES = ['Referral network heatmaps + routing', 'Clinical event reporting + logging'];
const HEALTH_MGMT_CAPABILITIES = ['Care team command center', 'Clinical task assignments + accountability'];
const GOVERNMENT_AGENCY_CAPABILITIES = [
  'Telehealth triage automation + decision support',
  'Clinical event reporting + logging',
];
const REGULATORY_BODY_CAPABILITIES = ['Clinical event reporting + logging', 'Emergency escalation workflows'];
const ACCREDITATION_BODY_CAPABILITIES = ['Clinical event reporting + logging', 'Care team command center'];

export const HEALTH_INSTITUTION_CAPABILITIES: Record<HealthInstitutionType, string[]> = {
  clinic: applySharedFeatures(CLINIC_CAPABILITIES),
  hospital: applySharedFeatures(HOSPITAL_CAPABILITIES),
  lab: applySharedFeatures(LAB_CAPABILITIES),
  diagnostics: applySharedFeatures(DIAGNOSTICS_CAPABILITIES),
  specialist_center: applySharedFeatures(SPECIALIST_CAPABILITIES),
  telemedicine_provider: applySharedFeatures(TELEMED_CAPABILITIES),
  urgent_care_center: applySharedFeatures(URGENT_CARE_CAPABILITIES),
  laboratory: applySharedFeatures(LAB_CAPABILITIES),
  diagnostics_center: applySharedFeatures(DIAGNOSTICS_CAPABILITIES),
  rehabilitation_center: applySharedFeatures(REHAB_CAPABILITIES),
  physiotherapy_center: applySharedFeatures(PHYSIO_CAPABILITIES),
  pharmacy: applySharedFeatures(PHARMACY_CAPABILITIES),
  medical_supply_store: applySharedFeatures(MEDICAL_SUPPLY_CAPABILITIES),
  wellness_center: applySharedFeatures(WELLNESS_CAPABILITIES),
  mental_health_center: applySharedFeatures(MENTAL_HEALTH_CAPABILITIES),
  nutrition_center: applySharedFeatures(NUTRITION_CAPABILITIES),
  fitness_health_partner: applySharedFeatures(FITNESS_CAPABILITIES),
  home_care_provider: applySharedFeatures(HOME_CARE_CAPABILITIES),
  community_health_center: applySharedFeatures(COMMUNITY_HEALTH_CAPABILITIES),
  elderly_care_facility: applySharedFeatures(ELDERLY_CARE_CAPABILITIES),
  palliative_care_center: applySharedFeatures(PALLIATIVE_CARE_CAPABILITIES),
  emergency_response_unit: applySharedFeatures(EMERGENCY_RESPONSE_CAPABILITIES),
  ambulance_service: applySharedFeatures(AMBULANCE_CAPABILITIES),
  trauma_center: applySharedFeatures(TRAUMA_CAPABILITIES),
  insurance_provider: applySharedFeatures(INSURANCE_CAPABILITIES),
  health_management_organization: applySharedFeatures(HEALTH_MGMT_CAPABILITIES),
  government_health_agency: applySharedFeatures(GOVERNMENT_AGENCY_CAPABILITIES),
  regulatory_body: applySharedFeatures(REGULATORY_BODY_CAPABILITIES),
  accreditation_body: applySharedFeatures(ACCREDITATION_BODY_CAPABILITIES),
};

export const HEALTH_MANAGEMENT_FEATURES = [
  'Telemedicine scheduling + reminders',
  'Patient intake automation',
  'Clinical task assignments + accountability',
  'Care team command center',
  'Emergency escalation workflows',
  'Telehealth triage automation + decision support',
  'Referral network heatmaps + routing',
  'Clinical event reporting + logging',
  'Inventory + diagnostics tracker',
  'Lab order lifecycle management',
  'Imaging & results distribution',
  'Medication adherence + refill reminders',
  'Supply chain forecasting',
  'Clinical analytics + population insights',
  'Patient risk stratification',
  'Outcome tracking & benchmarks',
  'Patient satisfaction scoring & outreach campaigns',
  'Wellness challenge & habit tracking programs',
  'Compliance audit log',
  'Credential verification + licensing dashboards',
  'Regulatory reporting + compliance dashboards',
  'Secure e-signature & document exchange',
  'Data access control & consent management',
  'Billing & insurance reconciliation workflows',
  'Claims lifecycle tracking',
  'Payment disputes & resolution',
  'Pricing transparency dashboards',
];

export const MARKET_MANAGEMENT_FEATURES = [
  'Inventory health dashboard',
  'Shop performance heatmaps',
  'Credit usage & renewal warnings',
  'Drops/community announcements',
  'Order routing preferences',
  'Dynamic pricing alerts',
  'Fulfillment & logistics tracking',
  'Merchant compliance & document vault',
  'Promotions + coupon campaigns',
  'Customer support queue & dispute handling',
];

export const EDUCATION_MANAGEMENT_FEATURES = [
  'Course lifecycle tracker',
  'Module progress analytics',
  'Learner engagement insights',
  'Assignments & resources vault',
  'Scheduling + reminders',
  'Cohort segmentation dashboards',
  'Certification & badge automation',
  'Discussion moderation queue',
  'Assessment builder + rubrics',
  'Live session capture & recording',
  'Learner support ticketing',
];

export const PROFILE_MANAGEMENT_TYPE: Record<
  Exclude<BroadcastProfileKey, 'broadcast_feed'>,
  'health_profile' | 'market_profile' | 'education_profile'
> = {
  health: 'health_profile',
  market: 'market_profile',
  education: 'education_profile',
};

export const BROADCAST_PROFILE_DEFINITIONS: BroadcastProfileDefinition[] = [
  {
    profileKey: 'broadcast_feed',
    label: 'Broadcast feed',
    helper: '10-day ephemeral queue for drops or events',
    icon: 'sparkles',
    tab: 'feeds',
    creationType: 'broadcast_feed',
    summary: (data) => {
      const feeds = Array.isArray(data?.feeds) ? data.feeds.length : 0;
      const expires = data?.expires_at
        ? new Date(data.expires_at).toLocaleDateString()
        : '10 days';
      return `${feeds} feeds · expires ${expires}`;
    },
    emptySummary: 'Create a 10-day broadcast feed to queue your posts.',
  },
  {
    profileKey: 'health',
    label: 'Health profile',
    helper: 'Clinics, hospitals & labs with care teams',
    icon: 'hospital',
    tab: 'health',
    creationType: 'health_profile',
    summary: (data) => {
      const institutions = Array.isArray(data?.institutions) ? data.institutions.length : 0;
      const employees = Number(data?.employees_total ?? 0);
      return `${institutions} institutions · ${employees} staff`;
    },
    emptySummary: 'Launch two institutions (max 5 free employees) before credits.',
  },
  {
    profileKey: 'market',
    label: 'Market profile',
    helper: 'Shops & product drops for your brand',
    icon: 'cart',
    tab: 'market',
    creationType: 'market_profile',
    summary: (data) => {
      const shops = Array.isArray(data?.shops) ? data.shops.length : 0;
      const products = countProducts(data?.shops);
      return `${shops} shops · ${products} products`;
    },
    emptySummary: 'Publish up to 5 shops (20 products each) before credits.',
  },
  {
    profileKey: 'education',
    label: 'Education profile',
    helper: 'Courses, trainings & learning broadcasts',
    icon: 'school',
    tab: 'education',
    creationType: 'education_profile',
    summary: (data) => {
      const courses = Array.isArray(data?.courses) ? data.courses.length : 0;
      return `${courses} courses`;
    },
    emptySummary: 'Create up to 10 courses before extra credits are needed.',
  },
];
