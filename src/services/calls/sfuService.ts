// src/services/calls/sfuService.ts
//
// Client-side Mediasoup SFU integration.
//
// Install:  npm install mediasoup-client
// Without it the service stays in stub mode and P2P is used instead.
//
// Usage:
//   const sfu = sfuService;
//   await sfu.join(socket, callId, conversationId, localStream, onRemoteTrack);
//   // ... call continues via SFU instead of P2P
//   sfu.close();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mediasoupClient: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  mediasoupClient = require('mediasoup-client');
} catch {
  // mediasoup-client not installed — SFU path unavailable
}

export const sfuAvailable = !!mediasoupClient;

type RemoteTrackHandler = (userId: string, track: MediaStreamTrack, kind: 'audio' | 'video') => void;

type SfuExistingProducer = {
  producerId: string;
  userId: string;
  kind: 'audio' | 'video';
};

class SfuService {
  private device: any = null;
  private sendTransport: any = null;
  private recvTransport: any = null;
  private producers: Map<string, any> = new Map(); // kind → Producer
  private consumers: Map<string, any> = new Map(); // consumerId → Consumer
  private socket: any = null;
  private callId: string | null = null;
  private conversationId: string | null = null;
  private localUserId: string | null = null;
  private _onRemoteTrack: RemoteTrackHandler | null = null;

  get isJoined(): boolean { return !!this.device && !!this.sendTransport; }

  async join(
    socket: any,
    callId: string,
    conversationId: string,
    localStream: any,
    onRemoteTrack: RemoteTrackHandler,
    localUserId?: string,
  ): Promise<void> {
    if (!mediasoupClient) throw new Error('mediasoup-client not installed');

    this.socket = socket;
    this.callId = callId;
    this.conversationId = conversationId;
    this.localUserId = localUserId ?? null;
    this._onRemoteTrack = onRemoteTrack;

    // 1. Join room → get router RTP capabilities + existing producers
    const { routerRtpCapabilities, existingProducers } = await this._emit('sfu.join', {
      callId, conversationId,
    });

    // 2. Load mediasoup Device with router capabilities
    this.device = new mediasoupClient.Device();
    await this.device.load({ routerRtpCapabilities });

    // 3. Create send transport
    const sendParams = await this._emit('sfu.transport.create', { callId, direction: 'send' });
    this.sendTransport = this.device.createSendTransport(sendParams);
    this._wireTransport(this.sendTransport, 'send');

    // 4. Create recv transport
    const recvParams = await this._emit('sfu.transport.create', { callId, direction: 'recv' });
    this.recvTransport = this.device.createRecvTransport(recvParams);
    this._wireTransport(this.recvTransport, 'recv');

    // 5. Produce local tracks
    if (localStream) {
      for (const track of localStream.getTracks?.() ?? []) {
        await this._produce(track);
      }
    }

    // 6. Consume existing remote producers
    for (const prod of (existingProducers as SfuExistingProducer[])) {
      await this._consumeProducer(prod.producerId, prod.userId, prod.kind);
    }

    // 7. Listen for new producers.
    // The backend broadcasts sfu.producer.new to the whole conv room, including
    // the producer's own socket. Skip our own producers — consuming them would
    // echo our own audio/video back to us. (existingProducers in step 6 is
    // already server-side filtered, but this live broadcast is not.)
    socket.on('sfu.producer.new', async (payload: any) => {
      if (this.localUserId && String(payload.userId) === String(this.localUserId)) return;
      await this._consumeProducer(payload.producerId, payload.userId, payload.kind);
    });

    // 8. Listen for closed producers
    socket.on('sfu.producer.closed', (payload: any) => {
      const consumer = [...this.consumers.values()].find(
        c => (c as any)._producerId === payload.producerId,
      );
      if (consumer) {
        try { consumer.close(); } catch {}
        this.consumers.delete(consumer.id);
      }
    });
  }

  private _wireTransport(transport: any, dir: 'send' | 'recv') {
    transport.on('connect', async ({ dtlsParameters }: any, callback: () => void, errback: (e: Error) => void) => {
      try {
        await this._emit('sfu.transport.connect', { transportId: transport.id, dtlsParameters });
        callback();
      } catch (e: any) { errback(e); }
    });

    if (dir === 'send') {
      transport.on('produce', async ({ kind, rtpParameters }: any, callback: (id: { id: string }) => void, errback: (e: Error) => void) => {
        try {
          const { producerId } = await this._emit('sfu.produce', {
            callId: this.callId,
            conversationId: this.conversationId,
            transportId: transport.id,
            kind,
            rtpParameters,
          });
          callback({ id: producerId });
        } catch (e: any) { errback(e); }
      });
    }
  }

  private async _produce(track: MediaStreamTrack): Promise<void> {
    if (!this.sendTransport) return;
    const existing = this.producers.get(track.kind);
    if (existing && !existing.closed) existing.close();
    try {
      const producer = await this.sendTransport.produce({ track });
      this.producers.set(track.kind, producer);
    } catch (e) {
      console.warn('[SFU] produce failed', e);
    }
  }

  private async _consumeProducer(producerId: string, userId: string, kind: string): Promise<void> {
    if (!this.recvTransport || !this.device) return;
    try {
      const params = await this._emit('sfu.consume', {
        callId: this.callId,
        transportId: this.recvTransport.id,
        producerId,
        rtpCapabilities: this.device.rtpCapabilities,
      });

      const consumer = await this.recvTransport.consume({
        id: params.id,
        producerId,
        kind: params.kind,
        rtpParameters: params.rtpParameters,
      });
      // tag so we can find it by producerId when it closes
      (consumer as any)._producerId = producerId;
      this.consumers.set(consumer.id, consumer);

      // Resume consumer
      await this._emit('sfu.consumer.resume', { consumerId: consumer.id });

      this._onRemoteTrack?.(userId, consumer.track, params.kind as 'audio' | 'video');
    } catch (e) {
      console.warn('[SFU] consume failed for producer', producerId, e);
    }
  }

  /** Replace a local track (e.g. when switching camera or toggling video). */
  async replaceTrack(kind: 'audio' | 'video', newTrack: MediaStreamTrack | null): Promise<void> {
    const producer = this.producers.get(kind);
    if (!producer || producer.closed) {
      if (newTrack) await this._produce(newTrack);
      return;
    }
    if (newTrack) {
      await producer.replaceTrack({ track: newTrack });
    } else {
      producer.pause();
    }
  }

  /** Pause/resume local audio or video producer (for mute/camera-off). */
  setTrackEnabled(kind: 'audio' | 'video', enabled: boolean) {
    const producer = this.producers.get(kind);
    if (!producer || producer.closed) return;
    if (enabled) producer.resume(); else producer.pause();
  }

  close() {
    this.socket?.off('sfu.producer.new');
    this.socket?.off('sfu.producer.closed');
    this.consumers.forEach(c => { try { c.close(); } catch {} });
    this.consumers.clear();
    this.producers.forEach(p => { try { p.close(); } catch {} });
    this.producers.clear();
    try { this.sendTransport?.close(); } catch {}
    try { this.recvTransport?.close(); } catch {}
    this.sendTransport = null;
    this.recvTransport = null;
    this.device = null;
    this.socket = null;
    this.callId = null;
    this.conversationId = null;
    this.localUserId = null;
    this._onRemoteTrack = null;
  }

  private _emit(event: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) { reject(new Error('No socket')); return; }
      this.socket.emit(event, data, (ack: any) => {
        if (ack?.ok) resolve(ack.data);
        else reject(new Error(ack?.error ?? 'SFU error'));
      });
    });
  }
}

export const sfuService = new SfuService();
