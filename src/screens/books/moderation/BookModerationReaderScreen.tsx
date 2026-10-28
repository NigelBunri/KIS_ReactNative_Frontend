import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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

type Props = NativeStackScreenProps<RootStackParamList, 'BookModerationReader'>;

export default function BookModerationReaderScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [acting, setActing] = useState(false);
  const [showRestrictionForm, setShowRestrictionForm] = useState(false);
  const [restrictionReason, setRestrictionReason] = useState('');

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    const res: any = await getRequest(ROUTES.books.adminDetail(id));
    if (res?.success) setData(res.data);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { fetchDetail(); }, [fetchDetail]));

  const runAction = async (action: string) => {
    setActing(true);
    const res: any = await postRequest(ROUTES.books.adminAction(id), { action, notes });
    setActing(false);
    if (res?.success) {
      setNotes('');
      fetchDetail();
      Alert.alert('Done', `Action "${action}" applied.`);
    } else {
      Alert.alert('Action failed', res?.message || 'Please try again.');
    }
  };

  const applyRestriction = async (restrictionType: string) => {
    if (!restrictionReason.trim()) {
      Alert.alert('Reason required', 'Please state a reason for this restriction.');
      return;
    }
    const userId = data?.book?.owner?.id;
    const res: any = await postRequest(ROUTES.books.adminAuthorRestrictions(userId), {
      restriction_type: restrictionType, reason: restrictionReason.trim(), related_book_id: id,
    });
    if (res?.success) {
      setShowRestrictionForm(false);
      setRestrictionReason('');
      Alert.alert('Restriction applied', restrictionType.replace(/_/g, ' '));
    } else {
      Alert.alert('Could not apply restriction', res?.message || 'You may lack authority for this action.');
    }
  };

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    header: { flexDirection: 'row', alignItems: 'center', padding: sp, gap: 10 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 },
    content: { padding: sp, gap: 14 },
    section: { backgroundColor: palette.card, borderRadius: 12, padding: 14, gap: 8 },
    sectionTitle: { fontWeight: '700', color: palette.text },
    meta: { fontSize: 12, color: palette.subtext },
    chapterTitle: { fontWeight: '800', fontSize: 16, color: palette.text, marginTop: 10 },
    paragraph: { fontSize: 14, color: palette.text, lineHeight: 20, marginTop: 6 },
    warnText: { fontSize: 13, color: '#B23B3B' },
    input: { borderWidth: 1, borderColor: palette.divider, borderRadius: 10, padding: 10, color: palette.text, minHeight: 60 },
    actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });

  if (loading || !data) {
    return <SafeAreaView style={styles.safe}><View style={styles.centered}><ActivityIndicator color={palette.primary} /></View></SafeAreaView>;
  }

  const { book, chapters, conversion_jobs, author_history } = data;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Go back">
          <KISIcon name="back" size={22} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{book.title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Submission</Text>
          <Text style={styles.meta}>Author: {book.author_name} · {book.owner.email}</Text>
          <Text style={styles.meta}>Status: {book.status} · Category: {book.christian_category}</Text>
          <Text style={styles.meta}>Rights declared: {book.rights_declared ? 'Yes' : 'No'} · Policy acknowledged: {book.policy_acknowledged_at ? 'Yes' : 'No'}</Text>
          <Text style={styles.meta}>Pricing: {book.is_free ? 'Free' : `${book.price_cents} cents`}</Text>
        </View>

        {(conversion_jobs || []).map((j: any) => (
          <View key={j.id} style={styles.section}>
            <Text style={styles.sectionTitle}>Conversion ({j.status})</Text>
            <Text style={styles.meta}>Confidence: {Math.round((j.confidence_score || 0) * 100)}% · Chapters: {j.chapters_detected}</Text>
            {(j.warnings || []).map((w: string, i: number) => <Text key={i} style={styles.warnText}>⚠ {w}</Text>)}
            {!!j.error_message && <Text style={styles.warnText}>{j.error_message}</Text>}
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Full manuscript ({chapters.length} chapter(s))</Text>
          {chapters.map((c: any) => (
            <View key={c.stable_id}>
              <Text style={styles.chapterTitle}>{c.order}. {c.title}</Text>
              {(c.content_blocks || []).map((b: any, i: number) => (
                <Text key={i} style={styles.paragraph}>{b.text}</Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Author history</Text>
          <Text style={styles.meta}>{author_history.prior_books.length} prior book(s); {author_history.open_restrictions.length} restriction record(s)</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Decision</Text>
          <TextInput style={styles.input} placeholder="Notes (shown to author for reject/corrections)" placeholderTextColor={palette.subtext} value={notes} onChangeText={setNotes} multiline />
          <View style={styles.actionsRow}>
            <KISButton title="Approve" variant="primary" size="sm" loading={acting} onPress={() => runAction('approve')} />
            <KISButton title="Reject" variant="outline" size="sm" loading={acting} onPress={() => runAction('reject')} />
            <KISButton title="Request corrections" variant="outline" size="sm" loading={acting} onPress={() => runAction('request_corrections')} />
            <KISButton title="Block" variant="outline" size="sm" loading={acting} onPress={() => runAction('block')} />
            <KISButton title="Restore" variant="outline" size="sm" loading={acting} onPress={() => runAction('restore')} />
            <KISButton title="Escalate" variant="outline" size="sm" loading={acting} onPress={() => runAction('escalate')} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Author account actions</Text>
          <KISButton
            title={showRestrictionForm ? 'Hide restriction form' : 'Restrict this author'}
            variant="outline"
            onPress={() => setShowRestrictionForm((v) => !v)}
          />
          {showRestrictionForm && (
            <>
              <TextInput style={styles.input} placeholder="Reason (required)" placeholderTextColor={palette.subtext} value={restrictionReason} onChangeText={setRestrictionReason} multiline />
              <View style={styles.actionsRow}>
                <KISButton title="Warn" size="sm" variant="outline" onPress={() => applyRestriction('warning')} />
                <KISButton title="Suspend publishing" size="sm" variant="outline" onPress={() => applyRestriction('publishing_suspended')} />
                <KISButton title="Restrict paid publishing" size="sm" variant="outline" onPress={() => applyRestriction('paid_publishing_restricted')} />
                <KISButton title="Suspend business publishing" size="sm" variant="outline" onPress={() => applyRestriction('business_publishing_suspended')} />
                <KISButton title="Suspend account" size="sm" variant="outline" onPress={() => applyRestriction('account_suspended')} />
                <KISButton title="Ban account" size="sm" variant="outline" onPress={() => applyRestriction('account_banned')} />
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
