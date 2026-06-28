// src/screens/calls/components/VirtualBackgroundSheet.tsx
// Virtual background / blur selection UI.
//
// The `VirtualBgProcessor` in virtualBgService.ts captures the local RTCView
// at 10fps via react-native-view-shot. The captured frame is displayed here
// with an SVG feGaussianBlur filter (blur mode) or composited with a background
// image (image mode), replacing the raw RTCView in the local preview.
//
// Peers receive the unmodified stream. For transmitted-stream blur, wire in a
// react-native-vision-camera frame processor (see `nativeProcessorAvailable`).

import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Image as SvgImage,
  Defs,
  Filter,
  FeGaussianBlur,
  FeBlend,
} from 'react-native-svg';
import { launchImageLibrary } from 'react-native-image-picker';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import type { VirtualBgConfig } from '@/services/calls/virtualBgService';

export type VirtualBgMode = 'none' | 'blur' | 'image';
export type VirtualBgOption = {
  id: string;
  mode: VirtualBgMode;
  label: string;
  uri?: string;
  blurRadius?: number;
};

const BLUR_LEVELS = [4, 8, 14, 20];

type Props = {
  visible: boolean;
  onClose: () => void;
  current: VirtualBgOption;
  onSelect: (opt: VirtualBgOption) => void;
  /** True when a native frame processor (react-native-vision-camera) is active.
   *  When false, only the local preview is processed; peers see the raw stream. */
  nativeProcessorAvailable: boolean;
};

export default function VirtualBackgroundSheet({
  visible, onClose, current, onSelect, nativeProcessorAvailable,
}: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const [mounted, setMounted] = useState(visible);
  const [customImages, setCustomImages] = useState<VirtualBgOption[]>([]);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.spring(slideAnim, { toValue: visible ? 0 : 400, useNativeDriver: true, tension: 60, friction: 12 })
      .start(({ finished }) => { if (finished && !visible) setMounted(false); });
  }, [visible]);

  const pickCustomImage = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.assets?.[0]?.uri) {
      const opt: VirtualBgOption = {
        id: `img_${Date.now()}`,
        mode: 'image',
        label: 'Custom',
        uri: result.assets[0].uri,
      };
      setCustomImages(prev => [...prev.slice(-3), opt]); // keep last 4
      onSelect(opt);
    }
  };

  if (!mounted) return null;

  const builtIn: VirtualBgOption[] = [
    { id: 'none', mode: 'none', label: 'Off' },
    ...BLUR_LEVELS.map(r => ({ id: `blur_${r}`, mode: 'blur' as VirtualBgMode, label: `Blur ${r}`, blurRadius: r })),
  ];
  const allOptions = [...builtIn, ...customImages];

  return (
    <Animated.View
      style={[
        styles.sheet,
        { backgroundColor: palette.royalInk, borderTopColor: `${palette.gold}33`, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.ivory }]}>Background</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <KISIcon name="close" size={20} color={palette.subtext} />
        </Pressable>
      </View>

      {/* Info banner about transmitted stream */}
      {!nativeProcessorAvailable && current.mode !== 'none' && (
        <View style={[styles.infoBanner, { backgroundColor: `${palette.gold}14`, borderColor: `${palette.gold}33` }]}>
          <KISIcon name="info" size={14} color={`${palette.gold}99`} />
          <Text style={[styles.infoText, { color: `${palette.gold}99` }]}>
            Preview only — peers see your unblurred stream. Add react-native-vision-camera to blur for everyone.
          </Text>
        </View>
      )}
      {nativeProcessorAvailable && current.mode !== 'none' && (
        <View style={[styles.infoBanner, { backgroundColor: `${palette.success}14`, borderColor: `${palette.success}33` }]}>
          <KISIcon name="check" size={14} color={palette.success} />
          <Text style={[styles.infoText, { color: palette.success }]}>
            Native processing active — peers see the effect too.
          </Text>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.grid, { paddingBottom: Math.max(insets.bottom, 16) }]}
      >
        {allOptions.map(opt => {
          const selected = current.id === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onSelect(opt)}
              style={[
                styles.option,
                {
                  borderColor: selected ? palette.gold : palette.inputBorder,
                  backgroundColor: selected ? `${palette.gold}1A` : palette.surface,
                },
              ]}
            >
              {opt.mode === 'none' && (
                <KISIcon name="video-off" size={24} color={selected ? palette.gold : palette.subtext} />
              )}
              {opt.mode === 'blur' && (
                <View style={styles.blurPreview}>
                  <View style={[styles.blurCircle, { opacity: 1 / (opt.blurRadius ?? 8) * 8 }]} />
                  <KISIcon name="layers" size={20} color={selected ? palette.gold : palette.subtext} />
                </View>
              )}
              {opt.mode === 'image' && opt.uri && (
                // Show thumbnail using SVG Image (avoids RN Image placeholder issues)
                <Svg width={86} height={86}>
                  <SvgImage href={{ uri: opt.uri }} width={86} height={86} preserveAspectRatio="xMidYMid slice" />
                </Svg>
              )}
              <Text style={[styles.optionLabel, { color: selected ? palette.gold : palette.subtext }]}>
                {opt.label}
              </Text>
              {selected && (
                <View style={[styles.checkMark, { backgroundColor: palette.gold }]}>
                  <KISIcon name="check" size={10} color={palette.royalInk} />
                </View>
              )}
            </Pressable>
          );
        })}

        {/* Add custom image */}
        <Pressable
          onPress={pickCustomImage}
          style={[styles.option, styles.addImageBtn, { borderColor: palette.inputBorder, backgroundColor: palette.surface }]}
        >
          <KISIcon name="image" size={24} color={palette.subtext} />
          <Text style={[styles.optionLabel, { color: palette.subtext }]}>Custom</Text>
        </Pressable>
      </ScrollView>
    </Animated.View>
  );
}

/**
 * VirtualBgPreview — drop-in replacement for the local RTCView preview when
 * virtual background is active. Renders the captured frame with the selected
 * SVG filter applied.
 *
 * Usage (in VideoOneOnOneLayout or ParticipantTile):
 *   {virtualBgEnabled && frameUri
 *     ? <VirtualBgPreview frameUri={frameUri} option={virtualBgOption} style={...} />
 *     : <RTCView ... />}
 */
export function VirtualBgPreview({
  frameUri,
  option,
  width,
  height,
  style,
}: {
  frameUri: string;
  option: VirtualBgOption;
  width: number;
  height: number;
  style?: any;
}) {
  if (!frameUri || option.mode === 'none') return null;

  const blur = option.blurRadius ?? 8;

  if (option.mode === 'blur') {
    return (
      <Svg width={width} height={height} style={style}>
        <Defs>
          <Filter id="vbBlur" x="0" y="0" width="100%" height="100%">
            <FeGaussianBlur stdDeviation={blur} />
          </Filter>
        </Defs>
        {/* Background: blurred copy of the frame */}
        <SvgImage
          href={{ uri: frameUri }}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid slice"
          filter="url(#vbBlur)"
        />
        {/* Foreground: original unblurred (in a real segmentation pipeline this
            would be just the person, composited over the blur. Without ML
            segmentation both layers show the same image — the blur is applied
            to the whole frame.) */}
        <SvgImage
          href={{ uri: frameUri }}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid slice"
          opacity={0}
        />
      </Svg>
    );
  }

  if (option.mode === 'image' && option.uri) {
    return (
      <Svg width={width} height={height} style={style}>
        {/* Custom background image (shown as-is; segmentation would composite person over it) */}
        <SvgImage
          href={{ uri: option.uri }}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid slice"
        />
        {/* Original frame composited (with person isolated in a real ML pipeline) */}
        <SvgImage
          href={{ uri: frameUri }}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid slice"
          opacity={0.85}
        />
      </Svg>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, zIndex: 50,
    paddingTop: 4,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 17, fontWeight: '900' },
  infoBanner: {
    marginHorizontal: 14, marginBottom: 8, borderWidth: 1, borderRadius: 10,
    padding: 10, flexDirection: 'row', gap: 8, alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 11, lineHeight: 16 },
  grid: { paddingHorizontal: 14, gap: 10, alignItems: 'flex-start', paddingVertical: 4 },
  option: {
    width: 90, height: 100, borderRadius: 14, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden',
  },
  addImageBtn: { borderStyle: 'dashed' },
  blurPreview: { alignItems: 'center', justifyContent: 'center' },
  blurCircle: {
    position: 'absolute', width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(120,120,200,0.5)',
  },
  optionLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  checkMark: {
    position: 'absolute', top: 6, right: 6, width: 18, height: 18,
    borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
});
