import AsyncStorage from '@react-native-async-storage/async-storage';

// Structured, privacy-safe call-pipeline diagnostics. Exists so a report of
// "the phone rang once but there was no UI" can be replaced with an actual
// timeline showing exactly which stage the pipeline reached before it
// stopped, instead of guessing. Never log auth tokens, push credentials,
// SDP, or message content — only pipeline milestones and non-sensitive
// identifiers (callId, a truncated userId, call type).

export type CallDiagnosticStage =
  | 'PUSH_RECEIVED'
  | 'BACKGROUND_HANDLER_STARTED'
  | 'CALL_PAYLOAD_PARSED'
  | 'SOCKET_OFFER_RECEIVED'
  | 'CALLKEEP_UNAVAILABLE'
  | 'CALLKEEP_REQUESTED'
  | 'CALLKEEP_DISPLAYED_OK'
  | 'CALLKEEP_DISPLAYED_FAILED'
  | 'USER_ANSWERED'
  | 'CALL_ENDED';

export type CallDiagnosticEvent = {
  stage: CallDiagnosticStage;
  at: string; // ISO timestamp
  callId?: string;
  callType?: string;
  /** Short, non-sensitive free-text detail — e.g. an error code/category, never a raw error message that might embed a token. */
  detail?: string;
};

const KEY = 'KIS_CALL_DIAGNOSTICS_LOG_V1';
const MAX_EVENTS = 50;

export async function logCallDiagnostic(event: Omit<CallDiagnosticEvent, 'at'>): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: CallDiagnosticEvent[] = raw ? JSON.parse(raw) : [];
    list.push({ ...event, at: new Date().toISOString() });
    await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_EVENTS)));
  } catch { /* diagnostics must never break the real call pipeline */ }
}

export async function getCallDiagnostics(): Promise<CallDiagnosticEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: CallDiagnosticEvent[] = raw ? JSON.parse(raw) : [];
    // Newest first for display.
    return [...list].reverse();
  } catch { return []; }
}

export async function clearCallDiagnostics(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => {});
}
