// src/screens/calls/CallJoinScreen.tsx
// Handles deep links of the form kis://call/join/:token
// Resolves the token → shows call preview → lets the user join.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
import { useSafeTopInset } from '@/hooks/useSafeTopInset';
import { isScheduledCallHost } from '@/screens/tabs/MesssagingSubTabs/callsTabHelpers';

type Props = NativeStackScreenProps<RootStackParamList, 'CallJoin'>;

type CallInfo = {
  callId: string;
  conversationId: string;
  callType: CallType;
  title: string | null;
  status: string;
  isStandalone: boolean;
  participantCount: number;
  createdBy?: string;
  isHost?: boolean;
  requiresApproval?: boolean;
};

export default function CallJoinScreen({ route, navigation }: Props) {
  const { token } = route.params;
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const topInset = useSafeTopInset();
  const { joinExistingCall, startScheduledCall, joinWaitingRoom, requestCallAdmission, currentUserId } = useSocket();

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

      if (isActive && callInfo.requiresApproval && !callInfo.isHost && requestCallAdmission) {
        // This link-holder has no prior relationship to the call (not the
        // host, not a conversation member, not personally invited) - enter
        // the admission-request flow instead of joining media directly.
        // See requestCallAdmission's own doc comment: no WebRTC/media setup
        // happens until the host actually admits them.
        joined = await requestCallAdmission({
          callId: callInfo.callId,
          conversationId: callInfo.conversationId,
          callType: callInfo.callType,
          title: callInfo.title ?? callTypeLabel(callInfo.callType),
          silentOnFailure: true,
        });
      } else if (isActive && joinExistingCall) {
        joined = await joinExistingCall({
          callId: callInfo.callId,
          conversationId: callInfo.conversationId,
          callType: callInfo.callType,
          title: callInfo.title ?? callTypeLabel(callInfo.callType),
          // This screen's own 'error' phase below already shows a
          // dedicated, dismissible failure state — without this,
          // joinExistingCall's generic native Alert fired on top of it too.
          silentOnFailure: true,
        });
      } else if (isScheduledCallHost(callInfo, currentUserId) && startScheduledCall) {
        // The host opening their own scheduled call's invite link starts
        // THAT call (same callId, rings every stored invitee) — not a
        // brand-new one, which is what the old startCall() call here did.
        joined = await startScheduledCall({
          callId: callInfo.callId,
          conversationId: callInfo.conversationId,
          callType: callInfo.callType,
          title: callInfo.title ?? callTypeLabel(callInfo.callType),
          silentOnFailure: true,
        });
      } else if (joinWaitingRoom) {
        // Anyone else opening a not-yet-started scheduled call's link
        // enters the real waiting room (no media access) until the host
        // starts it — see call.waiting.join / CALL_HOST_JOINED.
        joined = await joinWaitingRoom({
          callId: callInfo.callId,
          conversationId: callInfo.conversationId,
          callType: callInfo.callType,
          title: callInfo.title ?? callTypeLabel(callInfo.callType),
          silentOnFailure: true,
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
  }, [callInfo, joinExistingCall, startScheduledCall, joinWaitingRoom, requestCallAdmission, currentUserId, navigation]);

  const icon = callInfo ? callTypeIcon(callInfo.callType) : 'phone';
  const typeLabel = callInfo ? callTypeLabel(callInfo.callType) : '';
  const callTitle = callInfo?.title || typeLabel;

  return (
    // AND-100: pushed as an ordinary stack screen, this rendered inside the
    // normal React Navigation view hierarchy — but RN's <Modal> component
    // (used throughout ChatRoomPage for attachment/options sheets) always
    // renders in its own native window/dialog layer *outside* that
    // hierarchy, on top of every regular screen regardless of navigation
    // order. If a chat-room Modal was already open when this screen was
    // pushed (e.g. tapping an invite link while an attachment sheet was up),
    // this screen had no way to ever render above it. Wrapping this screen's
    // own content in a <Modal> too puts it in that same native layer, so
    // whichever was presented most recently — this join screen — wins, the
    // same way any other screen-over-screen native modal stacking works.
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={() => navigation.replace('MainTabs')}
    >
    <View style={[styles.root, { paddingTop: topInset, backgroundColor: palette.bg, }]}>
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
              accessibilityRole="button"
              accessibilityLabel="Join call"
            >
              <KISIcon name="phone" size={20} color={palette.ivory} />
              <Text style={[styles.joinText, { color: palette.ivory }]}>Join call</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.replace('MainTabs')}
              style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.6 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Not now"
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
              accessibilityRole="button"
              accessibilityLabel="Go home"
            >
              <Text style={[styles.joinText, { color: palette.text }]}>Go Home</Text>
            </Pressable>
          </>
        )}
      </Animated.View>
    </View>
    </Modal>
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
