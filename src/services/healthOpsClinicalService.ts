import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';

export const HEALTH_OPS_MESSAGING_STEPS = [
  'open_thread',
  'send_message',
  'attach_files',
  'close_thread',
] as const;

export type HealthOpsMessagingStepKey = (typeof HEALTH_OPS_MESSAGING_STEPS)[number];

export const HEALTH_OPS_CLINICAL_ENGINE_CODES = ['ehr_records', 'lab_order', 'imaging_order'] as const;

export type HealthOpsClinicalEngineCode = (typeof HEALTH_OPS_CLINICAL_ENGINE_CODES)[number];

export const HEALTH_OPS_CLINICAL_STEP_META: Record<HealthOpsClinicalEngineCode, readonly string[]> = {
  ehr_records: ['review_timeline', 'add_clinical_note', 'attach_document', 'finalize_ehr_entry'],
  lab_order: ['select_tests', 'set_priority', 'confirm_collection', 'submit_order'],
  imaging_order: ['select_scan', 'screen_contraindications', 'book_slot', 'track_report'],
};

type StartMessagingArgs = {
  workflowSessionId: string;
  appointmentBookingId?: string;
  metadata?: Record<string, any>;
};

export const startHealthOpsMessagingSession = ({
  workflowSessionId,
  appointmentBookingId,
  metadata,
}: StartMessagingArgs) =>
  postRequest(
    ROUTES.healthOps.messagingSessionStart,
    {
      workflow_session_id: String(workflowSessionId || '').trim(),
      ...(appointmentBookingId ? { appointment_booking_id: String(appointmentBookingId).trim() } : {}),
      ...(metadata && typeof metadata === 'object' ? { metadata } : {}),
    },
    {
      errorMessage: 'Unable to start secure messaging session.',
    },
  );

export const fetchHealthOpsMessagingSession = (
  messagingSessionId: string,
  options?: {
    limit?: number;
    markRead?: boolean;
  },
) =>
  getRequest(ROUTES.healthOps.messagingSession(messagingSessionId), {
    params: {
      ...(typeof options?.limit === 'number' ? { limit: options.limit } : {}),
      ...(typeof options?.markRead === 'boolean' ? { mark_read: options.markRead ? '1' : '0' } : {}),
    },
    errorMessage: 'Unable to load secure messaging session.',
  });

export const updateHealthOpsMessagingStep = (
  messagingSessionId: string,
  stepKey: HealthOpsMessagingStepKey,
  payload?: Record<string, any>,
  isCompleted = true,
) =>
  patchRequest(
    ROUTES.healthOps.messagingSessionStep(messagingSessionId),
    {
      step_key: stepKey,
      is_completed: !!isCompleted,
      ...(payload && typeof payload === 'object' ? { payload } : {}),
    },
    {
      errorMessage: 'Unable to update secure messaging step.',
    },
  );

export const sendHealthOpsMessage = (
  messagingSessionId: string,
  options?: {
    messageType?: 'text' | 'file' | 'voice' | 'system';
    body?: string;
    attachmentUrl?: string;
    metadata?: Record<string, any>;
  },
) =>
  postRequest(
    ROUTES.healthOps.messagingSessionMessages(messagingSessionId),
    {
      message_type: options?.messageType || 'text',
      body: String(options?.body || '').trim(),
      ...(options?.attachmentUrl ? { attachment_url: String(options.attachmentUrl).trim() } : {}),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
    },
    {
      errorMessage: 'Unable to send secure message.',
    },
  );

export const endHealthOpsMessagingSession = (
  messagingSessionId: string,
  options?: {
    status?: 'completed' | 'closed';
    summary?: string;
    metadata?: Record<string, any>;
  },
) =>
  postRequest(
    ROUTES.healthOps.messagingSessionEnd(messagingSessionId),
    {
      status: options?.status || 'completed',
      summary: String(options?.summary || '').trim(),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
    },
    {
      errorMessage: 'Unable to end secure messaging session.',
    },
  );

type StartClinicalArgs = {
  workflowSessionId: string;
  engineCode: HealthOpsClinicalEngineCode;
  appointmentBookingId?: string;
  payload?: Record<string, any>;
  metadata?: Record<string, any>;
};

export const startHealthOpsClinicalSession = ({
  workflowSessionId,
  engineCode,
  appointmentBookingId,
  payload,
  metadata,
}: StartClinicalArgs) =>
  postRequest(
    ROUTES.healthOps.clinicalSessionStart,
    {
      workflow_session_id: String(workflowSessionId || '').trim(),
      engine_code: engineCode,
      ...(appointmentBookingId ? { appointment_booking_id: String(appointmentBookingId).trim() } : {}),
      ...(payload && typeof payload === 'object' ? { payload } : {}),
      ...(metadata && typeof metadata === 'object' ? { metadata } : {}),
    },
    {
      errorMessage: 'Unable to start clinical engine session.',
    },
  );

export const fetchHealthOpsClinicalSession = (clinicalSessionId: string) =>
  getRequest(ROUTES.healthOps.clinicalSession(clinicalSessionId), {
    errorMessage: 'Unable to load clinical engine session.',
  });

export const updateHealthOpsClinicalStep = (
  clinicalSessionId: string,
  stepKey: string,
  options?: {
    isCompleted?: boolean;
    contentPosition?: number | null;
    payload?: Record<string, any>;
  },
) =>
  patchRequest(
    ROUTES.healthOps.clinicalSessionStep(clinicalSessionId),
    {
      step_key: String(stepKey || '').trim(),
      is_completed: options?.isCompleted ?? true,
      ...(options && 'contentPosition' in options ? { content_position: options.contentPosition ?? null } : {}),
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
    },
    {
      errorMessage: 'Unable to update clinical engine step.',
    },
  );

export const updateHealthOpsClinicalPayload = (
  clinicalSessionId: string,
  options?: {
    payload?: Record<string, any>;
    metadata?: Record<string, any>;
    merge?: boolean;
  },
) =>
  patchRequest(
    ROUTES.healthOps.clinicalSessionPayload(clinicalSessionId),
    {
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
      merge: options?.merge ?? true,
    },
    {
      errorMessage: 'Unable to update clinical engine payload.',
    },
  );

export const endHealthOpsClinicalSession = (
  clinicalSessionId: string,
  options?: {
    status?: 'completed' | 'cancelled';
    summary?: string;
    metadata?: Record<string, any>;
  },
) =>
  postRequest(
    ROUTES.healthOps.clinicalSessionEnd(clinicalSessionId),
    {
      status: options?.status || 'completed',
      summary: String(options?.summary || '').trim(),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
    },
    {
      errorMessage: 'Unable to end clinical engine session.',
    },
  );
