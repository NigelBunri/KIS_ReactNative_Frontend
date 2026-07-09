import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DoctorDirectory'>;

type Doctor = {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  review_count: number;
  avatar_url?: string;
};

const SPECIALTIES = ['All', 'General', 'Cardiology', 'Dermatology', 'Pediatrics', 'Mental Health', 'Gynecology', 'Orthopedics'];

function StarRating({ rating, color }: { rating: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <KISIcon
          key={s}
          name="star"
          size={12}
          color={s <= Math.round(rating) ? color : color + '44'}
          focused={s <= Math.round(rating)}
        />
      ))}
    </View>
  );
}

export default function DoctorDirectoryScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');

  const fetchDoctors = useCallback(async (specialty?: string) => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (specialty && specialty !== 'All') params.specialty = specialty;
    const res = await getRequest(ROUTES.healthExtended.doctors, { params });
    if (res.success) {
      setDoctors(Array.isArray(res.data?.results ?? res.data) ? (res.data?.results ?? res.data) : []);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchDoctors(selectedSpecialty); }, [fetchDoctors, selectedSpecialty]));

  const handleSpecialtyChange = (s: string) => {
    setSelectedSpecialty(s);
    fetchDoctors(s);
  };

  const styles = makeStyles(palette, sp);

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
        <Text style={styles.headerTitle}>Doctor Directory</Text>
      </LinearGradient>

      {/* Specialty Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {SPECIALTIES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.filterChip,
              selectedSpecialty === s && styles.filterChipActive,
            ]}
            onPress={() => handleSpecialtyChange(s)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedSpecialty === s && styles.filterChipTextActive,
              ]}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={doctors}
          keyExtractor={(d) => d.id}
          contentContainerStyle={[styles.list, { paddingBottom: 80 }]}
          ListEmptyComponent={<Text style={styles.empty}>No doctors found.</Text>}
          renderItem={({ item: doc }) => (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.avatarCircle}>
                  <KISIcon name="person" size={22} color={palette.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.doctorName}>{doc.name}</Text>
                  <Text style={styles.specialty}>{doc.specialty}</Text>
                  <View style={styles.ratingRow}>
                    <StarRating rating={doc.rating} color={palette.gold} />
                    <Text style={styles.ratingText}>
                      {doc.rating.toFixed(1)} ({doc.review_count})
                    </Text>
                  </View>
                </View>
              </View>
              <KISButton
                title="Book"
                variant="primary"
                size="sm"
                style={styles.bookBtn}
                onPress={() => navigation.navigate('ConsultDetail', { doctorId: doc.id, doctorName: doc.name })}
              />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(palette: any, sp: number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
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
    filterRow: {
      paddingHorizontal: sp,
      paddingVertical: 12,
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.divider,
      minHeight: 36,
      justifyContent: 'center',
    },
    filterChipActive: {
      backgroundColor: palette.primarySoft,
      borderColor: palette.primary,
    },
    filterChipText: { fontSize: 13, color: palette.subtext },
    filterChipTextActive: { color: palette.primary, fontWeight: '600' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { paddingHorizontal: sp, gap: 12 },
    empty: { color: palette.subtext, textAlign: 'center', marginTop: 40 },
    card: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.divider,
      gap: 12,
    },
    cardRow: { flexDirection: 'row', gap: 12 },
    avatarCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: palette.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardInfo: { flex: 1, justifyContent: 'center', gap: 4 },
    doctorName: { fontSize: 16, fontWeight: '600', color: palette.text },
    specialty: { fontSize: 13, color: palette.subtext },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    ratingText: { fontSize: 12, color: palette.subtext },
    bookBtn: { alignSelf: 'flex-end', minWidth: 80 },
  });
}
