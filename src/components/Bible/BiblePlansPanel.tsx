import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import BibleSectionCard from './BibleSectionCard';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

type ReadingPlan = {
  id: string;
  name: string;
  description: string;
  days_count: number;
};

export default function BiblePlansPanel() {
  const { palette } = useKISTheme();
  const [plans, setPlans] = useState<ReadingPlan[]>([]);

  const loadPlans = async () => {
    const res = await getRequest(ROUTES.bible.plans, { errorMessage: 'Unable to load plans.' });
    const payload = res?.data?.results ?? res?.data ?? [];
    setPlans(Array.isArray(payload) ? payload : []);
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const enroll = async (planId: string) => {
    await postRequest(
      ROUTES.bible.planEnrollments,
      { plan: planId, start_date: new Date().toISOString().slice(0, 10) },
      { errorMessage: 'Unable to enroll in plan.' },
    );
  };

  return (
    <BibleSectionCard>
      <Text style={[styles.title, { color: palette.text }]}>Reading plans</Text>
      <View style={{ gap: 10 }}>
        {plans.map((plan) => (
          <View key={plan.id} style={[styles.planCard, { borderColor: palette.divider }]}>
            <Text style={{ color: palette.text, fontWeight: '700' }}>{plan.name}</Text>
            <Text style={{ color: palette.subtext, marginTop: 4 }}>{plan.description}</Text>
            <Text style={{ color: palette.subtext, marginTop: 4 }}>{plan.days_count} days</Text>
            <KISButton title="Start plan" size="sm" onPress={() => enroll(plan.id)} />
          </View>
        ))}
      </View>
    </BibleSectionCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800' },
  planCard: { borderWidth: 2, borderRadius: 12, padding: 12, gap: 6 },
});
