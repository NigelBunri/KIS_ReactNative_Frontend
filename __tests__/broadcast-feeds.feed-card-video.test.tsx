import './phase5.jest.setup';

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import BroadcastFeedCard from '@/components/broadcast/BroadcastFeedCard';

jest.mock('@/theme/useTheme', () => ({
  useKISTheme: () => ({
    palette: {
      card: '#fff',
      divider: '#ddd',
      text: '#000',
      subtext: '#555',
      primary: '#111',
      primarySoft: '#eee',
      primaryStrong: '#111',
      surface: '#f6f6f6',
      danger: '#c00',
      bar: '#ccc',
    },
    tokens: {},
  }),
}));

jest.mock('@/constants/kisIcons', () => ({
  KISIcon: () => null,
}));

jest.mock('@/network', () => ({
  resolveBackendAssetUrl: (value: string) => value,
  // BroadcastFeedVideoPreview reads auth/device headers for the video
  // source via this hook; a real render doesn't need real headers, just a
  // stable object so it doesn't crash for being undefined.
  useMediaHeaders: () => ({}),
}));

jest.mock('@/components/common/KISText', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockKISText(props: any) {
    return React.createElement(Text, props, props.children);
  };
});

jest.mock('@/components/feeds/RichTextRenderer', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockRichTextRenderer() {
    return React.createElement(Text, null, 'rich-text');
  };
});

describe('broadcast feed card video cues', () => {
  test('shows a play cue for video attachments on the active feed card', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <BroadcastFeedCard
          item={{
            id: 'broadcast-video-1',
            source_type: 'broadcast_profile',
            title: 'Video broadcast',
            text_plain: 'Watch this clip',
            attachments: [
              {
                url: 'https://cdn.example.com/media/video-1.mp4',
                thumb_url: 'https://cdn.example.com/media/video-1.jpg',
                media_type: 'video',
              },
            ],
            source: { type: 'broadcast_profile', name: 'Broadcast feed' },
            author: { display_name: 'Nigel' },
          }}
          onLike={jest.fn()}
          onShare={jest.fn()}
          onOpenSource={jest.fn()}
        />,
      );
    });

    // BroadcastFeedCard's own "Play video" text pill (styles.playText) is
    // now only a fallback for the rare case where an attachment couldn't
    // be resolved to a raw record — see the comment above its render
    // condition in BroadcastFeedCard.tsx. This attachment resolves fine,
    // so BroadcastFeedVideoPreview renders its own (icon-only, no text)
    // poster instead; the equivalent, current "play cue" to assert on is
    // that the player mounts paused (autoPlay defaults to false here),
    // which is what makes that poster/tap-to-play affordance show at all.
    const video = renderer!.root.findByProps({ testID: 'mock-video' });
    expect(video.props.paused).toBe(true);
  });
});
