import React from 'react';
import { Text, View } from 'react-native';
import type { SectionRenderProps } from './types';

// Editor-only placeholder: this native preview never fetches live KIS
// data (that only happens server-side, on the actual public page) — the
// real "what visitors will see" preview is the WebView-based
// WebsitePreviewScreen pointed at the real public URL, per the
// website-builder plan's "TRUE preview" requirement. This just confirms
// the section is configured.
export default function KisContentSection({ data, palette, typography, spacing }: SectionRenderProps) {
  const targetType = String(data?.target_type || 'content').replace(/_/g, ' ');
  const count = Array.isArray(data?.target_ids) ? data.target_ids.length : 0;
  return (
    <View style={{ marginTop: spacing.md, borderRadius: spacing.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: palette.divider, padding: spacing.md }}>
      <Text style={{ ...typography.h3, color: palette.text }}>{data?.heading || `Live ${targetType}`}</Text>
      <Text style={{ ...typography.caption, color: palette.subtext, marginTop: spacing.xs }}>
        {count > 0 ? `${count} ${targetType} selected — ` : `Showing your ${targetType} automatically — `}
        updates live from KIS, no need to re-add when it changes. Use Preview to see the real layout.
      </Text>
    </View>
  );
}
