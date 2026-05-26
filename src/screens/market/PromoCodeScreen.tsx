import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useNavigation } from '@react-navigation/native';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

type PromoCode = {
  id?: string;
  code: string;
  discount_type?: 'percentage' | 'fixed' | string;
  discount_value?: number;
  discount_amount?: number;
  discount_percent?: number;
  expiry_date?: string;
  expires_at?: string;
  valid_until?: string;
  description?: string;
  minimum_order?: number;
  is_redeemed?: boolean;
  redeemed_at?: string;
  status?: string;
};

const formatDate = (value?: string) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

const formatDiscount = (code: PromoCode): string => {
  const pct =
    code.discount_type === 'percentage'
      ? code.discount_value
      : code.discount_percent;
  if (pct) return `${pct}% off`;

  const fixed =
    code.discount_type === 'fixed'
      ? code.discount_value
      : code.discount_amount;
  if (fixed) return `-${fixed}`;

  if (code.description) return code.description;
  return 'Discount applied';
};

const getExpiry = (code: PromoCode) =>
  code.expiry_date ?? code.expires_at ?? code.valid_until;

const normalizeRedeemedList = (payload: any): PromoCode[] => {
  const source = payload?.data ?? payload ?? {};
  const results = source?.results ?? source;
  if (!Array.isArray(results)) return [];
  return results.map((item: any) => ({
    id: String(item?.id ?? ''),
    code: item?.code ?? '',
    discount_type: item?.discount_type,
    discount_value: item?.discount_value,
    discount_amount: item?.discount_amount,
    discount_percent: item?.discount_percent,
    expiry_date: item?.expiry_date,
    expires_at: item?.expires_at,
    valid_until: item?.valid_until,
    description: item?.description,
    minimum_order: item?.minimum_order,
    is_redeemed: item?.is_redeemed,
    redeemed_at: item?.redeemed_at,
    status: item?.status,
  }));
};

export default function PromoCodeScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();

  const [codeInput, setCodeInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [validatedCode, setValidatedCode] = useState<PromoCode | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [redeeming, setRedeeming] = useState(false);

  const [redeemedCodes, setRedeemedCodes] = useState<PromoCode[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const fetchRedeemedCodes = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setListLoading(true);
    }
    setListError(null);
    try {
      const response = await getRequest(ROUTES.billing.promoCodes, {
        forceNetwork: isRefresh,
        errorMessage: 'Unable to load promo codes.',
      });
      if (response?.success) {
        setRedeemedCodes(normalizeRedeemedList(response.data));
      } else {
        setListError(response?.message ?? 'Unable to load promo codes.');
      }
    } catch (err: any) {
      setListError(err?.message ?? 'Unable to load promo codes.');
    } finally {
      setListLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchRedeemedCodes();
  }, [fetchRedeemedCodes]);

  const handleRefresh = useCallback(() => {
    void fetchRedeemedCodes(true);
  }, [fetchRedeemedCodes]);

  const handleValidate = useCallback(async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code) {
      Alert.alert('Promo Code', 'Enter a promo code first.');
      return;
    }
    setValidating(true);
    setValidatedCode(null);
    setValidationError(null);
    try {
      const response = await getRequest(
        `${ROUTES.billing.promoCodes}?code=${encodeURIComponent(code)}`,
        { forceNetwork: true, errorMessage: 'Unable to validate code.' },
      );
      if (response?.success) {
        const raw = response.data;
        const result =
          raw?.data ?? (Array.isArray(raw?.results) ? raw.results[0] : null) ?? raw;
        if (result && (result.code || result.id)) {
          setValidatedCode({
            id: String(result.id ?? ''),
            code: result.code ?? code,
            discount_type: result.discount_type,
            discount_value: result.discount_value,
            discount_amount: result.discount_amount,
            discount_percent: result.discount_percent,
            expiry_date: result.expiry_date,
            expires_at: result.expires_at,
            valid_until: result.valid_until,
            description: result.description,
            minimum_order: result.minimum_order,
            status: result.status,
          });
        } else {
          setValidationError('Code not found or already used.');
        }
      } else {
        setValidationError(response?.message ?? 'Invalid promo code.');
      }
    } catch (err: any) {
      setValidationError(err?.message ?? 'Unable to validate code.');
    } finally {
      setValidating(false);
    }
  }, [codeInput]);

  const handleRedeem = useCallback(async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code) {
      Alert.alert('Promo Code', 'Enter a promo code first.');
      return;
    }
    setRedeeming(true);
    try {
      const response = await postRequest(
        ROUTES.billing.promoCodes,
        { code },
        { errorMessage: 'Unable to redeem code.' },
      );
      if (response?.success) {
        Alert.alert('Promo Code', 'Code redeemed successfully!');
        setCodeInput('');
        setValidatedCode(null);
        setValidationError(null);
        void fetchRedeemedCodes(true);
      } else {
        Alert.alert(
          'Promo Code',
          response?.message ?? 'Unable to redeem this code.',
        );
      }
    } catch (err: any) {
      Alert.alert('Promo Code', err?.message ?? 'Unable to redeem this code.');
    } finally {
      setRedeeming(false);
    }
  }, [codeInput, fetchRedeemedCodes]);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: palette.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[s.header, { borderBottomColor: palette.divider }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={s.backBtn}
          >
            <Text style={[s.backText, { color: palette.primaryStrong }]}>
              Back
            </Text>
          </Pressable>
          <Text style={[s.headerTitle, { color: palette.text }]}>
            Promo Codes
          </Text>
          <View style={s.backBtn} />
        </View>

        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={palette.primaryStrong}
            />
          }
        >
          {/* Code entry */}
          <View
            style={[
              s.entryCard,
              {
                backgroundColor: palette.surfaceElevated,
                borderColor: palette.divider,
              },
            ]}
          >
            <Text style={[s.sectionTitle, { color: palette.text }]}>
              Enter Promo Code
            </Text>
            <TextInput
              style={[
                s.codeInput,
                {
                  color: palette.text,
                  borderColor: palette.divider,
                  backgroundColor: palette.surface,
                },
              ]}
              placeholder="e.g. SAVE20"
              placeholderTextColor={palette.subtext}
              value={codeInput}
              onChangeText={text => {
                setCodeInput(text);
                setValidatedCode(null);
                setValidationError(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!validating && !redeeming}
            />
            <View style={s.btnRow}>
              <Pressable
                style={[
                  s.applyBtn,
                  {
                    backgroundColor: validating
                      ? palette.subtext
                      : palette.primaryStrong,
                    flex: 1,
                  },
                ]}
                onPress={handleValidate}
                disabled={validating || redeeming}
              >
                {validating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.btnText}>Apply</Text>
                )}
              </Pressable>
            </View>

            {validationError ? (
              <View
                style={[
                  s.errorBanner,
                  { backgroundColor: '#FEE2E2' },
                ]}
              >
                <Text style={[s.errorBannerText, { color: '#991B1B' }]}>
                  {validationError}
                </Text>
              </View>
            ) : null}

            {validatedCode ? (
              <View
                style={[
                  s.validCard,
                  { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
                ]}
              >
                <Text style={[s.validTitle, { color: '#15803D' }]}>
                  Valid code: {validatedCode.code}
                </Text>
                <Text style={[s.validDiscount, { color: '#15803D' }]}>
                  {formatDiscount(validatedCode)}
                </Text>
                {getExpiry(validatedCode) ? (
                  <Text style={[s.validMeta, { color: '#166534' }]}>
                    Expires: {formatDate(getExpiry(validatedCode))}
                  </Text>
                ) : null}
                {validatedCode.minimum_order ? (
                  <Text style={[s.validMeta, { color: '#166534' }]}>
                    Min. order: {validatedCode.minimum_order}
                  </Text>
                ) : null}
                <Pressable
                  style={[
                    s.redeemBtn,
                    {
                      backgroundColor: redeeming ? '#86EFAC' : '#16A34A',
                    },
                  ]}
                  onPress={handleRedeem}
                  disabled={redeeming}
                >
                  {redeeming ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={s.btnText}>Redeem</Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* Redeemed codes list */}
          <View>
            <Text style={[s.sectionTitle, { color: palette.text }]}>
              Redeemed Codes
            </Text>
            {listLoading && !refreshing ? (
              <View style={s.listLoader}>
                <ActivityIndicator color={palette.primaryStrong} />
              </View>
            ) : listError ? (
              <Text style={[s.listError, { color: palette.error ?? '#DC2626' }]}>
                {listError}
              </Text>
            ) : redeemedCodes.length === 0 ? (
              <Text style={[s.emptyNote, { color: palette.subtext }]}>
                No promo codes redeemed yet.
              </Text>
            ) : (
              redeemedCodes.map((code, idx) => (
                <View
                  key={code.id ?? code.code ?? idx}
                  style={[
                    s.codeItem,
                    {
                      backgroundColor: palette.surfaceElevated,
                      borderColor: palette.divider,
                    },
                  ]}
                >
                  <View style={s.codeItemLeft}>
                    <Text style={[s.codeLabel, { color: palette.text }]}>
                      {code.code}
                    </Text>
                    <Text style={[s.codeDiscount, { color: palette.primaryStrong }]}>
                      {formatDiscount(code)}
                    </Text>
                    {getExpiry(code) ? (
                      <Text style={[s.codeMeta, { color: palette.subtext }]}>
                        Expires: {formatDate(getExpiry(code))}
                      </Text>
                    ) : null}
                    {code.redeemed_at ? (
                      <Text style={[s.codeMeta, { color: palette.subtext }]}>
                        Redeemed: {formatDate(code.redeemed_at)}
                      </Text>
                    ) : null}
                  </View>
                  {code.status ? (
                    <View
                      style={[
                        s.codeStatusBadge,
                        {
                          backgroundColor:
                            code.status === 'active'
                              ? '#DCFCE7'
                              : '#F3F4F6',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.codeStatusText,
                          {
                            color:
                              code.status === 'active' ? '#15803D' : '#6B7280',
                          },
                        ]}
                      >
                        {code.status.charAt(0).toUpperCase() +
                          code.status.slice(1)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 60 },
  backText: { fontSize: 15, fontWeight: '600' },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  entryCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  codeInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  btnRow: { flexDirection: 'row', gap: 10 },
  applyBtn: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  errorBanner: {
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  errorBannerText: { fontSize: 13, fontWeight: '600' },
  validCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  validTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  validDiscount: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  validMeta: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  redeemBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  listLoader: { alignItems: 'center', paddingVertical: 20 },
  listError: { fontSize: 13, fontWeight: '600' },
  emptyNote: { fontSize: 13, fontStyle: 'italic' },
  codeItem: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codeItemLeft: { flex: 1, marginRight: 12 },
  codeLabel: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  codeDiscount: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  codeMeta: { fontSize: 12 },
  codeStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  codeStatusText: { fontSize: 11, fontWeight: '700' },
});
