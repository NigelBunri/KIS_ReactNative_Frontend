import './phase5.jest.setup';

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import BroadcastDetailScreen from '@/screens/tabs/feeds/BroadcastDetailScreen';
import ChatRoomPage from '@/Module/ChatRoom/ChatRoomPage';
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

// Patched in place with jest.spyOn rather than replaced wholesale
// (`ReactNative.Share = {...}` / `ReactNative.DeviceEventEmitter = {...}`):
// BroadcastDetailScreen renders a real (unmocked) ChatRoomPage overlay,
// which captures its own reference to these singletons on import — a
// fresh replacement object here wouldn't be seen by code that already
// holds the original, so the emit/addListener spy would silently never
// fire from the component's perspective. Spying on the existing objects'
// methods keeps everyone pointed at the same instance.
const ReactNative = require('react-native');
jest.spyOn(ReactNative.Share, 'share').mockResolvedValue({ action: 'sharedAction' });
jest.spyOn(ReactNative.DeviceEventEmitter, 'emit').mockImplementation(() => {});
jest.spyOn(ReactNative.DeviceEventEmitter, 'addListener').mockReturnValue({ remove: jest.fn() });

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => mockRoute,
  // BroadcastDetailScreen forces video playback off when the screen loses
  // focus (see its externalPause wiring) — tests render it as the active
  // screen, so focused is the correct default here.
  useIsFocused: () => true,
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
    // The comment button opens a real ChatRoomPage overlay (see
    // BroadcastDetailScreen's overlayChat), whose mark-as-read effect
    // calls ROUTES.chat.markRead as soon as it mounts — needed here even
    // though this test never asserts on it directly.
    chat: {
      markRead: (conversationId: string) => `/api/v1/chats/conversations/${conversationId}/mark-read/`,
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
      // Opening the comment room mounts a real (unmocked) ChatRoomPage
      // overlay, whose mark-as-read effect fires its own postRequest call
      // as soon as it mounts — one more queued response than the four
      // user-initiated actions below.
      .mockResolvedValueOnce({ success: true } as any)
      .mockResolvedValueOnce({ success: true } as any)
      .mockResolvedValueOnce({ success: true } as any);

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<BroadcastDetailScreen />);
    });

    // findAllByType('Pressable') (a string) never matches: RN's Pressable
    // is a composite component, not a host primitive, so its test-instance
    // type is never the literal string "Pressable" — that lookup always
    // returned an empty array here, so every pressables[n] below was
    // reading `undefined`. Matching by the component's function `.name`
    // sidesteps that (and also survives require('react-native') resolving
    // to a distinct module instance from the one BroadcastDetailScreen.tsx
    // renders with, which made `findAllByType(Pressable)` — the imported
    // reference — fail identity comparison too). Render order here (no
    // gallery attachments ⇒ no nav arrows) is: [0] back button, [1] title
    // block (opens details), [2] Save, [3] React, [4] Comment, [5] Share.
    const pressables = renderer!.root.findAll(
      (node) => typeof node.type !== 'string' && (node.type as any)?.name === 'Pressable',
    );

    await ReactTestRenderer.act(async () => {
      await pressables[3].props.onPress();
    });
    expect(mockedPostRequest).toHaveBeenNthCalledWith(
      1,
      '/api/v1/broadcasts/broadcast-1/react/',
      { emoji: '❤️' },
      expect.objectContaining({ errorMessage: 'Unable to register reaction.' }),
    );

    await ReactTestRenderer.act(async () => {
      await pressables[4].props.onPress();
    });
    expect(mockedPostRequest).toHaveBeenNthCalledWith(
      2,
      '/api/v1/broadcasts/broadcast-1/comment-room/',
      {},
      expect.objectContaining({ errorMessage: 'Unable to load comments.' }),
    );
    // The comments button opens a chat room as a local overlay owned by
    // this screen, not via the app-wide 'chat.open' DeviceEventEmitter
    // event (see the openChatOverlay/handleOpenComments comment in
    // BroadcastDetailScreen.tsx for why that event was dropped) — so the
    // right assertion is that the overlay is now showing the right room,
    // not that any event fired.
    const chatOverlay = renderer!.root.findByType(ChatRoomPage);
    expect(chatOverlay.props.chat).toEqual(
      expect.objectContaining({ conversationId: 'conversation-1' }),
    );

    await ReactTestRenderer.act(async () => {
      await pressables[2].props.onPress();
    });
    expect(mockedPostRequest).toHaveBeenNthCalledWith(
      4,
      '/api/v1/broadcasts/broadcast-1/save/',
      {},
      expect.objectContaining({ errorMessage: 'Unable to save broadcast.' }),
    );

    // Share is now a two-step flow: the floating share button only opens an
    // in-screen option sheet (share to another app vs. share to a chat) —
    // Share.share()/logShare() moved into handleShareToApp, fired by
    // pressing "Share to another app" inside that sheet, not by the
    // floating button itself. The sheet's Pressables don't exist in the
    // tree until shareOptionsVisible flips true, so they have to be
    // located fresh after that click rather than from the earlier
    // `pressables` snapshot.
    await ReactTestRenderer.act(async () => {
      await pressables[5].props.onPress();
    });
    const shareToAppLabel = renderer!.root.find(
      (node) => node.props?.children === 'Share to another app',
    );
    let shareToAppButton: ReactTestRenderer.ReactTestInstance | null = shareToAppLabel;
    while (shareToAppButton && !(typeof shareToAppButton.type !== 'string' && (shareToAppButton.type as any)?.name === 'Pressable')) {
      shareToAppButton = shareToAppButton.parent;
    }
    await ReactTestRenderer.act(async () => {
      await shareToAppButton!.props.onPress();
    });
    expect(mockedPostRequest).toHaveBeenNthCalledWith(
      5,
      '/api/v1/broadcasts/broadcast-1/share/',
      { platform: 'app' },
      expect.objectContaining({ errorMessage: 'Unable to log share.' }),
    );
    expect(ReactNative.Share.share).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Detail post' }),
    );

    // The floating action buttons are icon + bare count now (no "React"/
    // "Comment"/"Share" label prefix — see the Pressable/Text pairs in
    // BroadcastDetailScreen.tsx's floatingActions block), so counts are
    // asserted per-button via the same `pressables` instances rather than
    // matched as substrings of the whole screen's concatenated text, where
    // a bare "3" or "2" would be ambiguous.
    const textOf = (instance: ReactTestRenderer.ReactTestInstance) =>
      instance
        .findAllByType('Text' as any)
        .map((node) => {
          const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
          return children.filter((value: unknown) => value !== null && value !== undefined).join('');
        })
        .join(' ');
    expect(textOf(pressables[2])).toContain('Saved');
    expect(textOf(pressables[3])).toBe('3');
    expect(textOf(pressables[4])).toBe('3');
    expect(textOf(pressables[5])).toBe('2');
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
