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
import RNFS from 'react-native-fs';
import NetInfo from '@react-native-community/netinfo';

import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import {
  buildPermanentMediaPath,
  fileUriForPath,
  permanentMediaExists,
  stripFileScheme,
  type PermanentMediaDomain,
} from '@/storage/permanentMediaStorage';
import { getAccessToken } from '@/security/authStorage';

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
      const target = await buildPermanentMediaPath(domain, 'Downloads', cacheName, cacheKey);
      const token = await getAccessToken().catch(() => null);
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const job = RNFS.downloadFile({
        fromUrl: remoteUri,
        toFile: target,
        headers,
        progressDivider: 1,
        progress: (event) => {
          const total = Number(event.contentLength || 0);
          if (total > 0) {
            setProgress(Math.min(100, Math.round((event.bytesWritten / total) * 100)));
          }
        },
      });
      const result = await job.promise;
      if (result.statusCode >= 200 && result.statusCode < 300) {
        setLocalPath(target);
      } else {
        await RNFS.unlink(target).catch(() => {});
      }
    } finally {
      setDownloading(false);
    }
  }, [cacheKey, cacheName, domain, downloading, remoteUri]);

  const sourceUri = localPath ? fileUriForPath(localPath) : online ? remoteUri : '';
  const hasImage = Boolean(sourceUri);
  const needsDownload = Boolean(remoteUri && !localPath);

  return (
    <View style={[styles.container, containerStyle]}>
      {hasImage ? (
        <Image source={{ uri: sourceUri }} style={[StyleSheet.absoluteFillObject, style]} resizeMode={resizeMode} />
      ) : (
        placeholder ?? <View style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.surfaceElevated ?? palette.surface }]} />
      )}

      {checking ? (
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
