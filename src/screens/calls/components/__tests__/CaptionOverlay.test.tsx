// Regression coverage for feature E's root cause: CaptionOverlay's real STT
// wiring (onSpeechPartialResults/onSpeechResults/onSpeechEnd restart-loop)
// was always correct, but was permanently gated off by a hardcoded
// `VOICE_STT_ENABLED = false` behind a stale comment claiming prerequisites
// (dependency install, pod install, Info.plist permissions) weren't met —
// they all already were. This confirms the real @react-native-voice/voice
// module (mocked here to simulate "available on a real device", since the
// jsdom/Jest test environment has no native module behind it) now actually
// drives start/stop/caption-forwarding instead of being compiled out.

jest.mock('@react-native-voice/voice', () => ({
  default: {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  },
}));

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import CaptionOverlay, { voiceSTTAvailable } from '../CaptionOverlay';

const Voice = require('@react-native-voice/voice').default;

describe('CaptionOverlay — real STT wiring', () => {
  const activeRenderers: ReactTestRenderer.ReactTestRenderer[] = [];
  afterEach(async () => {
    while (activeRenderers.length) {
      const r = activeRenderers.pop()!;
      await ReactTestRenderer.act(async () => { r.unmount(); });
    }
    jest.clearAllMocks();
  });

  it('voiceSTTAvailable is true when the native module loads (no longer hardcoded off)', () => {
    expect(voiceSTTAvailable).toBe(true);
  });

  it('starts Voice recognition when isSending is true', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <CaptionOverlay captions={[]} isSending onCaption={jest.fn()} onToggleSend={jest.fn()} />,
      );
    });
    activeRenderers.push(renderer!);

    expect(Voice.start).toHaveBeenCalledWith('en-US');
  });

  it('stops Voice recognition when isSending is false', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <CaptionOverlay captions={[]} isSending={false} onCaption={jest.fn()} onToggleSend={jest.fn()} />,
      );
    });
    activeRenderers.push(renderer!);

    expect(Voice.start).not.toHaveBeenCalled();
    expect(Voice.stop).toHaveBeenCalled();
  });

  it('forwards a final speech result to onCaption, not a hardcoded/mocked string', async () => {
    const onCaption = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <CaptionOverlay captions={[]} isSending onCaption={onCaption} onToggleSend={jest.fn()} />,
      );
    });
    activeRenderers.push(renderer!);

    await ReactTestRenderer.act(async () => {
      Voice.onSpeechResults({ value: ['Grace and peace to you'] });
    });

    expect(onCaption).toHaveBeenCalledWith('Grace and peace to you');
  });

  it('stops Voice on unmount, leaving no dangling recognition session', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <CaptionOverlay captions={[]} isSending onCaption={jest.fn()} onToggleSend={jest.fn()} />,
      );
    });
    Voice.stop.mockClear();

    await ReactTestRenderer.act(async () => {
      renderer!.unmount();
    });

    expect(Voice.stop).toHaveBeenCalled();
  });
});
