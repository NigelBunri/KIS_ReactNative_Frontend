import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';

export const HEALTH_OPS_ADMISSION_STEP_KEYS = [
  'admission_reason',
  'insurance_verification',
  'bed_assignment',
  'admission_confirmation',
] as const;

export type HealthOpsAdmissionStepKey = (typeof HEALTH_OPS_ADMISSION_STEP_KEYS)[number];

export const HEALTH_OPS_EMERGENCY_STEP_KEYS = [
  'capture_location',
  'triage_form',
  'dispatch_ambulance',
  'track_response',
] as const;

export type HealthOpsEmergencyStepKey = (typeof HEALTH_OPS_EMERGENCY_STEP_KEYS)[number];

type StartAdmissionArgs = {
  workflowSessionId: string;
  appointmentBookingId?: string;
  payload?: Record<string, any>;
  metadata?: Record<string, any>;
};

export const startHealthOpsAdmissionSession = ({
  workflowSessionId,
  appointmentBookingId,
  payload,
  metadata,
}: StartAdmissionArgs) =>
  postRequest(
    ROUTES.healthOps.admissionSessionStart,
    {
      workflow_session_id: String(workflowSessionId || '').trim(),
      ...(appointmentBookingId ? { appointment_booking_id: String(appointmentBookingId).trim() } : {}),
      ...(payload && typeof payload === 'object' ? { payload } : {}),
      ...(metadata && typeof metadata === 'object' ? { metadata } : {}),
    },
    {
      errorMessage: 'Unable to start admission session.',
    },
  );

export const fetchHealthOpsAdmissionSession = (admissionSessionId: string) =>
  getRequest(ROUTES.healthOps.admissionSession(admissionSessionId), {
    errorMessage: 'Unable to load admission session.',
  });

export const updateHealthOpsAdmissionStep = (
  admissionSessionId: string,
  stepKey: string,
  options?: {
    isCompleted?: boolean;
    payload?: Record<string, any>;
  },
) =>
  patchRequest(
    ROUTES.healthOps.admissionSessionStep(admissionSessionId),
    {
      step_key: String(stepKey || '').trim(),
      is_completed: options?.isCompleted ?? true,
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
    },
    {
      errorMessage: 'Unable to update admission step.',
    },
  );

export const updateHealthOpsAdmissionPayload = (
  admissionSessionId: string,
  options?: {
    payload?: Record<string, any>;
    metadata?: Record<string, any>;
    merge?: boolean;
  },
) =>
  patchRequest(
    ROUTES.healthOps.admissionSessionPayload(admissionSessionId),
    {
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
      merge: options?.merge ?? true,
    },
    {
      errorMessage: 'Unable to update admission payload.',
    },
  );

export const endHealthOpsAdmissionSession = (
  admissionSessionId: string,
  options?: {
    status?: 'completed' | 'cancelled';
    summary?: string;
    metadata?: Record<string, any>;
  },
) =>
  postRequest(
    ROUTES.healthOps.admissionSessionEnd(admissionSessionId),
    {
      status: options?.status || 'completed',
      summary: String(options?.summary || '').trim(),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
    },
    {
      errorMessage: 'Unable to end admission session.',
    },
  );

type StartEmergencyArgs = {
  workflowSessionId: string;
  appointmentBookingId?: string;
  dispatchCode?: string;
  payload?: Record<string, any>;
  metadata?: Record<string, any>;
};

export const startHealthOpsEmergencySession = ({
  workflowSessionId,
  appointmentBookingId,
  dispatchCode,
  payload,
  metadata,
}: StartEmergencyArgs) =>
  postRequest(
    ROUTES.healthOps.emergencySessionStart,
    {
      workflow_session_id: String(workflowSessionId || '').trim(),
      ...(appointmentBookingId ? { appointment_booking_id: String(appointmentBookingId).trim() } : {}),
      ...(dispatchCode ? { dispatch_code: String(dispatchCode).trim() } : {}),
      ...(payload && typeof payload === 'object' ? { payload } : {}),
      ...(metadata && typeof metadata === 'object' ? { metadata } : {}),
    },
    {
      errorMessage: 'Unable to start emergency dispatch session.',
    },
  );

export const fetchHealthOpsEmergencySession = (emergencySessionId: string, limit = 50) =>
  getRequest(ROUTES.healthOps.emergencySession(emergencySessionId), {
    params: {
      limit,
    },
    errorMessage: 'Unable to load emergency dispatch session.',
  });

export const updateHealthOpsEmergencyStep = (
  emergencySessionId: string,
  stepKey: string,
  options?: {
    isCompleted?: boolean;
    payload?: Record<string, any>;
  },
) =>
  patchRequest(
    ROUTES.healthOps.emergencySessionStep(emergencySessionId),
    {
      step_key: String(stepKey || '').trim(),
      is_completed: options?.isCompleted ?? true,
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
    },
    {
      errorMessage: 'Unable to update emergency step.',
    },
  );

export const updateHealthOpsEmergencyPayload = (
  emergencySessionId: string,
  options?: {
    payload?: Record<string, any>;
    metadata?: Record<string, any>;
    merge?: boolean;
  },
) =>
  patchRequest(
    ROUTES.healthOps.emergencySessionPayload(emergencySessionId),
    {
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
      merge: options?.merge ?? true,
    },
    {
      errorMessage: 'Unable to update emergency payload.',
    },
  );

export const updateHealthOpsEmergencyTracking = (
  emergencySessionId: string,
  options?: {
    latitude?: number | null;
    longitude?: number | null;
    etaMinutes?: number | null;
    ambulanceReference?: string;
    status?: 'waiting' | 'triaging' | 'dispatched' | 'in_transit' | 'arrived' | 'resolved' | 'cancelled';
    note?: string;
    payload?: Record<string, any>;
  },
) =>
  patchRequest(
    ROUTES.healthOps.emergencySessionTracking(emergencySessionId),
    {
      ...(options && 'latitude' in options ? { latitude: options.latitude ?? null } : {}),
      ...(options && 'longitude' in options ? { longitude: options.longitude ?? null } : {}),
      ...(options && 'etaMinutes' in options ? { eta_minutes: options.etaMinutes ?? null } : {}),
      ...(options?.ambulanceReference ? { ambulance_reference: String(options.ambulanceReference).trim() } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.note ? { note: String(options.note).trim() } : {}),
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
    },
    {
      errorMessage: 'Unable to update emergency tracking.',
    },
  );

export const endHealthOpsEmergencySession = (
  emergencySessionId: string,
  options?: {
    status?: 'resolved' | 'cancelled';
    summary?: string;
    metadata?: Record<string, any>;
  },
) =>
  postRequest(
    ROUTES.healthOps.emergencySessionEnd(emergencySessionId),
    {
      status: options?.status || 'resolved',
      summary: String(options?.summary || '').trim(),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
    },
    {
      errorMessage: 'Unable to end emergency dispatch session.',
    },
  );
