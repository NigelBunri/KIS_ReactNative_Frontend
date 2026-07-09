// src/screens/calls/components/RtmpSheet.tsx
// RTMP streaming configuration for broadcast hosts.
// Actual streaming requires an RTMP server (e.g. nginx-rtmp, Wowza, Mux).

import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

type Props = {
  visible: boolean;
  onClose: () => void;
  rtmpActive: boolean;
  rtmpUrl: string | null;
  onStart: (url: string) => void;
  onStop: () => void;
};

export default function RtmpSheet({ visible, onClose, rtmpActive, rtmpUrl, onStart, onStop }: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const [mounted, setMounted] = useState(visible);
  const [url, setUrl] = useState(rtmpUrl ?? '');

  useEffect(() => { setUrl(rtmpUrl ?? ''); }, [rtmpUrl]);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.spring(slideAnim, { toValue: visible ? 0 : 400, useNativeDriver: true, tension: 60, friction: 12 })
      .start(({ finished }) => { if (finished && !visible) setMounted(false); });
  }, [visible]);

  if (!mounted) return null;

  return (
    <Animated.View
      style={[
        styles.sheet,
        { backgroundColor: palette.royalInk, borderTopColor: `${palette.gold}33`, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.ivory }]}>Live streaming</Text>
        <Pressable onPress={onClose} hitSlop={10}><KISIcon name="close" size={20} color={palette.subtext} /></Pressable>
      </View>

      <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Text style={[styles.label, { color: palette.subtext }]}>
          Stream your broadcast live to YouTube, Twitch, or any RTMP destination.
        </Text>

        {rtmpActive ? (
          <View style={[styles.activeBanner, { backgroundColor: `${palette.danger}1A`, borderColor: `${palette.danger}40` }]}>
            <View style={[styles.liveDot, { backgroundColor: palette.danger }]} />
            <Text style={[styles.activeText, { color: palette.danger }]}>Streaming live to:</Text>
            <Text style={[styles.activeUrl, { color: palette.ivory }]} numberOfLines={1}>{rtmpUrl}</Text>
          </View>
        ) : (
          <TextInput
            style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.inputBorder, color: palette.text }]}
            placeholder="rtmp://a.rtmp.youtube.com/live2/your-stream-key"
            placeholderTextColor={palette.subtext}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}

        <View style={[styles.note, { backgroundColor: `${palette.gold}0F`, borderColor: `${palette.gold}26` }]}>
          <KISIcon name="info" size={14} color={`${palette.gold}80`} />
          <Text style={[styles.noteText, { color: `${palette.gold}99` }]}>
            Requires an RTMP server configured to ingest and relay the stream. KIS forwards the signal — the media mixing happens server-side.
          </Text>
        </View>

        {rtmpActive ? (
          <Pressable onPress={onStop} style={[styles.btn, { backgroundColor: palette.danger }]}>
            <KISIcon name="stop-circle" size={18} color={palette.ivory} />
            <Text style={[styles.btnText, { color: palette.ivory }]}>Stop streaming</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => { if (url.trim().startsWith('rtmp')) onStart(url.trim()); }}
            disabled={!url.trim().startsWith('rtmp')}
            style={[styles.btn, { backgroundColor: url.trim().startsWith('rtmp') ? palette.danger : `${palette.danger}40` }]}
          >
            <KISIcon name="radio" size={18} color={palette.ivory} />
            <Text style={[styles.btnText, { color: palette.ivory }]}>Go live</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, zIndex: 50,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 17, fontWeight: '900' },
  body: { paddingHorizontal: 16, gap: 14 },
  label: { fontSize: 13, lineHeight: 19 },
  activeBanner: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  activeText: { fontSize: 12, fontWeight: '700' },
  activeUrl: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 12, padding: 13, fontSize: 13 },
  note: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 8 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 28, paddingVertical: 14 },
  btnText: { fontSize: 15, fontWeight: '900' },
});
