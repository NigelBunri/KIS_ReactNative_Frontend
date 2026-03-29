// network/cache/cacheKeys.ts

export enum CacheTypes {
  DEFAULT = 'default',
  USER_CACHE = 'user_cache',
  MESSAGES_CACHE = 'messages_cache',
  AUTH_CACHE = 'auth_cache',
  NOTIFICATIONS_CACHE = 'notifications_cache',
  MEDIA_CACHE = 'media_cache',
  REGISTERED_CONTACTS = 'registered_contacts',
  FILTER_TYPE = 'filters',
}

export enum CacheKeys {
  LOGIN_DATA = 'login_data',
  USER_PROFILE = 'user_profile',
  USER_TOKEN = 'user_token',
  MESSAGES_LIST = 'messages_list',
  MESSAGE_DETAILS = 'message_details',
  NOTIFICATIONS = 'notifications',
  MEDIA_IMAGES = 'media_images',
  MEDIA_VIDEOS = 'media_videos',
  REGISTERED_CONTACTS_KEY = 'registered_contacts_key',
  FILTER_KEY = 'userFilters',
}

export const CacheConfig = {
  loginData: { type: CacheTypes.AUTH_CACHE, key: CacheKeys.LOGIN_DATA },
  userProfile: { type: CacheTypes.USER_CACHE, key: CacheKeys.USER_PROFILE },
  userToken: { type: CacheTypes.AUTH_CACHE, key: CacheKeys.USER_TOKEN },
  messagesList: { type: CacheTypes.MESSAGES_CACHE, key: CacheKeys.MESSAGES_LIST },
  notifications: { type: CacheTypes.NOTIFICATIONS_CACHE, key: CacheKeys.NOTIFICATIONS },
};
