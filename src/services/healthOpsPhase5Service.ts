import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';

export const HEALTH_OPS_PHARMACY_STEP_KEYS = [
  'verify_prescription',
  'validate_inventory',
  'confirm_delivery',
  'fulfillment_tracking',
] as const;

export type HealthOpsPharmacyStepKey = (typeof HEALTH_OPS_PHARMACY_STEP_KEYS)[number];

export const HEALTH_OPS_BILLING_STEP_KEYS = [
  'review_charges',
  'select_payment_method',
  'authorize_payment',
  'issue_receipt',
] as const;

export type HealthOpsBillingStepKey = (typeof HEALTH_OPS_BILLING_STEP_KEYS)[number];

export const HEALTH_OPS_HOME_LOGISTICS_STEP_KEYS = [
  'select_logistics_mode',
  'schedule_window',
  'assign_route',
  'track_eta',
] as const;

export type HealthOpsHomeLogisticsStepKey = (typeof HEALTH_OPS_HOME_LOGISTICS_STEP_KEYS)[number];

type StartPhase5SessionArgs = {
  workflowSessionId: string;
  appointmentBookingId?: string;
  payload?: Record<string, any>;
  metadata?: Record<string, any>;
};

export const startHealthOpsPharmacySession = ({
  workflowSessionId,
  appointmentBookingId,
  payload,
  metadata,
}: StartPhase5SessionArgs) =>
  postRequest(
    ROUTES.healthOps.pharmacySessionStart,
    {
      workflow_session_id: String(workflowSessionId || '').trim(),
      ...(appointmentBookingId ? { appointment_booking_id: String(appointmentBookingId).trim() } : {}),
      ...(payload && typeof payload === 'object' ? { payload } : {}),
      ...(metadata && typeof metadata === 'object' ? { metadata } : {}),
    },
    {
      errorMessage: 'Unable to start pharmacy fulfillment session.',
    },
  );

export const fetchHealthOpsPharmacySession = (pharmacySessionId: string, limit = 50) =>
  getRequest(ROUTES.healthOps.pharmacySession(pharmacySessionId), {
    params: {
      limit,
    },
    errorMessage: 'Unable to load pharmacy fulfillment session.',
  });

export const updateHealthOpsPharmacyStep = (
  pharmacySessionId: string,
  stepKey: string,
  options?: {
    isCompleted?: boolean;
    payload?: Record<string, any>;
  },
) =>
  patchRequest(
    ROUTES.healthOps.pharmacySessionStep(pharmacySessionId),
    {
      step_key: String(stepKey || '').trim(),
      is_completed: options?.isCompleted ?? true,
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
    },
    {
      errorMessage: 'Unable to update pharmacy fulfillment step.',
    },
  );

export const updateHealthOpsPharmacyPayload = (
  pharmacySessionId: string,
  options?: {
    payload?: Record<string, any>;
    metadata?: Record<string, any>;
    merge?: boolean;
  },
) =>
  patchRequest(
    ROUTES.healthOps.pharmacySessionPayload(pharmacySessionId),
    {
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
      merge: options?.merge ?? true,
    },
    {
      errorMessage: 'Unable to update pharmacy fulfillment payload.',
    },
  );

export const updateHealthOpsPharmacyTracking = (
  pharmacySessionId: string,
  options?: {
    etaMinutes?: number | null;
    deliveryMode?: string;
    paymentReference?: string;
    fulfillmentReference?: string;
    status?:
      | 'waiting'
      | 'verifying'
      | 'inventory_confirmed'
      | 'fulfillment_in_progress'
      | 'ready_for_collection'
      | 'delivered'
      | 'completed'
      | 'cancelled';
    note?: string;
    payload?: Record<string, any>;
  },
) =>
  patchRequest(
    ROUTES.healthOps.pharmacySessionTracking(pharmacySessionId),
    {
      ...(options && 'etaMinutes' in options ? { eta_minutes: options.etaMinutes ?? null } : {}),
      ...(options?.deliveryMode ? { delivery_mode: String(options.deliveryMode).trim() } : {}),
      ...(options?.paymentReference ? { payment_reference: String(options.paymentReference).trim() } : {}),
      ...(options?.fulfillmentReference ? { fulfillment_reference: String(options.fulfillmentReference).trim() } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.note ? { note: String(options.note).trim() } : {}),
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
    },
    {
      errorMessage: 'Unable to update pharmacy fulfillment tracking.',
    },
  );

export const endHealthOpsPharmacySession = (
  pharmacySessionId: string,
  options?: {
    status?: 'completed' | 'cancelled';
    summary?: string;
    metadata?: Record<string, any>;
  },
) =>
  postRequest(
    ROUTES.healthOps.pharmacySessionEnd(pharmacySessionId),
    {
      status: options?.status || 'completed',
      summary: String(options?.summary || '').trim(),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
    },
    {
      errorMessage: 'Unable to end pharmacy fulfillment session.',
    },
  );

export const startHealthOpsBillingSession = ({
  workflowSessionId,
  appointmentBookingId,
  totalAmountMicro,
  insuranceCoverageMicro,
  payableAmountMicro,
  paymentProvider,
  payload,
  metadata,
}: StartPhase5SessionArgs & {
  totalAmountMicro?: number;
  insuranceCoverageMicro?: number;
  payableAmountMicro?: number;
  paymentProvider?: string;
}) =>
  postRequest(
    ROUTES.healthOps.billingSessionStart,
    {
      workflow_session_id: String(workflowSessionId || '').trim(),
      ...(appointmentBookingId ? { appointment_booking_id: String(appointmentBookingId).trim() } : {}),
      ...(typeof totalAmountMicro === 'number' ? { total_amount_micro: Math.max(0, Math.floor(totalAmountMicro)) } : {}),
      ...(typeof insuranceCoverageMicro === 'number'
        ? { insurance_coverage_micro: Math.max(0, Math.floor(insuranceCoverageMicro)) }
        : {}),
      ...(typeof payableAmountMicro === 'number' ? { payable_amount_micro: Math.max(0, Math.floor(payableAmountMicro)) } : {}),
      ...(paymentProvider ? { payment_provider: String(paymentProvider).trim() } : {}),
      ...(payload && typeof payload === 'object' ? { payload } : {}),
      ...(metadata && typeof metadata === 'object' ? { metadata } : {}),
    },
    {
      errorMessage: 'Unable to start billing session.',
    },
  );

export const fetchHealthOpsBillingSession = (billingSessionId: string) =>
  getRequest(ROUTES.healthOps.billingSession(billingSessionId), {
    errorMessage: 'Unable to load billing session.',
  });

export const updateHealthOpsBillingStep = (
  billingSessionId: string,
  stepKey: string,
  options?: {
    isCompleted?: boolean;
    payload?: Record<string, any>;
  },
) =>
  patchRequest(
    ROUTES.healthOps.billingSessionStep(billingSessionId),
    {
      step_key: String(stepKey || '').trim(),
      is_completed: options?.isCompleted ?? true,
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
    },
    {
      errorMessage: 'Unable to update billing step.',
    },
  );

export const updateHealthOpsBillingPayload = (
  billingSessionId: string,
  options?: {
    payload?: Record<string, any>;
    metadata?: Record<string, any>;
    merge?: boolean;
  },
) =>
  patchRequest(
    ROUTES.healthOps.billingSessionPayload(billingSessionId),
    {
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
      merge: options?.merge ?? true,
    },
    {
      errorMessage: 'Unable to update billing payload.',
    },
  );

export const endHealthOpsBillingSession = (
  billingSessionId: string,
  options?: {
    status?: 'completed' | 'failed' | 'cancelled';
    summary?: string;
    metadata?: Record<string, any>;
  },
) =>
  postRequest(
    ROUTES.healthOps.billingSessionEnd(billingSessionId),
    {
      status: options?.status || 'completed',
      summary: String(options?.summary || '').trim(),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
    },
    {
      errorMessage: 'Unable to end billing session.',
    },
  );

export const startHealthOpsHomeLogisticsSession = ({
  workflowSessionId,
  appointmentBookingId,
  logisticsCode,
  taskType,
  payload,
  metadata,
}: StartPhase5SessionArgs & {
  logisticsCode?: string;
  taskType?: string;
}) =>
  postRequest(
    ROUTES.healthOps.homeLogisticsSessionStart,
    {
      workflow_session_id: String(workflowSessionId || '').trim(),
      ...(appointmentBookingId ? { appointment_booking_id: String(appointmentBookingId).trim() } : {}),
      ...(logisticsCode ? { logistics_code: String(logisticsCode).trim() } : {}),
      ...(taskType ? { task_type: String(taskType).trim() } : {}),
      ...(payload && typeof payload === 'object' ? { payload } : {}),
      ...(metadata && typeof metadata === 'object' ? { metadata } : {}),
    },
    {
      errorMessage: 'Unable to start home logistics session.',
    },
  );

export const fetchHealthOpsHomeLogisticsSession = (homeLogisticsSessionId: string, limit = 50) =>
  getRequest(ROUTES.healthOps.homeLogisticsSession(homeLogisticsSessionId), {
    params: {
      limit,
    },
    errorMessage: 'Unable to load home logistics session.',
  });

export const updateHealthOpsHomeLogisticsStep = (
  homeLogisticsSessionId: string,
  stepKey: string,
  options?: {
    isCompleted?: boolean;
    payload?: Record<string, any>;
  },
) =>
  patchRequest(
    ROUTES.healthOps.homeLogisticsSessionStep(homeLogisticsSessionId),
    {
      step_key: String(stepKey || '').trim(),
      is_completed: options?.isCompleted ?? true,
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
    },
    {
      errorMessage: 'Unable to update home logistics step.',
    },
  );

export const updateHealthOpsHomeLogisticsPayload = (
  homeLogisticsSessionId: string,
  options?: {
    payload?: Record<string, any>;
    metadata?: Record<string, any>;
    merge?: boolean;
  },
) =>
  patchRequest(
    ROUTES.healthOps.homeLogisticsSessionPayload(homeLogisticsSessionId),
    {
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
      merge: options?.merge ?? true,
    },
    {
      errorMessage: 'Unable to update home logistics payload.',
    },
  );

export const updateHealthOpsHomeLogisticsTracking = (
  homeLogisticsSessionId: string,
  options?: {
    latitude?: number | null;
    longitude?: number | null;
    etaMinutes?: number | null;
    routeReference?: string;
    assigneeName?: string;
    status?: 'waiting' | 'scheduling' | 'route_assigned' | 'in_transit' | 'arrived' | 'completed' | 'cancelled';
    note?: string;
    payload?: Record<string, any>;
  },
) =>
  patchRequest(
    ROUTES.healthOps.homeLogisticsSessionTracking(homeLogisticsSessionId),
    {
      ...(options && 'latitude' in options ? { latitude: options.latitude ?? null } : {}),
      ...(options && 'longitude' in options ? { longitude: options.longitude ?? null } : {}),
      ...(options && 'etaMinutes' in options ? { eta_minutes: options.etaMinutes ?? null } : {}),
      ...(options?.routeReference ? { route_reference: String(options.routeReference).trim() } : {}),
      ...(options?.assigneeName ? { assignee_name: String(options.assigneeName).trim() } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.note ? { note: String(options.note).trim() } : {}),
      ...(options?.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
    },
    {
      errorMessage: 'Unable to update home logistics tracking.',
    },
  );

export const endHealthOpsHomeLogisticsSession = (
  homeLogisticsSessionId: string,
  options?: {
    status?: 'completed' | 'cancelled';
    summary?: string;
    metadata?: Record<string, any>;
  },
) =>
  postRequest(
    ROUTES.healthOps.homeLogisticsSessionEnd(homeLogisticsSessionId),
    {
      status: options?.status || 'completed',
      summary: String(options?.summary || '').trim(),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
    },
    {
      errorMessage: 'Unable to end home logistics session.',
    },
  );
