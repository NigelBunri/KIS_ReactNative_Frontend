// src/screens/chat/components/HoldToLockComposer.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Animated,
  Pressable,
  StyleSheet,
  Easing,
} from 'react-native';

import AudioRecorderPlayer, {
  RecordBackType,
  PlayBackType,
} from 'react-native-audio-recorder-player';
import { KISIcon } from '@/constants/kisIcons';

const audioRecorderPlayer = new AudioRecorderPlayer();
audioRecorderPlayer.setSubscriptionDuration(0.09);

// Gesture thresholds
const LOCK_THRESHOLD_Y = -52;   // drag up to lock
const CANCEL_THRESHOLD_X = -72; // drag left to cancel

const WAVEFORM_BARS = 14;
const MIC_BTN_SIZE = 50;

type VoiceMode = 'idle' | 'recordingHold' | 'recordingLocked' | 'preview';

type Props = {
  palette: any;
  disabled?: boolean;
  onSendVoice?: (payload: { uri: string; durationMs: number }) => void;
  setIsRecording: (v: boolean) => void;
};

export const HoldToLockComposer: React.FC<Props> = ({
  palette,
  disabled,
  onSendVoice,
  setIsRecording,
}) => {
  /* ── state ─────────────────────────────────────────────────────────────── */
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('idle');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);

  /* ── refs ──────────────────────────────────────────────────────────────── */
  const voiceModeRef   = useRef<VoiceMode>('idle');
  const lockedRef      = useRef(false);
  const startedRef     = useRef(false); // true once startRecorder() has resolved
  const cancelledRef   = useRef(false);
  const recordUriRef   = useRef<string | null>(null);
  const recordMsRef    = useRef(0);
  const playActiveRef  = useRef(false);

  /* ── animated values ───────────────────────────────────────────────────── */
  const micScale   = useRef(new Animated.Value(1)).current;
  const dragY      = useRef(new Animated.Value(0)).current;
  const dragX      = useRef(new Animated.Value(0)).current;

  // Concentric pulse rings around mic button
  const pulse1Scale   = useRef(new Animated.Value(1)).current;
  const pulse1Opacity = useRef(new Animated.Value(0)).current;
  const pulse2Scale   = useRef(new Animated.Value(1)).current;
  const pulse2Opacity = useRef(new Animated.Value(0)).current;
  const pulse3Scale   = useRef(new Animated.Value(1)).current;
  const pulse3Opacity = useRef(new Animated.Value(0)).current;

  // Blinking rec dot
  const dotOpacity = useRef(new Animated.Value(1)).current;

  // Waveform bars (scaleY, native driver)
  const bars = useRef(
    Array.from({ length: WAVEFORM_BARS }, () => new Animated.Value(0.15)),
  ).current;

  // Animation handles for cleanup
  const pulseLoopsRef    = useRef<Animated.CompositeAnimation[]>([]);
  const dotLoopRef       = useRef<Animated.CompositeAnimation | null>(null);
  const barLoopsRef      = useRef<Animated.CompositeAnimation[]>([]);
  const barTimeoutsRef   = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pulseTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  /* ── sync voiceModeRef ─────────────────────────────────────────────────── */
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);

  /* ── unmount cleanup ───────────────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      killAllAnimations();
      silentStop();
    };
  }, []);

  /* ── helpers ────────────────────────────────────────────────────────────── */

  const silentStop = () => {
    try { audioRecorderPlayer.stopRecorder(); audioRecorderPlayer.removeRecordBackListener(); } catch {}
    try { audioRecorderPlayer.stopPlayer();   audioRecorderPlayer.removePlayBackListener();   } catch {}
  };

  const killAllAnimations = () => {
    pulseLoopsRef.current.forEach(a => a.stop());
    pulseLoopsRef.current = [];
    dotLoopRef.current?.stop();
    dotLoopRef.current = null;
    barLoopsRef.current.forEach(a => a.stop());
    barLoopsRef.current = [];
    barTimeoutsRef.current.forEach(t => clearTimeout(t));
    barTimeoutsRef.current = [];
    pulseTimeoutsRef.current.forEach(t => clearTimeout(t));
    pulseTimeoutsRef.current = [];

    // Reset to rest state
    pulse1Scale.setValue(1);   pulse1Opacity.setValue(0);
    pulse2Scale.setValue(1);   pulse2Opacity.setValue(0);
    pulse3Scale.setValue(1);   pulse3Opacity.setValue(0);
    dotOpacity.setValue(1);
    bars.forEach(b => b.setValue(0.15));
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  /* ── animations ─────────────────────────────────────────────────────────── */

  const startRecordingAnimations = useCallback(() => {
    // Mic button scales up
    Animated.spring(micScale, { toValue: 1.18, useNativeDriver: true, tension: 80, friction: 5 }).start();

    // Three staggered pulse rings
    const makePulse = (
      scale: Animated.Value,
      opacity: Animated.Value,
      delay: number,
    ) => {
      const t = setTimeout(() => {
        scale.setValue(1);
        opacity.setValue(0.55);
        const loop = Animated.loop(
          Animated.parallel([
            Animated.timing(scale,   { toValue: 2.6,  duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0,    duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]),
        );
        loop.start();
        pulseLoopsRef.current.push(loop);
      }, delay);
      pulseTimeoutsRef.current.push(t);
    };
    makePulse(pulse1Scale, pulse1Opacity, 0);
    makePulse(pulse2Scale, pulse2Opacity, 460);
    makePulse(pulse3Scale, pulse3Opacity, 920);

    // Blinking dot
    dotOpacity.setValue(1);
    const dotLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 0.15, duration: 550, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1,    duration: 550, useNativeDriver: true }),
      ]),
    );
    dotLoop.start();
    dotLoopRef.current = dotLoop;

    // Waveform bars — staggered, each independent loop
    bars.forEach((bar, i) => {
      // Three distinct animation phases to look alive
      const hi  = 0.35 + ((i * 0.17) % 0.65);
      const lo  = 0.08 + ((i * 0.11) % 0.22);
      const dur = 160 + (i % 5) * 60;

      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: hi, duration: dur,      easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(bar, { toValue: lo, duration: dur + 40, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
      const t = setTimeout(() => { loop.start(); barLoopsRef.current.push(loop); }, i * 25);
      barTimeoutsRef.current.push(t);
    });
  }, [micScale, pulse1Scale, pulse1Opacity, pulse2Scale, pulse2Opacity, pulse3Scale, pulse3Opacity, dotOpacity, bars]);

  const stopRecordingAnimations = useCallback(() => {
    killAllAnimations();
    Animated.parallel([
      Animated.spring(micScale, { toValue: 1, useNativeDriver: true }),
      Animated.spring(dragY,    { toValue: 0, useNativeDriver: true }),
      Animated.spring(dragX,    { toValue: 0, useNativeDriver: true }),
    ]).start();
  }, [micScale, dragY, dragX]);

  /* ── recording core ─────────────────────────────────────────────────────── */

  const startRecording = async () => {
    if (disabled || voiceModeRef.current !== 'idle') return;

    cancelledRef.current = false;
    startedRef.current   = false;
    lockedRef.current    = false;
    recordUriRef.current = null;
    recordMsRef.current  = 0;

    setRecordSeconds(0);
    setPreviewProgress(0);
    setIsPlayingPreview(false);
    setIsRecording(true);
    setVoiceMode('recordingHold');
    dragY.setValue(0);
    dragX.setValue(0);
    startRecordingAnimations();

    try {
      const uri = await audioRecorderPlayer.startRecorder();
      if (cancelledRef.current) {
        // Finger was released before the recorder initialised
        try { await audioRecorderPlayer.stopRecorder(); } catch {}
        audioRecorderPlayer.removeRecordBackListener();
        return;
      }
      startedRef.current = true;
      if (uri) recordUriRef.current = uri;

      audioRecorderPlayer.addRecordBackListener((e: RecordBackType) => {
        const ms = e.currentPosition ?? 0;
        recordMsRef.current = ms;
        setRecordSeconds(Math.floor(ms / 1000));
      });
    } catch (err) {
      console.warn('[Voice] startRecorder failed', err);
      cancelledRef.current = true;
      setIsRecording(false);
      setVoiceMode('idle');
      stopRecordingAnimations();
    }
  };

  const stopRecordingCore = async (): Promise<string | null> => {
    let uri: string | null = null;
    try { uri = (await audioRecorderPlayer.stopRecorder()) ?? null; } catch {}
    try { audioRecorderPlayer.removeRecordBackListener(); } catch {}
    setIsRecording(false);
    const effective = uri ?? recordUriRef.current;
    if (effective) recordUriRef.current = effective;
    return effective;
  };

  const cancelRecording = async () => {
    cancelledRef.current = true;
    try { await audioRecorderPlayer.stopRecorder(); } catch {}
    try { audioRecorderPlayer.removeRecordBackListener(); } catch {}
    setIsRecording(false);
    stopRecordingAnimations();
    lockedRef.current    = false;
    recordUriRef.current = null;
    recordMsRef.current  = 0;
    setVoiceMode('idle');
    setRecordSeconds(0);
    setIsPlayingPreview(false);
    setPreviewProgress(0);
  };

  const stopToPreview = async () => {
    const uri = await stopRecordingCore();
    stopRecordingAnimations();
    if (uri && recordMsRef.current > 0) {
      setVoiceMode('preview');
      setIsPlayingPreview(false);
      setPreviewProgress(0);
    } else {
      lockedRef.current    = false;
      recordUriRef.current = null;
      recordMsRef.current  = 0;
      setVoiceMode('idle');
      setRecordSeconds(0);
    }
  };

  /* ── preview playback ───────────────────────────────────────────────────── */

  const stopPlayback = async () => {
    try {
      await audioRecorderPlayer.stopPlayer();
      if (playActiveRef.current) {
        audioRecorderPlayer.removePlayBackListener();
        playActiveRef.current = false;
      }
    } catch {}
    setIsPlayingPreview(false);
    setPreviewProgress(0);
  };

  const startPlayback = async () => {
    const uri = recordUriRef.current;
    if (!uri) return;
    try {
      setIsPlayingPreview(true);
      await audioRecorderPlayer.startPlayer(uri);
      playActiveRef.current = true;
      const estDur = Math.max(recordMsRef.current, 1);
      audioRecorderPlayer.addPlayBackListener((e: PlayBackType) => {
        const pos = e.currentPosition ?? 0;
        const dur = e.duration && e.duration > 0 ? e.duration : estDur;
        setPreviewProgress(Math.min(1, pos / dur));
        if (pos >= dur - 50) stopPlayback();
      });
    } catch {
      setIsPlayingPreview(false);
    }
  };

  const togglePlayback = () => {
    if (isPlayingPreview) stopPlayback();
    else startPlayback();
  };

  /* ── send / delete ──────────────────────────────────────────────────────── */

  const resetAll = useCallback(() => {
    lockedRef.current    = false;
    cancelledRef.current = false;
    recordUriRef.current = null;
    recordMsRef.current  = 0;
    setVoiceMode('idle');
    setRecordSeconds(0);
    setIsPlayingPreview(false);
    setPreviewProgress(0);
  }, []);

  const handleSendPreview = async () => {
    if (isPlayingPreview) await stopPlayback();
    const uri = recordUriRef.current;
    const durationMs = recordMsRef.current;
    if (uri && durationMs > 0) onSendVoice?.({ uri, durationMs });
    resetAll();
  };

  const handleDeletePreview = async () => {
    if (isPlayingPreview) await stopPlayback();
    resetAll();
  };

  const handleSendLocked = async () => {
    const mode = voiceModeRef.current;
    if (mode === 'recordingLocked' || mode === 'recordingHold') await stopRecordingCore();
    stopRecordingAnimations();
    const uri = recordUriRef.current;
    const durationMs = recordMsRef.current;
    if (uri && durationMs > 0) onSendVoice?.({ uri, durationMs });
    resetAll();
  };

  const handleCancelLocked = async () => {
    await cancelRecording();
  };

  /* ── PanResponder ───────────────────────────────────────────────────────── */

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () =>
        !disabled && voiceModeRef.current === 'idle',

      // Only grab move events while in hold mode — locked mode buttons must
      // receive their own touches without interference.
      onMoveShouldSetPanResponder: () =>
        voiceModeRef.current === 'recordingHold',

      onPanResponderGrant: () => {
        if (!disabled && voiceModeRef.current === 'idle') startRecording();
      },

      onPanResponderMove: (
        _evt: GestureResponderEvent,
        gesture: PanResponderGestureState,
      ) => {
        if (voiceModeRef.current !== 'recordingHold') return;

        // Clamp drag values to their respective directions
        dragY.setValue(Math.min(0, gesture.dy));
        dragX.setValue(Math.min(0, gesture.dx));

        // Slide left → cancel
        if (gesture.dx < CANCEL_THRESHOLD_X) {
          cancelRecording();
          return;
        }

        // Slide up → lock
        if (gesture.dy < LOCK_THRESHOLD_Y && !lockedRef.current) {
          lockedRef.current = true;
          setVoiceMode('recordingLocked');
          Animated.parallel([
            Animated.spring(micScale, { toValue: 1,  useNativeDriver: true }),
            Animated.spring(dragY,    { toValue: 0,  useNativeDriver: true }),
            Animated.spring(dragX,    { toValue: 0,  useNativeDriver: true }),
          ]).start();
        }
      },

      onPanResponderRelease: async () => {
        if (voiceModeRef.current === 'recordingHold' && !lockedRef.current) {
          if (!startedRef.current) {
            // Recorder hadn't initialised yet — mark cancelled
            cancelledRef.current = true;
            setIsRecording(false);
            setVoiceMode('idle');
            stopRecordingAnimations();
          } else {
            await stopToPreview();
          }
        }
      },

      onPanResponderTerminate: async () => {
        if (voiceModeRef.current === 'recordingHold' && !lockedRef.current) {
          await cancelRecording();
        }
      },
    }),
  ).current;

  /* ── derived ────────────────────────────────────────────────────────────── */

  const isRecordingActive = voiceMode === 'recordingHold' || voiceMode === 'recordingLocked';

  // Cancel hint: fades + moves left as user slides that way
  const cancelHintOpacity = dragX.interpolate({
    inputRange: [CANCEL_THRESHOLD_X, -30, 0],
    outputRange: [0, 1, 1],
    extrapolate: 'clamp',
  });
  const cancelHintTranslateX = dragX.interpolate({
    inputRange: [CANCEL_THRESHOLD_X, 0],
    outputRange: [-16, 0],
    extrapolate: 'clamp',
  });

  // Lock indicator rises as user drags up
  const lockIndicatorTranslateY = dragY.interpolate({
    inputRange: [-80, 0],
    outputRange: [-18, 0],
    extrapolate: 'clamp',
  });
  const lockIndicatorOpacity = dragY.interpolate({
    inputRange: [-80, -20, 0],
    outputRange: [0.3, 1, 0.4],
    extrapolate: 'clamp',
  });

  // Mic button nudges slightly with the drag
  const micTranslateY = dragY.interpolate({
    inputRange: [-60, 0],
    outputRange: [-7, 0],
    extrapolate: 'clamp',
  });
  const micTranslateX = dragX.interpolate({
    inputRange: [-60, 0],
    outputRange: [-7, 0],
    extrapolate: 'clamp',
  });

  const dangerColor  = palette.danger ?? '#EF4444';
  const primaryColor = palette.primary;
  const onPrimary    = palette.onPrimary ?? '#fff';
  const textColor    = palette.text;
  const subtextColor = palette.subtext;
  const surfaceColor = palette.composerInputBg ?? palette.surface ?? '#f3f4f6';
  const dividerColor = palette.divider ?? '#e5e7eb';

  /* ── render ─────────────────────────────────────────────────────────────── */

  return (
    <View style={s.root}>

      {/* ╔══════════════════════════════════════════════════════╗
          ║ RECORDING BANNER (hold + locked)                     ║
          ╚══════════════════════════════════════════════════════╝ */}
      {isRecordingActive && (
        <View style={[s.banner, { backgroundColor: surfaceColor }]}>

          {/* Left: pulsing dot + timer */}
          <View style={s.bannerLeft}>
            <Animated.View
              style={[
                s.recDot,
                { backgroundColor: dangerColor, opacity: dotOpacity },
              ]}
            />
            <Text style={[s.timerText, { color: textColor }]}>
              {formatTime(recordSeconds)}
            </Text>
          </View>

          {/* Center: live waveform */}
          <View style={s.waveRow}>
            {bars.map((bar, i) => (
              <Animated.View
                key={i}
                style={[
                  s.waveBar,
                  {
                    backgroundColor:
                      voiceMode === 'recordingLocked' ? primaryColor : dangerColor,
                    transform: [{ scaleY: bar }],
                  },
                ]}
              />
            ))}
          </View>

          {/* Right: cancel hint (hold) or locked badge */}
          {voiceMode === 'recordingHold' ? (
            <Animated.View
              style={[
                s.cancelHint,
                {
                  opacity: cancelHintOpacity,
                  transform: [{ translateX: cancelHintTranslateX }],
                },
              ]}
            >
              <Text style={[s.cancelHintText, { color: subtextColor }]}>
                ← Cancel
              </Text>
            </Animated.View>
          ) : (
            <View
              style={[
                s.lockedBadge,
                {
                  backgroundColor: primaryColor + '18',
                  borderColor: primaryColor + '44',
                },
              ]}
            >
              <KISIcon name="lock" size={11} color={primaryColor} />
              <Text style={[s.lockedBadgeText, { color: primaryColor }]}>
                Locked
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ╔══════════════════════════════════════════════════════╗
          ║ PREVIEW ROW                                          ║
          ╚══════════════════════════════════════════════════════╝ */}
      {voiceMode === 'preview' && (
        <View
          style={[
            s.previewRow,
            { backgroundColor: surfaceColor, borderColor: dividerColor },
          ]}
        >
          {/* Play / pause */}
          <Pressable
            onPress={togglePlayback}
            style={[s.playBtn, { backgroundColor: primaryColor }]}
            hitSlop={8}
          >
            <KISIcon
              name={isPlayingPreview ? 'pause' : 'play'}
              size={16}
              color={onPrimary}
            />
          </Pressable>

          {/* Waveform progress */}
          <View style={s.previewMid}>
            {/* Static waveform ticks */}
            <View style={s.staticWave}>
              {Array.from({ length: 24 }).map((_, i) => {
                const h = 4 + ((Math.sin(i * 0.8) + 1) / 2) * 18;
                const filled = i / 24 <= previewProgress;
                return (
                  <View
                    key={i}
                    style={[
                      s.staticBar,
                      {
                        height: h,
                        backgroundColor: filled
                          ? primaryColor
                          : dividerColor,
                      },
                    ]}
                  />
                );
              })}
            </View>
            <Text style={[s.previewTime, { color: subtextColor }]}>
              {formatTime(recordSeconds)}
            </Text>
          </View>

          {/* Delete */}
          <Pressable onPress={handleDeletePreview} style={s.previewIcon} hitSlop={10}>
            <KISIcon name="trash" size={19} color={dangerColor} />
          </Pressable>

          {/* Send */}
          <Pressable
            onPress={handleSendPreview}
            style={[s.sendBtnSmall, { backgroundColor: primaryColor }]}
            hitSlop={8}
          >
            <KISIcon name="send" size={16} color={onPrimary} />
          </Pressable>
        </View>
      )}

      {/* ╔══════════════════════════════════════════════════════╗
          ║ MAIN ROW: lock indicator + mic button                ║
          ╚══════════════════════════════════════════════════════╝ */}
      <View style={s.mainRow}>

        {/* Lock drag indicator — visible while dragging up */}
        {voiceMode === 'recordingHold' && (
          <Animated.View
            style={[
              s.lockIndicator,
              {
                opacity: lockIndicatorOpacity,
                transform: [{ translateY: lockIndicatorTranslateY }],
              },
            ]}
            pointerEvents="none"
          >
            <View
              style={[
                s.lockIcon,
                {
                  backgroundColor: primaryColor + '1a',
                  borderColor: primaryColor + '55',
                },
              ]}
            >
              <KISIcon name="lock" size={14} color={primaryColor} />
            </View>
            <Text style={[s.lockHintText, { color: subtextColor }]}>↑ Lock</Text>
          </Animated.View>
        )}

        {/* Mic button — panHandlers only attached in idle + hold modes */}
        <View
          {...(!disabled && (voiceMode === 'idle' || voiceMode === 'recordingHold')
            ? panResponder.panHandlers
            : {})}
          style={s.micOuter}
        >
          {/* Pulse ring 1 */}
          {isRecordingActive && (
            <Animated.View
              pointerEvents="none"
              style={[
                s.pulseRing,
                {
                  width: MIC_BTN_SIZE,
                  height: MIC_BTN_SIZE,
                  borderRadius: MIC_BTN_SIZE / 2,
                  backgroundColor: dangerColor,
                  opacity: pulse1Opacity,
                  transform: [{ scale: pulse1Scale }],
                },
              ]}
            />
          )}
          {/* Pulse ring 2 */}
          {isRecordingActive && (
            <Animated.View
              pointerEvents="none"
              style={[
                s.pulseRing,
                {
                  width: MIC_BTN_SIZE,
                  height: MIC_BTN_SIZE,
                  borderRadius: MIC_BTN_SIZE / 2,
                  backgroundColor: dangerColor,
                  opacity: pulse2Opacity,
                  transform: [{ scale: pulse2Scale }],
                },
              ]}
            />
          )}
          {/* Pulse ring 3 */}
          {isRecordingActive && (
            <Animated.View
              pointerEvents="none"
              style={[
                s.pulseRing,
                {
                  width: MIC_BTN_SIZE,
                  height: MIC_BTN_SIZE,
                  borderRadius: MIC_BTN_SIZE / 2,
                  backgroundColor: dangerColor,
                  opacity: pulse3Opacity,
                  transform: [{ scale: pulse3Scale }],
                },
              ]}
            />
          )}

          {/* The mic button itself */}
          <Animated.View
            style={[
              s.micBtn,
              {
                width: MIC_BTN_SIZE,
                height: MIC_BTN_SIZE,
                borderRadius: MIC_BTN_SIZE / 2,
                backgroundColor: isRecordingActive ? dangerColor : primaryColor,
                opacity: disabled ? 0.42 : 1,
                transform: [
                  { scale: micScale },
                  { translateY: micTranslateY },
                  { translateX: micTranslateX },
                ],
              },
            ]}
          >
            <KISIcon name="mic" size={22} color={onPrimary} />
          </Animated.View>
        </View>
      </View>

      {/* ╔══════════════════════════════════════════════════════╗
          ║ LOCKED ACTIONS                                       ║
          ╚══════════════════════════════════════════════════════╝ */}
      {voiceMode === 'recordingLocked' && (
        <View style={s.lockedRow}>

          {/* Delete / cancel */}
          <Pressable
            onPress={handleCancelLocked}
            style={[s.lockedBtn, { borderColor: dangerColor + '55' }]}
            hitSlop={6}
          >
            <KISIcon name="trash" size={17} color={dangerColor} />
            <Text style={[s.lockedBtnText, { color: dangerColor }]}>Delete</Text>
          </Pressable>

          {/* Centre: live indicator */}
          <View
            style={[
              s.lockedCenter,
              { backgroundColor: surfaceColor, borderColor: dividerColor },
            ]}
          >
            <Animated.View
              style={[s.recDot, { backgroundColor: dangerColor, opacity: dotOpacity }]}
            />
            <Text style={[s.lockedCenterText, { color: textColor }]}>
              {formatTime(recordSeconds)}
            </Text>
          </View>

          {/* Send */}
          <Pressable
            onPress={handleSendLocked}
            style={[s.lockedBtn, s.lockedSendBtn, { backgroundColor: primaryColor }]}
            hitSlop={6}
          >
            <KISIcon name="send" size={17} color={onPrimary} />
            <Text style={[s.lockedBtnText, { color: onPrimary }]}>Send</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

/* ── styles ─────────────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flexDirection: 'column', flex: 1 },

  /* Banner */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 5,
    marginHorizontal: 2,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', width: 72 },
  recDot:    { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  timerText: {
    fontSize: 13,
    fontWeight: '700',
    // @ts-ignore  tabular-nums is valid in RN
    fontVariant: ['tabular-nums'],
  },

  waveRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  waveBar: {
    width: 3,
    height: 28,
    borderRadius: 2,
    marginHorizontal: 1.5,
  },

  cancelHint: { width: 70, alignItems: 'flex-end' },
  cancelHintText: { fontSize: 11, fontWeight: '600' },

  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  lockedBadgeText: { fontSize: 11, fontWeight: '700' },

  /* Preview */
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 5,
    marginHorizontal: 2,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewMid: { flex: 1, marginHorizontal: 10 },
  staticWave: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    gap: 2,
  },
  staticBar: { width: 3, borderRadius: 2, flex: 0 },
  previewTime: { fontSize: 10, marginTop: 3, fontWeight: '500' },
  previewIcon: { padding: 6 },
  sendBtnSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  /* Main row */
  mainRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    minHeight: MIC_BTN_SIZE + 14,
    paddingRight: 2,
  },

  lockIndicator: {
    position: 'absolute',
    right: MIC_BTN_SIZE + 14,
    alignItems: 'center',
  },
  lockIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockHintText: { fontSize: 9, fontWeight: '700', marginTop: 3 },

  micOuter: {
    width: MIC_BTN_SIZE + 16,
    height: MIC_BTN_SIZE + 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulseRing: { position: 'absolute' },
  micBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
  },

  /* Locked actions */
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 6,
  },
  lockedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
    gap: 6,
  },
  lockedSendBtn: { borderWidth: 0 },
  lockedBtnText: { fontSize: 13, fontWeight: '700' },
  lockedCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
    gap: 7,
  },
  lockedCenterText: {
    fontSize: 13,
    fontWeight: '700',
    // @ts-ignore
    fontVariant: ['tabular-nums'],
  },
});
