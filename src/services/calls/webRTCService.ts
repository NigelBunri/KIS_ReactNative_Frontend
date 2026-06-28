// src/services/calls/webRTCService.ts
// Loads react-native-webrtc dynamically to avoid hard compile dependency.

let RNW: any = null;
try {
  RNW = require('react-native-webrtc');
} catch {
  // Library not installed — calls show UI but media won't connect.
}

export const webRTCAvailable = !!RNW;
export const RTCView = RNW?.RTCView ?? null;

// Public STUN servers only as fallback. TURN servers should be injected at
// runtime via setIceServers() once fetched from the backend.
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

// Video quality tiers keyed by NetworkQuality (1=worst, 4=best)
const VIDEO_CONSTRAINTS: Record<number, any> = {
  4: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
  3: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 24 } },
  2: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 15 } },
  1: null, // audio-only — video track disabled
};

/**
 * Inject loss-tolerance parameters into an SDP string.
 *
 * Two layers of protection:
 *  1. Opus in-band FEC (useinbandfec=1) — codec-level concealment; recovers
 *     single-packet losses with no extra bandwidth.
 *  2. RED (Redundant Audio Data, RFC 2198) — wraps each Opus frame with the
 *     previous frame as redundancy; recovers consecutive losses.
 *     RED is listed with a lower priority than Opus on the m= line so it
 *     works even with endpoints that don't support it (they just pick Opus).
 */
function preferOpusWithFec(sdp: string): string {
  if (!sdp) return sdp;

  // ── Step 1: Opus in-band FEC ────────────────────────────────────────────
  const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
  if (opusMatch) {
    const pt = opusMatch[1];
    if (sdp.includes(`a=fmtp:${pt}`)) {
      sdp = sdp.replace(
        new RegExp(`(a=fmtp:${pt} )([^\r\n]+)`),
        (_: string, prefix: string, params: string) => {
          const p = params.includes('useinbandfec') ? params : `${params};useinbandfec=1`;
          return `${prefix}${p.replace(/;usedtx=[01]/, '')};usedtx=0`;
        },
      );
    } else {
      sdp = sdp.replace(
        new RegExp(`(a=rtpmap:${pt} opus[^\r\n]+)`),
        `$1\r\na=fmtp:${pt} minptime=10;useinbandfec=1;usedtx=0`,
      );
    }
  }

  // ── Step 2: RED (Redundant Encoding) ────────────────────────────────────
  // RED payload type is typically dynamically assigned (96–127 range).
  // If RED is already in the SDP (modern Chrome/react-native-webrtc supports it),
  // move it right after Opus on the m= audio line so it's preferred.
  const redMatch = sdp.match(/a=rtpmap:(\d+) RED\/48000\/2/i);
  if (redMatch && opusMatch) {
    const redPt = redMatch[1];
    const opusPt = opusMatch[1];
    // Ensure RED's fmtp references the Opus payload type as its codec chain
    if (!sdp.includes(`a=fmtp:${redPt}`)) {
      sdp = sdp.replace(
        new RegExp(`(a=rtpmap:${redPt} RED[^\r\n]+)`),
        `$1\r\na=fmtp:${redPt} ${opusPt}/${opusPt}`,
      );
    }
    // Re-order m= audio line: put RED pt right after Opus pt
    sdp = sdp.replace(
      /^(m=audio \d+ [A-Z\/0-9]+ )(.+)$/m,
      (_: string, prefix: string, pts: string) => {
        const list = pts.trim().split(/\s+/);
        const reordered = [opusPt, redPt, ...list.filter(p => p !== opusPt && p !== redPt)];
        return `${prefix}${reordered.join(' ')}`;
      },
    );
  }

  return sdp;
}

type IceCandidateHandler = (peerId: string, candidate: any) => void;
type TrackHandler = (peerId: string, stream: any) => void;
type ConnectionStateHandler = (peerId: string, state: string) => void;
type SpeakingHandler = (peerId: string, speaking: boolean) => void;
type StatsHandler = (peerId: string, stats: PeerStats) => void;
type IceRestartHandler = (peerId: string, offer: any) => void;

export type PeerStats = {
  packetsLost: number;
  rttMs: number;
  audioLevel: number; // 0‥1
  networkQuality: 1 | 2 | 3 | 4;
};

// Maximum ICE candidates queued per peer before older ones are dropped.
// Prevents unbounded memory growth if setRemoteDescription is never called.
const MAX_ICE_QUEUE = 50;

class WebRTCService {
  private localStream: any = null;
  private peers = new Map<string, any>(); // peerId → RTCPeerConnection
  private statsIntervals = new Map<string, ReturnType<typeof setInterval>>();
  private iceServers: any[] = DEFAULT_ICE_SERVERS;
  // Candidates that arrived before setRemoteDescription — flushed once remote SDP is set.
  private iceCandidateQueues = new Map<string, any[]>();
  // Debounce ICE restart per peer to avoid rapid repeated renegotiation
  private iceRestartDebounce = new Map<string, ReturnType<typeof setTimeout>>();
  // Audio-only mode — video track disabled globally
  private _isAudioOnlyMode = false;
  // Per-peer quality history — keyed by peerId; value is the last observed quality
  private _peerQuality = new Map<string, 1 | 2 | 3 | 4>();
  // Consecutive poor-quality readings (using the worst peer) before stepping down
  private _poorQualityCount = 0;
  // Cached aggregate quality (worst peer wins)
  private _networkQuality: 1 | 2 | 3 | 4 = 4;
  private _noiseCancellationOn = true;
  // Mutex: prevent concurrent startLocalStream calls
  private _streamStarting = false;
  // Guard closeAll re-entrancy
  private _closed = false;
  // Generation counter — incremented on every closeAll() call.
  // In-flight async callbacks (stats, ICE) compare against this and bail out
  // if the value has changed, preventing use-after-free of closed native peers.
  private _generation = 0;

  private onIceCandidate: IceCandidateHandler = () => {};
  private onRemoteTrack: TrackHandler = () => {};
  private onConnectionState: ConnectionStateHandler = () => {};
  private onSpeaking: SpeakingHandler = () => {};
  private onStats: StatsHandler = () => {};
  private onIceRestartNeeded: IceRestartHandler = () => {};
  private onAudioOnlyChanged: ((on: boolean) => void) = () => {};

  /** Call this before startCall/answerCall with TURN credentials from your backend. */
  setIceServers(servers: any[]) {
    if (Array.isArray(servers) && servers.length > 0) {
      this.iceServers = servers;
    }
  }

  setCallbacks(cb: {
    onIceCandidate?: IceCandidateHandler;
    onRemoteTrack?: TrackHandler;
    onConnectionState?: ConnectionStateHandler;
    onSpeaking?: SpeakingHandler;
    onStats?: StatsHandler;
    onIceRestartNeeded?: IceRestartHandler;
    onAudioOnlyChanged?: (on: boolean) => void;
  }) {
    if (cb.onIceCandidate) this.onIceCandidate = cb.onIceCandidate;
    if (cb.onRemoteTrack) this.onRemoteTrack = cb.onRemoteTrack;
    if (cb.onConnectionState) this.onConnectionState = cb.onConnectionState;
    if (cb.onSpeaking) this.onSpeaking = cb.onSpeaking;
    if (cb.onStats) this.onStats = cb.onStats;
    if (cb.onIceRestartNeeded) this.onIceRestartNeeded = cb.onIceRestartNeeded;
    if (cb.onAudioOnlyChanged) this.onAudioOnlyChanged = cb.onAudioOnlyChanged;
  }

  async startLocalStream(video: boolean): Promise<any> {
    if (!webRTCAvailable) return null;
    // Mutex: if a stream acquisition is already in flight, wait for it rather
    // than starting a second concurrent getUserMedia call.
    if (this._streamStarting) {
      // Poll until the first call finishes (max 5 s)
      const deadline = Date.now() + 5000;
      await new Promise<void>(resolve => {
        const check = () => {
          if (!this._streamStarting || Date.now() > deadline) { resolve(); return; }
          setTimeout(check, 50);
        };
        check();
      });
      // Return whatever stream was acquired
      if (this.localStream) return this.localStream;
    }
    this._streamStarting = true;
    // Release any existing stream before acquiring a new one.
    if (this.localStream) {
      try { this.localStream.getTracks?.().forEach?.((t: any) => t.stop()); } catch {}
      this.localStream = null;
    }

    const audioConstraints: any = {
      echoCancellation: true,
      noiseSuppression: this._noiseCancellationOn,
      autoGainControl: true,
    };

    const videoConstraints = video ? (VIDEO_CONSTRAINTS[this._networkQuality] ?? VIDEO_CONSTRAINTS[3]) : false;

    try {
      const stream = await RNW.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: videoConstraints,
      });
      this.localStream = stream;
      // If audio-only mode was pre-set, honour it immediately.
      if (this._isAudioOnlyMode && video) {
        this.localStream?.getVideoTracks?.()?.forEach((t: any) => { t.enabled = false; });
      }
      return stream;
    } catch (err) {
      console.warn('[WebRTC] getUserMedia failed:', err);
      return null;
    } finally {
      this._streamStarting = false;
    }
  }

  getLocalStream() {
    return this.localStream;
  }

  setMuted(muted: boolean) {
    this.localStream?.getAudioTracks()?.forEach((t: any) => { t.enabled = !muted; });
  }

  setVideoEnabled(enabled: boolean) {
    this.localStream?.getVideoTracks()?.forEach((t: any) => { t.enabled = enabled; });
  }

  switchCamera() {
    const videoTrack = this.localStream?.getVideoTracks?.()?.[0];
    if (videoTrack && typeof videoTrack._switchCamera === 'function') {
      videoTrack._switchCamera();
    }
  }

  /** Toggle noise cancellation — re-acquires the audio track with updated constraints. */
  async setNoiseCancellation(enabled: boolean): Promise<void> {
    this._noiseCancellationOn = enabled;
    if (!webRTCAvailable || !this.localStream) return;
    try {
      const newAudio = await RNW.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: enabled, autoGainControl: true },
        video: false,
      });
      const newAudioTrack = newAudio.getAudioTracks?.()?.[0];
      if (!newAudioTrack) return;
      // Replace track in all peer connections
      this.peers.forEach((pc: any) => {
        const senders: any[] = pc.getSenders?.() ?? [];
        const audioSender = senders.find((s: any) => s.track?.kind === 'audio');
        if (audioSender) audioSender.replaceTrack(newAudioTrack);
      });
      // Swap in local stream
      const oldTracks: any[] = this.localStream.getAudioTracks?.() ?? [];
      oldTracks.forEach((t: any) => { try { t.stop(); } catch {} });
      if (typeof this.localStream.removeTrack === 'function') {
        oldTracks.forEach((t: any) => this.localStream.removeTrack(t));
      }
      if (typeof this.localStream.addTrack === 'function') {
        this.localStream.addTrack(newAudioTrack);
      }
    } catch (err) {
      console.warn('[WebRTC] setNoiseCancellation failed:', err);
    }
  }

  /** Disable video track globally (audio-only mode for very poor networks). */
  setAudioOnlyMode(enabled: boolean) {
    if (this._isAudioOnlyMode === enabled) return;
    this._isAudioOnlyMode = enabled;
    this.localStream?.getVideoTracks?.()?.forEach((t: any) => { t.enabled = !enabled; });
    this.onAudioOnlyChanged(enabled);
  }

  get isAudioOnlyMode() { return this._isAudioOnlyMode; }

  /**
   * Called from the stats loop for each peer with its measured network quality.
   * Uses worst-peer-wins aggregation: if ANY peer is at quality=1, the whole
   * call adapts downward. A single good peer cannot mask a bad one.
   * Three consecutive poor aggregate readings required before stepping down.
   */
  applyNetworkQuality(peerId: string, quality: 1 | 2 | 3 | 4) {
    // Update this peer's quality
    this._peerQuality.set(peerId, quality);

    // Aggregate: worst quality across all active peers
    let worstQuality = 4 as 1 | 2 | 3 | 4;
    this._peerQuality.forEach(q => { if (q < worstQuality) worstQuality = q; });

    const prevAggregate = this._networkQuality;

    if (worstQuality < prevAggregate) {
      this._poorQualityCount++;
    } else if (worstQuality > prevAggregate) {
      // Quality improved — reset counter and update immediately
      this._poorQualityCount = 0;
      this._networkQuality = worstQuality;
      if (this._isAudioOnlyMode && worstQuality >= 3) {
        this.setAudioOnlyMode(false);
        this.localStream?.getVideoTracks?.()?.forEach((t: any) => { t.enabled = true; });
      }
      return;
    } else {
      // Same quality — only keep incrementing if already poor
      if (worstQuality <= 2) this._poorQualityCount++;
    }

    // Step down after 3 consecutive poor aggregate readings (~7.5 s at 2.5 s poll)
    if (this._poorQualityCount >= 3) {
      this._poorQualityCount = 0;
      this._networkQuality = worstQuality;

      if (worstQuality === 1) {
        if (!this._isAudioOnlyMode) this.setAudioOnlyMode(true);
      } else {
        const constraints = VIDEO_CONSTRAINTS[worstQuality];
        if (constraints) {
          this.localStream?.getVideoTracks?.()?.forEach((t: any) => {
            try { t.applyConstraints?.(constraints); } catch {}
          });
        }
      }
    }
  }

  private buildPeer(peerId: string): any {
    if (!webRTCAvailable) return null;

    // Switch to relay-only ICE when in audio-only mode (very poor network) to
    // force traffic through TURN, which is more reliable on bad connections.
    const iceTransportPolicy = this._isAudioOnlyMode ? 'relay' : 'all';

    const pc = new RNW.RTCPeerConnection({
      iceServers: this.iceServers,
      iceTransportPolicy,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    if (this.localStream) {
      this.localStream.getTracks?.()?.forEach((track: any) => {
        pc.addTrack(track, this.localStream);
      });
    }

    pc.onicecandidate = (e: any) => {
      if (e.candidate) this.onIceCandidate(peerId, e.candidate);
    };

    pc.ontrack = (e: any) => {
      const stream = e.streams?.[0];
      if (stream) this.onRemoteTrack(peerId, stream);
    };

    pc.onconnectionstatechange = () => {
      const state: string = pc.connectionState;
      this.onConnectionState(peerId, state);
      if (state === 'failed' || state === 'disconnected') {
        this.scheduleIceRestart(peerId, pc);
      }
    };

    // Fallback: also watch iceConnectionState for older react-native-webrtc builds
    pc.oniceconnectionstatechange = () => {
      const s: string = pc.iceConnectionState;
      if (s === 'connected' || s === 'completed') {
        this.onConnectionState(peerId, 'connected');
      } else if (s === 'failed') {
        this.onConnectionState(peerId, 'failed');
        this.scheduleIceRestart(peerId, pc);
      } else if (s === 'disconnected') {
        this.onConnectionState(peerId, 'disconnected');
        this.scheduleIceRestart(peerId, pc);
      }
    };

    this.peers.set(peerId, pc);
    this.startStats(peerId, pc);
    return pc;
  }

  private scheduleIceRestart(peerId: string, pc: any) {
    const existing = this.iceRestartDebounce.get(peerId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      this.iceRestartDebounce.delete(peerId);
      if (!pc || pc.connectionState === 'connected' || pc.connectionState === 'closed') return;
      try {
        pc.restartIce?.();
        const offer = await pc.createOffer({ iceRestart: true } as any);
        // Inject Opus FEC before sending the restarted offer
        if (offer?.sdp) offer.sdp = preferOpusWithFec(offer.sdp);
        await pc.setLocalDescription(offer);
        this.onIceRestartNeeded(peerId, offer);
      } catch (err) {
        console.warn('[WebRTC] ICE restart renegotiation failed:', err);
      }
    }, 2000);
    this.iceRestartDebounce.set(peerId, timer);
  }

  private ensurePeer(peerId: string): any {
    return this.peers.get(peerId) ?? this.buildPeer(peerId);
  }

  async createOffer(peerId: string): Promise<any | null> {
    if (!webRTCAvailable) return null;
    const pc = this.ensurePeer(peerId);
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true } as any);
      // Inject Opus FEC/RED preference
      if (offer?.sdp) offer.sdp = preferOpusWithFec(offer.sdp);
      await pc.setLocalDescription(offer);
      return offer;
    } catch (err) {
      console.warn('[WebRTC] createOffer failed:', err);
      return null;
    }
  }

  async handleOffer(peerId: string, remoteOffer: any): Promise<any | null> {
    if (!webRTCAvailable) return null;
    if (!this.localStream) {
      console.warn('[WebRTC] handleOffer called before localStream is ready — SDP answer may have no tracks');
    }
    try {
      const pc = this.ensurePeer(peerId);
      // Normalize: remoteOffer may be a raw SDP string or an RTCSessionDescription-like object.
      const descInit = typeof remoteOffer === 'string'
        ? { type: 'offer' as RTCSessionDescriptionInit['type'], sdp: remoteOffer }
        : remoteOffer;
      await pc.setRemoteDescription(new RNW.RTCSessionDescription(descInit));
      await this.flushIceCandidateQueue(peerId, pc);
      const answer = await pc.createAnswer();
      // Inject Opus FEC/RED into the answer as well
      if (answer?.sdp) answer.sdp = preferOpusWithFec(answer.sdp);
      await pc.setLocalDescription(answer);
      return answer;
    } catch (err) {
      console.warn('[WebRTC] handleOffer failed:', err);
      return null;
    }
  }

  async handleAnswer(peerId: string, remoteAnswer: any) {
    if (!webRTCAvailable) return;
    const pc = this.peers.get(peerId);
    if (!pc) return;
    try {
      // Normalize: remoteAnswer may be a raw SDP string or an RTCSessionDescription-like object.
      const descInit = typeof remoteAnswer === 'string'
        ? { type: 'answer' as RTCSessionDescriptionInit['type'], sdp: remoteAnswer }
        : remoteAnswer;
      await pc.setRemoteDescription(new RNW.RTCSessionDescription(descInit));
      await this.flushIceCandidateQueue(peerId, pc);
    } catch (err) {
      console.warn('[WebRTC] handleAnswer failed:', err);
    }
  }

  async addIceCandidate(peerId: string, candidate: any) {
    if (!webRTCAvailable) return;
    const pc = this.peers.get(peerId);
    if (!pc || !pc.remoteDescription) {
      // Remote description not set yet — queue so the candidate isn't lost.
      const queue = this.iceCandidateQueues.get(peerId) ?? [];
      // Drop oldest candidate when the queue is full to prevent memory growth.
      if (queue.length >= MAX_ICE_QUEUE) {
        queue.shift();
        console.warn(`[WebRTC] ICE queue full for peer ${peerId} — dropping oldest candidate`);
      }
      queue.push(candidate);
      this.iceCandidateQueues.set(peerId, queue);
      return;
    }
    try {
      await pc.addIceCandidate(new RNW.RTCIceCandidate(candidate));
    } catch {}
  }

  private async flushIceCandidateQueue(peerId: string, pc: any) {
    const queue = this.iceCandidateQueues.get(peerId);
    if (!queue?.length) return;
    this.iceCandidateQueues.delete(peerId);
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RNW.RTCIceCandidate(candidate));
      } catch {}
    }
  }

  private startStats(peerId: string, pc: any) {
    // Capture the current generation. If closeAll() fires while getStats() is
    // awaiting, the generation increments and this callback will detect it,
    // preventing any access to the freed native peer.
    const startGen = this._generation;

    const interval = setInterval(async () => {
      // Fast-path: native connection already closed
      if (!pc || pc.connectionState === 'closed') {
        clearInterval(interval);
        this.statsIntervals.delete(peerId);
        return;
      }
      // Fast-path: this peer's service was reset
      if (this._generation !== startGen) {
        clearInterval(interval);
        return;
      }

      try {
        const statsReport = await pc.getStats();

        // Guard again after the await — closeAll() may have fired during getStats().
        if (this._generation !== startGen) return;

        let packetsLost = 0;
        let rttMs = 0;
        let audioLevel = 0;
        statsReport.forEach((r: any) => {
          if (r.type === 'inbound-rtp' && r.kind === 'audio') {
            packetsLost += r.packetsLost ?? 0;
            audioLevel = Math.max(audioLevel, r.audioLevel ?? 0);
          }
          if (r.type === 'candidate-pair' && r.state === 'succeeded') {
            rttMs = (r.currentRoundTripTime ?? 0) * 1000;
          }
        });
        let nq: 1 | 2 | 3 | 4 = 4;
        if (packetsLost > 20 || rttMs > 500) nq = 1;
        else if (packetsLost > 10 || rttMs > 250) nq = 2;
        else if (packetsLost > 3 || rttMs > 120) nq = 3;

        this.onStats(peerId, { packetsLost, rttMs, audioLevel, networkQuality: nq });
        this.onSpeaking(peerId, audioLevel > 0.02);
        this.applyNetworkQuality(peerId, nq);
      } catch {
        // getStats() can throw if the peer was closed mid-flight — safe to ignore.
      }
    }, 2500);
    this.statsIntervals.set(peerId, interval);
  }

  /** Close peer by ID and remove its quality tracking entry. */
  closePeer(peerId: string) {
    const interval = this.statsIntervals.get(peerId);
    if (interval) { clearInterval(interval); this.statsIntervals.delete(peerId); }
    const timer = this.iceRestartDebounce.get(peerId);
    if (timer) { clearTimeout(timer); this.iceRestartDebounce.delete(peerId); }
    const pc = this.peers.get(peerId);
    if (pc) { try { pc.close(); } catch {} this.peers.delete(peerId); }
    this.iceCandidateQueues.delete(peerId);
    this._peerQuality.delete(peerId);
  }

  /**
   * Tear down every peer connection (and its stats/ICE-restart timers) but KEEP
   * the local stream alive. Used when upgrading a P2P mesh call to the SFU: the
   * same local MediaStream tracks must be handed to mediasoup, so they must not
   * be stopped. (closeAll() stops the local tracks, which would silence/blank
   * the local participant after the SFU takes over.)
   */
  closePeersOnly() {
    this._generation++;
    this.statsIntervals.forEach(i => clearInterval(i));
    this.statsIntervals.clear();
    this.iceRestartDebounce.forEach(t => clearTimeout(t));
    this.iceRestartDebounce.clear();
    this.peers.forEach(pc => { try { pc.close(); } catch {} });
    this.peers.clear();
    this.iceCandidateQueues.clear();
    this._peerQuality.clear();
  }

  closeAll() {
    if (this._closed) return; // guard re-entrancy
    this._closed = true;
    // Invalidate all in-flight async callbacks (stats, ICE restarts).
    // Any await that was mid-flight will see a changed _generation and bail out
    // before touching the freed native RTCPeerConnection objects.
    this._generation++;

    this.statsIntervals.forEach(i => clearInterval(i));
    this.statsIntervals.clear();
    this.iceRestartDebounce.forEach(t => clearTimeout(t));
    this.iceRestartDebounce.clear();
    this.peers.forEach(pc => { try { pc.close(); } catch {} });
    this.peers.clear();
    this.iceCandidateQueues.clear();
    this._peerQuality.clear();
    try {
      this.localStream?.getTracks?.()?.forEach?.((t: any) => t.stop());
    } catch {}
    this.localStream = null;
    this._isAudioOnlyMode = false;
    this._networkQuality = 4;
    this._poorQualityCount = 0;
    this._streamStarting = false;
    this._closed = false; // reset so the singleton can be reused for the next call
  }
}

export const webRTCService = new WebRTCService();
