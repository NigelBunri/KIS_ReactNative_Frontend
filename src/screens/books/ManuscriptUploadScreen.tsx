import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import DocumentPicker from 'react-native-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ManuscriptUpload'>;

export default function ManuscriptUploadScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [book, setBook] = useState<any>(null);
  const [conversion, setConversion] = useState<any>(null);
  const [rightsDeclared, setRightsDeclared] = useState(false);
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false);
  const [isFree, setIsFree] = useState(true);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imagePlacements, setImagePlacements] = useState<any[]>([]);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBook = useCallback(async () => {
    const res: any = await getRequest(ROUTES.books.mineDetail(id));
    if (res?.success) {
      setBook(res.data);
      setRightsDeclared(!!res.data.rights_declared);
      setPolicyAcknowledged(!!res.data.policy_acknowledged_at);
      setIsFree(!!res.data.is_free);
    }
    const conv: any = await getRequest(ROUTES.books.conversionStatus(id));
    if (conv?.success) setConversion(conv.data);
    const placements: any = await getRequest(ROUTES.books.imagePlacements(id));
    if (placements?.success && Array.isArray(placements.data)) setImagePlacements(placements.data);
  }, [id]);

  useEffect(() => {
    fetchBook();
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [fetchBook]);

  useEffect(() => {
    if (!isFree) {
      getRequest(ROUTES.books.paidEligibility).then((res: any) => {
        if (res?.success) setEligible(!!res.data?.eligible);
      });
    }
  }, [isFree]);

  const startPolling = () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      await fetchBook();
    }, 3000);
  };

  const handlePickAndUpload = async () => {
    try {
      const results = await DocumentPicker.pick({ type: [DocumentPicker.types.allFiles] });
      const file = results[0];
      const ext = (file.name || '').split('.').pop()?.toLowerCase();
      if (!['pdf', 'docx', 'txt'].includes(ext || '')) {
        Alert.alert('Unsupported file', 'Only PDF, DOCX, and TXT manuscripts are accepted.');
        return;
      }
      setUploading(true);
      const form = new FormData();
      form.append('file', { uri: file.uri, name: file.name, type: file.type || 'application/octet-stream' } as any);
      const res: any = await postRequest(ROUTES.books.manuscriptUpload(id), form);
      setUploading(false);
      if (res?.success) {
        startPolling();
      } else {
        Alert.alert('Upload failed', res?.message || 'Could not upload manuscript.');
      }
    } catch (error: any) {
      if (DocumentPicker.isCancel?.(error)) return;
      Alert.alert('Upload failed', error?.message ?? 'Could not select file.');
    }
  };

  const handleToggleFree = async (free: boolean) => {
    setIsFree(free);
    await patchRequest(ROUTES.books.mineDetail(id), { is_free: free, price_cents: free ? 0 : book?.price_cents || 500 });
    fetchBook();
  };

  const handleDeclareRights = async () => {
    const res: any = await patchRequest(ROUTES.books.mineDetail(id), {
      rights_declared: true,
      rights_declaration_text: 'I own this content or hold sufficient rights to publish it on KIS Books.',
    });
    if (res?.success) { setRightsDeclared(true); fetchBook(); }
  };

  const handleAcknowledgePolicy = async () => {
    const res: any = await postRequest(ROUTES.books.acknowledgePolicy(id), {});
    if (res?.success) { setPolicyAcknowledged(true); fetchBook(); }
    else Alert.alert('Error', res?.message || 'Could not acknowledge the policy.');
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const res: any = await postRequest(ROUTES.books.submit(id), {});
    setSubmitting(false);
    if (res?.success) {
      Alert.alert('Submitted', 'Your book has been submitted for Christian publishing policy review.');
      navigation.navigate('AuthorStudio');
    } else {
      Alert.alert('Could not submit', res?.message || 'Please resolve the issues above and try again.');
    }
  };

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    header: { flexDirection: 'row', alignItems: 'center', padding: sp, gap: 10 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 },
    content: { padding: sp, gap: 16 },
    section: { backgroundColor: palette.card, borderRadius: 12, padding: 14, gap: 8 },
    sectionTitle: { fontWeight: '700', color: palette.text },
    helpText: { fontSize: 13, color: palette.subtext, lineHeight: 18 },
    warnText: { fontSize: 13, color: '#B23B3B' },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    policyBox: { backgroundColor: palette.primarySoft, borderRadius: 12, padding: 14, gap: 6 },
    policyTitle: { fontWeight: '800', color: palette.text },
  });

  if (!book) {
    return <SafeAreaView style={styles.safe}><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={palette.primary} /></View></SafeAreaView>;
  }

  const manuscript = conversion?.manuscript;
  const job = conversion?.job;
  const hasChapters = (book.chapters || []).length > 0;
  const unresolvedImages = imagePlacements.filter((p) => p.extraction_status !== 'extracted').length;
  const canSubmit = hasChapters && rightsDeclared && policyAcknowledged && unresolvedImages === 0
    && book.status !== 'pending_review' && book.status !== 'under_review';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Go back">
          <KISIcon name="back" size={22} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{book.title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.policyBox}>
          <Text style={styles.policyTitle}>Christian Books Only</Text>
          <Text style={styles.helpText}>
            All submitted books are subject to review before publication. Uploading a book does not
            guarantee approval. Books that do not meet our Christian publishing policy may be rejected,
            removed, or restricted.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Manuscript</Text>
          <Text style={styles.helpText}>Accepted formats: PDF, DOCX, TXT. Max 50MB.</Text>
          {manuscript && <Text style={styles.helpText}>Uploaded: {manuscript.original_filename} ({manuscript.status})</Text>}
          {job && job.status === 'running' && <Text style={styles.helpText}>Converting your manuscript…</Text>}
          {job && job.status === 'succeeded' && (
            <Text style={styles.helpText}>
              Converted into {job.chapters_detected} chapter(s). Confidence: {Math.round((job.confidence_score || 0) * 100)}%.
            </Text>
          )}
          {job && job.status === 'failed' && <Text style={styles.warnText}>Conversion failed: {job.error_message}</Text>}
          {(job?.warnings || []).map((w: string, i: number) => <Text key={i} style={styles.warnText}>⚠ {w}</Text>)}
          <KISButton title={manuscript ? 'Upload a new manuscript' : 'Upload manuscript'} variant="outline" loading={uploading} onPress={handlePickAndUpload} />
        </View>

        {imagePlacements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Images</Text>
            <Text style={styles.helpText}>
              {imagePlacements.length} image(s) detected — {unresolvedImages > 0
                ? `${unresolvedImages} still need an image before you can submit.`
                : 'all resolved.'}
            </Text>
            <KISButton title="Review images" variant="outline" onPress={() => navigation.navigate('ImagePlacementsReview', { id })} />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{imagePlacements.length > 0 ? '3' : '2'}. Pricing</Text>
          <View style={styles.row}>
            <Text style={{ color: palette.text }}>Free book</Text>
            <Switch value={isFree} onValueChange={handleToggleFree} />
          </View>
          {!isFree && eligible === false && (
            <Text style={styles.warnText}>
              Setting a price requires a verified business with a working payout account. Register or verify
              your business, then return here — your manuscript and edits are preserved.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{imagePlacements.length > 0 ? '4' : '3'}. Rights declaration</Text>
          <Text style={styles.helpText}>You must own this content or hold sufficient rights to publish it.</Text>
          <KISButton
            title={rightsDeclared ? 'Rights declared ✓' : 'Declare publishing rights'}
            variant={rightsDeclared ? 'secondary' : 'primary'}
            disabled={rightsDeclared}
            onPress={handleDeclareRights}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{imagePlacements.length > 0 ? '5' : '4'}. Christian Publishing Policy</Text>
          <KISButton
            title={policyAcknowledged ? 'Policy acknowledged ✓' : 'Acknowledge policy'}
            variant={policyAcknowledged ? 'secondary' : 'primary'}
            disabled={policyAcknowledged}
            onPress={handleAcknowledgePolicy}
          />
        </View>

        <KISButton title="Submit for review" variant="primary" loading={submitting} disabled={!canSubmit} onPress={handleSubmit} />
      </ScrollView>
    </SafeAreaView>
  );
}
