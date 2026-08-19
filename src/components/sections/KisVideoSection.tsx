import React from 'react';
import { Text, View } from 'react-native';
import Video from 'react-native-video';
import EditableText from './EditableText';
import type { SectionRenderProps } from './types';

// Real playback in the editor preview too, not just a static mockup —
// react-native-video plays directly from the resolved S3 URL, same as
// the public website's <video> element. Only renders once a video has
// actually been picked (data.video_url is set by the picker at select
// time so the preview doesn't need its own network round trip).
export default function KisVideoSection({ data, palette, typography, spacing, onFieldChange }: SectionRenderProps) {
  const videoUrl = String(data?.video_url || '');
  return (
    <View style={{ marginTop: spacing.md }}>
      {(!!data?.title || !!onFieldChange) && (
        <EditableText
          value={String(data?.title || '')}
          style={{ ...typography.h3, color: palette.text, marginBottom: spacing.xs }}
          placeholder="Video title"
          onChangeText={onFieldChange ? (v) => onFieldChange('title', v) : undefined}
        />
      )}
      {videoUrl ? (
        <Video
          source={{ uri: videoUrl }}
          style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: spacing.sm, backgroundColor: '#000' }}
          controls
          paused
          resizeMode="cover"
          poster={data?.thumbnail_url ? String(data.thumbnail_url) : undefined}
        />
      ) : (
        <View
          style={{
            borderRadius: spacing.sm, borderWidth: 1, borderColor: palette.divider,
            backgroundColor: palette.surface, padding: spacing.md, alignItems: 'center',
          }}
        >
          <Text style={{ ...typography.caption, color: palette.subtext }}>No video selected yet</Text>
        </View>
      )}
    </View>
  );
}
