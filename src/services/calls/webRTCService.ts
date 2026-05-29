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

class WebRTCService {
  private localStream: any = null;
  private peers = new Map<string, any>(); // peerId → RTCPeerConnection
  private statsIntervals = new Map<string, ReturnType<typeof setInterval>>();
  private iceServers: any[] = DEFAULT_ICE_SERVERS;
  // Candidates that arrived before setRemoteDescription — flushed once remote SDP is set.
  private iceCandidateQueues = new Map<string, any[]>();

  private onIceCandidate: IceCandidateHandler = () => {};
  private onRemoteTrack: TrackHandler = () => {};
  private onConnectionState: ConnectionStateHandler = () => {};
  private onSpeaking: SpeakingHandler = () => {};
  private onStats: StatsHandler = () => {};
  private onIceRestartNeeded: IceRestartHandler = () => {};
  // Debounce ICE restart per peer to avoid rapid repeated renegotiation
  private iceRestartDebounce = new Map<string, ReturnType<typeof setTimeout>>();

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
  }) {
    if (cb.onIceCandidate) this.onIceCandidate = cb.onIceCandidate;
    if (cb.onRemoteTrack) this.onRemoteTrack = cb.onRemoteTrack;
    if (cb.onConnectionState) this.onConnectionState = cb.onConnectionState;
    if (cb.onSpeaking) this.onSpeaking = cb.onSpeaking;
    if (cb.onStats) this.onStats = cb.onStats;
    if (cb.onIceRestartNeeded) this.onIceRestartNeeded = cb.onIceRestartNeeded;
  }

  async startLocalStream(video: boolean): Promise<any> {
    if (!webRTCAvailable) return null;
    // Release any existing stream before acquiring a new one.
    if (this.localStream) {
      try { this.localStream.getTracks?.().forEach?.((t: any) => t.stop()); } catch {}
      this.localStream = null;
    }
    try {
      const stream = await RNW.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: video
          ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } }
          : false,
      });
      this.localStream = stream;
      return stream;
    } catch (err) {
      console.warn('[WebRTC] getUserMedia failed:', err);
      return null;
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

  private buildPeer(peerId: string): any {
    if (!webRTCAvailable) return null;
    const pc = new RNW.RTCPeerConnection({
      iceServers: this.iceServers,
      // Prefer relay candidates on flaky networks once direct path fails.
      // Keep 'all' so we don't force relay on good networks (adds latency).
      iceTransportPolicy: 'all',
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
    // Debounce: wait 2 s in case the state flaps back to connected on its own
    const existing = this.iceRestartDebounce.get(peerId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      this.iceRestartDebounce.delete(peerId);
      if (!pc || pc.connectionState === 'connected' || pc.connectionState === 'closed') return;
      try {
        pc.restartIce?.();
        const offer = await pc.createOffer({ iceRestart: true } as any);
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
      await pc.setLocalDescription(offer);
      return offer;
    } catch (err) {
      console.warn('[WebRTC] createOffer failed:', err);
      return null;
    }
  }

  async handleOffer(peerId: string, remoteOffer: any): Promise<any | null> {
    if (!webRTCAvailable) return null;
    // Guard: local stream must exist before building a peer connection.
    // If it doesn't, the peer won't add any tracks and the caller will get
    // a one-way call (no audio/video from the answering side).
    if (!this.localStream) {
      console.warn('[WebRTC] handleOffer called before localStream is ready — SDP answer may have no tracks');
    }
    try {
      const pc = this.ensurePeer(peerId);
      await pc.setRemoteDescription(new RNW.RTCSessionDescription(remoteOffer));
      await this.flushIceCandidateQueue(peerId, pc);
      const answer = await pc.createAnswer();
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
      await pc.setRemoteDescription(new RNW.RTCSessionDescription(remoteAnswer));
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
    const interval = setInterval(async () => {
      if (!pc || pc.connectionState === 'closed') {
        clearInterval(interval);
        return;
      }
      try {
        const statsReport = await pc.getStats();
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
      } catch {}
    }, 2500);
    this.statsIntervals.set(peerId, interval);
  }

  closePeer(peerId: string) {
    const interval = this.statsIntervals.get(peerId);
    if (interval) { clearInterval(interval); this.statsIntervals.delete(peerId); }
    const timer = this.iceRestartDebounce.get(peerId);
    if (timer) { clearTimeout(timer); this.iceRestartDebounce.delete(peerId); }
    const pc = this.peers.get(peerId);
    if (pc) { try { pc.close(); } catch {} this.peers.delete(peerId); }
    this.iceCandidateQueues.delete(peerId);
  }

  closeAll() {
    this.statsIntervals.forEach(i => clearInterval(i));
    this.statsIntervals.clear();
    this.iceRestartDebounce.forEach(t => clearTimeout(t));
    this.iceRestartDebounce.clear();
    this.peers.forEach(pc => { try { pc.close(); } catch {} });
    this.peers.clear();
    this.iceCandidateQueues.clear();
    try {
      this.localStream?.getTracks?.()?.forEach?.((t: any) => t.stop());
    } catch {}
    this.localStream = null;
  }
}

export const webRTCService = new WebRTCService();
