import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import {
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';

type Props = NativeStackScreenProps<RootStackParamList, 'WebsiteJoin'>;

export default function WebsiteJoinScreen({ navigation }: Props) {
  const palette = getHealthThemeColors('light');
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const handleRedeem = useCallback(async () => {
    setRedeeming(true);
    try {
      const res = await postRequest(ROUTES.websites.redeemInvite, { code: code.trim() }, { errorMessage: 'Unable to redeem this code.' });
      const data = (res as any)?.data ?? res;
      if (!res?.success) throw new Error((res as any)?.message || 'Unable to redeem this code.');
      Alert.alert('Website Builder', `You're now a ${data.role} on this website.`, [
        {
          text: 'Open Website Builder',
          onPress: () => navigation.replace('WebsiteBuilder', {
            ownerType: data.owner_type, ownerId: data.owner_id,
          }),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Website Builder', error?.message || 'Unable to redeem this code.');
    } finally {
      setRedeeming(false);
    }
  }, [code, navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ padding: spacing.md }}>
        <Text style={{ ...typography.h2, color: palette.text }}>Join a Website</Text>
        <Text style={{ ...typography.caption, color: palette.subtext, marginTop: 2 }}>
          Enter the invite code someone shared with you to start collaborating on their website.
        </Text>
        <KISTextInput
          label="Invite Code"
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          style={{ marginTop: spacing.md }}
        />
        <View style={{ marginTop: spacing.md }}>
          <KISButton title="Join" onPress={handleRedeem} disabled={redeeming || !code.trim()} />
        </View>
      </View>
    </SafeAreaView>
  );
}
