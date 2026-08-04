// Strips query strings (signed-URL signatures/tokens live there) before a
// URL ever reaches a log line — the path alone is enough to identify which
// asset is being discussed for debugging, without leaking credentials.
// Pulled out of VideoPlayer.tsx as a standalone, RN-free module so it can be
// unit tested without dragging in react-native-video/theme dependencies.
export const redactUrlForLogging = (url: string | null | undefined): string => {
  if (!url) return '';
  const queryIndex = url.indexOf('?');
  return queryIndex >= 0 ? url.slice(0, queryIndex) : url;
};
