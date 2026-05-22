// src/services/liveStreamingService.ts
//
// Core live-streaming service.
//
// Architecture
// ──────────────────────────────────────────────────────────────────────────────
//
//  Broadcaster (this app)             KIS Media Server
//  ──────────────────────             ────────────────
//  Device camera (front/back)  ─WHIP→ WHIP ingest endpoint
//  OBS / hardware encoder      ─RTMP→ RTMP ingest endpoint
//
//  Media Server                       Audience (LiveWatchPage)
//  ────────────                       ───────────────────────
//  Transcoder          ──HLS/DASH──→  react-native-video player
//  Camera source mixer ←── switch ─── LiveControlRoom API call
//
// WHIP (WebRTC HTTP Ingest Protocol):
//   1. POST /whip/{streamId}  →  SDP offer  →  SDP answer (201 + Location)
//   2. PATCH {location}       →  ICE candidate trickle
//   3. DELETE {location}      →  teardown
//
// The service dynamically imports react-native-webrtc so the app still
// builds when WebRTC is absent (audio-only or OBS-only use cases).
// ──────────────────────────────────────────────────────────────────────────────

import { DeviceEventEmitter } from 'react-native';
import { getAccessToken } from '@/security/authStorage';

// ── Dynamic WebRTC import ─────────────────────────────────────────────────────

let _RTCPeerConnection: any = null;
let _RTCSessionDescription: any = null;
let _mediaDevices: any = null;

try {
  const webrtc = require('react-native-webrtc');
  _RTCPeerConnection   = webrtc.RTCPeerConnection;
  _RTCSessionDescription = webrtc.RTCSessionDescription;
  _mediaDevices        = webrtc.mediaDevices;
} catch {}

export const webRTCStreamingAvailable = !!_RTCPeerConnection;

// ── Public types ──────────────────────────────────────────────────────────────

export type CameraFacing = 'front' | 'back';

export type CameraSource = {
  id: string;
  label: string;
  facing?: CameraFacing;
  isActive: boolean;
  isExternal: boolean; // true = RTMP source (OBS, hardware, other device)
  thumbnailUrl?: string;
};

export type StreamHealthStats = {
  bitrateBps: number;        // outbound video bitrate
  frameRate: number;         // frames per second
  packetsLost: number;       // cumulative lost packets
  roundTripTimeMs: number;   // ICE round-trip time
  audioLevelDb: number;      // input audio level 0–100
  resolution: { width: number; height: number };
  isConnected: boolean;
};

export type BroadcastConfig = {
  streamId: string;
  whipEndpoint: string;    // full URL e.g. https://api.example.com/.../whip/
  facing?: CameraFacing;
  maxBitrateBps?: number;  // default 2_500_000 (2.5 Mbps)
  maxFrameRate?: number;   // default 30
};

// ── ICE servers ───────────────────────────────────────────────────────────────

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

// ── Service ───────────────────────────────────────────────────────────────────

type StatsCallback = (stats: StreamHealthStats) => void;
type ErrorCallback = (error: Error) => void;
type StateCallback = (state: 'idle' | 'connecting' | 'live' | 'stopped') => void;

class LiveStreamingService {
  private pc: any = null;
  private localStream: any = null;
  private whipResourceUrl: string | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private prevBytesSent = 0;
  private prevStatsTs = 0;

  private _stats: StreamHealthStats = {
    bitrateBps: 0, frameRate: 0, packetsLost: 0,
    roundTripTimeMs: 0, audioLevelDb: 0,
    resolution: { width: 0, height: 0 }, isConnected: false,
  };

  private statsCbs: StatsCallback[]  = [];
  private errorCbs: ErrorCallback[]  = [];
  private stateCbs: StateCallback[]  = [];
  private pendingCandidates: any[]   = [];
  private _facing: CameraFacing      = 'front';
  private _state: 'idle' | 'connecting' | 'live' | 'stopped' = 'idle';

  // ── Public getters ──────────────────────────────────────────────────────────

  get isLive()     { return this._state === 'live'; }
  get state()      { return this._state; }
  get stats()      { return this._stats; }
  get facing()     { return this._facing; }
  get localStreamRef() { return this.localStream; }

  // ── Subscriptions ───────────────────────────────────────────────────────────

  onStats(cb: StatsCallback) {
    this.statsCbs.push(cb);
    return () => { this.statsCbs = this.statsCbs.filter(f => f !== cb); };
  }
  onError(cb: ErrorCallback) {
    this.errorCbs.push(cb);
    return () => { this.errorCbs = this.errorCbs.filter(f => f !== cb); };
  }
  onStateChange(cb: StateCallback) {
    this.stateCbs.push(cb);
    return () => { this.stateCbs = this.stateCbs.filter(f => f !== cb); };
  }

  private emit(stats: StreamHealthStats) {
    this._stats = stats;
    this.statsCbs.forEach(cb => cb(stats));
  }
  private emitError(e: Error) {
    this.errorCbs.forEach(cb => cb(e));
  }
  private setState(s: 'idle' | 'connecting' | 'live' | 'stopped') {
    this._state = s;
    this.stateCbs.forEach(cb => cb(s));
    DeviceEventEmitter.emit('livestream.state', { state: s });
  }

  // ── Start broadcast ─────────────────────────────────────────────────────────

  async startBroadcast(config: BroadcastConfig): Promise<void> {
    if (!webRTCStreamingAvailable) {
      throw new Error(
        'WebRTC is not available. Use OBS/RTMP ingest instead.',
      );
    }
    if (this._state === 'connecting' || this._state === 'live') return;

    this.setState('connecting');
    this._facing = config.facing ?? 'front';

    try {
      // 1. Capture device camera
      this.localStream = await _mediaDevices.getUserMedia({
        video: {
          facingMode: this._facing === 'back' ? 'environment' : 'user',
          width:     { ideal: 1280, max: 1920 },
          height:    { ideal: 720,  max: 1080 },
          frameRate: { ideal: config.maxFrameRate ?? 30, max: 60 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
      });

      // 2. Create peer connection
      this.pc = new _RTCPeerConnection({
        iceServers: ICE_SERVERS,
        sdpSemantics: 'unified-plan',
      });
      this.pendingCandidates = [];

      this.localStream.getTracks().forEach((track: any) => {
        this.pc.addTrack(track, this.localStream);
      });

      // Apply max bitrate via SDP encoding params after addTrack
      if (config.maxBitrateBps) {
        const videoSender = this.pc
          .getSenders()
          .find((s: any) => s.track?.kind === 'video');
        if (videoSender) {
          const params = videoSender.getParameters();
          if (params.encodings?.length) {
            params.encodings[0].maxBitrate = config.maxBitrateBps;
          }
          await videoSender.setParameters(params).catch(() => {});
        }
      }

      this.pc.addEventListener('icecandidate', ({ candidate }: any) => {
        if (!candidate) return;
        if (this.whipResourceUrl) {
          this.sendIceTrickle(candidate).catch(() => {});
        } else {
          this.pendingCandidates.push(candidate);
        }
      });

      this.pc.addEventListener('connectionstatechange', () => {
        const cs: string = this.pc?.connectionState ?? '';
        if (cs === 'connected') this.setState('live');
        if (cs === 'failed' || cs === 'closed') {
          this.emitError(new Error(`Connection ${cs}`));
          this.setState('stopped');
        }
        DeviceEventEmitter.emit('livestream.connection', { state: cs });
      });

      // 3. SDP offer
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await this.pc.setLocalDescription(offer);

      // 4. WHIP handshake
      const token = await getAccessToken();
      const res = await fetch(config.whipEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: offer.sdp,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`WHIP failed ${res.status}: ${body}`);
      }

      // Resource URL for trickle ICE and teardown
      const loc = res.headers.get('Location') ?? '';
      if (loc) {
        try {
          this.whipResourceUrl = loc.startsWith('http')
            ? loc
            : new URL(loc, config.whipEndpoint).href;
        } catch {
          this.whipResourceUrl = loc;
        }
      }

      const answerSdp = await res.text();
      await this.pc.setRemoteDescription(
        new _RTCSessionDescription({ type: 'answer', sdp: answerSdp }),
      );

      // Drain buffered candidates
      for (const c of this.pendingCandidates) {
        await this.sendIceTrickle(c).catch(() => {});
      }
      this.pendingCandidates = [];

      this.startStatsPolling();
      DeviceEventEmitter.emit('livestream.started', { streamId: config.streamId });
    } catch (err: any) {
      this.setState('stopped');
      this.cleanup();
      throw err;
    }
  }

  // ── Stop broadcast ──────────────────────────────────────────────────────────

  async stopBroadcast(): Promise<void> {
    if (this._state === 'idle' || this._state === 'stopped') return;
    this.setState('stopped');
    this.stopStatsPolling();

    if (this.whipResourceUrl) {
      const token = await getAccessToken();
      await fetch(this.whipResourceUrl, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).catch(() => {});
      this.whipResourceUrl = null;
    }

    this.cleanup();
    DeviceEventEmitter.emit('livestream.stopped', {});
  }

  private cleanup() {
    this.localStream?.getTracks().forEach((t: any) => t.stop());
    this.localStream = null;
    this.pc?.close();
    this.pc = null;
    this.pendingCandidates = [];
    this._state = 'idle';
  }

  // ── Camera switching ────────────────────────────────────────────────────────

  async switchDeviceCamera(): Promise<void> {
    if (!this.isLive || !this.localStream || !this.pc) return;
    const next: CameraFacing = this._facing === 'front' ? 'back' : 'front';

    try {
      const newStream = await _mediaDevices.getUserMedia({
        video: {
          facingMode: next === 'back' ? 'environment' : 'user',
          width:     { ideal: 1280 },
          height:    { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return;

      const sender = this.pc
        .getSenders()
        .find((s: any) => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(newTrack);

      // Swap track on localStream so the preview updates
      const oldTrack = this.localStream.getVideoTracks()[0];
      if (oldTrack) {
        this.localStream.removeTrack(oldTrack);
        oldTrack.stop();
      }
      this.localStream.addTrack(newTrack);
      this._facing = next;
      DeviceEventEmitter.emit('livestream.camera.switched', { facing: next });
    } catch (err: any) {
      this.emitError(err);
    }
  }

  // ── WHIP ICE trickle ────────────────────────────────────────────────────────

  private async sendIceTrickle(candidate: any): Promise<void> {
    if (!this.whipResourceUrl) return;
    const token = await getAccessToken();
    await fetch(this.whipResourceUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/trickle-ice-sdpfrag',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: `a=${candidate.candidate}`,
    });
  }

  // ── Stats polling ───────────────────────────────────────────────────────────

  private startStatsPolling() {
    this.prevBytesSent = 0;
    this.prevStatsTs   = Date.now();
    this.statsTimer    = setInterval(() => this.pollStats(), 2000);
  }

  private stopStatsPolling() {
    if (this.statsTimer) { clearInterval(this.statsTimer); this.statsTimer = null; }
  }

  private async pollStats() {
    if (!this.pc) return;
    try {
      const reports = await this.pc.getStats();
      let bytesSent = 0, fps = 0, lost = 0, rtt = 0;
      let w = 0, h = 0, audioLvl = 0;

      reports.forEach((r: any) => {
        if (r.type === 'outbound-rtp' && r.kind === 'video') {
          bytesSent = r.bytesSent ?? 0;
          fps       = r.framesPerSecond ?? 0;
          lost      = r.packetsLost ?? 0;
          w         = r.frameWidth ?? 0;
          h         = r.frameHeight ?? 0;
        }
        if (r.type === 'candidate-pair' && r.nominated) {
          rtt = (r.currentRoundTripTime ?? 0) * 1000;
        }
        if (r.type === 'media-source' && r.kind === 'audio') {
          audioLvl = Math.round((r.audioLevel ?? 0) * 100);
        }
      });

      const now     = Date.now();
      const elapsed = (now - this.prevStatsTs) / 1000;
      const bps     = elapsed > 0
        ? Math.max(0, Math.round((bytesSent - this.prevBytesSent) * 8 / elapsed))
        : 0;

      this.prevBytesSent = bytesSent;
      this.prevStatsTs   = now;

      this.emit({
        bitrateBps: bps,
        frameRate: Math.round(fps),
        packetsLost: lost,
        roundTripTimeMs: Math.round(rtt),
        audioLevelDb: audioLvl,
        resolution: { width: w, height: h },
        isConnected: this._state === 'live',
      });
    } catch {}
  }
}

export const liveStreamingService = new LiveStreamingService();
