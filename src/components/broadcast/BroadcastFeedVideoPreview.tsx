import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { KISVideo } from '@/Module/vieo';
import type { KISPalette } from '@/theme/constants';
import {
  describeBroadcastFeedVideoSource,
  getBroadcastFeedVideoPosterUrl,
  getBroadcastFeedVideoRiskNote,
  getBroadcastFeedVideoSourceLabel,
  getBroadcastFeedVideoSourceType,
  getBroadcastFeedVideoSources,
} from '@/components/broadcast/feedVideoPlayback';
import { useMediaHeaders } from '@/network';

type Props = {
  attachment: any;
  palette: KISPalette;
  containerStyle?: StyleProp<ViewStyle>;
  videoStyle?: StyleProp<any>;
  autoPlay?: boolean;
  posterOverride?: string | null;
};

const basePlaybackMessage = 'Unable to play this video preview.';

export default function BroadcastFeedVideoPreview({
  attachment,
  palette,
  containerStyle,
  videoStyle,
  autoPlay = false,
  posterOverride,
}: Props) {
  const mediaHeaders = useMediaHeaders();
  const sources = useMemo(
    () => getBroadcastFeedVideoSources(attachment),
    [attachment],
  );
  const poster = useMemo(
    () => posterOverride ?? getBroadcastFeedVideoPosterUrl(attachment),
    [attachment, posterOverride],
  );
  const [sourceIndex, setSourceIndex] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [finalFailure, setFinalFailure] = useState(false);
  const activeSource = sources[sourceIndex] ?? null;
  const activeSourceType = useMemo(
    () => getBroadcastFeedVideoSourceType(attachment, activeSource),
    [activeSource, attachment],
  );
  const activeSourceHeaders = activeSource?.needsAuthHeaders ? mediaHeaders : undefined;
  const sourceSignature = useMemo(
    () => sources.map(source => `${source.kind}:${source.url}`).join('|'),
    [sources],
  );

  useEffect(() => {
    console.log(
      '[BroadcastFeedVideoPreview] mounted',
      JSON.stringify({
        attachmentId: attachment?.video_id ?? attachment?.id ?? null,
        mediaType: attachment?.media_type ?? null,
        mimeType: attachment?.mime_type ?? null,
        sourcesCount: sources.length,
        sources: sources.map((s) => ({
          kind: s.kind,
          url: s.url,
          host: s.host,
          risk: getBroadcastFeedVideoRiskNote(s) ?? 'none',
        })),
        poster: poster ?? null,
        autoPlay,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log(
      '[BroadcastFeedVideoPreview] active source',
      JSON.stringify({
        sourceIndex,
        activeSource: describeBroadcastFeedVideoSource(activeSource),
        activeSourceType: activeSourceType ?? null,
        hasAuthHeaders: Boolean(activeSourceHeaders),
      }),
    );
  }, [sourceIndex, activeSource, activeSourceType, activeSourceHeaders]);

  useEffect(() => {
    setSourceIndex(0);
    setPlaybackError(null);
    setFinalFailure(false);
  }, [sourceSignature]);

  const handleVideoError = useCallback(
    (message: string | null) => {
      const nextMessage = message || basePlaybackMessage;
      const currentSource = activeSource;
      const nextIndex = sourceIndex + 1;
      if (nextIndex < sources.length) {
        console.info(
          '[BroadcastFeedVideoPreview] switching video source',
          JSON.stringify({
            message: nextMessage,
            from: describeBroadcastFeedVideoSource(currentSource),
            to: describeBroadcastFeedVideoSource(sources[nextIndex]),
            attachment: {
              video_id: attachment?.video_id ?? null,
              media_type: attachment?.media_type ?? null,
              mime_type: attachment?.mime_type ?? null,
            },
          }),
        );
        setPlaybackError(nextMessage);
        setSourceIndex(nextIndex);
        return;
      }
      console.warn(
        '[BroadcastFeedVideoPreview] all sources failed — final failure',
        JSON.stringify({
          message: nextMessage,
          lastSource: describeBroadcastFeedVideoSource(currentSource),
          triedCount: sources.length,
          attachment: {
            video_id: attachment?.video_id ?? null,
            media_type: attachment?.media_type ?? null,
            mime_type: attachment?.mime_type ?? null,
          },
        }),
      );
      setPlaybackError(nextMessage);
      setFinalFailure(true);
    },
    [activeSource, attachment, sourceIndex, sources],
  );

  const handleRetry = useCallback(() => {
    setPlaybackError(null);
    setFinalFailure(false);
    setSourceIndex(0);
  }, []);

  const openExternal = useCallback(async () => {
    const target = activeSource?.url ?? sources[0]?.url ?? null;
    if (!target) return;
    await Linking.openURL(target);
  }, [activeSource?.url, sources]);

  if (!activeSource) {
    return (
      <View
        style={[
          styles.unavailableWrap,
          { backgroundColor: palette.bar },
          containerStyle,
        ]}
      >
        <Text style={[styles.title, { color: palette.text }]}>
          Video unavailable
        </Text>
        <Text style={[styles.message, { color: palette.subtext }]}>
          No playable video source was found for this attachment.
        </Text>
      </View>
    );
  }

  if (finalFailure) {
    return (
      <View
        style={[
          styles.unavailableWrap,
          { backgroundColor: palette.bar },
          containerStyle,
        ]}
      >
        <Text style={[styles.title, { color: palette.danger }]}>
          Playback failed
        </Text>
        <Text style={[styles.message, { color: palette.subtext }]}>
          {playbackError || basePlaybackMessage}
        </Text>
        <View style={styles.buttonRow}>
          <Pressable
            onPress={handleRetry}
            style={[styles.button, { borderColor: palette.primaryStrong }]}
          >
            <Text style={{ color: palette.primaryStrong }}>Retry</Text>
          </Pressable>
          <Pressable
            onPress={openExternal}
            style={[styles.button, { borderColor: palette.divider }]}
          >
            <Text style={{ color: palette.text }}>Open source</Text>
          </Pressable>
        </View>
        <Text style={[styles.note, { color: palette.subtext }]}>
          Tried{' '}
          {sources
            .map(source => getBroadcastFeedVideoSourceLabel(source))
            .join(' then ')}
          .
        </Text>
        {__DEV__ ? (
          <Text style={[styles.devNote, { color: palette.subtext }]}>
            host={activeSource.host || 'unknown'} risk=
            {getBroadcastFeedVideoRiskNote(activeSource) || 'none'}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    // overflow:hidden clips the video player to the container bounds and prevents
    // the controls overlay from visually escaping into surrounding content.
    <View style={[styles.outerWrap, containerStyle]}>
      <KISVideo
        sourceUrl={activeSource.url}
        sourceHeaders={activeSourceHeaders}
        sourceType={activeSourceType ?? undefined}
        poster={poster ?? undefined}
        autoPlay={autoPlay}
        allowFullScreen
        onError={handleVideoError}
        containerStyle={styles.innerFill}
        videoStyle={videoStyle}
      />
      {playbackError && sourceIndex > 0 ? (
        <View
          style={[
            styles.fallbackPill,
            { backgroundColor: palette.surface, borderColor: palette.divider },
          ]}
        >
          <Text style={{ color: palette.subtext, fontSize: 12 }}>
            Using fallback source:{' '}
            {getBroadcastFeedVideoSourceLabel(activeSource)}
          </Text>
        </View>
      ) : null}
      {__DEV__ ? (
        <Text style={[styles.devNote, { color: palette.subtext }]}>
          source={getBroadcastFeedVideoSourceLabel(activeSource)} host=
          {activeSource.host || 'unknown'}
          {getBroadcastFeedVideoRiskNote(activeSource)
            ? ` risk=${getBroadcastFeedVideoRiskNote(activeSource)}`
            : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Outer container: clips children so controls never overflow surrounding UI.
  outerWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  // Inner video fills the entire outer container exactly.
  innerFill: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  unavailableWrap: {
    width: '100%',
    height: 200,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  message: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  note: {
    marginTop: 10,
    fontSize: 11,
    textAlign: 'center',
  },
  devNote: {
    marginTop: 8,
    fontSize: 10,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  button: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fallbackPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
