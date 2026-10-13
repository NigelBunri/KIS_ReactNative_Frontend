import React from 'react';
import { Alert, View } from 'react-native';
import KISButton from '@/constants/KISButton';
import type { KISPalette } from '@/theme/constants';

type Props = {
  palette: KISPalette;
  onLogout: () => void;
  loading?: boolean;
};

export default function LogoutSection({ palette: _palette, onLogout, loading }: Props) {
  const handlePress = () => {
    Alert.alert(
      'Log out?',
      'You will need to log in again to access your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: onLogout },
      ],
    );
  };

  return (
    <View style={{ paddingHorizontal: 18 }}>
      <KISButton title="Log Out" onPress={handlePress} variant="outline" loading={loading} />
    </View>
  );
}
