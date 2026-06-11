import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import RNFS from 'react-native-fs';

import { API_BASE_URL } from '@/network';
import { getAccessToken } from '@/security/authStorage';
import { isOnline, onNetworkRecovery } from '@/services/networkMonitor';
import { computeRetryDelayMs } from '@/services/performanceOfflineService';
import { uploadFileToBackend, type AttachmentKind, type AttachmentMeta } from '@/Module/ChatRoom/uploadFileToBackend';
import {
  buildPermanentMediaPath,
  copyUriToPermanentMedia,
  fileUriForPath,
  permanentMediaExists,
  sanitizePermanentFileName,
  stripFileScheme,
  type PermanentMediaDomain,
} from '@/storage/permanentMediaStorage';

export const MEDIA_TRANSFER_QUEUE_UPDATED_EVENT = 'mediaTransferQueue.updated';

const MEDIA_TRANSFER_QUEUE_KEY = 'kis.media_transfer_queue.v1';
const MAX_TRANSFER_ATTEMPTS = 5;

export type MediaTransferStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type MediaTransferDirection = 'upload' | 'download';

export type MediaTransferJob = {
  id: string;
  direction: MediaTransferDirection;
  domain: PermanentMediaDomain;
  bucket: 'Uploads' | 'Downloads';
  status: MediaTransferStatus;
  localPath: string;
  localUri: string;
  remoteUrl?: string;
  endpointBaseUrl?: string;
  uploadContext?: string;
  conversationId?: string;
  clientId?: string;
  relatedEntityIds?: Record<string, string | number | undefined>;
  metadata?: Record<string, string | number | undefined>;
  name: string;
  mimeType: string;
  size?: number | null;
  kind?: AttachmentKind | string;
  progress: number;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  lastError?: string;
  nextAttemptAt?: string;
  result?: AttachmentMeta | { localPath: string; localUri: string };
};

export type MediaTransferSummary = {
  total: number;
  queued: number;
  running: number;
  failed: number;
  completed: number;
  cancelled: number;
};

type QueueUploadInput = {
  file: { uri: string; name?: string | null; type?: string | null; size?: number | null; durationMs?: number | null };
  domain: PermanentMediaDomain;
  endpointBaseUrl?: string;
  uploadContext?: string;
  conversationId?: string;
  clientId?: string;
  relatedEntityIds?: Record<string, string | number | undefined>;
  metadata?: Record<string, string | number | undefined>;
  kind?: AttachmentKind | string;
  autoStart?: boolean;
};

type QueueDownloadInput = {
  remoteUrl: string;
  filename?: string | null;
  mimeType?: string | null;
  domain: PermanentMediaDomain;
  relatedEntityIds?: Record<string, string | number | undefined>;
  stableKey?: string | null;
  autoStart?: boolean;
};

let flushing = false;
let unsubscribeRecovery: (() => void) | null = null;

const makeJobId = () => `media_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;

const summarize = (jobs: MediaTransferJob[]): MediaTransferSummary => ({
  total: jobs.length,
  queued: jobs.filter(job => job.status === 'queued').length,
  running: jobs.filter(job => job.status === 'running').length,
  failed: jobs.filter(job => job.status === 'failed').length,
  completed: jobs.filter(job => job.status === 'completed').length,
  cancelled: jobs.filter(job => job.status === 'cancelled').length,
});

const emitUpdated = (jobs: MediaTransferJob[]) => {
  DeviceEventEmitter.emit(MEDIA_TRANSFER_QUEUE_UPDATED_EVENT, summarize(jobs));
};

const readJobs = async (): Promise<MediaTransferJob[]> => {
  const raw = await AsyncStorage.getItem(MEDIA_TRANSFER_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(job => job?.id && job?.localPath) : [];
  } catch {
    return [];
  }
};

const writeJobs = async (jobs: MediaTransferJob[]) => {
  await AsyncStorage.setItem(MEDIA_TRANSFER_QUEUE_KEY, JSON.stringify(jobs));
  emitUpdated(jobs);
};

const updateJob = async (jobId: string, updater: (job: MediaTransferJob) => MediaTransferJob) => {
  const jobs = await readJobs();
  const next = jobs.map(job => (job.id === jobId ? updater(job) : job));
  await writeJobs(next);
  return next.find(job => job.id === jobId) ?? null;
};

export const getMediaTransferQueue = readJobs;
export const getMediaTransferSummary = async () => summarize(await readJobs());

export const getMediaTransferJobsByIds = async (ids: string[]) => {
  const idSet = new Set(ids);
  return (await readJobs()).filter(job => idSet.has(job.id));
};

export const areMediaTransferJobsReady = async (ids?: string[] | null) => {
  if (!ids?.length) return true;
  const jobs = await getMediaTransferJobsByIds(ids);
  return ids.every(id => jobs.find(job => job.id === id)?.status === 'completed');
};

export const cancelMediaTransferJob = async (jobId: string) => {
  await updateJob(jobId, job => ({
    ...job,
    status: job.status === 'completed' ? job.status : 'cancelled',
    updatedAt: new Date().toISOString(),
  }));
};

export const retryMediaTransferJob = async (jobId: string) => {
  await updateJob(jobId, job => ({
    ...job,
    status: job.status === 'completed' ? job.status : 'queued',
    lastError: undefined,
    updatedAt: new Date().toISOString(),
  }));
  void flushMediaTransferQueue();
};

export const clearCompletedMediaTransfers = async () => {
  const jobs = await readJobs();
  await writeJobs(jobs.filter(job => job.status !== 'completed' && job.status !== 'cancelled'));
};

export const queueMediaUpload = async (input: QueueUploadInput): Promise<MediaTransferJob> => {
  const cleanName = sanitizePermanentFileName(input.file.name || `upload_${Date.now()}`);
  const permanentPath = await copyUriToPermanentMedia(
    input.file.uri,
    input.domain,
    'Uploads',
    cleanName,
    `${input.domain}_${input.clientId || input.conversationId || Date.now()}`,
  );
  if (!permanentPath) {
    throw new Error('Unable to prepare this file for background upload.');
  }
  const now = new Date().toISOString();
  const job: MediaTransferJob = {
    id: makeJobId(),
    direction: 'upload',
    domain: input.domain,
    bucket: 'Uploads',
    status: 'queued',
    localPath: permanentPath,
    localUri: fileUriForPath(permanentPath),
    endpointBaseUrl: input.endpointBaseUrl || API_BASE_URL,
    uploadContext: input.uploadContext,
    conversationId: input.conversationId,
    clientId: input.clientId,
    relatedEntityIds: input.relatedEntityIds,
    metadata: input.metadata,
    name: cleanName,
    mimeType: input.file.type || 'application/octet-stream',
    size: input.file.size,
    kind: input.kind,
    progress: 0,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  const jobs = await readJobs();
  await writeJobs([...jobs, job]);
  if (input.autoStart !== false) void flushMediaTransferQueue();
  return job;
};

export const queueMediaDownload = async (input: QueueDownloadInput): Promise<MediaTransferJob> => {
  const cleanName = sanitizePermanentFileName(input.filename || input.remoteUrl.split('/').pop()?.split('?')[0] || `download_${Date.now()}`);
  const targetPath = await buildPermanentMediaPath(input.domain, 'Downloads', cleanName, input.stableKey || input.remoteUrl);
  const now = new Date().toISOString();
  const job: MediaTransferJob = {
    id: makeJobId(),
    direction: 'download',
    domain: input.domain,
    bucket: 'Downloads',
    status: 'queued',
    localPath: targetPath,
    localUri: fileUriForPath(targetPath),
    remoteUrl: input.remoteUrl,
    relatedEntityIds: input.relatedEntityIds,
    name: cleanName,
    mimeType: input.mimeType || 'application/octet-stream',
    progress: 0,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  const jobs = await readJobs();
  await writeJobs([...jobs, job]);
  if (input.autoStart !== false) void flushMediaTransferQueue();
  return job;
};

const cleanMetadata = (metadata?: Record<string, string | number | undefined>) => {
  if (!metadata) return undefined;
  const cleaned: Record<string, string | number> = {};
  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== undefined && value !== null) cleaned[key] = value;
  });
  return cleaned;
};

const runUpload = async (job: MediaTransferJob) => {
  const exists = await permanentMediaExists(job.localPath);
  if (!exists) throw new Error('The local file for this upload is missing.');
  const attachment = await uploadFileToBackend({
    file: {
      uri: fileUriForPath(job.localPath),
      name: job.name,
      type: job.mimeType,
      size: job.size,
    },
    baseUrl: job.endpointBaseUrl,
    conversationId: job.conversationId,
    clientId: job.clientId,
    metadata: cleanMetadata(job.metadata),
    context: job.uploadContext,
    onProgress: progress => {
      void updateJob(job.id, current => ({
        ...current,
        progress: Math.max(current.progress, progress),
        status: 'running',
        updatedAt: new Date().toISOString(),
      }));
    },
  });
  return attachment;
};

const runDownload = async (job: MediaTransferJob) => {
  if (!job.remoteUrl) throw new Error('Download URL is missing.');
  const token = await getAccessToken().catch(() => null);
  const headers: Record<string, string> = { Accept: '*/*' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const download = RNFS.downloadFile({
    fromUrl: job.remoteUrl,
    toFile: stripFileScheme(job.localPath),
    headers,
    progressDivider: 1,
    progress: event => {
      const total = Number(event.contentLength || 0);
      const received = Number(event.bytesWritten || 0);
      const progress = total > 0 ? received / total : 0;
      void updateJob(job.id, current => ({
        ...current,
        progress: Math.max(current.progress, Math.min(0.99, progress)),
        status: 'running',
        updatedAt: new Date().toISOString(),
      }));
    },
  });
  const result = await download.promise;
  if (result.statusCode && result.statusCode >= 400) {
    throw new Error(`Download failed with status ${result.statusCode}.`);
  }
  return { localPath: stripFileScheme(job.localPath), localUri: fileUriForPath(job.localPath) };
};

export const flushMediaTransferQueue = async () => {
  if (flushing) return;
  if (!(await isOnline())) return;
  flushing = true;
  try {
    let jobs = await readJobs();
    for (const job of jobs.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (job.status !== 'queued' && job.status !== 'failed') continue;
      if (job.nextAttemptAt && Date.parse(job.nextAttemptAt) > Date.now()) break;
      if (job.attempts >= MAX_TRANSFER_ATTEMPTS && job.status === 'failed') continue;
      await updateJob(job.id, current => ({
        ...current,
        status: 'running',
        attempts: current.attempts + 1,
        progress: Math.max(0, current.progress),
        updatedAt: new Date().toISOString(),
      }));
      try {
        const result = job.direction === 'upload' ? await runUpload(job) : await runDownload(job);
        await updateJob(job.id, current => ({
          ...current,
          status: 'completed',
          progress: 1,
          result,
          lastError: undefined,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
      } catch (error: any) {
        const transferErrorMessage =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
            ? error
            : 'Unable to complete media transfer.';
        await updateJob(job.id, current => {
          const shouldFail = current.attempts >= MAX_TRANSFER_ATTEMPTS;
          const retryDelay = computeRetryDelayMs(current.attempts, 1_000, 60_000);
          return {
            ...current,
            status: shouldFail ? 'failed' : 'queued',
            lastError: transferErrorMessage,
            nextAttemptAt: shouldFail ? undefined : new Date(Date.now() + retryDelay).toISOString(),
            updatedAt: new Date().toISOString(),
          };
        });
        break;
      }
      jobs = await readJobs();
    }
  } finally {
    flushing = false;
  }
};

export const startMediaTransferQueue = () => {
  if (unsubscribeRecovery) return unsubscribeRecovery;
  unsubscribeRecovery = onNetworkRecovery(() => {
    void flushMediaTransferQueue();
  });
  void flushMediaTransferQueue();
  return unsubscribeRecovery;
};

export const stopMediaTransferQueue = () => {
  unsubscribeRecovery?.();
  unsubscribeRecovery = null;
};
