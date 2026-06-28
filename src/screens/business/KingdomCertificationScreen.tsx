import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import LinearGradient from 'react-native-linear-gradient';
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

type Props = NativeStackScreenProps<RootStackParamList, 'KingdomCertification'>;

const BUSINESS_TYPES = [
  'Sole Trader', 'Partnership', 'LLC / Ltd', 'Non-Profit', 'Cooperative',
  'Social Enterprise', 'Ministry / Church', 'Other',
];

type Certification = {
  id: string;
  business_name?: string;
  type?: string;
  score?: number;
  valid_until?: string;
  is_active?: boolean;
  issued_at?: string;
};

type VerifyResult = {
  found: boolean;
  business_name?: string;
  certification?: Certification;
};

export default function KingdomCertificationScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [myCert, setMyCert] = useState<Certification | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0]);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifyName, setVerifyName] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getRequest(ROUTES.business.certifications)
        .then(res => {
          const data = res?.data ?? res;
          if (data?.id) setMyCert(data);
          else if (Array.isArray(data) && data.length > 0) setMyCert(data[0]);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, []),
  );

  const handleApply = async () => {
    if (!businessName.trim()) {
      Alert.alert('Required', 'Business name is required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await postRequest(ROUTES.business.certifications, {
        business_name: businessName.trim(),
        business_type: businessType,
      });
      if (res?.success || res?.id || res?.data?.id) {
        Alert.alert('Application submitted!', 'Your certification application is under review.');
        setBusinessName('');
      } else {
        Alert.alert('Failed', res?.error ?? 'Could not submit application.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to apply.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyName.trim()) {
      Alert.alert('Required', 'Enter a business name to verify.');
      return;
    }
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await getRequest(`${ROUTES.business.certificationVerify}?business_name=${encodeURIComponent(verifyName.trim())}`);
      const data = res?.data ?? res;
      setVerifyResult(data ?? { found: false });
    } catch {
      setVerifyResult({ found: false });
    } finally {
      setVerifying(false);
    }
  };

  const validUntil = myCert?.valid_until
    ? new Date(myCert.valid_until).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.navBar}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <KISIcon name="arrow-back-outline" size={24} color={palette.text} />
          </Pressable>
          <Text style={styles.navTitle}>Kingdom Certification</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* My Certification Card */}
          {loading ? (
            <ActivityIndicator color={palette.primary} style={{ marginTop: 24 }} />
          ) : myCert ? (
            <LinearGradient
              colors={[palette.goldGradientStart, palette.goldGradientMid, palette.goldGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.certCard}
            >
              <View style={styles.certRow}>
                <KISIcon name="ribbon" size={36} color={palette.ivory} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.certBizName, { color: palette.ivory }]}>{myCert.business_name}</Text>
                  {myCert.type ? (
                    <Text style={[styles.certType, { color: palette.ivory }]}>{myCert.type}</Text>
                  ) : null}
                </View>
                {myCert.is_active ? (
                  <View style={[styles.activeBadge, { backgroundColor: palette.success }]}>
                    <Text style={[styles.activeBadgeText, { color: palette.ivory }]}>Active</Text>
                  </View>
                ) : null}
              </View>
              {myCert.score != null ? (
                <View style={styles.scoreRow}>
                  <Text style={[styles.scoreLabel, { color: palette.ivory }]}>Kingdom Score</Text>
                  <Text style={[styles.scoreValue, { color: palette.ivory }]}>{myCert.score}/100</Text>
                </View>
              ) : null}
              {validUntil ? (
                <Text style={[styles.certExpiry, { color: palette.ivory }]}>Valid until {validUntil}</Text>
              ) : null}
            </LinearGradient>
          ) : null}

          {/* Apply Form */}
          {!myCert && !loading ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Apply for Certification</Text>

              <Text style={styles.label}>Business Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Your business or ministry name"
                placeholderTextColor={palette.subtext}
                value={businessName}
                onChangeText={setBusinessName}
              />

              <Text style={[styles.label, { marginTop: 14 }]}>Business Type</Text>
              <Pressable
                style={styles.selectorBtn}
                onPress={() => setShowTypePicker(!showTypePicker)}
              >
                <Text style={[styles.selectorText, { color: palette.text }]}>{businessType}</Text>
                <KISIcon name="chevron-down-outline" size={16} color={palette.subtext} />
              </Pressable>
              {showTypePicker ? (
                <View style={styles.pickerDropdown}>
                  {BUSINESS_TYPES.map(t => (
                    <Pressable
                      key={t}
                      style={[styles.pickerItem, t === businessType && { backgroundColor: palette.primarySoft }]}
                      onPress={() => { setBusinessType(t); setShowTypePicker(false); }}
                    >
                      <Text style={[styles.pickerItemText, { color: t === businessType ? palette.primary : palette.text }]}>{t}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <KISButton
                title="Submit Application"
                loading={submitting}
                onPress={handleApply}
                style={{ marginTop: 20 }}
              />
            </View>
          ) : null}

          {/* Verify a Business */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Verify a Business</Text>
            <Text style={[styles.sectionSub, { color: palette.subtext }]}>
              Check if a business holds valid Kingdom Certification.
            </Text>

            <View style={styles.verifyRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Business name..."
                placeholderTextColor={palette.subtext}
                value={verifyName}
                onChangeText={setVerifyName}
                returnKeyType="search"
                onSubmitEditing={handleVerify}
              />
              <Pressable
                style={[styles.verifyBtn, { backgroundColor: palette.primary }]}
                onPress={handleVerify}
                disabled={verifying}
                hitSlop={6}
              >
                {verifying ? (
                  <ActivityIndicator color={palette.ivory} size="small" />
                ) : (
                  <KISIcon name="search-outline" size={20} color={palette.ivory} />
                )}
              </Pressable>
            </View>

            {verifyResult ? (
              <View style={[
                styles.verifyResult,
                { borderColor: verifyResult.found ? palette.success : palette.danger },
              ]}>
                <KISIcon
                  name={verifyResult.found ? 'checkmark-circle-outline' : 'close-circle-outline'}
                  size={22}
                  color={verifyResult.found ? palette.success : palette.danger}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.verifyResultTitle, { color: verifyResult.found ? palette.success : palette.danger }]}>
                    {verifyResult.found ? 'Verified Kingdom Business' : 'Not Certified'}
                  </Text>
                  {verifyResult.found && verifyResult.certification ? (
                    <>
                      <Text style={[styles.verifyDetail, { color: palette.subtext }]}>
                        {verifyResult.certification.business_name}
                      </Text>
                      {verifyResult.certification.score != null ? (
                        <Text style={[styles.verifyDetail, { color: palette.subtext }]}>
                          Score: {verifyResult.certification.score}/100
                        </Text>
                      ) : null}
                    </>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
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
    backBtn: { width: 40, height: 44, justifyContent: 'center' },
    navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: palette.text },
    scroll: { paddingBottom: 80 },
    certCard: {
      marginHorizontal: sp,
      marginTop: 20,
      borderRadius: 18,
      padding: 20,
    },
    certRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    certBizName: { fontSize: 18, fontWeight: '800' },
    certType: { fontSize: 13, opacity: 0.85, marginTop: 2 },
    activeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    activeBadgeText: { fontSize: 12, fontWeight: '700' },
    scoreRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    scoreLabel: { fontSize: 14 },
    scoreValue: { fontSize: 22, fontWeight: '800' },
    certExpiry: { fontSize: 13, opacity: 0.8 },
    section: {
      paddingHorizontal: sp,
      paddingTop: 24,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: palette.text, marginBottom: 6 },
    sectionSub: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
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
      elevation: 3,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      overflow: 'hidden',
    },
    pickerItem: { paddingHorizontal: 16, paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
    pickerItemText: { fontSize: 14, fontWeight: '500' },
    verifyRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    verifyBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    verifyResult: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginTop: 14,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      backgroundColor: palette.surface,
    },
    verifyResultTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
    verifyDetail: { fontSize: 13 },
  });
}
