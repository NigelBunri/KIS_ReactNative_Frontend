// Jest manual mock for react-native-image-picker. It ships an unbuilt TS
// source file Jest's default node_modules ignore pattern never transforms
// ("Cannot use import statement outside a module"), and its native module
// isn't linked under Jest anyway. Resolves as a cancelled picker by
// default — the shape (`didCancel`, `assets`) matches what callers across
// this codebase (e.g. StickerEditor.tsx's handlePickImage) branch on —
// so tests exercising the "no image picked" path work out of the box, and
// suites that need an actual asset can override these with
// `.mockResolvedValueOnce({ didCancel: false, assets: [...] })`.
const cancelledResult = { didCancel: true, assets: undefined };

module.exports = {
  launchImageLibrary: jest.fn().mockResolvedValue(cancelledResult),
  launchCamera: jest.fn().mockResolvedValue(cancelledResult),
};
