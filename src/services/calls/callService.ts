// src/services/calls/callService.ts
// Stateful call service - wraps webRTCService with higher-level operations
// (screen share toggle, DTLS fingerprint extraction, etc.)

import { Platform } from 'react-native';
import { webRTCService, presentIOSScreenCapturePicker } from './webRTCService';
import { sfuService } from './sfuService';

/** Ref to the mounted, invisible ScreenCapturePickerView (see
 * ActiveCallScreen's IOSScreenSharePicker) — registered by whichever screen
 * is currently showing call controls, since this module has no component
 * tree of its own to mount that native view in. */
let _iosPickerRef: { current: any } | null = null;
export function registerIOSScreenCapturePickerRef(ref: { current: any } | null) {
  _iosPickerRef = ref;
}

/** Tracks the original camera video track so we can restore it after screen share. */
let _originalVideoTrack: any = null;
/** The active screen-capture track, so toggle-off can stop ONLY it (not the camera). */
let _screenTrack: any = null;
/** Whether screen share is currently active (per-session guard). */
const _screenShareState: Record<string, boolean> = {};
/** The socket + sessionId currently bound to the active screen share, so the
 * spontaneous-stop path (the track's own 'ended' event, fired when the OS-level
 * stop-sharing control is used) can emit the same signaling event the explicit
 * toggle-off path does, without the caller having to pass them in again. */
let _activeShareSocket: any = null;
let _activeShareSessionId: string | null = null;

type ScreenShareEndedHandler = (sessionId: string, reason: 'manual' | 'track-ended') => void;
/** Mirrors webRTCService's setCallbacks convention (a settable handler,
 * no-op by default) - fired any time sharing stops, whether via an explicit
 * toggle-off call or the OS-level control ending the track out from under us.
 * A caller's own `isScreenSharing` UI state must come from THIS, not only
 * from toggleScreenShare's return value, since a spontaneous stop has no
 * caller to return a value to. */
let onScreenShareEnded: ScreenShareEndedHandler = () => {};

/** Fired when adding the screen track to a peer connection required a brand
 * new video sender (true whenever that peer had no pre-existing video m-line
 * - i.e. a voice/voice-group call, which never negotiated video at all).
 * Unlike replaceTrack (reuses an already-negotiated m-line, no signaling
 * needed), a NEW sender changes the SDP shape and the remote side cannot
 * decode anything until a fresh offer/answer round trip happens. The caller
 * (SocketProvider, which owns the socket + callId) must send this offer via
 * 'call.sdp.offer' the same way it already does for ICE restarts. */
type RenegotiationHandler = (peerId: string, offer: any) => void;
let onRenegotiationNeeded: RenegotiationHandler = () => {};

export function setScreenShareCallbacks(cb: {
  onScreenShareEnded?: ScreenShareEndedHandler;
  onRenegotiationNeeded?: RenegotiationHandler;
}) {
  if (cb.onScreenShareEnded) onScreenShareEnded = cb.onScreenShareEnded;
  if (cb.onRenegotiationNeeded) onRenegotiationNeeded = cb.onRenegotiationNeeded;
}

/**
 * Attach the currently-active screen-share track (if any) to one specific
 * peer connection, creating it first if it doesn't exist yet.
 *
 * Root-cause fix for "a viewer joining an already-in-progress share doesn't
 * see it": webRTCService.buildPeer() seeds a brand-new peer connection's
 * senders strictly from the local camera/mic MediaStream - it has no idea a
 * screen share is active, because the screen track is deliberately kept out
 * of that stream (see the comment on `_screenTrack` above). A late joiner's
 * peer connection was therefore always built with the camera track (or no
 * video track at all), never the screen.
 *
 * Calling this BEFORE the initial offer is created for a new peer (see
 * SocketProvider's startWebRTCOffer) means the very first SDP offer/answer
 * with that peer already carries the screen content - no extra renegotiation
 * round trip is needed for a peer that has never negotiated before.
 */
export function applyActiveScreenShareToPeer(peerId: string): void {
  if (!_screenTrack) return; // no share in progress
  try {
    const ensure = (webRTCService as any).ensurePeerConnection as ((id: string) => any) | undefined;
    const pc = ensure ? ensure.call(webRTCService, peerId) : (webRTCService as any).peers?.get?.(peerId);
    if (!pc) return;
    const senders: any[] = pc.getSenders?.() ?? [];
    const videoSender = senders.find((s: any) => s.track?.kind === 'video');
    if (videoSender) {
      videoSender.replaceTrack(_screenTrack);
    } else {
      pc.addTrack(_screenTrack);
    }
  } catch { /* ignore - best effort */ }
}

/** Shared by the explicit toggle-off path and the screen track's own 'ended'
 * listener (OS-level stop-sharing control) - stops the screen track if it
 * isn't already stopped, restores the camera across every peer connection,
 * tells the server sharing stopped, and notifies onScreenShareEnded so the
 * UI's button/badge state resyncs even when nothing called toggleScreenShare
 * to trigger this. */
async function stopScreenShareInternal(sessionId: string, socket: any | null, reason: 'manual' | 'track-ended') {
  // Stop ONLY the screen-capture track. Previously this stopped EVERY video
  // track on the local stream - which includes the camera track (it is never
  // removed from the local stream during screen share). That killed the camera
  // permanently, so restoring _originalVideoTrack below put a dead track back
  // on the senders and the local participant went black after un-sharing.
  if (_screenTrack) {
    try { _screenTrack.stop(); } catch { /* ignore */ }
    _screenTrack = null;
  }

  // Restore the original camera track (video calls) OR, for a voice call that
  // had NO camera track to begin with, replace with `null` to stop sending on
  // the video sender/producer that was freshly created for the screen share
  // (see the TOGGLE ON path below) rather than leaving it transmitting a
  // stopped/frozen track forever. Previously this whole block was gated on
  // `_originalVideoTrack` being truthy, so a voice call's dynamically-added
  // video sender/producer was NEVER cleaned up on stop - every other
  // participant kept decoding a dead, stopped MediaStreamTrack indefinitely.
  // `sender.replaceTrack(null)` and `producer.pause()` (inside
  // sfuService.replaceTrack) are both well-defined no-renegotiation
  // operations, so this is safe to run unconditionally whenever a video
  // sender/producer exists at all.
  try {
    if (_originalVideoTrack) _originalVideoTrack.enabled = true;
    const peerConns = (webRTCService as any).peers as Map<string, any>;
    peerConns?.forEach((pc: any) => {
      try {
        const senders: any[] = pc.getSenders?.() ?? [];
        const videoSender = senders.find((s: any) => s.track?.kind === 'video');
        if (videoSender) videoSender.replaceTrack(_originalVideoTrack);
      } catch { /* ignore */ }
    });
    // Same restore on the SFU side for a call that's upgraded to group
    // media — see the matching comment in the toggle-on path below for
    // why this is required, not optional.
    if (sfuService.isJoined) {
      await sfuService.replaceTrack('video', _originalVideoTrack);
    }
  } catch { /* ignore */ }
  _originalVideoTrack = null;

  socket?.emit('call.screen_share', { conversationId: sessionId, enabled: false });
  _screenShareState[sessionId] = false;
  if (_activeShareSessionId === sessionId) {
    _activeShareSocket = null;
    _activeShareSessionId = null;
  }
  onScreenShareEnded(sessionId, reason);
}

/**
 * Toggle screen sharing for the given call session.
 *
 * On first call (sharing off → on):
 *   1. Tries `mediaDevices.getDisplayMedia` (react-native-webrtc ≥ 106 + OS support).
 *   2. Throws `Error('SCREEN_SHARE_UNAVAILABLE')` if getDisplayMedia is unavailable
 *      or fails - callers must surface this to the user rather than silently
 *      swapping in the camera, which would misrepresent what's being shared.
 *   3. Replaces the video sender track in all active peer connections.
 *   4. Emits `call.screen_share` with `{ conversationId, enabled: true }` via the socket.
 *   5. Attaches an 'ended' listener to the screen track so stopping sharing via
 *      the OS-level control (the status-bar "Stop" button on iOS, the persistent
 *      "Stop sharing" notification on Android) is detected and cleaned up too -
 *      see stopScreenShareInternal/onScreenShareEnded.
 *   6. Returns the new isScreenSharing value (true).
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
    await stopScreenShareInternal(sessionId, socket, 'manual');
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

    // AND-098: on iOS, getDisplayMedia() never shows any UI itself — it only
    // waits for the RTCScreenSharingExtension broadcast extension to connect,
    // which only happens once the user picks it from ReplayKit's system
    // broadcast sheet. That sheet must be explicitly triggered first via the
    // invisible ScreenCapturePickerView mounted by the active call screen; if
    // it isn't mounted (e.g. this is reached outside an active call, or the
    // native view failed to register), there is no way to ever start an iOS
    // screen share, so fail fast with the same error callers already handle
    // rather than hanging on a getDisplayMedia() call that can never resolve.
    if (Platform.OS === 'ios') {
      const presented = _iosPickerRef && presentIOSScreenCapturePicker(_iosPickerRef);
      if (!presented) {
        _originalVideoTrack = null;
        throw new Error('SCREEN_SHARE_UNAVAILABLE');
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
        _activeShareSocket = socket;
        _activeShareSessionId = sessionId;

        // The PRIMARY real-world way users stop a screen share on both iOS
        // and Android is the OS-level control (status-bar "Stop" / the
        // persistent "Stop sharing" notification), not this app's own
        // toggle button - that kills the track directly, out from under us,
        // with no call back into this file. Without this listener,
        // _screenShareState stayed stuck `true`, the camera was never
        // restored, the server was never told sharing stopped, and every
        // other participant's UI stayed showing this person as still
        // sharing indefinitely. `once: true` (where supported) avoids a
        // double-fire if this same listener setup ever runs twice for one
        // track; the explicit-toggle-off path already stops this exact
        // track above (`_screenTrack.stop()`), which also fires 'ended' -
        // stopScreenShareInternal checks _screenShareState so that second,
        // self-inflicted firing is a correctly-idempotent no-op rather than
        // a double cleanup.
        try {
          const handleEnded = () => {
            if (!_screenShareState[sessionId]) return; // already cleaned up (manual toggle-off)
            void stopScreenShareInternal(sessionId, _activeShareSocket, 'track-ended');
          };
          if (typeof screenVideoTrack.addEventListener === 'function') {
            screenVideoTrack.addEventListener('ended', handleEnded);
          } else {
            // react-native-webrtc's MediaStreamTrack also supports the
            // plain onended property form on some versions/platforms.
            screenVideoTrack.onended = handleEnded;
          }
        } catch { /* ignore - best effort, the explicit toggle still works without it */ }

        const peerConns = (webRTCService as any).peers as Map<string, any>;
        // Root-cause fix: a voice/voice-group call's peer connections never
        // negotiated a video m-line in the first place (buildPeer() only
        // adds tracks present in the local camera/mic stream, and a voice
        // call's local stream has no video track at all - see
        // webRTCService.ts's buildPeer()). `senders.find(video)` then finds
        // NOTHING, so replaceTrack() was silently a no-op and the screen
        // track never reached these peers - the single most common "sender
        // sees local preview, receiver sees nothing" bug. replaceTrack only
        // works when a video sender ALREADY exists (video/video-group
        // calls); when none exists, a brand new sender must be added via
        // addTrack(), which changes the SDP shape and REQUIRES a fresh
        // offer/answer round trip - collected into peersNeedingRenegotiation
        // and signaled via onRenegotiationNeeded below, after every peer
        // connection has been mutated.
        const peersNeedingRenegotiation: string[] = [];
        peerConns?.forEach((pc: any, peerId: string) => {
          try {
            const senders: any[] = pc.getSenders?.() ?? [];
            const videoSender = senders.find((s: any) => s.track?.kind === 'video');
            if (videoSender) {
              videoSender.replaceTrack(screenVideoTrack);
            } else {
              pc.addTrack(screenVideoTrack);
              peersNeedingRenegotiation.push(peerId);
            }
          } catch { /* ignore */ }
        });
        for (const peerId of peersNeedingRenegotiation) {
          try {
            const offer = await webRTCService.createOffer(peerId);
            if (offer) onRenegotiationNeeded(peerId, offer);
          } catch { /* ignore */ }
        }
        // A group call that's upgraded to the SFU sends video through a
        // mediasoup producer, not direct peer connections — without this,
        // starting screen share only ever reached the P2P mesh (empty/
        // irrelevant once a call has upgraded), so every participant
        // reached via the SFU kept seeing the camera feed instead of the
        // shared screen. Same dual-path requirement as noise cancellation
        // (see webRTCService.ts's setNoiseCancellation).
        if (sfuService.isJoined) {
          await sfuService.replaceTrack('video', screenVideoTrack);
        }
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
