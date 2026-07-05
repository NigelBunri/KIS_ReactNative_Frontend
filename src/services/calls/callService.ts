// src/services/calls/callService.ts
// Stateful call service — wraps webRTCService with higher-level operations
// (screen share toggle, DTLS fingerprint extraction, etc.)

import { webRTCService } from './webRTCService';

/** Tracks the original camera video track so we can restore it after screen share. */
let _originalVideoTrack: any = null;
/** The active screen-capture track, so toggle-off can stop ONLY it (not the camera). */
let _screenTrack: any = null;
/** Whether screen share is currently active (per-session guard). */
const _screenShareState: Record<string, boolean> = {};

/**
 * Toggle screen sharing for the given call session.
 *
 * On first call (sharing off → on):
 *   1. Tries `mediaDevices.getDisplayMedia` (react-native-webrtc ≥ 106 + OS support).
 *   2. Throws `Error('SCREEN_SHARE_UNAVAILABLE')` if getDisplayMedia is unavailable
 *      or fails — callers must surface this to the user rather than silently
 *      swapping in the camera, which would misrepresent what's being shared.
 *   3. Replaces the video sender track in all active peer connections.
 *   4. Emits `call.screen_share` with `{ conversationId, enabled: true }` via the socket.
 *   5. Returns the new isScreenSharing value (true).
 *
 * On second call (sharing on → off):
 *   1. Stops the screen capture track.
 *   2. Restores the original camera track.
 *   3. Emits `call.screen_share` with `{ conversationId, enabled: false }`.
 *   4. Returns false.
 *
 * @param sessionId     The active call session ID.
 * @param socket        Socket.IO socket instance used for signaling.
 * @param peerIds       List of remote peer IDs (kept for future targeted use).
 * @returns             The new `isScreenSharing` boolean value.
 */
export async function toggleScreenShare(
  sessionId: string,
  socket: any | null,
  _peerIds: string[],
): Promise<boolean> {
  const isCurrentlySharing = !!_screenShareState[sessionId];

  if (isCurrentlySharing) {
    // ── TOGGLE OFF ──────────────────────────────────────────────────────────
    const localStream = webRTCService.getLocalStream();

    // Stop ONLY the screen-capture track. Previously this stopped EVERY video
    // track on the local stream — which includes the camera track (it is never
    // removed from the local stream during screen share). That killed the camera
    // permanently, so restoring _originalVideoTrack below put a dead track back
    // on the senders and the local participant went black after un-sharing.
    if (_screenTrack) {
      try { _screenTrack.stop(); } catch { /* ignore */ }
      _screenTrack = null;
    }

    // Restore original camera track across all peer connections
    if (_originalVideoTrack && localStream) {
      try {
        _originalVideoTrack.enabled = true;
        const peerConns = (webRTCService as any).peers as Map<string, any>;
        peerConns?.forEach((pc: any) => {
          try {
            const senders: any[] = pc.getSenders?.() ?? [];
            const videoSender = senders.find((s: any) => s.track?.kind === 'video');
            if (videoSender) videoSender.replaceTrack(_originalVideoTrack);
          } catch { /* ignore */ }
        });
      } catch { /* ignore */ }
      _originalVideoTrack = null;
    }

    socket?.emit('call.screen_share', { conversationId: sessionId, enabled: false });
    _screenShareState[sessionId] = false;
    return false;
  }

  // ── TOGGLE ON ─────────────────────────────────────────────────────────────
  let screenStream: any = null;

  try {
    let RNW: any = null;
    try { RNW = require('react-native-webrtc'); } catch { /* not installed */ }

    // No camera fallback below: silently swapping in the camera would
    // misrepresent what's actually being shared (the user's face instead of
    // their screen), so any failure to get a real screen stream must
    // propagate as an explicit error for the caller to surface to the user.
    if (!RNW || typeof RNW.mediaDevices?.getDisplayMedia !== 'function') {
      throw new Error('SCREEN_SHARE_UNAVAILABLE');
    }

    // Save existing camera track before swapping
    const localStream = webRTCService.getLocalStream();
    if (localStream) {
      const videoTracks: any[] = localStream.getVideoTracks?.() ?? [];
      if (videoTracks.length > 0) {
        _originalVideoTrack = videoTracks[0];
      }
    }

    try {
      screenStream = await RNW.mediaDevices.getDisplayMedia({ video: true });
    } catch {
      _originalVideoTrack = null;
      throw new Error('SCREEN_SHARE_UNAVAILABLE');
    }

    // Replace video sender track in each peer connection
    if (screenStream) {
      const screenVideoTrack = screenStream.getVideoTracks?.()?.[0];
      if (screenVideoTrack) {
        // Remember the screen track so toggle-off can stop exactly this one.
        _screenTrack = screenVideoTrack;
        const peerConns = (webRTCService as any).peers as Map<string, any>;
        peerConns?.forEach((pc: any) => {
          try {
            const senders: any[] = pc.getSenders?.() ?? [];
            const videoSender = senders.find((s: any) => s.track?.kind === 'video');
            if (videoSender) videoSender.replaceTrack(screenVideoTrack);
          } catch { /* ignore */ }
        });
      }
    }
  } catch (err) {
    console.warn('[callService] toggleScreenShare failed:', err);
    _screenShareState[sessionId] = false;
    // Rethrow so the caller can distinguish "screen share unavailable" from a
    // successful toggle-off and surface an explicit error to the user,
    // instead of silently reporting isScreenSharing = false as if nothing
    // was ever attempted.
    throw err;
  }

  socket?.emit('call.screen_share', { conversationId: sessionId, enabled: true });
  _screenShareState[sessionId] = true;
  return true;
}

/**
 * Parse the DTLS fingerprint from a remote SDP string.
 * Looks for the first `a=fingerprint:` attribute.
 *
 * @returns The fingerprint string, e.g. "sha-256 AA:BB:CC:..." or null.
 */
export function extractDtlsFingerprint(sdp: string | undefined | null): string | null {
  if (!sdp) return null;
  const match = sdp.match(/a=fingerprint:([^\r\n]+)/i);
  if (!match) return null;
  return match[1].trim();
}

/**
 * Read the DTLS fingerprint from an established peer connection's remote SDP.
 * Returns null if no peer connection exists or remote description is not set.
 *
 * @param peerId  ID of the remote peer whose connection to inspect.
 */
export function getDtlsFingerprintForPeer(peerId: string): string | null {
  const peerConns = (webRTCService as any).peers as Map<string, any> | undefined;
  if (!peerConns) return null;
  const pc = peerConns.get(peerId);
  if (!pc) return null;
  const sdp: string | undefined = pc.remoteDescription?.sdp;
  return extractDtlsFingerprint(sdp);
}
