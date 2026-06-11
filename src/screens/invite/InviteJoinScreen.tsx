import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';

type Props = NativeStackScreenProps<RootStackParamList, 'InviteJoin'>;

export default function InviteJoinScreen({ route, navigation }: Props) {
  const { type, token } = route.params;
  const { palette } = useKISTheme();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    const join = async () => {
      const url =
        type === 'group'
          ? ROUTES.groups.joinByInvite
          : ROUTES.community.joinByInvite;

      const res = await postRequest(url, { invite_token: token });

      if (res?.success || res?.group_id || res?.community_id || res?.detail) {
        const id = res?.group_id ?? res?.community_id ?? null;
        setTargetId(id);
        setStatus('success');
        setMessage(
          type === 'group'
            ? 'You have joined the group!'
            : 'You have joined the community!',
        );
      } else {
        setStatus('error');
        setMessage(res?.message ?? res?.detail ?? 'The invite link may be invalid or expired.');
      }
    };

    join();
  }, [type, token, fadeAnim]);

  const handleContinue = () => {
    navigation.replace('MainTabs');
  };

  const label = type === 'group' ? 'group' : 'community';

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Animated.View style={[styles.card, { backgroundColor: palette.surface, opacity: fadeAnim }]}>
        {status === 'loading' && (
          <>
            <ActivityIndicator size="large" color={palette.primary} style={{ marginBottom: 16 }} />
            <Text style={[styles.title, { color: palette.text }]}>Joining {label}…</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              Verifying your invite link
            </Text>
          </>
        )}

        {status === 'success' && (
          <>
            <Text style={[styles.icon]}>✓</Text>
            <Text style={[styles.title, { color: palette.text }]}>Welcome!</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>{message}</Text>
            <Pressable
              onPress={handleContinue}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: palette.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: palette.buttonText ?? '#fff' }]}>
                Continue
              </Text>
            </Pressable>
          </>
        )}

        {status === 'error' && (
          <>
            <Text style={styles.errorIcon}>✕</Text>
            <Text style={[styles.title, { color: palette.text }]}>Unable to join</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>{message}</Text>
            <Pressable
              onPress={() => navigation.replace('MainTabs')}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderMuted, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: palette.text }]}>Go Home</Text>
            </Pressable>
          </>
        )}
      </Animated.View>
    </View>
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
    maxWidth: 360,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
    color: '#22c55e',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
    color: '#ef4444',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  btn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 160,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
