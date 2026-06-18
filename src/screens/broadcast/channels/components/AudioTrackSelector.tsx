// src/screens/broadcast/channels/components/AudioTrackSelector.tsx
//
// Horizontal pill list of audio language tracks for a content item.
// Renders nothing if there is 0 or 1 track.

import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';

// ── Types ──────────────────────────────────────────────────────────────────────

export type AudioTrack = {
  id: string;
  url: string;
  label: string;
  language_code?: string;
};

type Props = {
  contentId: string;
  onSelectTrack: (track: AudioTrack) => void;
  currentTrackId?: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AudioTrackSelector({
  contentId,
  onSelectTrack,
  currentTrackId,
}: Props) {
  const { palette } = useKISTheme();
  const { labelFontSize, minTouchTarget } = useResponsiveLayout();
  const [tracks, setTracks] = useState<AudioTrack[]>([]);

  useEffect(() => {
    if (!contentId) return;
    getRequest(ROUTES.broadcasts.contentAudioTracks(contentId))
      .then(res => {
        if (res?.data) {
          const raw: AudioTrack[] = Array.isArray(res.data)
            ? res.data
            : res.data.results ?? [];
          setTracks(raw);
        }
      })
      .catch(() => {/* silent */});
  }, [contentId]);

  // Render nothing when there are 0 or 1 tracks
  if (tracks.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {tracks.map(track => {
        const isSelected = track.id === currentTrackId;
        return (
          <Pressable
            key={track.id}
            onPress={() => onSelectTrack(track)}
            style={[
              styles.pill,
              {
                backgroundColor: isSelected ? palette.gold : palette.surfaceElevated,
                borderColor: isSelected ? palette.gold : palette.border,
                minHeight: minTouchTarget,
                justifyContent: 'center',
              },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                { color: isSelected ? palette.onPrimary : palette.text, fontSize: labelFontSize },
              ]}
            >
              {track.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    flexDirection: 'row',
  },
  pill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'center',
  },
  pillText: {
    fontWeight: '600',
  },
});
