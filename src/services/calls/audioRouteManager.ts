// src/services/calls/audioRouteManager.ts
import { NativeModules, Platform, Vibration } from 'react-native';

// Tries react-native-incall-manager first, falls back to platform NativeModules.
let InCallManager: any = null;
try {
  InCallManager = require('react-native-incall-manager').default;
} catch {}

// Fallback audio player for ringtone when InCallManager is unavailable.
let _arPlayer: any = null;
const getARPlayer = () => {
  if (!_arPlayer) {
    try {
      const { default: AudioRecorderPlayer } = require('react-native-audio-recorder-player');
      _arPlayer = new AudioRecorderPlayer();
    } catch {}
  }
  return _arPlayer;
};

// System ringtone URI — Android only (content://settings/system/ringtone).
// iOS: InCallManager handles it natively; without it we rely on Vibration alone.
const SYSTEM_RINGTONE_URI = Platform.select({
  android: 'content://settings/system/ringtone',
  default: undefined,
});

// Ringback vibration: a subtle "bip bip bip" so the caller knows it's ringing.
// On/off pattern: wait 0ms → vibrate 150ms → pause 850ms (repeats = 1s cycle).
const RINGBACK_VIBRATE_PATTERN = [0, 150, 850];

// Incoming ring vibration: loud, attention-grabbing (matches WhatsApp / FaceTime cadence).
const RINGTONE_VIBRATE_PATTERN = [0, 500, 300, 500];

class AudioRouteManager {
  private _speakerOn = false;
  private _ringtoneActive = false;
  private _ringbackActive = false;

  start(media: 'voice' | 'video') {
    this._speakerOn = media === 'video';
    try {
      if (InCallManager) {
        InCallManager.start({ media });
        if (media === 'video') InCallManager.setForceSpeakerphoneOn(true);
      } else if (Platform.OS === 'android') {
        NativeModules.AudioManager?.setMode?.(3); // MODE_IN_COMMUNICATION
      }
    } catch {}
  }

  stop() {
    this._speakerOn = false;
    try {
      if (InCallManager) InCallManager.stop();
    } catch {}
  }

  setSpeaker(on: boolean) {
    this._speakerOn = on;
    try {
      if (InCallManager) {
        InCallManager.setForceSpeakerphoneOn(on);
        if (on) InCallManager.setSpeakerphoneOn(true);
      } else if (Platform.OS === 'android') {
        NativeModules.AudioManager?.setSpeakerphoneOn?.(on);
      }
    } catch {}
  }

  toggleSpeaker(): boolean {
    this.setSpeaker(!this._speakerOn);
    return this._speakerOn;
  }

  get isSpeakerOn() {
    return this._speakerOn;
  }

  // ─── Ringtone (receiver) ────────────────────────────────────────────────────
  // Full device ringtone + vibration. Plays on the RECEIVING side only.

  startRingtone() {
    if (this._ringtoneActive) return;
    this._ringtoneActive = true;

    if (InCallManager) {
      // '_DEFAULT_' plays the user's selected ringtone at full volume.
      try { InCallManager.startRingtone('_DEFAULT_'); } catch {}
      // Also vibrate in parallel for silent/vibrate mode users.
      Vibration.vibrate(RINGTONE_VIBRATE_PATTERN, true);
      return;
    }

    // Fallback without InCallManager: audio loop + vibration.
    Vibration.vibrate(RINGTONE_VIBRATE_PATTERN, true);
    if (SYSTEM_RINGTONE_URI) {
      const player = getARPlayer();
      if (!player) return;
      const loop = () => {
        if (!this._ringtoneActive) return;
        player.startPlayer(SYSTEM_RINGTONE_URI).catch(() => { this._ringtoneActive = false; });
      };
      player.addPlayBackListener?.((e: any) => {
        if (!this._ringtoneActive) { player.removePlayBackListener?.(); return; }
        const dur = e?.duration ?? e?.durationMs ?? 0;
        const pos = e?.currentPosition ?? e?.currentPositionMs ?? 0;
        if (dur > 0 && pos >= dur - 300) loop();
      });
      loop();
    }
  }

  stopRingtone() {
    if (!this._ringtoneActive) return;
    this._ringtoneActive = false;
    Vibration.cancel();
    if (InCallManager) {
      try { InCallManager.stopRingtone(); } catch {}
      return;
    }
    try {
      const p = getARPlayer();
      p?.removePlayBackListener?.();
      p?.stopPlayer?.();
    } catch {}
  }

  // ─── Ringback (caller) ──────────────────────────────────────────────────────
  // Soft "bip bip bip" tone so the caller knows the remote phone is ringing.
  // NOT the full ringtone — that would be confusing (both sides ringing equally).

  startRingback() {
    if (this._ringbackActive) return;
    this._ringbackActive = true;

    if (InCallManager) {
      // '_RINGBACK_' plays the system ringback tone (a soft repeating beep),
      // distinct from '_DEFAULT_' which is the full device ringtone.
      try { InCallManager.startRingback('_RINGBACK_'); } catch {}
      return;
    }

    // Fallback without InCallManager: subtle vibration pulse only.
    // We deliberately avoid playing the system ringtone here — it would make
    // the caller's phone ring loudly, identical to the receiver's experience.
    Vibration.vibrate(RINGBACK_VIBRATE_PATTERN, true);
  }

  stopRingback() {
    if (!this._ringbackActive) return;
    this._ringbackActive = false;
    if (InCallManager) {
      try { InCallManager.stopRingback(); } catch {}
      return;
    }
    Vibration.cancel();
  }
}

export const audioRouteManager = new AudioRouteManager();
