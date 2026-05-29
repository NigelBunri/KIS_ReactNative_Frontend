// src/services/calls/audioRouteManager.ts
import { NativeModules, Platform } from 'react-native';

// Tries react-native-incall-manager first, falls back to platform NativeModules.
let InCallManager: any = null;
try {
  InCallManager = require('react-native-incall-manager').default;
} catch {}

// Fallback audio player for ringtone/ringback when InCallManager is unavailable.
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

// System ringtone URIs — Android supports content:// for the default ringtone.
// iOS falls back to vibration only without a bundled audio file.
const SYSTEM_RINGTONE_URI = Platform.select({
  android: 'content://settings/system/ringtone',
  default: undefined,
});

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
      if (InCallManager) {
        InCallManager.stop();
      }
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

  private _playRingtoneLoop(activeFlag: '_ringtoneActive' | '_ringbackActive') {
    if (!SYSTEM_RINGTONE_URI) return;
    const player = getARPlayer();
    if (!player) return;
    // Play once, then repeat via progress listener detecting end-of-track
    const play = () => {
      if (!this[activeFlag]) return;
      player.startPlayer(SYSTEM_RINGTONE_URI).catch(() => { this[activeFlag] = false; });
    };
    // Use playback progress to detect completion (position ~= duration)
    player.addPlayBackListener?.((e: any) => {
      if (!this[activeFlag]) { player.removePlayBackListener?.(); return; }
      const dur = e?.duration ?? e?.durationMs ?? 0;
      const pos = e?.currentPosition ?? e?.currentPositionMs ?? 0;
      if (dur > 0 && pos >= dur - 300) play();
    });
    play();
  }

  startRingtone() {
    if (InCallManager) {
      try { InCallManager.startRingtone('_DEFAULT_'); } catch {}
      return;
    }
    this._ringtoneActive = true;
    this._playRingtoneLoop('_ringtoneActive');
  }

  stopRingtone() {
    this._ringtoneActive = false;
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

  // Ringback tone: played on the caller's side while waiting for the remote to answer
  startRingback() {
    if (InCallManager) {
      try { InCallManager.startRingback('_DEFAULT_'); } catch {}
      return;
    }
    this._ringbackActive = true;
    this._playRingtoneLoop('_ringbackActive');
  }

  stopRingback() {
    this._ringbackActive = false;
    if (InCallManager) {
      try { InCallManager.stopRingback(); } catch {}
      return;
    }
    try {
      const p = getARPlayer();
      p?.removePlayBackListener?.();
      p?.stopPlayer?.();
    } catch {}
  }
}

export const audioRouteManager = new AudioRouteManager();
