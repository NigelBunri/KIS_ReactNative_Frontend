// src/screens/chat/components/StickerEditor.tsx

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
  Dimensions,
  PanResponder,
  Image,
} from 'react-native';

import { launchImageLibrary } from 'react-native-image-picker';
import ViewShot from 'react-native-view-shot';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import ImageResizer from 'react-native-image-resizer';

import { KISIcon } from '@/constants/kisIcons';
import { StickerBackgroundRemovalScreen } from './StickerBackgroundRemovalScreen';

export type Sticker = {
  id: string;
  uri: string; // FINAL image URI (PNG) used by <Image>
  text?: string;

  // KIS-specific metadata so your app recognizes stickers
  fileType: 'kis-sticker';
  mimeType: 'image/png';
  extension: '.png';

  // Path to the PNG file on disk
  metaPath: string;
};

type StickerEditorProps = {
  palette: any;
  onClose: () => void;
  onSaveSticker: (sticker: Sticker) => void;
};

// 🔴🟡🟢 Rich palette (12 colors)
const TEXT_COLORS = [
  '#FFFFFF', // white
  '#000000', // black
  '#FFEB3B', // yellow
  '#FFCDD2', // soft red
  '#F8BBD0', // pink
  '#C8E6C9', // light green
  '#BBDEFB', // light blue
  '#FF9800', // orange
  '#9C27B0', // purple
  '#4CAF50', // green
  '#03A9F4', // blue
  '#E91E63', // strong pink
];

const FONT_SIZES = [16, 20, 24, 30, 36];

// AsyncStorage key for quick access to sticker library
export const STICKER_STORAGE_KEY = 'KIS_STICKER_LIBRARY_V1';

// Folder where we store sticker PNG files
const STICKER_DIR = `${RNFS.DocumentDirectoryPath}/stickers`;

// For logging only
const SUPPORTED_BASE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

export const StickerEditor: React.FC<StickerEditorProps> = ({
  palette,
  onClose,
  onSaveSticker,
}) => {
  /* ------------------------------------------------------------- */
  /*                            STATE                              */
  /* ------------------------------------------------------------- */
  const screenWidth = Dimensions.get('window').width;
  const translateX = useRef(new Animated.Value(screenWidth)).current;

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [_originalUri, setOriginalUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const [text, setText] = useState('Your text');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [fontSize, setFontSize] = useState(24);
  const [bgRemoved, setBgRemoved] = useState(false);

  const [textPos, setTextPos] = useState({ x: 40, y: 40 });
  const textStartPosRef = useRef({ x: 40, y: 40 });

  const viewShotRef = useRef<ViewShot | null>(null);

  const [saving, setSaving] = useState(false);

  // ❗ NEW: control the background-removal bottom sheet
  const [showBgRemoval, setShowBgRemoval] = useState(false);

  const handleOpenBgRemoval = () => {
    if (!imageUri) return;
    setShowBgRemoval(true);
  };

  /* ------------------------------------------------------------- */
  /*                        SLIDE-IN SCREEN                        */
  /* ------------------------------------------------------------- */
  useEffect(() => {
    Animated.timing(translateX, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [translateX]);

  /* ------------------------------------------------------------- */
  /*                    PICK USER IMAGE                            */
  /* ------------------------------------------------------------- */
  const handlePickImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: true,
        quality: 1,
      });

      if (result.didCancel) return;

      const asset = result.assets?.[0];
      if (!asset) return;

      let uri: string | null = asset.uri ?? null;

      // Fallback: build a data URL if uri is missing
      if (!uri && asset.base64) {
        const mime = asset.type ?? 'image/jpeg';
        uri = `data:${mime};base64,${asset.base64}`;
      }

      if (!uri) {
        console.warn('No usable uri for selected image', asset);
        return;
      }

      if (asset.type && !SUPPORTED_BASE_TYPES.includes(asset.type)) {
        console.log(
          '[StickerEditor] Picked non-JPEG/PNG image type:',
          asset.type,
          '- will still display in preview, but final sticker will be PNG.',
        );
      }

      setImageUri(uri);
      setOriginalUri(uri);
      setImageBase64(asset.base64 ?? null);
      setBgRemoved(false);
    } catch (err) {
      console.warn('Image pick error', err);
    }
  };

  /* ------------------------------------------------------------- */
  /*                       DRAGGABLE TEXT                          */
  /* ------------------------------------------------------------- */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        textStartPosRef.current = { ...textPos };
      },
      onPanResponderMove: (_, g) => {
        setTextPos({
          x: textStartPosRef.current.x + g.dx,
          y: textStartPosRef.current.y + g.dy,
        });
      },
      onPanResponderRelease: (_, g) => {
        setTextPos({
          x: textStartPosRef.current.x + g.dx,
          y: textStartPosRef.current.y + g.dy,
        });
      },
    }),
  ).current;

  /* ------------------------------------------------------------- */
  /*                PERSIST STICKER TO DEVICE STORAGE              */
  /* ------------------------------------------------------------- */

  const ensureStickerDir = async () => {
    try {
      const exists = await RNFS.exists(STICKER_DIR);
      if (!exists) {
        await RNFS.mkdir(STICKER_DIR);
      }
    } catch (err) {
      console.warn('Failed to ensure sticker directory', err);
    }
  };

  const persistStickerLocally = async (sticker: Sticker) => {
    try {
      const existing = await AsyncStorage.getItem(STICKER_STORAGE_KEY);
      let list: Sticker[] = [];

      if (existing) {
        try {
          list = JSON.parse(existing);
        } catch (e) {
          console.warn('Failed to parse stored stickers, resetting list', e);
          list = [];
        }
      }

      const updated = [sticker, ...list];

      await AsyncStorage.setItem(
        STICKER_STORAGE_KEY,
        JSON.stringify(updated),
      );
    } catch (err) {
      console.warn('Error saving sticker to device', err);
    }
  };

  /* ------------------------------------------------------------- */
  /*                       SAVE STICKER                            */
  /* ------------------------------------------------------------- */
  const handleSave = async () => {
    if (!imageUri || saving) return;

    try {
      setSaving(true);

      if (!viewShotRef.current) {
        setSaving(false);
        return;
      }
      const capture = (viewShotRef.current as any).capture;
      if (typeof capture !== 'function') {
        setSaving(false);
        return;
      }

      // 1) Capture the composed sticker (image + text) as PNG
      const captureUri = await capture({
        format: 'png',
        quality: 1,
      });

      if (!captureUri) {
        setSaving(false);
        return;
      }

      // 2) Ensure we have a stickers directory
      await ensureStickerDir();

      // 3) Resize & compress to PNG inside STICKER_DIR
      const resized = await ImageResizer.createResizedImage(
        captureUri,
        512, // width
        512, // height
        'PNG',
        80, // quality (0-100)
        0, // rotation
        STICKER_DIR,
        false,
        { mode: 'contain' },
      );

      // 4) Use the path returned by ImageResizer as the final PNG
      const basePath = (resized as any).path ?? resized.uri; // path on Android, uri on iOS

      const normalizedPath = basePath.startsWith('file://')
        ? basePath.slice(7)
        : basePath;

      const finalImageUri = basePath.startsWith('file://')
        ? basePath
        : `file://${normalizedPath}`;

      const stickerId = `${Date.now()}`;
      const trimmedText = text.trim();

      // 5) Build sticker metadata — ONLY PNG
      const sticker: Sticker = {
        id: stickerId,
        uri: finalImageUri,
        text: trimmedText || undefined,
        fileType: 'kis-sticker',
        mimeType: 'image/png',
        extension: '.png',
        metaPath: normalizedPath, // path to the PNG on disk
      };

      // 6) Save to AsyncStorage for the library
      await persistStickerLocally(sticker);

      // 7) Notify parent, then close
      onSaveSticker(sticker);
      onClose();
    } catch (err) {
      console.warn('Sticker capture error', err);
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!imageUri && !saving;

  /* ------------------------------------------------------------- */
  /*                         RENDER UI                             */
  /* ------------------------------------------------------------- */
  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: palette.chatBg ?? '#000',
        transform: [{ translateX }],
      }}
    >
      {/* HEADER */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: palette.card,
        }}
      >
        <Pressable onPress={onClose} style={{ padding: 8, marginRight: 8 }}>
          <KISIcon name="back" size={22} color={palette.primary} />
        </Pressable>

        <Text
          style={{
            color: palette.primary,
            fontSize: 16,
            fontWeight: '600',
            flex: 1,
          }}
        >
          Create Sticker
        </Text>

        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
            backgroundColor: canSave
              ? palette.primary
              : 'rgba(255,255,255,0.25)',
            opacity: canSave ? 1 : 0.5,
          }}
        >
          <Text style={{ color: palette.onPrimary, fontWeight: '600' }}>
            {saving ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      </View>

      {/* BODY */}
      <View style={{ flex: 1, padding: 16 }}>
        {/* Sticker Preview */}
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <ViewShot
            ref={viewShotRef}
            options={{
              // We force PNG; from here on everything is PNG.
              format: 'png',
              quality: 1,
              width: 512,
              height: 512,
            }}
            style={{
              width: 260,
              height: 260,
              borderRadius: 24,
              backgroundColor: '#00000055',
              overflow: 'hidden',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {imageUri ? (
              <View
                style={{
                  flex: 1,
                  width: '100%',
                  height: '100%',
                  position: 'relative',
                }}
              >
                {/* Background image */}
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />

                {/* Draggable Text ABOVE image */}
                <View
                  {...panResponder.panHandlers}
                  style={{
                    position: 'absolute',
                    left: textPos.x,
                    top: textPos.y,
                  }}
                >
                  <Text
                    style={{
                      color: textColor,
                      fontSize,
                      fontWeight: '700',
                      textShadowColor: 'rgba(0,0,0,0.6)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 2,
                    }}
                  >
                    {text}
                  </Text>
                </View>
              </View>
            ) : (
              <Pressable
                style={{ justifyContent: 'center', alignItems: 'center' }}
                onPress={handlePickImage}
              >
                <KISIcon name="camera" color="white" />
                <Text style={{ color: '#fff', fontSize: 13 }}>
                  Tap to select an image
                </Text>
              </Pressable>
            )}
          </ViewShot>
        </View>

        {/* Controls */}
        <View style={{ flex: 1 }}>
          {/* Image Actions */}
          <View
            style={{
              flexDirection: 'row',
              marginBottom: 12,
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Pressable
              onPress={handlePickImage}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: palette.card,
              }}
            >
              <Text style={{ color: palette.text }}>Choose Image</Text>
            </Pressable>

            <Pressable
              onPress={handleOpenBgRemoval}
              disabled={!imageUri || showBgRemoval}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor:
                  imageUri && !showBgRemoval
                    ? palette.card
                    : 'rgba(255,255,255,0.2)',
              }}
            >
              <Text style={{ color: palette.text }}>
                {bgRemoved ? 'BG Removed ✓' : 'Remove BG'}
              </Text>
            </Pressable>
          </View>

          {/* Text Input */}
          <View
            style={{
              borderRadius: 12,
              backgroundColor: palette.card,
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginBottom: 12,
            }}
          >
            <TextInput
              multiline
              placeholder="Sticker text"
              placeholderTextColor={palette.subtext}
              value={text}
              onChangeText={setText}
              style={{
                minHeight: 40,
                color: palette.text,
              }}
            />
          </View>

          {/* Text Colors */}
          <Text style={{ color: palette.subtext, marginBottom: 4 }}>
            Text color
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {TEXT_COLORS.map((c) => {
              const selected = textColor === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setTextColor(c)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: c,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? '#fff' : '#777',
                    marginRight: 8,
                    marginBottom: 8,
                  }}
                />
              );
            })}
          </View>

          {/* Font size */}
          <Text style={{ color: palette.subtext, marginTop: 12 }}>
            Text size
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {FONT_SIZES.map((s) => {
              const selected = s === fontSize;
              return (
                <Pressable
                  key={s}
                  onPress={() => setFontSize(s)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 16,
                    borderWidth: 2,
                    borderColor: selected ? palette.primary : '#666',
                    backgroundColor: selected
                      ? palette.primary + '33'
                      : 'transparent',
                    marginRight: 8,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: palette.text }}>{s}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* 🔹 Background removal as a BOTTOM SHEET, not full-page */}
      {showBgRemoval && imageUri && (
          <StickerBackgroundRemovalScreen
            palette={palette}
            originalUri={imageUri}
            originalBase64={imageBase64}
            onCancel={() => setShowBgRemoval(false)}
            onDone={(newUri, { bgRemoved }) => {
              setImageUri(newUri);
              setBgRemoved(bgRemoved);
              // If you want to keep the ability to "restore original", keep originalUri untouched
              // or update it here depending on UX decision.
              setShowBgRemoval(false);
            }}
          />
      )}
    </Animated.View>
  );
};
