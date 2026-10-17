// Regression coverage for the real root cause of the broken "edit post"
// feature (both community AND partner feeds — FeedEditSheet is the single
// shared component both use via FeedScreen.tsx): it sent
// { text_plain, thumbnail_url } on save. Neither field is real —
// text_plain/text_preview are read-only on CommunityPostSerializer and
// PartnerPostSerializer (derived server-side from `text`, a ProseMirror-
// style doc), and there is no top-level thumbnail_url field at all (the
// real field is attachments[0].thumb_url). The PATCH returned 200 OK
// (DRF silently drops unknown/read-only input) while never actually
// changing the post — confirmed directly against the real Django
// serializers/views in this same session. This test locks in the
// corrected payload shape so a future "simplify this" pass can't silently
// regress back to the broken one.

jest.mock('@/theme/useTheme', () => ({
  useKISTheme: () => ({ palette: {} }),
}));
jest.mock('@/hooks/usePullDownToClose', () => {
  const { Animated } = require('react-native');
  return {
    __esModule: true,
    default: () => ({ dragY: new Animated.Value(0), panHandlers: {} }),
  };
});
jest.mock('@/security/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue('fake-token'),
}));
jest.mock('@/Module/ChatRoom/uploadFileToBackend', () => ({
  uploadFileToBackend: jest.fn(),
}));

const mockPatchRequest = jest.fn();
jest.mock('@/network/patch', () => ({
  patchRequest: (...args: any[]) => mockPatchRequest(...args),
}));

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import FeedEditSheet from '../FeedEditSheet';

function findSaveButton(root: ReactTestRenderer.ReactTestInstance) {
  return root.findByProps({ accessibilityLabel: 'Save changes' });
}

describe('FeedEditSheet — real payload shape on save', () => {
  const activeRenderers: ReactTestRenderer.ReactTestRenderer[] = [];
  afterEach(async () => {
    while (activeRenderers.length) {
      const r = activeRenderers.pop()!;
      await ReactTestRenderer.act(async () => { r.unmount(); });
    }
    jest.clearAllMocks();
  });

  const post = {
    id: 'post-1',
    text_plain: 'Original text',
    attachments: [],
  } as any;

  it('sends a real ProseMirror-style `text` doc, never a bare `text_plain` string', async () => {
    mockPatchRequest.mockResolvedValue({ success: true });
    const onUpdated = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <FeedEditSheet
          visible
          post={post}
          editEndpoint={(id) => `https://api.example.com/posts/${id}/`}
          onClose={jest.fn()}
          onUpdated={onUpdated}
        />,
      );
    });
    activeRenderers.push(renderer!);

    const textInput = renderer!.root.findByType(require('react-native').TextInput);
    await ReactTestRenderer.act(async () => {
      textInput.props.onChangeText('Edited text');
    });

    const saveBtn = findSaveButton(renderer!.root);
    await ReactTestRenderer.act(async () => {
      await saveBtn.props.onPress();
    });

    expect(mockPatchRequest).toHaveBeenCalledWith(
      'https://api.example.com/posts/post-1/',
      {
        text: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Edited text' }] }],
        },
      },
      expect.objectContaining({ errorMessage: expect.any(String) }),
    );
    const [, body] = mockPatchRequest.mock.calls[0];
    expect(body).not.toHaveProperty('text_plain');
    expect(body).not.toHaveProperty('thumbnail_url');
    expect(body).not.toHaveProperty('styled_text');
  });

  it('updates attachments[0].thumb_url, not a top-level thumbnail_url, when a thumbnail is already set', async () => {
    mockPatchRequest.mockResolvedValue({ success: true });
    const videoPost = {
      id: 'post-2',
      text_plain: 'A video post',
      attachments: [{ kind: 'video', url: 'https://cdn.example.com/v.mp4', thumb_url: 'https://cdn.example.com/old-thumb.jpg' }],
    } as any;

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <FeedEditSheet
          visible
          post={videoPost}
          editEndpoint={(id) => `https://api.example.com/posts/${id}/`}
          onClose={jest.fn()}
          onUpdated={jest.fn()}
        />,
      );
    });
    activeRenderers.push(renderer!);

    const saveBtn = findSaveButton(renderer!.root);
    await ReactTestRenderer.act(async () => {
      await saveBtn.props.onPress();
    });

    const [, body] = mockPatchRequest.mock.calls[0];
    expect(body.attachments).toEqual([
      expect.objectContaining({
        kind: 'video',
        url: 'https://cdn.example.com/v.mp4',
        thumb_url: 'https://cdn.example.com/old-thumb.jpg',
      }),
    ]);
    expect(body).not.toHaveProperty('thumbnail_url');
  });
});
