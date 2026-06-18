import React, { useMemo, useState } from 'react';
import { Alert, View, Text, ActivityIndicator, Pressable, Share } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { EducationCredential } from '@/screens/broadcast/education/hooks/useEducationPhaseThreeData';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';

type Props = {
  certificates: EducationCredential[];
  completionPercent: number;
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
};

const toDateLabel = (value?: string | null) => {
  if (!value) return 'Date unknown';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return 'Date unknown';
  }
};

export default function EducationCertificatesSection({
  certificates,
  completionPercent,
  loading,
  error,
  onRefresh,
}: Props) {
  const { palette } = useKISTheme();
  const nearbyCertificates = useMemo(() => certificates.slice(0, 3), [certificates]);
  const progress = Math.max(0, Math.min(100, Math.round(completionPercent)));
  const [sharingIds, setSharingIds] = useState<Record<string, boolean>>({});

  if (!certificates.length && !loading) return null;

  const handleShare = async (cert: EducationCredential) => {
    setSharingIds((prev) => ({ ...prev, [cert.id]: true }));
    try {
      const res = await getRequest(ROUTES.bible.credentialShare(cert.id), {
        errorMessage: 'Unable to generate share link.',
      });
      const shareUrl =
        res?.data?.share_url ??
        res?.data?.url ??
        res?.share_url ??
        null;
      await Share.share({
        title: cert.badgeName,
        message: shareUrl
          ? `Check out my certificate: ${cert.badgeName}\n${shareUrl}`
          : `Check out my certificate: ${cert.badgeName}`,
        url: shareUrl ?? undefined,
      });
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Share failed', e?.message ?? 'Could not share certificate. Please try again.');
      }
    } finally {
      setSharingIds((prev) => ({ ...prev, [cert.id]: false }));
    }
  };

  return (
    <View
      style={{
        borderWidth: 2,
        borderColor: palette.divider,
        borderRadius: 22,
        padding: 12,
        backgroundColor: palette.card,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Certification vault</Text>
        <KISButton title="Refresh" size="xs" variant="outline" onPress={onRefresh} disabled={loading} />
      </View>

      <View style={{ height: 6, borderRadius: 12, backgroundColor: palette.divider }}>
        <View
          style={{
            width: `${progress}%`,
            height: '100%',
            borderRadius: 12,
            backgroundColor: palette.primary,
          }}
        />
      </View>
      <Text style={{ color: palette.subtext, fontSize: 12 }}>
        {progress}% of tracked courses certified
      </Text>

      {loading ? (
        <ActivityIndicator color={palette.primary} />
      ) : error ? (
        <Text style={{ color: palette.danger ?? palette.primaryStrong }}>{error}</Text>
      ) : (
        nearbyCertificates.map((cert) => (
          <View
            key={cert.id}
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: 16,
              padding: 10,
              backgroundColor: palette.surface,
              gap: 8,
            }}
          >
            <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>{cert.badgeName}</Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>{toDateLabel(cert.issuedAt)}</Text>
            <Pressable
              onPress={() => handleShare(cert)}
              disabled={!!sharingIds[cert.id]}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
                gap: 6,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: palette.primary,
                opacity: pressed || sharingIds[cert.id] ? 0.6 : 1,
              })}
            >
              {sharingIds[cert.id] ? (
                <ActivityIndicator size="small" color={palette.primary} />
              ) : null}
              <Text style={{ fontSize: 13, fontWeight: '600', color: palette.primary }}>
                {sharingIds[cert.id] ? 'Sharing…' : 'Share'}
              </Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}
