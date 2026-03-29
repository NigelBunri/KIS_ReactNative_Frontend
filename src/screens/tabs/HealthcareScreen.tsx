import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KIS_TOKENS } from '@/theme/constants';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import GlobalShell from '@/components/healthcare/GlobalShell';
import {
  fetchTelemedicineSessions,
  fetchPatientMasterRecords,
  fetchPatientSummary,
  fetchPatientEncounters,
  fetchPatientMedications,
  fetchPatientVitals,
  fetchPatientAllergies,
  createMedicationOrder,
  createVitalSign,
  endTelemedicineSession,
  startTelemedicineSession,
  createFamilyProfile,
  createConsentRecord,
  createPatientMasterRecord,
  createAppointment,
  createTelemedicineSession,
  fetchClinicalTasks,
  createClinicalTask,
  updateClinicalTask,
  fetchEmergencyEscalations,
  createEmergencyEscalation,
  updateEmergencyEscalation,
  fetchTriageRecords,
  createTriageRecord,
  fetchReferralRoutes,
  createReferralRoute,
  fetchClinicalEvents,
  fetchCommandCenterOverview,
  fetchInventoryItems,
  createInventoryItem,
  fetchDiagnosticOrders,
  createDiagnosticOrder,
  fetchImagingStudies,
  createImagingStudy,
  fetchAdherenceReminders,
  createAdherenceReminder,
  markReminderSent,
  acknowledgeReminder,
  fetchSupplyForecasts,
  createSupplyForecast,
} from '@/services/healthcareService';
import {
  fetchClinicalAnalyticsReports,
  computeClinicalAnalyticsReports,
  fetchRiskStratifications,
  computeRiskStratification,
  fetchOutcomeBenchmarks,
  createOutcomeBenchmark,
  fetchPatientSatisfactionScores,
  createPatientSatisfactionScore,
  fetchOutreachCampaigns,
  createOutreachCampaign,
  setOutreachCampaignStatus,
  fetchWellnessChallenges,
  createWellnessChallenge,
  fetchHabitTrackingEntries,
  createHabitTrackingEntry,
} from '@/services/analyticsService';
import {
  fetchHealthcareContext,
  setActiveMedicalProfile,
} from '@/services/healthcareContextService';
import StaffConsole from '@/components/healthcare/StaffConsole';
import {
  fetchStaffProfiles,
  assignStaffRole,
  assignStaffShift,
} from '@/services/staffService';

const INITIAL_PATIENT_FORM = {
  mrn: '',
  first_name: '',
  last_name: '',
  dob: '',
  gender: 'unknown',
  status: 'active',
};

const INITIAL_FAMILY_FORM = {
  relationship: '',
  members: '',
  notes: '',
};

const INITIAL_CONSENT_FORM = {
  purpose: '',
  consent_text: '',
  expires_at: '',
};

const INITIAL_SESSION_FORM = {
  patientId: '',
  scheduledAt: '',
  notes: '',
};

const INITIAL_TASK_FORM = {
  title: '',
  description: '',
  assignedTo: '',
  dueAt: '',
  priority: 'medium' as 'low' | 'medium' | 'high',
};

const INITIAL_ESCALATION_FORM = {
  severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
  summary: '',
};

const INITIAL_REFERRAL_FORM = {
  toOrganization: '',
  reason: '',
};

const INITIAL_TRIAGE_FORM = {
  symptoms: '',
};

export default function HealthcareScreen() {
  const { palette, tokens } = useKISTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [medicalContext, setMedicalContext] = useState<any>(null);
  const [teleSessions, setTeleSessions] = useState<any[]>([]);
  const [patientCount, setPatientCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [teleLoading, setTeleLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [staffProfiles, setStaffProfiles] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [patientDetail, setPatientDetail] = useState<any | null>(null);
  const [patientDetailLoading, setPatientDetailLoading] = useState(false);
  const [timelineEntries, setTimelineEntries] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [medOrderForm, setMedOrderForm] = useState({
    drug_name: '',
    dosage: '',
    route: '',
    frequency: '',
    notes: '',
  });
  const [vitalForm, setVitalForm] = useState({ vital_type: '', value: '', units: '', notes: '' });
  const [medSubmitting, setMedSubmitting] = useState(false);
  const [vitalSubmitting, setVitalSubmitting] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffUpdateId, setStaffUpdateId] = useState<string | null>(null);
  const [staffShiftId, setStaffShiftId] = useState<string | null>(null);
  const [triageResult, setTriageResult] = useState<string | null>(null);
  const [patientForm, setPatientForm] = useState({ ...INITIAL_PATIENT_FORM });
  const [familyForm, setFamilyForm] = useState({ ...INITIAL_FAMILY_FORM });
  const [consentForm, setConsentForm] = useState({ ...INITIAL_CONSENT_FORM });
  const [patientSaving, setPatientSaving] = useState(false);
  const [familySaving, setFamilySaving] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [sessionForm, setSessionForm] = useState({ ...INITIAL_SESSION_FORM });
  const [sessionSubmitting, setSessionSubmitting] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const selectedSessionPatient = useMemo(
    () =>
      sessionForm.patientId
        ? patients.find((patient) => patient.id === sessionForm.patientId) ?? null
        : null,
    [patients, sessionForm.patientId],
  );
  const sessionPatientLabel = selectedSessionPatient
    ? `${selectedSessionPatient.last_name}, ${selectedSessionPatient.first_name}`
    : sessionForm.patientId && patientDetail?.id !== sessionForm.patientId
    ? 'Loading patient details...'
    : 'Not selected yet';
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskForm, setTaskForm] = useState({ ...INITIAL_TASK_FORM });
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [commandCenter, setCommandCenter] = useState<any | null>(null);
  const [commandLoading, setCommandLoading] = useState(false);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [escalationForm, setEscalationForm] = useState({ ...INITIAL_ESCALATION_FORM });
  const [escalationSubmitting, setEscalationSubmitting] = useState(false);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [referralForm, setReferralForm] = useState({ ...INITIAL_REFERRAL_FORM });
  const [referralSubmitting, setReferralSubmitting] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [triageRecords, setTriageRecords] = useState<any[]>([]);
  const [triageForm, setTriageForm] = useState({ ...INITIAL_TRIAGE_FORM });
  const [triageSubmitting, setTriageSubmitting] = useState(false);
  const [analyticsReports, setAnalyticsReports] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [riskAssessments, setRiskAssessments] = useState<any[]>([]);
  const [riskLoading, setRiskLoading] = useState(false);
  const [_outcomeBenchmarks, setOutcomeBenchmarks] = useState<any[]>([]);
  const [outcomeForm, setOutcomeForm] = useState({
    metric_name: '',
    actual_value: '',
    target_value: '',
    period_start: '',
    period_end: '',
    notes: '',
  });
  const [satisfactionScores, setSatisfactionScores] = useState<any[]>([]);
  const [satisfactionForm, setSatisfactionForm] = useState({
    score: '',
    channel: 'app',
    comments: '',
  });
  const [outreachCampaigns, setOutreachCampaigns] = useState<any[]>([]);
  const [outreachForm, setOutreachForm] = useState({
    name: '',
    channel: 'email',
    target_population: '',
    status: 'planned',
  });
  const [wellnessChallenges, setWellnessChallenges] = useState<any[]>([]);
  const [challengeForm, setChallengeForm] = useState({
    title: '',
    goal: '',
    start_date: '',
    end_date: '',
    participation_target: '',
    description: '',
  });
  const [habitEntries, setHabitEntries] = useState<any[]>([]);
  const [habitForm, setHabitForm] = useState({
    challengeId: '',
    habit_name: '',
    progress_value: '',
    notes: '',
  });
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryForm, setInventoryForm] = useState({
    name: '',
    category: '',
    sku: '',
    unit: '',
    quantity_on_hand: '',
    reorder_level: '',
  });
  const [diagnosticOrders, setDiagnosticOrders] = useState<any[]>([]);
  const [diagnosticForm, setDiagnosticForm] = useState({
    test_name: '',
    specimen_collected_at: '',
    status: 'ordered' as 'ordered' | 'processing' | 'completed' | 'cancelled',
  });
  const [imagingStudies, setImagingStudies] = useState<any[]>([]);
  const [imagingForm, setImagingForm] = useState({
    modality: '',
    body_region: '',
    scheduled_at: '',
    status: 'scheduled' as 'scheduled' | 'in_progress' | 'completed' | 'cancelled',
  });
  const [adherenceReminders, setAdherenceReminders] = useState<any[]>([]);
  const [reminderForm, setReminderForm] = useState({
    scheduled_at: '',
    channel: 'sms',
    notes: '',
  });
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [supplyForecasts, setSupplyForecasts] = useState<any[]>([]);
  const [forecastForm, setForecastForm] = useState({
    category: '',
    period_start: '',
    period_end: '',
    predicted_usage: '',
    notes: '',
  });
  const [forecastLoading, setForecastLoading] = useState(false);

  const loadContext = useCallback(async () => {
    setContextLoading(true);
    const res = await fetchHealthcareContext();
    setContextLoading(false);
    if (res.success) {
      setMedicalContext(res.data);
      return;
    }
    Alert.alert('Context', res.message || 'Unable to load medical context.');
  }, []);

  const loadPatientRecords = useCallback(
    async (query?: string) => {
      setLoading(true);
      const params = query ? { search: query } : undefined;
      const res = await fetchPatientMasterRecords(params);
      if (res.success) {
        const rows = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.results)
          ? res.data.results
          : [];
        setPatients(rows);
        setPatientCount(rows.length);
        setPatientDetail(null);
      } else {
        Alert.alert('Patients', res.message || 'Unable to load patients.');
      }
      setLoading(false);
    },
    [],
  );

  const loadTeleSessions = useCallback(async () => {
    setTeleLoading(true);
    const res = await fetchTelemedicineSessions();
    setTeleLoading(false);
    if (res.success) {
      setTeleSessions(Array.isArray(res.data) ? res.data : []);
      return;
    }
    Alert.alert('Telemedicine', res.message || 'Unable to load sessions.');
  }, []);

  const loadPatientTimeline = useCallback(async (patientId: string) => {
    setTimelineLoading(true);
    try {
      const normalize = (response: any) =>
        Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.results)
          ? response.data.results
          : [];

      const [encRes, medRes, vitalRes, allergyRes] = await Promise.all([
        fetchPatientEncounters(patientId),
        fetchPatientMedications(patientId),
        fetchPatientVitals(patientId),
        fetchPatientAllergies(patientId),
      ]);

      const entries: any[] = [];
      const addEntry = (item: {
        id: string;
        type: string;
        label: string;
        summary: string;
        timestamp?: string | null;
        payload?: any;
      }) => {
        const stamp = item.timestamp || new Date().toISOString();
        entries.push({ ...item, timestamp: stamp });
      };

      normalize(encRes).forEach((enc: any) =>
        addEntry({
          id: `enc-${enc.id}`,
          type: 'encounter',
          label: enc.encounter_type || 'Clinical encounter',
          summary: enc.summary || enc.notes || 'Encounter logged.',
          timestamp: enc.created_at || enc.updated_at,
          payload: enc,
        }),
      );

      normalize(medRes).forEach((med: any) =>
        addEntry({
          id: `med-${med.id}`,
          type: 'medication',
          label: med.drug_name,
          summary: `${med.dosage || 'dosage'} · ${med.status || 'status'}`,
          timestamp: med.created_at || med.updated_at,
          payload: med,
        }),
      );

      normalize(vitalRes).forEach((vital: any) =>
        addEntry({
          id: `vital-${vital.id}`,
          type: 'vital',
          label: `${vital.vital_type || 'vital'} ${vital.value || ''}${vital.units || ''}`,
          summary: vital.notes || 'Vital recorded',
          timestamp: vital.recorded_at,
          payload: vital,
        }),
      );

      normalize(allergyRes).forEach((allergy: any) =>
        addEntry({
          id: `allergy-${allergy.id}`,
          type: 'allergy',
          label: `${allergy.agent} (${allergy.severity})`,
          summary: allergy.reaction || 'Allergy noted',
          timestamp: allergy.recorded_at,
          payload: allergy,
        }),
      );

      const sorted = entries.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      setTimelineEntries(sorted);
    } catch (error: any) {
      Alert.alert('Timeline', error?.message || 'Unable to load timeline data.');
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const loadStaffProfiles = useCallback(async () => {
    const profileId = medicalContext?.active_profile_id;
    if (!profileId) {
      setStaffProfiles([]);
      return;
    }
    setStaffLoading(true);
    const res = await fetchStaffProfiles({ profile: profileId });
    setStaffLoading(false);
    if (res.success) {
      const array = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
      setStaffProfiles(array);
      return;
    }
    Alert.alert('Staff', res.message || 'Unable to load staff directory.');
  }, [medicalContext?.active_profile_id]);

  const loadClinicalTasks = useCallback(async () => {
    const params = patientDetail ? { patient: patientDetail.id } : undefined;
    const res = await fetchClinicalTasks(params);
    if (res.success) {
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      setTasks(rows);
      return;
    }
    Alert.alert('Tasks', res.message || 'Unable to load clinical tasks.');
  }, [patientDetail]);

  const loadEmergencyEscalations = useCallback(async () => {
    const params = patientDetail ? { patient: patientDetail.id } : undefined;
    const res = await fetchEmergencyEscalations(params);
    if (res.success) {
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      setEscalations(rows);
      return;
    }
    Alert.alert('Escalations', res.message || 'Unable to load escalations.');
  }, [patientDetail]);

  const loadReferrals = useCallback(async () => {
    const params = patientDetail ? { patient: patientDetail.id } : undefined;
    const res = await fetchReferralRoutes(params);
    if (res.success) {
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      setReferrals(rows);
      return;
    }
    Alert.alert('Referrals', res.message || 'Unable to load referrals.');
  }, [patientDetail]);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    const params = patientDetail ? { patient: patientDetail.id } : undefined;
    const res = await fetchClinicalEvents(params);
    setEventsLoading(false);
    if (res.success) {
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      setEvents(rows);
      return;
    }
    Alert.alert('Events', res.message || 'Unable to load clinical events.');
  }, [patientDetail]);

  const loadCommandCenter = useCallback(async () => {
    setCommandLoading(true);
    const res = await fetchCommandCenterOverview();
    setCommandLoading(false);
    if (res.success) {
      setCommandCenter(res.data);
      return;
    }
    Alert.alert('Command center', res.message || 'Unable to load dashboard.');
  }, []);

  const loadInventoryItems = useCallback(async () => {
    if (!medicalContext?.active_profile_id) {
      setInventoryItems([]);
      return;
    }
    setInventoryLoading(true);
    const res = await fetchInventoryItems({ profile: medicalContext.active_profile_id });
    setInventoryLoading(false);
    if (res.success) {
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      setInventoryItems(rows);
      return;
    }
    Alert.alert('Inventory', res.message || 'Unable to load inventory.');
  }, [medicalContext?.active_profile_id]);

  const loadDiagnosticOrders = useCallback(async () => {
    const params = patientDetail ? { patient: patientDetail.id } : undefined;
    const res = await fetchDiagnosticOrders(params);
    if (res.success) {
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      setDiagnosticOrders(rows);
      return;
    }
    Alert.alert('Diagnostics', res.message || 'Unable to load orders.');
  }, [patientDetail]);

  const loadImagingStudies = useCallback(async () => {
    const params = patientDetail ? { patient: patientDetail.id } : undefined;
    const res = await fetchImagingStudies(params);
    if (res.success) {
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      setImagingStudies(rows);
      return;
    }
    Alert.alert('Imaging', res.message || 'Unable to load studies.');
  }, [patientDetail]);

  const loadAdherenceReminders = useCallback(async () => {
    if (!patientDetail) {
      setAdherenceReminders([]);
      return;
    }
    setRemindersLoading(true);
    const res = await fetchAdherenceReminders({ patient: patientDetail.id });
    setRemindersLoading(false);
    if (res.success) {
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      setAdherenceReminders(rows);
      return;
    }
    Alert.alert('Adherence', res.message || 'Unable to load reminders.');
  }, [patientDetail]);

  const loadSupplyForecasts = useCallback(async () => {
    if (!medicalContext?.active_profile_id) {
      setSupplyForecasts([]);
      return;
    }
    setForecastLoading(true);
    const res = await fetchSupplyForecasts({ profile: medicalContext.active_profile_id });
    setForecastLoading(false);
    if (res.success) {
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      setSupplyForecasts(rows);
      return;
    }
    Alert.alert('Forecasts', res.message || 'Unable to load supply plans.');
  }, [medicalContext?.active_profile_id]);

  const loadAnalyticsReports = useCallback(async () => {
    if (!medicalContext?.active_profile_id) {
      setAnalyticsReports([]);
      return;
    }
    setAnalyticsLoading(true);
    const res = await fetchClinicalAnalyticsReports({ profile: medicalContext.active_profile_id });
    setAnalyticsLoading(false);
    if (res.success) {
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      setAnalyticsReports(rows);
      return;
    }
    Alert.alert('Analytics', res.message || 'Unable to load analytics reports.');
  }, [medicalContext?.active_profile_id]);

  const loadRiskAssessments = useCallback(async () => {
    if (!patientDetail) {
      setRiskAssessments([]);
      return;
    }
    setRiskLoading(true);
    const res = await fetchRiskStratifications({ patient: patientDetail.id });
    setRiskLoading(false);
    if (res.success) {
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      setRiskAssessments(rows);
      return;
    }
    Alert.alert('Risk', res.message || 'Unable to load risk data.');
  }, [patientDetail]);

  const loadOutcomeBenchmarks = useCallback(async () => {
    if (!medicalContext?.active_profile_id) {
      setOutcomeBenchmarks([]);
      return;
    }
    const res = await fetchOutcomeBenchmarks({ profile: medicalContext.active_profile_id });
    if (res.success) {
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      setOutcomeBenchmarks(rows);
      return;
    }
    Alert.alert('Outcomes', res.message || 'Unable to load benchmarks.');
  }, [medicalContext?.active_profile_id]);

  const loadSatisfactionScores = useCallback(async () => {
    if (!patientDetail) {
      setSatisfactionScores([]);
      return;
    }
    const res = await fetchPatientSatisfactionScores({ patient: patientDetail.id });
    if (res.success) {
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      setSatisfactionScores(rows);
      return;
    }
    Alert.alert('Satisfaction', res.message || 'Unable to load satisfaction scores.');
  }, [patientDetail]);

  const loadOutreachCampaigns = useCallback(async () => {
    if (!medicalContext?.active_profile_id) {
      setOutreachCampaigns([]);
      return;
    }
    const res = await fetchOutreachCampaigns({ profile: medicalContext.active_profile_id });
    if (res.success) {
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      setOutreachCampaigns(rows);
      return;
    }
    Alert.alert('Outreach', res.message || 'Unable to load campaigns.');
  }, [medicalContext?.active_profile_id]);

  const loadWellnessChallenges = useCallback(async () => {
    if (!medicalContext?.active_profile_id) {
      setWellnessChallenges([]);
      return;
    }
    const res = await fetchWellnessChallenges({ profile: medicalContext.active_profile_id });
    if (res.success) {
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      setWellnessChallenges(rows);
      return;
    }
    Alert.alert('Wellness', res.message || 'Unable to load challenges.');
  }, [medicalContext?.active_profile_id]);

  const loadHabitEntries = useCallback(async () => {
    if (!patientDetail) {
      setHabitEntries([]);
      return;
    }
    const res = await fetchHabitTrackingEntries({ patient: patientDetail.id });
    if (res.success) {
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      setHabitEntries(rows);
      return;
    }
    Alert.alert('Habits', res.message || 'Unable to load habits.');
  }, [patientDetail]);

  const loadTriageRecords = useCallback(async () => {
    const params = patientDetail ? { patient: patientDetail.id } : undefined;
    const res = await fetchTriageRecords(params);
    if (res.success) {
      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      setTriageRecords(rows);
      return;
    }
    Alert.alert('Triage', res.message || 'Unable to load triage history.');
  }, [patientDetail]);

  const loadPatientDetail = useCallback(
    async (patientId: string) => {
      const res = await fetchPatientSummary(patientId);
      if (res.success) {
        setPatientDetail(res.data);
        await loadPatientTimeline(patientId);
        return;
      }
      Alert.alert('Patient', res.message || 'Unable to load patient profile.');
    },
    [loadPatientTimeline],
  );

  useEffect(() => {
    loadStaffProfiles();
  }, [loadStaffProfiles]);

  useEffect(() => {
    loadContext();
    loadTeleSessions();
    loadPatientRecords();
  }, [loadContext, loadTeleSessions, loadPatientRecords]);

  useEffect(() => {
    loadClinicalTasks();
    loadEmergencyEscalations();
    loadReferrals();
    loadEvents();
    loadCommandCenter();
    loadInventoryItems();
    loadDiagnosticOrders();
    loadImagingStudies();
    loadAdherenceReminders();
    loadSupplyForecasts();
    loadAnalyticsReports();
    loadRiskAssessments();
    loadOutcomeBenchmarks();
    loadSatisfactionScores();
    loadOutreachCampaigns();
    loadWellnessChallenges();
    loadHabitEntries();
    loadTriageRecords();
  }, [
    loadClinicalTasks,
    loadEmergencyEscalations,
    loadReferrals,
    loadEvents,
    loadCommandCenter,
    loadInventoryItems,
    loadDiagnosticOrders,
    loadImagingStudies,
    loadAdherenceReminders,
    loadSupplyForecasts,
    loadAnalyticsReports,
    loadRiskAssessments,
    loadOutcomeBenchmarks,
    loadSatisfactionScores,
    loadOutreachCampaigns,
    loadWellnessChallenges,
    loadHabitEntries,
    loadTriageRecords,
  ]);

  const handleSearchSubmit = useCallback(() => {
    loadPatientRecords(searchTerm);
  }, [loadPatientRecords, searchTerm]);

  const handleSelectPatient = useCallback(
    async (patientId: string) => {
      setPatientDetailLoading(true);
      await loadPatientDetail(patientId);
      setPatientDetailLoading(false);
      setSessionForm((prev) => ({ ...prev, patientId }));
    },
    [loadPatientDetail],
  );

  const handleSessionAction = useCallback(
    async (session: any, action: 'start' | 'end') => {
      const executor =
        action === 'start'
          ? startTelemedicineSession
          : endTelemedicineSession;
      const res = await executor(session.id);
      if (res.success) {
        loadTeleSessions();
        return;
      }
      Alert.alert('Telemedicine', res.message || 'Unable to update session.');
    },
    [loadTeleSessions],
  );

  const handleSessionFormChange = useCallback((field: keyof typeof sessionForm, value: string) => {
    setSessionForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleScheduleSession = useCallback(async () => {
    const patientId = sessionForm.patientId || patientDetail?.id;
    if (!patientId) {
      Alert.alert('Telemedicine', 'Select or enter a patient to continue.');
      return;
    }
    if (!sessionForm.scheduledAt.trim()) {
      Alert.alert('Telemedicine', 'Provide a date/time for the session (ISO or YYYY-MM-DDTHH:mm).');
      return;
    }
    setSessionSubmitting(true);
    try {
      const appointmentPayload = {
        patient: patientId,
        profile: medicalContext?.active_profile_id,
        scheduled_at: sessionForm.scheduledAt,
        status: 'scheduled',
      };
      const appointmentRes = await createAppointment(appointmentPayload);
      if (!appointmentRes.success) {
        throw new Error(appointmentRes.message || 'Unable to create appointment.');
      }
      const appointment = appointmentRes.data;
      const sessionPayload = {
        patient: patientId,
        profile: medicalContext?.active_profile_id,
        appointment: appointment.id,
        notes: sessionForm.notes,
      };
      const sessionRes = await createTelemedicineSession(sessionPayload);
      if (!sessionRes.success) {
        throw new Error(sessionRes.message || 'Unable to schedule telemedicine session.');
      }
      setSessionMessage(
        `Telemedicine session booked for ${appointment.scheduled_at || sessionForm.scheduledAt}.`,
      );
      setSessionForm({ ...INITIAL_SESSION_FORM, patientId });
      loadTeleSessions();
    } catch (error: any) {
      Alert.alert('Telemedicine', error?.message || 'Unable to schedule session.');
    } finally {
      setSessionSubmitting(false);
    }
  }, [sessionForm, medicalContext?.active_profile_id, patientDetail, loadTeleSessions]);

  const handleTaskFormChange = useCallback(
    (field: keyof typeof taskForm, value: string) => {
      setTaskForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleAssignTaskToStaff = useCallback(
    (userId: string) => {
      setTaskForm((prev) => ({ ...prev, assignedTo: userId }));
    },
    [],
  );

  const handleCreateClinicalTask = useCallback(async () => {
    if (!patientDetail) {
      Alert.alert('Tasks', 'Select a patient first.');
      return;
    }
    if (!taskForm.title.trim()) {
      Alert.alert('Tasks', 'Provide a task title.');
      return;
    }
    setTaskSubmitting(true);
    try {
      const payload = {
        patient: patientDetail.id,
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        assigned_to: taskForm.assignedTo || null,
        priority: taskForm.priority,
        due_at: taskForm.dueAt || undefined,
      };
      const res = await createClinicalTask(payload);
      if (res.success) {
        setTaskForm({ ...INITIAL_TASK_FORM, assignedTo: taskForm.assignedTo });
        loadClinicalTasks();
        loadCommandCenter();
        Alert.alert('Tasks', 'Task created.');
        return;
      }
      throw new Error(res.message || 'Unable to create task.');
    } catch (error: any) {
      Alert.alert('Tasks', error?.message || 'Unable to create task.');
    } finally {
      setTaskSubmitting(false);
    }
  }, [taskForm, patientDetail, loadClinicalTasks, loadCommandCenter]);

  const handleCompleteTask = useCallback(
    async (taskId: string) => {
      const res = await updateClinicalTask(taskId, { status: 'completed' });
      if (res.success) {
        loadClinicalTasks();
        loadCommandCenter();
        return;
      }
      Alert.alert('Tasks', res.message || 'Unable to close task.');
    },
    [loadClinicalTasks, loadCommandCenter],
  );

  const handleEscalationFormChange = useCallback(
    (field: keyof typeof escalationForm, value: string) => {
      setEscalationForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleCreateEscalation = useCallback(async () => {
    if (!patientDetail) {
      Alert.alert('Escalation', 'Select a patient first.');
      return;
    }
    if (!escalationForm.summary.trim()) {
      Alert.alert('Escalation', 'Describe the issue.');
      return;
    }
    setEscalationSubmitting(true);
    try {
      const payload = {
        patient: patientDetail.id,
        severity: escalationForm.severity,
        summary: escalationForm.summary.trim(),
        metadata: { triggered_from: 'command_center' },
      };
      const res = await createEmergencyEscalation(payload);
      if (res.success) {
        setEscalationForm({ ...INITIAL_ESCALATION_FORM });
        loadEmergencyEscalations();
        loadCommandCenter();
        Alert.alert('Escalation', 'Emergency escalation logged.');
        return;
      }
      throw new Error(res.message || 'Unable to create escalation.');
    } catch (error: any) {
      Alert.alert('Escalation', error?.message || 'Unable to create escalation.');
    } finally {
      setEscalationSubmitting(false);
    }
  }, [escalationForm, patientDetail, loadEmergencyEscalations, loadCommandCenter]);

  const handleResolveEscalation = useCallback(
    async (escalationId: string) => {
      const res = await updateEmergencyEscalation(escalationId, { status: 'resolved' });
      if (res.success) {
        loadEmergencyEscalations();
        loadCommandCenter();
        return;
      }
      Alert.alert('Escalation', res.message || 'Unable to resolve escalation.');
    },
    [loadEmergencyEscalations, loadCommandCenter],
  );

  const handleReferralFormChange = useCallback(
    (field: keyof typeof referralForm, value: string) => {
      setReferralForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleCreateReferral = useCallback(async () => {
    if (!patientDetail) {
      Alert.alert('Referral', 'Select a patient first.');
      return;
    }
    if (!referralForm.reason.trim()) {
      Alert.alert('Referral', 'Provide a referral reason.');
      return;
    }
    setReferralSubmitting(true);
    try {
      const payload = {
        patient: patientDetail.id,
        reason: referralForm.reason.trim(),
        from_organization: medicalContext?.active_organization_id,
        metadata: { to_org_name: referralForm.toOrganization.trim() },
      };
      const res = await createReferralRoute(payload);
      if (res.success) {
        setReferralForm({ ...INITIAL_REFERRAL_FORM });
        loadReferrals();
        loadCommandCenter();
        Alert.alert('Referral', 'Referral created.');
        return;
      }
      throw new Error(res.message || 'Unable to create referral.');
    } catch (error: any) {
      Alert.alert('Referral', error?.message || 'Unable to create referral.');
    } finally {
      setReferralSubmitting(false);
    }
  }, [referralForm, patientDetail, medicalContext?.active_organization_id, loadReferrals, loadCommandCenter]);

  const handleRunTriage = useCallback(async () => {
    if (!patientDetail) {
      Alert.alert('Triage', 'Select a patient to run triage.');
      return;
    }
    const symptoms = (triageForm.symptoms || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!symptoms.length) {
      Alert.alert('Triage', 'Provide symptom keywords separated by commas.');
      return;
    }
    setTriageSubmitting(true);
    try {
      const payload = { patient: patientDetail.id, symptoms };
      const res = await createTriageRecord(payload);
      if (res.success) {
        setTriageResult(JSON.stringify(res.data, null, 2));
        setTriageForm({ ...INITIAL_TRIAGE_FORM });
        loadTriageRecords();
        Alert.alert('Triage', 'Triage record saved.');
        return;
      }
      throw new Error(res.message || 'Unable to run triage.');
    } catch (error: any) {
      Alert.alert('Triage', error?.message || 'Unable to run triage.');
    } finally {
      setTriageSubmitting(false);
    }
  }, [patientDetail, triageForm, loadTriageRecords]);

  const handleCreatePatient = useCallback(async () => {
    const { mrn, first_name, last_name } = patientForm;
    if (!mrn.trim() || !first_name.trim() || !last_name.trim()) {
      Alert.alert('Patient', 'MRN, first name, and last name are required.');
      return;
    }
    setPatientSaving(true);
    try {
      const payload = {
        ...patientForm,
        organization: medicalContext?.active_organization_id,
      };
      const res = await createPatientMasterRecord(payload);
      if (res.success) {
        setPatientForm({ ...INITIAL_PATIENT_FORM });
        loadPatientRecords();
        Alert.alert('Patient', 'Patient record created.');
        return;
      }
      Alert.alert('Patient', res.message || 'Unable to create patient record.');
    } catch (error: any) {
      Alert.alert('Patient', error?.message || 'Unable to create patient record.');
    } finally {
      setPatientSaving(false);
    }
  }, [patientForm, medicalContext?.active_organization_id, loadPatientRecords]);

  const handleCreateFamilyProfile = useCallback(async () => {
    if (!patientDetail) {
      Alert.alert('Family', 'Select a patient first.');
      return;
    }
    if (!familyForm.relationship.trim()) {
      Alert.alert('Family', 'Provide a relationship for the family record.');
      return;
    }
    setFamilySaving(true);
    try {
      const membersArray = (familyForm.members || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      const payload = {
        ...familyForm,
        patient: patientDetail.id,
        members: membersArray,
      };
      const res = await createFamilyProfile(payload);
      if (res.success) {
        setFamilyForm({ ...INITIAL_FAMILY_FORM });
        await loadPatientDetail(patientDetail.id);
        Alert.alert('Family', 'Family profile saved.');
        return;
      }
      Alert.alert('Family', res.message || 'Unable to save family profile.');
    } catch (error: any) {
      Alert.alert('Family', error?.message || 'Unable to save family profile.');
    } finally {
      setFamilySaving(false);
    }
  }, [familyForm, patientDetail, loadPatientDetail]);

  const handleCreateConsentRecord = useCallback(async () => {
    if (!patientDetail) {
      Alert.alert('Consent', 'Select a patient first.');
      return;
    }
    if (!consentForm.purpose.trim() || !consentForm.consent_text.trim()) {
      Alert.alert('Consent', 'Purpose and consent text are required.');
      return;
    }
    setConsentSaving(true);
    try {
      const payload = {
        ...consentForm,
        patient: patientDetail.id,
      };
      const res = await createConsentRecord(payload);
      if (res.success) {
        setConsentForm({ ...INITIAL_CONSENT_FORM });
        await loadPatientDetail(patientDetail.id);
        Alert.alert('Consent', 'Consent recorded.');
        return;
      }
      Alert.alert('Consent', res.message || 'Unable to record consent.');
    } catch (error: any) {
      Alert.alert('Consent', error?.message || 'Unable to record consent.');
    } finally {
      setConsentSaving(false);
    }
  }, [consentForm, patientDetail, loadPatientDetail]);

  const handleCreateMedicationOrder = useCallback(async () => {
    if (!patientDetail) {
      Alert.alert('Medication', 'Select a patient first.');
      return;
    }
    if (!medOrderForm.drug_name.trim()) {
      Alert.alert('Medication', 'Drug name is required.');
      return;
    }
    setMedSubmitting(true);
    try {
      const payload = {
        ...medOrderForm,
        patient: patientDetail.id,
      };
      const res = await createMedicationOrder(payload);
      if (res.success) {
        setMedOrderForm({
          drug_name: '',
          dosage: '',
          route: '',
          frequency: '',
          notes: '',
        });
        await loadPatientTimeline(patientDetail.id);
        Alert.alert('Medication', 'Medication order created.');
        return;
      }
      Alert.alert('Medication', res.message || 'Unable to create medication order.');
    } catch (error: any) {
      Alert.alert('Medication', error?.message || 'Unable to create medication order.');
    } finally {
      setMedSubmitting(false);
    }
  }, [medOrderForm, patientDetail, loadPatientTimeline]);

  const handleCreateVitalSign = useCallback(async () => {
    if (!patientDetail) {
      Alert.alert('Vitals', 'Select a patient first.');
      return;
    }
    if (!vitalForm.vital_type.trim() || !vitalForm.value) {
      Alert.alert('Vitals', 'Vital type and value are required.');
      return;
    }
    setVitalSubmitting(true);
    try {
      const payload = {
        ...vitalForm,
        patient: patientDetail.id,
      };
      const res = await createVitalSign(payload);
      if (res.success) {
        setVitalForm({ vital_type: '', value: '', units: '', notes: '' });
        await loadPatientTimeline(patientDetail.id);
        Alert.alert('Vitals', 'Vital sign logged.');
        return;
      }
      Alert.alert('Vitals', res.message || 'Unable to log vital sign.');
    } catch (error: any) {
      Alert.alert('Vitals', error?.message || 'Unable to log vital sign.');
    } finally {
      setVitalSubmitting(false);
    }
  }, [vitalForm, patientDetail, loadPatientTimeline]);


  const handleUpdateStaffRole = useCallback(
    async (staffId: string, payload: { role?: string; scope?: string }) => {
      setStaffUpdateId(staffId);
      try {
        await assignStaffRole(staffId, payload);
        await loadStaffProfiles();
      } catch (error: any) {
        Alert.alert('Staff', error?.message || 'Unable to update staff role.');
      } finally {
        setStaffUpdateId(null);
      }
    },
    [loadStaffProfiles],
  );

  const handleAssignStaffShift = useCallback(
    async (staffId: string, shifts: any[]) => {
      setStaffShiftId(staffId);
      try {
        await assignStaffShift(staffId, shifts);
        await loadStaffProfiles();
      } catch (error: any) {
        Alert.alert('Staff', error?.message || 'Unable to assign shift.');
      } finally {
        setStaffShiftId(null);
      }
    },
    [loadStaffProfiles],
  );

  const handleRefreshAnalyticsReports = useCallback(async () => {
    if (!medicalContext?.active_profile_id) {
      Alert.alert('Analytics', 'Activate a profile to refresh reports.');
      return;
    }
    setAnalyticsLoading(true);
    const res = await computeClinicalAnalyticsReports(medicalContext.active_profile_id);
    setAnalyticsLoading(false);
    if (res.success) {
      await loadAnalyticsReports();
      Alert.alert('Analytics', 'Reports refresh queued.');
      return;
    }
    Alert.alert('Analytics', res.message || 'Unable to refresh reports.');
  }, [medicalContext?.active_profile_id, loadAnalyticsReports]);

  const handleComputeRisk = useCallback(async () => {
    setRiskLoading(true);
    const res = await computeRiskStratification();
    setRiskLoading(false);
    if (res.success) {
      await loadRiskAssessments();
      Alert.alert('Risk', 'Risk stratification queued.');
      return;
    }
    Alert.alert('Risk', res.message || 'Unable to compute risk.');
  }, [loadRiskAssessments]);

  const handleCreateOutcomeBenchmark = useCallback(async () => {
    if (!medicalContext?.active_profile_id) {
      Alert.alert('Outcomes', 'Activate a profile first.');
      return;
    }
    if (!outcomeForm.metric_name.trim() || !outcomeForm.period_start || !outcomeForm.period_end) {
      Alert.alert('Outcomes', 'Metric name and period are required.');
      return;
    }
    const payload = {
      profile: medicalContext.active_profile_id,
      metric_name: outcomeForm.metric_name.trim(),
      actual_value: parseFloat(outcomeForm.actual_value) || 0,
      target_value: parseFloat(outcomeForm.target_value) || 0,
      period_start: outcomeForm.period_start,
      period_end: outcomeForm.period_end,
      notes: outcomeForm.notes.trim(),
    };
    const res = await createOutcomeBenchmark(payload);
    if (res.success) {
      setOutcomeForm({
        metric_name: '',
        actual_value: '',
        target_value: '',
        period_start: '',
        period_end: '',
        notes: '',
      });
      await loadOutcomeBenchmarks();
      Alert.alert('Outcomes', 'Benchmark saved.');
      return;
    }
    Alert.alert('Outcomes', res.message || 'Unable to save benchmark.');
  }, [medicalContext?.active_profile_id, outcomeForm, loadOutcomeBenchmarks]);

  const handleRecordSatisfactionScore = useCallback(async () => {
    if (!patientDetail) {
      Alert.alert('Satisfaction', 'Select a patient first.');
      return;
    }
    if (!satisfactionForm.score) {
      Alert.alert('Satisfaction', 'Score is required.');
      return;
    }
    const payload = {
      patient: patientDetail.id,
      score: Number(satisfactionForm.score),
      channel: satisfactionForm.channel,
      comments: satisfactionForm.comments.trim(),
      profile: medicalContext?.active_profile_id ?? undefined,
    };
    const res = await createPatientSatisfactionScore(payload);
    if (res.success) {
      setSatisfactionForm((prev) => ({ ...prev, score: '', comments: '' }));
      await loadSatisfactionScores();
      Alert.alert('Satisfaction', 'Score recorded.');
      return;
    }
    Alert.alert('Satisfaction', res.message || 'Unable to record score.');
  }, [patientDetail, satisfactionForm, medicalContext?.active_profile_id, loadSatisfactionScores]);

  const handleCreateOutreachCampaign = useCallback(async () => {
    if (!medicalContext?.active_profile_id) {
      Alert.alert('Outreach', 'Activate a profile first.');
      return;
    }
    if (!outreachForm.name.trim()) {
      Alert.alert('Outreach', 'Name is required.');
      return;
    }
    let targetPopulation = {};
    if (outreachForm.target_population.trim()) {
      try {
        targetPopulation = JSON.parse(outreachForm.target_population);
      } catch {
        targetPopulation = { raw: outreachForm.target_population.trim() };
      }
    }
    const payload = {
      profile: medicalContext.active_profile_id,
      name: outreachForm.name.trim(),
      channel: outreachForm.channel,
      target_population: targetPopulation,
      status: outreachForm.status,
    };
    const res = await createOutreachCampaign(payload);
    if (res.success) {
      setOutreachForm({ name: '', channel: 'email', target_population: '', status: 'planned' });
      await loadOutreachCampaigns();
      Alert.alert('Outreach', 'Campaign created.');
      return;
    }
    Alert.alert('Outreach', res.message || 'Unable to create campaign.');
  }, [medicalContext?.active_profile_id, outreachForm, loadOutreachCampaigns]);

  const handleUpdateCampaignStatus = useCallback(
    async (campaignId: string, status: string) => {
      const res = await setOutreachCampaignStatus(campaignId, status);
      if (res.success) {
        await loadOutreachCampaigns();
        return;
      }
      Alert.alert('Outreach', res.message || 'Unable to update status.');
    },
    [loadOutreachCampaigns],
  );

  const handleCreateWellnessChallenge = useCallback(async () => {
    if (!medicalContext?.active_profile_id) {
      Alert.alert('Wellness', 'Activate a profile first.');
      return;
    }
    if (!challengeForm.title.trim() || !challengeForm.start_date || !challengeForm.end_date) {
      Alert.alert('Wellness', 'Title and dates are required.');
      return;
    }
    const payload = {
      profile: medicalContext.active_profile_id,
      title: challengeForm.title.trim(),
      description: challengeForm.description.trim(),
      goal: challengeForm.goal.trim(),
      start_date: challengeForm.start_date,
      end_date: challengeForm.end_date,
      participation_target: parseInt(challengeForm.participation_target, 10) || 0,
    };
    const res = await createWellnessChallenge(payload);
    if (res.success) {
      setChallengeForm({
        title: '',
        goal: '',
        start_date: '',
        end_date: '',
        participation_target: '',
        description: '',
      });
      await loadWellnessChallenges();
      Alert.alert('Wellness', 'Challenge saved.');
      return;
    }
    Alert.alert('Wellness', res.message || 'Unable to save challenge.');
  }, [medicalContext?.active_profile_id, challengeForm, loadWellnessChallenges]);

  const handleLogHabitEntry = useCallback(async () => {
    if (!patientDetail) {
      Alert.alert('Habits', 'Select a patient first.');
      return;
    }
    if (!habitForm.challengeId || !habitForm.habit_name.trim()) {
      Alert.alert('Habits', 'Select a challenge and habit.');
      return;
    }
    const payload = {
      patient: patientDetail.id,
      challenge: habitForm.challengeId,
      habit_name: habitForm.habit_name.trim(),
      progress_value: parseFloat(habitForm.progress_value) || 0,
      notes: habitForm.notes.trim(),
    };
    const res = await createHabitTrackingEntry(payload);
    if (res.success) {
      setHabitForm({ challengeId: '', habit_name: '', progress_value: '', notes: '' });
      await loadHabitEntries();
      Alert.alert('Habits', 'Entry logged.');
      return;
    }
    Alert.alert('Habits', res.message || 'Unable to log entry.');
  }, [patientDetail, habitForm, loadHabitEntries]);

  const handleProfileSelect = useCallback(
    async (profileId: string) => {
      const res = await setActiveMedicalProfile(profileId);
      if (res.success) {
        loadContext();
        return;
      }
      Alert.alert('Profile', res.message || 'Unable to activate profile.');
    },
    [loadContext],
  );

  const handleCreateInventoryItem = useCallback(async () => {
    if (!medicalContext?.active_profile_id || !medicalContext?.active_organization_id) {
      Alert.alert('Inventory', 'Activate a profile to track inventory.');
      return;
    }
    if (!inventoryForm.name.trim()) {
      Alert.alert('Inventory', 'Item name is required.');
      return;
    }
    setInventoryLoading(true);
    try {
      const payload = {
        profile: medicalContext.active_profile_id,
        organization: medicalContext.active_organization_id,
        name: inventoryForm.name.trim(),
        category: inventoryForm.category.trim(),
        sku: inventoryForm.sku.trim(),
        unit: inventoryForm.unit.trim() || 'unit',
        quantity_on_hand: parseFloat(inventoryForm.quantity_on_hand) || 0,
        reorder_level: parseFloat(inventoryForm.reorder_level) || 0,
      };
      const res = await createInventoryItem(payload);
      if (res.success) {
        setInventoryForm({
          name: '',
          category: '',
          sku: '',
          unit: '',
          quantity_on_hand: '',
          reorder_level: '',
        });
        Alert.alert('Inventory', 'Item added.');
        loadInventoryItems();
        return;
      }
      Alert.alert('Inventory', res.message || 'Unable to save item.');
    } catch (error: any) {
      Alert.alert('Inventory', error?.message || 'Unable to save item.');
    } finally {
      setInventoryLoading(false);
    }
  }, [inventoryForm, medicalContext, loadInventoryItems]);

  const handleCreateDiagnosticOrder = useCallback(async () => {
    if (!patientDetail) {
      Alert.alert('Diagnostics', 'Select a patient first.');
      return;
    }
    if (!diagnosticForm.test_name.trim()) {
      Alert.alert('Diagnostics', 'Test name is required.');
      return;
    }
    const payload = {
      patient: patientDetail.id,
      test_name: diagnosticForm.test_name.trim(),
      status: diagnosticForm.status,
      specimen_collected_at: diagnosticForm.specimen_collected_at || undefined,
    };
    const res = await createDiagnosticOrder(payload);
    if (res.success) {
      setDiagnosticForm({ test_name: '', specimen_collected_at: '', status: 'ordered' });
      Alert.alert('Diagnostics', 'Order created.');
      loadDiagnosticOrders();
      return;
    }
    Alert.alert('Diagnostics', res.message || 'Unable to create order.');
  }, [patientDetail, diagnosticForm, loadDiagnosticOrders]);

  const handleCreateImagingStudy = useCallback(async () => {
    if (!patientDetail) {
      Alert.alert('Imaging', 'Select a patient first.');
      return;
    }
    if (!imagingForm.modality.trim()) {
      Alert.alert('Imaging', 'Modality is required.');
      return;
    }
    const payload = {
      patient: patientDetail.id,
      modality: imagingForm.modality.trim(),
      body_region: imagingForm.body_region.trim(),
      scheduled_at: imagingForm.scheduled_at || undefined,
      status: imagingForm.status,
    };
    const res = await createImagingStudy(payload);
    if (res.success) {
      setImagingForm({ modality: '', body_region: '', scheduled_at: '', status: 'scheduled' });
      Alert.alert('Imaging', 'Study scheduled.');
      loadImagingStudies();
      return;
    }
    Alert.alert('Imaging', res.message || 'Unable to schedule.');
  }, [patientDetail, imagingForm, loadImagingStudies]);

  const handleCreateAdherenceReminder = useCallback(async () => {
    if (!patientDetail) {
      Alert.alert('Adherence', 'Select a patient first.');
      return;
    }
    if (!reminderForm.scheduled_at) {
      Alert.alert('Adherence', 'Scheduled time is required.');
      return;
    }
    const payload = {
      patient: patientDetail.id,
      scheduled_at: reminderForm.scheduled_at,
      channel: reminderForm.channel,
      notes: reminderForm.notes.trim(),
    };
    const res = await createAdherenceReminder(payload);
    if (res.success) {
      setReminderForm({ scheduled_at: '', channel: 'sms', notes: '' });
      Alert.alert('Adherence', 'Reminder created.');
      loadAdherenceReminders();
      return;
    }
    Alert.alert('Adherence', res.message || 'Unable to create reminder.');
  }, [patientDetail, reminderForm, loadAdherenceReminders]);

  const handleSendReminderNow = useCallback(
    async (reminderId: string) => {
      const res = await markReminderSent(reminderId);
      if (res.success) {
        Alert.alert('Adherence', 'Reminder marked as sent.');
        loadAdherenceReminders();
        return;
      }
      Alert.alert('Adherence', res.message || 'Unable to mark reminder.');
    },
    [loadAdherenceReminders],
  );

  const handleAcknowledgeReminder = useCallback(
    async (reminderId: string) => {
      const res = await acknowledgeReminder(reminderId);
      if (res.success) {
        Alert.alert('Adherence', 'Reminder acknowledged.');
        loadAdherenceReminders();
        return;
      }
      Alert.alert('Adherence', res.message || 'Unable to acknowledge reminder.');
    },
    [loadAdherenceReminders],
  );

  const handleCreateSupplyForecast = useCallback(async () => {
    if (!medicalContext?.active_profile_id) {
      Alert.alert('Forecast', 'Activate a profile first.');
      return;
    }
    if (!forecastForm.category.trim()) {
      Alert.alert('Forecast', 'Category is required.');
      return;
    }
    if (!forecastForm.period_start || !forecastForm.period_end) {
      Alert.alert('Forecast', 'Period start and end are required.');
      return;
    }
    const payload = {
      profile: medicalContext.active_profile_id,
      category: forecastForm.category.trim(),
      period_start: forecastForm.period_start,
      period_end: forecastForm.period_end,
      predicted_usage: parseFloat(forecastForm.predicted_usage) || 0,
      notes: forecastForm.notes?.trim() || '',
    };
    const res = await createSupplyForecast(payload);
    if (res.success) {
      setForecastForm({ category: '', period_start: '', period_end: '', predicted_usage: '', notes: '' });
      Alert.alert('Forecast', 'Forecast saved.');
      loadSupplyForecasts();
      return;
    }
    Alert.alert('Forecast', res.message || 'Unable to save forecast.');
  }, [medicalContext?.active_profile_id, forecastForm, loadSupplyForecasts]);

  const handleEmergencyToggle = useCallback(() => {
    setEmergencyMode((prev) => !prev);
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.bg }]}
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      <GlobalShell
        organizations={medicalContext?.organizations ?? []}
        activeProfileId={medicalContext?.active_profile_id ?? null}
        activeOrganizationId={medicalContext?.active_organization_id ?? null}
        onSelectProfile={handleProfileSelect}
        emergencyMode={emergencyMode}
        onToggleEmergency={handleEmergencyToggle}
        searchTerm={searchTerm}
        onChangeSearch={setSearchTerm}
        onSubmitSearch={handleSearchSubmit}
      />

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Healthcare organizations
        </Text>
        {contextLoading ? (
          <ActivityIndicator color={palette.primaryStrong} />
        ) : (medicalContext?.organizations ?? []).length === 0 ? (
          <Text style={{ color: palette.subtext }}>No organizations found.</Text>
        ) : (
          (medicalContext?.organizations ?? []).map((org: any) => (
            <View
              key={org.id}
              style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.surface }]}
            >
              <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                {org.name}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Type: {org.org_type}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Status: {org.status}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Profiles: {(org.profiles || []).length}
              </Text>
            </View>
          ))
        )}
      </View>

      <StaffConsole
        loading={staffLoading}
        staff={staffProfiles}
        profileId={medicalContext?.active_profile_id ?? null}
        updatingId={staffUpdateId}
        shiftLoadingId={staffShiftId}
        onUpdateRole={handleUpdateStaffRole}
        onAssignShift={handleAssignStaffShift}
      />

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Telemedicine sessions
          </Text>
          <Text style={{ color: palette.subtext }}>{teleSessions.length} sessions</Text>
        </View>
        {teleLoading ? (
          <ActivityIndicator color={palette.primaryStrong} />
        ) : teleSessions.length === 0 ? (
          <Text style={{ color: palette.subtext }}>No sessions scheduled yet.</Text>
        ) : (
          teleSessions.map((session) => (
            <View
              key={session.id}
              style={[
                styles.card,
                { borderColor: palette.divider, backgroundColor: palette.surface },
              ]}
            >
              <View style={styles.row}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  Session {session.id?.slice?.(-5) ?? ''}
                </Text>
                <Text style={{ color: palette.primaryStrong, fontWeight: '700' }}>
                  {session.status?.toUpperCase()}
                </Text>
              </View>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Patient: {session.patient || 'Unassigned'}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Clinician: {session.clinician || 'Unassigned'}
              </Text>
              <View style={styles.actionsRow}>
                {session.status === 'pending' ? (
                  <KISButton size="sm" variant="secondary" title="Start" onPress={() => handleSessionAction(session, 'start')} />
                ) : (
                  <KISButton size="sm" variant="outline" title="End" onPress={() => handleSessionAction(session, 'end')} />
                )}
              </View>
            </View>
          ))
        )}
        <View
          style={[
            styles.sessionForm,
            { borderColor: palette.divider, backgroundColor: palette.surface },
          ]}
        >
          <Text style={[styles.sectionTitle, { fontSize: 14, color: palette.text }]}>
            Schedule telemedicine session
          </Text>
          <Text style={{ color: palette.subtext, fontSize: 12 }}>
            Patient: {sessionPatientLabel}
          </Text>
          <TextInput
            value={sessionForm.scheduledAt}
            onChangeText={(value) => handleSessionFormChange('scheduledAt', value)}
            placeholder="Scheduled time (YYYY-MM-DDTHH:mm)"
            placeholderTextColor={palette.subtext}
            style={[
              styles.input,
              { backgroundColor: palette.card, borderColor: palette.divider },
            ]}
          />
          <TextInput
            value={sessionForm.notes}
            onChangeText={(value) => handleSessionFormChange('notes', value)}
            placeholder="Session notes / agenda"
            placeholderTextColor={palette.subtext}
            multiline
            style={[
              styles.input,
              styles.textArea,
              { backgroundColor: palette.card, borderColor: palette.divider },
            ]}
          />
          <KISButton
            title={sessionSubmitting ? 'Scheduling…' : 'Schedule session'}
            onPress={handleScheduleSession}
            disabled={sessionSubmitting}
          />
          {sessionMessage && (
            <Text style={{ color: palette.primaryStrong, fontSize: 12, marginTop: 6 }}>
              {sessionMessage}
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Care command center</Text>
          <KISButton
            title="Refresh overview"
            variant="outline"
            size="xs"
            onPress={loadCommandCenter}
            disabled={commandLoading}
          />
        </View>
        {commandLoading ? (
          <ActivityIndicator color={palette.primaryStrong} />
        ) : (
          <View style={{ gap: 6 }}>
            <Text style={{ color: palette.text }}>
              Pending tasks: {commandCenter?.pending_tasks ?? '—'}
            </Text>
            <Text style={{ color: palette.text }}>
              Active escalations: {commandCenter?.active_escalations ?? '—'}
            </Text>
            <Text style={{ color: palette.text }}>
              Open referrals: {commandCenter?.open_referrals ?? '—'}
            </Text>
            {commandCenter?.recent_triage?.length ? (
              <View
                style={{
                  borderWidth: 2,
                  borderColor: palette.divider,
                  borderRadius: 12,
                  padding: 8,
                }}
              >
                <Text style={{ color: palette.subtext, fontSize: 12 }}>Recent triage</Text>
                {(commandCenter?.recent_triage ?? []).slice(0, 2).map((record: any) => (
                  <Text key={record.id} style={{ color: palette.text, fontSize: 12 }}>
                    {record.patient} · {record.acuity_level}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Clinical tasks</Text>
        <View style={{ gap: 8 }}>
          {tasks.length === 0 ? (
            <Text style={{ color: palette.subtext }}>No active tasks yet.</Text>
          ) : (
            tasks.map((task) => (
              <View
                key={task.id}
                style={[
                  styles.listCard,
                  { borderColor: palette.divider, backgroundColor: palette.surface },
                ]}
              >
                <Text style={{ color: palette.text, fontWeight: '700' }}>{task.title}</Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>{task.description}</Text>
                <Text style={{ color: palette.subtext, fontSize: 11 }}>
                  Assigned to: {task.assigned_to || 'unassigned'}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 11 }}>
                  Priority: {task.priority} · Status: {task.status}
                </Text>
                {task.due_at && (
                  <Text style={{ color: palette.subtext, fontSize: 11 }}>
                    Due {new Date(task.due_at).toLocaleString()}
                  </Text>
                )}
                <KISButton
                  title="Mark completed"
                  size="xs"
                  variant="secondary"
                  onPress={() => handleCompleteTask(task.id)}
                  disabled={task.status === 'completed'}
                />
              </View>
            ))
          )}
        </View>
        <View style={[styles.formColumn, { marginTop: 12 }]}>
          <Text style={[styles.sectionTitle, { fontSize: 14, color: palette.text }]}>Create task</Text>
          <TextInput
            value={taskForm.title}
            onChangeText={(value) => handleTaskFormChange('title', value)}
            placeholder="Task title"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card }]}
          />
          <TextInput
            value={taskForm.description}
            onChangeText={(value) => handleTaskFormChange('description', value)}
            placeholder="Details"
            placeholderTextColor={palette.subtext}
            multiline
            style={[styles.input, styles.textArea, { backgroundColor: palette.card }]}
          />
          <Text style={{ color: palette.subtext, fontSize: 11 }}>Assign to</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 8, marginVertical: 4 }}>
            {staffProfiles.map((staff) => (
              <Pressable
                key={staff.id}
                onPress={() => handleAssignTaskToStaff(staff.user?.id ?? '')}
                style={[
                  styles.chip,
                  {
                    borderColor:
                      taskForm.assignedTo === staff.user?.id ? palette.primaryStrong : palette.divider,
                    backgroundColor:
                      taskForm.assignedTo === staff.user?.id ? palette.primarySoft : palette.surface,
                  },
                ]}
              >
                <Text style={{ color: palette.text, fontSize: 12 }}>
                  {staff.user?.display_name || staff.role}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput
            value={taskForm.dueAt}
            onChangeText={(value) => handleTaskFormChange('dueAt', value)}
            placeholder="Due (YYYY-MM-DDTHH:mm)"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card }]}
          />
          <TextInput
            value={taskForm.priority}
            onChangeText={(value) => handleTaskFormChange('priority', value)}
            placeholder="Priority (low/medium/high)"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card }]}
          />
          <KISButton
            title={taskSubmitting ? 'Creating…' : 'Add task'}
            onPress={handleCreateClinicalTask}
            disabled={taskSubmitting}
          />
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Emergency escalations</Text>
        <View style={{ gap: 8 }}>
          {escalations.length === 0 ? (
            <Text style={{ color: palette.subtext }}>No escalations yet.</Text>
          ) : (
            escalations.map((escalation) => (
              <View
                key={escalation.id}
                style={[
                  styles.listCard,
                  { borderColor: palette.divider, backgroundColor: palette.surface },
                ]}
              >
                <Text style={{ color: palette.text, fontWeight: '700' }}>{escalation.summary}</Text>
                <Text style={{ color: palette.subtext, fontSize: 11 }}>
                  Severity: {escalation.severity} · Status: {escalation.status}
                </Text>
                <KISButton
                  title="Resolve"
                  size="xs"
                  variant="outline"
                  onPress={() => handleResolveEscalation(escalation.id)}
                  disabled={escalation.status === 'resolved'}
                />
              </View>
            ))
          )}
        </View>
        <View style={[styles.formColumn, { marginTop: 12 }]}>
          <Text style={[styles.sectionTitle, { fontSize: 14, color: palette.text }]}>
            Log escalation
          </Text>
          <Text style={{ color: palette.subtext, fontSize: 11 }}>Severity</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 6, marginBottom: 6 }}>
            {['low', 'medium', 'high', 'critical'].map((level) => (
              <Pressable
                key={level}
                onPress={() => handleEscalationFormChange('severity', level)}
                style={[
                  styles.chip,
                  {
                    borderColor: escalationForm.severity === level ? palette.primaryStrong : palette.divider,
                    backgroundColor:
                      escalationForm.severity === level ? palette.primarySoft : palette.surface,
                  },
                ]}
              >
                <Text style={{ color: palette.text, fontSize: 12 }}>{level}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput
            value={escalationForm.summary}
            onChangeText={(value) => handleEscalationFormChange('summary', value)}
            placeholder="Describe the situation"
            placeholderTextColor={palette.subtext}
            multiline
            style={[styles.input, styles.textArea, { backgroundColor: palette.card }]}
          />
          <KISButton
            title={escalationSubmitting ? 'Logging…' : 'Create escalation'}
            onPress={handleCreateEscalation}
            disabled={escalationSubmitting}
          />
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Referral routing</Text>
        <View style={{ gap: 6 }}>
          {referrals.length === 0 ? (
            <Text style={{ color: palette.subtext }}>No referrals yet.</Text>
          ) : (
            referrals.map((referral) => (
              <View
                key={referral.id}
                style={[
                  styles.listCard,
                  { borderColor: palette.divider, backgroundColor: palette.surface },
                ]}
              >
                <Text style={{ color: palette.text, fontWeight: '700' }}>{referral.reason}</Text>
                <Text style={{ color: palette.subtext, fontSize: 11 }}>
                  Status: {referral.status}
                </Text>
                {referral.metadata?.to_org_name ? (
                  <Text style={{ color: palette.subtext, fontSize: 11 }}>
                    Destination: {referral.metadata?.to_org_name}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
        <View style={[styles.formColumn, { marginTop: 12 }]}>
          <Text style={[styles.sectionTitle, { fontSize: 14, color: palette.text }]}>
            Create referral
          </Text>
          <TextInput
            value={referralForm.toOrganization}
            onChangeText={(value) => handleReferralFormChange('toOrganization', value)}
            placeholder="Referred to (name)"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card }]}
          />
          <TextInput
            value={referralForm.reason}
            onChangeText={(value) => handleReferralFormChange('reason', value)}
            placeholder="Reason for referral"
            placeholderTextColor={palette.subtext}
            multiline
            style={[styles.input, styles.textArea, { backgroundColor: palette.card }]}
          />
          <KISButton
            title={referralSubmitting ? 'Creating…' : 'Add referral'}
            onPress={handleCreateReferral}
            disabled={referralSubmitting}
          />
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Clinical event log</Text>
        <View style={{ gap: 8 }}>
          {eventsLoading ? (
            <ActivityIndicator color={palette.primaryStrong} />
          ) : events.length === 0 ? (
            <Text style={{ color: palette.subtext }}>No clinical events recorded yet.</Text>
          ) : (
            events.slice(0, 4).map((event) => (
              <View
                key={event.id}
                style={[
                  styles.listCard,
                  {
                    borderColor: palette.divider,
                    backgroundColor: palette.surface,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontWeight: '700' }}>{event.event_type}</Text>
                  <Text style={{ color: palette.subtext, fontSize: 11 }}>{event.description}</Text>
                </View>
                <Text style={{ color: palette.subtext, fontSize: 10 }}>
                  {new Date(event.created_at).toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Telehealth triage automation
        </Text>
        <Text style={{ color: palette.subtext, marginBottom: 6 }}>
          Run triage and persist the response in the clinical log.
        </Text>
        <TextInput
          value={triageForm.symptoms}
          onChangeText={(value) => setTriageForm((prev) => ({ ...prev, symptoms: value }))}
          placeholder="Symptoms, comma separated"
          placeholderTextColor={palette.subtext}
          style={[styles.input, styles.textArea, { backgroundColor: palette.card }]}
        />
        <KISButton
          title={triageSubmitting ? 'Running…' : 'Run triage'}
          onPress={handleRunTriage}
          disabled={triageSubmitting}
        />
        {triageResult && (
          <View style={[styles.resultBox, { borderColor: palette.divider }]}>
            <Text style={{ color: palette.text, fontSize: 12 }} selectable>
              {triageResult}
            </Text>
          </View>
        )}
        {triageRecords.length > 0 && (
          <View style={{ marginTop: 8, gap: 6 }}>
            {triageRecords.slice(0, 3).map((record: any) => (
              <View
                key={record.id}
                style={[
                  styles.listCard,
                  { borderColor: palette.divider, backgroundColor: palette.surface },
                ]}
              >
                <Text style={{ color: palette.text, fontWeight: '700' }}>{record.acuity_level}</Text>
                <Text style={{ color: palette.subtext, fontSize: 11 }}>
                  {(record.symptoms || []).join(', ')}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Create patient record</Text>
        <Text style={{ color: palette.subtext, marginBottom: 8 }}>
          Add a new person to the master index and connect them to the active medical profile.
        </Text>
        <View style={styles.formGrid}>
          <TextInput
            value={patientForm.mrn}
            onChangeText={(value) => setPatientForm((prev) => ({ ...prev, mrn: value }))}
            placeholder="MRN"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.surface }]}
          />
          <TextInput
            value={patientForm.first_name}
            onChangeText={(value) => setPatientForm((prev) => ({ ...prev, first_name: value }))}
            placeholder="First name"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.surface }]}
          />
          <TextInput
            value={patientForm.last_name}
            onChangeText={(value) => setPatientForm((prev) => ({ ...prev, last_name: value }))}
            placeholder="Last name"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.surface }]}
          />
          <TextInput
            value={patientForm.dob}
            onChangeText={(value) => setPatientForm((prev) => ({ ...prev, dob: value }))}
            placeholder="DOB (YYYY-MM-DD)"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.surface }]}
          />
          <TextInput
            value={patientForm.gender}
            onChangeText={(value) => setPatientForm((prev) => ({ ...prev, gender: value }))}
            placeholder="Gender"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.surface }]}
          />
          <TextInput
            value={patientForm.status}
            onChangeText={(value) => setPatientForm((prev) => ({ ...prev, status: value }))}
            placeholder="Status"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.surface }]}
          />
        </View>
        <KISButton
          title={patientSaving ? 'Saving…' : 'Create patient'}
          onPress={handleCreatePatient}
          disabled={patientSaving}
        />
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Patients</Text>
          <Text style={{ color: palette.subtext }}>{patientCount} records</Text>
        </View>
        <Text style={{ color: palette.subtext, marginBottom: 10 }}>
          Master index entries available for triage and clinical workflows.
        </Text>
        {loading && <ActivityIndicator color={palette.primaryStrong} />}
        <KISButton
          title="Refresh patient list"
          variant="outline"
          size="sm"
          onPress={() => loadPatientRecords(searchTerm)}
        />
        <ScrollView style={{ maxHeight: 240, marginTop: 12 }}>
          {patients.length === 0 ? (
            <Text style={{ color: palette.subtext }}>No patients matched your search yet.</Text>
          ) : (
            patients.map((patient) => (
              <Pressable
                key={patient.id}
                onPress={() => handleSelectPatient(patient.id)}
                style={[
                  styles.patientRow,
                  {
                    borderColor:
                      patientDetail?.id === patient.id ? palette.primary : palette.divider,
                    backgroundColor:
                      patientDetail?.id === patient.id ? palette.primarySoft : palette.surface,
                  },
                ]}
              >
                <Text style={{ color: palette.text, fontWeight: '900' }}>
                  {patient.last_name}, {patient.first_name}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  MRN: {patient.mrn} · Status: {patient.status}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
        {patientDetailLoading && <ActivityIndicator color={palette.primaryStrong} />}
        {patientDetail && (
          <View style={[styles.patientDetail, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 14 }}>Family profiles</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginVertical: 8 }}>
              {(patientDetail.family_profiles || []).map((family: any) => (
                <View key={family.id} style={[styles.familyCard, { borderColor: palette.divider }]}>
                  <Text style={{ color: palette.text, fontWeight: '900' }}>{family.relationship}</Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    {Array.isArray(family.members) ? family.members.length : 0} members
                  </Text>
                  {!!family.notes && (
                    <Text style={{ color: palette.subtext, fontSize: 11 }}>{family.notes}</Text>
                  )}
                </View>
              ))}
            </ScrollView>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 14 }}>Consents</Text>
            <View style={{ gap: 6, marginTop: 6 }}>
              {(patientDetail.consents || []).map((consent: any) => {
                const expires = consent.expires_at ? new Date(consent.expires_at) : null;
                const isActive = !expires || expires > new Date();
                return (
                  <View key={consent.id} style={[styles.consentRow, { borderColor: palette.divider }]}>
                    <Text style={{ color: palette.text, fontWeight: '700' }}>{consent.purpose}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 11 }}>
                      Granted by {consent.granted_by || 'unknown'} · {new Date(consent.granted_at).toLocaleDateString()}
                    </Text>
                    <Text
                      style={{
                        color: isActive ? palette.primaryStrong : palette.danger,
                        fontWeight: '900',
                        fontSize: 12,
                      }}
                    >
                      {consent.expires_at ? `Expires ${new Date(consent.expires_at).toLocaleDateString()}` : 'No expiry'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
        {patientDetail && (
          <View style={[styles.formGrid, { marginTop: 16 }]}>
            <View style={[styles.formColumn, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
              <Text style={[styles.sectionTitle, { fontSize: 14, color: palette.text }]}>Add family profile</Text>
              <TextInput
                value={familyForm.relationship}
                onChangeText={(value) => setFamilyForm((prev) => ({ ...prev, relationship: value }))}
                placeholder="Relationship"
                placeholderTextColor={palette.subtext}
                style={[styles.input, { backgroundColor: palette.card }]}
              />
              <TextInput
                value={familyForm.members}
                onChangeText={(value) => setFamilyForm((prev) => ({ ...prev, members: value }))}
                placeholder="Members (comma separated)"
                placeholderTextColor={palette.subtext}
                style={[styles.input, { backgroundColor: palette.card }]}
              />
              <TextInput
                value={familyForm.notes}
                onChangeText={(value) => setFamilyForm((prev) => ({ ...prev, notes: value }))}
                placeholder="Notes"
                placeholderTextColor={palette.subtext}
                multiline
                style={[styles.input, styles.textArea, { backgroundColor: palette.card }]}
              />
              <KISButton
                title={familySaving ? 'Saving…' : 'Save family'}
                onPress={handleCreateFamilyProfile}
                size="sm"
                disabled={familySaving}
              />
            </View>
            <View style={[styles.formColumn, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
              <Text style={[styles.sectionTitle, { fontSize: 14, color: palette.text }]}>Add consent</Text>
              <TextInput
                value={consentForm.purpose}
                onChangeText={(value) => setConsentForm((prev) => ({ ...prev, purpose: value }))}
                placeholder="Purpose"
                placeholderTextColor={palette.subtext}
                style={[styles.input, { backgroundColor: palette.card }]}
              />
              <TextInput
                value={consentForm.consent_text}
                onChangeText={(value) => setConsentForm((prev) => ({ ...prev, consent_text: value }))}
                placeholder="Consent text"
                placeholderTextColor={palette.subtext}
                multiline
                style={[styles.input, styles.textArea, { backgroundColor: palette.card }]}
              />
              <TextInput
                value={consentForm.expires_at}
                onChangeText={(value) => setConsentForm((prev) => ({ ...prev, expires_at: value }))}
                placeholder="Expires at (YYYY-MM-DD)"
                placeholderTextColor={palette.subtext}
                style={[styles.input, { backgroundColor: palette.card }]}
              />
              <KISButton
                title={consentSaving ? 'Saving…' : 'Save consent'}
                onPress={handleCreateConsentRecord}
                size="sm"
                disabled={consentSaving}
              />
            </View>
          </View>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Clinical timeline</Text>
          <Text style={{ color: palette.subtext }}>{timelineEntries.length} events</Text>
        </View>
        <View style={styles.timelineContainer}>
          <View style={[styles.timelineColumn, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
            {timelineLoading ? (
              <ActivityIndicator color={palette.primaryStrong} />
            ) : timelineEntries.length === 0 ? (
              <Text style={{ color: palette.subtext }}>No timeline events yet.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 220 }}>
                {timelineEntries.map((entry) => (
                  <Pressable
                    key={entry.id}
                    style={[styles.timelineEntry, { borderColor: palette.divider }]}
                  >
                    <Text style={[styles.timelineLabel, { color: palette.text }]}>{entry.label}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>{entry.summary}</Text>
                    <Text style={[styles.timelineTime, { color: palette.subtext }]}>
                      {new Date(entry.timestamp).toLocaleString()}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
          <View style={[styles.timelineFocusPanel, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
            <Text style={{ color: palette.text, fontWeight: '900', marginBottom: 6 }}>Clinical focus</Text>
            <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 10 }}>
              Use timeline events, triage records, and task status to decide next actions.
            </Text>
            {triageRecords.length > 0 ? (
              <View style={[styles.resultBox, { borderColor: palette.divider, marginBottom: 6 }]}>
                <Text style={{ color: palette.text, fontSize: 12 }} selectable>
                  Latest triage: {triageRecords[0]?.acuity_level || 'n/a'}{'\n'}
                  Recommended unit: {triageRecords[0]?.recommended_unit || 'Not specified'}
                </Text>
              </View>
            ) : (
              <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 6 }}>
                No triage summary available yet for this patient.
              </Text>
            )}
            <KISButton title="Run triage" onPress={handleRunTriage} disabled={triageSubmitting} size="sm" />
          </View>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Orders & vitals</Text>
        <View style={styles.formGrid}>
          <View style={[styles.formColumn, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            <Text style={{ color: palette.text, fontWeight: '900' }}>Medication order</Text>
            <TextInput
              value={medOrderForm.drug_name}
              onChangeText={(value) => setMedOrderForm((prev) => ({ ...prev, drug_name: value }))}
              placeholder="Drug name"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { backgroundColor: palette.card }]}
            />
            <TextInput
              value={medOrderForm.dosage}
              onChangeText={(value) => setMedOrderForm((prev) => ({ ...prev, dosage: value }))}
              placeholder="Dosage instructions"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { backgroundColor: palette.card }]}
            />
            <TextInput
              value={medOrderForm.route}
              onChangeText={(value) => setMedOrderForm((prev) => ({ ...prev, route: value }))}
              placeholder="Route"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { backgroundColor: palette.card }]}
            />
            <TextInput
              value={medOrderForm.frequency}
              onChangeText={(value) => setMedOrderForm((prev) => ({ ...prev, frequency: value }))}
              placeholder="Frequency"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { backgroundColor: palette.card }]}
            />
            <TextInput
              value={medOrderForm.notes}
              onChangeText={(value) => setMedOrderForm((prev) => ({ ...prev, notes: value }))}
              placeholder="Notes"
              placeholderTextColor={palette.subtext}
              multiline
              style={[styles.input, styles.textArea, { backgroundColor: palette.card }]}
            />
            <KISButton
              title={medSubmitting ? 'Sending…' : 'Add order'}
              onPress={handleCreateMedicationOrder}
              size="sm"
              disabled={medSubmitting}
            />
          </View>
          <View style={[styles.formColumn, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            <Text style={{ color: palette.text, fontWeight: '900' }}>Vital signs</Text>
            <TextInput
              value={vitalForm.vital_type}
              onChangeText={(value) => setVitalForm((prev) => ({ ...prev, vital_type: value }))}
              placeholder="Vital type (e.g. BP)"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { backgroundColor: palette.card }]}
            />
            <TextInput
              value={vitalForm.value}
              onChangeText={(value) => setVitalForm((prev) => ({ ...prev, value: value }))}
              placeholder="Value"
              placeholderTextColor={palette.subtext}
              keyboardType="numeric"
              style={[styles.input, { backgroundColor: palette.card }]}
            />
            <TextInput
              value={vitalForm.units}
              onChangeText={(value) => setVitalForm((prev) => ({ ...prev, units: value }))}
              placeholder="Units"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { backgroundColor: palette.card }]}
            />
            <TextInput
              value={vitalForm.notes}
              onChangeText={(value) => setVitalForm((prev) => ({ ...prev, notes: value }))}
              placeholder="Notes"
              placeholderTextColor={palette.subtext}
              multiline
              style={[styles.input, styles.textArea, { backgroundColor: palette.card }]}
            />
            <KISButton
              title={vitalSubmitting ? 'Sending…' : 'Log vital'}
              onPress={handleCreateVitalSign}
              size="sm"
              disabled={vitalSubmitting}
            />
          </View>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Clinical triage snapshot</Text>
        <Text style={{ color: palette.subtext, marginBottom: 8 }}>
          Review the latest saved triage output for quick handoff decisions.
        </Text>
        {triageResult ? (
          <View style={[styles.resultBox, { borderColor: palette.divider }]}>
            <Text style={{ color: palette.text, fontSize: 12 }} selectable>
              {triageResult}
            </Text>
          </View>
        ) : (
          <Text style={{ color: palette.subtext, fontSize: 12 }}>
            Run triage to review a symptom set.
          </Text>
        )}
        <KISButton
          title={triageSubmitting ? 'Running…' : 'Run triage check'}
          onPress={handleRunTriage}
          disabled={triageSubmitting}
        />
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Clinical analytics & population health</Text>
          <KISButton
            title="Refresh reports"
            size="xs"
            variant="outline"
            onPress={handleRefreshAnalyticsReports}
            disabled={analyticsLoading}
          />
        </View>
        {analyticsLoading ? (
          <ActivityIndicator color={palette.primaryStrong} />
        ) : (
          <View style={{ gap: 8 }}>
            {(analyticsReports || []).map((report) => (
              <View
                key={report.id}
                style={[styles.timelineEntry, { borderColor: palette.divider, backgroundColor: palette.surface }]}
              >
                <Text style={[styles.timelineLabel, { color: palette.text }]}>
                  {report.report_type.replace('_', ' ')} · {report.status}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }} numberOfLines={2}>
                  {report.summary || 'No summary yet.'}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 11 }}>
                  Period: {report.period_start} → {report.period_end}
                </Text>
                {report.metrics && (
                  <Text style={{ color: palette.subtext, fontSize: 11 }}>
                    Metrics: {JSON.stringify(report.metrics)}
                  </Text>
                )}
              </View>
            ))}
            {(analyticsReports || []).length === 0 && (
              <Text style={{ color: palette.subtext, fontSize: 12 }}>No analytics reports yet.</Text>
            )}
          </View>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Risk stratification & outcomes</Text>
          <KISButton
            title="Compute risk"
            size="xs"
            variant="secondary"
            onPress={handleComputeRisk}
            disabled={riskLoading}
          />
        </View>
        <View style={{ gap: 6 }}>
          {(riskAssessments || []).map((row) => (
            <View
              key={row.id}
              style={[styles.timelineEntry, { borderColor: palette.divider, backgroundColor: palette.surface }]}
            >
              <Text style={[styles.timelineLabel, { color: palette.text }]}>
                {row.patient} · {row.level}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 11 }}>
                Score: {row.score} · Updated: {row.assessed_at}
              </Text>
            </View>
          ))}
          {(riskAssessments || []).length === 0 && (
            <Text style={{ color: palette.subtext, fontSize: 12 }}>No risk assessments yet.</Text>
          )}
        </View>
        <View style={styles.formGrid}>
          <Text style={[styles.sectionTitle, { fontSize: 14, color: palette.text }]}>Record outcome benchmark</Text>
          <TextInput
            value={outcomeForm.metric_name}
            onChangeText={(value) => setOutcomeForm((prev) => ({ ...prev, metric_name: value }))}
            placeholder="Metric name"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.divider }]}
          />
          <View style={[styles.row, { gap: 8 }]}>
            <TextInput
              value={outcomeForm.actual_value}
              onChangeText={(value) => setOutcomeForm((prev) => ({ ...prev, actual_value: value }))}
              placeholder="Actual value"
              placeholderTextColor={palette.subtext}
              keyboardType="numeric"
              style={[styles.input, { flex: 1, backgroundColor: palette.surface, borderColor: palette.divider }]}
            />
            <TextInput
              value={outcomeForm.target_value}
              onChangeText={(value) => setOutcomeForm((prev) => ({ ...prev, target_value: value }))}
              placeholder="Target value"
              placeholderTextColor={palette.subtext}
              keyboardType="numeric"
              style={[styles.input, { flex: 1, backgroundColor: palette.surface, borderColor: palette.divider }]}
            />
          </View>
          <View style={[styles.row, { gap: 8 }]}>
            <TextInput
              value={outcomeForm.period_start}
              onChangeText={(value) => setOutcomeForm((prev) => ({ ...prev, period_start: value }))}
              placeholder="Period start"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { flex: 1, backgroundColor: palette.surface, borderColor: palette.divider }]}
            />
            <TextInput
              value={outcomeForm.period_end}
              onChangeText={(value) => setOutcomeForm((prev) => ({ ...prev, period_end: value }))}
              placeholder="Period end"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { flex: 1, backgroundColor: palette.surface, borderColor: palette.divider }]}
            />
          </View>
          <TextInput
            value={outcomeForm.notes}
            onChangeText={(value) => setOutcomeForm((prev) => ({ ...prev, notes: value }))}
            placeholder="Notes"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.divider }]}
          />
          <KISButton title="Save benchmark" onPress={handleCreateOutcomeBenchmark} size="sm" />
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Patient satisfaction & outreach</Text>
        <View style={{ gap: 8 }}>
          {(satisfactionScores || []).slice(0, 3).map((score) => (
            <View
              key={score.id}
              style={[styles.timelineEntry, { borderColor: palette.divider, backgroundColor: palette.surface }]}
            >
              <Text style={[styles.timelineLabel, { color: palette.text }]}>
                {score.patient} · {score.score}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 11 }}>
                Channel: {score.channel} · {score.recorded_at}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.formGrid}>
          <TextInput
            value={satisfactionForm.score}
            onChangeText={(value) => setSatisfactionForm((prev) => ({ ...prev, score: value }))}
            placeholder="Score (1-10)"
            placeholderTextColor={palette.subtext}
            keyboardType="numeric"
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <TextInput
            value={satisfactionForm.channel}
            onChangeText={(value) => setSatisfactionForm((prev) => ({ ...prev, channel: value }))}
            placeholder="Channel"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <TextInput
            value={satisfactionForm.comments}
            onChangeText={(value) => setSatisfactionForm((prev) => ({ ...prev, comments: value }))}
            placeholder="Comments"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <KISButton title="Record satisfaction" onPress={handleRecordSatisfactionScore} size="sm" />
        </View>
        <View style={[styles.formGrid, { marginTop: 12 }]}>
          <TextInput
            value={outreachForm.name}
            onChangeText={(value) => setOutreachForm((prev) => ({ ...prev, name: value }))}
            placeholder="Campaign name"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <TextInput
            value={outreachForm.channel}
            onChangeText={(value) => setOutreachForm((prev) => ({ ...prev, channel: value }))}
            placeholder="Channel"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <TextInput
            value={outreachForm.target_population}
            onChangeText={(value) => setOutreachForm((prev) => ({ ...prev, target_population: value }))}
            placeholder="Target population (JSON)"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <TextInput
            value={outreachForm.status}
            onChangeText={(value) => setOutreachForm((prev) => ({ ...prev, status: value }))}
            placeholder="Status"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <KISButton title="Create outreach" onPress={handleCreateOutreachCampaign} size="sm" />
        </View>
        <View style={{ gap: 6, marginTop: 8 }}>
          {(outreachCampaigns || []).map((campaign) => (
            <View
              key={campaign.id}
              style={[styles.timelineEntry, { borderColor: palette.divider, backgroundColor: palette.surface }]}
            >
              <Text style={[styles.timelineLabel, { color: palette.text }]}>
                {campaign.name} · {campaign.status}
              </Text>
              <View style={styles.actionsRow}>
                <KISButton
                  title="Set active"
                  size="xs"
                  variant="outline"
                  onPress={() => handleUpdateCampaignStatus(campaign.id, 'active')}
                />
                <KISButton
                  title="Complete"
                  size="xs"
                  variant="secondary"
                  onPress={() => handleUpdateCampaignStatus(campaign.id, 'completed')}
                />
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Wellness challenges & habit tracking</Text>
        <View style={{ gap: 6 }}>
          {(wellnessChallenges || []).map((challenge) => (
            <View
              key={challenge.id}
              style={[styles.timelineEntry, { borderColor: palette.divider, backgroundColor: palette.surface }]}
            >
              <Text style={[styles.timelineLabel, { color: palette.text }]}>
                {challenge.title} · {challenge.goal}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 11 }}>
                {challenge.start_date} → {challenge.end_date}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.formGrid}>
          <TextInput
            value={challengeForm.title}
            onChangeText={(value) => setChallengeForm((prev) => ({ ...prev, title: value }))}
            placeholder="Challenge title"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <TextInput
            value={challengeForm.goal}
            onChangeText={(value) => setChallengeForm((prev) => ({ ...prev, goal: value }))}
            placeholder="Goal"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <View style={[styles.row, { gap: 8 }]}>
            <TextInput
              value={challengeForm.start_date}
              onChangeText={(value) => setChallengeForm((prev) => ({ ...prev, start_date: value }))}
              placeholder="Start date"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { flex: 1, backgroundColor: palette.card, borderColor: palette.divider }]}
            />
            <TextInput
              value={challengeForm.end_date}
              onChangeText={(value) => setChallengeForm((prev) => ({ ...prev, end_date: value }))}
              placeholder="End date"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { flex: 1, backgroundColor: palette.card, borderColor: palette.divider }]}
            />
          </View>
          <TextInput
            value={challengeForm.description}
            onChangeText={(value) => setChallengeForm((prev) => ({ ...prev, description: value }))}
            placeholder="Description"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <TextInput
            value={challengeForm.participation_target}
            onChangeText={(value) => setChallengeForm((prev) => ({ ...prev, participation_target: value }))}
            placeholder="Participation target"
            placeholderTextColor={palette.subtext}
            keyboardType="numeric"
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <KISButton title="Add challenge" onPress={handleCreateWellnessChallenge} size="sm" />
        </View>
        <View style={[styles.formGrid, { marginTop: 12 }]}>
          <TextInput
            value={habitForm.challengeId}
            onChangeText={(value) => setHabitForm((prev) => ({ ...prev, challengeId: value }))}
            placeholder="Challenge ID"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <TextInput
            value={habitForm.habit_name}
            onChangeText={(value) => setHabitForm((prev) => ({ ...prev, habit_name: value }))}
            placeholder="Habit name"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <TextInput
            value={habitForm.progress_value}
            onChangeText={(value) => setHabitForm((prev) => ({ ...prev, progress_value: value }))}
            placeholder="Progress value"
            placeholderTextColor={palette.subtext}
            keyboardType="numeric"
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <TextInput
            value={habitForm.notes}
            onChangeText={(value) => setHabitForm((prev) => ({ ...prev, notes: value }))}
            placeholder="Notes"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <KISButton title="Log habit" onPress={handleLogHabitEntry} size="sm" />
        </View>
        <View style={{ gap: 6, marginTop: 8 }}>
          {(habitEntries || []).map((entry) => (
            <View
              key={entry.id}
              style={[styles.timelineEntry, { borderColor: palette.divider, backgroundColor: palette.surface }]}
            >
              <Text style={[styles.timelineLabel, { color: palette.text }]}>
                {entry.habit_name} · {entry.progress_value}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 11 }}>
                Logged at: {entry.logged_at}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Inventory & diagnostics</Text>
        {inventoryLoading ? (
          <ActivityIndicator color={palette.primaryStrong} />
        ) : (
          <View style={{ gap: 6 }}>
            {(inventoryItems || []).map((item) => (
              <View
                key={item.id}
                style={[styles.timelineEntry, { borderColor: palette.divider, backgroundColor: palette.surface }]}
              >
                <Text style={[styles.timelineLabel, { color: palette.text }]}>{item.name}</Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  Qty: {item.quantity_on_hand} {item.unit} · Reorder {item.reorder_level}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 11 }}>
                  Category: {item.category || '—'}
                </Text>
              </View>
            ))}
            {(inventoryItems || []).length === 0 && (
              <Text style={{ color: palette.subtext }}>No inventory items tracked yet.</Text>
            )}
          </View>
        )}
        <View style={[styles.formGrid, { flexDirection: 'column' }]}>
          <TextInput
            value={inventoryForm.name}
            onChangeText={(value) => setInventoryForm((prev) => ({ ...prev, name: value }))}
            placeholder="Item name"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.divider }]}
          />
          <TextInput
            value={inventoryForm.category}
            onChangeText={(value) => setInventoryForm((prev) => ({ ...prev, category: value }))}
            placeholder="Category"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.divider }]}
          />
          <TextInput
            value={inventoryForm.sku}
            onChangeText={(value) => setInventoryForm((prev) => ({ ...prev, sku: value }))}
            placeholder="SKU"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.divider }]}
          />
          <TextInput
            value={inventoryForm.unit}
            onChangeText={(value) => setInventoryForm((prev) => ({ ...prev, unit: value }))}
            placeholder="Unit (e.g. doses)"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.divider }]}
          />
          <View style={[styles.row, { gap: 8 }]}>
            <TextInput
              value={inventoryForm.quantity_on_hand}
              onChangeText={(value) => setInventoryForm((prev) => ({ ...prev, quantity_on_hand: value }))}
              placeholder="Quantity"
              placeholderTextColor={palette.subtext}
              keyboardType="numeric"
              style={[styles.input, { flex: 1, backgroundColor: palette.surface, borderColor: palette.divider }]}
            />
            <TextInput
              value={inventoryForm.reorder_level}
              onChangeText={(value) => setInventoryForm((prev) => ({ ...prev, reorder_level: value }))}
              placeholder="Reorder level"
              placeholderTextColor={palette.subtext}
              keyboardType="numeric"
              style={[styles.input, { flex: 1, backgroundColor: palette.surface, borderColor: palette.divider }]}
            />
          </View>
          <KISButton
            title="Add inventory item"
            onPress={handleCreateInventoryItem}
            disabled={inventoryLoading}
          />
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Diagnostics & imaging</Text>
        <View style={{ gap: 10 }}>
          <Text style={{ color: palette.subtext, fontSize: 12 }}>Pending orders</Text>
          {(diagnosticOrders || []).map((order) => (
            <View
              key={order.id}
              style={[styles.timelineEntry, { borderColor: palette.divider, backgroundColor: palette.surface }]}
            >
              <Text style={[styles.timelineLabel, { color: palette.text }]}>
                {order.test_name} · {order.status}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 11 }}>
                Requested: {order.created_at}
              </Text>
            </View>
          ))}
          {(diagnosticOrders || []).length === 0 && (
            <Text style={{ color: palette.subtext, fontSize: 12 }}>No diagnostic orders yet.</Text>
          )}
          {(imagingStudies || []).map((study) => (
            <View
              key={study.id}
              style={[styles.timelineEntry, { borderColor: palette.divider, backgroundColor: palette.surface }]}
            >
              <Text style={[styles.timelineLabel, { color: palette.text }]}>
                {study.modality} · {study.status}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 11 }}>
                Region: {study.body_region || 'Unknown'} · Scheduled: {study.scheduled_at || 'TBD'}
              </Text>
            </View>
          ))}
          {(imagingStudies || []).length === 0 && (
            <Text style={{ color: palette.subtext, fontSize: 12 }}>No imaging studies scheduled.</Text>
          )}
        </View>
        <View style={styles.formGrid}>
          <TextInput
            value={diagnosticForm.test_name}
            onChangeText={(value) => setDiagnosticForm((prev) => ({ ...prev, test_name: value }))}
            placeholder="New diagnostic test name"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <TextInput
            value={diagnosticForm.specimen_collected_at}
            onChangeText={(value) => setDiagnosticForm((prev) => ({ ...prev, specimen_collected_at: value }))}
            placeholder="Specimen collected at (ISO)"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <KISButton title="Order diagnostics" onPress={handleCreateDiagnosticOrder} size="sm" />
          <TextInput
            value={imagingForm.modality}
            onChangeText={(value) => setImagingForm((prev) => ({ ...prev, modality: value }))}
            placeholder="Imaging modality (MRI/CT)"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <TextInput
            value={imagingForm.body_region}
            onChangeText={(value) => setImagingForm((prev) => ({ ...prev, body_region: value }))}
            placeholder="Body region"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <TextInput
            value={imagingForm.scheduled_at}
            onChangeText={(value) => setImagingForm((prev) => ({ ...prev, scheduled_at: value }))}
            placeholder="Scheduled ISO timestamp"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <KISButton title="Schedule imaging" onPress={handleCreateImagingStudy} size="sm" />
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Medication adherence</Text>
        {remindersLoading ? (
          <ActivityIndicator color={palette.primaryStrong} />
        ) : (
          <View style={{ gap: 6 }}>
            {(adherenceReminders || []).map((reminder) => (
              <View
                key={reminder.id}
                style={[styles.timelineEntry, { borderColor: palette.divider, backgroundColor: palette.surface }]}
              >
                <Text style={[styles.timelineLabel, { color: palette.text }]}>
                  {reminder.channel} reminder · {reminder.status}
                </Text>
                <View style={styles.actionsRow}>
                  <KISButton
                    title="Mark sent"
                    size="xs"
                    variant="outline"
                    onPress={() => handleSendReminderNow(reminder.id)}
                  />
                  <KISButton
                    title="Acknowledge"
                    size="xs"
                    variant="secondary"
                    onPress={() => handleAcknowledgeReminder(reminder.id)}
                  />
                </View>
              </View>
            ))}
            {(adherenceReminders || []).length === 0 && (
              <Text style={{ color: palette.subtext, fontSize: 12 }}>No reminders scheduled.</Text>
            )}
          </View>
        )}
        <View style={styles.formGrid}>
          <TextInput
            value={reminderForm.scheduled_at}
            onChangeText={(value) => setReminderForm((prev) => ({ ...prev, scheduled_at: value }))}
            placeholder="Scheduled time (YYYY-MM-DDTHH:mm)"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <TextInput
            value={reminderForm.channel}
            onChangeText={(value) => setReminderForm((prev) => ({ ...prev, channel: value }))}
            placeholder="Channel (sms/email)"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <TextInput
            value={reminderForm.notes}
            onChangeText={(value) => setReminderForm((prev) => ({ ...prev, notes: value }))}
            placeholder="Notes"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <KISButton title="Create reminder" onPress={handleCreateAdherenceReminder} size="sm" />
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Supply forecasting</Text>
        {forecastLoading ? (
          <ActivityIndicator color={palette.primaryStrong} />
        ) : (
          <View style={{ gap: 6 }}>
            {(supplyForecasts || []).map((forecast) => (
              <View
                key={forecast.id}
                style={[styles.timelineEntry, { borderColor: palette.divider, backgroundColor: palette.surface }]}
              >
                <Text style={[styles.timelineLabel, { color: palette.text }]}>
                  {forecast.category} · {forecast.period_start} → {forecast.period_end}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 11 }}>
                  Predicted usage: {forecast.predicted_usage}
                </Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.formGrid}>
          <TextInput
            value={forecastForm.category}
            onChangeText={(value) => setForecastForm((prev) => ({ ...prev, category: value }))}
            placeholder="Category (e.g. PPE)"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <View style={[styles.row, { gap: 8 }]}>
            <TextInput
              value={forecastForm.period_start}
              onChangeText={(value) => setForecastForm((prev) => ({ ...prev, period_start: value }))}
              placeholder="Period start"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { flex: 1, backgroundColor: palette.card, borderColor: palette.divider }]}
            />
            <TextInput
              value={forecastForm.period_end}
              onChangeText={(value) => setForecastForm((prev) => ({ ...prev, period_end: value }))}
              placeholder="Period end"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { flex: 1, backgroundColor: palette.card, borderColor: palette.divider }]}
            />
          </View>
          <TextInput
            value={forecastForm.predicted_usage}
            onChangeText={(value) => setForecastForm((prev) => ({ ...prev, predicted_usage: value }))}
            placeholder="Predicted usage"
            placeholderTextColor={palette.subtext}
            keyboardType="numeric"
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider }]}
          />
          <KISButton title="Save forecast" onPress={handleCreateSupplyForecast} size="sm" />
        </View>
      </View>
    </ScrollView>
  );
}

const makeStyles = (tokens: typeof KIS_TOKENS) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    section: {
      borderWidth: 2,
      borderRadius: tokens.radius.xl,
      padding: tokens.spacing.lg,
      marginHorizontal: tokens.spacing.lg,
      marginTop: tokens.spacing.md,
      gap: tokens.spacing.sm,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '900',
    },
    sectionHeading: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    card: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
      marginVertical: tokens.spacing.xs,
    },
    cardTitle: {
      fontWeight: '900',
      fontSize: 14,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sessionForm: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
      marginTop: tokens.spacing.sm,
      gap: tokens.spacing.xs,
    },
    resultBox: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
      marginBottom: tokens.spacing.sm,
    },
    actionsRow: {
      flexDirection: 'row',
      marginTop: tokens.spacing.sm,
    },
    patientRow: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
      marginBottom: tokens.spacing.xs,
    },
    patientDetail: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
      marginTop: tokens.spacing.sm,
      gap: tokens.spacing.sm,
    },
    familyCard: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
      minWidth: 140,
    },
    consentRow: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
    },
    listCard: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
    },
    chip: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.sm,
    },
    formGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: tokens.spacing.sm,
      marginBottom: tokens.spacing.sm,
    },
    formColumn: {
      flex: 1,
      minWidth: 200,
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
      gap: tokens.spacing.xs,
    },
    input: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      paddingHorizontal: tokens.spacing.sm,
      paddingVertical: tokens.spacing.sm,
      borderColor: '#ccc',
    },
    textArea: {
      minHeight: 60,
      textAlignVertical: 'top',
    },
    timelineContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: tokens.spacing.sm,
      marginTop: tokens.spacing.sm,
    },
    timelineColumn: {
      flex: 1,
      minHeight: 220,
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
    },
    timelineFocusPanel: {
      flex: 1,
      minHeight: 220,
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
    },
    timelineEntry: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
      marginBottom: tokens.spacing.sm,
    },
    timelineLabel: {
      fontWeight: '700',
      fontSize: 13,
    },
    timelineTime: {
      fontSize: 11,
      marginTop: 4,
    },
  });
