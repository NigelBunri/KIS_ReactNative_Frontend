import { Platform } from 'react-native';

// ─── Dev-only host config ─────────────────────────────────────────────────────
// These are only active when __DEV__ === true (metro dev server / debug builds).
// Update DEV_BACKEND_HOST to your machine's LAN IP when running on a physical device.
export const DEV_BACKEND_HOST = '10.219.211.99';
export const API_PORT = 8000;
export const CHAT_PORT = 4000;

// Android emulator routes host traffic through 10.0.2.2; iOS simulator uses the LAN IP.
const _devApiHost = Platform.OS === 'android' ? '10.0.2.2' : DEV_BACKEND_HOST;
const _devApiBase = `http://${_devApiHost}:${API_PORT}`;
const _devChatBase = `http://${_devApiHost}:${CHAT_PORT}`;

// ─── Production URLs ──────────────────────────────────────────────────────────
// Set PROD_API_BASE_URL and PROD_CHAT_BASE_URL to your HTTPS endpoints before
// cutting a release build. They can be injected at bundle time via
// react-native-config (recommended) or by editing these constants directly.
const _prodApiBase =
  (process.env.PROD_API_BASE_URL as string | undefined)?.trim() ||
  'https://api.kis.app';
const _prodChatBase =
  (process.env.PROD_CHAT_BASE_URL as string | undefined)?.trim() ||
  'https://chat.kis.app';

// ─── Active URLs (switch on __DEV__) ─────────────────────────────────────────
export const API_BASE_URL = __DEV__ ? _devApiBase : _prodApiBase;
export const MEDIA_FALLBACK_API_BASE_URL = __DEV__
  ? `http://${DEV_BACKEND_HOST}:${API_PORT}`
  : _prodApiBase;
export const CHAT_BASE_URL = __DEV__ ? _devChatBase : _prodChatBase;

export const CHAT_WS_URL = CHAT_BASE_URL;
export const CHAT_WS_PATH = '/ws';
export const CHAT_UPLOAD_URL = `${CHAT_BASE_URL}/uploads/file`;
export const WEBSOCKET_URL = CHAT_WS_URL;

export const NEST_API_BASE_URL = CHAT_BASE_URL;

export const FEEDS_ENDPOINT = `${API_BASE_URL}/api/v1/broadcasts/`;
export const BG_REMOVAL_START_URL = `${API_BASE_URL}/api/v1/remove-background/`;
export const BG_REMOVAL_STATUS_URL = (jobId: string) =>
  `${API_BASE_URL}/api/v1/gbJobs/${jobId}/`;

export const EDUCATION_HOME_ENDPOINT = '/api/v1/education/home/';
export const EDUCATION_LESSONS_ENDPOINT = '/api/v1/education/lessons/';
export const EDUCATION_COURSES_ENDPOINT = '/api/v1/education/courses/';
export const EDUCATION_ENROLL_ENDPOINT = (courseId: string) =>
  `/api/v1/education/courses/${courseId}/enroll/`;
