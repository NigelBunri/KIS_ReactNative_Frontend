import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import type { DailyDevotional } from '@/screens/tabs/bible/useBibleData';
import BibleSectionCard from './BibleSectionCard';
import KISButton from '@/constants/KISButton';

const fallbackDaily = {
  title: 'Daily Meditation',
  passage_ref: 'Psalm 23',
  content: 'Pause and reflect on the shepherding care of God today.',
  prayer_text: 'Lord, guide me in still waters.',
};

export default function DailyDevotionsPanel({ devotionals }: { devotionals: DailyDevotional[] }) {
  const { palette } = useKISTheme();
  const [showAll, setShowAll] = useState(false);
  const top = devotionals[0];
  const list = devotionals.length ? devotionals : [{ ...fallbackDaily, id: 'daily' } as any];
  const visibleList = showAll ? list : list.slice(1, 4);

  return (
    <BibleSectionCard>
      <Text style={[styles.title, { color: palette.text }]}>Daily passages & prayers</Text>
      {top ? (
        <View style={[styles.highlight, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
          <Text style={{ color: palette.primaryStrong, fontWeight: '700' }}>{top.title}</Text>
          <Text style={{ color: palette.subtext, marginTop: 4 }}>{top.passage_ref}</Text>
          <Text style={{ color: palette.text, marginTop: 8 }}>{top.content}</Text>
          <Text style={{ color: palette.subtext, marginTop: 8 }}>{top.prayer_text}</Text>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        {visibleList.map((item) => (
          <View key={item.id} style={[styles.item, { borderColor: palette.divider }]}>
            <Text style={{ color: palette.text, fontWeight: '600' }}>{item.title}</Text>
            <Text style={{ color: palette.subtext, marginTop: 4 }}>{item.passage_ref}</Text>
          </View>
        ))}
      </View>
      {list.length > 4 ? (
        <KISButton
          title={showAll ? 'Show fewer devotionals' : 'View full devotional calendar'}
          size="sm"
          onPress={() => setShowAll((prev) => !prev)}
        />
      ) : null}
    </BibleSectionCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800' },
  highlight: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  item: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 10,
  },
});
