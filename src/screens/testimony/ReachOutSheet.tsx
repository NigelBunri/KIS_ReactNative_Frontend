import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import { useProfileController } from '@/screens/tabs/profile/useProfileController';
import { useAuth } from '../../../App';

const CATEGORY_LABELS: Record<string, string> = {
  health: 'Health & Medical',
  finances: 'Financial Hardship',
  relationships: 'Relationships & Marriage',
  faith: 'Faith & Spirituality',
  business: 'Business & Career',
  grief: 'Loss & Grief',
  addiction: 'Addiction & Recovery',
  family: 'Family & Parenting',
  mental_health: 'Mental Health',
  other: 'Other',
};
const CATEGORY_EMOJI: Record<string, string> = {
  health: '🏥',
  finances: '💰',
  relationships: '💑',
  faith: '🙏',
  business: '💼',
  grief: '🕊️',
  addiction: '🌱',
  family: '👨‍👩‍👧',
  mental_health: '🧠',
  other: '💙',
};

export default function ReachOutSheet() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ReachOutSheet'>>();
  const { seasonId, seasonTitle, seasonCategory } = route.params;
  const { setAuth, setPhone, callingCode } = useAuth();
  const c = useProfileController({ setAuth, setPhone, locationCallingCode: callingCode });
  const currentUserId = useMemo(() => {
    const uid = c.profile?.user?.id;
    return uid ? String(uid) : null;
  }, [c.profile?.user?.id]);

  const [testimonies, setTestimonies] = useState<any[]>([]);
  const [selectedTestimonyId, setSelectedTestimonyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const styles = useMemo(() => makeStyles(palette), [palette]);

  const matchingTestimonies = useMemo(
    () => testimonies.filter(t => t?.category === seasonCategory),
    [testimonies, seasonCategory],
  );

  useEffect(() => {
    if (!currentUserId) return;
    getRequest(ROUTES.testimony.testimonies, { params: { user_id: currentUserId } })
      .then(res => {
        if (res?.success) {
          const data = res.data;
          const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
          setTestimonies(list);
        }
      })
      .catch(() => {});
  }, [currentUserId]);

  const handleSend = useCallback(async () => {
    if (!selectedTestimonyId) return;
    setSubmitting(true);
    try {
      const res = await postRequest(ROUTES.testimony.reach, {
        season_id: seasonId,
        testimony_id: selectedTestimonyId,
        message: message.trim(),
      });
      if (res?.success) {
        Alert.alert(
          'Sent! 🙏',
          "They'll be notified that someone who's been there wants to connect.",
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      } else {
        Alert.alert('Error', res?.message ?? 'Unable to send reach-out.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Unable to send reach-out.');
    } finally {
      setSubmitting(false);
    }
  }, [selectedTestimonyId, seasonId, message, navigation]);

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: palette.bg }]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        style={{ backgroundColor: palette.bg }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Reach Out</Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <KISIcon name="close" size={22} color={palette.text} />
          </Pressable>
        </View>

        <View style={[styles.infoCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.infoLabel, { color: palette.subtext }]}>You're responding to:</Text>
          <Text style={[styles.infoTitle, { color: palette.text }]}>{seasonTitle}</Text>
          <View style={[styles.categoryChip, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.categoryChipText, { color: palette.subtext }]}>
              {CATEGORY_EMOJI[seasonCategory] ?? '💙'} {CATEGORY_LABELS[seasonCategory] ?? seasonCategory}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: palette.text }]}>Your testimony</Text>

        {matchingTestimonies.length === 0 ? (
          <View style={[styles.noTestimonyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.noTestimonyText, { color: palette.subtext }]}>
              You haven't shared a testimony in '{CATEGORY_LABELS[seasonCategory] ?? seasonCategory}' yet.
            </Text>
            <Pressable
              onPress={() => {
                // Replace this sheet with DeclareTestimonySheet so the user
                // can go back to the reach-out flow after sharing their story.
                navigation.navigate('DeclareTestimonySheet', {});
              }}
              style={[styles.shareFirstBtn, { borderColor: palette.primary }]}
            >
              <Text style={[styles.shareFirstBtnText, { color: palette.primary }]}>Share one first</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {matchingTestimonies.map(t => {
              const isSelected = selectedTestimonyId === String(t.id);
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setSelectedTestimonyId(String(t.id))}
                  style={[
                    styles.testimonyCard,
                    {
                      backgroundColor: palette.card,
                      borderColor: isSelected ? palette.primary : palette.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.testimonyTitle, { color: palette.text }]}>{t.title}</Text>
                  {t.story ? (
                    <Text style={[styles.testimonySnippet, { color: palette.subtext }]} numberOfLines={2}>
                      {t.story}
                    </Text>
                  ) : null}
                  {isSelected && (
                    <View style={[styles.selectedBadge, { backgroundColor: palette.primary }]}>
                      <KISIcon name="check" size={12} color={palette.onPrimary} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={[styles.sectionLabel, { color: palette.text, marginTop: 20 }]}>Your message (optional)</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Share briefly what you overcame and how you'd like to help..."
          placeholderTextColor={palette.subtext}
          multiline
          numberOfLines={4}
          style={[
            styles.messageInput,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              color: palette.text,
            },
          ]}
          textAlignVertical="top"
        />

        <Pressable
          disabled={!selectedTestimonyId || submitting}
          onPress={handleSend}
          style={[
            styles.sendBtn,
            {
              backgroundColor: selectedTestimonyId ? palette.primaryStrong : palette.divider,
            },
          ]}
        >
          <Text style={styles.sendBtnText}>{submitting ? 'Sending...' : 'Send Reach-Out'}</Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any) {
  return StyleSheet.create({
    content: { paddingHorizontal: 16, paddingBottom: 60, gap: 12 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 4 },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    infoCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
    infoLabel: { fontSize: 12 },
    infoTitle: { fontSize: 16, fontWeight: '700' },
    categoryChip: { alignSelf: 'flex-start', borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
    categoryChipText: { fontSize: 13 },
    sectionLabel: { fontSize: 15, fontWeight: '700' },
    noTestimonyCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12, alignItems: 'center' },
    noTestimonyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    shareFirstBtn: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    shareFirstBtnText: { fontSize: 14, fontWeight: '600' },
    testimonyCard: { borderRadius: 14, padding: 14, gap: 6, position: 'relative' },
    testimonyTitle: { fontSize: 15, fontWeight: '700' },
    testimonySnippet: { fontSize: 13, lineHeight: 18 },
    selectedBadge: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    messageInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, minHeight: 100, lineHeight: 20 },
    sendBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
    sendBtnText: { color: palette.onPrimary, fontWeight: '800', fontSize: 16 },
  });
}
