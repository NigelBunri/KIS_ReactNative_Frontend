import { Platform } from 'react-native';

/**
 * Centralized host configuration so both the client and the route helpers
 * can derive the same base URLs without duplicating logic.
 */
const USE_EMULATOR = true;
// Change only this value when your backend LAN IP changes.
export const DEV_BACKEND_HOST = '10.55.104.99';
export const API_PORT = 8000;
export const CHAT_PORT = 4000;

const emulatorHost = Platform.OS === 'android' ? '10.0.2.2' : DEV_BACKEND_HOST;
const host = USE_EMULATOR ? emulatorHost : DEV_BACKEND_HOST;

export const API_BASE_URL = `http://${host}:${API_PORT}`;
export const MEDIA_FALLBACK_API_BASE_URL = `http://${DEV_BACKEND_HOST}:${API_PORT}`;
export const CHAT_BASE_URL = `http://${host}:${CHAT_PORT}`;

export const CHAT_WS_URL = CHAT_BASE_URL;
export const CHAT_WS_PATH = '/ws';
export const CHAT_UPLOAD_URL = `${CHAT_BASE_URL}/uploads/file`;
export const WEBSOCKET_URL = CHAT_WS_URL;

export const NEST_API_BASE_URL = CHAT_BASE_URL;

// Shared helper endpoints that are not part of an explicit domain map.
export const FEEDS_ENDPOINT = `${API_BASE_URL}/api/v1/broadcasts/`;
export const BG_REMOVAL_START_URL = `${API_BASE_URL}/api/v1/remove-background/`;
export const BG_REMOVAL_STATUS_URL = (jobId: string) =>
  `${API_BASE_URL}/api/v1/gbJobs/${jobId}/`;

export const EDUCATION_HOME_ENDPOINT = '/api/v1/education/home/';
export const EDUCATION_LESSONS_ENDPOINT = '/api/v1/education/lessons/';
export const EDUCATION_COURSES_ENDPOINT = '/api/v1/education/courses/';
export const EDUCATION_ENROLL_ENDPOINT = (courseId: string) => `/api/v1/education/courses/${courseId}/enroll/`;
