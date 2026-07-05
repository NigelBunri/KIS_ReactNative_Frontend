import React, { useMemo, useState } from 'react';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateCampaign'>;

const CURRENCIES = ['USD', 'GBP', 'EUR', 'NGN', 'GHS', 'KES', 'ZAR', 'CAD', 'AUD'];
const CATEGORIES = ['Business', 'Ministry', 'Education', 'Community', 'Health', 'Technology', 'Other'];

export default function CreateCampaignScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [deadline, setDeadline] = useState('');
  const [category, setCategory] = useState('Business');
  const [submitting, setSubmitting] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert('Required', 'Campaign title is required.'); return; }
    if (!description.trim()) { Alert.alert('Required', 'Description is required.'); return; }
    const amount = parseFloat(targetAmount);
    if (!targetAmount || isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid target amount.');
      return;
    }
    if (!deadline.trim()) { Alert.alert('Required', 'Please enter a deadline (YYYY-MM-DD).'); return; }

    setSubmitting(true);
    try {
      const res = await postRequest(ROUTES.business.crowdfund, {
        title: title.trim(),
        description: description.trim(),
        target_amount: amount,
        currency,
        deadline: deadline.trim(),
        category: category.toLowerCase(),
      });
      const created = res?.data ?? res;
      if (created?.id) {
        navigation.replace('CrowdfundDetail', { campaignId: created.id });
      } else {
        Alert.alert('Created!', 'Your campaign has been submitted for review.');
        navigation.goBack();
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.navBar}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <KISIcon name="arrow-back-outline" size={24} color={palette.text} />
          </Pressable>
          <Text style={styles.navTitle}>Create Campaign</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <Text style={styles.label}>Campaign Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Kingdom Tech Startup Fund"
              placeholderTextColor={palette.subtext}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={[styles.label, { marginTop: 16 }]}>Description *</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe your campaign, its mission and impact..."
              placeholderTextColor={palette.subtext}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            <Text style={[styles.label, { marginTop: 16 }]}>Target Amount *</Text>
            <View style={styles.amountRow}>
              <Pressable
                style={styles.currencyBtn}
                onPress={() => { setShowCurrencyPicker(!showCurrencyPicker); setShowCategoryPicker(false); }}
              >
                <Text style={[styles.currencyText, { color: palette.primary }]}>{currency}</Text>
                <KISIcon name="chevron-down-outline" size={14} color={palette.primary} />
              </Pressable>
              <TextInput
                style={[styles.input, { flex: 1, marginLeft: 8 }]}
                placeholder="0.00"
                placeholderTextColor={palette.subtext}
                value={targetAmount}
                onChangeText={setTargetAmount}
                keyboardType="decimal-pad"
              />
            </View>
            {showCurrencyPicker ? (
              <View style={styles.pickerDropdown}>
                {CURRENCIES.map(c => (
                  <Pressable
                    key={c}
                    style={[styles.pickerItem, c === currency && { backgroundColor: palette.primarySoft }]}
                    onPress={() => { setCurrency(c); setShowCurrencyPicker(false); }}
                  >
                    <Text style={[styles.pickerItemText, { color: c === currency ? palette.primary : palette.text }]}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Text style={[styles.label, { marginTop: 16 }]}>Deadline (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.input}
              placeholder="2025-12-31"
              placeholderTextColor={palette.subtext}
              value={deadline}
              onChangeText={setDeadline}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={[styles.label, { marginTop: 16 }]}>Category</Text>
            <Pressable
              style={styles.selectorBtn}
              onPress={() => { setShowCategoryPicker(!showCategoryPicker); setShowCurrencyPicker(false); }}
            >
              <Text style={[styles.selectorText, { color: palette.text }]}>{category}</Text>
              <KISIcon name="chevron-down-outline" size={16} color={palette.subtext} />
            </Pressable>
            {showCategoryPicker ? (
              <View style={styles.pickerDropdown}>
                {CATEGORIES.map(cat => (
                  <Pressable
                    key={cat}
                    style={[styles.pickerItem, cat === category && { backgroundColor: palette.primarySoft }]}
                    onPress={() => { setCategory(cat); setShowCategoryPicker(false); }}
                  >
                    <Text style={[styles.pickerItemText, { color: cat === category ? palette.primary : palette.text }]}>{cat}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <KISButton
              title="Launch Campaign"
              loading={submitting}
              onPress={handleCreate}
              style={{ marginTop: 28 }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, marginTop: 25 },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    backBtn: { width: 40, height: 44, justifyContent: 'center' },
    navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: palette.text },
    scroll: { paddingBottom: 80 },
    form: { paddingHorizontal: sp, paddingTop: 20 },
    label: { fontSize: 14, fontWeight: '600', color: palette.text, marginBottom: 6 },
    input: {
      backgroundColor: palette.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      padding: 12,
      fontSize: 15,
      color: palette.text,
      minHeight: 44,
    },
    textArea: {
      backgroundColor: palette.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      padding: 12,
      fontSize: 15,
      color: palette.text,
      minHeight: 110,
    },
    amountRow: { flexDirection: 'row', alignItems: 'center' },
    currencyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: palette.primarySoft,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 44,
    },
    currencyText: { fontSize: 14, fontWeight: '700' },
    selectorBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: palette.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      paddingHorizontal: 12,
      height: 44,
    },
    selectorText: { fontSize: 15 },
    pickerDropdown: {
      backgroundColor: palette.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      marginTop: 4,
      overflow: 'hidden',
      elevation: 3,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
    },
    pickerItem: { paddingHorizontal: 16, paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
    pickerItemText: { fontSize: 14, fontWeight: '500' },
  });
}
