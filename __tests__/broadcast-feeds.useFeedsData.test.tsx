import './phase5.jest.setup';

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import useFeedsData from '@/screens/broadcast/feeds/hooks/useFeedsData';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
const ReactNative = require('react-native');
ReactNative.DeviceEventEmitter = {
  emit: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
};

jest.mock('@/network', () => ({
  __esModule: true,
  default: {
    broadcasts: {
      list: '/api/v1/broadcasts/',
      react: (id: string) => `/api/v1/broadcasts/${id}/react/`,
      share: (id: string) => `/api/v1/broadcasts/${id}/share/`,
      save: (id: string) => `/api/v1/broadcasts/${id}/save/`,
      hide: (id: string) => `/api/v1/broadcasts/${id}/hide/`,
      subscribe: '/api/v1/broadcasts/subscribe/',
    },
  },
  FEEDS_ENDPOINT: '/api/v1/broadcasts/',
}));

jest.mock('@/network/get', () => ({ getRequest: jest.fn() }));
jest.mock('@/network/post', () => ({ postRequest: jest.fn() }));

type HookRef = ReturnType<typeof useFeedsData>;

const mockedGetRequest = getRequest as jest.MockedFunction<typeof getRequest>;
const mockedPostRequest = postRequest as jest.MockedFunction<typeof postRequest>;

const baseItem = {
  id: 'broadcast-1',
  source_type: 'broadcast_profile',
  title: 'Alpha',
  text_plain: 'First item',
  reaction_count: 1,
  comment_count: 2,
  share_count: 0,
  viewer_saved: false,
  source: {
    type: 'partner',
    id: 'partner-1',
    name: 'Partner One',
    allow_subscribe: true,
    is_subscribed: false,
    can_open: false,
  },
};

const secondItem = {
  ...baseItem,
  id: 'broadcast-2',
  title: 'Beta',
  text_plain: 'Second item',
};

const thirdItem = {
  ...baseItem,
  id: 'broadcast-3',
  title: 'Gamma',
  text_plain: 'Third item',
};

const HookHarness = React.forwardRef<HookRef, { q?: string; code?: string | null }>(({ q = '', code = null }, ref) => {
  const value = useFeedsData({ q, code });
  React.useImperativeHandle(ref, () => value);
  return null;
});

describe('broadcast feeds useFeedsData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loads first page with query params and exposes pagination state', async () => {
    mockedGetRequest.mockResolvedValueOnce({
      success: true,
      data: {
        count: 3,
        next: 'https://kis.app/api/v1/broadcasts/?limit=20&offset=20&q=alpha',
        previous: null,
        results: [baseItem, secondItem],
      },
      message: '',
    } as any);

    const ref = React.createRef<HookRef>();

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<HookHarness ref={ref} q="alpha" code="broadcast_feed_entry" />);
    });

    expect(mockedGetRequest).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/broadcasts/?q=alpha&code=broadcast_feed_entry&limit=20&offset=0'),
      expect.objectContaining({ errorMessage: 'Unable to load feeds.' }),
    );
    expect(ref.current?.items.map((item) => item.id)).toEqual(['broadcast-1', 'broadcast-2']);
    expect(ref.current?.loading).toBe(false);
    expect(ref.current?.loadingMore).toBe(false);
  });

  test('loads more items from backend pagination url', async () => {
    mockedGetRequest
      .mockResolvedValueOnce({
        success: true,
        data: {
          count: 3,
          next: 'https://kis.app/api/v1/broadcasts/?limit=20&offset=20',
          previous: null,
          results: [baseItem, secondItem],
        },
        message: '',
      } as any)
      .mockResolvedValueOnce({
        success: true,
        data: {
          count: 3,
          next: null,
          previous: 'https://kis.app/api/v1/broadcasts/?limit=20&offset=0',
          results: [thirdItem],
        },
        message: '',
      } as any);

    const ref = React.createRef<HookRef>();

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<HookHarness ref={ref} />);
    });

    await ReactTestRenderer.act(async () => {
      await ref.current?.loadMore();
    });

    expect(mockedGetRequest).toHaveBeenNthCalledWith(
      2,
      'https://kis.app/api/v1/broadcasts/?limit=20&offset=20',
      expect.objectContaining({ errorMessage: 'Unable to load more.' }),
    );
    expect(ref.current?.items.map((item) => item.id)).toEqual(['broadcast-1', 'broadcast-2', 'broadcast-3']);
  });

  test('handles optimistic react success, save, hide, and subscribe transitions', async () => {
    mockedGetRequest.mockResolvedValueOnce({
      success: true,
      data: { count: 1, next: null, previous: null, results: [baseItem] },
      message: '',
    } as any);

    mockedPostRequest
      .mockResolvedValueOnce({ success: true, data: { count: 2, reacted: true }, message: '' } as any)
      .mockResolvedValueOnce({ success: true, data: { saved: true }, message: '' } as any)
      .mockResolvedValueOnce({ success: true, data: { hidden: true }, message: '' } as any)
      .mockResolvedValueOnce({ success: true, data: { subscribed: true }, message: '' } as any);

    const ref = React.createRef<HookRef>();

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<HookHarness ref={ref} />);
    });

    await ReactTestRenderer.act(async () => {
      await ref.current?.reactToItem('broadcast-1');
    });
    expect(ref.current?.items[0].reaction_count).toBe(2);
    expect(ref.current?.items[0].viewer_reaction).toBe('❤️');

    await ReactTestRenderer.act(async () => {
      await ref.current?.toggleSaved('broadcast-1', false);
    });
    expect(ref.current?.items[0].viewer_saved).toBe(true);

    await ReactTestRenderer.act(async () => {
      await ref.current?.toggleSubscribe(ref.current?.items[0].source as any, false);
    });
    expect(ref.current?.items[0].source?.is_subscribed).toBe(true);
    expect(ref.current?.items[0].source?.can_open).toBe(true);

    await ReactTestRenderer.act(async () => {
      await ref.current?.hideItem('broadcast-1');
    });
    expect(ref.current?.items).toEqual([]);
  });

  test('rolls back optimistic reaction and keeps state stable on errors', async () => {
    mockedGetRequest.mockResolvedValueOnce({
      success: true,
      data: { count: 1, next: null, previous: null, results: [baseItem] },
      message: '',
    } as any);

    mockedPostRequest
      .mockResolvedValueOnce({ success: false, message: 'boom' } as any)
      .mockResolvedValueOnce({ success: false, message: 'save failed' } as any)
      .mockResolvedValueOnce({ success: false, message: 'hide failed' } as any);

    const ref = React.createRef<HookRef>();

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<HookHarness ref={ref} />);
    });

    await ReactTestRenderer.act(async () => {
      const result = await ref.current?.reactToItem('broadcast-1');
      expect(result?.ok).toBe(false);
    });
    expect(ref.current?.items[0].reaction_count).toBe(1);

    await ReactTestRenderer.act(async () => {
      const result = await ref.current?.toggleSaved('broadcast-1', false);
      expect(result?.ok).toBe(false);
    });
    expect(ref.current?.items[0].viewer_saved).toBe(false);

    await ReactTestRenderer.act(async () => {
      const result = await ref.current?.hideItem('broadcast-1');
      expect(result?.ok).toBe(false);
    });
    expect(ref.current?.items.map((item) => item.id)).toEqual(['broadcast-1']);
  });
});
