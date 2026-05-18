import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SearchScreen from './SearchScreen';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function GlobalSearchScreen() {
  const navigation = useNavigation<Nav>();

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleSelectResult = useCallback(
    (result: { kind: string; target_id: string; target_type: string; route?: string; metadata?: Record<string, any> }) => {
      navigation.goBack();
      const kind = (result.kind ?? result.target_type ?? '').toLowerCase();
      const id = String(result.target_id ?? '');
      if (kind === 'channel') {
        navigation.navigate('ChannelHome', { channelId: id });
      } else if (kind === 'content' || kind === 'broadcast') {
        navigation.navigate('BroadcastDetail', { id });
      }
    },
    [navigation],
  );

  return (
    <View style={{ flex: 1 }}>
      <SearchScreen onClose={handleClose} onSelectResult={handleSelectResult} />
    </View>
  );
}
