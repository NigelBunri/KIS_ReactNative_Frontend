// src/services/calls/virtualBgService.ts
//
// Virtual background processor.
//
// Architecture:
//   1. captureRef() from react-native-view-shot grabs the local RTCView at ~10 fps.
//   2. The captured JPEG URI is stored as `frameUri`.
//   3. The call screen swaps the RTCView for an <Svg><Image filter="blur"/> to
//      show the processed frame locally.
//   4. For the transmitted stream, replaceTrack() swaps in a canvas-based track
//      when mediasoup-client / vision-camera frame processor are available.
//      Without those, the local preview is processed but peers see the raw stream.
//
// Usage:
//   const proc = new VirtualBgProcessor(rtcViewRef);
//   proc.start({ mode: 'blur', blurRadius: 10 });
//   // Read proc.frameUri periodically or subscribe via proc.onFrame
//   proc.stop();

import { useRef, useEffect, useState, useCallback } from 'react';
import { NativeModules } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { webRTCService } from './webRTCService';

// Real, on-device segmentation applied to the OUTGOING video track (feature
// F) — see android/app/src/main/java/com/kingdom/impact/virtualbg/ and
// ios/KISVirtualBackground/ for the native Vision (iOS) / ML Kit Selfie
// Segmentation (Android) pipelines this drives. Both plug into
// react-native-webrtc's VideoFrameProcessorDelegate extension point, which
// sits between the camera capturer and RTCVideoSource — every remote
// participant (P2P or SFU) sees the processed frame, not just the local
// preview built below by VirtualBgProcessor/captureRef.
const NativeVirtualBg = NativeModules.KISVirtualBackgroundModule as
  | { configure(mode: string, blurRadius: number, imageUri: string | null): Promise<boolean>; clear(): Promise<boolean>; isAvailable(): Promise<boolean> }
  | undefined;

export const virtualBackgroundNativeAvailable = !!NativeVirtualBg;

/**
 * Pushes the current mode/blur/background-image config to the native
 * module, then activates (or deactivates) the registered video-effect
 * processor on the actual local video track — this is the one call that
 * makes the effect visible to remote participants, not just this device's
 * own local preview. Safe no-op on platforms/builds without the native
 * module (e.g. a dev build predating this feature, or web).
 */
export async function applyVirtualBackgroundToTrack(config: VirtualBgConfig): Promise<void> {
  if (!NativeVirtualBg) return;
  const track = webRTCService.getLocalStream()?.getVideoTracks?.()?.[0];
  if (!track) return;

  try {
    if (config.mode === 'none') {
      track._setVideoEffects?.([]);
      await NativeVirtualBg.clear();
      return;
    }
    await NativeVirtualBg.configure(config.mode, config.blurRadius ?? 12, config.imageUri ?? null);
    track._setVideoEffect?.('kis-virtualbg');
  } catch (err) {
    console.warn('[virtualBg] applyVirtualBackgroundToTrack failed:', err);
  }
}

export type VirtualBgConfig = {
  mode: 'none' | 'blur' | 'image';
  blurRadius?: number;   // for blur mode (default 12)
  imageUri?: string;     // for image mode
};

type FrameCallback = (uri: string) => void;

const DEFAULT_FPS = 10;
const CAPTURE_INTERVAL_MS = Math.round(1000 / DEFAULT_FPS);

export class VirtualBgProcessor {
  private _ref: React.RefObject<any>;
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _config: VirtualBgConfig = { mode: 'none' };
  private _callbacks: Set<FrameCallback> = new Set();
  private _capturing = false; // prevents overlapping captureRef calls

  frameUri: string | null = null;

  constructor(viewRef: React.RefObject<any>) {
    this._ref = viewRef;
  }

  get isActive(): boolean { return this._config.mode !== 'none' && !!this._timer; }
  get config(): VirtualBgConfig { return { ...this._config }; }

  start(config: VirtualBgConfig): void {
    this._config = config;
    this.stop(); // stop any previous loop
    if (config.mode === 'none') { this.frameUri = null; return; }

    this._timer = setInterval(async () => {
      if (!this._ref.current || this._capturing) return;
      this._capturing = true;
      try {
        const uri = await captureRef(this._ref, {
          format: 'jpg',
          quality: 0.65,
          result: 'tmpfile',
        });
        this.frameUri = uri;
        this._callbacks.forEach(cb => cb(uri));
      } catch {
        // View may not be mounted yet - suppress
      } finally {
        this._capturing = false;
      }
    }, CAPTURE_INTERVAL_MS);
  }

  stop(): void {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.frameUri = null;
  }

  onFrame(cb: FrameCallback): () => void {
    this._callbacks.add(cb);
    return () => this._callbacks.delete(cb);
  }
}

/**
 * React hook that manages a VirtualBgProcessor for a given ref.
 * Returns the latest processed frame URI and a setter for the config.
 */
export function useVirtualBg(viewRef: React.RefObject<any>) {
  const processor = useRef(new VirtualBgProcessor(viewRef));
  const [frameUri, setFrameUri] = useState<string | null>(null);
  const [config, setConfigState] = useState<VirtualBgConfig>({ mode: 'none' });

  useEffect(() => {
    const unsub = processor.current.onFrame(uri => setFrameUri(uri));
    return () => { unsub(); processor.current.stop(); };
  }, []);

  const setConfig = useCallback((c: VirtualBgConfig) => {
    setConfigState(c);
    if (c.mode === 'none') {
      processor.current.stop();
      setFrameUri(null);
    } else {
      processor.current.start(c);
    }
    void applyVirtualBackgroundToTrack(c);
  }, []);

  return { frameUri, config, setConfig, processor: processor.current };
}
