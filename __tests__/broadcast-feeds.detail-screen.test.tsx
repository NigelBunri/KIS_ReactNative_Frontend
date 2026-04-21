import './phase5.jest.setup';

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import BroadcastDetailScreen from '@/screens/tabs/feeds/BroadcastDetailScreen';
import { postRequest } from '@/network/post';

let lastVideoPreviewProps: any = null;

const mockGoBack = jest.fn();
const mockRoute = {
  params: {
    id: 'broadcast-1',
    item: {
      id: 'broadcast-1',
      title: 'Detail post',
      text_plain: 'Detail body',
      reaction_count: 2,
      comment_count: 3,
      share_count: 1,
      viewer_reaction: null,
      viewer_saved: false,
      attachments: [],
      engagement: {
        reactions: 2,
        comments: 3,
      },
    },
  },
};
const baseRouteItem = { ...mockRoute.params.item };

const ReactNative = require('react-native');
ReactNative.Share = {
  share: jest.fn(() => Promise.resolve({ action: 'sharedAction' })),
};
ReactNative.DeviceEventEmitter = {
  emit: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => mockRoute,
}));

jest.mock('@/theme/useTheme', () => ({
  useKISTheme: () => ({
    palette: {
      bg: '#fff',
      text: '#000',
      primary: '#111',
      primaryStrong: '#111',
      subtext: '#555',
      divider: '#ddd',
      surface: '#f4f4f4',
      bar: '#ccc',
    },
  }),
}));

jest.mock('@/constants/kisIcons', () => ({
  KISIcon: () => null,
}));

jest.mock('@/components/broadcast/BroadcastFeedVideoPreview', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return function MockBroadcastFeedVideoPreview(props: any) {
    lastVideoPreviewProps = props;
    return React.createElement(
      View,
      { testID: 'broadcast-detail-video-preview' },
      React.createElement(Text, null, 'video-preview'),
    );
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

jest.mock('@/network/post', () => ({ postRequest: jest.fn() }));

const mockedPostRequest = postRequest as jest.MockedFunction<typeof postRequest>;

describe('broadcast detail screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastVideoPreviewProps = null;
    mockRoute.params.item = { ...baseRouteItem, attachments: [] };
  });

  test('wires react, comment, save, and share actions to the backend contract', async () => {
    mockedPostRequest
      .mockResolvedValueOnce({ success: true, data: { count: 3, reacted: true } } as any)
      .mockResolvedValueOnce({ success: true, data: { conversation_id: 'conversation-1' } } as any)
      .mockResolvedValueOnce({ success: true } as any)
      .mockResolvedValueOnce({ success: true } as any);

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<BroadcastDetailScreen />);
    });

    const pressables = renderer!.root.findAllByType('Pressable');

    await ReactTestRenderer.act(async () => {
      await pressables[2].props.onPress();
    });
    expect(mockedPostRequest).toHaveBeenNthCalledWith(
      1,
      '/api/v1/broadcasts/broadcast-1/react/',
      { emoji: '❤️' },
      expect.objectContaining({ errorMessage: 'Unable to register reaction.' }),
    );

    await ReactTestRenderer.act(async () => {
      await pressables[3].props.onPress();
    });
    expect(mockedPostRequest).toHaveBeenNthCalledWith(
      2,
      '/api/v1/broadcasts/broadcast-1/comment-room/',
      {},
      expect.objectContaining({ errorMessage: 'Unable to load comments.' }),
    );
    expect(ReactNative.DeviceEventEmitter.emit).toHaveBeenCalledWith(
      'chat.open',
      expect.objectContaining({ conversationId: 'conversation-1' }),
    );

    await ReactTestRenderer.act(async () => {
      await pressables[1].props.onPress();
    });
    expect(mockedPostRequest).toHaveBeenNthCalledWith(
      3,
      '/api/v1/broadcasts/broadcast-1/save/',
      {},
      expect.objectContaining({ errorMessage: 'Unable to save broadcast.' }),
    );

    await ReactTestRenderer.act(async () => {
      await pressables[4].props.onPress();
    });
    expect(mockedPostRequest).toHaveBeenNthCalledWith(
      4,
      '/api/v1/broadcasts/broadcast-1/share/',
      { platform: 'app' },
      expect.objectContaining({ errorMessage: 'Unable to log share.' }),
    );
    expect(ReactNative.Share.share).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Detail post' }),
    );

    const textNodes = renderer!.root.findAllByType('Text');
    const renderedText = textNodes
      .map((node) => {
        const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
        return children.filter((value) => value !== null && value !== undefined).join('');
      })
      .join(' ');
    expect(renderedText).toContain('Saved');
    expect(renderedText).toContain('React 3');
    expect(renderedText).toContain('Comment 3');
    expect(renderedText).toContain('Share 2');
  });

  test('uses the shared feed video preview contract for video attachments', async () => {
    mockRoute.params.item = {
      ...mockRoute.params.item,
      attachments: [
        {
          stream_url: 'https://api.example.com/api/v1/broadcasts/videos/video-1/stream/',
          url: 'https://cdn.example.com/media/video-1.mp4',
          media_type: 'video',
        },
      ],
    };

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<BroadcastDetailScreen />);
    });

    const videoPreview = renderer!.root.findByProps({ testID: 'broadcast-detail-video-preview' });
    expect(videoPreview).toBeTruthy();
    expect(lastVideoPreviewProps.attachment.stream_url).toBe(
      'https://api.example.com/api/v1/broadcasts/videos/video-1/stream/',
    );
  });
});
