// src/screens/calls/LobbyScreen.tsx
// Pre-join lobby — shown before entering a group/broadcast call.
// Lets the user preview their camera and toggle mic/camera before joining.

import React, { useEffect, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { webRTCService, RTCView, webRTCAvailable } from '@/services/calls/webRTCService';
import type { CallType } from '@/services/calls/callTypes';
import { callTypeLabel } from '@/services/calls/callTypes';

type Props = {
  visible: boolean;
  callType: CallType;
  title: string;
  participantCount: number;
  onJoin: (opts: { withVideo: boolean; withMic: boolean }) => void;
  onDecline: () => void;
};

export default function LobbyScreen({
  visible,
  callType,
  title,
  participantCount,
  onJoin,
  onDecline,
}: Props) {
  const { palette } = useKISTheme();
  const [localStream, setLocalStream] = useState<any>(null);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(
    callType === 'video' || callType === 'video-group',
  );
  const [loading, setLoading] = useState(true);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let stream: any = null;
    let cancelled = false;
    setLoading(true);
    const needsVideo = callType === 'video' || callType === 'video-group';
    // Use a SEPARATE getUserMedia rather than webRTCService.startLocalStream so
    // the lobby preview doesn't claim the singleton stream and race with answerCall.
    let RNW: any = null;
    try { RNW = require('react-native-webrtc'); } catch {}

    if (RNW?.mediaDevices) {
      RNW.mediaDevices.getUserMedia({
        audio: true,
        video: needsVideo ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false,
      }).then((s: any) => {
        if (cancelled) { try { s.getTracks?.().forEach?.((t: any) => t.stop()); } catch {} return; }
        stream = s;
        setLocalStream(s);
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
      // Release the independent preview stream — does not touch webRTCService.
      try { stream?.getTracks?.()?.forEach?.((t: any) => t.stop()); } catch {}
      setLocalStream(null);
    };
  }, [visible, callType]);

  const handleMicToggle = () => {
    const next = !micOn;
    setMicOn(next);
    localStream?.getAudioTracks?.()?.forEach((t: any) => { t.enabled = next; });
  };

  const handleVideoToggle = () => {
    const next = !videoOn;
    setVideoOn(next);
    localStream?.getVideoTracks?.()?.forEach((t: any) => { t.enabled = next; });
  };

  const hasVideo = callType === 'video' || callType === 'video-group';
  const peopleText = participantCount === 0
    ? 'Be the first to join'
    : participantCount === 1
    ? '1 person in the call'
    : `${participantCount} people in the call`;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: palette.bg, marginTop: 25 }]}>
        <SafeAreaView style={styles.safe}>

          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={onDecline}
              hitSlop={12}
              style={[styles.closeBtn, { backgroundColor: palette.surface }]}
              accessibilityLabel="Leave lobby"
            >
              <KISIcon name="close" size={18} color={palette.text} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={[styles.headerSub, { color: palette.subtext }]}>
                {callTypeLabel(callType)}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Camera preview */}
          <View style={styles.previewSection}>
            <View style={[styles.preview, { backgroundColor: palette.royalInk }]}>
              {loading ? (
                <ActivityIndicator size="large" color={palette.gold} />
              ) : localStream && RTCView && hasVideo && videoOn ? (
                <RTCView
                  streamURL={localStream.toURL()}
                  style={StyleSheet.absoluteFill}
                  objectFit="cover"
                  mirror
                  zOrder={1}
                />
              ) : (
                <Animated.View
                  style={[styles.noVideoPlaceholder, { transform: [{ scale: pulseAnim }] }]}
                >
                  <View style={[styles.avatarCircle, { backgroundColor: palette.goldDeep, borderColor: palette.gold }]}>
                    <KISIcon name="person" size={48} color={palette.gold} />
                  </View>
                  <Text style={[styles.noVideoText, { color: palette.subtext }]}>
                    {!hasVideo ? 'Voice call' : 'Camera off'}
                  </Text>
                </Animated.View>
              )}

              {/* Overlay badges */}
              <View style={styles.previewBadges} pointerEvents="none">
                {!micOn && (
                  <View style={[styles.badge, { backgroundColor: `${palette.danger}CC` }]}>
                    <KISIcon name="mic-off" size={13} color={palette.ivory} />
                    <Text style={[styles.badgeText, { color: palette.ivory }]}>Muted</Text>
                  </View>
                )}
                {!webRTCAvailable && (
                  <View style={[styles.badge, { backgroundColor: `${palette.gold}CC` }]}>
                    <Text style={[styles.badgeText, { color: palette.royalInk }]}>Preview unavailable</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Participant count */}
            <View style={[styles.participantRow, { backgroundColor: palette.surface }]}>
              <KISIcon name="people" size={15} color={palette.subtext} />
              <Text style={[styles.participantText, { color: palette.subtext }]}>{peopleText}</Text>
            </View>
          </View>

          {/* Controls row */}
          <View style={styles.controlsRow}>
            <LobbyToggle
              icon={micOn ? 'mic' : 'mic-off'}
              label={micOn ? 'Mic on' : 'Muted'}
              active={micOn}
              danger={!micOn}
              onPress={handleMicToggle}
              palette={palette}
            />
            {hasVideo && (
              <LobbyToggle
                icon={videoOn ? 'video' : 'video-off'}
                label={videoOn ? 'Camera on' : 'Camera off'}
                active={videoOn}
                danger={!videoOn}
                onPress={handleVideoToggle}
                palette={palette}
              />
            )}
          </View>

          {/* Join button */}
          <View style={styles.joinSection}>
            <Pressable
              onPress={() => onJoin({ withVideo: hasVideo && videoOn, withMic: micOn })}
              accessibilityLabel="Join call"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.joinBtn,
                { backgroundColor: palette.gold },
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              ]}
            >
              <KISIcon name={hasVideo && videoOn ? 'video' : 'phone'} size={20} color={palette.royalInk} />
              <Text style={[styles.joinText, { color: palette.royalInk }]}>Join now</Text>
            </Pressable>

            <Pressable onPress={onDecline} style={styles.cancelBtn} hitSlop={8}>
              <Text style={[styles.cancelText, { color: palette.subtext }]}>Cancel</Text>
            </Pressable>
          </View>

        </SafeAreaView>
      </View>
    </Modal>
  );
}

function LobbyToggle({
  icon, label, active, danger, onPress, palette,
}: {
  icon: string;
  label: string;
  active: boolean;
  danger?: boolean;
  onPress: () => void;
  palette: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.toggleBtn,
        {
          backgroundColor: active
            ? `${palette.gold}26`
            : danger
            ? `${palette.danger}1A`
            : palette.surface,
          borderColor: active
            ? `${palette.gold}60`
            : danger
            ? `${palette.danger}40`
            : palette.inputBorder,
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <KISIcon
        name={icon}
        size={22}
        color={active ? palette.gold : danger ? palette.danger : palette.subtext}
      />
      <Text style={[styles.toggleLabel, { color: active ? palette.gold : danger ? palette.danger : palette.subtext }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 20 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSub: { fontSize: 12, fontWeight: '500' },

  previewSection: { flex: 1, gap: 12 },
  preview: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
  },
  noVideoPlaceholder: { alignItems: 'center', gap: 16 },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noVideoText: { fontSize: 14, fontWeight: '600' },
  previewBadges: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  participantText: { fontSize: 13, fontWeight: '600' },

  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 18,
  },
  toggleBtn: {
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 14,
    minWidth: 110,
  },
  toggleLabel: { fontSize: 12, fontWeight: '700' },

  joinSection: { paddingBottom: 16, gap: 12, alignItems: 'center' },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 32,
    width: '100%',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 12,
  },
  joinText: { fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { fontSize: 14, fontWeight: '600' },
});
