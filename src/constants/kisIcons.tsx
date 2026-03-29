import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useKISTheme } from '@/theme/useTheme';
import { ICON_SIZES, getIconColor, IconTone } from '@/theme/foundations/icons';

export type KISIconName =
  | 'people'
  | 'book'
  | 'chat'
  | 'megaphone'
  | 'person'
  | 'user'
  | 'users'
  | 'home'
  | 'search'
  | 'cart'
  | 'bell'
  | 'settings'
  | 'back'
  | 'close'
  | 'check'
  | 'edit'
  | 'add'
  | 'camera'
  | 'mic'
  | 'send'
  | 'filter'
  | 'menu'
  | 'mention'
  | 'unread'
  | 'trash'
  | 'arrow-left'
  | 'pin'
  | 'mute'
  | 'smiley'
  | 'keypad'
  // Voice
  | 'play'
  | 'pause'
  | 'stop'
  | 'volume'
  // Message actions
  | 'forward'
  | 'copy'
  | 'more-vert'
  | 'report'
  | 'reply'
  // NEW SUB-ROOM / THREAD / LAYERS ICON
  | 'layers'
  | 'thread'
  | 'sub-channel'
  // Message info
  | 'info'
  // NEW — for country picker
  | 'chevron-down'
  | 'fullscreen'
  // NEW — camera / media
  | 'flash-on'
  | 'flash-off'
  | 'video'
  | 'image'
  | 'refresh'
  // NEW — editing tools
  | 'rotate-left'
  | 'rotate-right'
  // NEW — attachments & extras
  | 'file'
  | 'audio'
  | 'contacts'
  | 'poll'
  | 'calendar'
  | 'heart'
  | 'comment'
  | 'share'
  | 'link'
  | 'sparkles'
  | 'school'
  | 'list'
  // NEW — specific file types
  | 'file-pdf'
  | 'file-word'
  | 'file-excel'
  | 'file-powerpoint'
  | 'file-text'
  | 'file-zip'
  // Already supported in component, just add to type
  | 'keyboard'
  // Compatibility names used by legacy screens
  | 'plus'
  | 'bookmark'
  | 'bolt'
  | 'chevron-left'
  | 'chevron-right'
  | 'star'
  | 'phone'
  | 'document'
  | 'shield'
  // Allow forward-compatible icon names from feature modules.
  | (string & {});

type IconPair = { filled: string; outline: string };

type IonMap = Partial<Record<KISIconName, IconPair>>;

const ion: IonMap = {
  // Tabs
  people: { filled: 'people', outline: 'people-outline' },
  book: { filled: 'book', outline: 'book-outline' },
  chat: { filled: 'chatbubble', outline: 'chatbubble-outline' },
  megaphone: {
    filled: 'megaphone',
    outline: 'megaphone-outline',
  },
  person: { filled: 'person', outline: 'person-outline' },
  user: { filled: 'person', outline: 'person-outline' },
  users: { filled: 'people', outline: 'people-outline' },

  // UI
  home: { filled: 'home', outline: 'home-outline' },
  search: { filled: 'search', outline: 'search-outline' },
  cart: { filled: 'cart', outline: 'cart-outline' },
  bell: {
    filled: 'notifications',
    outline: 'notifications-outline',
  },
  settings: {
    filled: 'settings',
    outline: 'settings-outline',
  },

  // Navigation
  back: { filled: 'chevron-back', outline: 'chevron-back' },
  'arrow-left': {
    filled: 'chevron-back',
    outline: 'chevron-back',
  },
  fullscreen: {
    filled: 'expand',
    outline: 'expand-outline',
  },

  // Chat tools
  pin: { filled: 'pin', outline: 'pin-outline' },
  mute: {
    filled: 'volume-mute',
    outline: 'volume-mute-outline',
  },

  // Base
  close: { filled: 'close', outline: 'close' },
  check: {
    filled: 'checkmark-circle',
    outline: 'checkmark-circle-outline',
  },
  edit: { filled: 'create', outline: 'create-outline' },
  add: { filled: 'add-circle', outline: 'add-circle-outline' },
  camera: { filled: 'camera', outline: 'camera-outline' },
  mic: { filled: 'mic', outline: 'mic-outline' },
  send: { filled: 'send', outline: 'send-outline' },

  // Special UI
  filter: { filled: 'options', outline: 'options-outline' },
  menu: {
    filled: 'ellipsis-vertical',
    outline: 'ellipsis-vertical',
  },
  mention: { filled: 'at', outline: 'at-outline' },
  unread: {
    filled: 'mail-unread',
    outline: 'mail-unread-outline',
  },

  // Trash
  trash: { filled: 'trash', outline: 'trash-outline' },

  // Voice messages
  play: { filled: 'play', outline: 'play-outline' },
  pause: { filled: 'pause', outline: 'pause-outline' },
  stop: { filled: 'stop', outline: 'stop-outline' },
  volume: {
    filled: 'volume-high',
    outline: 'volume-high-outline',
  },

  // Emojis
  smiley: { filled: 'happy', outline: 'happy-outline' },

  keypad: { filled: 'keypad', outline: 'keypad-outline' },

  // Forward messages
  forward: {
    filled: 'arrow-forward',
    outline: 'arrow-forward-outline',
  },

  // Copy
  copy: { filled: 'copy', outline: 'copy-outline' },

  // Vertical menu
  'more-vert': {
    filled: 'ellipsis-vertical',
    outline: 'ellipsis-vertical',
  },

  // Report
  report: {
    filled: 'alert-circle',
    outline: 'alert-circle-outline',
  },

  // Reply
  reply: { filled: 'arrow-undo', outline: 'arrow-undo-outline' },

  // NEW — Sub-rooms (layers)
  layers: { filled: 'layers', outline: 'layers-outline' },
  thread: { filled: 'layers', outline: 'layers-outline' },
  'sub-channel': {
    filled: 'layers',
    outline: 'layers-outline',
  },

  // NEW — Message info
  info: {
    filled: 'information-circle',
    outline: 'information-circle-outline',
  },

  // NEW — Chevron down (used for country picker)
  'chevron-down': {
    filled: 'chevron-down',
    outline: 'chevron-down',
  },

  // NEW — Camera / media icons
  'flash-on': { filled: 'flash', outline: 'flash-outline' },
  'flash-off': { filled: 'flash-off', outline: 'flash-off' },
  video: { filled: 'videocam', outline: 'videocam-outline' },
  image: { filled: 'image', outline: 'image-outline' },
  refresh: { filled: 'refresh', outline: 'refresh' },

  // NEW — Attachments & extras
  file: { filled: 'document', outline: 'document-outline' },
  audio: { filled: 'musical-notes', outline: 'musical-notes-outline' },
  contacts: {
    filled: 'people-circle',
    outline: 'people-circle-outline',
  },
  poll: { filled: 'stats-chart', outline: 'stats-chart-outline' },
  calendar: { filled: 'calendar', outline: 'calendar-outline' },
  heart: { filled: 'heart', outline: 'heart-outline' },
  comment: { filled: 'chatbubble-ellipses', outline: 'chatbubble-ellipses-outline' },
  share: { filled: 'share-social', outline: 'share-social-outline' },
  link: { filled: 'link', outline: 'link-outline' },
  sparkles: { filled: 'sparkles', outline: 'sparkles-outline' },
  school: { filled: 'school', outline: 'school-outline' },
  list: { filled: 'list', outline: 'list-outline' },
  plus: { filled: 'add', outline: 'add-outline' },
  bookmark: { filled: 'bookmark', outline: 'bookmark-outline' },
  bolt: { filled: 'flash', outline: 'flash-outline' },
  'chevron-left': { filled: 'chevron-back', outline: 'chevron-back' },
  'chevron-right': { filled: 'chevron-forward', outline: 'chevron-forward' },
  star: { filled: 'star', outline: 'star-outline' },
  phone: { filled: 'call', outline: 'call-outline' },
  document: { filled: 'document', outline: 'document-outline' },
  shield: { filled: 'shield-checkmark', outline: 'shield-checkmark-outline' },
};

export interface KISIconProps {
  name: KISIconName;
  size?: number;
  color?: string;
  focused?: boolean;
  style?: any;
  tone?: IconTone;
}

export const KISIcon: React.FC<KISIconProps> = ({
  name,
  size,
  color,
  focused = false,
  style,
  tone,
}) => {
  const { palette } = useKISTheme();
  const resolvedSize = size ?? ICON_SIZES.medium;
  const iconColor = color ?? getIconColor(palette, tone);

  // Material icon overrides
  if (name === 'keyboard') {
    return (
      <MaterialCommunityIcons
        name="keyboard-outline"
        size={resolvedSize}
        color={iconColor}
        style={style}
      />
    );
  }

  if (name === 'rotate-left') {
    return (
      <MaterialCommunityIcons
        name="rotate-left"
        size={resolvedSize}
        color={iconColor}
        style={style}
      />
    );
  }

  if (name === 'rotate-right') {
    return (
      <MaterialCommunityIcons
        name="rotate-right"
        size={resolvedSize}
        color={iconColor}
        style={style}
      />
    );
  }

  // NEW — specific file type icons using MaterialCommunityIcons
  if (name === 'file-pdf') {
    return (
      <MaterialCommunityIcons
        name="file-pdf-box"
        size={resolvedSize}
        color={iconColor}
        style={style}
      />
    );
  }

  if (name === 'file-word') {
    return (
      <MaterialCommunityIcons
        name="file-word-outline"
        size={resolvedSize}
        color={iconColor}
        style={style}
      />
    );
  }

  if (name === 'file-excel') {
    return (
      <MaterialCommunityIcons
        name="file-excel-outline"
        size={resolvedSize}
        color={iconColor}
        style={style}
      />
    );
  }

  if (name === 'file-powerpoint') {
    return (
      <MaterialCommunityIcons
        name="file-powerpoint-outline"
        size={resolvedSize}
        color={iconColor}
        style={style}
      />
    );
  }

  if (name === 'file-text') {
    return (
      <MaterialCommunityIcons
        name="file-document-outline"
        size={resolvedSize}
        color={iconColor}
        style={style}
      />
    );
  }

  if (name === 'file-zip') {
    return (
      <MaterialCommunityIcons
        name="folder-zip-outline"
        size={resolvedSize}
        color={iconColor}
        style={style}
      />
    );
  }

  // Default to Ionicons mapping
  const pair = ion[name] ?? ion['home']!;
  const iconName = focused ? pair.filled : pair.outline;

  return (
    <Ionicons
      name={iconName}
      size={resolvedSize}
      color={iconColor}
      style={style}
    />
  );
};
