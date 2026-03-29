import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';

export const HEALTH_OPS_WELLNESS_STEP_KEYS = [
  'enroll_program',
  'set_goals',
  'track_habits',
  'review_progress',
] as const;

export type HealthOpsWellnessStepKey = (typeof HEALTH_OPS_WELLNESS_STEP_KEYS)[number];

export const HEALTH_OPS_REMINDER_STEP_KEYS = [
  'select_channels',
  'configure_rules',
  'schedule_reminders',
  'confirm_delivery',
] as const;

export type HealthOpsReminderStepKey = (typeof HEALTH_OPS_REMINDER_STEP_KEYS)[number];

type StartPhase6SessionArgs = {
  workflowSessionId: string;
  appointmentBookingId?: string;
  payload?: Record<string, any>;
  metadata?: Record<string, any>;
};

export const startHealthOpsWellnessSession = ({
  workflowSessionId,
  appointmentBookingId,
  payload,
  metadata,
  programName,
}: StartPhase6SessionArgs & { programName?: string }) =>
  postRequest(
    ROUTES.healthOps.wellnessSessionStart,
    {
      workflow_session_id: String(workflowSessionId || '').trim(),
      ...(appointmentBookingId ? { appointment_booking_id: String(appointmentBookingId).trim() } : {}),
      ...(programName ? { program_name: String(programName).trim() } : {}),
      ...(payload && typeof payload === 'object' ? { payload } : {}),
      ...(metadata && typeof metadata === 'object' ? { metadata } : {}),
    },
    {
      errorMessage: 'Unable to start wellness program session.',
    },
  );

export const fetchHealthOpsWellnessSession = (wellnessSessionId: string, limit = 50) =>
  getRequest(ROUTES.healthOps.wellnessSession(wellnessSessionId), {
    params: {
      limit,
    },
    errorMessage: 'Unable to load wellness session.',
  });

export const updateHealthOpsWellnessStep = (
  wellnessSessionId: string,
  stepKey: string,
  options?: {
    isCompleted?: boolean;
    payload?: Record<string, any>;
  },
) =>
  patchRequest(
    ROUTES.healthOps.wellnessSessionStep(wellnessSessionId),
    {
      step_key: String(stepKey || '').trim(),
      is_completed: options?.isCompleted ?? true,
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
    },
    {
      errorMessage: 'Unable to update wellness step.',
    },
  );

export const updateHealthOpsWellnessPayload = (
  wellnessSessionId: string,
  options?: {
    payload?: Record<string, any>;
    metadata?: Record<string, any>;
    merge?: boolean;
  },
) =>
  patchRequest(
    ROUTES.healthOps.wellnessSessionPayload(wellnessSessionId),
    {
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
      merge: options?.merge ?? true,
    },
    {
      errorMessage: 'Unable to update wellness payload.',
    },
  );

export const updateHealthOpsWellnessActivity = (
  wellnessSessionId: string,
  options?: {
    eventType?: string;
    status?: 'waiting' | 'enrolled' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
    streakDelta?: number;
    completionPercent?: number;
    note?: string;
    payload?: Record<string, any>;
  },
) =>
  patchRequest(
    ROUTES.healthOps.wellnessSessionActivity(wellnessSessionId),
    {
      ...(options?.eventType ? { event_type: String(options.eventType).trim() } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...(typeof options?.streakDelta === 'number' ? { streak_delta: Math.floor(options.streakDelta) } : {}),
      ...(typeof options?.completionPercent === 'number'
        ? { completion_percent: Math.max(0, Math.min(100, Math.floor(options.completionPercent))) }
        : {}),
      ...(options?.note ? { note: String(options.note).trim() } : {}),
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
    },
    {
      errorMessage: 'Unable to update wellness activity.',
    },
  );

export const endHealthOpsWellnessSession = (
  wellnessSessionId: string,
  options?: {
    status?: 'completed' | 'cancelled';
    summary?: string;
    metadata?: Record<string, any>;
  },
) =>
  postRequest(
    ROUTES.healthOps.wellnessSessionEnd(wellnessSessionId),
    {
      status: options?.status || 'completed',
      summary: String(options?.summary || '').trim(),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
    },
    {
      errorMessage: 'Unable to end wellness session.',
    },
  );

export const startHealthOpsReminderSession = ({
  workflowSessionId,
  appointmentBookingId,
  payload,
  metadata,
  reminderTimezone,
}: StartPhase6SessionArgs & { reminderTimezone?: string }) =>
  postRequest(
    ROUTES.healthOps.reminderSessionStart,
    {
      workflow_session_id: String(workflowSessionId || '').trim(),
      ...(appointmentBookingId ? { appointment_booking_id: String(appointmentBookingId).trim() } : {}),
      ...(reminderTimezone ? { reminder_timezone: String(reminderTimezone).trim() } : {}),
      ...(payload && typeof payload === 'object' ? { payload } : {}),
      ...(metadata && typeof metadata === 'object' ? { metadata } : {}),
    },
    {
      errorMessage: 'Unable to start reminder session.',
    },
  );

export const fetchHealthOpsReminderSession = (notificationSessionId: string, limit = 50) =>
  getRequest(ROUTES.healthOps.reminderSession(notificationSessionId), {
    params: {
      limit,
    },
    errorMessage: 'Unable to load reminder session.',
  });

export const updateHealthOpsReminderStep = (
  notificationSessionId: string,
  stepKey: string,
  options?: {
    isCompleted?: boolean;
    payload?: Record<string, any>;
  },
) =>
  patchRequest(
    ROUTES.healthOps.reminderSessionStep(notificationSessionId),
    {
      step_key: String(stepKey || '').trim(),
      is_completed: options?.isCompleted ?? true,
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
    },
    {
      errorMessage: 'Unable to update reminder step.',
    },
  );

export const updateHealthOpsReminderPayload = (
  notificationSessionId: string,
  options?: {
    payload?: Record<string, any>;
    metadata?: Record<string, any>;
    merge?: boolean;
  },
) =>
  patchRequest(
    ROUTES.healthOps.reminderSessionPayload(notificationSessionId),
    {
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
      merge: options?.merge ?? true,
    },
    {
      errorMessage: 'Unable to update reminder payload.',
    },
  );

export const updateHealthOpsReminderDelivery = (
  notificationSessionId: string,
  options?: {
    status?: 'waiting' | 'configuring' | 'active' | 'paused' | 'completed' | 'disabled' | 'cancelled';
    nextRunAt?: string | null;
    sent?: boolean;
    failed?: boolean;
    channel?: string;
    note?: string;
    payload?: Record<string, any>;
  },
) =>
  patchRequest(
    ROUTES.healthOps.reminderSessionDelivery(notificationSessionId),
    {
      ...(options?.status ? { status: options.status } : {}),
      ...(options && 'nextRunAt' in options ? { next_run_at: options.nextRunAt || null } : {}),
      ...(options && 'sent' in options ? { sent: !!options.sent } : {}),
      ...(options && 'failed' in options ? { failed: !!options.failed } : {}),
      ...(options?.channel ? { channel: String(options.channel).trim() } : {}),
      ...(options?.note ? { note: String(options.note).trim() } : {}),
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
    },
    {
      errorMessage: 'Unable to update reminder delivery.',
    },
  );

export const endHealthOpsReminderSession = (
  notificationSessionId: string,
  options?: {
    status?: 'completed' | 'disabled' | 'cancelled';
    summary?: string;
    metadata?: Record<string, any>;
  },
) =>
  postRequest(
    ROUTES.healthOps.reminderSessionEnd(notificationSessionId),
    {
      status: options?.status || 'completed',
      summary: String(options?.summary || '').trim(),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
    },
    {
      errorMessage: 'Unable to end reminder session.',
    },
  );
