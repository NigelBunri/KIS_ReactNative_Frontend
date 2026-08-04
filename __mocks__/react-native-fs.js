// Jest manual mock for react-native-fs. The real package ships Flow/TS-
// annotated source that Jest can't parse without a transform this repo
// doesn't apply to arbitrary third-party libs (and even if it did, its
// native module isn't linked under Jest anyway) — this is a minimal,
// generic stand-in for its most commonly used surface, not a real
// filesystem.
module.exports = {
  CachesDirectoryPath: '/mock/caches',
  DocumentDirectoryPath: '/mock/documents',
  TemporaryDirectoryPath: '/mock/tmp',
  exists: jest.fn().mockResolvedValue(false),
  stat: jest.fn().mockRejectedValue(new Error('ENOENT (mock)')),
  unlink: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(''),
  writeFile: jest.fn().mockResolvedValue(undefined),
  copyFile: jest.fn().mockResolvedValue(undefined),
  moveFile: jest.fn().mockResolvedValue(undefined),
  downloadFile: jest.fn(() => ({ promise: Promise.resolve({ statusCode: 200 }) })),
};
