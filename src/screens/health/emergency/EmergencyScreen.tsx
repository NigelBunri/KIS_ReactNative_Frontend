import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

type Props = NativeStackScreenProps<RootStackParamList, 'EmergencyHub'>;

type BloodRegistry = {
  blood_type: string;
  is_donor: boolean;
};

type BloodDonor = {
  id: string;
  name: string;
  blood_type: string;
  country: string;
  contact: string;
};

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function EmergencyScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [bloodRegistry, setBloodRegistry] = useState<BloodRegistry | null>(null);
  const [loadingRegistry, setLoadingRegistry] = useState(true);
  const [sendingSOS, setSendingSOS] = useState(false);
  const [registeringBlood, setRegisteringBlood] = useState(false);
  const [searchBloodType, setSearchBloodType] = useState('O+');
  const [searchCountry, setSearchCountry] = useState('');
  const [donors, setDonors] = useState<BloodDonor[]>([]);
  const [searchingDonors, setSearchingDonors] = useState(false);
  const [showBloodTypePicker, setShowBloodTypePicker] = useState(false);

  const fetchRegistry = useCallback(async () => {
    setLoadingRegistry(true);
    const res = await getRequest(ROUTES.healthExtended.bloodRegistry);
    if (res.success && res.data) setBloodRegistry(res.data);
    setLoadingRegistry(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchRegistry(); }, [fetchRegistry]));

  const handleRegisterBlood = useCallback(() => {
    Alert.alert(
      'Register Blood Type',
      'Select your blood type:',
      [
        ...BLOOD_TYPES.map(bt => ({
          text: bt,
          onPress: async () => {
            setRegisteringBlood(true);
            try {
              const res = await postRequest(ROUTES.healthExtended.bloodRegistry, {
                blood_type: bt,
                is_donor: true,
              });
              if (res?.success || res?.data || res?.id) {
                setBloodRegistry({ blood_type: bt, is_donor: true, ...(res?.data ?? {}) });
              }
            } catch {
              Alert.alert('Error', 'Could not register blood type. Please try again.');
            } finally {
              setRegisteringBlood(false);
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, []);

  const handleSOS = async () => {
    Alert.alert(
      'Send SOS Alert',
      'This will alert your emergency contacts and nearby responders. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            setSendingSOS(true);
            const res = await postRequest(ROUTES.healthExtended.sosAlert, {
              alert_type: 'sos',
            });
            setSendingSOS(false);
            if (res.success) {
              Alert.alert('SOS Sent', 'Emergency alert has been sent. Help is on the way.');
            } else {
              Alert.alert('Error', res.message || 'Failed to send SOS alert.');
            }
          },
        },
      ]
    );
  };

  const handleSearchDonors = async () => {
    if (!searchCountry.trim()) {
      Alert.alert('Country required', 'Please enter a country to search.');
      return;
    }
    setSearchingDonors(true);
    const res = await getRequest(ROUTES.healthExtended.bloodDonors, {
      params: {
        blood_type: searchBloodType,
        country: searchCountry.trim(),
      },
    });
    setSearchingDonors(false);
    if (res.success) {
      setDonors(Array.isArray(res.data?.results ?? res.data) ? (res.data?.results ?? res.data) : []);
    }
  };

  const styles = makeStyles(palette, sp);

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={[palette.danger, palette.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Emergency Hub</Text>
        <Text style={styles.headerSub}>Quick access to emergency services</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* SOS Button */}
        <View style={styles.sosContainer}>
          <TouchableOpacity
            style={[styles.sosButton, sendingSOS && styles.sosButtonDisabled]}
            onPress={handleSOS}
            disabled={sendingSOS}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {sendingSOS ? (
              <ActivityIndicator color={palette.ivory} size="large" />
            ) : (
              <>
                <KISIcon name="warning" size={32} color={palette.ivory} focused />
                <Text style={styles.sosText}>SOS</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.sosHint}>Tap to send emergency alert</Text>
        </View>

        {/* Blood Type Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Blood Type Registry</Text>
          {loadingRegistry ? (
            <ActivityIndicator color={palette.primary} />
          ) : bloodRegistry ? (
            <View style={styles.bloodTypeDisplay}>
              <View style={styles.bloodTypeBadge}>
                <Text style={styles.bloodTypeText}>{bloodRegistry.blood_type}</Text>
              </View>
              <View style={styles.bloodTypeInfo}>
                <Text style={styles.bloodTypeName}>Your Blood Type</Text>
                <Text style={styles.bloodTypeStatus}>
                  {bloodRegistry.is_donor ? 'Registered as donor' : 'Not a donor'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.noBloodType}>
              <KISIcon name="warning" size={20} color={palette.subtext} />
              <Text style={styles.noBloodTypeText}>Blood type not registered</Text>
              <KISButton
                title={registeringBlood ? 'Registering…' : 'Register Your Type'}
                variant="outline"
                size="sm"
                disabled={registeringBlood}
                onPress={handleRegisterBlood}
              />
            </View>
          )}
        </View>

        {/* Blood Donor Search */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Find Blood Donors</Text>

          <Text style={styles.fieldLabel}>Blood Type</Text>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => setShowBloodTypePicker(!showBloodTypePicker)}
          >
            <Text style={styles.pickerText}>{searchBloodType}</Text>
            <KISIcon name="chevron-down" size={16} color={palette.subtext} />
          </TouchableOpacity>

          {showBloodTypePicker && (
            <View style={styles.bloodTypeGrid}>
              {BLOOD_TYPES.map((bt) => (
                <TouchableOpacity
                  key={bt}
                  style={[
                    styles.bloodTypeOption,
                    searchBloodType === bt && styles.bloodTypeOptionActive,
                  ]}
                  onPress={() => {
                    setSearchBloodType(bt);
                    setShowBloodTypePicker(false);
                  }}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Text style={[
                    styles.bloodTypeOptionText,
                    searchBloodType === bt && styles.bloodTypeOptionTextActive,
                  ]}>
                    {bt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.fieldLabel}>Country</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Nigeria"
            placeholderTextColor={palette.subtext}
            value={searchCountry}
            onChangeText={setSearchCountry}
          />

          <KISButton
            title="Search Donors"
            variant="secondary"
            size="md"
            loading={searchingDonors}
            left={<KISIcon name="search" size={16} color={palette.text} />}
            onPress={handleSearchDonors}
          />

          {donors.length > 0 && (
            <View style={styles.donorsList}>
              {donors.map((d) => (
                <View key={d.id} style={styles.donorRow}>
                  <View style={styles.donorBloodBadge}>
                    <Text style={styles.donorBloodText}>{d.blood_type}</Text>
                  </View>
                  <View style={styles.donorInfo}>
                    <Text style={styles.donorName}>{d.name}</Text>
                    <Text style={styles.donorCountry}>{d.country}</Text>
                  </View>
                  <Text style={styles.donorContact}>{d.contact}</Text>
                </View>
              ))}
            </View>
          )}

          {donors.length === 0 && !searchingDonors && searchCountry.trim() && (
            <Text style={styles.noResults}>No donors found. Try a different search.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, sp: number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, marginTop: 25 },
    header: {
      paddingHorizontal: sp,
      paddingTop: 16,
      paddingBottom: 20,
    },
    headerTitle: { fontSize: 26, fontWeight: '700', color: palette.ivory },
    headerSub: { fontSize: 13, color: palette.ivory, opacity: 0.8, marginTop: 2 },
    content: { padding: sp, gap: 16 },
    sosContainer: {
      alignItems: 'center',
      paddingVertical: 16,
      gap: 12,
    },
    sosButton: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: palette.danger,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 8,
      shadowColor: palette.danger,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      gap: 4,
    },
    sosButtonDisabled: { opacity: 0.6 },
    sosText: {
      fontSize: 22,
      fontWeight: '900',
      color: palette.ivory,
      letterSpacing: 2,
    },
    sosHint: { fontSize: 12, color: palette.subtext },
    card: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.divider,
      gap: 12,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: palette.text },
    bloodTypeDisplay: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    bloodTypeBadge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: palette.danger,
      justifyContent: 'center',
      alignItems: 'center',
    },
    bloodTypeText: { fontSize: 18, fontWeight: '800', color: palette.ivory },
    bloodTypeInfo: { flex: 1 },
    bloodTypeName: { fontSize: 15, fontWeight: '600', color: palette.text },
    bloodTypeStatus: { fontSize: 13, color: palette.subtext, marginTop: 2 },
    noBloodType: { alignItems: 'center', gap: 8, paddingVertical: 8 },
    noBloodTypeText: { fontSize: 14, color: palette.subtext },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: palette.text },
    pickerBtn: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.divider,
      paddingHorizontal: 12,
      minHeight: 44,
    },
    pickerText: { fontSize: 15, color: palette.text },
    bloodTypeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    bloodTypeOption: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
      minHeight: 36,
      justifyContent: 'center',
    },
    bloodTypeOptionActive: {
      backgroundColor: palette.danger + '22',
      borderColor: palette.danger,
    },
    bloodTypeOptionText: { fontSize: 13, color: palette.subtext },
    bloodTypeOptionTextActive: { color: palette.danger, fontWeight: '700' },
    input: {
      backgroundColor: palette.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.divider,
      padding: 12,
      color: palette.text,
      fontSize: 14,
      minHeight: 44,
    },
    donorsList: { gap: 10 },
    donorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderRadius: 10,
      padding: 10,
      gap: 10,
    },
    donorBloodBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: palette.danger + '22',
      justifyContent: 'center',
      alignItems: 'center',
    },
    donorBloodText: { fontSize: 11, fontWeight: '700', color: palette.danger },
    donorInfo: { flex: 1 },
    donorName: { fontSize: 13, fontWeight: '600', color: palette.text },
    donorCountry: { fontSize: 11, color: palette.subtext },
    donorContact: { fontSize: 12, color: palette.primary },
    noResults: { fontSize: 13, color: palette.subtext, textAlign: 'center' },
  });
}
