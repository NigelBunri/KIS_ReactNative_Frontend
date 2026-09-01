import './phase5.jest.setup';

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { useResponsibleFeedLimit } from '@/hooks/useResponsibleFeedLimit';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

jest.mock('@/network', () => ({
  __esModule: true,
  default: {
    engagement: {
      feedHeartbeat: '/api/v1/engagement/feed-heartbeat/',
      feedStatus: '/api/v1/engagement/feed-status/',
    },
  },
}));

jest.mock('@/network/get', () => ({ getRequest: jest.fn() }));
jest.mock('@/network/post', () => ({ postRequest: jest.fn() }));

const mockedGetRequest = getRequest as jest.MockedFunction<typeof getRequest>;
const mockedPostRequest = postRequest as jest.MockedFunction<typeof postRequest>;

type HookRef = ReturnType<typeof useResponsibleFeedLimit>;

const HookHarness = React.forwardRef<HookRef, { active: boolean }>(({ active }, ref) => {
  const value = useResponsibleFeedLimit(active);
  React.useImperativeHandle(ref, () => value);
  return null;
});

const notReached = {
  seconds_consumed: 100,
  limit_seconds: 7200,
  seconds_remaining: 7100,
  limit_reached: false,
};

const reached = {
  seconds_consumed: 7200,
  limit_seconds: 7200,
  seconds_remaining: 0,
  limit_reached: true,
};

describe('useResponsibleFeedLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // The interval's own heartbeat (unlike the immediate on-activate one)
    // additionally checks AppState.currentState so a backgrounded app
    // doesn't keep polling — pin it to 'active' for these tests.
    require('react-native').AppState.currentState = 'active';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fetches feed status on mount regardless of active state', async () => {
    mockedGetRequest.mockResolvedValue({ success: true, data: notReached } as any);

    const ref = React.createRef<HookRef>();
    await act(async () => {
      ReactTestRenderer.create(React.createElement(HookHarness, { active: false, ref }));
    });

    expect(mockedGetRequest).toHaveBeenCalledWith(
      '/api/v1/engagement/feed-status/',
      expect.anything(),
    );
    expect(ref.current?.status).toEqual({
      secondsConsumed: 100,
      limitSeconds: 7200,
      secondsRemaining: 7100,
      limitReached: false,
    });
  });

  it('sends a heartbeat immediately once active, and never while inactive', async () => {
    mockedGetRequest.mockResolvedValue({ success: true, data: notReached } as any);
    mockedPostRequest.mockResolvedValue({ success: true, data: notReached } as any);

    const ref = React.createRef<HookRef>();
    await act(async () => {
      ReactTestRenderer.create(React.createElement(HookHarness, { active: false, ref }));
    });
    expect(mockedPostRequest).not.toHaveBeenCalled();

    await act(async () => {
      ReactTestRenderer.create(React.createElement(HookHarness, { active: true, ref }));
    });
    expect(mockedPostRequest).toHaveBeenCalledWith(
      '/api/v1/engagement/feed-heartbeat/',
      {},
      expect.anything(),
    );
  });

  it('sends repeated heartbeats on an interval while active, and stops when deactivated', async () => {
    mockedGetRequest.mockResolvedValue({ success: true, data: notReached } as any);
    mockedPostRequest.mockResolvedValue({ success: true, data: notReached } as any);

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(React.createElement(HookHarness, { active: true }));
    });
    const callsAfterMount = mockedPostRequest.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0);

    await act(async () => {
      jest.advanceTimersByTime(20000);
    });
    expect(mockedPostRequest.mock.calls.length).toBeGreaterThan(callsAfterMount);

    const callsBeforeDeactivate = mockedPostRequest.mock.calls.length;
    await act(async () => {
      renderer.update(React.createElement(HookHarness, { active: false }));
    });
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(mockedPostRequest.mock.calls.length).toBe(callsBeforeDeactivate);
  });

  it('surfaces limit_reached from a heartbeat response', async () => {
    mockedGetRequest.mockResolvedValue({ success: true, data: notReached } as any);
    mockedPostRequest.mockResolvedValue({ success: true, data: reached } as any);

    const ref = React.createRef<HookRef>();
    await act(async () => {
      ReactTestRenderer.create(React.createElement(HookHarness, { active: true, ref }));
    });

    expect(ref.current?.status?.limitReached).toBe(true);
    expect(ref.current?.status?.secondsRemaining).toBe(0);
  });

  it('leaves prior status untouched if the network call fails', async () => {
    mockedGetRequest.mockResolvedValue({ success: true, data: notReached } as any);
    mockedPostRequest.mockRejectedValue(new Error('network down'));

    const ref = React.createRef<HookRef>();
    await act(async () => {
      ReactTestRenderer.create(React.createElement(HookHarness, { active: true, ref }));
    });

    expect(ref.current?.status?.limitReached).toBe(false);
    expect(ref.current?.status?.secondsConsumed).toBe(100);
  });
});
