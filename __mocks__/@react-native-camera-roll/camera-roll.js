// Jest manual mock for @react-native-camera-roll/camera-roll — its native
// module (RNCCameraRoll) isn't linked under Jest. Used by
// QrCodeShareModal.tsx's "Download" button (CameraRoll.saveAsset).
const CameraRoll = {
  saveAsset: jest.fn().mockResolvedValue({ node: { image: { uri: 'file:///mock/camera-roll.png' } } }),
  save: jest.fn().mockResolvedValue('file:///mock/camera-roll.png'),
  saveToCameraRoll: jest.fn().mockResolvedValue({ node: { image: { uri: 'file:///mock/camera-roll.png' } } }),
  deletePhotos: jest.fn().mockResolvedValue(undefined),
  getAlbums: jest.fn().mockResolvedValue([]),
  getPhotos: jest.fn().mockResolvedValue({ edges: [], page_info: { has_next_page: false } }),
};

module.exports = { CameraRoll };
