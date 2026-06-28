import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CrowdfundDetail'>;

type Campaign = {
  id: string;
  title: string;
  description?: string;
  creator_name?: string;
  target_amount: number;
  raised_amount?: number;
  currency?: string;
  deadline?: string;
  status?: string;
  updates?: Update[];
};

type Update = {
  id: string;
  message: string;
  created_at?: string;
};

export default function CrowdfundDetailScreen({ navigation, route }: Props) {
  const { campaignId } = route.params;
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getRequest(ROUTES.business.crowdfundDetail(campaignId))
        .then(res => {
          const data = res?.data ?? res;
          if (data?.id) setCampaign(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [campaignId]),
  );

  const handleContribute = async () => {
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid contribution amount.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await postRequest(ROUTES.business.crowdfundContribute(campaignId), {
        amount: num,
        is_anonymous: isAnonymous,
        message: message.trim() || undefined,
      });
      if (res?.success || res?.id || res?.data?.id) {
        Alert.alert('Contribution recorded!', 'Thank you for supporting this campaign.', [
          { text: 'OK', onPress: () => {
            setAmount('');
            setMessage('');
            setIsAnonymous(false);
          }},
        ]);
      } else {
        Alert.alert('Failed', res?.error ?? 'Could not process contribution.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to contribute.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <ActivityIndicator color={palette.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!campaign) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="arrow-back-outline" size={24} color={palette.text} />
        </Pressable>
        <View style={styles.empty}>
          <KISIcon name="trending-up-outline" size={48} color={palette.subtext} />
          <Text style={[styles.emptyText, { color: palette.subtext }]}>Campaign not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const raised = campaign.raised_amount ?? 0;
  const target = campaign.target_amount ?? 1;
  const pct = Math.min(100, Math.round((raised / target) * 100));
  const cur = campaign.currency ?? 'USD';
  const deadline = campaign.deadline
    ? new Date(campaign.deadline).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.navBar}>
          <Pressable style={styles.backBtnNav} onPress={() => navigation.goBack()} hitSlop={8}>
            <KISIcon name="arrow-back-outline" size={24} color={palette.text} />
          </Pressable>
          <Text style={styles.navTitle} numberOfLines={1}>Campaign</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Hero */}
          <View style={[styles.hero, { backgroundColor: palette.primarySoft }]}>
            <KISIcon name="trending-up" size={52} color={palette.primary} />
            <Text style={styles.heroTitle}>{campaign.title}</Text>
            {campaign.creator_name ? (
              <Text style={styles.heroCreator}>by {campaign.creator_name}</Text>
            ) : null}
          </View>

          {/* Progress */}
          <View style={styles.section}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: palette.primary }]} />
            </View>
            <View style={styles.progressRow}>
              <View>
                <Text style={[styles.raisedAmount, { color: palette.primaryStrong }]}>
                  {cur} {raised.toLocaleString()}
                </Text>
                <Text style={styles.raisedLabel}>raised</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.pct, { color: palette.primary }]}>{pct}%</Text>
                <Text style={styles.raisedLabel}>of {cur} {target.toLocaleString()}</Text>
              </View>
            </View>
            {deadline ? (
              <View style={styles.deadlineRow}>
                <KISIcon name="calendar-outline" size={14} color={palette.subtext} />
                <Text style={styles.deadlineText}>Ends {deadline}</Text>
              </View>
            ) : null}
          </View>

          {/* Description */}
          {campaign.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this campaign</Text>
              <Text style={styles.body}>{campaign.description}</Text>
            </View>
          ) : null}

          {/* Contribute */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Make a Contribution</Text>

            <Text style={styles.label}>Amount ({cur})</Text>
            <TextInput
              style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.divider, color: palette.text }]}
              placeholder="0.00"
              placeholderTextColor={palette.subtext}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />

            <View style={styles.toggleRow}>
              <Text style={[styles.label, { marginBottom: 0 }]}>Contribute anonymously</Text>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ true: palette.primary }}
                thumbColor={isAnonymous ? palette.gold : palette.subtext}
              />
            </View>

            <Text style={[styles.label, { marginTop: 14 }]}>Message (optional)</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: palette.surface, borderColor: palette.divider, color: palette.text }]}
              placeholder="Leave a message of support..."
              placeholderTextColor={palette.subtext}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <KISButton
              title="Contribute Now"
              loading={submitting}
              onPress={handleContribute}
              style={{ marginTop: 16 }}
            />
          </View>

          {/* Updates Timeline */}
          {campaign.updates && campaign.updates.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Updates</Text>
              {campaign.updates.map((u, i) => (
                <View key={u.id} style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { backgroundColor: i === 0 ? palette.primary : palette.divider }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.updateMsg}>{u.message}</Text>
                    {u.created_at ? (
                      <Text style={styles.updateDate}>
                        {new Date(u.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    backBtnNav: { width: 40, height: 44, justifyContent: 'center' },
    navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: palette.text },
    scroll: { paddingBottom: 80 },
    hero: {
      alignItems: 'center',
      paddingVertical: 32,
      paddingHorizontal: sp,
    },
    heroTitle: { fontSize: 22, fontWeight: '800', color: palette.text, textAlign: 'center', marginTop: 12 },
    heroCreator: { fontSize: 14, color: palette.subtext, marginTop: 4 },
    section: {
      paddingHorizontal: sp,
      paddingTop: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    progressTrack: {
      height: 10,
      borderRadius: 5,
      backgroundColor: palette.surface,
      overflow: 'hidden',
      marginBottom: 10,
    },
    progressFill: { height: 10, borderRadius: 5 },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    raisedAmount: { fontSize: 20, fontWeight: '800' },
    raisedLabel: { fontSize: 13, color: palette.subtext },
    pct: { fontSize: 20, fontWeight: '800' },
    deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
    deadlineText: { fontSize: 13, color: palette.subtext },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: palette.text, marginBottom: 10 },
    body: { fontSize: 15, lineHeight: 23, color: palette.text },
    label: { fontSize: 14, fontWeight: '600', color: palette.text, marginBottom: 6 },
    input: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 15, minHeight: 44 },
    textArea: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 15, minHeight: 90 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
    timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
    updateMsg: { fontSize: 14, color: palette.text, lineHeight: 20 },
    updateDate: { fontSize: 12, color: palette.subtext, marginTop: 2 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyText: { fontSize: 16, fontWeight: '500' },
    backBtn: { width: 40, height: 44, justifyContent: 'center', marginLeft: sp },
  });
}
