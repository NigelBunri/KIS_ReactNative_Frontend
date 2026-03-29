import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import BibleSectionCard from './BibleSectionCard';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

type Prayer = {
  id: string;
  title: string;
  content: string;
  answered: boolean;
};

export default function PrayerPanel() {
  const { palette } = useKISTheme();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [prayers, setPrayers] = useState<Prayer[]>([]);

  const loadPrayers = async () => {
    const res = await getRequest(ROUTES.bible.prayers, { errorMessage: 'Unable to load prayers.' });
    const payload = res?.data?.results ?? res?.data ?? [];
    setPrayers(Array.isArray(payload) ? payload : []);
  };

  useEffect(() => {
    loadPrayers();
  }, []);

  const addPrayer = async () => {
    if (!title || !content) return;
    const res = await postRequest(
      ROUTES.bible.prayers,
      { title, content },
      { errorMessage: 'Unable to save prayer.' },
    );
    if (res?.success) {
      setTitle('');
      setContent('');
      loadPrayers();
    }
  };

  return (
    <BibleSectionCard>
      <Text style={[styles.title, { color: palette.text }]}>Prayer requests</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Prayer title"
        placeholderTextColor={palette.subtext}
        style={[styles.input, { borderColor: palette.divider, color: palette.text }]}
      />
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="Write your prayer request"
        placeholderTextColor={palette.subtext}
        style={[styles.input, { borderColor: palette.divider, color: palette.text, minHeight: 70 }]}
        multiline
      />
      <KISButton title="Add prayer" size="sm" onPress={addPrayer} />

      <View style={{ gap: 10 }}>
        {prayers.slice(0, 4).map((prayer) => (
          <View key={prayer.id} style={[styles.prayerCard, { borderColor: palette.divider }]}>
            <Text style={{ color: palette.text, fontWeight: '600' }}>{prayer.title}</Text>
            <Text style={{ color: palette.subtext, marginTop: 4 }}>{prayer.content}</Text>
          </View>
        ))}
      </View>
    </BibleSectionCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800' },
  input: { borderWidth: 2, borderRadius: 10, padding: 10 },
  prayerCard: { borderWidth: 2, borderRadius: 12, padding: 12 },
});
