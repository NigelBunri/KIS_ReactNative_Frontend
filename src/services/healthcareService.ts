import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';

export const fetchHealthcareOrganizations = () =>
  getRequest(ROUTES.healthcare.organizations);

export const fetchMedicalProfiles = () =>
  getRequest(ROUTES.healthcare.profiles);

export const fetchHealthcareOrganization = (organizationId: string) =>
  getRequest(ROUTES.healthcare.organization(organizationId), {
    errorMessage: 'Unable to load institution details.',
  });

export const fetchTelemedicineSessions = () =>
  getRequest(ROUTES.telemedicine.sessions);

export const startTelemedicineSession = (sessionId: string) =>
  postRequest(ROUTES.telemedicine.sessionStart(sessionId), {});

export const endTelemedicineSession = (sessionId: string) =>
  postRequest(ROUTES.telemedicine.sessionEnd(sessionId), {});

export const createAppointment = (payload: Record<string, any>) =>
  postRequest(ROUTES.patients.appointments, payload, {
    errorMessage: 'Unable to schedule appointment.',
  });

export const startHealthServiceSession = ({
  serviceId,
  ...payload
}: Record<string, any> & { serviceId: string }) =>
  postRequest(ROUTES.healthOps.appointmentBook(serviceId), payload, {
    errorMessage: 'Unable to start service session.',
  });

export const fetchAppointmentBooking = (bookingId: string) =>
  getRequest(ROUTES.healthOps.appointment(bookingId), {
    errorMessage: 'Unable to load appointment booking.',
  });

export const cancelAppointmentBooking = (bookingId: string, reason?: string) =>
  postRequest(
    ROUTES.healthOps.appointmentCancel(bookingId),
    reason ? { reason } : {},
    {
      errorMessage: 'Unable to cancel appointment.',
    },
  );

export const rescheduleAppointmentBooking = (
  bookingId: string,
  payload: Record<string, any>,
) =>
  postRequest(ROUTES.healthOps.appointmentReschedule(bookingId), payload, {
    errorMessage: 'Unable to reschedule appointment.',
  });

export const createTelemedicineSession = (payload: Record<string, any>) =>
  postRequest(ROUTES.telemedicine.sessions, payload, {
    errorMessage: 'Unable to schedule telemedicine session.',
  });

export const fetchClinicalTasks = (params?: Record<string, any>) =>
  getRequest(ROUTES.clinical.tasks, {
    params,
    errorMessage: 'Unable to load clinical tasks.',
  });

export const createClinicalTask = (payload: Record<string, any>) =>
  postRequest(ROUTES.clinical.tasks, payload, {
    errorMessage: 'Unable to create clinical task.',
  });

export const updateClinicalTask = (
  taskId: string,
  payload: Record<string, any>,
) =>
  patchRequest(ROUTES.clinical.task(taskId), payload, {
    errorMessage: 'Unable to update clinical task.',
  });

export const fetchEmergencyEscalations = (params?: Record<string, any>) =>
  getRequest(ROUTES.clinical.escalations, {
    params,
    errorMessage: 'Unable to load escalations.',
  });

export const createEmergencyEscalation = (payload: Record<string, any>) =>
  postRequest(ROUTES.clinical.escalations, payload, {
    errorMessage: 'Unable to log escalation.',
  });

export const updateEmergencyEscalation = (
  escalationId: string,
  payload: Record<string, any>,
) =>
  patchRequest(ROUTES.clinical.escalation(escalationId), payload, {
    errorMessage: 'Unable to update escalation.',
  });

export const fetchTriageRecords = (params?: Record<string, any>) =>
  getRequest(ROUTES.clinical.triage, {
    params,
    errorMessage: 'Unable to load triage history.',
  });

export const createTriageRecord = (payload: Record<string, any>) =>
  postRequest(ROUTES.clinical.triage, payload, {
    errorMessage: 'Unable to run triage.',
  });

export const fetchReferralRoutes = (params?: Record<string, any>) =>
  getRequest(ROUTES.clinical.referrals, {
    params,
    errorMessage: 'Unable to load referrals.',
  });

export const createReferralRoute = (payload: Record<string, any>) =>
  postRequest(ROUTES.clinical.referrals, payload, {
    errorMessage: 'Unable to create referral.',
  });

export const fetchClinicalEvents = (params?: Record<string, any>) =>
  getRequest(ROUTES.clinical.events, {
    params,
    errorMessage: 'Unable to load event log.',
  });

export const fetchCommandCenterOverview = () =>
  getRequest(ROUTES.clinical.commandCenter, {
    errorMessage: 'Unable to load command center overview.',
  });

export const fetchPatientMasterRecords = (params?: Record<string, any>) =>
  getRequest(ROUTES.patients.master, {
    params,
    errorMessage: 'Unable to load patient master records.',
  });

export const fetchPatientSummary = (id: string) =>
  getRequest(ROUTES.patients.summary(id), {
    errorMessage: 'Unable to load patient summary.',
  });

export const fetchPatientHealthProfile = (id: string) =>
  getRequest(ROUTES.patients.healthProfile(id), {
    errorMessage: 'Unable to load patient health profile.',
  });

export const fetchPatientHealthSummary = (id: string) =>
  getRequest(ROUTES.patients.healthSummary(id), {
    errorMessage: 'Unable to load patient health summary.',
  });

export const fetchPatientEmergencyCard = (id: string) =>
  getRequest(ROUTES.patients.emergencyCard(id), {
    errorMessage: 'Unable to load patient emergency card.',
  });

export const fetchPatientSharingSummary = (id: string) =>
  getRequest(ROUTES.patients.sharingSummary(id), {
    errorMessage: 'Unable to load health sharing summary.',
  });

export const fetchPatientAccessHistory = (id: string) =>
  getRequest(ROUTES.patients.accessHistory(id), {
    errorMessage: 'Unable to load health access history.',
  });

export const fetchMyHealthProfile = () =>
  getRequest(ROUTES.patients.myHealthProfile, {
    errorMessage: 'Unable to load your health profile.',
  });

export const fetchMyHealthSummary = () =>
  getRequest(ROUTES.patients.myHealthSummary, {
    errorMessage: 'Unable to load your health summary.',
  });

export const fetchMyEmergencyCard = () =>
  getRequest(ROUTES.patients.myEmergencyCard, {
    errorMessage: 'Unable to load your emergency card.',
  });

export const fetchMySharingSummary = () =>
  getRequest(ROUTES.patients.mySharingSummary, {
    errorMessage: 'Unable to load your sharing summary.',
  });

export const fetchMyAccessHistory = () =>
  getRequest(ROUTES.patients.myAccessHistory, {
    errorMessage: 'Unable to load your access history.',
  });

export const exportPatientHealthBundle = (id: string) =>
  getRequest(ROUTES.patients.exportBundle(id), {
    errorMessage: 'Unable to export patient health bundle.',
  });

export const importPatientHealthBundle = (
  id: string,
  bundle: Record<string, any>,
  sourceLabel?: string,
) =>
  postRequest(
    ROUTES.patients.importBundle(id),
    { bundle, source_label: sourceLabel },
    {
      errorMessage: 'Unable to import patient health bundle.',
    },
  );

export const exportMyHealthBundle = () =>
  getRequest(ROUTES.patients.myExportBundle, {
    errorMessage: 'Unable to export your health bundle.',
  });

export const importMyHealthBundle = (
  bundle: Record<string, any>,
  sourceLabel?: string,
) =>
  postRequest(
    ROUTES.patients.myImportBundle,
    { bundle, source_label: sourceLabel },
    {
      errorMessage: 'Unable to import your health bundle.',
    },
  );

export const fetchHealthRecordExchangeLogs = (params?: Record<string, any>) =>
  getRequest(ROUTES.patients.exchangeLogs, {
    params,
    errorMessage: 'Unable to load health record exchange logs.',
  });

export const fetchPatientEncounters = (patientId: string) =>
  getRequest(ROUTES.patients.encounters, {
    params: { patient: patientId },
    errorMessage: 'Unable to load encounter timeline.',
  });

export const fetchPatientMedications = (patientId: string) =>
  getRequest(ROUTES.patients.medications, {
    params: { patient: patientId },
    errorMessage: 'Unable to load medication orders.',
  });

export const createMedicationOrder = (payload: Record<string, any>) =>
  postRequest(ROUTES.patients.medications, payload, {
    errorMessage: 'Unable to create medication order.',
  });

export const fetchPatientAllergies = (patientId: string) =>
  getRequest(ROUTES.patients.allergies, {
    params: { patient: patientId },
    errorMessage: 'Unable to load allergy records.',
  });

export const fetchPatientVitals = (patientId: string) =>
  getRequest(ROUTES.patients.vitals, {
    params: { patient: patientId },
    errorMessage: 'Unable to load vitals.',
  });

export const createVitalSign = (payload: Record<string, any>) =>
  postRequest(ROUTES.patients.vitals, payload, {
    errorMessage: 'Unable to log vital sign.',
  });

export const fetchPatientWellnessMetrics = (
  patientId: string,
  params?: Record<string, any>,
) =>
  getRequest(ROUTES.patients.wellnessMetrics, {
    params: { patient: patientId, ...(params || {}) },
    errorMessage: 'Unable to load wellness metrics.',
  });

export const createWellnessMetric = (payload: Record<string, any>) =>
  postRequest(ROUTES.patients.wellnessMetrics, payload, {
    errorMessage: 'Unable to save wellness metric.',
  });

export const fetchPatientProblems = (patientId: string) =>
  getRequest(ROUTES.patients.problems, {
    params: { patient: patientId },
    errorMessage: 'Unable to load problem list.',
  });

export const createProblemRecord = (payload: Record<string, any>) =>
  postRequest(ROUTES.patients.problems, payload, {
    errorMessage: 'Unable to save problem record.',
  });

export const fetchPatientImmunizations = (patientId: string) =>
  getRequest(ROUTES.patients.immunizations, {
    params: { patient: patientId },
    errorMessage: 'Unable to load immunizations.',
  });

export const createImmunizationRecord = (payload: Record<string, any>) =>
  postRequest(ROUTES.patients.immunizations, payload, {
    errorMessage: 'Unable to save immunization.',
  });

export const fetchPatientProcedures = (patientId: string) =>
  getRequest(ROUTES.patients.procedures, {
    params: { patient: patientId },
    errorMessage: 'Unable to load procedures.',
  });

export const createProcedureRecord = (payload: Record<string, any>) =>
  postRequest(ROUTES.patients.procedures, payload, {
    errorMessage: 'Unable to save procedure record.',
  });

export const fetchPatientDocuments = (patientId: string) =>
  getRequest(ROUTES.patients.documents, {
    params: { patient: patientId },
    errorMessage: 'Unable to load health documents.',
  });

export const createHealthDocument = (payload: Record<string, any>) =>
  postRequest(ROUTES.patients.documents, payload, {
    errorMessage: 'Unable to save health document.',
  });

export const fetchPatientAccessGrants = (patientId: string) =>
  getRequest(ROUTES.patients.accessGrants, {
    params: { patient: patientId },
    errorMessage: 'Unable to load health data access grants.',
  });

export const createPatientAccessGrant = (payload: Record<string, any>) =>
  postRequest(ROUTES.patients.accessGrants, payload, {
    errorMessage: 'Unable to create health data access grant.',
  });

export const revokePatientAccessGrant = (grantId: string) =>
  postRequest(
    ROUTES.patients.revokeAccessGrant(grantId),
    {},
    {
      errorMessage: 'Unable to revoke health data access grant.',
    },
  );

export const createFamilyProfile = (payload: Record<string, any>) =>
  postRequest(ROUTES.patients.family, payload, {
    errorMessage: 'Unable to create family profile.',
  });

export const createConsentRecord = (payload: Record<string, any>) =>
  postRequest(ROUTES.patients.consents, payload, {
    errorMessage: 'Unable to record consent.',
  });

export const createPatientMasterRecord = (payload: Record<string, any>) =>
  postRequest(ROUTES.patients.master, payload, {
    errorMessage: 'Unable to create patient record.',
  });

export const fetchInventoryItems = (params?: Record<string, any>) =>
  getRequest(ROUTES.core.inventory, {
    params,
    errorMessage: 'Unable to load inventory items.',
  });

export const createInventoryItem = (payload: Record<string, any>) =>
  postRequest(ROUTES.core.inventory, payload, {
    errorMessage: 'Unable to create inventory item.',
  });

export const updateInventoryItem = (
  itemId: string,
  payload: Record<string, any>,
) =>
  patchRequest(ROUTES.core.inventoryItem(itemId), payload, {
    errorMessage: 'Unable to update inventory item.',
  });

export const fetchDiagnosticOrders = (params?: Record<string, any>) =>
  getRequest(ROUTES.core.diagnosticOrders, {
    params,
    errorMessage: 'Unable to load diagnostic orders.',
  });

export const createDiagnosticOrder = (payload: Record<string, any>) =>
  postRequest(ROUTES.core.diagnosticOrders, payload, {
    errorMessage: 'Unable to create diagnostic order.',
  });

export const updateDiagnosticOrder = (
  orderId: string,
  payload: Record<string, any>,
) =>
  patchRequest(ROUTES.core.diagnosticOrder(orderId), payload, {
    errorMessage: 'Unable to update diagnostic order.',
  });

export const fetchImagingStudies = (params?: Record<string, any>) =>
  getRequest(ROUTES.core.imagingStudies, {
    params,
    errorMessage: 'Unable to load imaging studies.',
  });

export const createImagingStudy = (payload: Record<string, any>) =>
  postRequest(ROUTES.core.imagingStudies, payload, {
    errorMessage: 'Unable to create imaging study.',
  });

export const updateImagingStudy = (
  studyId: string,
  payload: Record<string, any>,
) =>
  patchRequest(ROUTES.core.imagingStudy(studyId), payload, {
    errorMessage: 'Unable to update imaging study.',
  });

export const fetchAdherenceReminders = (params?: Record<string, any>) =>
  getRequest(ROUTES.core.adherenceReminders, {
    params,
    errorMessage: 'Unable to load adherence reminders.',
  });

export const createAdherenceReminder = (payload: Record<string, any>) =>
  postRequest(ROUTES.core.adherenceReminders, payload, {
    errorMessage: 'Unable to create adherence reminder.',
  });

export const markReminderSent = (reminderId: string) =>
  postRequest(
    ROUTES.core.adherenceMarkSent(reminderId),
    {},
    {
      errorMessage: 'Unable to mark reminder sent.',
    },
  );

export const acknowledgeReminder = (reminderId: string) =>
  postRequest(
    ROUTES.core.adherenceAcknowledge(reminderId),
    {},
    {
      errorMessage: 'Unable to acknowledge reminder.',
    },
  );

export const fetchSupplyForecasts = (params?: Record<string, any>) =>
  getRequest(ROUTES.core.supplyForecasts, {
    params,
    errorMessage: 'Unable to load supply forecasts.',
  });

export const createSupplyForecast = (payload: Record<string, any>) =>
  postRequest(ROUTES.core.supplyForecasts, payload, {
    errorMessage: 'Unable to create supply forecast.',
  });

export const updateSupplyForecast = (
  forecastId: string,
  payload: Record<string, any>,
) =>
  patchRequest(ROUTES.core.supplyForecast(forecastId), payload, {
    errorMessage: 'Unable to update supply forecast.',
  });
