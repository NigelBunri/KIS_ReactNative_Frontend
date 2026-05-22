// src/services/calls/audioRouteManager.ts
import { NativeModules, Platform } from 'react-native';

// Tries react-native-incall-manager first, falls back to platform NativeModules.
let InCallManager: any = null;
try {
  InCallManager = require('react-native-incall-manager').default;
} catch {}

class AudioRouteManager {
  private _speakerOn = false;

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

  startRingtone() {
    try { InCallManager?.startRingtone?.('_DEFAULT_'); } catch {}
  }

  stopRingtone() {
    try { InCallManager?.stopRingtone?.(); } catch {}
  }

  // Ringback tone: played on the caller's side while waiting for the remote to answer
  startRingback() {
    try { InCallManager?.startRingback?.('_DEFAULT_'); } catch {}
  }

  stopRingback() {
    try { InCallManager?.stopRingback?.(); } catch {}
  }
}

export const audioRouteManager = new AudioRouteManager();
