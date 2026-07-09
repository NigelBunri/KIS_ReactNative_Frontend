import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import { getRequest } from '@/network/get';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

type Props = NativeStackScreenProps<RootStackParamList, 'InviteJoin'>;

export default function InviteJoinScreen({ route, navigation }: Props) {
  const { type, token } = route.params;
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const topInset = useSafeTopInset();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [groupName, setGroupName] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
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
      const data = res?.data ?? res;
      const joinedOrAlready =
        res?.success ||
        String(data?.detail ?? '').toLowerCase().includes('joined') ||
        String(data?.detail ?? '').toLowerCase().includes('already');

      if (joinedOrAlready) {
        const entityId: string | null = data?.group_id ?? data?.community_id ?? null;

        // Fetch group/community details to get the name and conversation_id
        if (entityId) {
          try {
            const detailUrl =
              type === 'group'
                ? ROUTES.groups.detail(entityId)
                : ROUTES.community.detail(entityId);
            const detail = await getRequest(detailUrl);
            const d = detail?.data ?? detail;
            const name: string = d?.name ?? d?.title ?? '';
            const convId: string = d?.conversation_id
              ? String(d.conversation_id)
              : '';
            if (name) setGroupName(name);
            if (convId) setConversationId(convId);
          } catch {
            // non-fatal — continue without the extra info
          }
        }

        setStatus('success');
        setMessage(
          String(data?.detail ?? '').toLowerCase().includes('already')
            ? `You are already a member of this ${type}.`
            : `You have joined the ${type}!`,
        );
      } else {
        setStatus('error');
        setMessage(data?.detail ?? res?.message ?? 'The invite link may be invalid or expired.');
      }
    };

    join();
  }, [type, token, fadeAnim]);

  const handleContinue = () => {
    // Refresh the conversation list so the new group appears
    DeviceEventEmitter.emit('conversation.refresh');

    // Open the chat room directly if we have the conversation ID
    if (conversationId) {
      DeviceEventEmitter.emit('chat.open', {
        conversationId,
        name: groupName || type,
        kind: type === 'community' ? 'community' : 'group',
      });
    }

    navigation.replace('MainTabs');
  };

  const label = type === 'group' ? 'group' : 'community';
  const displayName = groupName ? `"${groupName}"` : label;

  return (
    <View style={[styles.container, { paddingTop: topInset, backgroundColor: palette.bg, }]}>
      <Animated.View style={[styles.card, { backgroundColor: palette.surface, opacity: fadeAnim, shadowColor: palette.royalInk, maxWidth: responsive.contentMaxWidth }]}>
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
            <KISIcon name="checkmark-circle" size={64} color={palette.success} />
            <Text style={[styles.title, { color: palette.text }]}>Welcome!</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              {message}{groupName ? `\n${displayName}` : ''}
            </Text>
            <Pressable
              onPress={handleContinue}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: palette.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: palette.onPrimary }]}>
                {conversationId ? 'Open Chat' : 'Continue'}
              </Text>
            </Pressable>
          </>
        )}

        {status === 'error' && (
          <>
            <KISIcon name="close" size={64} color={palette.danger} />
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
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
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
