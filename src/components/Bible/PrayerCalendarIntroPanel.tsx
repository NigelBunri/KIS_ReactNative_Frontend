// src/components/Bible/PrayerCalendarIntroPanel.tsx
// Replaces the old PrayerPanel (a read-only KCAN monthly prayer-points
// calendar — an unrelated, different concept) as the Bible tab's "Prayer
// Calendar" content. This is deliberately a brief, welcoming intro, not
// the feature itself — "Enter Prayer Calendar" pushes the real 24-watch
// experience (PrayerCalendarHomeScreen) as its own full-screen flow,
// matching the spec's own "should not feel like a sermon or marketing
// page" instruction for this specific panel.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';

export default function PrayerCalendarIntroPanel({ onEnter }: { onEnter: () => void }) {
  const { palette } = useKISTheme();

  return (
    <View style={s.root}>
      <View style={[s.iconWrap, { backgroundColor: `${palette.primary}1A` }]}>
        <KISIcon name="heart" size={32} color={palette.primary} />
      </View>
      <Text style={[s.title, { color: palette.text }]}>Prayer Calendar — A Global Prayer Room</Text>
      <Text style={[s.verse, { color: palette.subtext }]}>
        "Men ought always to pray, and not to faint." — Luke 18:1
      </Text>
      <Text style={[s.body, { color: palette.text }]}>
        Prayer should never stop. Prayer Calendar brings people together from around the world in 24
        daily prayer watches, creating a continuous, year-round atmosphere of prayer.
      </Text>
      <Text style={[s.body, { color: palette.subtext }]}>
        Join a prayer watch, submit a prayer point, or volunteer to lead. Wherever you are, there is a
        place for you to pray.
      </Text>
      <KISButton title="Enter Prayer Calendar" onPress={onEnter} style={{ marginTop: 16, alignSelf: 'stretch' }} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { alignItems: 'center', padding: 24, gap: 10 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontSize: 19, fontWeight: '900', textAlign: 'center' },
  verse: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginBottom: 4 },
  body: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
