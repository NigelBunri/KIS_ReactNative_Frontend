import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
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

type Props = NativeStackScreenProps<RootStackParamList, 'Scholarships'>;

type Scholarship = {
  id: string;
  title: string;
  sponsor: string;
  amount: number;
  currency: string;
  deadline: string;
  country: string;
  requirements?: string;
};

export default function ScholarshipsScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [applyId, setApplyId] = useState<string | null>(null);
  const [statement, setStatement] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reqExpanded, setReqExpanded] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.education.scholarships)
        .then((res: any) => {
          if (active) setScholarships(res?.data ?? res ?? []);
        })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  const countries = useMemo(() => {
    const set = new Set(scholarships.map((s) => s.country).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [scholarships]);

  const filtered = useMemo(() => {
    return scholarships.filter((s) => {
      const matchSearch = !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.sponsor?.toLowerCase().includes(search.toLowerCase());
      const matchCountry = !countryFilter || countryFilter === 'All' || s.country === countryFilter;
      return matchSearch && matchCountry;
    });
  }, [scholarships, search, countryFilter]);

  const handleApply = async (id: string) => {
    if (!statement.trim()) {
      Alert.alert('Validation', 'Please provide a statement.');
      return;
    }
    setSubmitting(true);
    try {
      await postRequest(ROUTES.education.submissions, {
        scholarship: id,
        statement,
        document_url: docUrl,
      });
      Alert.alert('Success', 'Application submitted.');
      setApplyId(null);
      setStatement('');
      setDocUrl('');
    } catch {
      Alert.alert('Error', 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
      minHeight: 56,
    },
    backBtn: { marginRight: 12, minWidth: 44, minHeight: 44, justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 },
    filterBar: { paddingHorizontal: sp, paddingVertical: 10 },
    searchInput: {
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: palette.text,
      backgroundColor: palette.surface,
      marginBottom: 10,
      minHeight: 44,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      minHeight: 32,
      justifyContent: 'center',
    },
    chipText: { fontSize: 13, fontWeight: '500' },
    scroll: { flex: 1 },
    content: { padding: sp, paddingBottom: 80 },
    card: {
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: sp,
      marginBottom: 12,
    },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    title: { fontSize: 15, fontWeight: '700', color: palette.text, flex: 1, marginRight: 8 },
    amount: { fontSize: 15, fontWeight: '700', color: palette.gold },
    sponsor: { fontSize: 13, color: palette.subtext, marginTop: 4 },
    metaRow: { flexDirection: 'row', gap: 16, marginTop: 8, flexWrap: 'wrap' },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 13, color: palette.subtext },
    divider: { height: 1, backgroundColor: palette.divider, marginVertical: 10 },
    reqBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
    reqBtnText: { fontSize: 13, color: palette.primary },
    reqText: { fontSize: 13, color: palette.subtext, marginTop: 4, lineHeight: 20 },
    label: { fontSize: 13, color: palette.subtext, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: 8,
      padding: 10,
      fontSize: 14,
      color: palette.text,
      backgroundColor: palette.surface,
      marginBottom: 10,
      minHeight: 44,
    },
    textArea: { minHeight: 100, textAlignVertical: 'top' },
    applyBtn: { marginTop: 4 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { textAlign: 'center', color: palette.subtext, marginTop: 40 },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="chevron-back-outline" size={22} color={palette.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Scholarships</Text>
      </View>

      <View style={styles.filterBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search scholarships..."
          placeholderTextColor={palette.subtext}
          value={search}
          onChangeText={setSearch}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {countries.map((c) => {
              const active = (countryFilter === c) || (!countryFilter && c === 'All');
              return (
                <Pressable
                  key={c}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? palette.primary : palette.surface,
                      borderColor: active ? palette.primary : palette.divider,
                    },
                  ]}
                  onPress={() => setCountryFilter(c === 'All' ? '' : c)}
                  hitSlop={4}
                >
                  <Text style={[styles.chipText, { color: active ? palette.ivory : palette.text }]}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {filtered.length === 0 && <Text style={styles.empty}>No scholarships found.</Text>}
        {filtered.map((item) => {
          const isApplying = applyId === item.id;
          const reqOpen = reqExpanded === item.id;
          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.amount}>
                  {item.currency} {item.amount?.toLocaleString()}
                </Text>
              </View>
              <Text style={styles.sponsor}>{item.sponsor}</Text>

              <View style={styles.metaRow}>
                {item.country ? (
                  <View style={styles.metaItem}>
                    <KISIcon name="location-outline" size={14} color={palette.subtext} />
                    <Text style={styles.metaText}>{item.country}</Text>
                  </View>
                ) : null}
                <View style={styles.metaItem}>
                  <KISIcon name="calendar-outline" size={14} color={palette.subtext} />
                  <Text style={styles.metaText}>
                    Deadline: {item.deadline ? new Date(item.deadline).toLocaleDateString() : 'N/A'}
                  </Text>
                </View>
              </View>

              {item.requirements ? (
                <>
                  <View style={styles.divider} />
                  <Pressable
                    style={styles.reqBtn}
                    onPress={() => setReqExpanded(reqOpen ? null : item.id)}
                    hitSlop={4}
                  >
                    <KISIcon name={reqOpen ? 'chevron-up-outline' : 'chevron-down-outline'} size={16} color={palette.primary} />
                    <Text style={styles.reqBtnText}>Requirements</Text>
                  </Pressable>
                  {reqOpen && <Text style={styles.reqText}>{item.requirements}</Text>}
                </>
              ) : null}

              <View style={styles.divider} />

              {isApplying ? (
                <>
                  <Text style={styles.label}>Personal Statement</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Why you deserve this scholarship..."
                    placeholderTextColor={palette.subtext}
                    value={statement}
                    onChangeText={setStatement}
                    multiline
                  />
                  <Text style={styles.label}>Document URL (optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="https://..."
                    placeholderTextColor={palette.subtext}
                    value={docUrl}
                    onChangeText={setDocUrl}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <KISButton
                      title="Submit"
                      variant="primary"
                      loading={submitting}
                      onPress={() => handleApply(item.id)}
                      style={{ flex: 1 }}
                    />
                    <KISButton
                      title="Cancel"
                      variant="outline"
                      onPress={() => { setApplyId(null); setStatement(''); setDocUrl(''); }}
                      style={{ flex: 1 }}
                    />
                  </View>
                </>
              ) : (
                <KISButton
                  title="Apply"
                  variant="primary"
                  style={styles.applyBtn}
                  onPress={() => setApplyId(item.id)}
                  left={<KISIcon name="school-outline" size={16} color={palette.ivory} />}
                />
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
