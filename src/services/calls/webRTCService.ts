// src/services/calls/webRTCService.ts
// Loads react-native-webrtc dynamically to avoid hard compile dependency.

let RNW: any = null;
try {
  RNW = require('react-native-webrtc');
} catch {
  // Library not installed — calls will show UI but media won't connect.
}

export const webRTCAvailable = !!RNW;
export const RTCView = RNW?.RTCView ?? null;

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.nextcloud.com:443' },
];

type IceCandidateHandler = (peerId: string, candidate: any) => void;
type TrackHandler = (peerId: string, stream: any) => void;
type ConnectionStateHandler = (peerId: string, state: string) => void;
type SpeakingHandler = (peerId: string, speaking: boolean) => void;
type StatsHandler = (peerId: string, stats: PeerStats) => void;

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

  private onIceCandidate: IceCandidateHandler = () => {};
  private onRemoteTrack: TrackHandler = () => {};
  private onConnectionState: ConnectionStateHandler = () => {};
  private onSpeaking: SpeakingHandler = () => {};
  private onStats: StatsHandler = () => {};

  setCallbacks(cb: {
    onIceCandidate?: IceCandidateHandler;
    onRemoteTrack?: TrackHandler;
    onConnectionState?: ConnectionStateHandler;
    onSpeaking?: SpeakingHandler;
    onStats?: StatsHandler;
  }) {
    if (cb.onIceCandidate) this.onIceCandidate = cb.onIceCandidate;
    if (cb.onRemoteTrack) this.onRemoteTrack = cb.onRemoteTrack;
    if (cb.onConnectionState) this.onConnectionState = cb.onConnectionState;
    if (cb.onSpeaking) this.onSpeaking = cb.onSpeaking;
    if (cb.onStats) this.onStats = cb.onStats;
  }

  async startLocalStream(video: boolean): Promise<any> {
    if (!webRTCAvailable) return null;
    try {
      const stream = await RNW.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: video
          ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
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
    const pc = new RNW.RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.localStream?.getTracks?.()?.forEach((track: any) => {
      pc.addTrack(track, this.localStream);
    });

    pc.onicecandidate = (e: any) => {
      if (e.candidate) this.onIceCandidate(peerId, e.candidate);
    };

    pc.ontrack = (e: any) => {
      const stream = e.streams?.[0];
      if (stream) this.onRemoteTrack(peerId, stream);
    };

    pc.onconnectionstatechange = () => {
      this.onConnectionState(peerId, pc.connectionState);
      if (pc.connectionState === 'failed') {
        pc.restartIce?.();
      }
    };

    this.peers.set(peerId, pc);
    this.startStats(peerId, pc);
    return pc;
  }

  private ensurePeer(peerId: string): any {
    return this.peers.get(peerId) ?? this.buildPeer(peerId);
  }

  async createOffer(peerId: string): Promise<any | null> {
    if (!webRTCAvailable) return null;
    const pc = this.ensurePeer(peerId);
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true } as any);
    await pc.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(peerId: string, remoteOffer: any): Promise<any | null> {
    if (!webRTCAvailable) return null;
    const pc = this.ensurePeer(peerId);
    await pc.setRemoteDescription(new RNW.RTCSessionDescription(remoteOffer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(peerId: string, remoteAnswer: any) {
    if (!webRTCAvailable) return;
    const pc = this.peers.get(peerId);
    if (!pc) return;
    await pc.setRemoteDescription(new RNW.RTCSessionDescription(remoteAnswer));
  }

  async addIceCandidate(peerId: string, candidate: any) {
    if (!webRTCAvailable) return;
    const pc = this.peers.get(peerId);
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RNW.RTCIceCandidate(candidate));
    } catch {}
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
        if (packetsLost > 20 || rttMs > 400) nq = 1;
        else if (packetsLost > 10 || rttMs > 200) nq = 2;
        else if (packetsLost > 3 || rttMs > 100) nq = 3;
        this.onStats(peerId, { packetsLost, rttMs, audioLevel, networkQuality: nq });
        this.onSpeaking(peerId, audioLevel > 0.02);
      } catch {}
    }, 2000);
    this.statsIntervals.set(peerId, interval);
  }

  closePeer(peerId: string) {
    const interval = this.statsIntervals.get(peerId);
    if (interval) { clearInterval(interval); this.statsIntervals.delete(peerId); }
    const pc = this.peers.get(peerId);
    if (pc) { pc.close(); this.peers.delete(peerId); }
  }

  closeAll() {
    this.statsIntervals.forEach(i => clearInterval(i));
    this.statsIntervals.clear();
    this.peers.forEach(pc => { try { pc.close(); } catch {} });
    this.peers.clear();
    try {
      this.localStream?.getTracks?.()?.forEach?.((t: any) => t.stop());
    } catch {}
    this.localStream = null;
  }
}

export const webRTCService = new WebRTCService();
