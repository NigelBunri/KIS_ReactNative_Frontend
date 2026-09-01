// Jest manual mock for react-native-image-resizer — its native module
// isn't linked under Jest and its entry file is unbuilt ESM source. Only
// createResizedImage is used anywhere in this codebase (StickerEditor.tsx),
// resolved to a plausible ResizedImage shape so callers that read
// `.uri`/`.path`/`.size` off the result don't crash on undefined.
module.exports = {
  __esModule: true,
  default: {
    createResizedImage: jest.fn().mockResolvedValue({
      uri: 'file:///mock/resized.png',
      path: '/mock/resized.png',
      name: 'resized.png',
      size: 0,
      width: 512,
      height: 512,
    }),
  },
};
