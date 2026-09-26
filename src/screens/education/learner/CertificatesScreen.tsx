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
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, RefreshControl, Share, Text, View } from 'react-native';
import RNFS from 'react-native-fs';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import ROUTES, { useMediaHeaders } from '@/network';
import useEducationDiscovery from '@/screens/broadcast/education/hooks/useEducationDiscovery';
import type { EducationProgress } from '@/screens/broadcast/education/api/education.models';

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
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg }}>
      <FlatList
        data={completed}
        keyExtractor={row => `${row.contentType}-${row.contentId}`}
        contentContainerStyle={{ padding: responsive.pageGutter, gap: 14 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={palette.primary} />}
        ListHeaderComponent={<Text style={{ fontSize: 24, fontWeight: '900', color: palette.text, marginBottom: 6 }}>Certificates</Text>}
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: 'center', gap: 10, paddingVertical: 60 }}>
              <KISIcon name="star" size={36} color={palette.subtext} />
              <Text style={{ color: palette.subtext, fontWeight: '700', textAlign: 'center' }}>
                Complete a course to earn your first certificate.
              </Text>
            </View>
          ) : (
            <ActivityIndicator color={palette.primary} style={{ marginTop: 40 }} />
          )
        }
        renderItem={({ item }) => {
          const busy = downloadingId === item.contentId;
          return (
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.surface,
                padding: 16,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <KISIcon name="star" size={18} color={palette.primaryStrong} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: palette.text }} numberOfLines={2}>
                    {item.contentTitle || 'Certificate'}
                  </Text>
                  <Text style={{ fontSize: 12, color: palette.subtext }}>Completed</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <KISButton title={busy ? 'Loading…' : 'View'} size="sm" disabled={busy} onPress={() => void handleView(item)} />
                <KISButton title="Share" size="sm" variant="outline" disabled={busy} onPress={() => void handleShare(item)} />
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
