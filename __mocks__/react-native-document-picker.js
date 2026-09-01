// Jest manual mock for react-native-document-picker — its native module
// ('RNDocumentPicker') isn't registered under Jest. `pick` rejects as a
// user cancellation by default (the shape `isCancel` checks for), so
// unmocked flows resolve their try/catch's cancel branch instead of
// crashing; `types` covers the constants AttachmentSheet.tsx reads off it.
class DocumentPickerCancelError extends Error {
  constructor() {
    super('User canceled document picker');
    this.code = 'DOCUMENT_PICKER_CANCELED';
  }
}

const types = new Proxy(
  {},
  { get: (_target, name) => `mock/${String(name)}` },
);

module.exports = {
  __esModule: true,
  default: {
    pick: jest.fn().mockRejectedValue(new DocumentPickerCancelError()),
    pickSingle: jest.fn().mockRejectedValue(new DocumentPickerCancelError()),
    isCancel: jest.fn((err) => err instanceof DocumentPickerCancelError),
    isInProgress: jest.fn(() => false),
    types,
  },
  types,
  isCancel: jest.fn((err) => err instanceof DocumentPickerCancelError),
};
