// src/screens/AccountDeletionScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import { useAuth } from '../../App';

export default function AccountDeletionScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { setAuth } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const styles = useMemo(() => createStyles(palette), [palette]);

  const handleDelete = async () => {
    if (confirmText.trim() !== 'DELETE') {
      Alert.alert('Confirmation required', 'Type DELETE to confirm.');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Password required', 'Enter your current password to confirm deletion.');
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
                ROUTES.auth.accountDelete,
                { errorMessage: 'Unable to delete account.', body: { password: password.trim() } },
              );
              if (deleteRes && (deleteRes as any).success === false) {
                const msg = (deleteRes as any).message || (deleteRes as any).data?.detail || 'Unable to delete account.';
                Alert.alert('Delete account', msg);
                return;
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
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg, }]}>
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

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.content, { padding: responsive.pageGutter, maxWidth: responsive.contentMaxWidth, width: '100%', alignSelf: 'center' }]} keyboardShouldPersistTaps="handled">
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

          <Text style={[styles.confirmLabel, { color: palette.subtext, marginTop: 12 }]}>
            Current password
          </Text>
          <View style={[styles.passwordRow, { backgroundColor: palette.surfaceElevated, borderColor: password.trim() ? palette.danger : palette.divider }]}>
            <TextInput
              style={[styles.passwordInput, { color: palette.text }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={palette.subtext}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
              <Text style={{ color: palette.subtext, fontSize: 16 }}>{showPassword ? '🙈' : '👁'}</Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          style={[
            styles.deleteButton,
            {
              backgroundColor:
                confirmText === 'DELETE' && password.trim() ? palette.danger : palette.divider,
              opacity: loading ? 0.6 : 1,
            },
          ]}
          onPress={handleDelete}
          disabled={loading || confirmText.trim() !== 'DELETE' || !password.trim()}
        >
          {loading ? (
            <ActivityIndicator color={palette.onPrimary} />
          ) : (
            <Text style={[styles.deleteButtonText, { color: palette.onPrimary }]}>Delete my account</Text>
          )}
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
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
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
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
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1.5,
      paddingHorizontal: 14,
    },
    passwordInput: {
      flex: 1,
      fontSize: 15,
      paddingVertical: 12,
    },
    eyeBtn: {
      padding: 6,
    },
  });
