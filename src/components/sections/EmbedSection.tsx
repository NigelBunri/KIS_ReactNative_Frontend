import React from 'react';
import { Text, View } from 'react-native';
import type { SectionRenderProps } from './types';

const PROVIDER_LABELS: Record<string, string> = {
  youtube: 'YouTube', vimeo: 'Vimeo', calendly: 'Calendly',
  google_maps: 'Google Maps', google_calendar: 'Google Calendar',
  spotify: 'Spotify', loom: 'Loom',
};

// Placeholder card — the real embed only renders on the published website
// (components/website-builder/SectionRenderer.tsx's EmbedSection there);
// adding a WebView here just for an editor preview isn't worth a new
// native dependency for what other section previews already treat as a
// static mockup (see FormSection.tsx).
export default function EmbedSection({ data, palette, typography, spacing }: SectionRenderProps) {
  const provider = String(data?.provider || '');
  const url = String(data?.url || '');
  return (
    <View style={{ marginTop: spacing.md }}>
      {!!data?.title && <Text style={{ ...typography.h3, color: palette.text, marginBottom: spacing.xs }}>{data.title}</Text>}
      <View
        style={{
          borderRadius: spacing.sm,
          borderWidth: 1,
          borderColor: palette.divider,
          backgroundColor: palette.surface,
          padding: spacing.md,
          alignItems: 'center',
          gap: spacing.xs,
        }}
      >
        <Text style={{ ...typography.label, color: palette.text }}>{PROVIDER_LABELS[provider] || 'Embed'}</Text>
        <Text style={{ ...typography.caption, color: palette.subtext, textAlign: 'center' }} numberOfLines={2}>
          {url || 'No link set yet'}
        </Text>
        <Text style={{ ...typography.caption, color: palette.subtext }}>Renders live on your published site</Text>
      </View>
    </View>
  );
}
