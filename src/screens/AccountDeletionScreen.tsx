// src/screens/AccountDeletionScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { deleteRequest } from '@/network/delete';
import { API_BASE_URL } from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import { useAuth } from '../../App';

export default function AccountDeletionScreen() {
  const { palette } = useKISTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { setAuth } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const styles = useMemo(() => createStyles(palette), [palette]);

  const handleDelete = async () => {
    if (confirmText.trim() !== 'DELETE') {
      Alert.alert('Confirmation required', 'Type DELETE to confirm.');
      return;
    }
    Alert.alert(
      'Delete account',
      'This cannot be undone. All your data will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const deleteRes = await deleteRequest(
                `${API_BASE_URL}/api/v1/auth/account/`,
                { errorMessage: 'Unable to delete account.' },
              );
              if (!deleteRes.success) {
                throw new Error(deleteRes.message || 'Unable to delete account.');
              }
              await AsyncStorage.clear();
              setAuth(false);
            } catch (err: any) {
              Alert.alert('Delete account', err?.message || 'Unable to delete account.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <KISIcon name="chevron-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          Delete Account
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.warningCard, { backgroundColor: palette.surface, borderColor: palette.danger }]}>
          <KISIcon name="shield" size={28} color={palette.danger} />
          <Text style={[styles.warningTitle, { color: palette.danger }]}>
            Permanent account deletion
          </Text>
          <View style={styles.consequenceList}>
            {[
              'All your profile data, posts, and media will be permanently removed.',
              'This action cannot be reversed — there is no recovery option.',
              'Partner accounts and organisations you own will also be affected.',
              'Active subscriptions and wallet balances will be forfeited.',
            ].map(line => (
              <View key={line} style={styles.consequenceRow}>
                <View style={[styles.dot, { backgroundColor: palette.danger }]} />
                <Text style={[styles.consequenceText, { color: palette.text }]}>
                  {line}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.confirmCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
          <Text style={[styles.confirmLabel, { color: palette.subtext }]}>
            Type{' '}
            <Text style={{ color: palette.danger, fontWeight: '800' }}>
              DELETE
            </Text>{' '}
            to confirm
          </Text>
          <TextInput
            style={[
              styles.confirmInput,
              {
                color: palette.text,
                backgroundColor: palette.surfaceElevated,
                borderColor: confirmText === 'DELETE' ? palette.danger : palette.divider,
              },
            ]}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="Type DELETE here"
            placeholderTextColor={palette.subtext}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>

        <Pressable
          style={[
            styles.deleteButton,
            {
              backgroundColor:
                confirmText === 'DELETE' ? palette.danger : palette.divider,
              opacity: loading ? 0.6 : 1,
            },
          ]}
          onPress={handleDelete}
          disabled={loading || confirmText.trim() !== 'DELETE'}
        >
          <Text style={[styles.deleteButtonText, { color: '#FFFFFF' }]}>
            {loading ? 'Deleting...' : 'Delete my account'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (palette: ReturnType<typeof useKISTheme>['palette']) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      padding: 18,
      gap: 16,
    },
    warningCard: {
      borderRadius: 20,
      borderWidth: 1.5,
      padding: 18,
      gap: 12,
      alignItems: 'flex-start',
    },
    warningTitle: {
      fontSize: 18,
      fontWeight: '800',
    },
    consequenceList: {
      gap: 10,
      width: '100%',
    },
    consequenceRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginTop: 6,
    },
    consequenceText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 21,
      fontWeight: '600',
    },
    confirmCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
      gap: 10,
    },
    confirmLabel: {
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },
    confirmInput: {
      borderRadius: 12,
      borderWidth: 1.5,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 1,
    },
    deleteButton: {
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },
    deleteButtonText: {
      fontSize: 16,
      fontWeight: '800',
    },
  });
