import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

type Props = NativeStackScreenProps<RootStackParamList, 'PartnerRedeemInvite'>;

export default function PartnerRedeemInviteScreen({ route, navigation }: Props) {
  const { palette } = useKISTheme();
  const topInset = useSafeTopInset();
  const [code, setCode] = useState(route.params?.code ?? '');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    if (route.params?.code) {
      handleRedeem(route.params.code);
    }
  }, []);

  const handleRedeem = async (overrideCode?: string) => {
    const value = (overrideCode ?? code).trim().toUpperCase();
    if (!value) {
      setStatus('error');
      setMessage('Please enter an invite code.');
      return;
    }
    setLoading(true);
    setStatus('idle');
    const res = await postRequest(ROUTES.partners.redeemInvite, { code: value });
    setLoading(false);

    if (res?.success || res?.detail) {
      setStatus('success');
      setMessage(res?.detail ?? 'You have joined the organisation!');
    } else {
      setStatus('error');
      setMessage(res?.message ?? res?.detail ?? 'Invalid or expired invite code.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topInset, backgroundColor: palette.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.View style={[styles.card, { backgroundColor: palette.surface, opacity: fadeAnim, shadowColor: palette.royalInk }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => ({
            opacity: pressed ? 0.6 : 1,
            alignSelf: 'flex-start',
            marginBottom: 12,
            minHeight: 44,
            minWidth: 44,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Text style={{ color: palette.primary, fontSize: 16 }}>‹ Back</Text>
        </Pressable>

        <Text style={[styles.title, { color: palette.text }]}>Join with Invite Code</Text>
        <Text style={[styles.subtitle, { color: palette.subtext }]}>
          Enter the invite code you received to join a partner organisation.
        </Text>

        {status !== 'success' ? (
          <>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: palette.inputBackground ?? palette.surfaceElevated,
                  borderColor: status === 'error' ? palette.danger : palette.borderMuted,
                  color: palette.text,
                },
              ]}
              value={code}
              onChangeText={(t) => { setCode(t.toUpperCase()); setStatus('idle'); }}
              placeholder="e.g. ABCD-1234"
              placeholderTextColor={palette.placeholder ?? palette.subtext}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => handleRedeem()}
              editable={!loading}
            />

            {status === 'error' && (
              <Text style={[styles.errorText, { color: palette.danger }]}>{message}</Text>
            )}

            <Pressable
              onPress={() => handleRedeem()}
              disabled={loading}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: palette.primary, opacity: loading || pressed ? 0.7 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={palette.onPrimary} />
              ) : (
                <Text style={[styles.btnText, { color: palette.onPrimary }]}>
                  Redeem Code
                </Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.successIcon, { color: palette.success }]}>✓</Text>
            <Text style={[styles.successText, { color: palette.success }]}>
              {message}
            </Text>
            <Pressable
              onPress={() => navigation.replace('MainTabs')}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: palette.primary, opacity: pressed ? 0.8 : 1, marginTop: 8 },
              ]}
            >
              <Text style={[styles.btnText, { color: palette.onPrimary }]}>
                Continue
              </Text>
            </Pressable>
          </>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    padding: 28,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  btn: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  successIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 8,
  },
  successText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
});
