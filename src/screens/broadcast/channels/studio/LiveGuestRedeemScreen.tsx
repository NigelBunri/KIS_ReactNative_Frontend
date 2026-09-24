// src/screens/broadcast/channels/studio/LiveGuestRedeemScreen.tsx
//
// Reached via the live-guest/:token deep link registered in App.tsx.
// Claims a co-streaming guest invitation by its share-link token - the
// external-guest counterpart to GiftMembershipRedeemScreen.

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';

type Props = NativeStackScreenProps<RootStackParamList, 'LiveGuestRedeem'>;

type RedeemResult = {
  role?: string;
  status?: string;
  live_stream?: string;
};

export default function LiveGuestRedeemScreen({ route, navigation }: Props) {
  const { palette } = useKISTheme();
  const token = route.params?.token;

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setErrorMsg('Missing invitation link.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await postRequest(
          ROUTES.broadcasts.liveStreamGuestRedeem(token),
          {},
          { errorMessage: '' },
        );
        if (cancelled) return;
        if (res?.success && res?.data) {
          setResult(res.data);
        } else {
          const msg: string = res?.message ?? res?.data?.detail ?? '';
          setErrorMsg(msg || 'Could not accept this invitation. It may have expired or already been used.');
        }
      } catch (e: any) {
        if (!cancelled) setErrorMsg(e?.message ?? 'Could not accept this invitation.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>Livestream Invitation</Text>
      </View>

      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator size="large" color={palette.primary} />
        ) : result ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={styles.emoji}>🎥</Text>
            <Text style={[styles.cardTitle, { color: palette.text }]}>You're in!</Text>
            <Text style={[styles.cardDetail, { color: palette.subtext }]}>
              {result.role === 'CO_HOST' ? 'You’ve joined as a co-host.' : 'You’ve joined as a guest.'}
            </Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={styles.emoji}>⚠️</Text>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Invitation unavailable</Text>
            <Text style={[styles.cardDetail, { color: palette.subtext }]}>{errorMsg}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  backBtn: { padding: 2, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '900' },
  body: { flex: 1, padding: 16, justifyContent: 'center' },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  emoji: { fontSize: 56 },
  cardTitle: { fontSize: 20, fontWeight: '900' },
  cardDetail: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
