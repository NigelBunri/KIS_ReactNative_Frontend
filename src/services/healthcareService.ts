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

export const updateClinicalTask = (taskId: string, payload: Record<string, any>) =>
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

export const updateEmergencyEscalation = (escalationId: string, payload: Record<string, any>) =>
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

export const updateInventoryItem = (itemId: string, payload: Record<string, any>) =>
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

export const updateDiagnosticOrder = (orderId: string, payload: Record<string, any>) =>
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

export const updateImagingStudy = (studyId: string, payload: Record<string, any>) =>
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
  postRequest(ROUTES.core.adherenceMarkSent(reminderId), {}, {
    errorMessage: 'Unable to mark reminder sent.',
  });

export const acknowledgeReminder = (reminderId: string) =>
  postRequest(ROUTES.core.adherenceAcknowledge(reminderId), {}, {
    errorMessage: 'Unable to acknowledge reminder.',
  });

export const fetchSupplyForecasts = (params?: Record<string, any>) =>
  getRequest(ROUTES.core.supplyForecasts, {
    params,
    errorMessage: 'Unable to load supply forecasts.',
  });

export const createSupplyForecast = (payload: Record<string, any>) =>
  postRequest(ROUTES.core.supplyForecasts, payload, {
    errorMessage: 'Unable to create supply forecast.',
  });

export const updateSupplyForecast = (forecastId: string, payload: Record<string, any>) =>
  patchRequest(ROUTES.core.supplyForecast(forecastId), payload, {
    errorMessage: 'Unable to update supply forecast.',
  });
