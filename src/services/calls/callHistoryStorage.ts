import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CallHistoryItem } from './callTypes';

const GLOBAL_PREFIX = 'KIS_CALL_HISTORY_BY_USER_V1:';
const CONVERSATION_PREFIX = 'KIS_CALL_HISTORY_BY_USER_CONVERSATION_V1:';
const MAX_GLOBAL = 200;
const MAX_CONVERSATION = 100;

const normalize = (items: unknown): CallHistoryItem[] => {
  if (!Array.isArray(items)) return [];
  const byId = new Map<string, CallHistoryItem>();
  items.forEach((raw: any) => {
    if (!raw || !raw.callId) return;
    const item = { ...raw, status: raw.userStatus ?? raw.status } as CallHistoryItem;
    byId.set(String(item.callId), { ...(byId.get(String(item.callId)) ?? {}), ...item });
  });
  return Array.from(byId.values()).sort((a, b) =>
    String(b.startedAt ?? '').localeCompare(String(a.startedAt ?? '')),
  );
};

const globalKey = (userId: string) => `${GLOBAL_PREFIX}${userId}`;
const conversationKey = (userId: string, conversationId: string) =>
  `${CONVERSATION_PREFIX}${userId}:${conversationId}`;

export async function loadCallHistory(userId: string): Promise<CallHistoryItem[]> {
  try {
    return normalize(JSON.parse((await AsyncStorage.getItem(globalKey(userId))) ?? '[]'));
  } catch { return []; }
}

export async function saveCallHistory(userId: string, items: CallHistoryItem[]): Promise<void> {
  if (!userId) return;
  await AsyncStorage.setItem(globalKey(userId), JSON.stringify(normalize(items).slice(0, MAX_GLOBAL)));
}

export async function loadConversationCallHistory(
  userId: string,
  conversationId: string,
): Promise<CallHistoryItem[]> {
  try {
    return normalize(JSON.parse((await AsyncStorage.getItem(conversationKey(userId, conversationId))) ?? '[]'));
  } catch { return []; }
}

export async function saveConversationCallHistory(
  userId: string,
  conversationId: string,
  items: CallHistoryItem[],
): Promise<void> {
  if (!userId || !conversationId) return;
  const normalized = normalize(items).slice(0, MAX_CONVERSATION);
  await Promise.all([
    AsyncStorage.setItem(conversationKey(userId, conversationId), JSON.stringify(normalized)),
    loadCallHistory(userId).then((global) => saveCallHistory(userId, [...normalized, ...global])),
  ]);
}
