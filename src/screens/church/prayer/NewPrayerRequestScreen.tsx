import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'NewPrayerRequest'>;

type Privacy = 'public' | 'anonymous' | 'leaders_only';

const PRIVACY_OPTIONS: { value: Privacy; label: string; desc: string }[] = [
  { value: 'public', label: 'Public', desc: 'Visible to all church members' },
  { value: 'anonymous', label: 'Anonymous', desc: 'Your name will not be shown' },
  { value: 'leaders_only', label: 'Leaders Only', desc: 'Only visible to church leaders' },
];

const CATEGORIES = ['Faith', 'Family', 'Health', 'Finances', 'Relationships', 'Work', 'Grief', 'Other'];

export default function NewPrayerRequestScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [text, setText] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('public');
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) {
      Alert.alert('Required', 'Please enter your prayer request.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await postRequest(ROUTES.church.prayerRequests, {
        text: text.trim(),
        privacy,
        category: category || undefined,
      });
      if (res?.success) {
        Alert.alert(
          'Prayer Request Submitted',
          'Your request has been added to the prayer wall.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      } else {
        Alert.alert('Error', res?.message ?? 'Could not submit prayer request.');
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [text, privacy, category, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>New Prayer Request</Text>
          <Text style={styles.subtitle}>Share your heart with your church community.</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Your Prayer Request</Text>
            <TextInput
              style={styles.textArea}
              value={text}
              onChangeText={setText}
              placeholder="What would you like the church to pray for?"
              placeholderTextColor={palette.subtext}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Category (optional)</Text>
            <View style={styles.chipGrid}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, category === cat && styles.chipActive]}
                  onPress={() => setCategory(prev => prev === cat ? '' : cat)}
                  hitSlop={{ top: 4, bottom: 4 }}
                >
                  <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Privacy</Text>
            {PRIVACY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.privacyOption, privacy === opt.value && styles.privacyOptionActive]}
                onPress={() => setPrivacy(opt.value)}
                hitSlop={{ top: 4, bottom: 4 }}
              >
                <View style={styles.privacyRadio}>
                  {privacy === opt.value && <View style={styles.privacyRadioDot} />}
                </View>
                <View style={styles.privacyMeta}>
                  <Text style={styles.privacyLabel}>{opt.label}</Text>
                  <Text style={styles.privacyDesc}>{opt.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <KISButton
            title={submitting ? 'Submitting...' : 'Submit Prayer Request'}
            loading={submitting}
            disabled={submitting}
            onPress={handleSubmit}
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
    scroll: { padding: sp, paddingBottom: 80 },
    title: { fontSize: 26, fontWeight: '700', color: palette.text, marginBottom: 6 },
    subtitle: { fontSize: 14, color: palette.subtext, marginBottom: 24 },
    fieldGroup: { marginBottom: 22 },
    label: { fontSize: 13, fontWeight: '600', color: palette.subtext, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    textArea: {
      backgroundColor: palette.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      padding: 14,
      fontSize: 15,
      color: palette.text,
      minHeight: 120,
    },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
      minHeight: 36,
      justifyContent: 'center',
    },
    chipActive: { backgroundColor: palette.primary, borderColor: palette.primary },
    chipText: { fontSize: 13, color: palette.subtext },
    chipTextActive: { color: palette.ivory, fontWeight: '600' },
    privacyOption: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      padding: 12,
      marginBottom: 8,
      minHeight: 56,
    },
    privacyOptionActive: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
    privacyRadio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: palette.divider,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    privacyRadioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: palette.primary,
    },
    privacyMeta: { flex: 1 },
    privacyLabel: { fontSize: 14, fontWeight: '600', color: palette.text },
    privacyDesc: { fontSize: 12, color: palette.subtext, marginTop: 2 },
    submitBtn: { minHeight: 52 },
  });
}
