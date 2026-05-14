import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { toggleChannelSubscription } from '@/screens/broadcast/channels/hooks/useChannelsData';

type Props = { channelId?: string; initialSubscribed?: boolean; compact?: boolean };

export default function SubscribeBellButton({ channelId, initialSubscribed = false, compact = false }: Props) {
  const { palette } = useKISTheme();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [bell, setBell] = useState(false);

  const handleSubscribe = useCallback(async () => {
    if (!channelId) return;
    const next = !subscribed;
    setSubscribed(next);
    const result = await toggleChannelSubscription(channelId, next);
    if (!result?.success) {
      setSubscribed(!next);
      Alert.alert('Subscription update failed', result?.message || 'Please try again.');
    }
  }, [channelId, subscribed]);

  return (
    <View style={styles.row}>
      <Pressable onPress={handleSubscribe} style={[styles.subscribe, compact && styles.compactSubscribe, { backgroundColor: subscribed ? palette.surfaceElevated : palette.text }]}> 
        <Text style={{ color: subscribed ? palette.text : palette.surface, fontWeight: '900', fontSize: 12 }}>{subscribed ? 'Subscribed' : 'Subscribe'}</Text>
      </Pressable>
      <Pressable onPress={() => setBell(prev => !prev)} style={[styles.bell, { borderColor: palette.border, backgroundColor: bell ? palette.primarySoft : palette.surface }]}> 
        <KISIcon name="bell" size={18} color={bell ? palette.primaryStrong : palette.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subscribe: { minHeight: 38, borderRadius: 8, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  compactSubscribe: { minHeight: 34, paddingHorizontal: 12 },
  bell: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
