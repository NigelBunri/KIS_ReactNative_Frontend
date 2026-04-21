import './phase5.jest.setup';

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import FeedItemCard from '@/components/broadcast/FeedItemCard';

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
    },
  }),
}));

jest.mock('@/constants/kisIcons', () => ({
  KISIcon: () => null,
}));

jest.mock('@/network', () => ({
  resolveBackendAssetUrl: (value: string) => value,
}));

describe('broadcast feed trending card', () => {
  test('deduplicates repeated first attachment in slideshow mode', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <FeedItemCard
          item={{
            id: 'trend-1',
            title: 'Trending item',
            body: 'Body',
            broadcastedAt: '2026-04-16T10:00:00Z',
            attachments: [
              {
                url: 'https://cdn.example.com/files/first.jpg',
                preview_url: 'https://cdn.example.com/files/first.jpg',
                type: 'image/jpeg',
              },
              {
                file_url: 'https://cdn.example.com/files/first.jpg',
                thumb_url: 'https://cdn.example.com/files/first.jpg',
                mime_type: 'image/jpeg',
              },
              {
                url: 'https://cdn.example.com/files/second.jpg',
                preview_url: 'https://cdn.example.com/files/second.jpg',
                type: 'image/jpeg',
              },
            ],
            engagement: { reactions: 1, comments: 0 },
          } as any}
          onPress={jest.fn()}
          onReact={jest.fn()}
        />,
      );
    });

    const dots = renderer!.root.findAll(
      (node) => node.props.testID === 'feed-item-card-dot' && node.type === 'View',
    );
    expect(dots).toHaveLength(2);
  });
});
