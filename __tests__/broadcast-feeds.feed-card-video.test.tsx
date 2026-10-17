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
    // The YouTube-style play-cue circle (added by the broadcast-feeds
    // redesign, commit 17c6836) reads gradients.tabSelected directly - a
    // 4-stop gradient tuple, matching the real useKISTheme's shape
    // (KISAccentGradients in src/theme/constants.ts).
    gradients: {
      header: ['#111', '#222', '#333', '#444'],
      tabSelected: ['#111', '#222', '#333', '#444'],
    },
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

    // Updated for the current BroadcastFeedCard.tsx (post commit 17c6836):
    // BroadcastFeedVideoPreview (the actual <Video> player) no longer
    // mounts at all until the user taps play - it's gated behind local
    // `inlinePlaying` state (setInlinePlaying(true) on press), not mounted
    // paused upfront. Until then, the card shows a static poster plus this
    // accessible play-cue button - that affordance IS the "play cue" this
    // test exists to verify, so assert on it directly instead of reaching
    // into a player that isn't there yet.
    const playButton = renderer!.root.findByProps({ accessibilityLabel: 'Play' });
    expect(playButton.props.accessibilityRole).toBe('button');
  });
});
