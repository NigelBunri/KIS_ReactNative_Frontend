// src/screens/PasswordChangeScreen.tsx
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

export default function PasswordChangeScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const responsive = useResponsiveLayout();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const styles = useMemo(() => createStyles(palette, responsive.contentMaxWidth), [palette, responsive.contentMaxWidth]);

  const handleSubmit = async () => {
    if (!currentPassword.trim()) {
      Alert.alert('Password change', 'Enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Password change', 'New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Password change', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await postRequest(
        ROUTES.auth.passwordChange,
        { current_password: currentPassword, new_password: newPassword },
        { errorMessage: 'Unable to change password.' },
      );
      if (!res.success) {
        throw new Error(res.message || 'Unable to change password.');
      }
      Alert.alert('Password updated', 'Your password has been changed.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Password change', err?.message || 'Unable to change password.');
    } finally {
      setLoading(false);
    }
  };

  const PasswordField = ({
    label,
    value,
    onChangeText,
    show,
    onToggle,
  }: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    show: boolean;
    onToggle: () => void;
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: palette.subtext }]}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: palette.surfaceElevated,
            borderColor: palette.divider,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: palette.text }]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={palette.subtext}
          placeholder="••••••••"
        />
        <Pressable onPress={onToggle} style={styles.eyeButton}>
          <KISIcon
            name={show ? 'eye-off' : 'eye'}
            size={20}
            color={palette.subtext}
          />
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg, marginTop: 25 }]}>
      <View
        style={[
          styles.header,
          { borderBottomColor: palette.divider },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <KISIcon name="chevron-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          Change Password
        </Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
          <PasswordField
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            show={showCurrent}
            onToggle={() => setShowCurrent(v => !v)}
          />
          <PasswordField
            label="New password (8+ characters)"
            value={newPassword}
            onChangeText={setNewPassword}
            show={showNew}
            onToggle={() => setShowNew(v => !v)}
          />
          <PasswordField
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            show={showConfirm}
            onToggle={() => setShowConfirm(v => !v)}
          />
        </View>

        <Pressable
          style={[
            styles.submitButton,
            {
              backgroundColor: palette.primary,
              opacity: loading ? 0.6 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={palette.onPrimary} />
          ) : (
            <Text style={styles.submitButtonText}>Update Password</Text>
          )}
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (palette: ReturnType<typeof useKISTheme>['palette'], contentMaxWidth: number) =>
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
      padding: 18,
      gap: 16,
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
    },
    card: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 18,
      gap: 18,
    },
    fieldGroup: {
      gap: 6,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 14,
    },
    input: {
      flex: 1,
      fontSize: 16,
      paddingVertical: 12,
    },
    eyeButton: {
      padding: 6,
    },
    submitButton: {
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },
    submitButtonText: {
      color: palette.onPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
  });
