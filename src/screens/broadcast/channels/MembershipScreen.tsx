import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Linking, Modal, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type PaymentProvider = 'flutterwave' | 'stripe';

type Tier = {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  perks: string[];
  is_joined: boolean;
};

export default function MembershipScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Membership'>>();
  const { channelId, channelName } = route.params;

  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [pendingTier, setPendingTier] = useState<Tier | null>(null);
  const [paymentModal, setPaymentModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.broadcasts.channelMembershipTiers(channelId), { errorMessage: '' });
      setTiers(Array.isArray(res) ? res : res?.data ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [channelId]);

  useEffect(() => { void load(); }, [load]);

  const formatPrice = (cents: number, currency: string) => {
    if (cents === 0) return 'Free';
    return `${currency} ${(cents / 100).toFixed(2)}/mo`;
  };

  const handleJoin = useCallback((tier: Tier) => {
    if (tier.is_joined) {
      Alert.alert('Cancel membership', `Cancel your ${tier.title} membership?`, [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel membership', style: 'destructive',
          onPress: async () => {
            setJoining(tier.id);
            await postRequest(
              ROUTES.broadcasts.channelMembership(channelId),
              { tier_id: tier.id, _method: 'DELETE' },
              { errorMessage: 'Could not cancel.' }
            ).catch(() => {});
            await load();
            setJoining(null);
          },
        },
      ]);
      return;
    }

    if (tier.price_cents === 0) {
      void confirmJoin(tier, 'flutterwave');
      return;
    }

    setPendingTier(tier);
    setPaymentModal(true);
  }, [channelId, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmJoin = useCallback(async (tier: Tier, provider: PaymentProvider) => {
    setPaymentModal(false);
    setJoining(tier.id);
    try {
      const res = await postRequest(
        ROUTES.broadcasts.channelMembership(channelId),
        { tier_id: tier.id, payment_provider: provider },
        { errorMessage: 'Could not join.' }
      );

      if (res?.payment_required) {
        const url = res.payment_url || res.checkout_url;
        if (url) {
          const canOpen = await Linking.canOpenURL(url).catch(() => false);
          if (canOpen) {
            await Linking.openURL(url);
            Alert.alert(
              'Complete payment',
              'Finish payment in the browser, then tap OK to refresh.',
              [{ text: 'OK', onPress: load }]
            );
          } else {
            Alert.alert('Payment required', `Please visit: ${url}`);
          }
        } else {
          Alert.alert('Error', 'Payment link unavailable. Please try again.');
        }
      } else if (res?.joined) {
        Alert.alert('Joined!', `You are now a ${tier.title} member.`);
        await load();
      }
    } catch {
      Alert.alert('Error', 'Could not process. Please try again.');
    } finally {
      setJoining(null);
      setPendingTier(null);
    }
  }, [channelId, load]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>
          {channelName ? `${channelName} · ` : ''}Memberships
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : tiers.length === 0 ? (
        <View style={styles.centered}>
          <KISIcon name="people" size={36} color={palette.border} />
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No membership tiers yet</Text>
        </View>
      ) : (
        <FlatList
          data={tiers}
          keyExtractor={t => t.id}
          contentContainerStyle={{ padding: responsive.pageGutter, maxWidth: responsive.contentMaxWidth, width: '100%', alignSelf: 'center', gap: 16 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
              <Text style={{ color: palette.subtext, fontSize: 14, textAlign: 'center' }}>
                No memberships yet
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: item.is_joined ? palette.primary : palette.divider }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.tierTitle, { color: palette.text }]}>{item.title}</Text>
                <Text style={[styles.tierPrice, { color: palette.primaryStrong }]}>
                  {formatPrice(item.price_cents, item.currency)}
                </Text>
              </View>
              {item.description ? (
                <Text style={[styles.tierDesc, { color: palette.subtext }]}>{item.description}</Text>
              ) : null}
              {item.perks?.length > 0 && (
                <View style={{ gap: 4, marginTop: 8 }}>
                  {item.perks.map((perk, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <KISIcon name="check" size={12} color={palette.primaryStrong} />
                      <Text style={{ color: palette.subtext, fontSize: 13, fontWeight: '600' }}>{perk}</Text>
                    </View>
                  ))}
                </View>
              )}
              {item.price_cents > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <KISIcon name="lock" size={11} color={palette.subtext} />
                  <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '600' }}>
                    Pay via Flutterwave (Africa) or Stripe (card)
                  </Text>
                </View>
              )}
              <Pressable
                onPress={() => handleJoin(item)}
                disabled={joining === item.id}
                style={[
                  styles.joinBtn,
                  {
                    backgroundColor: item.is_joined ? palette.surface : palette.primary,
                    borderColor: item.is_joined ? palette.border : palette.primary,
                  },
                ]}
              >
                {joining === item.id ? (
                  <ActivityIndicator color={item.is_joined ? palette.text : palette.ivory} size="small" />
                ) : (
                  <Text style={{ color: item.is_joined ? palette.text : palette.ivory, fontWeight: '900' }}>
                    {item.is_joined ? 'Joined ✓' : 'Join'}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        />
      )}

      <Modal
        visible={paymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPaymentModal(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: palette.card }]} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: palette.border }]} />
            <Text style={[styles.modalTitle, { color: palette.text }]}>Choose payment method</Text>
            {pendingTier && (
              <Text style={[styles.modalSub, { color: palette.subtext }]}>
                {pendingTier.title} — {formatPrice(pendingTier.price_cents, pendingTier.currency)}
              </Text>
            )}

            <Pressable
              style={[styles.providerBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
              onPress={() => pendingTier && confirmJoin(pendingTier, 'flutterwave')}
            >
              <View style={styles.providerRow}>
                <View style={[styles.providerIcon, { backgroundColor: palette.gold }]}>
                  <Text style={[styles.providerIconText, { color: palette.royalInk }]}>FW</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.providerName, { color: palette.text }]}>Flutterwave</Text>
                  <Text style={[styles.providerDesc, { color: palette.subtext }]}>
                    Mobile money, bank transfer, cards (Africa & more)
                  </Text>
                </View>
                <KISIcon name="arrow-left" size={16} color={palette.subtext} style={{ transform: [{ rotate: '180deg' }] }} />
              </View>
            </Pressable>

            <Pressable
              style={[styles.providerBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
              onPress={() => pendingTier && confirmJoin(pendingTier, 'stripe')}
            >
              <View style={styles.providerRow}>
                <View style={[styles.providerIcon, { backgroundColor: palette.primaryStrong }]}>
                  <Text style={[styles.providerIconText, { color: palette.onPrimary }]}>S</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.providerName, { color: palette.text }]}>Stripe</Text>
                  <Text style={[styles.providerDesc, { color: palette.subtext }]}>
                    International credit / debit card
                  </Text>
                </View>
                <KISIcon name="arrow-left" size={16} color={palette.subtext} style={{ transform: [{ rotate: '180deg' }] }} />
              </View>
            </Pressable>

            <Pressable onPress={() => setPaymentModal(false)} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: palette.subtext }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '700' },
  card: {
    borderRadius: 16, borderWidth: 2, padding: 16, gap: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tierTitle: { fontSize: 16, fontWeight: '900' },
  tierPrice: { fontSize: 14, fontWeight: '800' },
  tierDesc: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  joinBtn: {
    marginTop: 14, borderRadius: 24, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36, gap: 12,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  modalSub: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  providerBtn: {
    borderRadius: 14, borderWidth: 1.5, padding: 14,
  },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  providerIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  providerIconText: { fontWeight: '900', fontSize: 13 },
  providerName: { fontSize: 15, fontWeight: '800' },
  providerDesc: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 15, fontWeight: '700' },
});
