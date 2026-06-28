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

// Voice STT requires @react-native-voice/voice + pod install + microphone
// permission in Info.plist. Disabled by default to prevent native crashes.
// Steps to enable:
//   1. pnpm add @react-native-voice/voice
//   2. Add to Info.plist: NSMicrophoneUsageDescription, NSSpeechRecognitionUsageDescription
//   3. cd ios && pod install && rebuild
//   4. Set VOICE_STT_ENABLED = true below
const VOICE_STT_ENABLED = false;

let Voice: any = null;
if (VOICE_STT_ENABLED) {
  try { Voice = require('@react-native-voice/voice').default; } catch {}
}

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
    <Animated.View style={[styles.container, { opacity }]} pointerEvents="box-none">
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
