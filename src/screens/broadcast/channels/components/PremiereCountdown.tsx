// src/screens/broadcast/channels/components/PremiereCountdown.tsx
//
// Full-screen premiere countdown overlay. Shows a live DD:HH:MM:SS timer,
// a "Set Reminder" button, optional pre-chat and trailer buttons. When the
// countdown reaches zero, shows a "Going Live Now!" + "Watch Now" state.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  contentId: string;
  thumbnailUrl?: string;
  channelName: string;
  scheduledAt: string;       // ISO date string
  preChatOpensAt?: string | null;
  trailerUrl?: string;
  onBack: () => void;
  onWatch: () => void;
  onSetReminder: () => void;
  onJoinPreChat: (lobbyConversationId?: string) => void;
  onWatchTrailer?: (trailerUrl: string) => void;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00:00:00';
  const days    = Math.floor(totalSeconds / 86400);
  const hours   = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function secondsUntil(isoDate: string): number {
  return Math.max(0, Math.floor((new Date(isoDate).getTime() - Date.now()) / 1000));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PremiereCountdown({
  contentId,
  thumbnailUrl,
  channelName,
  scheduledAt,
  preChatOpensAt,
  trailerUrl,
  onBack,
  onWatch,
  onSetReminder,
  onJoinPreChat,
  onWatchTrailer,
}: Props) {
  const { palette } = useKISTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const [remaining, setRemaining] = useState(() => secondsUntil(scheduledAt));
  const isLive = remaining <= 0;
  const [reminderSet, setReminderSet] = useState(false);
  const [settingReminder, setSettingReminder] = useState(false);

  const preChatOpen =
    !!preChatOpensAt &&
    Date.now() >= new Date(preChatOpensAt).getTime();

  const handleSetReminder = useCallback(async () => {
    if (settingReminder || reminderSet) return;
    setSettingReminder(true);
    try {
      await postRequest(
        ROUTES.broadcasts.contentPremiere(contentId),
        { notify: true },
        { errorMessage: '' },
      );
      setReminderSet(true);
      onSetReminder();
      Alert.alert('Reminder set', 'We\'ll notify you before this premiere starts.');
    } catch {
      Alert.alert('Error', 'Could not set reminder. Please try again.');
    } finally {
      setSettingReminder(false);
    }
  }, [contentId, settingReminder, reminderSet, onSetReminder]);

  useEffect(() => {
    if (isLive) return;
    const id = setInterval(() => {
      const secs = secondsUntil(scheduledAt);
      setRemaining(secs);
      if (secs <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [scheduledAt, isLive]);

  const Inner = (
    <View style={[styles.inner, { paddingTop: 16 + insets.top, paddingBottom: 16 + insets.bottom }]}>
      {/* Back */}
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.centerContent}>
        {/* Channel name + PREMIERE badge */}
        <View style={styles.badgeRow}>
          <Text style={styles.channelName}>{channelName}</Text>
          <View style={[styles.premiereBadge, { backgroundColor: palette.gold }]}>
            <Text style={styles.premiereText}>PREMIERE</Text>
          </View>
        </View>

        {isLive ? (
          <>
            <Text style={styles.liveNow}>Going Live Now!</Text>
            <Pressable
              onPress={onWatch}
              style={[styles.watchBtn, { backgroundColor: palette.gold }]}
            >
              <Text style={styles.watchBtnText}>▶  Watch Now</Text>
            </Pressable>
          </>
        ) : (
          <>
            {/* Countdown */}
            <View style={styles.countdownBox}>
              <Text style={styles.countdownValue}>{formatCountdown(remaining)}</Text>
              <View style={styles.countdownLabels}>
                {['DD', 'HH', 'MM', 'SS'].map(lbl => (
                  <Text key={lbl} style={styles.countdownLabel}>{lbl}</Text>
                ))}
              </View>
            </View>

            {/* Set Reminder */}
            <Pressable
              onPress={handleSetReminder}
              disabled={settingReminder || reminderSet}
              style={[styles.reminderBtn, { borderColor: palette.divider, opacity: reminderSet ? 0.6 : 1 }]}
            >
              {settingReminder ? (
                <ActivityIndicator size="small" color={palette.ivory} />
              ) : (
                <Text style={styles.reminderText}>
                  {reminderSet ? '🔔  Reminder Set' : '🔔  Set Reminder'}
                </Text>
              )}
            </Pressable>
          </>
        )}

        {/* Pre-chat button */}
        {preChatOpen && (
          <Pressable
            onPress={() => onJoinPreChat()}
            style={[styles.preChatBtn, { backgroundColor: palette.primaryWeak }]}
          >
            <Text style={styles.preChatText}>💬  Join Pre-chat</Text>
          </Pressable>
        )}

        {/* Trailer button */}
        {!!trailerUrl && (
          <Pressable
            onPress={() => {
              if (onWatchTrailer) {
                onWatchTrailer(trailerUrl);
              }
            }}
            style={styles.trailerBtn}
          >
            <Text style={[styles.trailerText, { color: palette.gold }]}>
              ▶  Watch Trailer
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  if (thumbnailUrl) {
    return (
      <ImageBackground
        source={{ uri: thumbnailUrl }}
        style={styles.container}
        blurRadius={10}
      >
        <View style={styles.dimOverlay} />
        {Inner}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.royalInk }]}>
      {Inner}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(p: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    dimOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: p.royalInk,
      opacity: 0.75,
    },
    inner: {
      flex: 1,
      paddingHorizontal: 24,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    backArrow: { color: p.ivory, fontSize: 24, lineHeight: 26 },
    backText: { color: p.ivory, fontSize: 15, fontWeight: '600' },
    centerContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 18,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    channelName: {
      color: p.ivory,
      fontSize: 18,
      fontWeight: '700',
    },
    premiereBadge: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    premiereText: {
      color: p.onPrimary,
      fontWeight: '900',
      fontSize: 11,
      letterSpacing: 1.5,
    },
    countdownBox: {
      alignItems: 'center',
      gap: 6,
    },
    countdownValue: {
      color: p.ivory,
      fontSize: 44,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      letterSpacing: 2,
    },
    countdownLabels: {
      flexDirection: 'row',
      gap: 28,
    },
    countdownLabel: {
      color: p.subtext,
      fontSize: 11,
      fontWeight: '600',
      width: 24,
      textAlign: 'center',
    },
    liveNow: {
      color: p.ivory,
      fontSize: 28,
      fontWeight: '800',
    },
    watchBtn: {
      borderRadius: 12,
      paddingHorizontal: 36,
      paddingVertical: 14,
      alignItems: 'center',
    },
    watchBtnText: {
      color: p.onPrimary,
      fontWeight: '800',
      fontSize: 16,
    },
    reminderBtn: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 28,
      paddingVertical: 12,
    },
    reminderText: {
      color: p.ivory,
      fontWeight: '700',
      fontSize: 15,
    },
    preChatBtn: {
      borderRadius: 12,
      paddingHorizontal: 24,
      paddingVertical: 10,
    },
    preChatText: {
      color: p.ivory,
      fontWeight: '600',
      fontSize: 14,
    },
    trailerBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    trailerText: {
      fontWeight: '700',
      fontSize: 14,
    },
  });
}
