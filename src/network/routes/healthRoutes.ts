import { API_BASE_URL } from '../config';

const healthRoutes = {
  healthcare: {
    organizations: `${API_BASE_URL}/api/v1/medical/organizations/`,
    organization: (id: string) => `${API_BASE_URL}/api/v1/medical/organizations/${id}/`,
    profiles: `${API_BASE_URL}/api/v1/medical/profiles/`,
    profile: (id: string) => `${API_BASE_URL}/api/v1/medical/profiles/${id}/`,
    staff: `${API_BASE_URL}/api/v1/medical/staff/`,
  },
  telemedicine: {
    sessions: `${API_BASE_URL}/api/v1/telemedicine/sessions/`,
    session: (id: string) => `${API_BASE_URL}/api/v1/telemedicine/sessions/${id}/`,
    sessionStart: (id: string) => `${API_BASE_URL}/api/v1/telemedicine/sessions/${id}/start/`,
    sessionEnd: (id: string) => `${API_BASE_URL}/api/v1/telemedicine/sessions/${id}/end/`,
    devices: `${API_BASE_URL}/api/v1/telemedicine/devices/`,
    dictations: `${API_BASE_URL}/api/v1/telemedicine/dictations/`,
  },
  clinical: {
    tasks: `${API_BASE_URL}/api/v1/core/clinical/tasks/`,
    task: (id: string) => `${API_BASE_URL}/api/v1/core/clinical/tasks/${id}/`,
    escalations: `${API_BASE_URL}/api/v1/core/clinical/escalations/`,
    escalation: (id: string) => `${API_BASE_URL}/api/v1/core/clinical/escalations/${id}/`,
    triage: `${API_BASE_URL}/api/v1/core/clinical/triage/`,
    referrals: `${API_BASE_URL}/api/v1/core/clinical/referrals/`,
    events: `${API_BASE_URL}/api/v1/core/clinical/events/`,
    commandCenter: `${API_BASE_URL}/api/v1/core/clinical/command-center/`,
  },
  patients: {
    master: `${API_BASE_URL}/api/v1/patients/master/`,
    family: `${API_BASE_URL}/api/v1/patients/family/`,
    consents: `${API_BASE_URL}/api/v1/patients/consents/`,
    encounters: `${API_BASE_URL}/api/v1/patients/encounters/`,
    appointments: `${API_BASE_URL}/api/v1/patients/appointments/`,
    summary: (id: string) => `${API_BASE_URL}/api/v1/core/patients/master/${id}/summary/`,
    healthProfile: (id: string) => `${API_BASE_URL}/api/v1/patients/master/${id}/health-profile/`,
    healthSummary: (id: string) => `${API_BASE_URL}/api/v1/patients/master/${id}/health-summary/`,
    emergencyCard: (id: string) => `${API_BASE_URL}/api/v1/patients/master/${id}/emergency-card/`,
    sharingSummary: (id: string) => `${API_BASE_URL}/api/v1/patients/master/${id}/sharing-summary/`,
    accessHistory: (id: string) => `${API_BASE_URL}/api/v1/patients/master/${id}/access-history/`,
    exportBundle: (id: string) => `${API_BASE_URL}/api/v1/patients/master/${id}/export-bundle/`,
    importBundle: (id: string) => `${API_BASE_URL}/api/v1/patients/master/${id}/import-bundle/`,
    myHealthProfile: `${API_BASE_URL}/api/v1/patients/master/my-health-profile/`,
    myHealthSummary: `${API_BASE_URL}/api/v1/patients/master/my-health-summary/`,
    myEmergencyCard: `${API_BASE_URL}/api/v1/patients/master/my-emergency-card/`,
    mySharingSummary: `${API_BASE_URL}/api/v1/patients/master/my-sharing-summary/`,
    myAccessHistory: `${API_BASE_URL}/api/v1/patients/master/my-access-history/`,
    myExportBundle: `${API_BASE_URL}/api/v1/patients/master/my-export-bundle/`,
    myImportBundle: `${API_BASE_URL}/api/v1/patients/master/my-import-bundle/`,
    medications: `${API_BASE_URL}/api/v1/patients/medications/`,
    allergies: `${API_BASE_URL}/api/v1/patients/allergies/`,
    vitals: `${API_BASE_URL}/api/v1/patients/vitals/`,
    wellnessMetrics: `${API_BASE_URL}/api/v1/patients/wellness-metrics/`,
    problems: `${API_BASE_URL}/api/v1/patients/problems/`,
    immunizations: `${API_BASE_URL}/api/v1/patients/immunizations/`,
    procedures: `${API_BASE_URL}/api/v1/patients/procedures/`,
    documents: `${API_BASE_URL}/api/v1/patients/documents/`,
    accessGrants: `${API_BASE_URL}/api/v1/patients/access-grants/`,
    accessGrant: (id: string) => `${API_BASE_URL}/api/v1/patients/access-grants/${id}/`,
    revokeAccessGrant: (id: string) => `${API_BASE_URL}/api/v1/patients/access-grants/${id}/revoke/`,
    exchangeLogs: `${API_BASE_URL}/api/v1/patients/exchange-logs/`,
  },
  wallet: {
    me: `${API_BASE_URL}/api/v1/wallet/me/`,
    ledger: `${API_BASE_URL}/api/v1/wallet/ledger/`,
    ledgerEntry: (id: string) => `${API_BASE_URL}/api/v1/wallet/ledger/${id}/`,
    transactions: `${API_BASE_URL}/api/v1/wallet/transactions/`,
    transaction: (id: string) => `${API_BASE_URL}/api/v1/wallet/transactions/${id}/`,
    billingHistory: `${API_BASE_URL}/api/v1/wallet/billing-history/`,
    subscription: `${API_BASE_URL}/api/v1/wallet/subscription/`,
    subscriptionCancel: `${API_BASE_URL}/api/v1/wallet/subscription-cancel/`,
    subscriptionResume: `${API_BASE_URL}/api/v1/wallet/subscription-resume/`,
    subscriptionDowngrade: `${API_BASE_URL}/api/v1/wallet/subscription-downgrade/`,
    transactionRetry: `${API_BASE_URL}/api/v1/wallet/transaction-retry/`,
    deposit: `${API_BASE_URL}/api/v1/wallet/deposit/`,
    convert: `${API_BASE_URL}/api/v1/wallet/convert/`,
    transfer: `${API_BASE_URL}/api/v1/wallet/transfer/`,
    upgrade: `${API_BASE_URL}/api/v1/wallet/upgrade/`,
    redeem: `${API_BASE_URL}/api/v1/wallet/redeem/`,
  },
  core: {
    organizations: `${API_BASE_URL}/api/v1/core/medical/organizations/`,
    profiles: `${API_BASE_URL}/api/v1/core/medical/profiles/`,
    locations: `${API_BASE_URL}/api/v1/core/medical/locations/`,
    wards: `${API_BASE_URL}/api/v1/core/medical/wards/`,
    services: `${API_BASE_URL}/api/v1/core/medical/services/`,
    equipment: `${API_BASE_URL}/api/v1/core/medical/equipment/`,
    inventory: `${API_BASE_URL}/api/v1/core/medical/inventory/`,
    inventoryItem: (id: string) => `${API_BASE_URL}/api/v1/core/medical/inventory/${id}/`,
    diagnosticOrders: `${API_BASE_URL}/api/v1/core/medical/diagnostic-orders/`,
    diagnosticOrder: (id: string) => `${API_BASE_URL}/api/v1/core/medical/diagnostic-orders/${id}/`,
    imagingStudies: `${API_BASE_URL}/api/v1/core/medical/imaging/`,
    imagingStudy: (id: string) => `${API_BASE_URL}/api/v1/core/medical/imaging/${id}/`,
    adherenceReminders: `${API_BASE_URL}/api/v1/core/medical/adherence-reminders/`,
    adherenceReminder: (id: string) => `${API_BASE_URL}/api/v1/core/medical/adherence-reminders/${id}/`,
    adherenceMarkSent: (id: string) =>
      `${API_BASE_URL}/api/v1/core/medical/adherence-reminders/${id}/mark-sent/`,
    adherenceAcknowledge: (id: string) =>
      `${API_BASE_URL}/api/v1/core/medical/adherence-reminders/${id}/acknowledge/`,
    supplyForecasts: `${API_BASE_URL}/api/v1/core/medical/supply-forecasts/`,
    supplyForecast: (id: string) => `${API_BASE_URL}/api/v1/core/medical/supply-forecasts/${id}/`,
    context: `${API_BASE_URL}/api/v1/core/medical/context/`,
    setActiveProfile: (id: string) => `${API_BASE_URL}/api/v1/core/medical/profiles/${id}/set-active/`,
    staff: `${API_BASE_URL}/api/v1/core/medical/staff/`,
    staffDetail: (id: string) => `${API_BASE_URL}/api/v1/core/medical/staff/${id}/`,
    staffAssignRole: (id: string) => `${API_BASE_URL}/api/v1/core/medical/staff/${id}/assign-role/`,
    staffAssignShift: (id: string) => `${API_BASE_URL}/api/v1/core/medical/staff/${id}/assign-shift/`,
    staffAudits: `${API_BASE_URL}/api/v1/core/medical/staff-audits/`,
  },
  analytics: {
    clinicalReports: `${API_BASE_URL}/api/v1/clinical-reports/`,
    clinicalReport: (id: string) => `${API_BASE_URL}/api/v1/clinical-reports/${id}/`,
    computeClinicalReports: `${API_BASE_URL}/api/v1/clinical-reports/refresh/`,
    riskStratifications: `${API_BASE_URL}/api/v1/risk-stratification/`,
    riskStratification: (id: string) => `${API_BASE_URL}/api/v1/risk-stratification/${id}/`,
    computeRisk: `${API_BASE_URL}/api/v1/risk-stratification/compute/`,
    outcomeBenchmarks: `${API_BASE_URL}/api/v1/outcome-benchmarks/`,
    outcomeBenchmark: (id: string) => `${API_BASE_URL}/api/v1/outcome-benchmarks/${id}/`,
    patientSatisfaction: `${API_BASE_URL}/api/v1/patient-satisfaction/`,
    patientSatisfactionItem: (id: string) => `${API_BASE_URL}/api/v1/patient-satisfaction/${id}/`,
    outreachCampaigns: `${API_BASE_URL}/api/v1/outreach-campaigns/`,
    outreachCampaign: (id: string) => `${API_BASE_URL}/api/v1/outreach-campaigns/${id}/`,
    outreachSetStatus: (id: string) => `${API_BASE_URL}/api/v1/outreach-campaigns/${id}/set-status/`,
    wellnessChallenges: `${API_BASE_URL}/api/v1/wellness-challenges/`,
    wellnessChallenge: (id: string) => `${API_BASE_URL}/api/v1/wellness-challenges/${id}/`,
    habitEntries: `${API_BASE_URL}/api/v1/habit-entries/`,
    habitEntry: (id: string) => `${API_BASE_URL}/api/v1/habit-entries/${id}/`,
  },
  compliance: {
    auditLogs: `${API_BASE_URL}/api/v1/compliance/audit-logs/`,
    credentials: `${API_BASE_URL}/api/v1/compliance/credentials/`,
    credential: (id: string) => `${API_BASE_URL}/api/v1/compliance/credentials/${id}/`,
    regulatoryReports: `${API_BASE_URL}/api/v1/compliance/regulatory-reports/`,
    regulatoryReport: (id: string) => `${API_BASE_URL}/api/v1/compliance/regulatory-reports/${id}/`,
    submitReport: (id: string) => `${API_BASE_URL}/api/v1/compliance/regulatory-reports/${id}/submit/`,
    documents: `${API_BASE_URL}/api/v1/compliance/documents/`,
    document: (id: string) => `${API_BASE_URL}/api/v1/compliance/documents/${id}/`,
    signDocument: (id: string) => `${API_BASE_URL}/api/v1/compliance/documents/${id}/sign/`,
    dataAccess: `${API_BASE_URL}/api/v1/compliance/data-access/`,
    dataAccessItem: (id: string) => `${API_BASE_URL}/api/v1/compliance/data-access/${id}/`,
    revokeConsent: (id: string) => `${API_BASE_URL}/api/v1/compliance/data-access/${id}/revoke/`,
  },
  healthDashboard: {
    institutions: `${API_BASE_URL}/api/v1/health-dashboard/institutions/`,
    institution: (id: string) => `${API_BASE_URL}/api/v1/health-dashboard/institutions/${id}/`,
    analytics: (id: string) => `${API_BASE_URL}/api/v1/health-dashboard/institutions/${id}/analytics/`,
    schedule: (id: string) => `${API_BASE_URL}/api/v1/health-dashboard/institutions/${id}/schedule/`,
    services: (id: string) => `${API_BASE_URL}/api/v1/health-dashboard/institutions/${id}/services/`,
    financial: (id: string) => `${API_BASE_URL}/api/v1/health-dashboard/institutions/${id}/financial/`,
    compliance: (id: string) => `${API_BASE_URL}/api/v1/health-dashboard/institutions/${id}/compliance/`,
    profileEditor: (id: string) => `${API_BASE_URL}/api/v1/health-dashboard/institutions/${id}/profile-editor/`,
    landingPage: (id: string) => `${API_BASE_URL}/api/v1/health-dashboard/institutions/${id}/landing-page/`,
    availability: (id: string) => `${API_BASE_URL}/api/v1/health-dashboard/institutions/${id}/availability/`,
  },
  healthOps: {
    walletMe: `${API_BASE_URL}/api/v1/wallet/me/`,
    walletTransactions: `${API_BASE_URL}/api/v1/wallet/ledger/`,
    institutionServices: (institutionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/institutions/${encodeURIComponent(institutionId)}/services/`,
    serviceEngineMappings: (serviceId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/services/${encodeURIComponent(serviceId)}/engines/`,
    serviceEngineMappingsReorder: (serviceId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/services/${encodeURIComponent(serviceId)}/engines/reorder/`,
    serviceEngineMapping: (serviceId: string, mappingId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/services/${encodeURIComponent(serviceId)}/engines/${encodeURIComponent(mappingId)}/`,
    serviceVideoItems: (serviceId: string, mappingId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/services/${encodeURIComponent(serviceId)}/engines/${encodeURIComponent(mappingId)}/video-items/`,
    serviceVideoItem: (serviceId: string, mappingId: string, itemId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/services/${encodeURIComponent(serviceId)}/engines/${encodeURIComponent(mappingId)}/video-items/${encodeURIComponent(itemId)}/`,
    managedItems: (institutionId: string, engineKey: string) =>
      `${API_BASE_URL}/api/v1/health-ops/institutions/${encodeURIComponent(institutionId)}/managed-items/${encodeURIComponent(engineKey)}/`,
    managedItem: (institutionId: string, engineKey: string, itemId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/institutions/${encodeURIComponent(institutionId)}/managed-items/${encodeURIComponent(engineKey)}/${encodeURIComponent(itemId)}/`,
    workflowStart: `${API_BASE_URL}/api/v1/health-ops/engine-sessions/start/`,
    workflowStep: (workflowSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/engine-sessions/${encodeURIComponent(workflowSessionId)}/step/`,
    workflowResume: (workflowSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/engine-sessions/${encodeURIComponent(workflowSessionId)}/resume/`,
    engineSessionVideoItems: (engineSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/engine-sessions/${encodeURIComponent(engineSessionId)}/video-items/`,
    engineSessionVideoItemProgress: (engineSessionId: string, itemId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/engine-sessions/${encodeURIComponent(engineSessionId)}/video-items/${encodeURIComponent(itemId)}/progress/`,
    engineSessionVideoItemLike: (engineSessionId: string, itemId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/engine-sessions/${encodeURIComponent(engineSessionId)}/video-items/${encodeURIComponent(itemId)}/like/`,
    engineSessionVideoItemComments: (engineSessionId: string, itemId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/engine-sessions/${encodeURIComponent(engineSessionId)}/video-items/${encodeURIComponent(itemId)}/comments/`,
    appointmentConfig: (serviceId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/services/${encodeURIComponent(serviceId)}/appointment/config/`,
    appointmentSlots: (serviceId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/services/${encodeURIComponent(serviceId)}/appointment/slots/`,
    appointmentBook: (serviceId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/services/${encodeURIComponent(serviceId)}/appointment/book/`,
    appointments: `${API_BASE_URL}/api/v1/health-ops/appointments/`,
    appointment: (bookingId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/appointments/${encodeURIComponent(bookingId)}/`,
    appointmentCancel: (bookingId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/appointments/${encodeURIComponent(bookingId)}/cancel/`,
    appointmentReschedule: (bookingId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/appointments/${encodeURIComponent(bookingId)}/reschedule/`,
    appointmentIcs: (bookingId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/appointments/${encodeURIComponent(bookingId)}/ics/`,
    videoSessionStart: `${API_BASE_URL}/api/v1/health-ops/video/sessions/start/`,
    videoSession: (videoSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/video/sessions/${encodeURIComponent(videoSessionId)}/`,
    videoSessionStep: (videoSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/video/sessions/${encodeURIComponent(videoSessionId)}/step/`,
    videoSessionEnd: (videoSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/video/sessions/${encodeURIComponent(videoSessionId)}/end/`,
    messagingSessionStart: `${API_BASE_URL}/api/v1/health-ops/messaging/sessions/start/`,
    messagingSession: (messagingSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/messaging/sessions/${encodeURIComponent(messagingSessionId)}/`,
    messagingSessionStep: (messagingSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/messaging/sessions/${encodeURIComponent(messagingSessionId)}/step/`,
    messagingSessionMessages: (messagingSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/messaging/sessions/${encodeURIComponent(messagingSessionId)}/messages/`,
    messagingSessionEnd: (messagingSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/messaging/sessions/${encodeURIComponent(messagingSessionId)}/end/`,
    clinicalSessionStart: `${API_BASE_URL}/api/v1/health-ops/clinical/sessions/start/`,
    clinicalSession: (clinicalSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/clinical/sessions/${encodeURIComponent(clinicalSessionId)}/`,
    clinicalSessionStep: (clinicalSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/clinical/sessions/${encodeURIComponent(clinicalSessionId)}/step/`,
    clinicalSessionPayload: (clinicalSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/clinical/sessions/${encodeURIComponent(clinicalSessionId)}/payload/`,
    clinicalSessionEnd: (clinicalSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/clinical/sessions/${encodeURIComponent(clinicalSessionId)}/end/`,
    admissionSessionStart: `${API_BASE_URL}/api/v1/health-ops/admission/sessions/start/`,
    admissionSession: (admissionSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/admission/sessions/${encodeURIComponent(admissionSessionId)}/`,
    admissionSessionStep: (admissionSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/admission/sessions/${encodeURIComponent(admissionSessionId)}/step/`,
    admissionSessionPayload: (admissionSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/admission/sessions/${encodeURIComponent(admissionSessionId)}/payload/`,
    admissionSessionEnd: (admissionSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/admission/sessions/${encodeURIComponent(admissionSessionId)}/end/`,
    emergencySessionStart: `${API_BASE_URL}/api/v1/health-ops/emergency/sessions/start/`,
    emergencySession: (emergencySessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/emergency/sessions/${encodeURIComponent(emergencySessionId)}/`,
    emergencySessionStep: (emergencySessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/emergency/sessions/${encodeURIComponent(emergencySessionId)}/step/`,
    emergencySessionPayload: (emergencySessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/emergency/sessions/${encodeURIComponent(emergencySessionId)}/payload/`,
    emergencySessionTracking: (emergencySessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/emergency/sessions/${encodeURIComponent(emergencySessionId)}/tracking/`,
    emergencySessionEnd: (emergencySessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/emergency/sessions/${encodeURIComponent(emergencySessionId)}/end/`,
    pharmacySessionStart: `${API_BASE_URL}/api/v1/health-ops/pharmacy/sessions/start/`,
    pharmacySession: (pharmacySessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/pharmacy/sessions/${encodeURIComponent(pharmacySessionId)}/`,
    pharmacySessionStep: (pharmacySessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/pharmacy/sessions/${encodeURIComponent(pharmacySessionId)}/step/`,
    pharmacySessionPayload: (pharmacySessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/pharmacy/sessions/${encodeURIComponent(pharmacySessionId)}/payload/`,
    pharmacySessionTracking: (pharmacySessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/pharmacy/sessions/${encodeURIComponent(pharmacySessionId)}/tracking/`,
    pharmacySessionEnd: (pharmacySessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/pharmacy/sessions/${encodeURIComponent(pharmacySessionId)}/end/`,
    billingSessionStart: `${API_BASE_URL}/api/v1/health-ops/billing/sessions/start/`,
    billingSession: (billingSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/billing/sessions/${encodeURIComponent(billingSessionId)}/`,
    billingSessionStep: (billingSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/billing/sessions/${encodeURIComponent(billingSessionId)}/step/`,
    billingSessionPayload: (billingSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/billing/sessions/${encodeURIComponent(billingSessionId)}/payload/`,
    billingSessionEnd: (billingSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/billing/sessions/${encodeURIComponent(billingSessionId)}/end/`,
    homeLogisticsSessionStart: `${API_BASE_URL}/api/v1/health-ops/home-logistics/sessions/start/`,
    homeLogisticsSession: (homeLogisticsSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/home-logistics/sessions/${encodeURIComponent(homeLogisticsSessionId)}/`,
    homeLogisticsSessionStep: (homeLogisticsSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/home-logistics/sessions/${encodeURIComponent(homeLogisticsSessionId)}/step/`,
    homeLogisticsSessionPayload: (homeLogisticsSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/home-logistics/sessions/${encodeURIComponent(homeLogisticsSessionId)}/payload/`,
    homeLogisticsSessionTracking: (homeLogisticsSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/home-logistics/sessions/${encodeURIComponent(homeLogisticsSessionId)}/tracking/`,
    homeLogisticsSessionEnd: (homeLogisticsSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/home-logistics/sessions/${encodeURIComponent(homeLogisticsSessionId)}/end/`,
    wellnessSessionStart: `${API_BASE_URL}/api/v1/health-ops/wellness/sessions/start/`,
    wellnessSession: (wellnessSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/wellness/sessions/${encodeURIComponent(wellnessSessionId)}/`,
    wellnessSessionStep: (wellnessSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/wellness/sessions/${encodeURIComponent(wellnessSessionId)}/step/`,
    wellnessSessionPayload: (wellnessSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/wellness/sessions/${encodeURIComponent(wellnessSessionId)}/payload/`,
    wellnessSessionActivity: (wellnessSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/wellness/sessions/${encodeURIComponent(wellnessSessionId)}/activity/`,
    wellnessSessionEnd: (wellnessSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/wellness/sessions/${encodeURIComponent(wellnessSessionId)}/end/`,
    reminderSessionStart: `${API_BASE_URL}/api/v1/health-ops/reminders/sessions/start/`,
    reminderSession: (notificationSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/reminders/sessions/${encodeURIComponent(notificationSessionId)}/`,
    reminderSessionStep: (notificationSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/reminders/sessions/${encodeURIComponent(notificationSessionId)}/step/`,
    reminderSessionPayload: (notificationSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/reminders/sessions/${encodeURIComponent(notificationSessionId)}/payload/`,
    reminderSessionDelivery: (notificationSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/reminders/sessions/${encodeURIComponent(notificationSessionId)}/delivery/`,
    reminderSessionEnd: (notificationSessionId: string) =>
      `${API_BASE_URL}/api/v1/health-ops/reminders/sessions/${encodeURIComponent(notificationSessionId)}/end/`,
  },
};

export default healthRoutes;
