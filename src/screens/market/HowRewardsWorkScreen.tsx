import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';

// New screen for Phase 9 of the billing/rewards project. Plain-language
// explanation of KIS Coins, linked from LoyaltyScreen.tsx and
// ReferralScreen.tsx. Deliberately quotes no numbers the backend could
// change without a mobile release except the 40/60/20 redemption caps,
// which the whole project has treated as the canonical safety rule
// throughout (apps.rewards.models.RedemptionPolicy defaults, restated
// verbatim in apps.billing.services.calculate_redemption). Referral rates
// are explicitly configurable per apps.referrals.services and are
// deliberately NOT restated as fixed numbers here — users see their real,
// live current rate on ReferralScreen.tsx instead.

type Section = {
  title: string;
  body: string;
};

const EARN_SECTIONS: Section[] = [
  {
    title: 'Achievements',
    body: 'One-time rewards for milestones on KIS, like completing your profile or reaching an activity goal.',
  },
  {
    title: 'Repeatable actions',
    body: 'Small rewards for regular, meaningful activity — some daily, some weekly or monthly, so consistent use adds up over time.',
  },
  {
    title: 'Referrals',
    body: 'When someone you refer subscribes to a paid KIS plan, you earn a share of that qualifying revenue as KIS Coins. Your rate depends on your current account tier — higher tiers earn a larger share.',
  },
  {
    title: 'Promotions',
    body: 'From time to time, KIS may run promotional campaigns or redeem promo codes for bonus KIS Coins.',
  },
];

export default function HowRewardsWorkScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={[s.root, { backgroundColor: palette.bg }]}>
      <View style={[s.header, { borderBottomColor: palette.divider }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={s.backBtn}
        >
          <Text style={[s.backText, { color: palette.primaryStrong }]}>Back</Text>
        </Pressable>
        <Text style={[s.headerTitle, { color: palette.text }]}>How KIS Rewards Work</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={[s.card, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
          <Text style={[s.cardTitle, { color: palette.text }]}>What are KIS Coins?</Text>
          <Text style={[s.cardBody, { color: palette.subtext }]}>
            KIS Coins are rewards earned through qualifying activities on KIS. They can currently be used toward
            eligible KIS subscription upgrades. Additional uses may become available in the future, subject to
            applicable laws, regulations, licensing, and KIS program terms.
          </Text>
          <Text style={[s.cardBody, { color: palette.subtext, marginTop: 8 }]}>
            KIS Coins are not money, cash, a bank balance, a deposit, or cryptocurrency. They cannot currently be
            withdrawn, transferred to another person, or exchanged for cash.
          </Text>
        </View>

        <View>
          <Text style={[s.sectionTitle, { color: palette.text }]}>Ways to earn</Text>
          {EARN_SECTIONS.map((item) => (
            <View
              key={item.title}
              style={[s.card, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}
            >
              <Text style={[s.cardTitle, { color: palette.text }]}>{item.title}</Text>
              <Text style={[s.cardBody, { color: palette.subtext }]}>{item.body}</Text>
            </View>
          ))}
        </View>

        <View>
          <Text style={[s.sectionTitle, { color: palette.text }]}>How redemption works</Text>
          <View style={[s.card, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
            <Text style={[s.cardBody, { color: palette.subtext }]}>
              KIS Coins can currently subsidize part of the cost of an eligible KIS subscription upgrade — they
              cannot pay for the whole thing. Up to 40% of the upgrade price can currently be covered by KIS Coins
              in the normal case, and KIS reserves the right to allow a higher discount, up to 60%, in some
              circumstances. You will always pay at least 20% of the price in cash.
            </Text>
            <Text style={[s.cardBody, { color: palette.subtext, marginTop: 8 }]}>
              The exact discount for any given upgrade is always calculated by KIS at checkout, based on your
              available balance and these limits — it is never something the app predicts or promises in advance.
            </Text>
          </View>
        </View>

        <View>
          <Text style={[s.sectionTitle, { color: palette.text }]}>How referral rewards work</Text>
          <View style={[s.card, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
            <Text style={[s.cardBody, { color: palette.subtext }]}>
              Your referral rate depends on your account tier at the time a friend's subscription qualifies — higher
              tiers earn a larger share of qualifying revenue. You can see your current rate on the Referrals
              screen.
            </Text>
            <Text style={[s.cardBody, { color: palette.subtext, marginTop: 8 }]}>
              Once a referral qualifies, the rate that applied at that moment is locked in for that referral. If KIS
              changes referral rates later, it will not change what you already earned or are due to earn from
              referrals that already qualified.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 60 },
  backText: { fontSize: 15, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 8, gap: 4 },
  cardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  cardBody: { fontSize: 13, lineHeight: 19 },
});
