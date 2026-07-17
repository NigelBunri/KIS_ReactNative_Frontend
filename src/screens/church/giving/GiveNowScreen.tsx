import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
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
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'GiveNow'>;

const GIVING_TYPES = [
  { value: 'tithe', label: 'Tithe' },
  { value: 'offering', label: 'Offering' },
  { value: 'pledge', label: 'Pledge' },
  { value: 'special', label: 'Special Gift' },
];

type Campaign = { id: string; title: string };

export default function GiveNowScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('tithe');
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useEffect(() => {
    getRequest(ROUTES.church.campaigns)
      .then(res => {
        if (res?.success) {
          const raw = res.data;
          setCampaigns(Array.isArray(raw) ? raw : raw?.results ?? []);
        }
      })
      .catch(() => {});
  }, []);

  const validate = useCallback(() => {
    const parsed = parseFloat(amount);
    if (!amount.trim() || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return false;
    }
    return true;
  }, [amount]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await postRequest(ROUTES.church.giving, {
        amount: parseFloat(amount),
        type,
        campaign: campaignId,
        is_anonymous: isAnonymous,
      });
      if (res?.success) {
        Alert.alert('Thank You!', 'Your gift has been recorded.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', res?.message ?? 'Something went wrong. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [amount, type, campaignId, isAnonymous, navigation, validate]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Give Now</Text>
          <Text style={styles.subtitle}>Support your church with a financial gift.</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Amount</Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={palette.subtext}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Giving Type</Text>
            <View style={styles.pickerRow}>
              {GIVING_TYPES.map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeChip, type === t.value && styles.typeChipActive]}
                  onPress={() => setType(t.value)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                >
                  <Text style={[styles.typeChipText, type === t.value && styles.typeChipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Campaign (optional)</Text>
            <View style={styles.campaignList}>
              <TouchableOpacity
                style={[styles.campaignOption, campaignId === null && styles.campaignOptionActive]}
                onPress={() => setCampaignId(null)}
                hitSlop={{ top: 4, bottom: 4 }}
              >
                <Text style={[styles.campaignOptionText, campaignId === null && styles.campaignOptionTextActive]}>
                  General Fund
                </Text>
              </TouchableOpacity>
              {campaigns.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.campaignOption, campaignId === c.id && styles.campaignOptionActive]}
                  onPress={() => setCampaignId(c.id)}
                  hitSlop={{ top: 4, bottom: 4 }}
                >
                  <Text style={[styles.campaignOptionText, campaignId === c.id && styles.campaignOptionTextActive]}>
                    {c.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>Give Anonymously</Text>
              <Text style={styles.toggleSub}>Your name will not appear in records</Text>
            </View>
            <Switch
              value={isAnonymous}
              onValueChange={setIsAnonymous}
              trackColor={{ false: palette.divider, true: palette.primary }}
              thumbColor={palette.ivory}
            />
          </View>

          <KISButton
            title={submitting ? 'Processing...' : 'Submit Gift'}
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
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
    fieldGroup: { marginBottom: 20 },
    label: { fontSize: 13, fontWeight: '600', color: palette.subtext, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      paddingHorizontal: 14,
      minHeight: 52,
    },
    currencySymbol: { fontSize: 22, fontWeight: '600', color: palette.primary, marginRight: 8 },
    amountInput: {
      flex: 1,
      fontSize: 22,
      fontWeight: '600',
      color: palette.text,
      paddingVertical: 12,
    },
    pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: palette.divider,
      backgroundColor: palette.surface,
      minHeight: 44,
      justifyContent: 'center',
    },
    typeChipActive: { backgroundColor: palette.primary, borderColor: palette.primary },
    typeChipText: { fontSize: 14, color: palette.subtext },
    typeChipTextActive: { color: palette.ivory, fontWeight: '600' },
    campaignList: { gap: 8 },
    campaignOption: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.divider,
      backgroundColor: palette.surface,
      minHeight: 44,
      justifyContent: 'center',
    },
    campaignOptionActive: { backgroundColor: palette.primarySoft, borderColor: palette.primary },
    campaignOptionText: { fontSize: 14, color: palette.text },
    campaignOptionTextActive: { color: palette.primaryStrong, fontWeight: '600' },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: palette.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 28,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
    },
    toggleLabel: { fontSize: 15, fontWeight: '600', color: palette.text },
    toggleSub: { fontSize: 12, color: palette.subtext, marginTop: 2 },
    submitBtn: { minHeight: 52 },
  });
}
