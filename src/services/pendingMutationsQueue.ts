// src/services/pendingMutationsQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import { patchRequest } from '@/network/patch';
import { isOfflineDataEnabled } from '@/services/consentService';

const KEY = 'KIS_PENDING_MUTATIONS';

export type PendingMutation = {
  id: string;           // idempotency key
  method: 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  url: string;
  payload?: object;
  retries: number;
  createdAt: string;
};

export async function enqueueMutation(
  mutation: Omit<PendingMutation, 'id' | 'retries' | 'createdAt'>,
): Promise<void> {
  if (!isOfflineDataEnabled()) return;
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  const queue: PendingMutation[] = raw ? JSON.parse(raw) : [];
  queue.push({
    ...mutation,
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    retries: 0,
    createdAt: new Date().toISOString(),
  });
  await AsyncStorage.setItem(KEY, JSON.stringify(queue));
}

export async function flushPendingMutations(): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  if (!raw) return;
  let queue: PendingMutation[];
  try {
    queue = JSON.parse(raw);
  } catch {
    return;
  }
  if (!queue.length) return;
  const remaining: PendingMutation[] = [];
  for (const item of queue) {
    try {
      if (item.method === 'POST') {
        await postRequest(item.url, item.payload ?? {}, {
          headers: item.id ? { 'X-Idempotency-Key': item.id } : undefined,
        });
      } else if (item.method === 'DELETE') {
        await deleteRequest(item.url);
      } else if (item.method === 'PATCH' || item.method === 'PUT') {
        await patchRequest(item.url, item.payload ?? {});
      }
    } catch {
      remaining.push({ ...item, retries: item.retries + 1 });
    }
  }
  if (remaining.length) {
    await AsyncStorage.setItem(KEY, JSON.stringify(remaining));
  } else {
    await AsyncStorage.removeItem(KEY);
  }
}
