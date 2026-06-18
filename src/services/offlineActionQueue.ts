import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

import { deleteRequest } from '@/network/delete';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';
import type { ApiResult } from '@/network/types';
import { isOnline, onNetworkRecovery } from '@/services/networkMonitor';
import { computeRetryDelayMs } from '@/services/performanceOfflineService';
import { areMediaTransferJobsReady, flushMediaTransferQueue } from '@/services/mediaTransferQueue';
import { isOfflineDataEnabled } from '@/services/consentService';

export const OFFLINE_ACTION_QUEUE_UPDATED_EVENT = 'offlineActionQueue.updated';

const OFFLINE_ACTION_QUEUE_KEY = 'kis.offline_action_queue.v1';
const MAX_ATTEMPTS_BEFORE_FAILED = 5;

export type OfflineActionMethod = 'POST' | 'PATCH' | 'DELETE';
export type OfflineActionStatus = 'pending' | 'syncing' | 'failed';
export type OfflineActionConflictPolicy = 'latest_wins' | 'append_only' | 'idempotent' | 'manual_review';

export type OfflineActionItem = {
  id: string;
  clientActionId: string;
  dedupeKey?: string;
  replaceExisting?: boolean;
  domain: string;
  kind: string;
  method: OfflineActionMethod;
  url: string;
  body?: any;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  status: OfflineActionStatus;
  lastError?: string;
  mediaJobIds?: string[];
  conflictPolicy?: OfflineActionConflictPolicy;
  nextAttemptAt?: string;
};

type QueueableRequestInput = {
  domain: string;
  kind: string;
  method: OfflineActionMethod;
  url: string;
  body?: any;
  dedupeKey?: string;
  replaceExisting?: boolean;
  errorMessage?: string;
  mediaJobIds?: string[];
  conflictPolicy?: OfflineActionConflictPolicy;
};

type QueueableResult = ApiResult & {
  queued?: boolean;
  clientActionId?: string;
};

let flushing = false;
let unsubscribeRecovery: (() => void) | null = null;

const makeClientActionId = () =>
  `offline_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;

const emitQueueUpdated = (queue: OfflineActionItem[]) => {
  DeviceEventEmitter.emit(OFFLINE_ACTION_QUEUE_UPDATED_EVENT, {
    pending: queue.filter(item => item.status === 'pending').length,
    failed: queue.filter(item => item.status === 'failed').length,
    total: queue.length,
  });
};

const isObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const hasFormDataLikeValue = (value: any): boolean => {
  if (!value) return false;
  if (
    typeof FormData !== 'undefined' &&
    (value instanceof FormData ||
      (typeof value === 'object' &&
        typeof value.append === 'function' &&
        Array.isArray(value._parts)))
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.some(hasFormDataLikeValue);
  if (isObject(value)) {
    return Object.values(value).some(hasFormDataLikeValue);
  }
  return false;
};

const inferConflictPolicy = (input: Pick<QueueableRequestInput, 'kind' | 'replaceExisting'>): OfflineActionConflictPolicy => {
  const kind = String(input.kind || '').toLowerCase();
  if (input.replaceExisting || kind.includes('settings') || kind.includes('status')) return 'latest_wins';
  if (kind.includes('comment') || kind.includes('report')) return 'append_only';
  if (kind.includes('react') || kind.includes('save') || kind.includes('subscribe') || kind.includes('follow') || kind.includes('enroll')) return 'idempotent';
  return 'manual_review';
};

const safeParseQueue = (raw: string | null): OfflineActionItem[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(item => item?.id && item?.url) : [];
  } catch {
    return [];
  }
};

const readQueue = async (): Promise<OfflineActionItem[]> => {
  const raw = await AsyncStorage.getItem(OFFLINE_ACTION_QUEUE_KEY);
  return safeParseQueue(raw);
};

const writeQueue = async (queue: OfflineActionItem[]) => {
  await AsyncStorage.setItem(OFFLINE_ACTION_QUEUE_KEY, JSON.stringify(queue));
  emitQueueUpdated(queue);
};

export const getOfflineActionQueue = readQueue;

export const clearCompletedOfflineActionQueueState = async () => {
  const queue = await readQueue();
  await writeQueue(queue.filter(item => item.status !== 'syncing'));
};

export const enqueueOfflineAction = async (
  input: QueueableRequestInput,
): Promise<OfflineActionItem> => {
  if (!isOfflineDataEnabled()) {
    throw new Error('Offline data storage is disabled by user consent settings.');
  }
  if (hasFormDataLikeValue(input.body)) {
    throw new Error('Offline queue cannot persist FormData actions yet.');
  }
  const now = new Date().toISOString();
  const item: OfflineActionItem = {
    id: makeClientActionId(),
    clientActionId: makeClientActionId(),
    dedupeKey: input.dedupeKey,
    replaceExisting: input.replaceExisting,
    domain: input.domain,
    kind: input.kind,
    method: input.method,
    url: input.url,
    body: input.body,
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    status: 'pending',
    mediaJobIds: input.mediaJobIds,
    conflictPolicy: input.conflictPolicy || inferConflictPolicy(input),
  };
  const queue = await readQueue();
  const withoutDuplicates = queue.filter(existing => {
    if (existing.clientActionId === item.clientActionId) return false;
    if (item.replaceExisting && item.dedupeKey && existing.dedupeKey === item.dedupeKey) {
      return false;
    }
    return true;
  });
  const next = [...withoutDuplicates, item];
  await writeQueue(next);
  return item;
};

const executeAction = async (item: OfflineActionItem): Promise<ApiResult> => {
  if (item.method === 'PATCH') {
    return patchRequest(item.url, item.body, { errorMessage: item.lastError || 'Unable to sync offline action.' });
  }
  if (item.method === 'DELETE') {
    return deleteRequest(item.url, { errorMessage: item.lastError || 'Unable to sync offline action.' });
  }
  return postRequest(item.url, item.body, { errorMessage: item.lastError || 'Unable to sync offline action.' });
};

const shouldQueueResult = (result: ApiResult | null | undefined): boolean => {
  if (!result) return true;
  if (result.success) return false;
  if (!result.status) return true;
  return result.status >= 500 || result.status === 408 || result.status === 429;
};

export const flushOfflineActionQueue = async () => {
  if (flushing) return;
  if (!(await isOnline())) return;
  flushing = true;
  try {
    let queue = await readQueue();
    for (const item of [...queue].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      const current = queue.find(entry => entry.id === item.id);
      if (!current || current.status === 'syncing') continue;
      if (!(await areMediaTransferJobsReady(item.mediaJobIds))) {
        await flushMediaTransferQueue();
        break;
      }
      if (current.nextAttemptAt && Date.parse(current.nextAttemptAt) > Date.now()) break;
      const now = new Date().toISOString();
      queue = queue.map(entry =>
        entry.id === item.id
          ? { ...entry, status: 'syncing', attempts: entry.attempts + 1, updatedAt: now }
          : entry,
      );
      await writeQueue(queue);

      const result = await executeAction(current);
      queue = await readQueue();
      if (result?.success) {
        queue = queue.filter(entry => entry.id !== item.id);
        await writeQueue(queue);
        continue;
      }

      const isRetryable = shouldQueueResult(result);
      const nextStatus =
        current.attempts + 1 >= MAX_ATTEMPTS_BEFORE_FAILED || !isRetryable
          ? 'failed'
          : 'pending';
      const retryDelay = isRetryable ? computeRetryDelayMs(current.attempts, 1_000, 60_000) : 0;
      queue = queue.map(entry =>
        entry.id === item.id
          ? {
              ...entry,
              status: nextStatus,
              lastError: result?.message || 'Unable to sync offline action.',
              updatedAt: new Date().toISOString(),
              nextAttemptAt: nextStatus === 'pending' ? new Date(Date.now() + retryDelay).toISOString() : undefined,
            }
          : entry,
      );
      await writeQueue(queue);
      if (nextStatus === 'pending') break;
    }
  } finally {
    flushing = false;
  }
};

export const startOfflineActionQueue = () => {
  if (unsubscribeRecovery) return unsubscribeRecovery;
  unsubscribeRecovery = onNetworkRecovery(() => {
    void flushOfflineActionQueue();
  });
  void flushOfflineActionQueue();
  return unsubscribeRecovery;
};

export const stopOfflineActionQueue = () => {
  unsubscribeRecovery?.();
  unsubscribeRecovery = null;
};

export const queueableJsonRequest = async (
  input: QueueableRequestInput,
): Promise<QueueableResult> => {
  if (hasFormDataLikeValue(input.body)) {
    return executeAction({
      id: makeClientActionId(),
      clientActionId: makeClientActionId(),
      domain: input.domain,
      kind: input.kind,
      method: input.method,
      url: input.url,
      body: input.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attempts: 0,
      status: 'pending',
      mediaJobIds: input.mediaJobIds,
      conflictPolicy: input.conflictPolicy || inferConflictPolicy(input),
    });
  }

  if (!(await isOnline())) {
    const item = await enqueueOfflineAction(input);
    return {
      success: true,
      queued: true,
      clientActionId: item.clientActionId,
      message: 'Saved offline. It will sync when you are back online.',
      data: { queued: true, clientActionId: item.clientActionId },
    };
  }

  const result = await executeAction({
    id: makeClientActionId(),
    clientActionId: makeClientActionId(),
    domain: input.domain,
    kind: input.kind,
    method: input.method,
    url: input.url,
    body: input.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
    lastError: input.errorMessage,
    mediaJobIds: input.mediaJobIds,
    conflictPolicy: input.conflictPolicy || inferConflictPolicy(input),
  });

  if (result?.success || !shouldQueueResult(result)) return result;

  const item = await enqueueOfflineAction(input);
  return {
    success: true,
    queued: true,
    clientActionId: item.clientActionId,
    message: 'Network is unstable. Saved offline and will retry automatically.',
    data: { queued: true, clientActionId: item.clientActionId },
  };
};
