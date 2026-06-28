import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EducationCertificate'>;

type Certificate = {
  id: string;
  title: string;
  student_name: string;
  verif_hash: string;
  issued_at?: string;
};

export default function CertificateScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);

  useEffect(() => {
    let mounted = true;
    getRequest(ROUTES.education.certificateGenerate.replace('/generate/', '/'))
      .then((res: any) => {
        if (!mounted) return;
        const data = res?.data ?? res;
        const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
        if (list.length > 0) setCertificate(list[0]);
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoadingExisting(false); });
    return () => { mounted = false; };
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res: any = await postRequest(ROUTES.education.certificateGenerate, {});
      setCertificate(res?.data ?? res ?? null);
    } catch {
      Alert.alert('Error', 'Failed to generate certificate.');
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!certificate) return;
    try {
      await Share.share({
        title: certificate.title,
        message: `${certificate.student_name} has earned: "${certificate.title}"\nBlockchain Hash: ${certificate.verif_hash}`,
      });
    } catch {
      Alert.alert('Error', 'Could not share certificate.');
    }
  };

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    header: { padding: sp, paddingBottom: sp + 4 },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      minHeight: 44,
    },
    backLabel: { fontSize: 16, color: palette.ivory, marginLeft: 4 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: palette.ivory },
    scroll: { flex: 1 },
    content: { padding: sp, paddingBottom: 80 },
    generateSection: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    generateIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: palette.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    generateTitle: { fontSize: 18, fontWeight: '600', color: palette.text, marginBottom: 8, textAlign: 'center' },
    generateSubtitle: { fontSize: 14, color: palette.subtext, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    certCard: {
      backgroundColor: palette.card,
      borderRadius: 16,
      padding: sp + 4,
      marginBottom: 20,
      borderWidth: 2,
      borderColor: palette.gold,
    },
    certHeader: { alignItems: 'center', marginBottom: 16 },
    certIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: palette.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    certTitle: { fontSize: 20, fontWeight: '700', color: palette.text, textAlign: 'center', marginBottom: 6 },
    certStudent: { fontSize: 16, color: palette.primary, textAlign: 'center', fontWeight: '600' },
    certDate: { fontSize: 13, color: palette.subtext, textAlign: 'center', marginTop: 4 },
    divider: { height: 1, backgroundColor: palette.divider, marginVertical: 16 },
    hashSection: {},
    hashLabel: { fontSize: 12, color: palette.subtext, marginBottom: 6, fontWeight: '600', letterSpacing: 0.5 },
    hashValue: {
      fontSize: 12,
      color: palette.text,
      fontFamily: 'Courier',
      backgroundColor: palette.surface,
      padding: 10,
      borderRadius: 8,
      letterSpacing: 0.5,
    },
    shareRow: { marginTop: 16 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="chevron-back-outline" size={22} color={palette.ivory} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Certificate</Text>
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {!certificate ? (
          <View style={styles.generateSection}>
            <View style={styles.generateIcon}>
              <KISIcon name="medal-outline" size={40} color={palette.primary} />
            </View>
            <Text style={styles.generateTitle}>Generate Your Certificate</Text>
            <Text style={styles.generateSubtitle}>
              Complete your course requirements to generate a blockchain-verified certificate.
            </Text>
            <KISButton
              title="Generate Certificate"
              variant="primary"
              loading={generating}
              onPress={handleGenerate}
              left={<KISIcon name="document-text-outline" size={18} color={palette.ivory} />}
            />
          </View>
        ) : (
          <>
            <View style={styles.certCard}>
              <View style={styles.certHeader}>
                <View style={styles.certIcon}>
                  <KISIcon name="medal-outline" size={36} color={palette.gold} />
                </View>
                <Text style={styles.certTitle}>{certificate.title}</Text>
                <Text style={styles.certStudent}>{certificate.student_name}</Text>
                {certificate.issued_at ? (
                  <Text style={styles.certDate}>
                    Issued: {new Date(certificate.issued_at).toLocaleDateString()}
                  </Text>
                ) : null}
              </View>

              <View style={styles.divider} />

              <View style={styles.hashSection}>
                <Text style={styles.hashLabel}>BLOCKCHAIN HASH</Text>
                <Text style={styles.hashValue}>{certificate.verif_hash}</Text>
              </View>
            </View>

            <View style={styles.shareRow}>
              <KISButton
                title="Share Certificate"
                variant="primary"
                onPress={handleShare}
                left={<KISIcon name="share-social-outline" size={18} color={palette.ivory} />}
              />
            </View>

            <View style={{ marginTop: 12 }}>
              <KISButton
                title="Generate New Certificate"
                variant="outline"
                loading={generating}
                onPress={handleGenerate}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
