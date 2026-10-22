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
import AsyncStorage from '@react-native-async-storage/async-storage';
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
type ServiceState = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'stopped';
type StateCallback = (state: ServiceState) => void;

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
  private _state: ServiceState = 'idle';
  private consecutiveIceTrickleFailures = 0;
  private consecutiveStatsFailures = 0;
  private lastConfig: BroadcastConfig | null = null;
  private intentionalStop = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // WHIP reconnection is re-establishing a whole PeerConnection (new
  // capture, new SDP offer/answer, new ingest session) - not a lightweight
  // retry - so a short, capped backoff (doubling, 1s/2s/4s/8s) bounds how
  // long a broadcaster sits on "Reconnecting..." before getting a clear
  // final failure, rather than retrying forever or hammering the server.
  private static readonly MAX_RECONNECT_ATTEMPTS = 4;
  private static readonly RECONNECT_BASE_DELAY_MS = 1000;

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
  private setState(s: ServiceState) {
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
    if (this._state === 'connecting' || this._state === 'live' || this._state === 'reconnecting') return;

    this.lastConfig = config;
    this.intentionalStop = false;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    await this.connect(config);
  }

  // Shared by the initial startBroadcast() call and every reconnect retry -
  // the only difference is which state (`connecting` vs `reconnecting`)
  // gets surfaced to the UI and whether a fresh attempt counter was reset.
  private async connect(config: BroadcastConfig): Promise<void> {
    this.setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
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
          // Cosmetic: the bitrate cap just won't be applied. Not connection-
          // critical, so log only rather than surfacing a user-facing error.
          await videoSender.setParameters(params).catch((err: any) => {
            if (__DEV__) console.warn('[liveStreamingService] setParameters(maxBitrate) failed', err);
          });
        }
      }

      this.pc.addEventListener('icecandidate', ({ candidate }: any) => {
        if (!candidate) return;
        if (this.whipResourceUrl) {
          this.trickleCandidate(candidate);
        } else {
          this.pendingCandidates.push(candidate);
        }
      });

      this.pc.addEventListener('connectionstatechange', () => {
        const cs: string = this.pc?.connectionState ?? '';
        if (cs === 'connected') {
          this.reconnectAttempts = 0;
          this.setState('live');
        }
        if (cs === 'failed') {
          // An ICE/DTLS failure mid-broadcast, not a user-initiated stop -
          // worth automatically retrying rather than immediately surfacing
          // a dead stream (see handleUnexpectedDisconnect's own reasoning).
          this.handleUnexpectedDisconnect(new Error('Connection failed'));
        } else if (cs === 'closed' && !this.intentionalStop) {
          this.handleUnexpectedDisconnect(new Error('Connection closed unexpectedly'));
        } else if (cs === 'closed') {
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
      // config.whipEndpoint is Django's own ChannelLiveStreamWhipView proxy,
      // behind the same DeviceBoundJWTAuthentication every other endpoint
      // uses - that requires X-Device-Id on every authenticated request,
      // not just Authorization. This bypasses the app's normal network
      // client (src/network/post), which already attaches both from the
      // same AsyncStorage key, so WHIP needs to do it manually here too.
      const token = await getAccessToken();
      const deviceId = await AsyncStorage.getItem('device_id');
      const res = await fetch(config.whipEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(deviceId ? { 'X-Device-Id': deviceId } : {}),
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
        await this.trickleCandidate(c);
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
    // Must be set before anything else: a stop requested mid-reconnect
    // (state 'reconnecting', a retry already scheduled via setTimeout)
    // would otherwise still fire that pending retry after teardown.
    this.intentionalStop = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.setState('stopped');
    this.stopStatsPolling();

    if (this.whipResourceUrl) {
      const token = await getAccessToken();
      const deviceId = await AsyncStorage.getItem('device_id');
      await fetch(this.whipResourceUrl, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(deviceId ? { 'X-Device-Id': deviceId } : {}),
        },
      }).catch((err: any) => {
        // The broadcaster is already tearing down locally either way - a
        // failed DELETE just means the media server may be left with an
        // orphaned ingest session, so this is diagnostic-only, not
        // something the user needs to react to.
        if (__DEV__) console.warn('[liveStreamingService] WHIP teardown DELETE failed', err);
      });
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
    this.consecutiveIceTrickleFailures = 0;
    this.consecutiveStatsFailures = 0;
  }

  // ── Reconnection ────────────────────────────────────────────────────────────
  // Only reached from connectionstatechange 'failed' (or an unexpected
  // 'closed' not caused by stopBroadcast) - i.e. a connection that was
  // already established and then dropped mid-broadcast (a real network
  // interruption), not a setup-time failure like a permission denial or a
  // bad WHIP response, which still fail immediately via connect()'s own
  // catch block and are not retried (retrying those wastes the whole
  // backoff window on an error that will never resolve itself).
  private handleUnexpectedDisconnect(err: Error): void {
    if (this.intentionalStop || !this.lastConfig) return;
    if (__DEV__) console.warn('[liveStreamingService] unexpected disconnect, will attempt reconnect', err);
    this.stopStatsPolling();
    this.cleanup();
    this.whipResourceUrl = null; // the ingest session died with the connection - nothing to DELETE

    if (this.reconnectAttempts >= LiveStreamingService.MAX_RECONNECT_ATTEMPTS) {
      this.setState('stopped');
      this.emitError(new Error(`Connection lost. Unable to reconnect after multiple attempts (${err.message}).`));
      return;
    }

    this.reconnectAttempts += 1;
    this.setState('reconnecting');
    const delay = LiveStreamingService.RECONNECT_BASE_DELAY_MS * 2 ** (this.reconnectAttempts - 1);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.intentionalStop || !this.lastConfig) return;
      this.connect(this.lastConfig).catch((e: any) => this.handleUnexpectedDisconnect(e));
    }, delay);
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
    const deviceId = await AsyncStorage.getItem('device_id');
    await fetch(this.whipResourceUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/trickle-ice-sdpfrag',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(deviceId ? { 'X-Device-Id': deviceId } : {}),
      },
      body: `a=${candidate.candidate}`,
    });
  }

  // A single dropped candidate rarely matters (ICE negotiation is resilient
  // to some loss), but a *run* of failures means trickle-ICE is broken and
  // the connection may never complete - that's exactly the silent-stuck-
  // on-"CONNECTING" failure mode this previously produced with no
  // diagnostics. Log every failure, but only surface a user-facing error
  // once a burst crosses this threshold, not per-candidate.
  private static readonly ICE_TRICKLE_FAILURE_ALERT_THRESHOLD = 3;

  private async trickleCandidate(candidate: any): Promise<void> {
    try {
      await this.sendIceTrickle(candidate);
      this.consecutiveIceTrickleFailures = 0;
    } catch (err: any) {
      this.consecutiveIceTrickleFailures += 1;
      if (__DEV__) console.warn('[liveStreamingService] ICE trickle PATCH failed', err);
      if (
        this.consecutiveIceTrickleFailures ===
        LiveStreamingService.ICE_TRICKLE_FAILURE_ALERT_THRESHOLD
      ) {
        this.emitError(new Error('Connection is unstable - network candidates are failing to reach the server.'));
      }
    }
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

      this.consecutiveStatsFailures = 0;
      this.emit({
        bitrateBps: bps,
        frameRate: Math.round(fps),
        packetsLost: lost,
        roundTripTimeMs: Math.round(rtt),
        audioLevelDb: audioLvl,
        resolution: { width: w, height: h },
        isConnected: this._state === 'live',
      });
    } catch (err: any) {
      this.consecutiveStatsFailures += 1;
      if (__DEV__) console.warn('[liveStreamingService] getStats() failed', err);
      // getStats() failing repeatedly means the health bar is showing
      // stale numbers with no indication they've stopped updating -
      // surface that once, rather than freezing silently forever.
      if (this.consecutiveStatsFailures === 3) {
        this.emitError(new Error('Unable to read connection stats - the health indicators may be out of date.'));
      }
    }
  }
}

export const liveStreamingService = new LiveStreamingService();
