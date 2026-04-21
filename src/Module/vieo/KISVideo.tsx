import React from 'react';
import VideoPlayer, { VideoPlayerProps } from './VideoPlayer';

type Props = Omit<VideoPlayerProps, 'muted' | 'loop' | 'showControls'> & {
  muted?: boolean;
  loop?: boolean;
};

export default function KISVideo({ muted = false, loop = false, ...rest }: Props) {
  return (
    <VideoPlayer
      {...rest}
      muted={muted}
      loop={loop}
      showControls
      containerStyle={{ ...rest.containerStyle }}
      videoStyle={{ ...rest.videoStyle }}
      onError={rest.onError}
    />
  );
}
