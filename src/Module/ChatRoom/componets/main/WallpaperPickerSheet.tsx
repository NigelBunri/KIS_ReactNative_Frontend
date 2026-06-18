import React, { useRef, useEffect } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KISIcon } from '@/constants/kisIcons';

export type WallpaperOption = {
  id: string;
  label: string;
  colors: string[];
  isDefault?: boolean;
};

export const WALLPAPER_OPTIONS: WallpaperOption[] = [
  { id: 'default', label: 'Default', colors: [], isDefault: true },
  { id: 'midnight', label: 'Midnight', colors: ['#0D0D2B', '#1A1A4E'] },
  { id: 'ocean', label: 'Ocean', colors: ['#0F2027', '#203A43', '#2C5364'] },
  { id: 'forest', label: 'Forest', colors: ['#134E5E', '#71B280'] },
  { id: 'sunset', label: 'Sunset', colors: ['#F953C6', '#B91D73'] },
  { id: 'gold', label: 'Royal Gold', colors: ['#1A1300', '#3D2B00'] },
  { id: 'lavender', label: 'Lavender', colors: ['#2D1B69', '#5B2D8E'] },
  { id: 'coral', label: 'Coral', colors: ['#2E1503', '#C0392B'] },
  { id: 'mint', label: 'Mint', colors: ['#004D40', '#1DE9B6'] },
  { id: 'slate', label: 'Slate', colors: ['#2C3E50', '#3D5166'] },
];

const WALLPAPER_STORAGE_KEY = (chatId: string) => `kis.wallpaper.${chatId}`;

export const saveWallpaper = (chatId: string, wallpaperId: string) =>
  AsyncStorage.setItem(WALLPAPER_STORAGE_KEY(chatId), wallpaperId).catch(() => {});

export const loadWallpaper = async (chatId: string): Promise<string> => {
  const val = await AsyncStorage.getItem(WALLPAPER_STORAGE_KEY(chatId)).catch(() => null);
  return val ?? 'default';
};

type Props = {
  visible: boolean;
  currentId: string;
  onClose: () => void;
  onSelect: (wallpaperId: string) => void;
  palette: any;
};

export const WallpaperPickerSheet: React.FC<Props> = ({
  visible,
  currentId,
  onClose,
  onSelect,
  palette,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [visible]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: palette.surface ?? palette.bg,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: palette.divider }]} />
        <View style={[styles.header, { borderBottomColor: palette.divider }]}>
          <Text style={[styles.title, { color: palette.text }]}>Chat Wallpaper</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <KISIcon name="close" size={22} color={palette.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.grid}>
          {WALLPAPER_OPTIONS.map((opt) => {
            const isSelected = opt.id === currentId;
            const bgColor =
              opt.isDefault
                ? palette.bg
                : opt.colors[0] ?? palette.surface;

            return (
              <Pressable
                key={opt.id}
                style={[
                  styles.swatch,
                  { backgroundColor: bgColor },
                  isSelected && {
                    borderWidth: 3,
                    borderColor: palette.primary,
                  },
                ]}
                onPress={() => {
                  onSelect(opt.id);
                  onClose();
                }}
              >
                {opt.colors.length >= 2 && (
                  <View
                    style={[
                      styles.swatchGradientBar,
                      { backgroundColor: opt.colors[1] },
                    ]}
                  />
                )}
                {isSelected && (
                  <View style={styles.checkOverlay}>
                    <KISIcon name="check" size={18} color="#fff" focused />
                  </View>
                )}
                <Text
                  style={[
                    styles.swatchLabel,
                    {
                      color: opt.isDefault
                        ? palette.subtext
                        : 'rgba(255,255,255,0.85)',
                    },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '75%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: '700' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  swatch: {
    width: '29%',
    aspectRatio: 0.7,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    paddingBottom: 8,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  swatchGradientBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    opacity: 0.6,
  },
  checkOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
