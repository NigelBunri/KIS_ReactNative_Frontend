import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import BibleSectionCard from './BibleSectionCard';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

type Stats = {
  reading_sessions: number;
  bookmarks: number;
  highlights: number;
  notes: number;
  active_plans: number;
  streak: number;
};

export default function BibleCommunityPanel() {
  const { palette } = useKISTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [publicPrayers, setPublicPrayers] = useState<any[]>([]);
  const [planEnrollments, setPlanEnrollments] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [prayerTitle, setPrayerTitle] = useState('');
  const [prayerContent, setPrayerContent] = useState('');

  const loadCommunity = async () => {
    const [statsRes, publicRes, enrollRes, plansRes] = await Promise.all([
      getRequest(ROUTES.bible.stats, { errorMessage: 'Unable to load stats.' }),
      getRequest(ROUTES.bible.prayersPublic, { errorMessage: 'Unable to load public prayers.' }),
      getRequest(ROUTES.bible.planEnrollments, { errorMessage: 'Unable to load plan enrollments.' }),
      getRequest(ROUTES.bible.plans, { errorMessage: 'Unable to load plans.' }),
    ]);
    setStats(statsRes?.data ?? null);
    setPublicPrayers(publicRes?.data?.results ?? publicRes?.data ?? []);
    setPlanEnrollments(enrollRes?.data?.results ?? enrollRes?.data ?? []);
    setPlans(plansRes?.data?.results ?? plansRes?.data ?? []);
  };

  useEffect(() => {
    loadCommunity();
  }, []);

  const sharePrayer = async () => {
    if (!prayerTitle.trim() || !prayerContent.trim()) return;
    const res = await postRequest(
      ROUTES.bible.prayers,
      { title: prayerTitle.trim(), content: prayerContent.trim(), is_public: true },
      { errorMessage: 'Unable to share prayer.' },
    );
    if (res?.success) {
      setPrayerTitle('');
      setPrayerContent('');
      loadCommunity();
    }
  };

  const enrollPlan = async (planId: string) => {
    const res = await postRequest(
      ROUTES.bible.planEnrollments,
      { plan: planId, start_date: new Date().toISOString().slice(0, 10) },
      { errorMessage: 'Unable to enroll in plan.' },
    );
    if (res?.success) loadCommunity();
  };

  return (
    <BibleSectionCard>
      <Text style={[styles.title, { color: palette.text }]}>Community & growth</Text>
      <Text style={{ color: palette.subtext }}>
        Join reading plans, share prayers, and track your streaks with others.
      </Text>

      {stats ? (
        <View style={styles.grid}>
          {[
            { title: 'Reading streak', value: `${stats.streak} days`, icon: 'check' },
            { title: 'Active plans', value: stats.active_plans, icon: 'calendar' },
            { title: 'Bookmarks', value: stats.bookmarks, icon: 'book' },
            { title: 'Highlights', value: stats.highlights, icon: 'heart' },
          ].map((item) => (
            <View key={item.title} style={[styles.card, { borderColor: palette.divider }]}>
              <KISIcon name={item.icon as any} size={18} color={palette.primaryStrong} />
              <Text style={{ color: palette.text, fontWeight: '600', marginTop: 6 }}>{item.title}</Text>
              <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>{item.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.section, { borderColor: palette.divider }]}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>Public prayer circle</Text>
        <TextInput
          value={prayerTitle}
          onChangeText={setPrayerTitle}
          placeholder="Prayer title"
          placeholderTextColor={palette.subtext}
          style={[styles.input, { borderColor: palette.divider, color: palette.text }]}
        />
        <TextInput
          value={prayerContent}
          onChangeText={setPrayerContent}
          placeholder="Share your prayer"
          placeholderTextColor={palette.subtext}
          style={[styles.input, { borderColor: palette.divider, color: palette.text, minHeight: 70 }]}
          multiline
        />
        <KISButton title="Share prayer" size="sm" onPress={sharePrayer} />
        <View style={{ gap: 8, marginTop: 8 }}>
          {publicPrayers.slice(0, 4).map((prayer) => (
            <View key={prayer.id} style={[styles.prayerCard, { borderColor: palette.divider }]}>
              <Text style={{ color: palette.text, fontWeight: '600' }}>{prayer.title}</Text>
              <Text style={{ color: palette.subtext, marginTop: 4 }} numberOfLines={3}>
                {prayer.content}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.section, { borderColor: palette.divider }]}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>Group plans</Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          {planEnrollments.slice(0, 3).map((enroll) => (
            <View key={enroll.id} style={[styles.prayerCard, { borderColor: palette.divider }]}>
              <Text style={{ color: palette.text, fontWeight: '600' }}>{enroll.plan_detail?.name}</Text>
              <Text style={{ color: palette.subtext, marginTop: 4 }}>
                Day {enroll.current_day} · {enroll.status}
              </Text>
            </View>
          ))}
          {plans.slice(0, 2).map((plan) => (
            <View key={plan.id} style={[styles.prayerCard, { borderColor: palette.divider }]}>
              <Text style={{ color: palette.text, fontWeight: '600' }}>{plan.name}</Text>
              <Text style={{ color: palette.subtext, marginTop: 4 }}>{plan.days_count} days</Text>
              <KISButton title="Join plan" size="xs" variant="outline" onPress={() => enrollPlan(plan.id)} />
            </View>
          ))}
        </View>
      </View>
    </BibleSectionCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  card: { borderWidth: 2, borderRadius: 12, padding: 12, width: '47%' },
  section: { borderWidth: 2, borderRadius: 12, padding: 12, marginTop: 12 },
  input: { borderWidth: 2, borderRadius: 10, padding: 10, marginTop: 8 },
  prayerCard: { borderWidth: 2, borderRadius: 12, padding: 10, gap: 4 },
});
