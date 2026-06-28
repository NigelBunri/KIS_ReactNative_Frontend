import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CrisisResources'>;

type Hotline = {
  id: string;
  name: string;
  phone: string;
  hours: string;
  country: string;
};

const COUNTRIES = ['US', 'GB', 'NG', 'ZA', 'KE', 'GH', 'AU', 'CA', 'IN'];

const CBT_EXERCISES = [
  {
    title: 'Deep Breathing',
    desc: 'Breathe in for 4 counts, hold for 4, exhale for 6. Repeat 5 times. This activates your parasympathetic nervous system.',
  },
  {
    title: 'Grounding 5-4-3-2-1',
    desc: 'Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste. Anchors you to the present moment.',
  },
  {
    title: 'Thought Challenging',
    desc: 'Identify a negative thought. Ask: Is this factual? What evidence is there against it? What would I tell a friend?',
  },
  {
    title: 'Progressive Muscle Relaxation',
    desc: 'Tense each muscle group for 5 seconds, then release. Start from toes and work upward to release physical tension.',
  },
  {
    title: 'Behavioral Activation',
    desc: 'List 3 small activities that bring you joy or a sense of accomplishment. Schedule at least one for today.',
  },
];

export default function CrisisResourcesScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [country, setCountry] = useState('US');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [hotlines, setHotlines] = useState<Hotline[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);

  const fetchHotlines = useCallback(async (c: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await getRequest(ROUTES.healthExtended.crisisHotlines, { params: { country: c } });
      if (res.success) {
        setHotlines(Array.isArray(res.data?.results ?? res.data) ? (res.data?.results ?? res.data) : []);
      } else {
        setFetchError('Could not load crisis hotlines. Please try again.');
      }
    } catch {
      setFetchError('Unable to load hotlines. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchHotlines(country); }, [fetchHotlines, country]));

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert('Error', 'Unable to make the call.')
    );
  };

  const handleCountrySelect = (c: string) => {
    setCountry(c);
    setShowCountryPicker(false);
    fetchHotlines(c);
  };

  const styles = makeStyles(palette, sp);

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={[palette.danger, palette.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <KISIcon name="arrow-left" size={22} color={palette.ivory} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Crisis Resources</Text>
          <Text style={styles.headerSub}>You are not alone. Help is available.</Text>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Country Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Country</Text>
          <TouchableOpacity
            style={styles.countryPicker}
            onPress={() => setShowCountryPicker(!showCountryPicker)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.countryText}>{country}</Text>
            <KISIcon name="chevron-down" size={18} color={palette.subtext} />
          </TouchableOpacity>

          {showCountryPicker && (
            <View style={styles.dropdownContainer}>
              {COUNTRIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.dropdownItem, c === country && styles.dropdownItemActive]}
                  onPress={() => handleCountrySelect(c)}
                >
                  <Text style={[styles.dropdownText, c === country && styles.dropdownTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Crisis Hotlines */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Crisis Hotlines</Text>
          {loading ? (
            <ActivityIndicator color={palette.danger} />
          ) : fetchError ? (
            <View style={{ alignItems: 'center', paddingVertical: 16, gap: 8 }}>
              <Text style={[styles.emptyText, { color: palette.danger }]}>{fetchError}</Text>
              <KISButton title="Retry" size="sm" variant="outline" onPress={() => fetchHotlines(country)} />
            </View>
          ) : hotlines.length === 0 ? (
            <Text style={styles.emptyText}>No hotlines listed for {country}.</Text>
          ) : (
            hotlines.map((h) => (
              <View key={h.id} style={styles.hotlineCard}>
                <View style={styles.hotlineInfo}>
                  <Text style={styles.hotlineName}>{h.name}</Text>
                  <Text style={styles.hotlinePhone}>{h.phone}</Text>
                  <Text style={styles.hotlineHours}>{h.hours}</Text>
                </View>
                <KISButton
                  title="Call"
                  variant="danger"
                  size="sm"
                  style={styles.callBtn}
                  left={<KISIcon name="phone" size={14} color={palette.ivory} />}
                  onPress={() => handleCall(h.phone)}
                />
              </View>
            ))
          )}
        </View>

        {/* CBT Exercises Accordion */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CBT Exercises</Text>
          {CBT_EXERCISES.map((ex, i) => (
            <TouchableOpacity
              key={i}
              style={styles.accordionItem}
              onPress={() => setExpandedExercise(expandedExercise === i ? null : i)}
              activeOpacity={0.8}
            >
              <View style={styles.accordionHeader}>
                <Text style={styles.accordionTitle}>{ex.title}</Text>
                <KISIcon
                  name={expandedExercise === i ? 'chevron-down' : 'chevron-right'}
                  size={18}
                  color={palette.subtext}
                />
              </View>
              {expandedExercise === i && (
                <Text style={styles.accordionBody}>{ex.desc}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, sp: number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingTop: 12,
      paddingBottom: 16,
      gap: 12,
    },
    backBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
    headerText: { flex: 1 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: palette.ivory },
    headerSub: { fontSize: 12, color: palette.ivory, opacity: 0.85, marginTop: 2 },
    content: { padding: sp, gap: 20 },
    section: { gap: 10 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: palette.text },
    countryPicker: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: palette.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.divider,
      paddingHorizontal: 14,
      minHeight: 48,
    },
    countryText: { fontSize: 15, color: palette.text, fontWeight: '500' },
    dropdownContainer: {
      backgroundColor: palette.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.divider,
      overflow: 'hidden',
    },
    dropdownItem: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
    },
    dropdownItemActive: { backgroundColor: palette.primarySoft },
    dropdownText: { fontSize: 14, color: palette.text },
    dropdownTextActive: { color: palette.primary, fontWeight: '600' },
    hotlineCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.divider,
      gap: 12,
    },
    hotlineInfo: { flex: 1, gap: 2 },
    hotlineName: { fontSize: 14, fontWeight: '600', color: palette.text },
    hotlinePhone: { fontSize: 14, color: palette.primary, fontWeight: '500' },
    hotlineHours: { fontSize: 12, color: palette.subtext },
    callBtn: { minWidth: 70 },
    emptyText: { color: palette.subtext, fontSize: 13 },
    accordionItem: {
      backgroundColor: palette.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      overflow: 'hidden',
    },
    accordionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 14,
      minHeight: 52,
    },
    accordionTitle: { fontSize: 14, fontWeight: '600', color: palette.text, flex: 1 },
    accordionBody: {
      fontSize: 14,
      color: palette.subtext,
      lineHeight: 20,
      paddingHorizontal: 14,
      paddingBottom: 14,
    },
  });
}
