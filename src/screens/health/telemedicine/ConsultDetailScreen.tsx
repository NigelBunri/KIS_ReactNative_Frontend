import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ConsultDetail'>;

type Consult = {
  id: string;
  doctor_name: string;
  specialty: string;
  scheduled_at: string;
  status: string;
  call_url?: string;
  notes?: string;
};

function StarRating({
  rating,
  onRate,
  color,
}: {
  rating: number;
  onRate: (n: number) => void;
  color: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <TouchableOpacity
          key={s}
          onPress={() => onRate(s)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
        >
          <KISIcon
            name="star"
            size={28}
            color={s <= rating ? color : color + '44'}
            focused={s <= rating}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ConsultDetailScreen({ route, navigation }: Props) {
  const { consultId } = route.params;
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [consult, setConsult] = useState<Consult | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchConsult = useCallback(async () => {
    setLoading(true);
    const res = await getRequest(ROUTES.healthExtended.consult(consultId));
    if (res.success && res.data) setConsult(res.data);
    setLoading(false);
  }, [consultId]);

  useFocusEffect(useCallback(() => { fetchConsult(); }, [fetchConsult]));

  const handleJoinCall = async () => {
    if (!consult?.call_url) {
      Alert.alert('Connecting...', 'Call link will be available shortly.');
      return;
    }
    if (consult.status === 'in_progress') {
      setConnecting(true);
      try {
        await Linking.openURL(consult.call_url);
      } catch {
        Alert.alert('Error', 'Unable to open the video call.');
      } finally {
        setConnecting(false);
      }
    } else {
      Linking.openURL(consult.call_url).catch(() =>
        Alert.alert('Error', 'Unable to open the call link.')
      );
    }
  };

  const handleSubmitReview = async () => {
    if (rating === 0) {
      Alert.alert('Rating required', 'Please select a star rating.');
      return;
    }
    setSubmittingReview(true);
    const res = await postRequest(ROUTES.healthExtended.consultReviews, {
      consult: consultId,
      rating,
      comment,
    });
    setSubmittingReview(false);
    if (res.success) {
      Alert.alert('Thank you!', 'Your review has been submitted.');
      setRating(0);
      setComment('');
    } else {
      Alert.alert('Error', res.message || 'Failed to submit review.');
    }
  };

  const styles = makeStyles(palette, sp);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!consult) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Consult not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const canJoin = consult.status === 'in_progress' || !!consult.call_url;
  const isCompleted = consult.status === 'completed';

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={[palette.gradientStart, palette.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <KISIcon name="arrow-left" size={22} color={palette.ivory} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Consult Details</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Consult Info */}
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.avatarCircle}>
              <KISIcon name="person" size={24} color={palette.primary} />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.doctorName}>{consult.doctor_name}</Text>
              <Text style={styles.specialty}>{consult.specialty}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <KISIcon name="calendar" size={16} color={palette.subtext} />
            <Text style={styles.detailText}>
              {new Date(consult.scheduled_at).toLocaleString()}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <KISIcon name="info" size={16} color={palette.subtext} />
            <View style={[
              styles.statusBadge,
              { backgroundColor: consult.status === 'in_progress' ? palette.primary + '22' : palette.primarySoft },
            ]}>
              <Text style={[
                styles.statusText,
                { color: consult.status === 'in_progress' ? palette.primary : palette.primaryStrong },
              ]}>
                {consult.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Join Call Button */}
        {canJoin && (
          <KISButton
            title={connecting ? 'Connecting...' : consult.status === 'in_progress' ? 'Join Video Call' : 'Open Call Link'}
            variant="primary"
            size="lg"
            loading={connecting}
            style={styles.joinBtn}
            left={<KISIcon name="video" size={18} color={palette.ivory} />}
            onPress={handleJoinCall}
          />
        )}

        {/* Notes */}
        {consult.notes ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Doctor Notes</Text>
            <Text style={styles.notesText}>{consult.notes}</Text>
          </View>
        ) : null}

        {/* Rating & Review — only for completed consults */}
        {isCompleted && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Rate Your Consult</Text>
            <StarRating rating={rating} onRate={setRating} color={palette.gold} />
            <TextInput
              style={styles.commentInput}
              placeholder="Share your experience (optional)"
              placeholderTextColor={palette.subtext}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <KISButton
              title="Submit Review"
              variant="primary"
              size="md"
              loading={submittingReview}
              onPress={handleSubmitReview}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, sp: number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, marginTop: 25 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: palette.subtext, fontSize: 15 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingTop: 12,
      paddingBottom: 16,
      gap: 12,
    },
    backBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
    headerTitle: { fontSize: 22, fontWeight: '700', color: palette.ivory },
    content: { padding: sp, gap: 16 },
    card: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.divider,
      gap: 12,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: palette.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    infoText: { flex: 1 },
    doctorName: { fontSize: 18, fontWeight: '700', color: palette.text },
    specialty: { fontSize: 14, color: palette.subtext, marginTop: 2 },
    divider: { height: 1, backgroundColor: palette.divider },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    detailText: { fontSize: 14, color: palette.text },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    statusText: { fontSize: 12, fontWeight: '700' },
    joinBtn: { minHeight: 52 },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
    },
    notesText: { fontSize: 14, color: palette.subtext, lineHeight: 20 },
    commentInput: {
      backgroundColor: palette.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.divider,
      padding: 12,
      color: palette.text,
      fontSize: 14,
      minHeight: 80,
    },
  });
}
