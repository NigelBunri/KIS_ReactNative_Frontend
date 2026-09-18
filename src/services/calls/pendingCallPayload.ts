// src/services/calls/pendingCallPayload.ts
//
// Fixes a real cold-start bug: CallKit's (iOS) and ConnectionService's
// (Android) native "answerCall"/"endCall" events carry ONLY a bare
// callUUID — confirmed directly from react-native-callkeep's own native
// source (ios/RNCallKeep/RNCallKeep.m: `body:@{ @"callUUID": ... }`, nothing
// else). SocketProvider.tsx's onAnswerCall/onEndCall handlers only proceed
// if activeCallRef.current already holds a session matching that UUID — but
// activeCallRef is populated exclusively by the socket's own `call.offer`
// event. A backgrounded/killed recipient who was woken purely by a native
// VoIP push (iOS) or a background FCM data message (Android) never
// necessarily receives that socket event at all: Socket.IO does not replay
// missed room broadcasts to a client that (re)connects afterward, and there
// is no gap-fill mechanism for calls the way there is for chat messages
// (see chat.gap_check/chat.gap_fill). Concretely: the native call UI rings
// correctly, the user taps Answer, and nothing happens — the call just
// times out to "missed" on the backend, because the app never actually
// told anyone it was answered.
//
// The fix: persist the same minimal payload the push itself already
// carries (callId, conversationId, callType, caller info) the moment an
// incoming-call signal arrives — before the user has a chance to act on
// the native UI — so that if activeCallRef ever comes up empty when the
// user answers/declines, there's still enough information to reconstruct a
// working CallSession and proceed, instead of silently no-op'ing.
//
// Single-key (not per-callId): the app already enforces at most one
// active/ringing call at a time server-side (CALL_ALREADY_ACTIVE), so a
// single "most recent pending call" slot is sufficient and simpler than
// per-callId bookkeeping — this is exactly the same simplification
// SocketProvider.tsx's own single `activeCall` state already makes.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

export type PendingCallPayload = {
  callId: string;
  conversationId: string;
  callType: string;
  callerName?: string;
  fromUserId?: string;
  title?: string;
};

const KEY = 'KIS_PENDING_INCOMING_CALL_V1';

export async function savePendingCallPayload(payload: PendingCallPayload): Promise<void> {
  if (!payload?.callId || !payload?.conversationId) return;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(payload));
  } catch { /* best-effort — the native-only fallback (iOS UserDefaults) may still have it */ }
}

export async function clearPendingCallPayload(callId?: string): Promise<void> {
  try {
    if (callId) {
      // Only clear if it's still the SAME call — a newer pending call
      // (arrived while an older one was being torn down) must not be
      // wiped out by a stale clear racing behind it.
      const raw = await AsyncStorage.getItem(KEY);
      const current: PendingCallPayload | null = raw ? JSON.parse(raw) : null;
      if (current && current.callId !== callId) return;
    }
    await AsyncStorage.removeItem(KEY);
  } catch { /* non-fatal */ }

  // Also clear the native-side UserDefaults copy on iOS (AppDelegate.swift
  // writes it independently of AsyncStorage, before JS is guaranteed to be
  // running) — otherwise it lingers until overwritten by the next incoming
  // call. Harmless either way (getPendingCallPayload re-checks callId
  // against the requested callUUID before trusting it), but there's no
  // reason to leave stale call data sitting in UserDefaults once handled.
  if (Platform.OS === 'ios') {
    try {
      await NativeModules?.PendingCallModule?.clearPendingCall?.();
    } catch { /* native module not present/linked — nothing to clear */ }
  }
}

/**
 * Reads the most recently persisted pending call. On iOS, also checks the
 * native PendingCallModule (backed by UserDefaults, written synchronously
 * by AppDelegate.swift's PKPushRegistryDelegate BEFORE JS is guaranteed to
 * be running) as a fallback — a true cold start (app was fully killed) may
 * answer/decline before JS has ever had a chance to mirror the native write
 * into AsyncStorage itself, so the native store is the only reliably
 * available source for that first read.
 */
export async function getPendingCallPayload(): Promise<PendingCallPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.callId && parsed?.conversationId) return parsed;
    }
  } catch { /* fall through to native fallback below */ }

  if (Platform.OS === 'ios') {
    try {
      const mod = NativeModules?.PendingCallModule;
      const native = await mod?.getPendingCall?.();
      if (native?.callId && native?.conversationId) {
        // Mirror into AsyncStorage so subsequent reads (and the
        // clear-by-callId check above) don't need the native round-trip
        // again this session.
        await savePendingCallPayload(native);
        return native;
      }
    } catch { /* native module not present/linked — no fallback available */ }
  }

  return null;
}
