// src/screens/calls/components/CaptionOverlay.tsx
// Live-caption floating bar shown at the bottom of the call screen.
// Each participant runs STT locally and broadcasts via call.caption.
// Without @react-native-voice/voice installed, captions are relay-only
// (other participants' captions still appear; you just can't send your own).

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Caption } from '@/services/calls/callTypes';
import { useKISTheme } from '@/theme/useTheme';

// Real on-device STT via @react-native-voice/voice. All native
// prerequisites are already satisfied: the dependency is installed and
// pod-installed (ios/Podfile.lock), NSMicrophoneUsageDescription +
// NSSpeechRecognitionUsageDescription are declared in ios/KIS/Info.plist,
// and RECORD_AUDIO is declared in the Android manifest (which also now
// declares a <queries> block for android.speech.RecognitionService — see
// AndroidManifest.xml — required for SpeechRecognizer.isRecognitionAvailable
// to return a reliable result under API 30+'s package-visibility rules).
// require() is still wrapped in try/catch so a build that genuinely lacks
// the native module (e.g. an Expo Go-style environment) degrades to
// relay-only captions instead of crashing.
let Voice: any = null;
try { Voice = require('@react-native-voice/voice').default; } catch {}

export const voiceSTTAvailable = !!Voice;

type Props = {
  captions: Caption[];
  isSending: boolean;
  onCaption: (text: string) => void;
  onToggleSend: () => void;
};

const MAX_VISIBLE = 3;
const CAPTION_LIFETIME_MS = 6000;

export default function CaptionOverlay({ captions, isSending, onCaption, onToggleSend }: Props) {
  const { palette } = useKISTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  const [partial, setPartial] = useState('');

  // Show only the last N captions
  const visible = captions.slice(-MAX_VISIBLE);

  // Auto-fade oldest after CAPTION_LIFETIME_MS
  useEffect(() => {
    if (captions.length === 0) return;
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0.3, duration: 500, useNativeDriver: true }).start();
    }, CAPTION_LIFETIME_MS);
    return () => clearTimeout(t);
  }, [captions.length]);

  // Use a ref so the onSpeechEnd closure always sees the current isSending value
  const isSendingRef = useRef(isSending);
  useEffect(() => { isSendingRef.current = isSending; }, [isSending]);

  // STT integration
  useEffect(() => {
    if (!Voice || !isSending) {
      if (Voice) {
        Voice.stop?.().catch?.(() => {});
        Voice.destroy?.().catch?.(() => {});
      }
      setPartial('');
      return;
    }
    Voice.onSpeechPartialResults = (e: any) => {
      setPartial(e?.value?.[0] ?? '');
    };
    Voice.onSpeechResults = (e: any) => {
      const text = e?.value?.[0];
      if (text) { onCaption(text); setPartial(''); }
    };
    Voice.onSpeechError = () => { setPartial(''); };
    // Use ref so the restart loop checks the CURRENT isSending, not the captured value
    const startLoop = () => {
      if (!isSendingRef.current) return;
      Voice.start?.('en-US').catch(() => {});
    };
    Voice.onSpeechEnd = startLoop;
    startLoop();
    return () => {
      Voice.stop?.().catch(() => {});
      Voice.destroy?.().catch(() => {});
      Voice.onSpeechPartialResults = undefined;
      Voice.onSpeechResults = undefined;
      Voice.onSpeechEnd = undefined;
      Voice.onSpeechError = undefined;
    };
  }, [isSending, onCaption]);

  if (visible.length === 0 && !partial) return null;

  return (
    // accessibilityLiveRegion (Android-only; harmless no-op elsewhere) tells
    // the screen reader to announce new captions as they arrive, without
    // collapsing the subtree's own per-line text (no `accessible` here).
    <Animated.View
      style={[styles.container, { opacity }]}
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
    >
      {visible.map(c => (
        <View key={c.id} style={[styles.row, { backgroundColor: `${palette.royalInk}CC` }]}>
          <Text style={[styles.name, { color: palette.gold }]} numberOfLines={1}>
            {c.displayName}:
          </Text>
          <Text style={[styles.text, { color: palette.ivory }]} numberOfLines={2}>
            {c.text}
          </Text>
        </View>
      ))}
      {partial ? (
        <View style={[styles.row, { backgroundColor: `${palette.royalInk}99` }]}>
          <Text style={[styles.name, { color: `${palette.gold}80` }]}>You:</Text>
          <Text style={[styles.text, { color: `${palette.ivory}80` }]} numberOfLines={1}>{partial}…</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 160,
    left: 12,
    right: 12,
    gap: 4,
    zIndex: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexWrap: 'wrap',
  },
  name: { fontSize: 12, fontWeight: '800' },
  text: { fontSize: 13, fontWeight: '500', flex: 1 },
});
