// src/screens/education/shared/MaterialViewer.tsx
//
// Education UX v2, Phase 2 — rich inline material preview for
// LearningPlayerScreen, matching EducationDetailSheet's viewer exactly
// (same Video/LoadingPdf/LoadingImage components, same safe_resource_url
// handling, same access gate) instead of a device-browser fallback.
import React from 'react';
import { Text, View } from 'react-native';
import Video from 'react-native-video';
import LoadingImage from '@/components/media/LoadingImage';
import LoadingPdf from '@/components/media/LoadingPdf';
import { buildMediaSource } from '@/network';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import {
  buildProtectedSource,
  inferMaterialKind,
  inferMaterialMime,
} from '@/screens/broadcast/education/utils/materialPreview';

type Props = {
  material: any;
  mediaHeaders: Record<string, string>;
  hasAccess: boolean;
};

export default function MaterialViewer({ material, mediaHeaders, hasAccess }: Props) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const mediaPreviewHeight = responsive.isWatch ? 150 : responsive.isCompactPhone ? 180 : 220;
  const pdfPreviewHeight = responsive.isWatch ? 260 : responsive.isCompactPhone ? 340 : 420;

  const resourceUrl = material?.safe_resource_url || material?.resource_url;
  const kind = inferMaterialKind(material);
  const mime = inferMaterialMime(material);
  const mediaSource = buildMediaSource(resourceUrl, mediaHeaders);
  const pdfSource = buildProtectedSource(resourceUrl, mediaHeaders);
  const imageSource = resourceUrl
    ? Object.keys(mediaHeaders || {}).length > 0
      ? { uri: resourceUrl, headers: mediaHeaders }
      : { uri: resourceUrl }
    : undefined;

  if (!hasAccess) {
    return (
      <View style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface }}>
        <Text style={{ color: palette.subtext }}>Enroll first to view or download this material.</Text>
      </View>
    );
  }

  if (!resourceUrl) {
    return (
      <View style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <KISIcon name="warning" size={16} color={palette.subtext} />
        <Text style={{ color: palette.subtext, flex: 1 }}>This material isn't available yet.</Text>
      </View>
    );
  }

  if (kind === 'video') {
    return (
      <Video
        source={mediaSource}
        style={{ width: '100%', height: mediaPreviewHeight, borderRadius: 18, backgroundColor: palette.royalInk ?? '#111' }}
        controls
      />
    );
  }
  if (kind === 'audio') {
    return (
      <Video
        source={mediaSource}
        style={{ width: '100%', height: 72, borderRadius: 18, backgroundColor: palette.royalInk ?? '#111' }}
        controls
        audioOnly
      />
    );
  }
  if (kind === 'pdf') {
    return (
      <View style={{ height: pdfPreviewHeight, borderRadius: 18, overflow: 'hidden' }}>
        <LoadingPdf source={pdfSource ?? { uri: resourceUrl }} />
      </View>
    );
  }
  if (kind === 'image') {
    return (
      <LoadingImage
        source={imageSource}
        containerStyle={{ width: '100%', height: mediaPreviewHeight }}
        style={{ borderRadius: 18, backgroundColor: palette.surface }}
      />
    );
  }

  // Document/other: no safe inline renderer exists for this type in KIS
  // yet — a deliberate labeled fallback rather than a silent external
  // hand-off (see the v2 architecture note's Learning Player section).
  return (
    <View style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, gap: 6 }}>
      <Text style={{ color: palette.text, fontWeight: '700' }}>
        {material?.resource_name || material?.title || 'Document'}
      </Text>
      {mime ? <Text style={{ color: palette.subtext, fontSize: 12 }}>{mime}</Text> : null}
      <Text style={{ color: palette.subtext, fontSize: 12 }}>
        This file type doesn't have an in-app preview yet — use Open to view it.
      </Text>
    </View>
  );
}
