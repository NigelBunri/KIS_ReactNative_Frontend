import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import BroadcastDetailScreen from '@/screens/tabs/feeds/BroadcastDetailScreen';

let lastVideoPreviewProps: any = null;
let mockIsFocused = true;

const mockRoute = {
  params: {
    id: 'broadcast-1',
    item: {
      id: 'broadcast-1',
      title: 'Video post',
      text_plain: '',
      reaction_count: 0,
      comment_count: 0,
      share_count: 0,
      viewer_reaction: null,
      viewer_saved: false,
      attachments: [
        { id: 'att-1', media_type: 'video', url: 'https://cdn.example.com/a.mp4' },
      ],
      engagement: { reactions: 0, comments: 0 },
    },
  },
};

const ReactNative = require('react-native');
ReactNative.Share = { share: jest.fn(() => Promise.resolve({ action: 'sharedAction' })) };
ReactNative.DeviceEventEmitter = { emit: jest.fn(), addListener: jest.fn(() => ({ remove: jest.fn() })) };
ReactNative.AppState = {
  currentState: 'active',
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
  useRoute: () => mockRoute,
  useIsFocused: () => mockIsFocused,
}));

jest.mock('@/theme/useTheme', () => ({
  useKISTheme: () => ({
    palette: {
      bg: '#fff', text: '#000', primary: '#111', primaryStrong: '#111',
      subtext: '#555', divider: '#ddd', surface: '#f4f4f4', bar: '#ccc', royalInk: '#000', ivory: '#fff',
    },
  }),
}));

jest.mock('@/constants/kisIcons', () => ({ KISIcon: () => null }));

jest.mock('@/components/broadcast/BroadcastFeedVideoPreview', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  return function MockBroadcastFeedVideoPreview(props: any) {
    lastVideoPreviewProps = props;
    return ReactLocal.createElement(View, { testID: 'mock-video-preview' });
  };
});

jest.mock('@/network', () => ({
  __esModule: true,
  default: {
    broadcasts: {
      react: (id: string) => `/api/v1/broadcasts/${id}/react/`,
      commentRoom: (id: string) => `/api/v1/broadcasts/${id}/comment-room/`,
      save: (id: string) => `/api/v1/broadcasts/${id}/save/`,
      share: (id: string) => `/api/v1/broadcasts/${id}/share/`,
    },
  },
  resolveBackendAssetUrl: (value: string) => value,
}));

jest.mock('@/network/post', () => ({ postRequest: jest.fn().mockResolvedValue({ success: true }) }));

describe('BroadcastDetailScreen video hardening (focus/background pause)', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  beforeEach(() => {
    mockIsFocused = true;
    ReactNative.AppState.currentState = 'active';
    ReactNative.AppState.addEventListener.mockClear();
    lastVideoPreviewProps = null;
  });

  afterEach(async () => {
    if (renderer) {
      await ReactTestRenderer.act(async () => {
        renderer.unmount();
      });
    }
  });

  it('does not pause the video while the screen is focused and the app is active', async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<BroadcastDetailScreen />);
    });

    expect(lastVideoPreviewProps.externalPause).toBe(false);
  });

  it('pauses the video when the screen loses navigation focus', async () => {
    mockIsFocused = false;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<BroadcastDetailScreen />);
    });

    expect(lastVideoPreviewProps.externalPause).toBe(true);
  });

  it('pauses the video when the app backgrounds, and resumes when it foregrounds again', async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<BroadcastDetailScreen />);
    });
    expect(lastVideoPreviewProps.externalPause).toBe(false);

    // Read the subscribed callback straight from Jest's own call-tracking
    // rather than the closure array above — react-test-renderer can invoke
    // effects more than once internally, and relying on jest.fn()'s
    // recorded call arguments (guaranteed accurate) sidesteps that instead
    // of trying to reason about exactly how many times a side effect ran.
    expect(ReactNative.AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    const cb = ReactNative.AppState.addEventListener.mock.calls[0][1];

    await ReactTestRenderer.act(async () => {
      cb('background');
    });
    expect(lastVideoPreviewProps.externalPause).toBe(true);

    await ReactTestRenderer.act(async () => {
      cb('active');
    });
    expect(lastVideoPreviewProps.externalPause).toBe(false);
  });

  it('only ever mounts one video preview instance at a time', async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<BroadcastDetailScreen />);
    });

    // findAllByProps matches both the composite View wrapper and its
    // underlying host node for the same logical element — filter to host
    // (string-typed) nodes so this counts real rendered instances, not
    // fiber-tree artifacts of the same one.
    const videoPreviews = renderer!.root.findAll(
      (node) => node.props?.testID === 'mock-video-preview' && typeof node.type === 'string',
    );
    expect(videoPreviews).toHaveLength(1);
  });

  it('renders the active full-screen page WITHOUT a transform style (the SurfaceView-under-transform fix)', async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<BroadcastDetailScreen />);
    });

    const videoPreview = renderer!.root.findByProps({ testID: 'mock-video-preview' });
    // Walk up from the video preview to its Animated.View ancestor(s) and
    // assert none of them carry a `transform` style — this is the actual
    // regression the audio-plays-picture-black bug came from.
    let node: any = videoPreview.parent;
    let sawAnimatedView = false;
    while (node) {
      const style = node.props?.style;
      const flatStyle = Array.isArray(style) ? style : [style];
      for (const s of flatStyle) {
        if (s && typeof s === 'object' && 'transform' in s) {
          throw new Error('An ancestor of the active video has a transform style — this reintroduces the SurfaceView compositing bug.');
        }
      }
      const typeName = (node.type as any)?.displayName ?? (node.type as any)?.name ?? '';
      if (String(typeName).startsWith('Animated(')) {
        sawAnimatedView = true;
      }
      node = node.parent;
    }
    // Sanity check the walk actually traversed through an Animated wrapper
    // (otherwise this test would trivially pass without checking anything
    // — a missing ancestor is not the same as a safe one).
    expect(sawAnimatedView).toBe(true);
  });
});
