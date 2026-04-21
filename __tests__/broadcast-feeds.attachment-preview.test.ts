import { dedupeAttachmentPreviews, getAttachmentPreviewInfo } from '@/components/broadcast/attachmentPreview';

jest.mock('@/network', () => ({
  resolveBackendAssetUrl: (value: string) => value,
}));

describe('broadcast feed attachment preview', () => {
  test('deduplicates repeated attachments that resolve to the same file', () => {
    const previews = [
      getAttachmentPreviewInfo({
        url: 'https://cdn.example.com/files/first.jpg',
        preview_url: 'https://cdn.example.com/files/first.jpg',
        type: 'image/jpeg',
      }),
      getAttachmentPreviewInfo({
        file_url: 'https://cdn.example.com/files/first.jpg',
        thumb_url: 'https://cdn.example.com/files/first.jpg',
        mime_type: 'image/jpeg',
      }),
      getAttachmentPreviewInfo({
        url: 'https://cdn.example.com/files/second.jpg',
        preview_url: 'https://cdn.example.com/files/second.jpg',
        type: 'image/jpeg',
      }),
    ];

    const unique = dedupeAttachmentPreviews(previews);

    expect(unique).toHaveLength(2);
    expect(unique.map((item) => item.url)).toEqual([
      'https://cdn.example.com/files/first.jpg',
      'https://cdn.example.com/files/second.jpg',
    ]);
  });
});
