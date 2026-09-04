import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type MiniPlayerInfo = {
  contentId: string;
  videoUrl: string | null;
  title: string | null;
  channelName: string | null;
  posterUrl: string | null;
};

type MiniPlayerCtx = {
  contentId: string | null;
  videoUrl: string | null;
  title: string | null;
  channelName: string | null;
  posterUrl: string | null;
  playing: boolean;
  show: (info: MiniPlayerInfo) => void;
  dismiss: () => void;
  togglePlay: () => void;
};

const MiniPlayerContext = createContext<MiniPlayerCtx>({
  contentId: null, videoUrl: null, title: null,
  channelName: null, posterUrl: null, playing: false,
  show: () => {}, dismiss: () => {}, togglePlay: () => {},
});

export function MiniPlayerProvider({ children }: { children: React.ReactNode }) {
  const [info, setInfo] = useState<MiniPlayerInfo | null>(null);
  const [playing, setPlaying] = useState(false);

  const show = useCallback((next: MiniPlayerInfo) => {
    setInfo(next);
    setPlaying(true);
  }, []);

  const dismiss = useCallback(() => {
    setInfo(null);
    setPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    setPlaying(prev => !prev);
  }, []);

  // Memoized so any useMiniPlayer() consumer mounted elsewhere in the tree
  // only re-renders when the player's own state actually changes, not on
  // every unrelated re-render of whatever sits above this provider (which
  // wraps the entire RootStack.Navigator).
  const value = useMemo<MiniPlayerCtx>(() => ({
    contentId: info?.contentId ?? null,
    videoUrl: info?.videoUrl ?? null,
    title: info?.title ?? null,
    channelName: info?.channelName ?? null,
    posterUrl: info?.posterUrl ?? null,
    playing,
    show, dismiss, togglePlay,
  }), [info, playing, show, dismiss, togglePlay]);

  return (
    <MiniPlayerContext.Provider value={value}>
      {children}
    </MiniPlayerContext.Provider>
  );
}

export const useMiniPlayer = () => useContext(MiniPlayerContext);
