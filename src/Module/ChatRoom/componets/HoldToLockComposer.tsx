// src/screens/chat/components/HoldToLockComposer.tsx

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Animated,
  Pressable,
} from 'react-native';

import { chatRoomStyles as styles } from '../chatRoomStyles';

import AudioRecorderPlayer, {
  RecordBackType,
  PlayBackType,
} from 'react-native-audio-recorder-player';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { KISIcon } from '@/constants/kisIcons';

// Single audio instance
const audioRecorderPlayer = new AudioRecorderPlayer();
audioRecorderPlayer.setSubscriptionDuration(0.1);

type HoldToLockComposerProps = {
  palette: any;
  disabled?: boolean;
  onSendVoice?: (payload: { uri: string; durationMs: number }) => void;
  setIsRecording: (e:boolean)=>void;
};

type VoiceMode = 'idle' | 'recordingHold' | 'recordingLocked' | 'preview';

const LOCK_THRESHOLD = -50; // drag up ~50px to lock

export const HoldToLockComposer: React.FC<HoldToLockComposerProps> = ({
  palette,
  disabled,
  onSendVoice,
  setIsRecording,
}) => {
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('idle');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordUri, setRecordUri] = useState<string | null>(null);

  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);

  const voiceModeRef = useRef<VoiceMode>('idle');
  const lockedRef = useRef(false);

  // Canonical refs for URI + duration in ms
  const recordUriRef = useRef<string | null>(null);
  const recordMsRef = useRef<number>(0);

  const micScale = useRef(new Animated.Value(1)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  const playListenerActiveRef = useRef(false);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  useEffect(() => {
    return () => {
      try {
        audioRecorderPlayer.stopRecorder();
        audioRecorderPlayer.removeRecordBackListener();
      } catch {}
      try {
        audioRecorderPlayer.stopPlayer();
        audioRecorderPlayer.removePlayBackListener();
      } catch {}
    };
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    const mm = m < 10 ? `0${m}` : `${m}`;
    const ss = s < 10 ? `0${s}` : `${s}`;
    return `${mm}:${ss}`;
  };

  /* ─────────────────────────────────────────
   * Recording
   * ──────────────────────────────────────── */

  const startRecording = async () => {
    if (disabled) return;
    if (voiceModeRef.current !== 'idle') return;

    try {
      lockedRef.current = false;
      setRecordSeconds(0);
      setRecordUri(null);
      recordUriRef.current = null;
      recordMsRef.current = 0;
      setPreviewProgress(0);
      setIsPlayingPreview(false);
      setIsRecording(true)

      setVoiceMode('recordingHold');

      Animated.spring(micScale, {
        toValue: 1.12,
        useNativeDriver: true,
      }).start();
      dragY.setValue(0);

      const uri = await audioRecorderPlayer.startRecorder();

      const effectiveUri = uri ?? recordUriRef.current ?? null;
      if (effectiveUri) {
        recordUriRef.current = effectiveUri;
        setRecordUri(effectiveUri);
      }

      audioRecorderPlayer.addRecordBackListener((e: RecordBackType) => {
        const ms = e.currentPosition ?? 0;
        recordMsRef.current = ms;
        const secs = Math.floor(ms / 1000);
        setRecordSeconds(secs);
        return;
      });
    } catch (err) {
      console.warn('startRecording error', err);
      setVoiceMode('idle');
      Animated.spring(micScale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  };

  // Core stop: stop recorder and return final URI
  const stopRecordingCore = async (): Promise<string | null> => {
    let uri: string | null = null;
    try {
      uri = (await audioRecorderPlayer.stopRecorder()) ?? null;
    } catch (err) {
      console.warn('stopRecorder error', err);
    }
    setIsRecording(false)

    try {
      audioRecorderPlayer.removeRecordBackListener();
    } catch {}

    const effectiveUri = uri ?? recordUriRef.current ?? recordUri ?? null;

    if (effectiveUri) {
      recordUriRef.current = effectiveUri;
      setRecordUri(effectiveUri);
    }

    return effectiveUri;
  };

  const stopRecordingToPreview = async () => {
    const uri = await stopRecordingCore();

    Animated.spring(micScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
    Animated.spring(dragY, {
      toValue: 0,
      useNativeDriver: true,
    }).start();

    const hasAudio = uri && recordMsRef.current > 0;
    setIsRecording(false)

    if (hasAudio) {
      setVoiceMode('preview');
      setIsPlayingPreview(false);
      setPreviewProgress(0);
    } else {
      // nothing useful recorded
      lockedRef.current = false;
      setVoiceMode('idle');
      setRecordSeconds(0);
      setRecordUri(null);
      recordUriRef.current = null;
      recordMsRef.current = 0;
    }
  };

  const cancelRecording = async () => {
    // Best-effort stop; ignore URI
    try {
      await audioRecorderPlayer.stopRecorder();
    } catch {}
    try {
      audioRecorderPlayer.removeRecordBackListener();
    } catch {}
    setIsRecording(false)

    Animated.spring(micScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
    Animated.spring(dragY, {
      toValue: 0,
      useNativeDriver: true,
    }).start();

    lockedRef.current = false;
    setVoiceMode('idle');
    setRecordSeconds(0);
    setRecordUri(null);
    recordUriRef.current = null;
    recordMsRef.current = 0;
    setIsPlayingPreview(false);
    setPreviewProgress(0);
  };

  /* ─────────────────────────────────────────
   * Preview playback
   * ──────────────────────────────────────── */

  const stopPreviewPlayback = async () => {
    try {
      await audioRecorderPlayer.stopPlayer();
      if (playListenerActiveRef.current) {
        audioRecorderPlayer.removePlayBackListener();
        playListenerActiveRef.current = false;
      }
    } catch (err) {
      console.warn('stop preview player error', err);
    }
    setIsRecording(false)
    setIsPlayingPreview(false);
    setPreviewProgress(0);
  };

  const startPreviewPlayback = async () => {
    const uri = recordUriRef.current ?? recordUri;
    if (!uri) return;

    try {
      setIsPlayingPreview(true);
      await audioRecorderPlayer.startPlayer(uri);
      playListenerActiveRef.current = true;

      const estimatedDur = recordMsRef.current > 0 ? recordMsRef.current : 1;

      audioRecorderPlayer.addPlayBackListener((e: PlayBackType) => {
        const pos = e.currentPosition ?? 0;
        const dur = e.duration ?? estimatedDur;
        const ratio = Math.min(1, pos / dur);
        setPreviewProgress(ratio);

        if (pos >= dur) {
          stopPreviewPlayback();
        }
        return;
      });
    } catch (err) {
      console.warn('start preview player error', err);
      setIsPlayingPreview(false);
      if (playListenerActiveRef.current) {
        audioRecorderPlayer.removePlayBackListener();
        playListenerActiveRef.current = false;
      }
    }
  };

  const togglePreviewPlayback = async () => {
    if (voiceMode !== 'preview') return;
    if (isPlayingPreview) {
      await stopPreviewPlayback();
    } else {
      await startPreviewPlayback();
    }
  };

  /* ─────────────────────────────────────────
   * Send / delete
   * ──────────────────────────────────────── */

  const resetStateAfterSendOrDelete = () => {
    lockedRef.current = false;
    setVoiceMode('idle');
    setRecordSeconds(0);
    setRecordUri(null);
    recordUriRef.current = null;
    recordMsRef.current = 0;
    setIsPlayingPreview(false);
    setPreviewProgress(0);
  };

  const handleSendFromPreview = async () => {
    if (isPlayingPreview) {
      await stopPreviewPlayback();
    }

    const uri = recordUriRef.current ?? recordUri;
    const durationMs = recordMsRef.current;

    if (uri && durationMs > 0 && onSendVoice) {
      onSendVoice({ uri, durationMs });
    }

    resetStateAfterSendOrDelete();
  };

  const handleDeleteFromPreview = async () => {
    if (isPlayingPreview) {
      await stopPreviewPlayback();
    }
    resetStateAfterSendOrDelete();
  };

  // When locked: stop recording, get final URI, then send directly
  const handleSendFromLocked = async () => {
    // Only stop if we are actually still recording
    if (
      voiceModeRef.current === 'recordingLocked' ||
      voiceModeRef.current === 'recordingHold'
    ) {
      await stopRecordingCore();
    }

    const uri = recordUriRef.current ?? recordUri;
    const durationMs = recordMsRef.current;

    if (uri && durationMs > 0 && onSendVoice) {
      onSendVoice({ uri, durationMs });
    }

    Animated.spring(micScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
    Animated.spring(dragY, {
      toValue: 0,
      useNativeDriver: true,
    }).start();

    resetStateAfterSendOrDelete();
  };

  const handleDeleteFromLocked = async () => {
    await cancelRecording();
  };

  /* ─────────────────────────────────────────
   * PanResponder: hold + pull to lock
   * ──────────────────────────────────────── */

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () =>
        !disabled && voiceModeRef.current === 'idle',
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        if (!disabled && voiceModeRef.current === 'idle') {
          startRecording();
        }
      },

      onPanResponderMove: (
        _evt: GestureResponderEvent,
        gesture: PanResponderGestureState,
      ) => {
        if (voiceModeRef.current === 'recordingHold') {
          dragY.setValue(gesture.dy);

          if (gesture.dy < LOCK_THRESHOLD && !lockedRef.current) {
            lockedRef.current = true;
            setVoiceMode('recordingLocked');

            Animated.parallel([
              Animated.spring(micScale, {
                toValue: 1,
                useNativeDriver: true,
              }),
              Animated.spring(dragY, {
                toValue: 0,
                useNativeDriver: true,
              }),
            ]).start();
          }
        }
      },

      onPanResponderRelease: async () => {
        const mode = voiceModeRef.current;
        if (mode === 'recordingHold' && !lockedRef.current) {
          await stopRecordingToPreview();
        }
        // if locked, release does nothing
      },

      // Important: don't wipe a locked recording
      onPanResponderTerminate: async () => {
        // Only auto-cancel if we were in "hold" mode and not locked
        if (
          voiceModeRef.current === 'recordingHold' &&
          !lockedRef.current
        ) {
          await cancelRecording();
        }
        // If we're locked, user will explicitly hit Delete/Send
      },
    }),
  ).current;

  const isRecording =
    voiceMode === 'recordingHold' || voiceMode === 'recordingLocked';

  const micTranslateY = dragY.interpolate({
    inputRange: [-80, 0],
    outputRange: [-12, 0],
    extrapolate: 'clamp',
  });

  /* ─────────────────────────────────────────
   * JSX
   * ──────────────────────────────────────── */

  return (
    <View
      style={[
        styles.composerContainer,
        {
          borderTopColor: palette.divider,
          backgroundColor: palette.chatComposerBg ?? palette.card,
        },
      ]}
    >
      {/* Recording banner */}
      {isRecording && (
        <View style={styles.voiceRecordingBanner}>
          <View style={styles.voiceRecordingLeft}>
            <Text
              style={[
                styles.voiceRecordingDot,
                { color: palette.danger ?? '#EF4444' },
              ]}
            >
              ●
            </Text>
            <Text
              style={[
                styles.voiceRecordingTime,
                { color: palette.text },
              ]}
            >
              {formatTime(recordSeconds)}
            </Text>
          </View>

          <Text
            style={[
              styles.voiceRecordingHint,
              { color: palette.subtext },
            ]}
          >
            {voiceMode === 'recordingHold'
              ? 'Slide up to lock'
              : 'Locked – tap send or delete'}
          </Text>
        </View>
      )}

      {/* Preview row (released without lock) */}
      {voiceMode === 'preview' && recordUriRef.current && (
        <View
          style={[
            styles.voicePreviewRow,
            {
              backgroundColor:
                palette.composerInputBg ?? palette.surface,
              borderColor:
                palette.composerInputBorder ?? palette.inputBorder,
            },
          ]}
        >
          <Pressable
            style={styles.voicePreviewMain}
            onPress={togglePreviewPlayback}
          >
            <Ionicons
              name={isPlayingPreview ? 'pause' : 'play'}
              size={20}
              color={palette.primary}
            />

            <View style={styles.voicePreviewTextCol}>
              <Text
                style={[
                  styles.voicePreviewTime,
                  { color: palette.text },
                ]}
              >
                {formatTime(recordSeconds)}
                {isPlayingPreview ? '  (Playing)' : ''}
              </Text>
              <View style={styles.voicePreviewProgressTrack}>
                <View
                  style={[
                    styles.voicePreviewProgressFill,
                    {
                      width: `${Math.round(previewProgress * 100)}%`,
                      backgroundColor: palette.primary,
                    },
                  ]}
                />
              </View>
            </View>
          </Pressable>

          <View style={styles.voicePreviewActions}>
            <Pressable
              style={styles.voicePreviewIconButton}
              onPress={handleDeleteFromPreview}
            >
              <KISIcon
                name="trash"
                size={20}
                color={palette.danger ?? '#EF4444'}
              />
            </Pressable>
            <Pressable
              style={styles.voicePreviewIconButton}
              onPress={handleSendFromPreview}
            >
              <KISIcon
                name="send"
                size={20}
                color={palette.primary}
              />
            </Pressable>
          </View>
        </View>
      )}

      {/* Main area: centered mic with pull-to-lock */}
      <View
        style={[
          styles.composerMainRow,
          {
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <View
          {...(!disabled && voiceMode !== 'preview'
            ? panResponder.panHandlers
            : {})}
        >
          <Animated.View
            style={[
              styles.composerActionButton,
              {
                backgroundColor: isRecording
                  ? palette.danger ?? '#EF4444'
                  : palette.primary,
                opacity: disabled ? 0.4 : 1,
                transform: [
                  { translateY: micTranslateY },
                  { scale: micScale },
                ],
              },
            ]}
          >
            <KISIcon
              name="mic"
              size={22}
              color={palette.onPrimary ?? '#fff'}
            />
          </Animated.View>
        </View>
      </View>

      {/* Locked recording actions */}
      {voiceMode === 'recordingLocked' && (
        <View style={styles.voiceLockedActionsRow}>
          <Pressable
            style={styles.voiceLockedButton}
            onPress={handleDeleteFromLocked}
          >
            <KISIcon
              name="trash"
              size={18}
              color={palette.danger ?? '#EF4444'}
            />
            <Text
              style={[
                styles.voiceLockedButtonText,
                { color: palette.danger ?? '#EF4444' },
              ]}
            >
              Delete
            </Text>
          </Pressable>

          <Pressable
            style={styles.voiceLockedButton}
            onPress={handleSendFromLocked}
          >
            <KISIcon
              name="send"
              size={18}
              color={palette.primary}
            />
            <Text
              style={[
                styles.voiceLockedButtonText,
                { color: palette.primary },
              ]}
            >
              Send
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};
