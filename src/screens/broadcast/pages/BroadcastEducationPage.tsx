import React, { useCallback } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import KISButton from '@/constants/KISButton';
import EducationLegacyDiscoverPage from '@/screens/broadcast/education/EducationLegacyDiscoverPage';
import EducationV2DiscoverPage from '@/screens/broadcast/education/EducationV2DiscoverPage';
import useEducationAvailability from '@/screens/broadcast/education/hooks/useEducationAvailability';

type Props = {
  searchTerm?: string;
  searchContext?: string;
};

export default function BroadcastEducationPage({ searchTerm, searchContext }: Props) {
  const availability = useEducationAvailability();
  const handleRetry = useCallback(async () => {
    await availability.markAvailable();
    await availability.refresh();
  }, [availability]);

  if (!FEATURE_FLAGS.EDUCATION_V2 || availability.loading) {
    return <EducationLegacyDiscoverPage searchTerm={searchTerm} searchContext={searchContext} />;
  }

  if (!availability.available) {
    return <EducationUnavailableView onRetry={handleRetry} busy={availability.loading} />;
  }

  return (
    <EducationV2DiscoverPage
      searchTerm={searchTerm}
      searchContext={searchContext}
      onUnavailable={availability.markUnavailable}
      onAvailable={availability.markAvailable}
    />
  );
}

type EducationUnavailableViewProps = {
  onRetry: () => void;
  busy: boolean;
};

function EducationUnavailableView({ onRetry, busy }: EducationUnavailableViewProps) {
  const { palette } = useKISTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.bg,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: '800', color: palette.text, marginBottom: 6 }}>
        Education is currently unavailable
      </Text>
      <Text
        style={{
          color: palette.subtext,
          textAlign: 'center',
          marginBottom: 16,
        }}
      >
        The education discovery service could not be reached. Check again once the backend is back online.
      </Text>
      <KISButton title={busy ? 'Checking…' : 'Check again'} onPress={onRetry} disabled={busy} />
      <View style={{ marginTop: 12 }}>
        <ActivityIndicator color={palette.primary} />
      </View>
    </View>
  );
}
