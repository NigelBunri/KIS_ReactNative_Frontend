import type { ViewStyle } from 'react-native';

export const ALLOWED_VIDEO_SCHEMES = ['http:', 'https:'];

export const normalizeVideoUrl = (value?: string | null): string | null => {
  if (!value) return null;
  try {
    const normalized = new URL(value.trim());
    if (!ALLOWED_VIDEO_SCHEMES.includes(normalized.protocol.toLowerCase())) {
      return null;
    }
    return normalized.toString();
  } catch {
    return null;
  }
};

export const formatVideoTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const dur = Math.floor(seconds);
  const mins = Math.floor(dur / 60);
  const secs = dur % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const hiddenIconStyle: ViewStyle = {
  position: 'absolute',
  opacity: 0,
  width: 0,
  height: 0,
};
