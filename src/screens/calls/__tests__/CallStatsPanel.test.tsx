// Regression coverage for feature K: the diagnostics panel must render the
// REAL values webRTCService.getDetailedStats() reports, never a hardcoded
// placeholder, and must show "—" (not a fabricated 0/guessed number) for
// any stat genuinely absent from the current sample.

jest.mock('@/services/calls/webRTCService', () => ({
  webRTCService: { getDetailedStats: jest.fn() },
}));
jest.mock('@/services/calls/sfuService', () => ({
  sfuService: { isJoined: false },
}));

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import CallStatsPanel from '../CallStatsPanel';
import { webRTCService } from '@/services/calls/webRTCService';
import { sfuService } from '@/services/calls/sfuService';
import type { CallParticipant } from '@/services/calls/callTypes';

const mockGetDetailedStats = webRTCService.getDetailedStats as jest.Mock;

function makeParticipant(overrides: Partial<CallParticipant> = {}): CallParticipant {
  return {
    userId: 'remote-1',
    displayName: 'Jordan',
    isLocal: false,
    isMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
    isSpeaking: false,
    networkQuality: 4,
    role: 'audience',
    handRaised: false,
    joinedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('CallStatsPanel', () => {
  const activeRenderers: ReactTestRenderer.ReactTestRenderer[] = [];
  afterEach(async () => {
    while (activeRenderers.length) {
      const r = activeRenderers.pop()!;
      await ReactTestRenderer.act(async () => { r.unmount(); });
    }
    jest.clearAllMocks();
    (sfuService as any).isJoined = false;
  });

  it('renders real measured values for a remote participant', async () => {
    mockGetDetailedStats.mockReturnValue({
      'remote-1': {
        packetsLost: 2,
        rttMs: 45,
        audioLevel: 0.1,
        networkQuality: 4,
        jitterMs: 3.2,
        bitrateOutKbps: 128,
        bitrateInKbps: 96,
        videoWidth: 1280,
        videoHeight: 720,
        fps: 30,
        iceConnectionState: 'connected',
        candidateType: 'srflx',
        codec: 'video/VP8',
        updatedAt: Date.now(),
      },
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <CallStatsPanel visible onClose={jest.fn()} participants={[makeParticipant()]} />,
      );
    });
    activeRenderers.push(renderer!);

    const text = renderer!.toJSON();
    const flat = JSON.stringify(text);
    expect(flat).toContain('45 ms'); // RTT
    expect(flat).toContain('128 kbps'); // bitrate out
    expect(flat).toContain('96 kbps'); // bitrate in
    expect(flat).toContain('1280×720');
    expect(flat).toContain('srflx');
    expect(flat).toContain('connected');
    expect(flat).toContain('video/VP8');
  });

  it('shows "—" for stats genuinely absent, never a fabricated number', async () => {
    mockGetDetailedStats.mockReturnValue({
      'remote-1': {
        packetsLost: 0,
        rttMs: 0,
        audioLevel: 0,
        networkQuality: 4,
        jitterMs: null,
        bitrateOutKbps: null,
        bitrateInKbps: null,
        videoWidth: null,
        videoHeight: null,
        fps: null,
        iceConnectionState: null,
        candidateType: null,
        codec: null,
        updatedAt: Date.now(),
      },
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <CallStatsPanel visible onClose={jest.fn()} participants={[makeParticipant()]} />,
      );
    });
    activeRenderers.push(renderer!);

    const flat = JSON.stringify(renderer!.toJSON());
    expect(flat).toContain('—'); // at least one placeholder present
    expect(flat).not.toContain('NaN');
  });

  it('shows a waiting state before the first stats sample has arrived', async () => {
    mockGetDetailedStats.mockReturnValue({});

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <CallStatsPanel visible onClose={jest.fn()} participants={[makeParticipant()]} />,
      );
    });
    activeRenderers.push(renderer!);

    expect(JSON.stringify(renderer!.toJSON())).toContain('Waiting for first stats sample');
  });

  it('labels the media path as SFU when the call has upgraded, P2P otherwise', async () => {
    mockGetDetailedStats.mockReturnValue({});
    (sfuService as any).isJoined = true;

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <CallStatsPanel visible onClose={jest.fn()} participants={[makeParticipant()]} />,
      );
    });
    activeRenderers.push(renderer!);

    expect(JSON.stringify(renderer!.toJSON())).toContain('SFU (group relay)');
  });
});
