import React from 'react';
import { Image, Text, View } from 'react-native';
import type { SectionRenderProps } from './types';

// Editor-only static preview — shows the first slide plus a count of the
// rest. The real crossfading/autoplay carousel only renders on the
// published website (components/website-builder/PublicSlideshow.tsx) —
// same "true preview is the WebView" precedent as kis_content/embed/form.
export default function SlideshowSection({ data, palette, typography, spacing }: SectionRenderProps) {
  const slides = Array.isArray(data?.slides) ? data.slides : [];
  const first = slides[0];

  if (!slides.length) {
    return (
      <View style={{ marginTop: spacing.md, borderRadius: spacing.md, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.surface, padding: spacing.md }}>
        <Text style={{ ...typography.body, color: palette.subtext }}>No slides added yet.</Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: spacing.md, borderRadius: spacing.md, overflow: 'hidden', backgroundColor: palette.surface }}>
      {first?.imageUrl ? (
        <Image source={{ uri: first.imageUrl }} style={{ width: '100%', height: 160 }} resizeMode="cover" />
      ) : (
        <View style={{ width: '100%', height: 160, backgroundColor: palette.divider }} />
      )}
      <View style={{ padding: spacing.sm }}>
        {first?.headline ? <Text style={{ ...typography.h3, color: palette.text }}>{first.headline}</Text> : null}
        {first?.subheadline ? <Text style={{ ...typography.caption, color: palette.subtext, marginTop: 2 }}>{first.subheadline}</Text> : null}
        {slides.length > 1 ? (
          <Text style={{ ...typography.caption, color: palette.subtext, marginTop: spacing.xs }}>+{slides.length - 1} more slide{slides.length - 1 === 1 ? '' : 's'}</Text>
        ) : null}
      </View>
    </View>
  );
}
