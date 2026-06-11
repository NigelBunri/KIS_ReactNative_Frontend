import { Platform } from 'react-native';
import { APP_ENV } from '@/env';

const trim = (value?: string | null) => String(value ?? '').trim();
const envBool = (value?: string | null) =>
  ['1', 'true', 'yes', 'on'].includes(trim(value).toLowerCase());

export const DEV_BACKEND_HOST =
  trim(APP_ENV.KIS_DEV_BACKEND_HOST) ||
  (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
export const API_PORT = 8000;
export const CHAT_PORT = 4000;

const USE_LOCAL_BACKENDS = envBool(APP_ENV.KIS_USE_LOCAL_BACKENDS);

// Local dev fallback
const _localApiHost = DEV_BACKEND_HOST;
const _localApiBase = `http://${_localApiHost}:${API_PORT}`;
const _localChatBase = `http://${_localApiHost}:${CHAT_PORT}`;

// Deployed Render backends
const _deployedApiBase = 'https://kis-django-backend.onrender.com';
const _deployedChatBase = 'https://kis-nest-backend.onrender.com';

const _envApiBase = trim(APP_ENV.KIS_DJANGO_BASE_URL);
const _envChatBase = trim(APP_ENV.KIS_NEST_BASE_URL);
const _envChatWsUrl = trim(APP_ENV.KIS_CHAT_WS_URL);

export const API_BASE_URL = __DEV__
  ? (_envApiBase || (USE_LOCAL_BACKENDS ? _localApiBase : _deployedApiBase))
  : (_envApiBase || _deployedApiBase);

export const MEDIA_FALLBACK_API_BASE_URL = API_BASE_URL;

export const CHAT_BASE_URL = __DEV__
  ? (_envChatBase || (USE_LOCAL_BACKENDS ? _localChatBase : _deployedChatBase))
  : (_envChatBase || _deployedChatBase);

export const CHAT_WS_URL = _envChatWsUrl || CHAT_BASE_URL;
export const CHAT_WS_PATH = trim(APP_ENV.KIS_CHAT_WS_PATH) || '/ws';
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
