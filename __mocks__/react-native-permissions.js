// Jest manual mock for react-native-permissions — its native module
// ('RNPermissions') isn't registered under Jest. `check`/`request` resolve
// GRANTED by default so permission-gated flows (e.g. HoldToLockComposer's
// mic-permission check) proceed past the gate in tests instead of hanging
// on a native-module crash; PERMISSIONS/RESULTS mirror the real constants
// callers switch on.
const RESULTS = {
  UNAVAILABLE: 'unavailable',
  DENIED: 'denied',
  LIMITED: 'limited',
  GRANTED: 'granted',
  BLOCKED: 'blocked',
};

// Real values aren't meaningful under Jest (no native module reads them) —
// each permission just needs a stable, distinct string so equality checks
// and switch/case callers behave.
const permissionProxy = (platform) =>
  new Proxy(
    {},
    {
      get: (_target, name) => `${platform}.${String(name)}`,
    },
  );

const PERMISSIONS = {
  IOS: permissionProxy('ios'),
  ANDROID: permissionProxy('android'),
};

module.exports = {
  RESULTS,
  PERMISSIONS,
  check: jest.fn().mockResolvedValue(RESULTS.GRANTED),
  request: jest.fn().mockResolvedValue(RESULTS.GRANTED),
  checkMultiple: jest.fn().mockResolvedValue({}),
  requestMultiple: jest.fn().mockResolvedValue({}),
  openSettings: jest.fn().mockResolvedValue(undefined),
};
