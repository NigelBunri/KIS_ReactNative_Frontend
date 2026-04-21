import './phase5.jest.setup';

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import BroadcastFeedVideoPreview from '@/components/broadcast/BroadcastFeedVideoPreview';
import {
  getBroadcastFeedVideoRiskNote,
  getBroadcastFeedVideoSourceLabel,
  getBroadcastFeedVideoSources,
} from '@/components/broadcast/feedVideoPlayback';
import { API_PORT, DEV_BACKEND_HOST } from '@/network/config';

let latestVideoProps: any = null;

const DEV_API_BASE = `http://${DEV_BACKEND_HOST}:${API_PORT}`;

jest.mock('@/Module/vieo', () => ({
  KISVideo: (props: any) => {
    latestVideoProps = props;
    const React = require('react');
    const { View, Text } = require('react-native');
    return React.createElement(
      View,
      { testID: 'kis-video' },
      React.createElement(Text, null, props.sourceUrl),
    );
  },
}));

describe('broadcast feeds video playback', () => {
  const palette = {
    text: '#111',
    subtext: '#666',
    primaryStrong: '#000',
    divider: '#ddd',
    surface: '#f5f5f5',
    bar: '#ccc',
    danger: '#c00',
  } as any;
  let warnSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;

  beforeEach(() => {
    latestVideoProps = null;
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  test('prefers safe sources first, deduplicates sources, and exposes host risk metadata', () => {
    const sources = getBroadcastFeedVideoSources({
      stream_url: `${DEV_API_BASE}/api/v1/broadcasts/videos/video-1/stream/`,
      url: 'https://cdn.example.com/media/video-1.mp4',
      uri: 'https://cdn.example.com/media/video-1.mp4',
    });

    expect(sources.map((source) => source.kind)).toEqual(['url', 'stream_url']);
    expect(getBroadcastFeedVideoSourceLabel(sources[0])).toBe('file');
    expect(getBroadcastFeedVideoRiskNote(sources[0])).toBe(null);
    expect(['http-source', 'loopback-host']).toContain(getBroadcastFeedVideoRiskNote(sources[1]));
  });

  test('rewrites loopback asset urls onto the configured backend base', () => {
    const sources = getBroadcastFeedVideoSources({
      stream_url: `${DEV_API_BASE}/api/v1/broadcasts/videos/video-1/stream/`,
    });

    expect(sources).toHaveLength(1);
    expect(sources[0].url).toBe(`${DEV_API_BASE}/api/v1/broadcasts/videos/video-1/stream/`);
    expect(sources[0].host).toBe(DEV_BACKEND_HOST);
    expect(['http-source', 'loopback-host']).toContain(getBroadcastFeedVideoRiskNote(sources[0]));
  });

  test('falls back from stream_url to url when the first source fails', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <BroadcastFeedVideoPreview
          attachment={{
            stream_url: 'https://api.example.com/api/v1/broadcasts/videos/video-1/stream/',
            url: 'https://cdn.example.com/media/video-1.mp4',
            media_type: 'video',
          }}
          palette={palette}
        />,
      );
    });

    expect(latestVideoProps.sourceUrl).toBe('https://api.example.com/api/v1/broadcasts/videos/video-1/stream/');

    await ReactTestRenderer.act(async () => {
      latestVideoProps.onError('stream failed');
    });

    expect(latestVideoProps.sourceUrl).toBe('https://cdn.example.com/media/video-1.mp4');
    const textNodes = renderer!.root.findAllByType('Text');
    const renderedText = textNodes
      .map((node) => {
        const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
        return children.filter((value) => value !== null && value !== undefined).join('');
      })
      .join(' ');
    expect(renderedText).toContain('Using fallback source: file');
  });

  test('skips a risky loopback stream source when a safer file url exists', async () => {
    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <BroadcastFeedVideoPreview
          attachment={{
            stream_url: `${DEV_API_BASE}/api/v1/broadcasts/videos/video-1/stream/`,
            url: 'https://cdn.example.com/media/video-1.mp4',
            media_type: 'video',
          }}
          palette={palette}
        />,
      );
    });

    expect(latestVideoProps.sourceUrl).toBe('https://cdn.example.com/media/video-1.mp4');
  });

  test('shows a clear failure state when all sources fail', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <BroadcastFeedVideoPreview
          attachment={{
            stream_url: 'https://api.example.com/api/v1/broadcasts/videos/video-2/stream/',
            url: 'https://cdn.example.com/media/video-2.mp4',
            media_type: 'video',
          }}
          palette={palette}
        />,
      );
    });

    await ReactTestRenderer.act(async () => {
      latestVideoProps.onError('stream failed');
    });

    await ReactTestRenderer.act(async () => {
      latestVideoProps.onError('file failed');
    });

    const textNodes = renderer!.root.findAllByType('Text');
    const renderedText = textNodes
      .map((node) => {
        const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
        return children.filter((value) => value !== null && value !== undefined).join('');
      })
      .join(' ');
    expect(renderedText).toContain('Playback failed');
    expect(renderedText).toContain('Tried stream then file.');
  });
});
