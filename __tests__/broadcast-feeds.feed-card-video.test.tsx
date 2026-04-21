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

    const textNodes = renderer!.root.findAllByType('Text');
    const renderedText = textNodes
      .map((node) => {
        const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
        return children.filter((value) => value !== null && value !== undefined).join('');
      })
      .join(' ');
    expect(renderedText).toContain('Play video');
  });
});
