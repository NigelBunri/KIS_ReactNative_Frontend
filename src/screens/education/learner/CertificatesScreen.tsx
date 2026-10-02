// src/screens/education/learner/CertificatesScreen.tsx
//
// Education UX v2 — dedicated certificates destination. Previously a
// certificate could only be viewed from inside EducationDetailSheet while
// that specific course happened to be open; there was no single place to
// see everything you'd earned.
//
// Backend note: there is no "list all my certificates" endpoint — only
// per-course ROUTES.education.certificate(contentId), gated on that
// course's own completion. This screen derives the certificate list from
// discovery's continueLearning (filtered to isCompleted), matching what
// My Learning's "Completed" section already shows, then downloads each
// certificate PDF on demand exactly as EducationDetailSheet already does
// (RNFS.downloadFile with authenticated media headers).
//
// Visual pass: rebuilt on the shared premium education component kit.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, RefreshControl, Share } from 'react-native';
import RNFS from 'react-native-fs';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import ROUTES, { useMediaHeaders } from '@/network';
import useEducationDiscovery from '@/screens/broadcast/education/hooks/useEducationDiscovery';
import type { EducationProgress } from '@/screens/broadcast/education/api/education.models';
import {
  EducationScreenScaffold,
  EducationListCard,
  EducationEmptyState,
  EducationActionButton,
} from '@/screens/education/shared/components';

export default function CertificatesScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const { data, loading, refresh } = useEducationDiscovery();
  const mediaHeaders = useMediaHeaders();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const completed: EducationProgress[] = (data?.continueLearning ?? []).filter(row => row.isCompleted);

  const downloadCertificate = useCallback(
    async (contentId: string) => {
      if (!Object.keys(mediaHeaders || {}).length) return null;
      const filePath = `${RNFS.DocumentDirectoryPath}/education-certificate-${contentId}.pdf`;
      await RNFS.downloadFile({
        fromUrl: ROUTES.education.certificate(contentId),
        toFile: filePath,
        headers: mediaHeaders,
      }).promise;
      return `file://${filePath}`;
    },
    [mediaHeaders],
  );

  const handleView = useCallback(
    async (progress: EducationProgress) => {
      setDownloadingId(progress.contentId);
      try {
        const localUri = await downloadCertificate(progress.contentId);
        if (localUri) await Linking.openURL(localUri);
      } catch (error: any) {
        Alert.alert('Certificate', error?.message || 'Unable to load this certificate yet.');
      } finally {
        setDownloadingId(null);
      }
    },
    [downloadCertificate],
  );

  const handleShare = useCallback(
    async (progress: EducationProgress) => {
      setDownloadingId(progress.contentId);
      try {
        const localUri = await downloadCertificate(progress.contentId);
        if (localUri) await Share.share({ url: localUri, message: localUri });
      } catch (error: any) {
        Alert.alert('Certificate', error?.message || 'Unable to share this certificate yet.');
      } finally {
        setDownloadingId(null);
      }
    },
    [downloadCertificate],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <EducationScreenScaffold
        palette={palette}
        title="Certificates"
        scrollable={false}
        contentContainerStyle={{ flex: 1, padding: 0 }}
      >
        <FlatList
          style={{ flex: 1 }}
          data={completed}
          keyExtractor={row => `${row.contentType}-${row.contentId}`}
          contentContainerStyle={{ padding: responsive.pageGutter, gap: 12 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={palette.primary} />}
          ListEmptyComponent={
            !loading ? (
              <EducationEmptyState palette={palette} title="No certificates yet" description="Complete a course to earn your first certificate." />
            ) : (
              <ActivityIndicator color={palette.primary} style={{ marginTop: 40 }} />
            )
          }
          renderItem={({ item }) => {
            const busy = downloadingId === item.contentId;
            return (
              <EducationListCard
                palette={palette}
                eyebrow="Certificate"
                title={item.contentTitle || 'Certificate'}
                subtitle="Completed"
                primaryAction={<EducationActionButton palette={palette} label={busy ? 'Loading…' : 'View'} disabled={busy} onPress={() => void handleView(item)} />}
                secondaryAction={<EducationActionButton palette={palette} label="Share" variant="secondary" disabled={busy} onPress={() => void handleShare(item)} />}
              />
            );
          }}
        />
      </EducationScreenScaffold>
    </SafeAreaView>
  );
}
