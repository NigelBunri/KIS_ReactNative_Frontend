// src/screens/calls/CallJoinScreen.tsx
// Handles deep links of the form kis://call/join/:token
// Resolves the token → shows call preview → lets the user join.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { useSocket } from '../../../SocketProvider';
import { callTypeLabel, callTypeIcon } from '@/services/calls/callTypes';
import type { CallType } from '@/services/calls/callTypes';

type Props = NativeStackScreenProps<RootStackParamList, 'CallJoin'>;

type CallInfo = {
  callId: string;
  conversationId: string;
  callType: CallType;
  title: string | null;
  status: string;
  isStandalone: boolean;
  participantCount: number;
};

export default function CallJoinScreen({ route, navigation }: Props) {
  const { token } = route.params;
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { joinExistingCall, startCall } = useSocket();

  const [phase, setPhase] = useState<'loading' | 'preview' | 'joining' | 'error'>('loading');
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();

    const resolve = async () => {
      try {
        const res = await getRequest(ROUTES.calls.joinByToken(token));
        if (!res.success || !res.data?.callId) {
          setErrorMsg(res.data?.detail ?? res.message ?? 'This invite link is invalid or has expired.');
          setPhase('error');
          return;
        }
        const data = res.data as CallInfo;
        if (data.status === 'ended' || data.status === 'missed') {
          setErrorMsg('This call has already ended.');
          setPhase('error');
          return;
        }
        setCallInfo(data);
        setPhase('preview');
      } catch {
        setErrorMsg('Could not load call information. Please check your connection.');
        setPhase('error');
      }
    };

    void resolve();
  }, [token, fadeAnim]);

  const handleJoin = useCallback(async () => {
    if (!callInfo) return;
    setPhase('joining');
    try {
      const isActive = callInfo.status === 'active' || callInfo.status === 'ongoing' || callInfo.status === 'ringing';
      let joined = false;

      if (isActive && joinExistingCall) {
        joined = await joinExistingCall({
          callId: callInfo.callId,
          conversationId: callInfo.conversationId,
          callType: callInfo.callType,
          title: callInfo.title ?? callTypeLabel(callInfo.callType),
        });
      } else if (startCall) {
        joined = await startCall({
          conversationId: callInfo.conversationId,
          title: callInfo.title ?? callTypeLabel(callInfo.callType),
          callType: callInfo.callType,
          inviteeUserIds: [],
          inviteToken: token,
        });
      }

      if (joined) {
        navigation.replace('MainTabs');
      } else {
        setErrorMsg('Unable to join the call right now. Please try again.');
        setPhase('error');
      }
    } catch {
      setErrorMsg('Something went wrong joining the call.');
      setPhase('error');
    }
  }, [callInfo, joinExistingCall, startCall, token, navigation]);

  const icon = callInfo ? callTypeIcon(callInfo.callType) : 'phone';
  const typeLabel = callInfo ? callTypeLabel(callInfo.callType) : '';
  const callTitle = callInfo?.title || typeLabel;

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: palette.bg }]}>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: palette.card,
            opacity: fadeAnim,
            maxWidth: responsive.contentMaxWidth,
            shadowColor: palette.royalInk,
          },
        ]}
      >
        {phase === 'loading' && (
          <>
            <ActivityIndicator size="large" color={palette.primary} style={{ marginBottom: 20 }} />
            <Text style={[styles.title, { color: palette.text }]}>Loading call…</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>Verifying your invite link</Text>
          </>
        )}

        {phase === 'preview' && callInfo && (
          <>
            {/* Call type icon */}
            <View style={[styles.iconCircle, { backgroundColor: `${palette.success}18` }]}>
              <KISIcon name={icon} size={40} color={palette.success} />
            </View>

            <Text style={[styles.title, { color: palette.text }]}>{callTitle}</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              {typeLabel}
              {callInfo.participantCount > 0
                ? ` · ${callInfo.participantCount} participant${callInfo.participantCount !== 1 ? 's' : ''}`
                : ''}
            </Text>

            <View style={[styles.statusBadge, { backgroundColor: `${palette.success}18`, borderColor: `${palette.success}40` }]}>
              <View style={[styles.liveDot, { backgroundColor: palette.success }]} />
              <Text style={[styles.statusText, { color: palette.success }]}>
                {callInfo.status === 'pending' ? 'Scheduled' : 'Live now'}
              </Text>
            </View>

            <Pressable
              onPress={handleJoin}
              style={({ pressed }) => [
                styles.joinBtn,
                { backgroundColor: palette.success, opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityLabel="Join call"
            >
              <KISIcon name="phone" size={20} color={palette.ivory} />
              <Text style={[styles.joinText, { color: palette.ivory }]}>Join call</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.replace('MainTabs')}
              style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.cancelText, { color: palette.subtext }]}>Not now</Text>
            </Pressable>
          </>
        )}

        {phase === 'joining' && (
          <>
            <ActivityIndicator size="large" color={palette.success} style={{ marginBottom: 20 }} />
            <Text style={[styles.title, { color: palette.text }]}>Joining…</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>Setting up your connection</Text>
          </>
        )}

        {phase === 'error' && (
          <>
            <KISIcon name="close-circle" size={64} color={palette.danger} />
            <Text style={[styles.title, { color: palette.text }]}>Can't join</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>{errorMsg}</Text>
            <Pressable
              onPress={() => navigation.replace('MainTabs')}
              style={({ pressed }) => [
                styles.joinBtn,
                { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.inputBorder, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.joinText, { color: palette.text }]}>Go Home</Text>
            </Pressable>
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    gap: 12,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginVertical: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
    width: '100%',
  },
  joinText: {
    fontSize: 17,
    fontWeight: '800',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
