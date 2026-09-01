// Jest manual mock for react-native-quick-crypto. It's backed by Nitro
// Modules, a native (non-JS) module never linked under Jest ("Failed to
// get NitroModules"). Rather than stub out individual methods with fakes,
// this re-exports Node's own built-in `crypto` module: react-native-quick-
// crypto is deliberately built as a drop-in, API-compatible replacement
// for it (randomBytes, createCipheriv/createDecipheriv, etc. — see
// src/security/customE2EE.ts), so anything exercising real encrypt/decrypt
// round-trips under test gets real crypto, not a bogus stand-in.
module.exports = require('crypto');
module.exports.default = require('crypto');
