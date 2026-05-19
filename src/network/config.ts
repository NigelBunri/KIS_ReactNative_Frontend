import { Platform } from 'react-native';

export const DEV_BACKEND_HOST = 'kis-django-backend.onrender.com';
export const API_PORT = 8000;
export const CHAT_PORT = 4000;

const USE_DEPLOYED_DJANGO = true;
const USE_DEPLOYED_CHAT = true;

// Local dev fallback
const _localApiHost = Platform.OS === 'android' ? '10.0.2.2' : DEV_BACKEND_HOST;
const _localApiBase = `http://${_localApiHost}:${API_PORT}`;
const _localChatBase = `http://${_localApiHost}:${CHAT_PORT}`;

// Deployed Render backends
const _deployedApiBase = 'https://kis-django-backend.onrender.com';
const _deployedChatBase = 'https://kis-nest-backend.onrender.com';

const _prodApiBase =
  (process.env.PROD_API_BASE_URL as string | undefined)?.trim() ||
  _deployedApiBase;

const _prodChatBase =
  (process.env.PROD_CHAT_BASE_URL as string | undefined)?.trim() ||
  _deployedChatBase;

export const API_BASE_URL = __DEV__
  ? USE_DEPLOYED_DJANGO
    ? _deployedApiBase
    : _localApiBase
  : _prodApiBase;

export const MEDIA_FALLBACK_API_BASE_URL = API_BASE_URL;

export const CHAT_BASE_URL = __DEV__
  ? USE_DEPLOYED_CHAT
    ? _deployedChatBase
    : _localChatBase
  : _prodChatBase;

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