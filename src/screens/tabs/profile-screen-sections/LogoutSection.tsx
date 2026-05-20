import React from 'react';
import { View } from 'react-native';
import KISButton from '@/constants/KISButton';
import type { KISPalette } from '@/theme/constants';

type Props = {
  palette: KISPalette;
  onLogout: () => void;
  loading?: boolean;
};

export default function LogoutSection({ palette: _palette, onLogout, loading }: Props) {
  return (
    <View style={{ paddingHorizontal: 18 }}>
      <KISButton title="Log Out" onPress={onLogout} variant="outline" loading={loading} />
    </View>
  );
}
