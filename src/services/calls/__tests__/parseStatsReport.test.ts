// Regression/foundational coverage for feature K (real call diagnostics).
// parseStatsReport is the pure, unit-testable core of webRTCService's stats
// pipeline — extracted specifically so these values can be verified without
// a real RTCPeerConnection, and so the diagnostics panel built on top of it
// can be trusted to show REAL numbers, never invented/hardcoded ones.

import { parseStatsReport, DetailedPeerStats } from '../webRTCService';

function makeReport(entries: any[]) {
  return { forEach: (cb: (r: any) => void) => entries.forEach(cb) };
}

describe('parseStatsReport', () => {
  it('extracts packetsLost and audioLevel from an inbound-rtp audio entry', () => {
    const report = makeReport([
      { type: 'inbound-rtp', kind: 'audio', packetsLost: 5, audioLevel: 0.42, jitter: 0.01 },
    ]);
    const { stats } = parseStatsReport(report, null, 1000);
    expect(stats.packetsLost).toBe(5);
    expect(stats.audioLevel).toBe(0.42);
    expect(stats.jitterMs).toBeCloseTo(10);
  });

  it('extracts RTT from the succeeded candidate-pair', () => {
    const report = makeReport([
      { type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.085, localCandidateId: 'c1' },
    ]);
    const { stats } = parseStatsReport(report, null, 1000);
    expect(stats.rttMs).toBeCloseTo(85);
  });

  it('extracts video resolution and fps from inbound-rtp video', () => {
    const report = makeReport([
      { type: 'inbound-rtp', kind: 'video', frameWidth: 1280, frameHeight: 720, framesPerSecond: 29.8 },
    ]);
    const { stats } = parseStatsReport(report, null, 1000);
    expect(stats.videoWidth).toBe(1280);
    expect(stats.videoHeight).toBe(720);
    expect(stats.fps).toBe(29.8);
  });

  it('resolves candidateType from the active local candidate', () => {
    const report = makeReport([
      { type: 'candidate-pair', state: 'succeeded', localCandidateId: 'c1', currentRoundTripTime: 0.02 },
      { type: 'local-candidate', id: 'c1', candidateType: 'relay' },
    ]);
    const { stats } = parseStatsReport(report, null, 1000);
    expect(stats.candidateType).toBe('relay');
  });

  it('extracts the ICE connection state from the transport entry', () => {
    const report = makeReport([{ type: 'transport', iceState: 'connected' }]);
    const { stats } = parseStatsReport(report, null, 1000);
    expect(stats.iceConnectionState).toBe('connected');
  });

  it('extracts the negotiated codec mime type', () => {
    const report = makeReport([{ type: 'codec', mimeType: 'audio/opus' }]);
    const { stats } = parseStatsReport(report, null, 1000);
    expect(stats.codec).toBe('audio/opus');
  });

  it('computes outbound/inbound bitrate from two real samples, never fabricating one from a single sample', () => {
    const reportA = makeReport([{ type: 'outbound-rtp', bytesSent: 0 }, { type: 'inbound-rtp', kind: 'audio', bytesReceived: 0 }]);
    const first = parseStatsReport(reportA, null, 0);
    // No previous sample yet — bitrate must be null, not 0 or any guessed number.
    expect(first.stats.bitrateOutKbps).toBeNull();
    expect(first.stats.bitrateInKbps).toBeNull();

    // 125000 bytes sent over 1 second = 1,000,000 bits/sec = 1000 kbps
    const reportB = makeReport([{ type: 'outbound-rtp', bytesSent: 125000 }, { type: 'inbound-rtp', kind: 'audio', bytesReceived: 62500 }]);
    const second = parseStatsReport(reportB, first.sample, 1000);
    expect(second.stats.bitrateOutKbps).toBeCloseTo(1000, 0);
    expect(second.stats.bitrateInKbps).toBeCloseTo(500, 0);
  });

  it('classifies network quality using the same thresholds as the original inline logic', () => {
    const good = parseStatsReport(makeReport([{ type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.05 }]), null, 1000);
    expect(good.stats.networkQuality).toBe(4);

    const poor = parseStatsReport(
      makeReport([
        { type: 'inbound-rtp', kind: 'audio', packetsLost: 25 },
        { type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.05 },
      ]),
      null,
      1000,
    );
    expect(poor.stats.networkQuality).toBe(1);
  });

  it('never invents a value for a stat absent from this report — nulls, not fallback numbers', () => {
    const report = makeReport([{ type: 'inbound-rtp', kind: 'audio', packetsLost: 0 }]);
    const { stats } = parseStatsReport(report, null, 1000);
    expect(stats.jitterMs).toBeNull();
    expect(stats.videoWidth).toBeNull();
    expect(stats.videoHeight).toBeNull();
    expect(stats.fps).toBeNull();
    expect(stats.iceConnectionState).toBeNull();
    expect(stats.candidateType).toBeNull();
    expect(stats.codec).toBeNull();
  });

  it('returns a sample usable as the prevSample input for the next call', () => {
    const report = makeReport([{ type: 'outbound-rtp', bytesSent: 500 }]);
    const { sample } = parseStatsReport(report, null, 42);
    expect(sample).toEqual({ timestamp: 42, bytesSent: 500, bytesReceived: 0 });
  });
});
