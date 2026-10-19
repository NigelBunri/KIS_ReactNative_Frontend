import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageResizeMode,
  ImageStyle,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import {
  buildPermanentMediaPath,
  fileUriForPath,
  permanentMediaExists,
  type PermanentMediaDomain,
} from '@/storage/permanentMediaStorage';
import { getMediaTransferQueue, queueMediaDownload } from '@/services/mediaTransferQueue';
import { useMediaHeaders } from '@/network';

// CONFIRMED ROOT CAUSE of "posted an image, feed shows nothing but the
// download button, just dark": when a backend isn't configured for public
// object storage, Nest's upload-intent.service.ts (buildAttachment) returns
// `url`/`displayUrl` as its OWN protected `/uploads/file?key=...` endpoint,
// not a public/presigned S3 URL - fetching it requires the same
// Authorization/X-Device-Id headers mediaTransferQueue.ts's download path
// already attaches, and that react-native-video playback (FeedScreen.tsx's
// video modal, via useMediaHeaders + buildMediaSource) already attaches
// too. A bare `<Image source={{uri}}>` sent neither, so the fetch 401s/
// 403s silently (RN's Image onError fires, but nothing here ever showed an
// error state) - the Download overlay still renders fine since it's wired
// to that same already-authenticated queue, making it look like only the
// preview is "missing" rather than the whole fetch failing. Mirrors
// useMediaHeaders' own established convention of always attaching these
// (video playback elsewhere already does this unconditionally, including
// against genuine public S3/CDN URLs, with no reported breakage) rather
// than trying to guess which URLs need it.

type Props = {
  uri?: string | null;
  domain: PermanentMediaDomain;
  filename?: string | null;
  stableKey?: string | null;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  resizeMode?: ImageResizeMode;
  placeholder?: React.ReactNode;
  showDownloadOverlay?: boolean;
};

const extensionFromUri = (uri?: string | null) => {
  const clean = String(uri || '').split('?')[0].split('#')[0];
  const match = clean.match(/\.([a-zA-Z0-9]{2,6})$/);
  return match ? match[1].toLowerCase() : 'jpg';
};

const keyFromUri = (uri: string) =>
  encodeURIComponent(uri).replace(/%/g, '').slice(0, 80) || `media_${Date.now()}`;

export default function PermanentRemoteImage({
  uri,
  domain,
  filename,
  stableKey,
  style,
  containerStyle,
  resizeMode = 'cover',
  placeholder,
  showDownloadOverlay = true,
}: Props) {
  const { palette } = useKISTheme();
  const [localPath, setLocalPath] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [online, setOnline] = useState(true);
  // Separate from `checking` (local-cache lookup) - this tracks the actual
  // <Image> network fetch/decode of a remote (non-cached) URL, which can
  // take a moment on a signed S3 URL and previously showed nothing at all.
  const [imageLoading, setImageLoading] = useState(false);
  const imageHeaders = useMediaHeaders();

  const remoteUri = typeof uri === 'string' && uri.trim() ? uri.trim() : '';

  const cacheKey = useMemo(
    () => stableKey || (remoteUri ? keyFromUri(remoteUri) : ''),
    [remoteUri, stableKey],
  );
  const cacheName = useMemo(
    () => filename || `${cacheKey || 'media'}.${extensionFromUri(remoteUri)}`,
    [cacheKey, filename, remoteUri],
  );

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => sub();
  }, []);

  const resolveCachedFile = useCallback(async () => {
    if (!remoteUri) {
      setLocalPath(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const expected = await buildPermanentMediaPath(domain, 'Downloads', cacheName, cacheKey);
      const exists = await permanentMediaExists(expected);
      setLocalPath(exists ? expected : null);
    } finally {
      setChecking(false);
    }
  }, [cacheKey, cacheName, domain, remoteUri]);

  useEffect(() => {
    resolveCachedFile();
  }, [resolveCachedFile]);

  const handleDownload = useCallback(async () => {
    if (!remoteUri || downloading) return;
    setDownloading(true);
    setProgress(0);
    try {
      const job = await queueMediaDownload({
        remoteUrl: remoteUri,
        filename: cacheName,
        domain,
        stableKey: cacheKey,
      });
      const startedAt = Date.now();
      const timer = setInterval(async () => {
        const current = (await getMediaTransferQueue()).find(item => item.id === job.id);
        if (!current) return;
        setProgress(Math.min(100, Math.round((current.progress || 0) * 100)));
        if (current.status === 'completed') {
          clearInterval(timer);
          setLocalPath(current.localPath);
          setDownloading(false);
        } else if (current.status === 'failed' || current.status === 'cancelled') {
          clearInterval(timer);
          setDownloading(false);
        } else if (Date.now() - startedAt > 10 * 60 * 1000) {
          clearInterval(timer);
          setDownloading(false);
        }
      }, 800);
    } catch {
      setDownloading(false);
    }
  }, [cacheKey, cacheName, domain, downloading, remoteUri]);

  const sourceUri = localPath ? fileUriForPath(localPath) : online ? remoteUri : '';
  const hasImage = Boolean(sourceUri);
  const needsDownload = Boolean(remoteUri && !localPath);
  // Only the remote (uncached) path actually fetches over the network -
  // a locally-cached file:// URI resolves near-instantly and shouldn't
  // flash a spinner.
  const isRemoteFetch = hasImage && !localPath;

  return (
    <View style={[styles.container, containerStyle]}>
      {hasImage ? (
        <Image
          source={{ uri: sourceUri, headers: imageHeaders }}
          style={[StyleSheet.absoluteFillObject, style]}
          resizeMode={resizeMode}
          onLoadStart={() => setImageLoading(true)}
          onLoad={() => setImageLoading(false)}
          onError={() => setImageLoading(false)}
        />
      ) : (
        placeholder ?? <View style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.surfaceElevated ?? palette.surface }]} />
      )}

      {checking || (isRemoteFetch && imageLoading) ? (
        <View style={styles.overlay}>
          <ActivityIndicator color={palette.primaryStrong ?? palette.primary} />
        </View>
      ) : showDownloadOverlay && needsDownload ? (
        <Pressable
          onPress={handleDownload}
          disabled={downloading || !online}
          style={[styles.download, { backgroundColor: 'rgba(0,0,0,0.48)' }]}
        >
          {downloading ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.downloadText}>{progress > 0 ? `${progress}%` : 'Downloading'}</Text>
            </>
          ) : (
            <>
              <KISIcon name="download" size={18} color="#fff" />
              <Text style={styles.downloadText}>{online ? 'Download' : 'Offline'}</Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  download: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  downloadText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
});
