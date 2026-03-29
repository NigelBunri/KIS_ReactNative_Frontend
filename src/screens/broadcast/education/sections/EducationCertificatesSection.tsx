import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { EducationCredential } from '@/screens/broadcast/education/hooks/useEducationPhaseThreeData';

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

  if (!certificates.length && !loading) return null;

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
            }}
          >
            <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>{cert.badgeName}</Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>{toDateLabel(cert.issuedAt)}</Text>
          </View>
        ))
      )}
    </View>
  );
}
