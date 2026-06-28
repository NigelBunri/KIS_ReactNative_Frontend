import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';

type Props = NativeStackScreenProps<RootStackParamList, 'PetitionDetail'>;

type Signatory = {
  id: string;
  display_name: string;
  signed_at: string;
};

type Petition = {
  id: string;
  title: string;
  description: string;
  target: string;
  deadline: string;
  status: string;
  signature_count: number;
  target_count: number;
  signatories?: Signatory[];
};

const STATUS_COLORS: Record<string, string> = {};

export default function PetitionDetailScreen({ route }: Props) {
  const { petitionId } = route.params;
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const gutter = layout.pageGutter;

  const [petition, setPetition] = useState<Petition | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [anonymous, setAnonymous] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.government.petition(petitionId))
        .then((res: any) => {
          if (!active) return;
          setPetition(res ?? null);
        })
        .catch(() => setPetition(null))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [petitionId]),
  );

  async function handleSign() {
    if (!petition) return;
    setSigning(true);
    try {
      await postRequest(ROUTES.government.petitionSign(petitionId), {
        is_anonymous: anonymous,
      });
      setPetition((prev) =>
        prev ? { ...prev, signature_count: prev.signature_count + 1 } : prev,
      );
      Alert.alert('Success', 'Your signature has been recorded.');
    } catch {
      Alert.alert('Error', 'Could not sign the petition. Please try again.');
    } finally {
      setSigning(false);
    }
  }

  async function handleShare() {
    if (!petition) return;
    await Share.share({
      title: petition.title,
      message: `Sign this petition: ${petition.title}\n\nTarget: ${petition.target}\n\n${petition.description?.slice(0, 200)}`,
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  if (!petition) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>
            Petition not found.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const progress =
    petition.target_count > 0
      ? Math.min(petition.signature_count / petition.target_count, 1)
      : 0;

  const statusColor =
    petition.status === 'active'
      ? palette.primary
      : petition.status === 'closed'
      ? palette.subtext
      : palette.gold;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: 20,
          paddingBottom: 80,
        }}
      >
        {/* Title + Status */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: palette.text, flex: 1 }]}>
            {petition.title}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColor + '22' },
            ]}
          >
            <Text style={[styles.statusText, { color: statusColor }]}>
              {petition.status ?? 'Active'}
            </Text>
          </View>
        </View>

        {/* Target */}
        <Text style={[styles.targetLabel, { color: palette.subtext }]}>
          Target:{' '}
          <Text style={{ color: palette.text, fontWeight: '600' }}>
            {petition.target}
          </Text>
        </Text>

        {/* Deadline */}
        {petition.deadline && (
          <Text style={[styles.deadlineLabel, { color: palette.subtext }]}>
            Deadline:{' '}
            <Text style={{ color: palette.text }}>
              {new Date(petition.deadline).toLocaleDateString()}
            </Text>
          </Text>
        )}

        {/* Progress */}
        <View
          style={[
            styles.progressBg,
            { backgroundColor: palette.surface, marginTop: 16 },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: palette.primary,
                width: `${Math.round(progress * 100)}%`,
              },
            ]}
          />
        </View>
        <Text style={[styles.progressLabel, { color: palette.subtext }]}>
          {petition.signature_count.toLocaleString()} of{' '}
          {petition.target_count.toLocaleString()} signatures (
          {Math.round(progress * 100)}%)
        </Text>

        {/* Description */}
        <View
          style={[
            styles.descriptionCard,
            { backgroundColor: palette.card, borderColor: palette.divider },
          ]}
        >
          <Text style={[styles.descriptionText, { color: palette.text }]}>
            {petition.description}
          </Text>
        </View>

        {/* Anonymous Toggle */}
        <View
          style={[
            styles.anonymousRow,
            { backgroundColor: palette.surface, borderColor: palette.divider },
          ]}
        >
          <View style={styles.anonymousLabel}>
            <KISIcon name="eye-off-outline" size={18} color={palette.subtext} />
            <Text style={[styles.anonymousText, { color: palette.text }]}>
              Sign anonymously
            </Text>
          </View>
          <Switch
            value={anonymous}
            onValueChange={setAnonymous}
            trackColor={{ true: palette.primary, false: palette.divider }}
            thumbColor={palette.ivory}
          />
        </View>

        {/* Sign CTA */}
        <KISButton
          title={signing ? 'Signing…' : 'Sign Petition'}
          onPress={handleSign}
          disabled={signing}
          style={{ marginTop: 16 }}
        />

        {/* Share */}
        <TouchableOpacity
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[
            styles.shareBtn,
            { borderColor: palette.divider, marginTop: 12 },
          ]}
          onPress={handleShare}
        >
          <KISIcon name="share-outline" size={18} color={palette.primary} />
          <Text style={[styles.shareBtnText, { color: palette.primary }]}>
            Share Petition
          </Text>
        </TouchableOpacity>

        {/* Recent Signatories */}
        {petition.signatories && petition.signatories.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Recent Signatures
            </Text>
            {petition.signatories.map((sig) => (
              <View
                key={sig.id}
                style={[
                  styles.sigRow,
                  {
                    borderBottomColor: palette.divider,
                  },
                ]}
              >
                <View
                  style={[
                    styles.sigAvatar,
                    { backgroundColor: palette.primarySoft },
                  ]}
                >
                  <Text
                    style={[styles.sigAvatarText, { color: palette.primary }]}
                  >
                    {sig.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                  </Text>
                </View>
                <View style={styles.sigInfo}>
                  <Text style={[styles.sigName, { color: palette.text }]}>
                    {sig.display_name}
                  </Text>
                  <Text style={[styles.sigDate, { color: palette.subtext }]}>
                    {new Date(sig.signed_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  targetLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  deadlineLabel: {
    fontSize: 14,
  },
  progressBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 13,
    marginBottom: 16,
  },
  descriptionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
  },
  anonymousRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  anonymousLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  anonymousText: {
    fontSize: 14,
    fontWeight: '500',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    minHeight: 44,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  sigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  sigAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigAvatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sigInfo: {
    flex: 1,
  },
  sigName: {
    fontSize: 14,
    fontWeight: '600',
  },
  sigDate: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
  },
});
